import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { AuthPreview } from '../components/AuthPreview';

const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    name: 'Aarav Mehta',
    email: 'admin@groundwork.dev',
    password: 'Admin@123',
  },
  {
    label: 'Project manager',
    name: 'Priya Sharma',
    email: 'priya@groundwork.dev',
    password: 'Manager@123',
  },
  {
    label: 'Team member',
    name: 'Rohan Iyer',
    email: 'rohan@groundwork.dev',
    password: 'Member@123',
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : '/';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      toast(`Welcome back, ${user.name.split(' ')[0]}.`);
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside__brand">
          <Logo light />
        </div>
        <div className="auth-aside__copy">
          <h1>Keep the work moving, together.</h1>
          <p>
            Projects, tasks, and the decisions around them — in one calm, shared space.
          </p>
        </div>
        <AuthPreview />
      </aside>

      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Logo />
        </div>

        <div className="auth-card">
          <div className="auth-card__heading">
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to Groundwork</h2>
            <p>Pick up where your team left off.</p>
          </div>

          {error && (
            <div className="form-alert" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-stack">
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="enter email"
                autoComplete="email"
                autoFocus
              />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="enter password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="button button--primary button--full"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-switch">
            New to Groundwork? <Link to="/register">Create an account</Link>
          </p>

          <div className="demo-accounts">
            <div className="demo-accounts__heading">
              <span>Try the demo workspace</span>
              <small>Click an account to fill the form</small>
            </div>
            <div className="demo-accounts__list">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  type="button"
                  key={account.email}
                  className={`demo-account ${email === account.email ? 'demo-account--active' : ''}`}
                  onClick={() => fillDemo(account)}
                >
                  <Avatar name={account.name} size={30} />
                  <span className="demo-account__text">
                    <strong>{account.label}</strong>
                    <span>{account.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
