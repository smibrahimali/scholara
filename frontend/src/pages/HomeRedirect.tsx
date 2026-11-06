import { StudentDashboardPage } from './StudentDashboardPage';
import { ConsultantHomePage } from './ConsultantHomePage';
import { useAuth } from '../context/AuthContext';

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'CONSULTANT') return <ConsultantHomePage />;
  return <StudentDashboardPage />;
}
