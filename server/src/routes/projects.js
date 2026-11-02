const express = require('express');
const { getDatabase } = require('../db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError, pagination, paginationMeta } = require('../utils/http');
const {
  getProject,
  requireProject,
  requireProjectManager,
  isProjectMember,
} = require('../utils/access');
const { recordAudit } = require('../utils/audit');
const { removeUpload } = require('../utils/upload');
const validate = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function accessibleClause(user) {
  if (user.role === 'ADMIN') return '1 = 1';
  return `(
    p.manager_id = @userId
    OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = p.id AND pm.user_id = @userId
    )
  )`;
}

function serializeProject(project) {
  const taskCount = Number(project.task_count || 0);
  const completed = Number(project.completed_tasks || 0);

  return {
    ...project,
    task_count: taskCount,
    completed_tasks: completed,
    member_count: Number(project.member_count || 0),
    progress: taskCount === 0 ? 0 : Math.round((completed / taskCount) * 100),
  };
}

function projectDetails(db, projectId) {
  const project = getProject(db, projectId);
  if (!project) return null;

  const members = db
    .prepare(`
      SELECT u.id, u.name, u.email, u.role, pm.added_at
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, u.name COLLATE NOCASE
    `)
    .all(projectId, project.manager_id);

  const stats = db
    .prepare(`
      SELECT
        COUNT(*) AS task_count,
        COALESCE(SUM(status = 'COMPLETED'), 0) AS completed_tasks,
        COALESCE(SUM(status = 'IN_PROGRESS'), 0) AS in_progress_tasks,
        COALESCE(SUM(status = 'TODO'), 0) AS todo_tasks,
        COALESCE(SUM(status != 'COMPLETED' AND due_date < date('now')), 0) AS overdue_tasks
      FROM tasks
      WHERE project_id = ?
    `)
    .get(projectId);

  return {
    ...serializeProject({ ...project, ...stats, member_count: members.length }),
    members,
  };
}

function ensureManager(db, managerId) {
  const manager = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(managerId);

  if (!manager) throw new HttpError(400, 'Project manager not found');
  if (!['PROJECT_MANAGER', 'ADMIN'].includes(manager.role)) {
    throw new HttpError(400, 'A project manager must have the Project Manager or Admin role');
  }
  return manager;
}

router.get('/', (req, res) => {
  const db = getDatabase();
  const { page, limit, offset } = pagination(req.query, 9);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const scope = req.query.scope || 'all';
  const sort = req.query.sort || 'deadline';

  if (!['all', 'managed', 'member'].includes(scope)) {
    throw new HttpError(400, 'Scope must be all, managed, or member');
  }
  if (!['deadline', 'recent', 'name'].includes(sort)) {
    throw new HttpError(400, 'Sort must be deadline, recent, or name');
  }

  const conditions = [accessibleClause(req.user)];
  const params = { userId: req.user.id, limit, offset };

  if (q) {
    conditions.push('(p.name LIKE @search OR p.description LIKE @search)');
    params.search = `%${q}%`;
  }

  if (scope === 'managed') {
    conditions.push('p.manager_id = @userId');
  } else if (scope === 'member') {
    conditions.push(`
      p.manager_id != @userId
      AND EXISTS (
        SELECT 1 FROM project_members scoped_pm
        WHERE scoped_pm.project_id = p.id AND scoped_pm.user_id = @userId
      )
    `);
  }

  const orderBy =
    sort === 'name'
      ? 'p.name COLLATE NOCASE ASC'
      : sort === 'recent'
        ? 'p.updated_at DESC'
        : 'CASE WHEN p.deadline IS NULL THEN 1 ELSE 0 END, p.deadline ASC';

  const where = `WHERE ${conditions.join(' AND ')}`;

  const projects = db
    .prepare(`
      SELECT
        p.*,
        u.name AS manager_name,
        u.email AS manager_email,
        (SELECT COUNT(*) FROM project_members pmc WHERE pmc.project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM tasks tc WHERE tc.project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM tasks tc WHERE tc.project_id = p.id AND tc.status = 'COMPLETED') AS completed_tasks
      FROM projects p
      JOIN users u ON u.id = p.manager_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `)
    .all(params);

  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM projects p ${where}`)
    .get(params).count;

  res.json({
    data: projects.map(serializeProject),
    meta: paginationMeta(page, limit, total),
  });
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!['ADMIN', 'PROJECT_MANAGER'].includes(req.user.role)) {
      throw new HttpError(403, 'Only admins and project managers can create projects');
    }

    const db = getDatabase();
    const name = validate.text(req.body.name, 'Project name', { min: 2, max: 120 });
    const description =
      validate.text(req.body.description, 'Description', {
        max: 5000,
        optional: true,
      }) || '';
    const deadline = validate.date(req.body.deadline, 'Deadline');

    let managerId = req.user.id;
    if (req.user.role === 'ADMIN' && req.body.managerId) {
      managerId = validate.id(req.body.managerId, 'Project manager');
    } else if (
      req.user.role === 'PROJECT_MANAGER' &&
      req.body.managerId &&
      Number(req.body.managerId) !== req.user.id
    ) {
      throw new HttpError(403, 'Project managers can only manage their own projects');
    }

    ensureManager(db, managerId);

    const create = db.transaction(() => {
      const result = db
        .prepare(`
          INSERT INTO projects (name, description, manager_id, deadline, created_by)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(name, description, managerId, deadline, req.user.id);

      db.prepare(
        'INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)'
      ).run(result.lastInsertRowid, managerId);

      return result.lastInsertRowid;
    });

    const projectId = create();

    recordAudit(db, {
      actorId: req.user.id,
      action: 'project.created',
      entityType: 'project',
      entityId: projectId,
      details: { name },
    });

    res.status(201).json({ data: projectDetails(db, projectId) });
  })
);

