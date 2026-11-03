import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { PriorityBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ProgressBar } from '../components/ProgressBar';
import {
  dueInfo,
  formatDate,
  greeting,
  pluralize,
  roleLabel,
  todayLabel,
} from '../utils/format';

const STATUS_COLORS = {
  completed: '#2f6b57',
  in_progress: '#c58a3f',
  todo: '#d9d3c5',
};

function StatCard({ icon: Icon, label, value, hint, tone, loading }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__icon">
        <Icon size={19} />
      </span>
      <div>
        <span className="stat-card__label">{label}</span>
        {loading ? (
          <span className="skeleton skeleton--number" />
        ) : (
          <strong className="stat-card__value">{value}</strong>
        )}
        <span className="stat-card__hint">{hint}</span>
      </div>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading dashboard">
      <div className="skeleton skeleton--title" />
      <div className="stats-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="skeleton skeleton--stat" key={item} />
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="skeleton skeleton--panel" />
        <div className="skeleton skeleton--panel" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = () => {
    setLoading(true);
    setError('');
    api
      .get('/dashboard')
      .then((result) => setData(result))
      .catch((requestError) => {
        setError(requestError.message);
        toast(requestError.message, 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) return <DashboardSkeleton />;

  if (error && !data) {
    return (
      <div className="panel error-panel">
        <AlertTriangle size={22} />
        <div>
          <h2>We couldn’t load your dashboard</h2>
          <p>{error}</p>
        </div>
        <button type="button" className="button button--secondary" onClick={loadDashboard}>
          Try again
        </button>
      </div>
    );
  }

  const summary = data?.summary || {};
  const status = data?.status_breakdown || { todo: 0, in_progress: 0, completed: 0 };
  const priorities = data?.priority_breakdown || { low: 0, medium: 0, high: 0 };
  const totalTasks = summary.tasks || 0;
  const completedPct = totalTasks ? Math.round((status.completed / totalTasks) * 100) : 0;
  const progressPct = totalTasks ? Math.round((status.in_progress / totalTasks) * 100) : 0;
  const todoPct = totalTasks ? Math.max(0, 100 - completedPct - progressPct) : 0;
  const donut = `conic-gradient(
    ${STATUS_COLORS.completed} 0 ${completedPct}%,
    ${STATUS_COLORS.in_progress} ${completedPct}% ${completedPct + progressPct}%,
    ${STATUS_COLORS.todo} ${completedPct + progressPct}% 100%
  )`;

  const canCreate = ['ADMIN', 'PROJECT_MANAGER'].includes(user.role);

  return (
    <div className="page dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">{todayLabel()}</span>
          <h1>{greeting(user.name)}</h1>
        </div>
        {canCreate && (
          <Link to="/projects?new=1" className="button button--primary">
            <Plus size={17} /> New project
          </Link>
        )}
      </header>

      <div className="stats-grid">
        <StatCard
          icon={FolderKanban}
          label="Projects"
          value={summary.projects ?? 0}
          tone="green"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={summary.completed ?? 0}
          tone="teal"
        />
        <StatCard
          icon={CalendarDays}
          label="Due this week"
          value={summary.due_this_week ?? 0}
          tone="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Needs attention"
          value={summary.overdue ?? 0}
          tone="red"
        />
      </div>

      <div className="dashboard-grid">
        <section className="card task-health">
          <div className="card__header">
            <div>
              <h2>Task health</h2>
            </div>
            <span className="pill">{pluralize(totalTasks, 'task')}</span>
          </div>

          <div className="task-health__body">
            <div className="donut-wrap">
              <div className="donut" style={{ background: totalTasks ? donut : '#e6e0d2' }}>
                <div className="donut__center">
                  <strong>{completedPct}%</strong>
                  <span>complete</span>
                </div>
              </div>
            </div>

            <div className="health-legend">
              <div className="legend-row">
                <span className="legend-dot legend-dot--green" />
                <span>Completed</span>
                <strong>{status.completed}</strong>
                <small>{completedPct}%</small>
              </div>
              <div className="legend-row">
                <span className="legend-dot legend-dot--amber" />
                <span>In progress</span>
                <strong>{status.in_progress}</strong>
                <small>{progressPct}%</small>
              </div>
              <div className="legend-row">
                <span className="legend-dot legend-dot--stone" />
                <span>To do</span>
                <strong>{status.todo}</strong>
                <small>{todoPct}%</small>
              </div>

              <div className="priority-mini">
                <span className="mini-heading">By priority</span>
                {[
                  ['High', priorities.high, 'red'],
                  ['Medium', priorities.medium, 'amber'],
                  ['Low', priorities.low, 'green'],
                ].map(([label, count, tone]) => (
                  <div className="priority-mini__row" key={label}>
                    <span>{label}</span>
                    <ProgressBar
                      value={totalTasks ? (count / totalTasks) * 100 : 0}
                      tone={tone}
                    />
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card upcoming-card">
          <div className="card__header">
            <div>
              <h2>Upcoming deadlines</h2>
            </div>
            <Link to="/tasks" className="text-link">
              All tasks <ArrowRight size={15} />
            </Link>
          </div>

          {data.overdue.length > 0 && (
            <div className="overdue-block">
              <span className="overdue-block__title">
                <AlertTriangle size={14} /> Past due
              </span>
              {data.overdue.slice(0, 2).map((task) => (
                <Link to={`/projects/${task.project_id}`} className="deadline-row deadline-row--danger" key={task.id}>
                  <span className="deadline-row__date">{formatDate(task.due_date).replace(/, \d{4}$/, '')}</span>
                  <span className="deadline-row__body">
                    <strong>{task.title}</strong>
                    <small>{task.project_name}</small>
                  </span>
                  {task.assignee_name && <Avatar name={task.assignee_name} size={26} />}
                </Link>
              ))}
            </div>
          )}

          {data.upcoming.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarDays size={22} />}
              title="No deadlines in sight"
            />
          ) : (
            <div className="deadline-list">
              {data.upcoming.map((task) => {
                const due = dueInfo(task.due_date, task.status);
                return (
                  <Link
                    to={`/projects/${task.project_id}`}
                    className="deadline-row"
                    key={task.id}
                  >
                    <span className={`deadline-row__date deadline-row__date--${due.tone}`}>
                      {formatDate(task.due_date).replace(/, \d{4}$/, '')}
                    </span>
                    <span className="deadline-row__body">
                      <strong>{task.title}</strong>
                      <small>{task.project_name}</small>
                    </span>
                    <PriorityBadge priority={task.priority} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="card project-progress-card">
          <div className="card__header">
            <div>
              <h2>Project progress</h2>
            </div>
            <Link to="/projects" className="text-link">
              All projects <ArrowRight size={15} />
            </Link>
          </div>

          {data.projects.length === 0 ? (
            <EmptyState
              compact
              icon={<FolderKanban size={22} />}
              title="No projects yet"
              description={
                canCreate
                  ? 'Create a project to give the team a place to start.'
                  : 'You’ll see projects here once you’re added to one.'
              }
              action={
                canCreate ? (
                  <Link to="/projects?new=1" className="button button--secondary button--small">
                    Create a project
                  </Link>
                ) : null
              }
            />
          ) : (
            <div className="project-progress-list">
              {data.projects.map((project) => (
                <Link
                  to={`/projects/${project.id}`}
                  className="project-progress-row"
                  key={project.id}
                >
                  <div className="project-progress-row__title">
                    <strong>{project.name}</strong>
                  </div>
                  <div className="project-progress-row__manager">
                    <Avatar name={project.manager_name} size={26} />
                    <span>{project.manager_name}</span>
                  </div>
                  <div className="project-progress-row__progress">
                    <ProgressBar value={project.progress} />
                    <span>{project.progress}%</span>
                  </div>
                  <div className="project-progress-row__due">
                    <Clock3 size={14} />
                    {project.deadline ? formatDate(project.deadline) : 'No deadline'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card performance-card">
          <div className="card__header">
            <div>
              <h2>Team performance</h2>
            </div>
            <Link to="/team" className="text-link">
              Team <ArrowRight size={15} />
            </Link>
          </div>

          {data.team.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 size={22} />}
              title="No workload yet"
              description="Assigned tasks will show up here."
            />
          ) : (
            <div className="team-performance">
              {data.team.map((member) => (
                <div className="team-performance__row" key={member.id}>
                  <Avatar name={member.name} size={32} />
                  <div className="team-performance__person">
                    <strong>{member.name}</strong>
                    <span>{roleLabel(member.role)}</span>
                  </div>
                  <div className="team-performance__bar">
                    <ProgressBar value={member.completion_rate} />
                  </div>
                  <span className="team-performance__count">
                    {member.completed}/{member.assigned}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
