import { Navigate } from 'react-router-dom';
import { StudentDashboardPage } from './StudentDashboardPage';
import { ConsultantHomePage } from './ConsultantHomePage';
import { useAuth } from '../context/AuthContext';

/**
 * Role-aware `/app` index. Consultants never mount the student dashboard
 * (which calls `/students/dashboard` without studentId → 403).
 */
export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'CONSULTANT') return <ConsultantHomePage />;
  return <StudentDashboardPage />;
}
