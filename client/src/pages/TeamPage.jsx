import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, ShieldCheck } from 'lucide-react';
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

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
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
    const search = debouncedQuery.trim().toLowerCase();
    return (
      !search ||
      person.name.toLowerCase().includes(search) ||
      person.email.toLowerCase().includes(search)
    );
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
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title="No one matches that"
              description="Try searching for another name or email."
              action={
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setQuery('')}
                >
                  Clear search
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
                      </div>
                      {!canEditRole && <RoleBadge role={person.role} />}
                    </div>

                    <div className="team-card__workload">
                      <div className="team-card__workload-head">
                        <span>Task completion</span>
                        <strong>{stats.completion_rate}%</strong>
                      </div>
                      <ProgressBar value={stats.completion_rate} />
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
              ? 'Admins can change anyone’s role except their own.'
              : `Only admins can change roles. There ${counts.ADMIN === 1 ? 'is' : 'are'} ${pluralize(counts.ADMIN || 0, 'admin')} in this workspace.`}
          </p>
        </>
      )}
    </div>
  );
}
