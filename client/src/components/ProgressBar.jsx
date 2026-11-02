export function ProgressBar({ value = 0, tone = 'green', label }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className={`progress ${label ? 'progress--labeled' : ''}`.trim()}>
      <div
        className="progress__track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className={`progress__fill progress__fill--${tone}`} style={{ width: `${clamped}%` }} />
      </div>
      {label && <span className="progress__label">{label}</span>}
    </div>
  );
}
