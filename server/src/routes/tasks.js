const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { Task, Project, User, Comment, Attachment } = require('../models');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError, pagination, paginationMeta } = require('../utils/http');
const {
  getProject,
  requireTask,
  isProjectMember,
  requireProjectManager,
} = require('../utils/access');
const { recordAudit } = require('../utils/audit');
const { upload, removeUpload } = require('../utils/upload');
const validate = require('../utils/validate');

const router = express.Router();
const STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

router.use(authenticate);

async function taskCounts(taskId) {
  const [commentsCount, attachmentsCount] = await Promise.all([
    Comment.countDocuments({ task_id: taskId }),
    Attachment.countDocuments({ task_id: taskId }),
  ]);
  return {
    comments_count: commentsCount,
    attachments_count: attachmentsCount,
  };
}

async function serializeTask(task) {
  if (!task) return null;
  const taskId = task.id || task._id;
  const counts = await taskCounts(taskId);
  const plain = typeof task.toJSON === 'function' ? task.toJSON() : task;

  return {
    ...plain,
    id: String(taskId),
    ...counts,
  };
}

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

async function checkAssignee(project, assigneeId) {
  if (assigneeId === null || assigneeId === undefined) return null;

  const user = await User.findById(assigneeId).select('name email role');
  if (!user) throw new HttpError(400, 'The selected assignee does not exist');

  const uId = String(user._id);
  const managerId = String(project.manager_id?._id || project.manager_id);
  const isMember = isProjectMember(project, uId);

  if (uId !== managerId && !isMember) {
    throw new HttpError(400, 'The assignee needs to be on the project team first');
  }
  return user;
}

