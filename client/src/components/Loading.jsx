import { Logo } from './Logo';

export function PageLoader({ label = 'Loading workspace' }) {
  return (
    <div className="page-loader">
      <Logo />
      <span className="spinner" aria-hidden="true" />
      <p>{label}…</p>
    </div>
  );
}

export function InlineLoader({ label = 'Loading' }) {
  return (
    <span className="inline-loader">
      <span className="spinner spinner--small" aria-hidden="true" />
      {label}
    </span>
  );
}
