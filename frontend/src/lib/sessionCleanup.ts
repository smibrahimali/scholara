import type { QueryClient } from '@tanstack/react-query';
import { disconnectAllSockets } from './socketRegistry.ts';

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

export { TOKEN_KEY, USER_KEY };
