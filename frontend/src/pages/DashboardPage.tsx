import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div>
          <p className="eyebrow">Scholara</p>
          <h1>Welcome, {user.fullName}</h1>
          <p className="subtitle">
            Role: <strong>{user.role}</strong> · {user.email}
          </p>
        </div>
        <button type="button" onClick={logout}>
          Sign out
        </button>
      </header>

      <section className="dash-panel">
        <h2>Demo foundation ready</h2>
        <p>
          Phase 2 is in place: NestJS JWT demo login, TypeORM schema, and seeded
          admission data for Ali Raza. Next we build dashboards, documents, and
          applications on top of this.
        </p>
        <ul>
          <li>Student profile id: {user.studentProfileId ?? '—'}</li>
          <li>Guardian linked student: {user.linkedStudentId ?? '—'}</li>
          <li>Consultant profile id: {user.consultantProfileId ?? '—'}</li>
        </ul>
      </section>
    </div>
  );
}