const loadTaskView = asyncHandler(async (req, _res, next) => {
  const taskId = validate.id(req.params.taskId, 'Task id');
  req.taskAccess = await requireTask(taskId, req.user);
  next();
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query, 10);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const { status, priority, projectId, assigneeId, sort } = req.query;

    if (status && !STATUSES.includes(status)) {
      throw new HttpError(400, 'Invalid status filter');
    }
    if (priority && !PRIORITIES.includes(priority)) {
      throw new HttpError(400, 'Invalid priority filter');
    }
    if (sort && !['due_date', 'created', 'priority'].includes(sort)) {
      throw new HttpError(400, 'Invalid task sort');
    }

    const accessibleProjects = await getAccessibleProjectIds(req.user);

    const filter = {
      project_id: { $in: accessibleProjects },
    };

    if (projectId) {
      validate.id(projectId, 'Project id');
      filter.project_id = projectId;
    }

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }
    if (status) {
      filter.status = status;
    }
    if (priority) {
      filter.priority = priority;
    }
    if (assigneeId === 'me') {
      filter.assigned_to = req.user.id;
    } else if (assigneeId === 'unassigned') {
      filter.assigned_to = null;
    } else if (assigneeId) {
      validate.id(assigneeId, 'Assignee id');
      filter.assigned_to = assigneeId;
    }

    let sortOptions = {};
    if (sort === 'created') {
      sortOptions = { created_at: -1 };
    } else if (sort === 'priority') {
      sortOptions = { priority: 1 };
    } else {
      sortOptions = { due_date: 1 };
    }

    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .populate('project_id', 'name')
      .populate('assigned_to', 'name email role')
      .sort(sortOptions)
      .skip(offset)
      .limit(limit);

    const taskSummaries = await Promise.all(
      tasks.map(async (t) => {
        const counts = await taskCounts(t._id);
        return {
          id: String(t._id),
          project_id: t.project_id ? String(t.project_id._id) : '',
          project_name: t.project_id ? t.project_id.name : '',
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          assigned_to: t.assigned_to ? String(t.assigned_to._id) : null,
          assignee_name: t.assigned_to ? t.assigned_to.name : null,
          assignee_email: t.assigned_to ? t.assigned_to.email : null,
          created_at: t.created_at,
          updated_at: t.updated_at,
          ...counts,
        };
      })
    );

    res.json({
      data: taskSummaries,
      meta: paginationMeta(page, limit, total),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.body.projectId) {
      throw new HttpError(400, 'Please select or specify a project for this task');
    }
    const projectId = validate.id(req.body.projectId, 'Project');
    const { project } = await requireProjectManager(projectId, req.user);

    const title = validate.text(req.body.title, 'Task title', { min: 2, max: 160 });
    const description =
      validate.text(req.body.description, 'Description', {
        max: 5000,
        optional: true,
      }) || '';
    const status = validate.oneOf(req.body.status, 'Status', STATUSES, {
      optional: true,
    }) || 'TODO';
    const priority = validate.oneOf(req.body.priority, 'Priority', PRIORITIES, {
      optional: true,
    }) || 'MEDIUM';
    const dueDate = validate.date(req.body.dueDate, 'Due date');
    const assignedTo = validate.optionalId(req.body.assignedTo, 'Assignee');

    await checkAssignee(project, assignedTo);

    const task = await Task.create({
      project_id: projectId,
      title,
      description,
      status,
      priority,
      due_date: dueDate,
      assigned_to: assignedTo,
      created_by: req.user.id,
    });

    recordAudit({
      actorId: req.user.id,
      action: 'task.created',
      entityType: 'task',
      entityId: String(task._id),
      details: { title, project: project.name },
    });

    const populated = await Task.findById(task._id)
      .populate('project_id', 'name manager_id')
      .populate('assigned_to', 'name email role')
      .populate('created_by', 'name email');

    res.status(201).json({
      data: await serializeTask({
        ...populated.toJSON(),
        project_name: populated.project_id?.name || '',
        assignee_name: populated.assigned_to?.name || null,
        assignee_email: populated.assigned_to?.email || null,
      }),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const taskId = validate.id(req.params.id, 'Task id');
    const { task } = await requireTask(taskId, req.user);
    res.json({ data: await serializeTask(task) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const taskId = validate.id(req.params.id, 'Task id');
    const { task, canManage, isAssignee } = await requireTask(taskId, req.user);

    if (!canManage && !isAssignee) {
      throw new HttpError(403, 'You can only update tasks assigned to you');
    }

    const managerOnlyFields = ['title', 'description', 'priority', 'dueDate', 'assignedTo'];
    if (
      !canManage &&
      managerOnlyFields.some((field) => req.body[field] !== undefined)
    ) {
      throw new HttpError(403, 'Team members can only update the status of their own tasks');
    }

    const project = await getProject(task.project_id);
    const status =
      req.body.status !== undefined
        ? validate.oneOf(req.body.status, 'Status', STATUSES)
        : task.status;

    let title = task.title;
    let description = task.description;
    let priority = task.priority;
    let dueDate = task.due_date;
    let assignedTo = task.assigned_to;

    if (canManage) {
      title =
        req.body.title !== undefined
          ? validate.text(req.body.title, 'Task title', { min: 2, max: 160 })
          : title;
      description =
        req.body.description !== undefined
          ? validate.text(req.body.description, 'Description', {
              max: 5000,
              optional: true,
            }) || ''
          : description;
      priority =
        req.body.priority !== undefined
          ? validate.oneOf(req.body.priority, 'Priority', PRIORITIES)
          : priority;
      dueDate =
        req.body.dueDate !== undefined
          ? validate.date(req.body.dueDate, 'Due date')
          : dueDate;
      assignedTo =
        req.body.assignedTo !== undefined
          ? validate.optionalId(req.body.assignedTo, 'Assignee')
          : assignedTo;

      await checkAssignee(project, assignedTo);
    }

    const dbTask = await Task.findById(taskId);
    dbTask.title = title;
    dbTask.description = description;
    dbTask.status = status;
    dbTask.priority = priority;
    dbTask.due_date = dueDate;
    dbTask.assigned_to = assignedTo;
    await dbTask.save();

    recordAudit({
      actorId: req.user.id,
      action: 'task.updated',
      entityType: 'task',
      entityId: String(task.id),
      details: {
        title,
        status,
        fields: Object.keys(req.body),
      },
    });

    const updated = await Task.findById(taskId)
      .populate('project_id', 'name manager_id')
      .populate('assigned_to', 'name email role')
      .populate('created_by', 'name email');

    res.json({
      data: await serializeTask({
        ...updated.toJSON(),
        project_name: updated.project_id?.name || '',
        assignee_name: updated.assigned_to?.name || null,
        assignee_email: updated.assigned_to?.email || null,
      }),
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const taskId = validate.id(req.params.id, 'Task id');
    const { task } = await requireTask(taskId, req.user);

    if (req.user.role !== 'ADMIN' && String(task.project_manager_id) !== String(req.user.id)) {
      throw new HttpError(403, 'Only the project manager or an admin can delete a task');
    }

    const files = await Attachment.find({ task_id: taskId });
    files.forEach((file) => removeUpload(file.stored_name));

    await Attachment.deleteMany({ task_id: taskId });
    await Comment.deleteMany({ task_id: taskId });
    await Task.findByIdAndDelete(taskId);

    recordAudit({
      actorId: req.user.id,
      action: 'task.deleted',
      entityType: 'task',
      entityId: String(task.id),
      details: { title: task.title, project: task.project_name },
    });

    res.status(204).end();
  })
);

// Comments
router.get(
  '/:taskId/comments',
  loadTaskView,
  asyncHandler(async (req, res) => {
    const comments = await Comment.find({ task_id: req.taskAccess.task.id })
      .populate('user_id', 'name email role')
      .sort({ created_at: 1 });

    const data = comments.map((c) => ({
      id: String(c._id),
      task_id: String(c.task_id),
      user_id: c.user_id ? String(c.user_id._id) : '',
      user_name: c.user_id ? c.user_id.name : '',
      user_role: c.user_id ? c.user_id.role : '',
      body: c.body,
      created_at: c.created_at,
    }));

    res.json({ data });
  })
);

router.post(
  '/:taskId/comments',
  loadTaskView,
  asyncHandler(async (req, res) => {
    const body = validate.text(req.body.body, 'Comment', { min: 1, max: 2000 });

    const comment = await Comment.create({
      task_id: req.taskAccess.task.id,
      user_id: req.user.id,
      body,
    });

    recordAudit({
      actorId: req.user.id,
      action: 'comment.created',
      entityType: 'task',
      entityId: String(req.taskAccess.task.id),
      details: { title: req.taskAccess.task.title },
    });

    const populated = await Comment.findById(comment._id).populate('user_id', 'name email role');

    res.status(201).json({
      data: {
        id: String(populated._id),
        task_id: String(populated.task_id),
        user_id: populated.user_id ? String(populated.user_id._id) : '',
        user_name: populated.user_id ? populated.user_id.name : '',
        user_role: populated.user_id ? populated.user_id.role : '',
        body: populated.body,
        created_at: populated.created_at,
      },
    });
  })
);

router.delete(
  '/:taskId/comments/:commentId',
  loadTaskView,
  asyncHandler(async (req, res) => {
    const commentId = validate.id(req.params.commentId, 'Comment id');
    const comment = await Comment.findOne({
      _id: commentId,
      task_id: req.taskAccess.task.id,
    });

    if (!comment) throw new HttpError(404, 'Comment not found');

    if (String(comment.user_id) !== String(req.user.id) && !req.taskAccess.canManage) {
      throw new HttpError(403, 'You can only delete your own comments');
    }

    await Comment.findByIdAndDelete(commentId);

    recordAudit({
      actorId: req.user.id,
      action: 'comment.deleted',
      entityType: 'task',
      entityId: String(req.taskAccess.task.id),
      details: { commentId: String(commentId) },
    });

    res.status(204).end();
  })
);

// Attachments
router.get(
  '/:taskId/attachments',
  loadTaskView,
  asyncHandler(async (req, res) => {
    const attachments = await Attachment.find({ task_id: req.taskAccess.task.id })
      .populate('uploaded_by', 'name')
      .sort({ created_at: -1 });

    const data = attachments.map((a) => ({
      id: String(a._id),
      task_id: String(a.task_id),
      uploaded_by: a.uploaded_by ? String(a.uploaded_by._id) : null,
      uploaded_by_name: a.uploaded_by ? a.uploaded_by.name : null,
      original_name: a.original_name,
      stored_name: a.stored_name,
      mime_type: a.mime_type,
      size: a.size,
      created_at: a.created_at,
      download_url: `/api/tasks/${req.taskAccess.task.id}/attachments/${a._id}/download`,
    }));

    res.json({ data });
  })
);

router.post(
  '/:taskId/attachments',
  loadTaskView,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a file to upload');

    const originalName = path.basename(req.file.originalname).slice(0, 200);

    try {
      const attachment = await Attachment.create({
        task_id: req.taskAccess.task.id,
        uploaded_by: req.user.id,
        original_name: originalName,
        stored_name: req.file.filename,
        mime_type: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
      });

      recordAudit({
        actorId: req.user.id,
        action: 'attachment.uploaded',
        entityType: 'task',
        entityId: String(req.taskAccess.task.id),
        details: { fileName: originalName },
      });

      const populated = await Attachment.findById(attachment._id).populate(
        'uploaded_by',
        'name'
      );

      res.status(201).json({
        data: {
          id: String(populated._id),
          task_id: String(populated.task_id),
          uploaded_by: populated.uploaded_by ? String(populated.uploaded_by._id) : null,
          uploaded_by_name: populated.uploaded_by ? populated.uploaded_by.name : null,
          original_name: populated.original_name,
          stored_name: populated.stored_name,
          mime_type: populated.mime_type,
          size: populated.size,
          created_at: populated.created_at,
          download_url: `/api/tasks/${req.taskAccess.task.id}/attachments/${populated._id}/download`,
        },
      });
    } catch (error) {
      removeUpload(req.file.filename);
      throw error;
    }
  })
);

router.get(
  '/:taskId/attachments/:attachmentId/download',
  loadTaskView,
  asyncHandler(async (req, res, next) => {
    const attachmentId = validate.id(req.params.attachmentId, 'Attachment id');
    const attachment = await Attachment.findOne({
      _id: attachmentId,
      task_id: req.taskAccess.task.id,
    });

    if (!attachment) throw new HttpError(404, 'Attachment not found');

    const filePath = path.join(config.uploadsDir, path.basename(attachment.stored_name));
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, 'That file is no longer available');
    }

    res.download(filePath, attachment.original_name, (error) => {
      if (error && !res.headersSent) next(error);
    });
  })
);

router.delete(
  '/:taskId/attachments/:attachmentId',
  loadTaskView,
  asyncHandler(async (req, res) => {
    const attachmentId = validate.id(req.params.attachmentId, 'Attachment id');
    const attachment = await Attachment.findOne({
      _id: attachmentId,
      task_id: req.taskAccess.task.id,
    });

    if (!attachment) throw new HttpError(404, 'Attachment not found');

    const isUploader = String(attachment.uploaded_by) === String(req.user.id);
    if (!isUploader && !req.taskAccess.canManage) {
      throw new HttpError(403, 'You can only remove files you uploaded');
    }

    await Attachment.findByIdAndDelete(attachmentId);
    removeUpload(attachment.stored_name);

    recordAudit({
      actorId: req.user.id,
      action: 'attachment.deleted',
      entityType: 'task',
      entityId: String(req.taskAccess.task.id),
      details: { fileName: attachment.original_name },
    });

    res.status(204).end();
  })
);

module.exports = router;
