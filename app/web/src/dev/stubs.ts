/**
 * Dev-time HTTP stubs.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Universal Clinic SaaS audit found 108 static HTML files with ZERO
 * network calls — mockups that looked like the product without being it.
 * Building the platform-admin dashboard UI-first risks the same trap: a
 * screen that renders beautifully in isolation, fails on the first click
 * against the real API, and gets counted as delivered while nothing
 * downstream can consume it.
 *
 * These stubs are the guardrail. When VITE_STUB_API=1 is set, the axios
 * instance's ADAPTER is swapped for one that matches request paths to
 * the handlers below. Requests that would otherwise go over /api go
 * nowhere and return the contract-shaped body — matching the SAME
 * TypeScript interfaces the real UI code reads, matching the SAME
 * Markdown contracts the backend will implement.
 *
 * Two invariants:
 *
 *   1. Every path with a stub matches its docs/contracts/*.md file
 *      character for character on the response shape. The whole point
 *      is that swapping the stub for the real backend needs zero UI
 *      changes.
 *
 *   2. An UNSTUBBED request PASSES THROUGH to the real API. This is
 *      what makes UI-first credible instead of a fantasy: everything
 *      not yet stubbed uses the real (or reverse-proxied) backend, so
 *      the mode is "stub the new endpoints, keep the rest real".
 *
 * Turned off by default. Real users on Railway never see this code —
 * `import.meta.env.VITE_STUB_API` is 'undefined' in production builds
 * unless the build is invoked with the flag set.
 */
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from '../api/client';
import type {
  ClinicDistribution,
  OnboardingActivityResponse,
  PlatformHealth,
  PlatformSummary,
  PopularModulesResponse,
  TenantListResponse,
} from '../api/contracts/platform';

// A handler receives the request and either returns a body (shape matching
// the contract), or `undefined` to signal "not mine — fall through to the
// real adapter". `null` is a legitimate response body, so it is different
// from "unhandled".
type StubResult = { body: unknown; status?: number } | undefined;
type StubHandler = (req: AxiosRequestConfig) => StubResult | Promise<StubResult>;

// --- Handlers -------------------------------------------------------------

const summary: StubHandler = () => ({
  body: <PlatformSummary>{
    period: { from: '2026-08-01', to: '2026-08-31' },
    comparedTo: { from: '2026-07-01', to: '2026-07-31' },
    organizations: { count: 128, deltaPct: 12.5 },
    clinics: { count: 356, deltaPct: 15.3 },
    activeSubs: { count: 295, deltaPct: 9.8 },
    mrr: { pkr: 24854000, deltaPct: 18.7 },
  },
});

const clinicDistribution: StubHandler = () => ({
  body: <ClinicDistribution>{
    total: 356,
    buckets: [
      { key: 'DERMATOLOGY',   label: 'Dermatology',      count: 100, pct: 28.1 },
      { key: 'DENTAL',        label: 'Dental',           count:  86, pct: 24.2 },
      { key: 'PEDIATRICS',    label: 'Pediatric',        count:  64, pct: 18.0 },
      { key: 'GENERAL',       label: 'General Practice', count:  57, pct: 16.0 },
      { key: 'PHYSIOTHERAPY', label: 'Physiotherapy',    count:  49, pct: 13.7 },
    ],
  },
});

