export function Logo({ light = false, compact = false }) {
  return (
    <span className={`logo ${light ? 'logo--light' : ''}`.trim()}>
      <span className="logo__mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      {!compact && <span className="logo__word">groundwork</span>}
    </span>
  );
}
