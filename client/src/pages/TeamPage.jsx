import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { RoleBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ProgressBar } from '../components/ProgressBar';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDate, pluralize, roleLabel } from '../utils/format';

const ROLE_FILTERS = [
  ['all', 'Everyone'],
  ['PROJECT_MANAGER', 'Project managers'],
  ['TEAM_MEMBER', 'Team members'],
  ['ADMIN', 'Admins'],
];

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [roleFilter, setRoleFilter] = useState('all');
  const [savingRoleFor, setSavingRoleFor] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([api.get('/users'), api.get('/dashboard')])
      .then(([usersResponse, dashboardResponse]) => {
        if (!active) return;
        setUsers(usersResponse.data);
        setPerformance(dashboardResponse.team);
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
  }, [toast]);

  const performanceById = useMemo(() => {
    const map = new Map();
    performance.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [performance]);

  const filtered = users.filter((person) => {
    const matchesRole = roleFilter === 'all' || person.role === roleFilter;
    const search = debouncedQuery.trim().toLowerCase();
    const matchesSearch =
      !search ||
      person.name.toLowerCase().includes(search) ||
      person.email.toLowerCase().includes(search);
    return matchesRole && matchesSearch;
  });

  const counts = users.reduce(
    (result, person) => ({ ...result, [person.role]: (result[person.role] || 0) + 1 }),
    {}
  );

  const handleRoleChange = async (person, role) => {
    setSavingRoleFor(person.id);
    try {
      const response = await api.patch(`/users/${person.id}/role`, { role });
      setUsers((current) =>
        current.map((member) => (member.id === person.id ? response.data : member))
      );
      toast(`${person.name} is now a ${roleLabel(role).toLowerCase()}.`);
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setSavingRoleFor(null);
    }
  };

  return (
    <div className="page team-page">
      <PageHeader
        eyebrow="Team"
        title="The people behind the work"
        description="Roles, workload, and who’s carrying what. Admin can update access here."
      />

      {error && users.length === 0 ? (
        <div className="panel error-panel">
          <AlertTriangle size={22} />
          <div>
            <h2>The team didn’t load</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : loading && users.length === 0 ? (
        <div className="team-grid">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="skeleton skeleton--team" key={item} />
          ))}
        </div>
      ) : (
        <>
          <div className="team-summary">
            <div className="team-summary__item">
              <UsersRound size={18} />
              <div>
                <strong>{users.length}</strong>
                <span>People in the workspace</span>
              </div>
            </div>
            <div className="team-summary__item">
              <span className="role-dot role-dot--pm" />
              <div>
                <strong>{counts.PROJECT_MANAGER || 0}</strong>
                <span>Project managers</span>
              </div>
            </div>
            <div className="team-summary__item">
              <span className="role-dot role-dot--member" />
              <div>
                <strong>{counts.TEAM_MEMBER || 0}</strong>
                <span>Team members</span>
              </div>
            </div>
            <div className="team-summary__item">
              <ShieldCheck size={18} />
              <div>
                <strong>{counts.ADMIN || 0}</strong>
                <span>Admins</span>
              </div>
            </div>
          </div>

          <div className="toolbar team-toolbar">
            <div className="toolbar__search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search people"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search people"
              />
            </div>
            <div className="segmented" role="group" aria-label="Filter by role">
              {ROLE_FILTERS.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={roleFilter === value ? 'segmented__item segmented__item--active' : 'segmented__item'}
                  onClick={() => setRoleFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title="No one matches that"
              description="Try another name or role."
              action={
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    setQuery('');
                    setRoleFilter('all');
                  }}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="team-grid">
              {filtered.map((person) => {
                const stats = performanceById.get(person.id) || {
                  assigned: 0,
                  completed: 0,
                  completion_rate: 0,
                };
                const isSelf = person.id === user.id;
                const canEditRole = user.role === 'ADMIN' && !isSelf;

                return (
                  <article className="team-card" key={person.id}>
                    <div className="team-card__header">
                      <Avatar name={person.name} size={48} />
                      <div className="team-card__identity">
                        <h2>
                          {person.name}
                          {isSelf && <span className="you-tag">You</span>}
                        </h2>
                        <span>{person.email}</span>
                      </div>
                      {!canEditRole && <RoleBadge role={person.role} />}
                    </div>

                    <div className="team-card__workload">
                      <div className="team-card__workload-head">
                        <span>Task completion</span>
                        <strong>{stats.completion_rate}%</strong>
                      </div>
                      <ProgressBar value={stats.completion_rate} />
                      <p>
                        {stats.completed} completed · {stats.assigned - stats.completed} open
                        {stats.assigned === 0 ? ' · no tasks assigned' : ''}
                      </p>
                    </div>

                    <div className="team-card__footer">
                      <span>{person.createdAt ? `Joined ${formatDate(person.createdAt)}` : 'Join date unknown'}</span>
                      {canEditRole ? (
                        <label className="role-editor">
                          <span className="sr-only">Role for {person.name}</span>
                          <select
                            value={person.role}
                            onChange={(event) => handleRoleChange(person, event.target.value)}
                            disabled={savingRoleFor === person.id}
                          >
                            <option value="TEAM_MEMBER">Team member</option>
                            <option value="PROJECT_MANAGER">Project manager</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </label>
                      ) : (
                        <span className="team-card__label">{roleLabel(person.role)}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="page-note">
            <ShieldCheck size={15} />
            {user.role === 'ADMIN'
              ? 'Admins can change anyone’s role except their own. Role changes are recorded in the audit log.'
              : `Only admins can change roles. There ${counts.ADMIN === 1 ? 'is' : 'are'} ${pluralize(counts.ADMIN || 0, 'admin')} in this workspace.`}
          </p>
        </>
      )}
    </div>
  );
}
