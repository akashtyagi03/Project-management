import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, FolderKanban, Plus, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { ProgressBar } from '../components/ProgressBar';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDate, pluralize } from '../utils/format';

function projectState(project) {
  if (project.task_count > 0 && project.progress === 100) {
    return { label: 'Completed', tone: 'success' };
  }
  if (project.deadline && new Date(`${project.deadline}T23:59:59`) < new Date()) {
    return { label: 'Past deadline', tone: 'danger' };
  }
  return { label: 'Active', tone: 'info' };
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = ['ADMIN', 'PROJECT_MANAGER'].includes(user.role);
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [scope, setScope] = useState('all');
  const [sort, setSort] = useState('deadline');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === '1' && canCreate) {
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canCreate, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, scope, sort]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({
      page: String(page),
      limit: '9',
      sort,
      scope,
    });
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());

    api
      .get(`/projects?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setProjects(response.data);
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
  }, [page, debouncedQuery, scope, sort, toast]);

  return (
    <div className="page">
      <PageHeader
        title="Projects"
        actions={
          canCreate && (
            <button type="button" className="button button--primary" onClick={() => setFormOpen(true)}>
              <Plus size={17} /> New project
            </button>
          )
        }
      />

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search projects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search projects"
          />
        </div>

        <div className="toolbar__group">
          {canCreate && (
            <div className="segmented" role="group" aria-label="Project scope">
              {[
                ['all', 'All'],
                ['managed', 'Managed by me'],
                ['member', 'On the team'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={scope === value ? 'segmented__item segmented__item--active' : 'segmented__item'}
                  onClick={() => setScope(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <label className="select-wrap">
            <span className="sr-only">Sort projects</span>
            <select
              className="select select--compact"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="deadline">Due soonest</option>
              <option value="recent">Recently updated</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {error && projects.length === 0 ? (
        <div className="panel error-panel">
          <FolderKanban size={22} />
          <div>
            <h2>Projects didn’t load</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : loading && projects.length === 0 ? (
        <div className="project-grid">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="skeleton skeleton--project" key={item} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={26} />}
          title={query ? 'No projects match that search' : 'Your project list is quiet'}
          description={
            query
              ? 'Try a different phrase, or clear the search.'
              : canCreate
                ? 'Start with a goal, a deadline, and a project manager. The rest can follow.'
                : 'A project manager will add you to a project when it’s time.'
          }
          action={
            canCreate && !query ? (
              <button type="button" className="button button--primary" onClick={() => setFormOpen(true)}>
                <Plus size={17} /> Create your first project
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className={`project-grid ${loading ? 'is-refreshing' : ''}`}>
            {projects.map((project) => {
              const state = projectState(project);
              return (
                <Link to={`/projects/${project.id}`} className="project-card" key={project.id}>
                  <div className="project-card__top">
                    <Badge tone={state.tone} dot>{state.label}</Badge>
                    <span className="project-card__count">
                      {pluralize(project.member_count, 'member')}
                    </span>
                  </div>

                  <div className="project-card__title">
                    <h2>{project.name}</h2>
                    <p>{project.description || 'No description yet.'}</p>
                  </div>

                  <div className="project-card__progress">
                    <div className="project-card__progress-head">
                      <span>Progress</span>
                      <strong>{project.progress}%</strong>
                    </div>
                    <ProgressBar value={project.progress} tone={state.tone === 'success' ? 'teal' : 'green'} />
                    <small>
                      {project.completed_tasks} of {project.task_count} tasks complete
                    </small>
                  </div>

                  <div className="project-card__footer">
                    <span className="project-card__manager">
                      <Avatar name={project.manager_name} size={28} />
                      <span>
                        <small>Project manager</small>
                        {project.manager_name}
                      </span>
                    </span>
                    <span className="project-card__meta">
                      <CalendarDays size={14} />
                      {project.deadline ? formatDate(project.deadline) : 'No deadline'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}

      <ProjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(project) => navigate(`/projects/${project.id}`)}
      />
    </div>
  );
}
