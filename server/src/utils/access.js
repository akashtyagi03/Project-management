const { HttpError } = require('./http');

const PROJECT_SELECT = `
  SELECT p.*, u.name AS manager_name, u.email AS manager_email
  FROM projects p
  JOIN users u ON u.id = p.manager_id
`;

function getProject(db, projectId) {
  return db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(projectId);
}

function isProjectMember(db, projectId, userId) {
  return Boolean(
    db
      .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId)
  );
}

function projectAccess(db, project, user) {
  if (!project || !user) {
    return { canView: false, canManage: false, isMember: false };
  }

  const admin = user.role === 'ADMIN';
  const isManager = project.manager_id === user.id;
  const isMember = admin || isManager || isProjectMember(db, project.id, user.id);

  return {
    canView: isMember,
    canManage: admin || isManager,
    isMember,
  };
}

function requireProject(db, projectId, user) {
  const project = getProject(db, projectId);
  if (!project) throw new HttpError(404, 'Project not found');

  const access = projectAccess(db, project, user);
  if (!access.canView) throw new HttpError(403, 'You do not have access to this project');

  return { project, ...access };
}

function requireProjectManager(db, projectId, user) {
  const result = requireProject(db, projectId, user);
  if (!result.canManage) {
    throw new HttpError(403, 'Only the project manager or an admin can do that');
  }
  return result;
}

function getTask(db, taskId) {
  return db.prepare(`
    SELECT
      t.*,
      p.name AS project_name,
      p.manager_id AS project_manager_id,
      a.name AS assignee_name,
      a.email AS assignee_email,
      c.name AS creator_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users a ON a.id = t.assigned_to
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ?
  `).get(taskId);
}

function taskAccess(db, task, user) {
  if (!task || !user) {
    return { canView: false, canManage: false, isAssignee: false };
  }

  const project = { id: task.project_id, manager_id: task.project_manager_id };
  const access = projectAccess(db, project, user);
  const isAssignee = task.assigned_to === user.id;
  const admin = user.role === 'ADMIN';
  const isProjectManager = task.project_manager_id === user.id;

  return {
    canView: access.canView || isAssignee,
    canManage: admin || isProjectManager,
    isAssignee,
  };
}

function requireTask(db, taskId, user) {
  const task = getTask(db, taskId);
  if (!task) throw new HttpError(404, 'Task not found');

  const access = taskAccess(db, task, user);
  if (!access.canView) throw new HttpError(403, 'You do not have access to this task');

  return { task, ...access };
}

function requireTaskManager(db, taskId, user) {
  const result = requireTask(db, taskId, user);
  if (!result.canManage) {
    throw new HttpError(403, 'Only the project manager or an admin can do that');
  }
  return result;
}

module.exports = {
  getProject,
  getTask,
  projectAccess,
  taskAccess,
  requireProject,
  requireProjectManager,
  requireTask,
  requireTaskManager,
  isProjectMember,
};
