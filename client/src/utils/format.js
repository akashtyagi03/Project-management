const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(value, fallback = 'No date') {
  if (!value) return fallback;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatShortDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  const currentYear = new Date().getFullYear();
  return date.getFullYear() === currentYear
    ? `${MONTHS[date.getMonth()]} ${date.getDate()}`
    : `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'just now';
}

export function dueInfo(value, status = 'TODO') {
  if (!value) return { label: 'No due date', tone: 'muted' };
  if (status === 'COMPLETED') return { label: formatShortDate(value), tone: 'muted' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  const days = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      label: `${formatShortDate(value)} · ${Math.abs(days)}d late`,
      tone: 'danger',
    };
  }
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'warning' };
  if (days <= 7) return { label: `Due in ${days} days`, tone: 'warning' };
  return { label: formatShortDate(value), tone: 'normal' };
}

export function isOverdue(value, status) {
  return dueInfo(value, status).tone === 'danger';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function roleLabel(role) {
  return {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'Project manager',
    TEAM_MEMBER: 'Team member',
  }[role] || role;
}

export function statusLabel(status) {
  return {
    TODO: 'To do',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
  }[status] || status;
}

export function priorityLabel(priority) {
  return {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
  }[priority] || priority;
}

export function actionLabel(action = '') {
  return action
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function actionDescription(log) {
  const details = log.details || {};
  switch (log.action) {
    case 'project.created':
      return `created project “${details.name || 'Untitled'}”`;
    case 'project.updated':
      return `updated project “${details.name || 'Untitled'}”`;
    case 'project.deleted':
      return `deleted project “${details.name || 'Untitled'}”`;
    case 'member.added':
      return `added ${details.name || 'a member'} to the project`;
    case 'member.removed':
      return `removed ${details.name || 'a member'} from the project`;
    case 'task.created':
      return `created task “${details.title || 'Untitled'}”`;
    case 'task.updated':
      return `updated task “${details.title || 'Untitled'}”${
        details.status ? ` to ${statusLabel(details.status).toLowerCase()}` : ''
      }`;
    case 'task.deleted':
      return `deleted task “${details.title || 'Untitled'}”`;
    case 'comment.created':
      return `commented on “${details.title || 'a task'}”`;
    case 'comment.deleted':
      return 'deleted a comment';
    case 'attachment.uploaded':
      return `attached ${details.fileName || 'a file'}`;
    case 'attachment.deleted':
      return `removed attachment ${details.fileName || ''}`.trim();
    case 'user.registered':
      return 'joined the workspace';
    case 'user.role_updated':
      return `changed ${details.name || 'a user'} from ${roleLabel(details.from)} to ${roleLabel(details.to)}`;
    default:
      return actionLabel(log.action).toLowerCase();
  }
}

export function greeting(name = '') {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${prefix}, ${name.split(' ')[0]}`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
