import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../lib/roleHome';
import type { UserRole } from '../types/auth';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to={homePathForRole(user.role)}
        replace
        state={{ from: location.pathname, reason: 'forbidden' }}
      />
    );
  }

  return children;
}
