const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError, pagination, paginationMeta } = require('../utils/http');
const {
  getProject,
  getTask,
  isProjectMember,
  requireProjectManager,
  requireTask,
} = require('../utils/access');
const { recordAudit } = require('../utils/audit');
const { upload, removeUpload } = require('../utils/upload');
const validate = require('../utils/validate');

const router = express.Router();
const STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

router.use(authenticate);

function taskCounts(db, taskId) {
  return db
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM comments WHERE task_id = @taskId) AS comments_count,
        (SELECT COUNT(*) FROM attachments WHERE task_id = @taskId) AS attachments_count
    `)
    .get({ taskId });
}

function serializeTask(db, task) {
  if (!task) return null;
  return { ...task, ...taskCounts(db, task.id) };
}

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

function checkAssignee(db, project, assigneeId) {
  if (assigneeId === null) return null;

  const user = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(assigneeId);

  if (!user) throw new HttpError(400, 'The selected assignee does not exist');
  if (user.id !== project.manager_id && !isProjectMember(db, project.id, user.id)) {
    throw new HttpError(400, 'The assignee needs to be on the project team first');
  }
  return user;
}

function loadTaskView(req, _res, next) {
  try {
    req.taskAccess = requireTask(getDatabase(), Number(req.params.taskId), req.user);
    next();
  } catch (error) {
    next(error);
  }
}

router.get('/', (req, res) => {
  const db = getDatabase();
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

  const conditions = [accessibleClause(req.user)];
  const params = { userId: req.user.id, limit, offset };

  if (q) {
    conditions.push('(t.title LIKE @search OR t.description LIKE @search)');
    params.search = `%${q}%`;
  }
  if (status) {
    conditions.push('t.status = @status');
    params.status = status;
  }
  if (priority) {
    conditions.push('t.priority = @priority');
    params.priority = priority;
  }
  if (projectId) {
    const id = validate.id(projectId, 'Project id');
    conditions.push('t.project_id = @projectId');
    params.projectId = id;
  }
  if (assigneeId) {
    const id = assigneeId === 'me' ? req.user.id : validate.id(assigneeId, 'Assignee');
    conditions.push('t.assigned_to = @assigneeId');
    params.assigneeId = id;
  }
  if (validate.boolean(req.query.overdue)) {
    conditions.push("t.status != 'COMPLETED' AND t.due_date IS NOT NULL AND t.due_date < date('now')");
  }

  const orderBy =
    sort === 'created'
      ? 't.created_at DESC'
      : sort === 'priority'
        ? `CASE t.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END, t.due_date ASC`
        : 'CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.created_at DESC';

  const where = `WHERE ${conditions.join(' AND ')}`;

  const tasks = db
    .prepare(`
      SELECT
        t.*,
        p.name AS project_name,
        p.manager_id AS project_manager_id,
        a.name AS assignee_name,
        a.email AS assignee_email,
        c.name AS creator_name,
        (SELECT COUNT(*) FROM comments cm WHERE cm.task_id = t.id) AS comments_count,
        (SELECT COUNT(*) FROM attachments at WHERE at.task_id = t.id) AS attachments_count
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users a ON a.id = t.assigned_to
      LEFT JOIN users c ON c.id = t.created_by
      ${where}
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `)
    .all(params);

  const total = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      ${where}
    `)
    .get(params).count;

  res.json({
    data: tasks,
    meta: paginationMeta(page, limit, total),
  });
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const projectId = validate.id(req.body.projectId, 'Project');
    const { project } = requireProjectManager(db, projectId, req.user);

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

    checkAssignee(db, project, assignedTo);

    const result = db
      .prepare(`
        INSERT INTO tasks
          (project_id, title, description, status, priority, due_date, assigned_to, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(project.id, title, description, status, priority, dueDate, assignedTo, req.user.id);

    recordAudit(db, {
      actorId: req.user.id,
      action: 'task.created',
      entityType: 'task',
      entityId: result.lastInsertRowid,
      details: { title, project: project.name },
    });

    res.status(201).json({
      data: serializeTask(db, getTask(db, result.lastInsertRowid)),
    });
  })
);

router.get('/:id', (req, res) => {
  const db = getDatabase();
  const taskId = validate.id(req.params.id, 'Task id');
  const { task } = requireTask(db, taskId, req.user);
  res.json({ data: serializeTask(db, task) });
});

router.patch('/:id', (req, res) => {
  const db = getDatabase();
  const taskId = validate.id(req.params.id, 'Task id');
  const { task, canManage, isAssignee } = requireTask(db, taskId, req.user);

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

  const project = getProject(db, task.project_id);
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

    checkAssignee(db, project, assignedTo);
  }

  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?, due_date = ?,
        assigned_to = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(title, description, status, priority, dueDate, assignedTo, task.id);

  recordAudit(db, {
    actorId: req.user.id,
    action: 'task.updated',
    entityType: 'task',
    entityId: task.id,
    details: {
      title,
      status,
      fields: Object.keys(req.body),
    },
  });

  res.json({ data: serializeTask(db, getTask(db, task.id)) });
});

router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const taskId = validate.id(req.params.id, 'Task id');
  const { task } = requireTask(db, taskId, req.user);

  if (req.user.role !== 'ADMIN' && task.project_manager_id !== req.user.id) {
    throw new HttpError(403, 'Only the project manager or an admin can delete a task');
  }

  const files = db
    .prepare('SELECT stored_name FROM attachments WHERE task_id = ?')
    .all(task.id);

  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  files.forEach((file) => removeUpload(file.stored_name));

  recordAudit(db, {
    actorId: req.user.id,
    action: 'task.deleted',
    entityType: 'task',
    entityId: task.id,
    details: { title: task.title, project: task.project_name },
  });

  res.status(204).end();
});

router.get('/:taskId/comments', loadTaskView, (req, res) => {
  const db = getDatabase();
  const comments = db
    .prepare(`
      SELECT c.*, u.name AS user_name, u.role AS user_role
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `)
    .all(req.taskAccess.task.id);

  res.json({ data: comments });
});

router.post('/:taskId/comments', loadTaskView, (req, res) => {
  const db = getDatabase();
  const body = validate.text(req.body.body, 'Comment', { min: 1, max: 2000 });

  const result = db
    .prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)')
    .run(req.taskAccess.task.id, req.user.id, body);

  recordAudit(db, {
    actorId: req.user.id,
    action: 'comment.created',
    entityType: 'task',
    entityId: req.taskAccess.task.id,
    details: { title: req.taskAccess.task.title },
  });

  const comment = db
    .prepare(`
      SELECT c.*, u.name AS user_name, u.role AS user_role
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `)
    .get(result.lastInsertRowid);

  res.status(201).json({ data: comment });
});

router.delete('/:taskId/comments/:commentId', loadTaskView, (req, res) => {
  const db = getDatabase();
  const commentId = validate.id(req.params.commentId, 'Comment id');

  const comment = db
    .prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?')
    .get(commentId, req.taskAccess.task.id);

  if (!comment) throw new HttpError(404, 'Comment not found');

  if (comment.user_id !== req.user.id && !req.taskAccess.canManage) {
    throw new HttpError(403, 'You can only delete your own comments');
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);

  recordAudit(db, {
    actorId: req.user.id,
    action: 'comment.deleted',
    entityType: 'task',
    entityId: req.taskAccess.task.id,
    details: { commentId: comment.id },
  });

  res.status(204).end();
});

router.get('/:taskId/attachments', loadTaskView, (req, res) => {
  const db = getDatabase();
  const attachments = db
    .prepare(`
      SELECT a.*, u.name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `)
    .all(req.taskAccess.task.id)
    .map((attachment) => ({
      ...attachment,
      download_url: `/api/tasks/${req.taskAccess.task.id}/attachments/${attachment.id}/download`,
    }));

  res.json({ data: attachments });
});

router.post(
  '/:taskId/attachments',
  loadTaskView,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a file to upload');

    const db = getDatabase();
    const originalName = path.basename(req.file.originalname).slice(0, 200);

    try {
      const result = db
        .prepare(`
          INSERT INTO attachments
            (task_id, uploaded_by, original_name, stored_name, mime_type, size)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          req.taskAccess.task.id,
          req.user.id,
          originalName,
          req.file.filename,
          req.file.mimetype || 'application/octet-stream',
          req.file.size
        );

      recordAudit(db, {
        actorId: req.user.id,
        action: 'attachment.uploaded',
        entityType: 'task',
        entityId: req.taskAccess.task.id,
        details: { fileName: originalName },
      });

      const attachment = db
        .prepare(`
          SELECT a.*, u.name AS uploaded_by_name
          FROM attachments a
          LEFT JOIN users u ON u.id = a.uploaded_by
          WHERE a.id = ?
        `)
        .get(result.lastInsertRowid);

      res.status(201).json({
        data: {
          ...attachment,
          download_url: `/api/tasks/${req.taskAccess.task.id}/attachments/${attachment.id}/download`,
        },
      });
    } catch (error) {
      removeUpload(req.file.filename);
      throw error;
    }
  })
);

