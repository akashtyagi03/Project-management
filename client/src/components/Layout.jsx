import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { roleLabel } from '../utils/format';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/tasks', label: 'My tasks', icon: ListChecks },
  { to: '/team', label: 'Team', icon: Users },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    toast('You have been signed out.', 'info');
  };

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <Logo light />
          <button
            type="button"
            className="icon-button sidebar__close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main navigation">
          <span className="sidebar__label">Workspace</span>
          {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'ADMIN').map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>


        <div className="sidebar__profile">
          <Avatar name={user.name} size={38} />
          <div className="sidebar__profile-text">
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
          <button
            type="button"
            className="icon-button icon-button--dark"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header">
          <button
            type="button"
            className="icon-button icon-button--border"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>
          <Logo />
          <Avatar name={user.name} size={34} />
        </header>
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
