const express = require('express');
const { Project, Task, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

const router = express.Router();
router.use(authenticate);

async function getAccessibleProjectIds(user) {
  if (user.role === 'ADMIN') {
    const all = await Project.find({}, '_id');
    return all.map((p) => p._id);
  }
  const userId = user.id || user._id;
  const projects = await Project.find(
    {
      $or: [{ manager_id: userId }, { members: userId }],
    },
    '_id'
  );
  return projects.map((p) => p._id);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const accessibleProjectIds = await getAccessibleProjectIds(req.user);

    const projectCount = accessibleProjectIds.length;
    const tasks = await Task.find({ project_id: { $in: accessibleProjectIds } })
      .populate('project_id', 'name')
      .populate('assigned_to', 'name email role');

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().slice(0, 10);

    const nextFortnight = new Date();
    nextFortnight.setDate(nextFortnight.getDate() + 14);
    const nextFortnightStr = nextFortnight.toISOString().slice(0, 10);

    let todo = 0;
    let inProgress = 0;
    let completed = 0;
    let overdueCount = 0;
    let dueThisWeek = 0;

    const priorityCounts = { low: 0, medium: 0, high: 0 };
    const memberStatsMap = {};

    for (const t of tasks) {
      if (t.status === 'COMPLETED') completed++;
      else if (t.status === 'IN_PROGRESS') inProgress++;
      else if (t.status === 'TODO') todo++;

      if (t.status !== 'COMPLETED' && t.due_date) {
        if (t.due_date < todayStr) overdueCount++;
        if (t.due_date >= todayStr && t.due_date <= nextWeekStr) dueThisWeek++;
      }

      const pKey = (t.priority || 'medium').toLowerCase();
      if (priorityCounts[pKey] !== undefined) {
        priorityCounts[pKey]++;
      }

      if (t.assigned_to) {
        const aId = String(t.assigned_to._id);
        if (!memberStatsMap[aId]) {
          memberStatsMap[aId] = {
            id: aId,
            name: t.assigned_to.name,
            role: t.assigned_to.role,
            assigned: 0,
            completed: 0,
          };
        }
        memberStatsMap[aId].assigned++;
        if (t.status === 'COMPLETED') {
          memberStatsMap[aId].completed++;
        }
      }
    }

    const taskTotal = tasks.length;

    // Top 5 Projects sorted by deadline
    const dbProjects = await Project.find({ _id: { $in: accessibleProjectIds } })
      .populate('manager_id', 'name email')
      .sort({ deadline: 1, updated_at: -1 })
      .limit(5);

    const projects = await Promise.all(
      dbProjects.map(async (p) => {
        const pTasks = await Task.find({ project_id: p._id }, 'status');
        const pTotal = pTasks.length;
        const pCompleted = pTasks.filter((t) => t.status === 'COMPLETED').length;

        return {
          id: String(p._id),
          name: p.name,
          deadline: p.deadline,
          updated_at: p.updated_at,
          manager_name: p.manager_id ? p.manager_id.name : '',
          member_count: p.members ? p.members.length : 0,
          task_count: pTotal,
          completed_tasks: pCompleted,
          progress: pTotal === 0 ? 0 : Math.round((pCompleted / pTotal) * 100),
        };
      })
    );

    // Upcoming tasks (next 14 days, not completed)
    const upcomingTasks = tasks
      .filter(
        (t) =>
          t.status !== 'COMPLETED' &&
          t.due_date &&
          t.due_date >= todayStr &&
          t.due_date <= nextFortnightStr
      )
      .sort((a, b) => {
        if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
        const prioOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return (prioOrder[a.priority] || 1) - (prioOrder[b.priority] || 1);
      })
      .slice(0, 6)
      .map((t) => ({
        id: String(t._id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        project_id: t.project_id ? String(t.project_id._id) : '',
        project_name: t.project_id ? t.project_id.name : '',
        assignee_name: t.assigned_to ? t.assigned_to.name : null,
      }));

    // Overdue tasks
    const overdueTasks = tasks
      .filter((t) => t.status !== 'COMPLETED' && t.due_date && t.due_date < todayStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 4)
      .map((t) => ({
        id: String(t._id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        project_id: t.project_id ? String(t.project_id._id) : '',
        project_name: t.project_id ? t.project_id.name : '',
        assignee_name: t.assigned_to ? t.assigned_to.name : null,
      }));

    // Team members stats
    const team = Object.values(memberStatsMap)
      .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned)
      .slice(0, 6)
      .map((m) => ({
        ...m,
        completion_rate:
          m.assigned === 0 ? 0 : Math.round((m.completed / m.assigned) * 100),
      }));

    res.json({
      summary: {
        projects: projectCount,
        tasks: taskTotal,
        completed,
        pending: taskTotal - completed,
        overdue: overdueCount,
        due_this_week: dueThisWeek,
        completion_rate: taskTotal === 0 ? 0 : Math.round((completed / taskTotal) * 100),
      },
      status_breakdown: {
        todo,
        in_progress: inProgress,
        completed,
      },
      priority_breakdown: priorityCounts,
      projects,
      upcoming: upcomingTasks,
      overdue: overdueTasks,
      team,
    });
  })
);

module.exports = router;
