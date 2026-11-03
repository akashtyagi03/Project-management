import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <h1>404.</h1>
      <Link to="/" className="button button--primary">
        <ArrowLeft size={16} /> Back to dashboard
      </Link>
    </div>
  );
}
