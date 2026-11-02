import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  Columns3,
  List,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { Badge, PriorityBadge, RoleBadge, StatusBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { ProgressBar } from '../components/ProgressBar';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { TaskDrawer } from '../components/TaskDrawer';
import { TaskFormModal } from '../components/TaskFormModal';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  dueInfo,
  formatDate,
  formatShortDate,
  pluralize,
  roleLabel,
} from '../utils/format';

function projectStatus(project) {
  if (project.task_count > 0 && project.completed_tasks === project.task_count) {
    return { label: 'Completed', tone: 'success' };
  }
  if (project.deadline && new Date(`${project.deadline}T23:59:59`) < new Date()) {
    return { label: 'Past deadline', tone: 'danger' };
  }
  return { label: 'Active', tone: 'info' };
}

function TaskRow({ task, onOpen }) {
  const due = dueInfo(task.due_date, task.status);
  return (
    <div
      className="task-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(task.id);
        }
      }}
    >
      <div className="task-row__title">
        <strong>{task.title}</strong>
        <span>{task.project_name}</span>
      </div>
      <div className="task-row__status">
        <StatusBadge status={task.status} />
      </div>
      <div className="task-row__priority">
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="task-row__assignee">
        {task.assignee_name ? (
          <>
            <Avatar name={task.assignee_name} size={26} />
            <span>{task.assignee_name}</span>
          </>
        ) : (
          <span className="muted-text">Unassigned</span>
        )}
      </div>
      <div className={`task-row__due due due--${due.tone}`}>{due.label}</div>
      <div className="task-row__counts">
        <span title={`${task.comments_count} comments`}>
          <MessageSquare size={14} /> {task.comments_count}
        </span>
        <span title={`${task.attachments_count} attachments`}>
          <Paperclip size={14} /> {task.attachments_count}
        </span>
      </div>
    </div>
  );
}