router.get('/:taskId/attachments/:attachmentId/download', loadTaskView, (req, res, next) => {
  const db = getDatabase();
  const attachmentId = validate.id(req.params.attachmentId, 'Attachment id');
  const attachment = db
    .prepare('SELECT * FROM attachments WHERE id = ? AND task_id = ?')
    .get(attachmentId, req.taskAccess.task.id);

  if (!attachment) throw new HttpError(404, 'Attachment not found');

  const filePath = path.join(require('../config').uploadsDir, path.basename(attachment.stored_name));
  if (!fs.existsSync(filePath)) {
    throw new HttpError(404, 'That file is no longer available');
  }

  res.download(filePath, attachment.original_name, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

router.delete('/:taskId/attachments/:attachmentId', loadTaskView, (req, res) => {
  const db = getDatabase();
  const attachmentId = validate.id(req.params.attachmentId, 'Attachment id');
  const attachment = db
    .prepare('SELECT * FROM attachments WHERE id = ? AND task_id = ?')
    .get(attachmentId, req.taskAccess.task.id);

  if (!attachment) throw new HttpError(404, 'Attachment not found');

  const isUploader = attachment.uploaded_by === req.user.id;
  if (!isUploader && !req.taskAccess.canManage) {
    throw new HttpError(403, 'You can only remove files you uploaded');
  }

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachment.id);
  removeUpload(attachment.stored_name);

  recordAudit(db, {
    actorId: req.user.id,
    action: 'attachment.deleted',
    entityType: 'task',
    entityId: req.taskAccess.task.id,
    details: { fileName: attachment.original_name },
  });

  res.status(204).end();
});

module.exports = router;
