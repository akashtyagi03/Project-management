import { Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PageLoader } from './components/Loading';
import { Layout } from './components/Layout';
import { AdminOnly, GuestOnly, RequireAuth } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import MyTasksPage from './pages/MyTasksPage';
import TeamPage from './pages/TeamPage';
import AuditPage from './pages/AuditPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  const { loading } = useAuth();

  if (loading) return <PageLoader label="Checking your session" />;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="tasks" element={<MyTasksPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route
            path="audit"
            element={
              <AdminOnly>
                <AuditPage />
              </AdminOnly>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