function TaskCard({ task, onOpen }) {
  const due = dueInfo(task.due_date, task.status);
  return (
    <button type="button" className="task-card" onClick={() => onOpen(task.id)}>
      <div className="task-card__top">
        <PriorityBadge priority={task.priority} />
        <span className={`task-card__due due due--${due.tone}`}>{due.label}</span>
      </div>
      <strong>{task.title}</strong>
      {task.description && <p>{task.description}</p>}
      <div className="task-card__footer">
        {task.assignee_name ? (
          <Avatar name={task.assignee_name} size={26} />
        ) : (
          <span className="avatar avatar--empty">?</span>
        )}
        <span className="task-card__counts">
          <span>
            <MessageSquare size={13} /> {task.comments_count}
          </span>
          <span>
            <Paperclip size={13} /> {task.attachments_count}
          </span>
        </span>
      </div>
    </button>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskRefresh, setTaskRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [projectDeleteOpen, setProjectDeleteOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [addingMemberId, setAddingMemberId] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);

  const loadProject = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const response = await api.get(`/projects/${id}`);
        setProject(response.data);
        setError('');
      } catch (requestError) {
        setError(requestError.message);
        if (!quiet) toast(requestError.message, 'error');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [id, toast]
  );

  useEffect(() => {
    setProject(null);
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter, priorityFilter, assigneeFilter, view]);

  useEffect(() => {
    let active = true;
    const effectivePage = view === 'board' ? 1 : page;
    const params = new URLSearchParams({
      projectId: id,
      page: String(effectivePage),
      limit: view === 'board' ? '50' : '8',
      sort: 'due_date',
    });
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (assigneeFilter) params.set('assigneeId', assigneeFilter);

    setTasksLoading(true);
    api
      .get(`/tasks?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setTasks(response.data);
        setMeta(response.meta);
      })
      .catch((requestError) => {
        if (!active) return;
        toast(requestError.message, 'error');
      })
      .finally(() => {
        if (active) setTasksLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    id,
    debouncedQuery,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    view,
    page,
    taskRefresh,
    toast,
  ]);

  useEffect(() => {
    if (!memberModalOpen) return;
    setUsersLoading(true);
    setUserSearch('');
    api
      .get('/users')
      .then(({ data }) => setUsers(data))
      .catch((requestError) => toast(requestError.message, 'error'))
      .finally(() => setUsersLoading(false));
  }, [memberModalOpen, toast]);

  const canManage = project && (user.role === 'ADMIN' || project.manager_id === user.id);

  const openTask = (taskId) => setSelectedTaskId(taskId);

  const handleEditTask = (task) => {
    setSelectedTaskId(null);
    setEditingTask(task);
    setTaskFormOpen(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setTaskFormOpen(true);
  };

  const handleTaskSaved = (savedTask) => {
    setTaskRefresh((value) => value + 1);
    loadProject(true);
    setSelectedTaskId(savedTask.id);
  };

  const confirmTaskDelete = async () => {
    if (!taskToDelete) return;
    setDeletingTask(true);
    try {
      await api.delete(`/tasks/${taskToDelete.id}`);
      toast('Task deleted.');
      setTaskToDelete(null);
      setTaskRefresh((value) => value + 1);
      loadProject(true);
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setDeletingTask(false);
    }
  };

  const confirmProjectDelete = async () => {
    setDeletingProject(true);
    try {
      await api.delete(`/projects/${id}`);
      toast('Project deleted.');
      navigate('/projects');
    } catch (requestError) {
      toast(requestError.message, 'error');
      setDeletingProject(false);
    }
  };

  const handleAddMember = async (member) => {
    setAddingMemberId(member.id);
    try {
      await api.post(`/projects/${id}/members`, { userId: member.id });
      toast(`${member.name} joined the project.`);
      await loadProject(true);
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setAddingMemberId(null);
    }
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try {
      await api.delete(`/projects/${id}/members/${memberToRemove.id}`);
      toast(`${memberToRemove.name} was removed from the project.`);
      setMemberToRemove(null);
      await loadProject(true);
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setRemovingMember(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
  };

  if (loading && !project) {
    return (
      <div className="project-detail-skeleton">
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--title-large" />
        <span className="skeleton skeleton--panel" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="panel error-panel project-error">
        <UsersRound size={23} />
        <div>
          <h2>This project is out of reach</h2>
          <p>{error}</p>
        </div>
        <Link to="/projects" className="button button--secondary">
          Back to projects
        </Link>
      </div>
    );
  }

  if (!project) return null;

  const state = projectStatus(project);
  const availableUsers = users.filter(
    (candidate) =>
      !project.members.some((member) => member.id === candidate.id) &&
      (!userSearch ||
        candidate.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        candidate.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="page project-detail-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/projects">
          <ChevronLeft size={15} /> Projects
        </Link>
        <span>/</span>
        <span>{project.name}</span>
      </nav>

      <section className="project-hero">
        <div className="project-hero__main">
          <div className="project-hero__badges">
            <Badge tone={state.tone} dot>{state.label}</Badge>
            <span className="project-hero__manager">
              Managed by {project.manager_name}
            </span>
          </div>
          <h1>{project.name}</h1>
          <p className="project-hero__description">
            {project.description || 'No description has been added yet.'}
          </p>
          <div className="project-hero__meta">
            <span>
              <CalendarDays size={15} />
              Deadline {project.deadline ? formatDate(project.deadline) : 'not set'}
            </span>
            <span>
              <UsersRound size={15} />
              {pluralize(project.members.length, 'team member')}
            </span>
            <span>
              <Columns3 size={15} />
              {pluralize(project.task_count, 'task')}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="project-hero__actions">
            <button type="button" className="button button--secondary" onClick={() => setProjectFormOpen(true)}>
              <Pencil size={16} /> Edit project
            </button>
            <button
              type="button"
              className="icon-button icon-button--border icon-button--danger"
              onClick={() => setProjectDeleteOpen(true)}
              title="Delete project"
              aria-label="Delete project"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </section>

      <div className="project-layout">
        <section className="project-tasks">
          <div className="project-tasks__heading">
            <div>
              <h2>Tasks</h2>
              <p>{project.completed_tasks} completed · {project.task_count - project.completed_tasks} open</p>
            </div>
            <div className="project-tasks__view">
              <div className="icon-toggle" role="group" aria-label="Task view">
                <button
                  type="button"
                  className={view === 'list' ? 'icon-toggle__button icon-toggle__button--active' : 'icon-toggle__button'}
                  onClick={() => setView('list')}
                  aria-label="List view"
                >
                  <List size={17} />
                </button>
                <button
                  type="button"
                  className={view === 'board' ? 'icon-toggle__button icon-toggle__button--active' : 'icon-toggle__button'}
                  onClick={() => setView('board')}
                  aria-label="Board view"
                >
                  <Columns3 size={17} />
                </button>
              </div>
              {canManage && (
                <button type="button" className="button button--primary button--small" onClick={handleNewTask}>
                  <Plus size={15} /> New task
                </button>
              )}
            </div>
          </div>

          <div className="task-toolbar">
            <div className="toolbar__search toolbar__search--small">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search tasks"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search tasks"
              />
            </div>
            <select
              className="select select--compact"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              className="select select--compact"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select
              className="select select--compact"
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              aria-label="Filter by assignee"
            >
              <option value="">Everyone</option>
              {project.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {(query || statusFilter || priorityFilter || assigneeFilter) && (
              <button type="button" className="text-button" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          {tasksLoading && tasks.length === 0 ? (
            <div className="task-list-loading">
              {[0, 1, 2, 3].map((item) => (
                <span className="skeleton skeleton--row" key={item} />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<List size={24} />}
              title={query || statusFilter || priorityFilter || assigneeFilter ? 'No tasks match' : 'No tasks on this project yet'}
              description={
                query || statusFilter || priorityFilter || assigneeFilter
                  ? 'Try loosening the filters or searching for something else.'
                  : canManage
                    ? 'Create the first task so the team has something concrete to pick up.'
                    : 'Your project manager will add tasks here.'
              }
              action={
                query || statusFilter || priorityFilter || assigneeFilter ? (
                  <button type="button" className="button button--secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : canManage ? (
                  <button type="button" className="button button--primary" onClick={handleNewTask}>
                    <Plus size={16} /> Add a task
                  </button>
                ) : null
              }
            />
          ) : view === 'list' ? (
            <>
              <div className={`task-table ${tasksLoading ? 'is-refreshing' : ''}`}>
                <div className="task-table__head">
                  <span>Task</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Assignee</span>
                  <span>Due</span>
                  <span />
                </div>
                {tasks.map((task) => (
                  <TaskRow task={task} onOpen={openTask} key={task.id} />
                ))}
              </div>
              <Pagination meta={meta} onPageChange={setPage} />
            </>
          ) : (
            <div className={`task-board ${tasksLoading ? 'is-refreshing' : ''}`}>
              {[
                ['TODO', 'To do'],
                ['IN_PROGRESS', 'In progress'],
                ['COMPLETED', 'Completed'],
              ].map(([status, label]) => {
                const columnTasks = tasks.filter((task) => task.status === status);
                return (
                  <div className={`board-column board-column--${status.toLowerCase()}`} key={status}>
                    <div className="board-column__heading">
                      <span className={`board-dot board-dot--${status.toLowerCase()}`} />
                      <strong>{label}</strong>
                      <span>{columnTasks.length}</span>
                    </div>
                    <div className="board-column__cards">
                      {columnTasks.map((task) => (
                        <TaskCard task={task} onOpen={openTask} key={task.id} />
                      ))}
                      {columnTasks.length === 0 && (
                        <div className="board-column__empty">Nothing here</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="project-sidebar">
          <section className="side-card">
            <div className="side-card__heading">
              <h2>Project pulse</h2>
              <span className="pill">{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} label={`${project.progress}% complete`} />
            <div className="pulse-stats">
              <div>
                <strong>{project.completed_tasks}</strong>
                <span>Completed</span>
              </div>
              <div>
                <strong>{project.in_progress_tasks || 0}</strong>
                <span>In progress</span>
              </div>
              <div>
                <strong>{project.todo_tasks || 0}</strong>
                <span>To do</span>
              </div>
            </div>
            <div className="side-meta-list">
              <div>
                <span>Deadline</span>
                <strong>{project.deadline ? formatShortDate(project.deadline) : 'Not set'}</strong>
              </div>
              <div>
                <span>Overdue tasks</span>
                <strong className={project.overdue_tasks ? 'text-danger' : ''}>
                  {project.overdue_tasks || 0}
                </strong>
              </div>
              <div>
                <span>Project manager</span>
                <span className="side-person">
                  <Avatar name={project.manager_name} size={24} />
                  {project.manager_name}
                </span>
              </div>
            </div>
          </section>

          <section className="side-card team-panel">
            <div className="side-card__heading">
              <h2>Team</h2>
              {canManage && (
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => setMemberModalOpen(true)}
                  title="Add team member"
                  aria-label="Add team member"
                >
                  <UserPlus size={17} />
                </button>
              )}
            </div>

            <ul className="team-list">
              {project.members.map((member) => (
                <li key={member.id}>
                  <Avatar name={member.name} size={30} />
                  <div>
                    <strong>
                      {member.name}
                      {member.id === project.manager_id && <span className="team-owner">Lead</span>}
                    </strong>
                    <span>{roleLabel(member.role)}</span>
                  </div>
                  {canManage && member.id !== project.manager_id && (
                    <button
                      type="button"
                      className="icon-button icon-button--small team-remove"
                      onClick={() => setMemberToRemove(member)}
                      title={`Remove ${member.name}`}
                      aria-label={`Remove ${member.name}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
              <button
                type="button"
                className="button button--ghost button--small team-add-button"
                onClick={() => setMemberModalOpen(true)}
              >
                <UserPlus size={15} /> Add someone
              </button>
            )}
          </section>
        </aside>
      </div>

      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onChanged={() => {
            setTaskRefresh((value) => value + 1);
            loadProject(true);
          }}
          onEdit={handleEditTask}
          onDeleteRequest={(task) => {
            setSelectedTaskId(null);
            setTaskToDelete(task);
          }}
        />
      )}

      <TaskFormModal
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSaved={handleTaskSaved}
        task={editingTask}
        projectId={Number(id)}
        project={project}
      />

      <ProjectFormModal
        open={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        onSaved={(updated) => setProject(updated)}
        project={project}
      />

      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmTaskDelete}
        busy={deletingTask}
        title="Delete this task?"
        message={`“${taskToDelete?.title || 'This task'}” and its comments and files will be permanently removed.`}
        confirmLabel="Delete task"
      />

      <ConfirmDialog
        open={projectDeleteOpen}
        onClose={() => setProjectDeleteOpen(false)}
        onConfirm={confirmProjectDelete}
        busy={deletingProject}
        title="Delete this project?"
        message="Every task, comment, and file in this project will be removed. This cannot be undone."
        confirmLabel="Delete project"
      />

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={confirmRemoveMember}
        busy={removingMember}
        title="Remove from team?"
        message={`${memberToRemove?.name || 'This person'} will lose access to this project. Reassign their open tasks first.`}
        confirmLabel="Remove member"
      />

      <Modal
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        title="Add to the team"
        subtitle="Everyone on the project can view tasks, comment, and attach files."
        size="sm"
      >
        <div className="toolbar__search toolbar__search--small member-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search by name or email"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            autoFocus
          />
        </div>
        {usersLoading ? (
          <p className="muted-text">Loading people…</p>
        ) : availableUsers.length === 0 ? (
          <p className="muted-text">No more people to add right now.</p>
        ) : (
          <ul className="member-picker">
            {availableUsers.map((candidate) => (
              <li key={candidate.id}>
                <Avatar name={candidate.name} size={32} />
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.email}</span>
                </div>
                <RoleBadge role={candidate.role} />
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => handleAddMember(candidate)}
                  disabled={addingMemberId === candidate.id}
                >
                  {addingMemberId === candidate.id ? 'Adding…' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
