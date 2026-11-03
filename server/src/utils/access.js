const { Project, Task, User } = require('../models');
const { HttpError } = require('./http');

async function getProject(projectId) {
  const id = projectId?._id || projectId?.id || projectId;
  if (!id) return null;
  const project = await Project.findById(id).populate('manager_id', 'name email role');
  if (!project) return null;
  const doc = project.toJSON();
  return {
    ...doc,
    manager_name: project.manager_id ? project.manager_id.name : '',
    manager_email: project.manager_id ? project.manager_id.email : '',
  };
}

function isProjectMember(project, userId) {
  if (!project || !userId) return false;
  const members = project.members || [];
  const uId = String(userId);
  return members.some((m) => String(m._id || m) === uId);
}

function projectAccess(project, user) {
  if (!project || !user) {
    return { canView: false, canManage: false, isMember: false };
  }

  const uId = String(user.id || user._id);
  const admin = user.role === 'ADMIN';
  const managerId = String(project.manager_id?._id || project.manager_id || '');
  const isManager = managerId === uId;
  const isMember = admin || isManager || isProjectMember(project, uId);

  return {
    canView: isMember,
    canManage: admin || isManager,
    isMember,
  };
}

async function requireProject(projectId, user) {
  const id = projectId?._id || projectId?.id || projectId;
  const project = await Project.findById(id).populate('manager_id', 'name email role');
  if (!project) throw new HttpError(404, 'Project not found');

  const access = projectAccess(project, user);
  if (!access.canView) throw new HttpError(403, 'You do not have access to this project');

  const doc = project.toJSON();
  return {
    project: {
      ...doc,
      manager_name: project.manager_id ? project.manager_id.name : '',
      manager_email: project.manager_id ? project.manager_id.email : '',
    },
    ...access,
  };
}

async function requireProjectManager(projectId, user) {
  const result = await requireProject(projectId, user);
  if (!result.canManage) {
    throw new HttpError(403, 'Only the project manager or an admin can do that');
  }
  return result;
}

async function getTask(taskId) {
  const id = taskId?._id || taskId?.id || taskId;
  if (!id) return null;

  const task = await Task.findById(id)
    .populate('project_id', 'name manager_id members')
    .populate('assigned_to', 'name email role')
    .populate('created_by', 'name email');

  if (!task) return null;

  const doc = task.toJSON();
  const rawProjectId = task.project_id?._id || task.project_id?.id || task.project_id;
  const rawAssignedTo = task.assigned_to?._id || task.assigned_to?.id || task.assigned_to;

  return {
    ...doc,
    project_id: rawProjectId ? String(rawProjectId) : '',
    project_name: task.project_id ? task.project_id.name : '',
    project_manager_id: task.project_id
      ? String(task.project_id.manager_id?._id || task.project_id.manager_id || '')
      : '',
    project_members: task.project_id?.members || [],
    assigned_to: rawAssignedTo ? String(rawAssignedTo) : null,
    assignee_name: task.assigned_to ? task.assigned_to.name : null,
    assignee_email: task.assigned_to ? task.assigned_to.email : null,
    creator_name: task.created_by ? task.created_by.name : null,
  };
}

function taskAccess(task, user) {
  if (!task || !user) {
    return { canView: false, canManage: false, isAssignee: false };
  }

  const uId = String(user.id || user._id);
  const rawAssignedTo = task.assigned_to?._id || task.assigned_to?.id || task.assigned_to;
  const isAssignee = rawAssignedTo ? String(rawAssignedTo) === uId : false;
  const admin = user.role === 'ADMIN';
  const isProjectManager = String(task.project_manager_id) === uId;
  const isProjectMember = Array.isArray(task.project_members)
    ? task.project_members.some((m) => String(m._id || m) === uId)
    : false;

  return {
    canView: admin || isProjectManager || isAssignee || isProjectMember,
    canManage: admin || isProjectManager,
    isAssignee,
  };
}

async function requireTask(taskId, user) {
  const task = await getTask(taskId);
  if (!task) throw new HttpError(404, 'Task not found');

  const access = taskAccess(task, user);
  if (!access.canView) throw new HttpError(403, 'You do not have access to this task');

  return { task, ...access };
}

async function requireTaskManager(taskId, user) {
  const result = await requireTask(taskId, user);
  if (!result.canManage) {
    throw new HttpError(403, 'Only the project manager or an admin can do that');
  }
  return result;
}

module.exports = {
  getProject: (dbOrId, maybeId) => getProject(maybeId || dbOrId),
  getTask: (dbOrId, maybeId) => getTask(maybeId || dbOrId),
  projectAccess,
  taskAccess,
  requireProject: (dbOrId, maybeId, maybeUser) =>
    maybeUser ? requireProject(maybeId, maybeUser) : requireProject(dbOrId, maybeId),
  requireProjectManager: (dbOrId, maybeId, maybeUser) =>
    maybeUser ? requireProjectManager(maybeId, maybeUser) : requireProjectManager(dbOrId, maybeId),
  requireTask: (dbOrId, maybeId, maybeUser) =>
    maybeUser ? requireTask(maybeId, maybeUser) : requireTask(dbOrId, maybeId),
  requireTaskManager: (dbOrId, maybeId, maybeUser) =>
    maybeUser ? requireTaskManager(maybeId, maybeUser) : requireTaskManager(dbOrId, maybeId),
  isProjectMember: (dbOrProj, projOrUser, maybeUser) =>
    maybeUser ? isProjectMember(projOrUser, maybeUser) : isProjectMember(dbOrProj, projOrUser),
};
