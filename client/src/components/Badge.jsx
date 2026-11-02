import { priorityLabel, roleLabel, statusLabel } from '../utils/format';

export function Badge({ tone = 'neutral', dot = false, children, className = '' }) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
};

const PRIORITY_TONES = {
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

const ROLE_TONES = {
  ADMIN: 'plum',
  PROJECT_MANAGER: 'info',
  TEAM_MEMBER: 'neutral',
};

export function StatusBadge({ status }) {
  return (
    <Badge tone={STATUS_TONES[status] || 'neutral'} dot>
      {statusLabel(status)}
    </Badge>
  );
}

export function PriorityBadge({ priority, dot = false }) {
  return (
    <Badge tone={PRIORITY_TONES[priority] || 'neutral'} dot={dot}>
      {priorityLabel(priority)}
    </Badge>
  );
}

export function RoleBadge({ role }) {
  return <Badge tone={ROLE_TONES[role] || 'neutral'}>{roleLabel(role)}</Badge>;
}
