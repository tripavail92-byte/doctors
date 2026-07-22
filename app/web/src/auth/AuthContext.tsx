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
  entitlements: Set<string>;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMAIL_KEY = 'healthos.email';

const ENTITLEMENTS_KEY = 'healthos.entitlements';

function userFromToken(token: string): AuthUser | null {
  const claims = decodeJwt<JwtClaims>(token);
  if (!claims?.sub) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  const cached = localStorage.getItem(ENTITLEMENTS_KEY);
  return {
    userId: claims.sub,
    email: localStorage.getItem(EMAIL_KEY),
    role: claims.role,
    tenantId: claims.tenantId,
    isPlatformAdmin: claims.isPlatformAdmin,
    entitlements: new Set(cached ? JSON.parse(cached) as string[] : []),
  };
}

async function fetchEntitlements(): Promise<string[]> {
  try {
    const { data } = await apiClient.get<{ features: string[] }>('/entitlements');
    return data.features;
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate the session from a persisted token on first load.
  useEffect(() => {
    const token = getToken();
    if (token) {
      const u = userFromToken(token);
      if (u) {
        setUser(u);
        if (!u.isPlatformAdmin) {
          fetchEntitlements().then((keys) => {
            localStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(keys));
            setUser((prev) => prev ? { ...prev, entitlements: new Set(keys) } : prev);
          });
        }
      } else {
        clearToken();
      }
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
        if (!u.isPlatformAdmin) {
          const keys = await fetchEntitlements();
          localStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(keys));
          u.entitlements = new Set(keys);
        }
        setUser(u);
      },
      logout() {
        clearToken();
        localStorage.removeItem(EMAIL_KEY);
        localStorage.removeItem(ENTITLEMENTS_KEY);
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
