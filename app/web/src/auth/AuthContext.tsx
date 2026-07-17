import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, clearToken, decodeJwt, getToken, setToken } from '../api/client';
import type { JwtClaims, LoginResponse } from '../api/types';

export interface AuthUser {
  userId: string;
  email: string | null;
  role: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMAIL_KEY = 'healthos.email';

function userFromToken(token: string): AuthUser | null {
  const claims = decodeJwt<JwtClaims>(token);
  if (!claims?.sub) return null;
  // Expiry guard — treat an expired token as logged out.
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return {
    userId: claims.sub,
    email: localStorage.getItem(EMAIL_KEY),
    role: claims.role,
    tenantId: claims.tenantId,
    isPlatformAdmin: claims.isPlatformAdmin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate the session from a persisted token on first load.
  useEffect(() => {
    const token = getToken();
    if (token) {
      const u = userFromToken(token);
      if (u) setUser(u);
      else clearToken();
    }
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
        setToken(data.accessToken);
        localStorage.setItem(EMAIL_KEY, email);
        const u = userFromToken(data.accessToken);
        if (!u) throw new Error('Received an invalid token');
        setUser(u);
      },
      logout() {
        clearToken();
        localStorage.removeItem(EMAIL_KEY);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
