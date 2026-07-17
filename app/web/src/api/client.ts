import axios from 'axios';

// Shared axios instance for the Health OS API.
// baseURL '/api' is proxied to the NestJS backend by Vite in development
// (the proxy strips the /api prefix — see vite.config.ts).
export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Key under which the JWT access token is stored in localStorage.
export const TOKEN_STORAGE_KEY = 'healthos.accessToken';

export const getToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_STORAGE_KEY);

// Attach the JWT (if present) as a Bearer token on every outgoing request.
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On a 401 the token is stale/invalid — drop it and bounce to the login route.
// Guarded so we don't loop while already on /login.
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

/** Decode the payload segment of a JWT without verifying the signature. */
export function decodeJwt<T = unknown>(token: string): T | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))) as T;
  } catch {
    return null;
  }
}
