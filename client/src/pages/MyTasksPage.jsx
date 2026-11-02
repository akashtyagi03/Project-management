import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { PriorityBadge, StatusBadge } from '../components/Badge';
import { TaskDrawer } from '../components/TaskDrawer';
import { TaskFormModal } from '../components/TaskFormModal';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { dueInfo, pluralize } from '../utils/format';

const QUICK_FILTERS = [
  ['all', 'All'],
  ['TODO', 'To do'],
  ['IN_PROGRESS', 'In progress'],
  ['COMPLETED', 'Completed'],
  ['overdue', 'Overdue'],
];

export default function MyTasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [quickFilter, setQuickFilter] = useState('all');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState('due_date');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, quickFilter, priority, sort]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      assigneeId: 'me',
      page: String(page),
      limit: '10',
      sort,
    });
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    if (priority) params.set('priority', priority);
    if (quickFilter === 'overdue') {
      params.set('overdue', 'true');
    } else if (quickFilter !== 'all') {
      params.set('status', quickFilter);
    }

    setLoading(true);
    setError('');
    api
      .get(`/tasks?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setTasks(response.data);
        setMeta(response.meta);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        toast(requestError.message, 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, debouncedQuery, quickFilter, priority, sort, refreshKey, toast]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const handleEdit = (task) => {
    setSelectedTaskId(null);
    setEditingTask(task);
    setTaskFormOpen(true);
  };

  const handleSaved = (savedTask) => {
    refresh();
    setSelectedTaskId(savedTask.id);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${taskToDelete.id}`);
      toast('Task deleted.');
      setTaskToDelete(null);
      refresh();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setQuickFilter('all');
    setPriority('');
  };

  const filtered = debouncedQuery || quickFilter !== 'all' || priority;

  return (
    <div className="page my-tasks-page">
      <PageHeader
        eyebrow="My tasks"
        title="What’s on your plate"
        description="Your assigned work across every project, with the noise turned down."
        actions={
          <Link to="/projects" className="button button--secondary">
            <ListChecks size={16} /> Browse projects
          </Link>
        }
      />

      <div className="filter-row">
        <div className="filter-chips" role="group" aria-label="Quick filters">
          {QUICK_FILTERS.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`filter-chip ${quickFilter === value ? 'filter-chip--active' : ''}`}
              onClick={() => setQuickFilter(value)}
            >
              {value === 'overdue' && <AlertTriangle size={14} />}
              {value === 'COMPLETED' && <CheckCircle2 size={14} />}
              {label}
            </button>
          ))}
        </div>

        <div className="filter-row__right">
          <div className="toolbar__search toolbar__search--small">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search my tasks"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search my tasks"
            />
          </div>
          <select
            className="select select--compact"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            <option value="HIGH">High priority</option>
            <option value="MEDIUM">Medium priority</option>
            <option value="LOW">Low priority</option>
          </select>
          <select
            className="select select--compact"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort tasks"
          >
            <option value="due_date">Due date</option>
            <option value="priority">Priority</option>
            <option value="created">Newest</option>
          </select>
        </div>
      </div>

      {error && tasks.length === 0 ? (
        <div className="panel error-panel">
          <AlertTriangle size={22} />
          <div>
            <h2>Your tasks didn’t load</h2>
            <p>{error}</p>
          </div>
          <button type="button" className="button button--secondary" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : loading && tasks.length === 0 ? (
        <div className="task-list-loading">
          {[0, 1, 2, 3, 4].map((item) => (
            <span className="skeleton skeleton--row" key={item} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={25} />}
          title={filtered ? 'No tasks match those filters' : 'Your plate is clear'}
          description={
            filtered
              ? 'Try a broader search or a different filter.'
              : 'When a project manager assigns you something, it will land here.'
          }
          action={
            filtered ? (
              <button type="button" className="button button--secondary" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className={`task-table task-table--personal ${loading ? 'is-refreshing' : ''}`}>
            <div className="task-table__head">
              <span>Task</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Due</span>
              <span />
            </div>
            {tasks.map((task) => {
              const due = dueInfo(task.due_date, task.status);
              return (
                <div
                  key={task.id}
                  className="task-row task-row--personal"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTaskId(task.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedTaskId(task.id);
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
                  <div className={`task-row__due due due--${due.tone}`}>
                    <CalendarDays size={14} /> {due.label}
                  </div>
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
            })}
          </div>
          <Pagination meta={meta} onPageChange={setPage} />
          <p className="list-footnote">
            {meta ? `${pluralize(meta.total, 'task')} assigned to ${user.name.split(' ')[0]}` : ''}
          </p>
        </>
      )}

      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onChanged={refresh}
          onEdit={handleEdit}
          onDeleteRequest={(task) => {
            setSelectedTaskId(null);
            setTaskToDelete(task);
          }}
        />
      )}

      <TaskFormModal
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSaved={handleSaved}
        task={editingTask}
      />

      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete this task?"
        message={`“${taskToDelete?.title || 'This task'}” and its comments and files will be permanently removed.`}
        confirmLabel="Delete task"
      />

      <div className="visually-hidden" aria-live="polite">
        {loading ? 'Loading tasks' : `${tasks.length} tasks shown`}
      </div>
    </div>
  );
}
