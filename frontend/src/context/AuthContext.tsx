import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AdminUser, AdminRole } from '../types/admin';
import { login as apiLogin, setToken, getToken } from '../lib/admin-api';

interface AuthState {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isSuperAdmin: () => boolean;
  hasRole: (role: AdminRole) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiLogin(email, password);
      setToken(res.token);
      setAdmin(res.admin);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
  }, []);

  const isSuperAdmin = useCallback(() => admin?.role === 'SUPERADMIN', [admin]);

  const hasRole = useCallback(
    (role: AdminRole) => admin?.role === role,
    [admin],
  );

  const value: AuthState = {
    admin,
    isAuthenticated: !!admin && !!getToken(),
    isLoading,
    login,
    logout,
    isSuperAdmin,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