const tenantsList: StubHandler = (req) => {
  const url = new URL(req.url ?? '', 'http://x');
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 10)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

  const seed = [
    { name: 'Skinfinity Clinics',       edition: 'DERMATOLOGY',   patients: 337, users: 12, branches: 8 },
    { name: 'Bright Smile Dental',      edition: 'DENTAL',        patients: 512, users: 18, branches: 12 },
    { name: 'KidsCare Pediatrics',      edition: 'PEDIATRICS',    patients: 289, users:  9, branches:  6 },
    { name: 'HealthPlus Family Clinic', edition: 'GENERAL',       patients: 921, users: 34, branches: 15 },
    { name: 'MoveWell Physiotherapy',   edition: 'PHYSIOTHERAPY', patients: 173, users:  7, branches:  5 },
  ];
  const rows = seed.slice(offset, offset + limit).map((r, i) => ({
    id: `stub-${offset + i}`,
    name: r.name,
    slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    edition: r.edition,
    status: 'ACTIVE',
    patients: r.patients,
    users: r.users,
    branches: r.branches,
    modules: [
      { key: 'appointments.core', label: 'Appointments' },
      { key: 'patients.core',     label: 'Patients' },
      { key: 'emr.core',          label: 'EMR' },
      { key: 'billing.core',      label: 'Billing' },
    ],
    createdAt: '2025-11-14T09:00:00.000Z',
  }));
  return { body: <TenantListResponse>{ total: 128, limit, offset, rows } };
};

const onboardingActivity: StubHandler = (req) => {
  const url = new URL(req.url ?? '', 'http://x');
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') ?? 5)));
  const all: OnboardingActivityResponse['rows'] = [
    { tenantId: 't-1', name: 'HealthFirst Clinic',      edition: 'GENERAL',       branches: 2, createdAt: '2026-05-31T05:24:00.000Z', kind: 'TENANT_CREATED' },
    { tenantId: 't-2', name: 'SmileWorks Dental',       edition: 'DENTAL',        branches: 3, createdAt: '2026-05-30T10:18:00.000Z', kind: 'TENANT_CREATED' },
    { tenantId: 't-3', name: 'Restore Physiotherapy',   edition: 'PHYSIOTHERAPY', branches: 1, createdAt: '2026-05-30T06:07:00.000Z', kind: 'TENANT_CREATED' },
    { tenantId: 't-4', name: 'LittleSteps Pediatrics',  edition: 'PEDIATRICS',    branches: 2, createdAt: '2026-05-29T11:42:00.000Z', kind: 'TENANT_CREATED' },
    { tenantId: 't-5', name: 'DermaGlow Skin Clinic',   edition: 'DERMATOLOGY',   branches: 1, createdAt: '2026-05-29T04:15:00.000Z', kind: 'TENANT_CREATED' },
  ];
  return { body: <OnboardingActivityResponse>{ rows: all.slice(0, limit) } };
};

const popularModules: StubHandler = () => ({
  body: <PopularModulesResponse>{
    modules: [
      { key: 'appointments.core', label: 'Appointments',        activeClinics: 356 },
      { key: 'patients.core',     label: 'Patient Management',  activeClinics: 349 },
      { key: 'billing.core',      label: 'Billing & Invoicing', activeClinics: 321 },
      { key: 'emr.core',          label: 'EMR',                 activeClinics: 297 },
      { key: 'pharmacy.core',     label: 'Inventory',           activeClinics: 223 },
      { key: 'reporting.core',    label: 'Reports & Analytics', activeClinics: 210 },
      { key: 'integrations.core', label: 'Telehealth',          activeClinics: 156 },
      { key: 'crm.core',          label: 'CRM',                 activeClinics: 134 },
    ],
  },
});

