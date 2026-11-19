import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const StudentDashboardPage = lazy(() =>
  import('./StudentDashboardPage').then((m) => ({
    default: m.StudentDashboardPage,
  })),
);
const ConsultantHomePage = lazy(() =>
  import('./ConsultantHomePage').then((m) => ({
    default: m.ConsultantHomePage,
  })),
);

/**
 * Role-aware `/app` index. Consultants never mount the student dashboard
 * (which calls `/students/dashboard` without studentId → 403).
 */
export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Loading…
        </p>
      }
    >
      {user.role === 'CONSULTANT' ? (
        <ConsultantHomePage />
      ) : (
        <StudentDashboardPage />
      )}
    </Suspense>
  );
}
