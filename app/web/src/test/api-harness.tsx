// Test harness for pages that talk to the API.
//
// Pages are rendered against a FAKE axios adapter rather than a mocked module,
// so the request actually travels through the real `apiClient` — its baseURL,
// its auth interceptor, and (critically) its 401 interceptor. Mocking
// `apiClient.get` directly would skip all of that and let a page pass a test
// while failing against the real client.
//
// Errors are shaped the way Nest shapes them — `{statusCode, message, error}`
// under `response.data` — because the whole point of several of these tests is
// that the page shows the SERVER's sentence rather than a generic one it made
// up. A harness that returns a bare `Error` cannot tell those two apart.
import type { ReactElement } from 'react';
import type { AxiosRequestConfig } from 'axios';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { apiClient } from '../api/client';
import { resetFetchErrors } from '../api/fetchErrors';

export interface RouteHandler {
  status?: number;
  /** Body to return. For a non-2xx status this is the error body. */
  body?: unknown;
  /** Simulate an unreachable API: no response at all, like ECONNREFUSED. */
  networkError?: boolean;
}

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
type Key = `${Uppercase<Method>} ${string}`;

export interface ApiLog {
  method: string;
  url: string;
  body: unknown;
}

/** Every request the component under test actually made, in order. */
export const apiCalls: ApiLog[] = [];

let routes: Partial<Record<Key, RouteHandler | ((body: unknown) => RouteHandler)>> = {};

/**
 * Install the fake adapter. Keys are `"GET /patients"`. An unmatched request
 * FAILS the test rather than returning an empty object — a page quietly calling
 * an endpoint nobody stubbed is exactly the kind of thing worth knowing about.
 */
export function mockApi(map: typeof routes): void {
  routes = map;
  apiCalls.length = 0;
  resetFetchErrors();
  apiClient.defaults.adapter = async (config: AxiosRequestConfig) => {
    const method = (config.method ?? 'get').toUpperCase();
    const url = config.url ?? '';
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    apiCalls.push({ method, url, body });

    const entry = routes[`${method} ${url}` as Key];
    if (!entry) {
      throw new Error(
        `No stub for ${method} ${url}. Stubbed: ${Object.keys(routes).join(', ') || '(none)'}`,
      );
    }
    const h = typeof entry === 'function' ? entry(body) : entry;

    if (h.networkError) {
      // Axios reports an unreachable server as an error with NO `response`.
      // `describeError` distinguishes that from a 4xx, and the banner says
      // different things for each, so the difference has to survive the fake.
      const err = new Error('Network Error') as Error & { isAxiosError: boolean; config: unknown };
      err.isAxiosError = true;
      err.config = config;
      throw err;
    }

    const status = h.status ?? 200;
    const res = { data: h.body ?? {}, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      const err = new Error(`Request failed with status code ${status}`) as Error & {
        isAxiosError: boolean;
        response: unknown;
        config: unknown;
      };
      err.isAxiosError = true;
      err.response = res;
      err.config = config;
      throw err;
    }
    return res as never;
  };
}

/** A Nest-shaped error body, so pages are tested against the real wording. */
export function nestError(statusCode: number, message: string) {
  return { statusCode, message, error: statusCode === 409 ? 'Conflict' : 'Bad Request' };
}

const theme = createTheme();

/** Render a page with the providers the real AppShell supplies. */
export function renderPage(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>,
  );
}
