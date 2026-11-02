import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <span className="eyebrow">404</span>
      <h1>This page wandered off.</h1>
      <p>The link may be old, or the project may have been removed.</p>
      <Link to="/" className="button button--primary">
        <ArrowLeft size={16} /> Back to dashboard
      </Link>
    </div>
  );
}
