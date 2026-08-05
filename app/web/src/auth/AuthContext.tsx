import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, clearToken, decodeJwt, getToken, setToken } from '../api/client';
import type { ClinicContext, ContextListResponse, JwtClaims, LoginResponse } from '../api/types';

export interface AuthUser {
  userId: string;
  email: string | null;
  role: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
  organizationId: string | null;
  clinicId: string | null;
  branchId: string | null;
  departmentId: string | null;
  membershipId: string | null;
  entitlements: Set<string>;
}

interface AuthContextValue {
  user: AuthUser | null;
  contexts: ClinicContext[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  switchContext: (membershipId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMAIL_KEY = 'healthos.email';

// Per-tenant cache key. A shared 'healthos.entitlements' was wrong on the
// second scenario the switcher exists for: log out of tenant A, log into
// tenant B, and the sidebar renders A's modules until /entitlements returns
// — a leak of the previous clinic's capability surface into the new session.
// Keying by tenant means each tenant has its own cached bundle, and a switch
// picks up the right one immediately.
const ENTITLEMENTS_KEY_PREFIX = 'healthos.entitlements.v2.';
function entitlementsKey(tenantId: string | null): string {
  // A null tenant is a platform admin — no cached entitlements anyway.
  return ENTITLEMENTS_KEY_PREFIX + (tenantId ?? '__none__');
}

// A discriminated result rather than a bare string[]. `fetchEntitlements`
// used to `catch { return []; }` — and that empty array was written into
// localStorage AND into user.entitlements, so one flaky call permanently
// collapsed the sidebar to Dashboard/Patients/Trends until the browser
// storage was cleared. A failure is a state, not a truth about the tenant's
// bundle. Callers must distinguish the two.
type EntitlementFetch =
  | { ok: true; keys: string[] }
  | { ok: false };

async function fetchEntitlements(): Promise<EntitlementFetch> {
  try {
    const { data } = await apiClient.get<{ features: string[] }>('/entitlements');
    return { ok: true, keys: data.features };
  } catch {
    return { ok: false };
  }
}

async function fetchContexts(): Promise<ClinicContext[]> {
  try {
    const { data } = await apiClient.get<ContextListResponse>('/auth/contexts');
    return data.contexts;
  } catch {
    // Contexts have no similar cache-corruption risk (the shell reads them
    // to decide whether to render the switcher; missing = single-context UX,
    // which is the safe fallback).
    return [];
  }
}

function userFromToken(token: string): AuthUser | null {
  const claims = decodeJwt<JwtClaims>(token);
  if (!claims?.sub) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  // Read the cache for THIS tenant, not a global cache written by whoever
  // logged in last. Missing cache = empty set; the network fetch below
  // fills it, and a fetch failure leaves whatever was there before intact.
  const cached = localStorage.getItem(entitlementsKey(claims.tenantId));
  return {
    userId: claims.sub,
    email: localStorage.getItem(EMAIL_KEY),
    role: claims.role,
    tenantId: claims.tenantId,
    isPlatformAdmin: claims.isPlatformAdmin,
    organizationId: claims.organizationId ?? null,
    clinicId: claims.clinicId ?? null,
    branchId: claims.branchId ?? null,
    departmentId: claims.departmentId ?? null,
    membershipId: claims.membershipId ?? null,
    entitlements: new Set(cached ? JSON.parse(cached) as string[] : []),
  };
}

/** Persist entitlement keys, but ONLY if we successfully fetched them. */
function commitEntitlements(tenantId: string | null, result: EntitlementFetch): Set<string> | null {
  if (!result.ok) return null; // caller keeps whatever was already in state
  localStorage.setItem(entitlementsKey(tenantId), JSON.stringify(result.keys));
  return new Set(result.keys);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [contexts, setContexts] = useState<ClinicContext[]>([]);
  const [loading, setLoading] = useState(true);

  // Rehydrate the session from a persisted token on first load.
  useEffect(() => {
    const token = getToken();
    if (token) {
      const u = userFromToken(token);
      if (u) {
        setUser(u);
        if (!u.isPlatformAdmin) {
          Promise.all([fetchEntitlements(), fetchContexts()]).then(([ent, cx]) => {
            setContexts(cx);
            const fresh = commitEntitlements(u.tenantId, ent);
            // On failure, `fresh` is null and we DELIBERATELY do not touch
            // user.entitlements — the cache-derived set from userFromToken()
            // stays, so a one-off network blip does not collapse the sidebar
            // to the empty fallback the user was left staring at yesterday.
            if (fresh) {
              setUser((prev) => prev ? { ...prev, entitlements: fresh } : prev);
            }
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
      contexts,
      loading,
      async login(email, password) {
        const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
        setToken(data.accessToken);
        localStorage.setItem(EMAIL_KEY, email);
        const u = userFromToken(data.accessToken);
        if (!u) throw new Error('Received an invalid token');
        if (!u.isPlatformAdmin) {
          const [ent, cx] = await Promise.all([fetchEntitlements(), fetchContexts()]);
          setContexts(cx);
          const fresh = commitEntitlements(u.tenantId, ent);
          // On a fresh login, if entitlements fail to fetch, we honestly do
          // not know what this user can see. Empty is safer than stale, and
          // no cache exists for this tenant yet on this device. So an empty
          // set is the correct fallback here — and the fetch-error banner
          // will make the failure visible.
          u.entitlements = fresh ?? new Set();
        } else {
          setContexts([]);
        }
        setUser(u);
      },
      async switchContext(membershipId) {
        const { data } = await apiClient.post<{ accessToken: string }>('/auth/switch-context', {
          membershipId,
        });
        setToken(data.accessToken);
        const u = userFromToken(data.accessToken);
        if (!u) throw new Error('Received an invalid token');
        if (!u.isPlatformAdmin) {
          const [ent, cx] = await Promise.all([fetchEntitlements(), fetchContexts()]);
          setContexts(cx);
          const fresh = commitEntitlements(u.tenantId, ent);
          // After a switch, u.entitlements comes from userFromToken(), which
          // has already read the per-tenant cache for the destination clinic.
          // If the fetch succeeded, replace it with the fresh values.
          if (fresh) u.entitlements = fresh;
        }
        setUser(u);
      },
      logout() {
        clearToken();
        localStorage.removeItem(EMAIL_KEY);
        // Only clear this user's per-tenant cache. Any other tenant's cache
        // stays valid — another user on the same device is a legitimate case
        // and their cached bundle is theirs, not this one's to wipe.
        if (user?.tenantId != null) {
          localStorage.removeItem(entitlementsKey(user.tenantId));
        }
        setContexts([]);
        setUser(null);
      },
    }),
    [user, contexts, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
