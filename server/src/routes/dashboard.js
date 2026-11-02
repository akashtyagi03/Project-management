const express = require('express');
const { getDatabase } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function accessClause(user) {
  if (user.role === 'ADMIN') return '1 = 1';
  return `(
    p.manager_id = @userId
    OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = p.id AND pm.user_id = @userId
    )
  )`;
}

router.get('/', (req, res) => {
  const db = getDatabase();
  const access = accessClause(req.user);
  const params = { userId: req.user.id };

  const projectCount = db
    .prepare(`SELECT COUNT(*) AS count FROM projects p WHERE ${access}`)
    .get(params).count;

  const taskStats = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(t.status = 'TODO'), 0) AS todo,
        COALESCE(SUM(t.status = 'IN_PROGRESS'), 0) AS in_progress,
        COALESCE(SUM(t.status = 'COMPLETED'), 0) AS completed,
        COALESCE(SUM(t.status != 'COMPLETED' AND t.due_date IS NOT NULL AND t.due_date < date('now')), 0) AS overdue,
        COALESCE(SUM(t.status != 'COMPLETED' AND t.due_date >= date('now') AND t.due_date <= date('now', '+7 day')), 0) AS due_this_week
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE ${access}
    `)
    .get(params);

  const taskTotal = Number(taskStats.total);
  const completed = Number(taskStats.completed);

  const projects = db
    .prepare(`
      SELECT
        p.id, p.name, p.deadline, p.updated_at,
        u.name AS manager_name,
        (SELECT COUNT(*) FROM project_members pmc WHERE pmc.project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM tasks tc WHERE tc.project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM tasks tc WHERE tc.project_id = p.id AND tc.status = 'COMPLETED') AS completed_tasks
      FROM projects p
      JOIN users u ON u.id = p.manager_id
      WHERE ${access}
      ORDER BY CASE WHEN p.deadline IS NULL THEN 1 ELSE 0 END, p.deadline ASC
      LIMIT 5
    `)
    .all(params)
    .map((project) => ({
      ...project,
      task_count: Number(project.task_count),
      completed_tasks: Number(project.completed_tasks),
      member_count: Number(project.member_count),
      progress:
        Number(project.task_count) === 0
          ? 0
          : Math.round((Number(project.completed_tasks) / Number(project.task_count)) * 100),
    }));

  const upcoming = db
    .prepare(`
      SELECT
        t.id, t.title, t.status, t.priority, t.due_date,
        t.project_id, p.name AS project_name,
        a.name AS assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users a ON a.id = t.assigned_to
      WHERE ${access}
        AND t.status != 'COMPLETED'
        AND t.due_date IS NOT NULL
        AND t.due_date >= date('now')
        AND t.due_date <= date('now', '+14 day')
      ORDER BY t.due_date ASC,
        CASE t.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END
      LIMIT 6
    `)
    .all(params);

  const overdue = db
    .prepare(`
      SELECT
        t.id, t.title, t.status, t.priority, t.due_date,
        t.project_id, p.name AS project_name,
        a.name AS assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users a ON a.id = t.assigned_to
      WHERE ${access}
        AND t.status != 'COMPLETED'
        AND t.due_date IS NOT NULL
        AND t.due_date < date('now')
      ORDER BY t.due_date ASC
      LIMIT 4
    `)
    .all(params);

  const team = db
    .prepare(`
      SELECT
        u.id, u.name, u.role,
        COUNT(t.id) AS assigned,
        COALESCE(SUM(t.status = 'COMPLETED'), 0) AS completed
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users u ON u.id = t.assigned_to
      WHERE ${access}
      GROUP BY u.id
      ORDER BY completed DESC, assigned DESC
      LIMIT 6
    `)
    .all(params)
    .map((member) => ({
      ...member,
      assigned: Number(member.assigned),
      completed: Number(member.completed),
      completion_rate:
        Number(member.assigned) === 0
          ? 0
          : Math.round((Number(member.completed) / Number(member.assigned)) * 100),
    }));

  res.json({
    summary: {
      projects: Number(projectCount),
      tasks: taskTotal,
      completed,
      pending: taskTotal - completed,
      overdue: Number(taskStats.overdue),
      due_this_week: Number(taskStats.due_this_week),
      completion_rate: taskTotal === 0 ? 0 : Math.round((completed / taskTotal) * 100),
    },
    status_breakdown: {
      todo: Number(taskStats.todo),
      in_progress: Number(taskStats.in_progress),
      completed,
    },
    priority_breakdown: db
      .prepare(`
        SELECT
          t.priority,
          COUNT(*) AS count
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE ${access}
        GROUP BY t.priority
      `)
      .all(params)
      .reduce(
        (result, row) => ({ ...result, [row.priority.toLowerCase()]: Number(row.count) }),
        { low: 0, medium: 0, high: 0 }
      ),
    projects,
    upcoming,
    overdue,
    team,
  });
});

module.exports = router;
