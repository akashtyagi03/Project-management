import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Logo } from '../components/Logo';
import { AuthPreview } from '../components/AuthPreview';

export default function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Fill in your name, email, and password.');
      return;
    }
    if (form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast(`You’re in, ${user.name.split(' ')[0]}. Welcome to Groundwork.`);
      navigate('/');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside__brand">
          <Logo light />
        </div>
        <div className="auth-aside__copy">
          <span className="auth-kicker">Start with clarity</span>
          <h1>A shared view of everything that matters.</h1>
          <p>
            Bring projects, deadlines, and people together before the next status meeting.
          </p>
        </div>
        <AuthPreview />
        <p className="auth-aside__footnote">
          No standups required to know where things stand.
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Logo />
        </div>

        <div className="auth-card">
          <div className="auth-card__heading">
            <span className="eyebrow">Create your account</span>
            <h2>Join the workspace</h2>
            <p>New accounts start with the Team member role.</p>
          </div>

          {error && (
            <div className="form-alert" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-stack">
            <label className="field">
              <span>Full name</span>
              <input
                type="text"
                value={form.name}
                onChange={update('name')}
                placeholder="Sam Rivera"
                autoComplete="name"
                autoFocus
                maxLength={80}
              />
            </label>

            <label className="field">
              <span>Work email</span>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={update('password')}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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

            <label className="field">
              <span>Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirm}
                onChange={update('confirm')}
                placeholder="Type it again"
                autoComplete="new-password"
              />
            </label>

            <p className="form-hint">
              On a brand-new workspace, the first account becomes the admin. After that, an
              admin can update roles.
            </p>

            <button
              type="submit"
              className="button button--primary button--full"
              disabled={submitting}
            >
              {submitting ? 'Creating account…' : 'Create account'}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>

        <p className="auth-legal">Groundwork · Demo project workspace</p>
      </main>
    </div>
  );
}
