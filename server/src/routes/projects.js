const express = require('express');
const { Project, Task, User, Attachment, Comment } = require('../models');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError, pagination, paginationMeta } = require('../utils/http');
const {
  requireProject,
  requireProjectManager,
  isProjectMember,
} = require('../utils/access');
const { recordAudit } = require('../utils/audit');
const { removeUpload } = require('../utils/upload');
const validate = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function accessibleFilter(user) {
  if (user.role === 'ADMIN') return {};
  const userId = user.id || user._id;
  return {
    $or: [{ manager_id: userId }, { members: userId }],
  };
}

function serializeProject(project) {
  const taskCount = Number(project.task_count || 0);
  const completed = Number(project.completed_tasks || 0);

  return {
    ...project,
    task_count: taskCount,
    completed_tasks: completed,
    member_count: Number(project.member_count || (project.members ? project.members.length : 0)),
    progress: taskCount === 0 ? 0 : Math.round((completed / taskCount) * 100),
  };
}

async function projectDetails(projectId) {
  const project = await Project.findById(projectId)
    .populate('manager_id', 'name email role')
    .populate('members', 'name email role created_at');

  if (!project) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const tasks = await Task.find({ project_id: projectId });

  const taskCount = tasks.length;
  let completed = 0;
  let inProgress = 0;
  let todo = 0;
  let overdue = 0;

  for (const t of tasks) {
    if (t.status === 'COMPLETED') completed++;
    else if (t.status === 'IN_PROGRESS') inProgress++;
    else if (t.status === 'TODO') todo++;

    if (t.status !== 'COMPLETED' && t.due_date && t.due_date < todayStr) {
      overdue++;
    }
  }

  const membersList = (project.members || []).map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    added_at: u.created_at || project.created_at,
  }));

  // Sort manager first, then alphabetical
  const managerIdStr = String(project.manager_id?._id || project.manager_id);
  membersList.sort((a, b) => {
    if (a.id === managerIdStr) return -1;
    if (b.id === managerIdStr) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    id: String(project._id),
    name: project.name,
    description: project.description,
    manager_id: managerIdStr,
    manager_name: project.manager_id ? project.manager_id.name : '',
    manager_email: project.manager_id ? project.manager_id.email : '',
    deadline: project.deadline,
    created_at: project.created_at,
    updated_at: project.updated_at,
    task_count: taskCount,
    completed_tasks: completed,
    in_progress_tasks: inProgress,
    todo_tasks: todo,
    overdue_tasks: overdue,
    member_count: membersList.length,
    progress: taskCount === 0 ? 0 : Math.round((completed / taskCount) * 100),
    members: membersList,
  };
}

