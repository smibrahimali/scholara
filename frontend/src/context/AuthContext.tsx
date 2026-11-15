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
import { setUnauthorizedListener } from '../lib/authEvents';
import {
  clearClientSession,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

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
    return () => setUnauthorizedListener(null);
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
