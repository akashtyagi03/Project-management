import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  FolderKanban,
  ListChecks,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  actionDescription,
  actionLabel,
  formatDateTime,
  relativeTime,
} from '../utils/format';

const ENTITY_ICONS = {
  project: FolderKanban,
  task: ListChecks,
  user: Users,
};

const ENTITY_TONES = {
  project: 'info',
  task: 'neutral',
  user: 'plum',
};

export default function AuditPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, entityType]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: '15',
    });
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    if (entityType) params.set('entityType', entityType);

    setLoading(true);
    setError('');
    api
      .get(`/audit?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setLogs(response.data);
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
  }, [page, debouncedQuery, entityType, toast]);

  const filtered = Boolean(debouncedQuery || entityType);

  return (
    <div className="page audit-page">
      <PageHeader
        eyebrow="Audit log"
        title="A record of what changed"
        description="Project, task, and access changes — captured with who made them and when."
      />

      <div className="audit-note">
        <ShieldCheck size={18} />
        <div>
          <strong>Immutable by design</strong>
          <p>Entries are created automatically and cannot be edited from the application.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search actions, people, or details"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search audit log"
          />
        </div>
        <div className="toolbar__group">
          <select
            className="select select--compact"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            aria-label="Filter by entity"
          >
            <option value="">All activity</option>
            <option value="project">Projects</option>
            <option value="task">Tasks</option>
            <option value="user">Users</option>
          </select>
        </div>
      </div>

      {error && logs.length === 0 ? (
        <div className="panel error-panel">
          <AlertTriangle size={22} />
          <div>
            <h2>The audit log didn’t load</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : loading && logs.length === 0 ? (
        <div className="audit-list">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="skeleton skeleton--audit" key={item} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={25} />}
          title={filtered ? 'No activity matches' : 'No activity yet'}
          description={
            filtered
              ? 'Try a different search or entity type.'
              : 'Project, task, and role changes will appear here as the team works.'
          }
          action={
            filtered ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setQuery('');
                  setEntityType('');
                }}
              >
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className={`audit-list ${loading ? 'is-refreshing' : ''}`}>
            <div className="audit-list__head">
              <span>When</span>
              <span>Who</span>
              <span>Activity</span>
              <span>Entity</span>
            </div>
            {logs.map((log) => {
              const EntityIcon = ENTITY_ICONS[log.entity_type] || ScrollText;
              return (
                <div className="audit-row" key={log.id}>
                  <div className="audit-row__time">
                    <strong title={formatDateTime(log.created_at)}>
                      {relativeTime(log.created_at)}
                    </strong>
                    <span>{formatDateTime(log.created_at)}</span>
                  </div>
                  <div className="audit-row__actor">
                    <Avatar name={log.actor_name || 'System'} size={28} />
                    <span>{log.actor_name || 'System'}</span>
                  </div>
                  <div className="audit-row__activity">
                    <p>{actionDescription(log)}</p>
                    <span className="audit-code">{actionLabel(log.action)}</span>
                  </div>
                  <div>
                    <Badge tone={ENTITY_TONES[log.entity_type] || 'neutral'}>
                      <EntityIcon size={12} />
                      {log.entity_type} #{log.entity_id ?? '—'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