async function ensureManager(managerId) {
  const manager = await User.findById(managerId);
  if (!manager) throw new HttpError(400, 'Project manager not found');
  if (!['PROJECT_MANAGER', 'ADMIN'].includes(manager.role)) {
    throw new HttpError(400, 'A project manager must have the Project Manager or Admin role');
  }
  return manager;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
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

    const filter = accessibleFilter(req.user);

    if (q) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ],
      });
    }

    const userId = req.user.id;
    if (scope === 'managed') {
      filter.manager_id = userId;
    } else if (scope === 'member') {
      filter.manager_id = { $ne: userId };
      filter.members = userId;
    }

    let sortOptions = {};
    if (sort === 'name') {
      sortOptions = { name: 1 };
    } else if (sort === 'recent') {
      sortOptions = { updated_at: -1 };
    } else {
      sortOptions = { deadline: 1 };
    }

    const total = await Project.countDocuments(filter);
    const projects = await Project.find(filter)
      .populate('manager_id', 'name email')
      .sort(sortOptions)
      .skip(offset)
      .limit(limit);

    // Populate task counts for each project
    const projectSummaries = await Promise.all(
      projects.map(async (p) => {
        const taskCount = await Task.countDocuments({ project_id: p._id });
        const completedTasks = await Task.countDocuments({
          project_id: p._id,
          status: 'COMPLETED',
        });

        return serializeProject({
          id: String(p._id),
          name: p.name,
          description: p.description,
          manager_id: String(p.manager_id?._id || p.manager_id),
          manager_name: p.manager_id ? p.manager_id.name : '',
          manager_email: p.manager_id ? p.manager_id.email : '',
          deadline: p.deadline,
          created_at: p.created_at,
          updated_at: p.updated_at,
          member_count: p.members ? p.members.length : 0,
          task_count: taskCount,
          completed_tasks: completedTasks,
        });
      })
    );

    res.json({
      data: projectSummaries,
      meta: paginationMeta(page, limit, total),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!['ADMIN', 'PROJECT_MANAGER'].includes(req.user.role)) {
      throw new HttpError(403, 'Only admins and project managers can create projects');
    }

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
      String(req.body.managerId) !== String(req.user.id)
    ) {
      throw new HttpError(403, 'Project managers can only manage their own projects');
    }

    await ensureManager(managerId);

    const project = await Project.create({
      name,
      description,
      manager_id: managerId,
      deadline,
      created_by: req.user.id,
      members: [managerId],
    });

    recordAudit({
      actorId: req.user.id,
      action: 'project.created',
      entityType: 'project',
      entityId: String(project._id),
      details: { name },
    });

    res.status(201).json({ data: await projectDetails(project._id) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const projectId = validate.id(req.params.id, 'Project id');
    await requireProject(projectId, req.user);
    res.json({ data: await projectDetails(projectId) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const projectId = validate.id(req.params.id, 'Project id');
    const { project } = await requireProjectManager(projectId, req.user);

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
      await ensureManager(managerId);
    }

    const dbProject = await Project.findById(projectId);
    dbProject.name = name;
    dbProject.description = description;
    dbProject.deadline = deadline;
    dbProject.manager_id = managerId;

    if (!dbProject.members.some((m) => String(m) === String(managerId))) {
      dbProject.members.push(managerId);
    }

    await dbProject.save();

    const changed = ['name', 'description', 'deadline', 'managerId'].filter(
      (field) => req.body[field] !== undefined
    );

    recordAudit({
      actorId: req.user.id,
      action: 'project.updated',
      entityType: 'project',
      entityId: String(project.id),
      details: { name, fields: changed },
    });

    res.json({ data: await projectDetails(project.id) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const projectId = validate.id(req.params.id, 'Project id');
    const { project } = await requireProjectManager(projectId, req.user);

    // Find and delete all task attachments on disk
    const tasks = await Task.find({ project_id: projectId });
    const taskIds = tasks.map((t) => t._id);

    const attachments = await Attachment.find({ task_id: { $in: taskIds } });
    attachments.forEach((file) => removeUpload(file.stored_name));

    await Attachment.deleteMany({ task_id: { $in: taskIds } });
    await Comment.deleteMany({ task_id: { $in: taskIds } });
    await Task.deleteMany({ project_id: projectId });
    await Project.findByIdAndDelete(projectId);

    recordAudit({
      actorId: req.user.id,
      action: 'project.deleted',
      entityType: 'project',
      entityId: String(project.id),
      details: { name: project.name },
    });

    res.status(204).end();
  })
);

router.post(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const projectId = validate.id(req.params.id, 'Project id');
    await requireProjectManager(projectId, req.user);
    const userId = validate.id(req.body.userId, 'Team member');

    const user = await User.findById(userId);
    if (!user) throw new HttpError(404, 'User not found');

    const project = await Project.findById(projectId);
    if (project.members.some((m) => String(m) === String(userId))) {
      throw new HttpError(409, 'That person is already on the project');
    }

    project.members.push(userId);
    await project.save();

    recordAudit({
      actorId: req.user.id,
      action: 'member.added',
      entityType: 'project',
      entityId: String(project._id),
      details: { name: user.name, userId: String(user._id) },
    });

    res.status(201).json({
      data: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  })
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const projectId = validate.id(req.params.id, 'Project id');
    const userId = validate.id(req.params.userId, 'User id');
    const { project } = await requireProjectManager(projectId, req.user);

    if (String(userId) === String(project.manager_id)) {
      throw new HttpError(400, 'The project manager cannot be removed from the team');
    }

    const user = await User.findById(userId);
    const dbProject = await Project.findById(projectId);
    if (!user || !dbProject.members.some((m) => String(m) === String(userId))) {
      throw new HttpError(404, 'That person is not on this project');
    }

    const openTasks = await Task.countDocuments({
      project_id: projectId,
      assigned_to: userId,
      status: { $ne: 'COMPLETED' },
    });

    if (openTasks > 0) {
      throw new HttpError(400, 'Reassign this person’s open tasks before removing them');
    }

    dbProject.members = dbProject.members.filter((m) => String(m) !== String(userId));
    await dbProject.save();

    recordAudit({
      actorId: req.user.id,
      action: 'member.removed',
      entityType: 'project',
      entityId: String(project.id),
      details: { name: user.name, userId: String(user._id) },
    });

    res.status(204).end();
  })
);

module.exports = router;
