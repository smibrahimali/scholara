import type { UserRole } from '../types/auth';

/** Canonical post-login / role-mismatch landing path. Shared shell uses `/app`. */
export function homePathForRole(role?: UserRole | null): string {
  // Role home is rendered by HomeRedirect at `/app` for all roles.
  return role ? '/app' : '/login';
}

export function isConsultantOnlyPath(pathname: string): boolean {
  return pathname.startsWith('/app/students/');
}

/** Self-scoped student/guardian routes (not consultant dossier). */
export function isStudentSelfPath(pathname: string): boolean {
  if (pathname === '/app' || pathname === '/app/') return false;
  if (isConsultantOnlyPath(pathname)) return false;
  return (
    pathname.startsWith('/app/documents') ||
    pathname.startsWith('/app/applications') ||
    pathname.startsWith('/app/emails') ||
    pathname.startsWith('/app/consultant') ||
    pathname.startsWith('/app/messages') ||
    pathname === '/app/calls'
  );
}

export function canAccessPath(
  role: UserRole | null | undefined,
  pathname: string,
): boolean {
  if (!role) return false;
  if (pathname === '/app' || pathname === '/app/' || pathname === '/app/profile') {
    return true;
  }
  if (pathname.startsWith('/app/live-call/')) return true;
  if (isConsultantOnlyPath(pathname)) return role === 'CONSULTANT';
  if (isStudentSelfPath(pathname)) {
    return role === 'STUDENT' || role === 'GUARDIAN';
  }
  return true;
}
