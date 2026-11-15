import axios from 'axios';
import { queryClient } from '../lib/queryClient';
import { clearClientSession } from '../lib/sessionCleanup';
import { notifyUnauthorized } from '../lib/authEvents';

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('scholara_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status =
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'status' in error.response
        ? Number((error.response as { status?: number }).status)
        : undefined;

    const url =
      error &&
      typeof error === 'object' &&
      'config' in error &&
      error.config &&
      typeof error.config === 'object' &&
      'url' in error.config
        ? String((error.config as { url?: string }).url ?? '')
        : '';

    // Never bounce the demo-login page itself into a redirect loop.
    if (status === 401 && !url.includes('/auth/demo-login')) {
      clearClientSession(queryClient);
      notifyUnauthorized();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);