router.get('/:id', (req, res) => {
  const db = getDatabase();
  const projectId = validate.id(req.params.id, 'Project id');
  const { project } = requireProject(db, projectId, req.user);
  res.json({ data: projectDetails(db, project.id) });
});

router.patch('/:id', (req, res) => {
  const db = getDatabase();
  const projectId = validate.id(req.params.id, 'Project id');
  const { project } = requireProjectManager(db, projectId, req.user);

  if (req.body.managerId !== undefined && req.user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only an admin can reassign a project manager');
  }

  const name =
    req.body.name !== undefined
      ? validate.text(req.body.name, 'Project name', { min: 2, max: 120 })
      : project.name;
  const description =
    req.body.description !== undefined
      ? validate.text(req.body.description, 'Description', {
          max: 5000,
          optional: true,
        }) || ''
      : project.description;
  const deadline =
    req.body.deadline !== undefined
      ? validate.date(req.body.deadline, 'Deadline')
      : project.deadline;

  let managerId = project.manager_id;
  if (req.body.managerId !== undefined) {
    managerId = validate.id(req.body.managerId, 'Project manager');
    ensureManager(db, managerId);
  }

  const update = db.transaction(() => {
    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, deadline = ?, manager_id = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(name, description, deadline, managerId, project.id);

    if (managerId !== project.manager_id) {
      db.prepare(
        'INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)'
      ).run(project.id, managerId);
    }
  });

  update();

  const changed = ['name', 'description', 'deadline', 'managerId'].filter(
    (field) => req.body[field] !== undefined
  );

  recordAudit(db, {
    actorId: req.user.id,
    action: 'project.updated',
    entityType: 'project',
    entityId: project.id,
    details: { name, fields: changed },
  });

  res.json({ data: projectDetails(db, project.id) });
});

router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const projectId = validate.id(req.params.id, 'Project id');
  const { project } = requireProjectManager(db, projectId, req.user);

  const files = db
    .prepare(`
      SELECT a.stored_name
      FROM attachments a
      JOIN tasks t ON t.id = a.task_id
      WHERE t.project_id = ?
    `)
    .all(project.id);

  db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
  files.forEach((file) => removeUpload(file.stored_name));

  recordAudit(db, {
    actorId: req.user.id,
    action: 'project.deleted',
    entityType: 'project',
    entityId: project.id,
    details: { name: project.name },
  });

  res.status(204).end();
});

router.post('/:id/members', (req, res) => {
  const db = getDatabase();
  const projectId = validate.id(req.params.id, 'Project id');
  const { project } = requireProjectManager(db, projectId, req.user);
  const userId = validate.id(req.body.userId, 'Team member');

  const user = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(userId);

  if (!user) throw new HttpError(404, 'User not found');
  if (isProjectMember(db, project.id, user.id)) {
    throw new HttpError(409, 'That person is already on the project');
  }

  db.prepare(
    'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)'
  ).run(project.id, user.id);

  recordAudit(db, {
    actorId: req.user.id,
    action: 'member.added',
    entityType: 'project',
    entityId: project.id,
    details: { name: user.name, userId: user.id },
  });

  res.status(201).json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

router.delete('/:id/members/:userId', (req, res) => {
  const db = getDatabase();
  const projectId = validate.id(req.params.id, 'Project id');
  const userId = validate.id(req.params.userId, 'User id');
  const { project } = requireProjectManager(db, projectId, req.user);

  if (userId === project.manager_id) {
    throw new HttpError(400, 'The project manager cannot be removed from the team');
  }

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!user || !isProjectMember(db, project.id, userId)) {
    throw new HttpError(404, 'That person is not on this project');
  }

  const openTasks = db
    .prepare(`
      SELECT COUNT(*) AS count FROM tasks
      WHERE project_id = ? AND assigned_to = ? AND status != 'COMPLETED'
    `)
    .get(project.id, userId).count;

  if (openTasks > 0) {
    throw new HttpError(400, 'Reassign this person’s open tasks before removing them');
  }

  db.prepare(
    'DELETE FROM project_members WHERE project_id = ? AND user_id = ?'
  ).run(project.id, userId);

  recordAudit(db, {
    actorId: req.user.id,
    action: 'member.removed',
    entityType: 'project',
    entityId: project.id,
    details: { name: user.name, userId: user.id },
  });

  res.status(204).end();
});

module.exports = router;