// --- Auth handlers, only for stub mode --------------------------------------
//
// The dashboard is behind auth. In stub mode there is no backend to log in
// against, so we mint a token here — the app never verifies the signature
// (decodeJwt at client.ts just base64-decodes the payload). This makes stub
// mode self-contained: any credentials log you in as a platform admin, and
// the dashboard's downstream stubbed endpoints render.

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stubJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.stub`;
}

const login: StubHandler = () => {
  const now = Math.floor(Date.now() / 1000);
  const token = stubJwt({
    sub: '00000000-0000-4000-8000-stubadmin0000',
    tenantId: null,
    role: 'PLATFORM_ADMIN',
    isPlatformAdmin: true,
    iat: now,
    exp: now + 60 * 60 * 8,
  });
  return { body: { accessToken: token } };
};

// Platform admin: no per-tenant entitlements, no contexts. Both endpoints
// still need to answer so AuthContext's rehydrate path does not throw.
const entitlements: StubHandler = () => ({ body: { features: [] } });
const contexts: StubHandler = () => ({ body: { contexts: [] } });

const health: StubHandler = () => ({
  body: <PlatformHealth>{
    status: 'healthy',
    checks: [
      { key: 'db',      label: 'Database',     status: 'healthy', note: null },
      { key: 'storage', label: 'Object store', status: 'healthy', note: null },
      { key: 'queue',   label: 'Job queue',    status: 'healthy', note: null },
    ],
    lastCheckedAt: new Date().toISOString(),
  },
});

// The route table is a list of tuples rather than a Map because pattern
// matching is done longest-prefix, not exact. `/platform/tenants?limit=…`
// must match `/platform/tenants`.
const routes: Array<[method: string, pathPrefix: string, handler: StubHandler]> = [
  // Auth — so stub mode is self-contained. Any credentials log in.
  ['POST', '/auth/login',                    login],
  ['GET',  '/entitlements',                  entitlements],
  ['GET',  '/auth/contexts',                 contexts],

  // Platform dashboard endpoints, all with docs/contracts/*.md counterparts.
  ['GET', '/platform/summary',              summary],
  ['GET', '/platform/clinic-distribution',  clinicDistribution],
  ['GET', '/platform/tenants',              tenantsList],
  ['GET', '/platform/onboarding-activity',  onboardingActivity],
  ['GET', '/platform/popular-modules',      popularModules],
  ['GET', '/platform/health',               health],
];

/** Route lookup: strip the querystring before comparing. */
function findHandler(method: string, url: string): StubHandler | null {
  const path = url.split('?')[0];
  const m = method.toUpperCase();
  for (const [rm, prefix, h] of routes) {
    if (rm === m && path === prefix) return h;
  }
  return null;
}

/**
 * Install the stub adapter, replacing the axios default. Requests that
 * match a stub route return the stub body; anything else is delegated
 * to the ORIGINAL adapter, so real endpoints stay real.
 */
export function installDevStubs(): void {
  const original = apiClient.defaults.adapter as AxiosAdapter | undefined;
  const stubbed: AxiosAdapter = async (config) => {
    const handler = findHandler(config.method ?? 'get', config.url ?? '');
    if (!handler) {
      if (!original) {
        // No prior adapter registered: fall through to axios's own default.
        // This branch is exercised in Vite where the DEFAULT adapter is
        // xhr — we do not want to disable real requests, only shadow the
        // stubbed subset.
        const { default: axios } = await import('axios');
        return (axios.getAdapter('xhr') as AxiosAdapter)(config);
      }
      return original(config);
    }
    const result = await handler(config);
    if (result === undefined) {
      // Handler decided not to handle after all — fall through.
      if (original) return original(config);
      const { default: axios } = await import('axios');
      return (axios.getAdapter('xhr') as AxiosAdapter)(config);
    }
    const status = result.status ?? 200;
    const res: AxiosResponse = {
      data: result.body,
      status,
      statusText: '',
      headers: {},
      config,
    };
    // eslint-disable-next-line no-console
    console.info(`[stub] ${config.method?.toUpperCase()} ${config.url} → ${status}`);
    if (status >= 400) {
      const err = new Error(`Request failed with status code ${status}`) as Error & {
        isAxiosError: boolean;
        config: AxiosRequestConfig;
        response: AxiosResponse;
      };
      err.isAxiosError = true;
      err.config = config;
      err.response = res;
      throw err;
    }
    return res;
  };
  apiClient.defaults.adapter = stubbed;
  // eslint-disable-next-line no-console
  console.info(
    `[stub] Dev stubs installed for ${routes.length} route(s). ` +
      'Unstubbed requests still hit the real API.',
  );
}
