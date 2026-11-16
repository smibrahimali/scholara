import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../services/api';
import { queryClient } from '../lib/queryClient';
import {
  setForbiddenListener,
  setUnauthorizedListener,
} from '../lib/authEvents';
import { canAccessPath, homePathForRole } from '../lib/roleHome';
import {
  clearClientSession,
  readJwtRole,
  TOKEN_KEY,
  USER_KEY,
} from '../lib/sessionCleanup';
import type { AuthUser, DemoLoginResponse } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Drop mismatched token/user pairs that cause consultant 403s on End call. */
function readInitialSession(): { token: string | null; user: AuthUser | null } {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = readStoredUser();
  if (!token || !user) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return { token: null, user: null };
  }
  const jwtRole = readJwtRole(token);
  if (!jwtRole || jwtRole !== user.role) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return { token: null, user: null };
  }
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readInitialSession();
  const [token, setToken] = useState<string | null>(initial.token);
  const [user, setUser] = useState<AuthUser | null>(initial.user);

  const logout = useCallback(() => {
    clearClientSession(queryClient);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedListener(() => {
      setToken(null);
      setUser(null);
    });
    setForbiddenListener(() => {
      // Soft redirect only when the current route is role-mismatched.
      // Keeps JWT; avoids logging out on incidental permission errors.
      const path = window.location.pathname;
      if (path.startsWith('/login')) return;
      const role = readStoredUser()?.role;
      if (canAccessPath(role, path)) return;
      const home = homePathForRole(role);
      if (path === home || path === `${home}/`) return;
      window.location.assign(home);
    });
    return () => {
      setUnauthorizedListener(null);
      setForbiddenListener(null);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<DemoLoginResponse>('/auth/demo-login', {
      email,
      password,
    });
    // Drop previous role's cache/sockets only after credentials succeed.
    clearClientSession(queryClient);
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({ user, token, login, logout }),
    [user, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
