import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

function axiosStatus(error: unknown): number | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return error.response?.status;
}

/** Never retry client auth/permission/not-found failures; soft-retry 5xx/network. */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = axiosStatus(error);
  if (status !== undefined && status >= 400 && status < 500) {
    return false;
  }
  return failureCount < 3;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: false,
    },
  },
});
