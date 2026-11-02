import { initials } from '../utils/format';

const COLORS = ['#2f6b57', '#a7653b', '#4b6685', '#795573', '#647044', '#a4564c'];

function colorFor(name = '') {
  const total = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return COLORS[total % COLORS.length];
}

export function Avatar({ name = '', size = 36, className = '' }) {
  return (
    <span
      className={`avatar ${className}`.trim()}
      style={{
        width: size,
        height: size,
        background: colorFor(name),
        fontSize: Math.max(10, Math.round(size * 0.34)),
      }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarGroup({ people = [], max = 4, size = 28 }) {
  const shown = people.slice(0, max);
  const remaining = people.length - shown.length;

  return (
    <span className="avatar-group">
      {shown.map((person) => (
        <Avatar key={person.id || person.name} name={person.name} size={size} />
      ))}
      {remaining > 0 && (
        <span
          className="avatar avatar--more"
          style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
        >
          +{remaining}
        </span>
      )}
    </span>
  );
}
