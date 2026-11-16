import type { QueryClient } from '@tanstack/react-query';
import { disconnectAllSockets } from './socketRegistry.ts';
import type { UserRole } from '../types/auth';

const TOKEN_KEY = 'scholara_token';
const USER_KEY = 'scholara_user';

/**
 * Purge auth storage, React Query cache, and live sockets.
 * Call on logout and after a successful login (role switch).
 */
export function clearClientSession(queryClient: QueryClient): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  disconnectAllSockets();
  queryClient.clear();
}

/** Read `role` from a JWT payload without verifying the signature (API verifies). */
export function readJwtRole(token: string | null | undefined): UserRole | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json = atob(padded + pad);
    const payload = JSON.parse(json) as { role?: string };
    const role = payload.role?.toUpperCase();
    if (role === 'STUDENT' || role === 'GUARDIAN' || role === 'CONSULTANT') {
      return role;
    }
    return null;
  } catch {
    return null;
  }
}

export { TOKEN_KEY, USER_KEY };
