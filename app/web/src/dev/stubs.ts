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
import type {
  AppointmentsTodayResponse,
  CrmFunnel,
  DashboardToday,
  DoctorEarningsResponse,
  LeadSourcesResponse,
  QueueResponse,
  RecentEncountersResponse,
  RevenueSplit,
  SessionsInProgressResponse,
  StockAlertsResponse,
} from '../api/contracts/clinic-ops';

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

// --- Clinic ops handlers ---------------------------------------------------
// Every one of these matches its docs/contracts/*.md counterpart. Some
// document data models that don't exist yet (Room, TreatmentSession,
// CommissionEarning). Those endpoints, in a real backend, return the empty
// state until the model lands; here we return plausible fixture data so the
// UI-first design work has something to render against.

const dashboardToday: StubHandler = () => ({
  body: <DashboardToday>{
    generatedAt: new Date().toISOString(),
    todayLocal: new Date().toISOString().slice(0, 10),
    appointmentsToday:  { count: 28,     deltaPct: 12.0 },
    activePatients:     { count: 1245,   deltaPct:  8.6 },
    revenueThisMonth:   { pkr:   843200, deltaPct: 16.4 },
    outstandingBalance: { pkr:   187500, deltaPct:  6.3 },
  },
});

// Times are derived from "now" so the demo always looks fresh regardless of
// when it's rendered. The fixture uses PKT-shaped times (UTC+5) so the UI's
// HH:mm formatting lands in a sensible morning-slot layout.
function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setUTCHours(hour - 5, minute, 0, 0);
  return d.toISOString();
}

const appointmentsToday: StubHandler = () => ({
  body: <AppointmentsTodayResponse>{
    todayLocal: new Date().toISOString().slice(0, 10),
    rows: [
      { id: 'a-1', start: todayAt(9,30),  end: todayAt(10,0),  durationMin: 30, status: 'IN_PROGRESS',
        patient: { id: 'p-1', name: 'Sarah Johnson',  mrn: 'GD-0044' },
        provider:{ id: 'u-1', name: 'Dr. Emily Carter' },
        service: { id: 'sc-1', label: 'HydraFacial MD' }, roomLabel: 'Room 1' },
      { id: 'a-2', start: todayAt(10,0),  end: todayAt(10,45), durationMin: 45, status: 'CONFIRMED',
        patient: { id: 'p-2', name: 'Michael Brown',  mrn: 'GD-0045' },
        provider:{ id: 'u-2', name: 'Dr. James Wilson' },
        service: { id: 'sc-2', label: 'Laser Hair Removal' }, roomLabel: 'Room 2' },
      { id: 'a-3', start: todayAt(10,45), end: todayAt(11,15), durationMin: 30, status: 'BOOKED',
        patient: { id: 'p-3', name: 'Priya Sharma',   mrn: 'GD-0046' },
        provider:{ id: 'u-1', name: 'Dr. Emily Carter' },
        service: { id: 'sc-3', label: 'Chemical Peel' }, roomLabel: 'Room 1' },
      { id: 'a-4', start: todayAt(11,30), end: todayAt(12,30), durationMin: 60, status: 'BOOKED',
        patient: { id: 'p-4', name: 'Aisha Patel',    mrn: 'GD-0047' },
        provider:{ id: 'u-2', name: 'Dr. James Wilson' },
        service: { id: 'sc-4', label: 'PRP Hair Restoration' }, roomLabel: 'Room 2' },
      { id: 'a-5', start: todayAt(13,30), end: todayAt(14,0),  durationMin: 30, status: 'BOOKED',
        patient: { id: 'p-5', name: 'David Lee',      mrn: 'GD-0048' },
        provider:{ id: 'u-1', name: 'Dr. Emily Carter' },
        service: { id: 'sc-5', label: 'Botox — Forehead' }, roomLabel: 'Room 1' },
    ],
  },
});

const sessionsInProgress: StubHandler = () => ({
  body: <SessionsInProgressResponse>{
    asOf: new Date().toISOString(),
    rooms: [
      { roomId: 'r-1', roomLabel: 'Room 1', session: {
        id: 's-1', patient: { id: 'p-1', name: 'Sarah Johnson', mrn: 'GD-0044' },
        service: 'HydraFacial MD', startedAt: todayAt(9,30),
        expectedDurationMin: 30, elapsedMin: 15, remainingMin: 15, progressPct: 50, status: 'IN_PROGRESS' } },
      { roomId: 'r-2', roomLabel: 'Room 2', session: {
        id: 's-2', patient: { id: 'p-2', name: 'Michael Brown', mrn: 'GD-0045' },
        service: 'Laser Hair Removal', startedAt: todayAt(9,20),
        expectedDurationMin: 45, elapsedMin: 25, remainingMin: 20, progressPct: 55.6, status: 'IN_PROGRESS' } },
      { roomId: 'r-3', roomLabel: 'Room 3', session: {
        id: 's-3', patient: { id: 'p-6', name: 'Neha Reddy',    mrn: 'GD-0049' },
        service: 'Microneedling', startedAt: todayAt(9,5),
        expectedDurationMin: 40, elapsedMin: 40, remainingMin: 0, progressPct: 100, status: 'IN_PROGRESS' } },
      { roomId: 'r-4', roomLabel: 'Room 4', session: {
        id: 's-4', patient: { id: 'p-7', name: 'Ananya Singh',  mrn: 'GD-0050' },
        service: 'Laser Toning', startedAt: todayAt(9,35),
        expectedDurationMin: 30, elapsedMin: 10, remainingMin: 20, progressPct: 33.3, status: 'IN_PROGRESS' } },
      { roomId: 'r-5', roomLabel: 'Room 5', session: {
        id: 's-5', patient: { id: 'p-8', name: 'Amit Verma',    mrn: 'GD-0051' },
        service: 'PRP Hair Restoration', startedAt: todayAt(9,45),
        expectedDurationMin: 60, elapsedMin: 15, remainingMin: 45, progressPct: 25, status: 'IN_PROGRESS' } },
    ],
  },
});

const encountersRecent: StubHandler = () => ({
  body: <RecentEncountersResponse>{
    rows: [
      { id: 'e-1', patient: { id: 'p-6', name: 'Neha Reddy',   mrn: 'GD-0049' },
        provider: { id: 'u-1', name: 'Dr. Emily Carter' }, occurredAt: todayAt(11,15),
        concern: 'Acne scars',   recommendation: 'Microneedling + PRP' },
      { id: 'e-2', patient: { id: 'p-7', name: 'Ananya Singh', mrn: 'GD-0050' },
        provider: { id: 'u-2', name: 'Dr. James Wilson' }, occurredAt: todayAt(10,50),
        concern: 'Skin brightening', recommendation: 'Chemical Peel' },
      { id: 'e-3', patient: { id: 'p-9', name: 'Rohan Mehta',  mrn: 'GD-0052' },
        provider: { id: 'u-1', name: 'Dr. Emily Carter' }, occurredAt: todayAt(10,20),
        concern: 'Hair thinning', recommendation: 'PRP + Minoxidil' },
      { id: 'e-4', patient: { id: 'p-10',name: 'Kavya Iyer',   mrn: 'GD-0053' },
        provider: { id: 'u-2', name: 'Dr. James Wilson' }, occurredAt: todayAt(9,45),
        concern: 'Pigmentation',  recommendation: 'Laser Toning' },
      { id: 'e-5', patient: { id: 'p-11',name: 'Vikram Joshi', mrn: 'GD-0054' },
        provider: { id: 'u-1', name: 'Dr. Emily Carter' }, occurredAt: todayAt(9,10),
        concern: 'Fine lines',    recommendation: 'Botox' },
    ],
  },
});

const revenueSplit: StubHandler = () => ({
  body: <RevenueSplit>{
    period: { from: '2026-08-01', to: '2026-08-31' },
    totalPkr:  843200,
    clinicPkr: 505920,
    clinicPct: 60.0,
    doctorPkr: 337280,
    doctorPct: 40.0,
  },
});

const stockAlerts: StubHandler = () => ({
  body: <StockAlertsResponse>{
    rows: [
      { id: 'st-1', name: 'Botox 100U',        unit: 'vial', onHand: 1, reorderAt: 3,  severity: 'critical', note: '1 vial left' },
      { id: 'st-2', name: 'Juvederm Ultra 4',  unit: 'box',  onHand: 2, reorderAt: 5,  severity: 'low',      note: '2 boxes left' },
      { id: 'st-3', name: 'PRP Kits',          unit: 'kit',  onHand: 3, reorderAt: 5,  severity: 'low',      note: '3 kits left' },
      { id: 'st-4', name: 'Numbing Cream',     unit: 'tube', onHand: 2, reorderAt: 8,  severity: 'critical', note: '2 units left' },
      { id: 'st-5', name: 'Microneedle Cartridges', unit: 'unit', onHand: 5, reorderAt: 10, severity: 'low', note: '5 units left' },
    ],
  },
});

const doctorEarnings: StubHandler = () => ({
  body: <DoctorEarningsResponse>{
    period: { from: new Date().toISOString().slice(0,10), to: new Date(Date.now()+86400000).toISOString().slice(0,10) },
    rows: [
      { userId: 'u-1', name: 'Dr. Emily Carter',  pkr: 18500, deltaPct: 15.4 },
      { userId: 'u-2', name: 'Dr. James Wilson',  pkr: 14200, deltaPct:  9.7 },
      { userId: 'u-3', name: 'Dr. Priya Nair',    pkr:  9800, deltaPct:  6.2 },
    ],
  },
});

const patientQueue: StubHandler = () => ({
  body: <QueueResponse>{
    asOf: new Date().toISOString(),
    rows: [
      { patient: { id: 'p-20', name: 'Riya Kapoor',    mrn: 'GD-0060' }, arrivedAt: todayAt(9,0),  waitedMin: 15, status: 'CHECKED_IN',   appointmentId: 'a-6', roomLabel: null },
      { patient: { id: 'p-21', name: 'Arjun Nair',     mrn: 'GD-0061' }, arrivedAt: todayAt(10,0), waitedMin: 12, status: 'WAITING',      appointmentId: 'a-7', roomLabel: null },
      { patient: { id: 'p-22', name: 'Meera Iyer',     mrn: 'GD-0062' }, arrivedAt: todayAt(10,30),waitedMin:  8, status: 'IN_PROGRESS',  appointmentId: 'a-8', roomLabel: 'Room 3' },
      { patient: { id: 'p-23', name: 'Siddharth Rao',  mrn: 'GD-0063' }, arrivedAt: todayAt(11,0), waitedMin:  6, status: 'IN_PROGRESS',  appointmentId: 'a-9', roomLabel: 'Room 4' },
      { patient: { id: 'p-24', name: 'Tanvi Desai',    mrn: 'GD-0064' }, arrivedAt: todayAt(11,30),waitedMin:  3, status: 'CONSULTATION', appointmentId: 'a-10',roomLabel: null },
      { patient: { id: 'p-25', name: 'Rahul Mehta',    mrn: 'GD-0065' }, arrivedAt: todayAt(12,0), waitedMin:  0, status: 'CHECKED_IN',   appointmentId: 'a-11',roomLabel: null },
    ],
  },
});

// The CRM funnel endpoint EXISTS on the backend already (returns byStatus).
// The stub matches that shape so the UI can render whether or not it hits
// the real backend behind the scenes.
const crmFunnel: StubHandler = () => ({
  body: <CrmFunnel>{
    total: 676,
    byStatus: { NEW: 245, CONTACTED: 189, QUALIFIED: 156, CONVERTED: 86, LOST: 0 },
    conversionRatePct: 13,
  },
});

// The SOURCE funnel (reference #4). Backend needs Lead.source normalization
// before this is real; the stub carries the reference's channel breakdown so
// the "By source" tab can be designed against contract-shaped data.
const crmLeadSources: StubHandler = () => ({
  body: <LeadSourcesResponse>{
    period: { from: '2026-08-01', to: '2026-08-31' },
    total: 676,
    rows: [
      { key: 'FACEBOOK',            label: 'Facebook Leads',       count: 245, deltaPct: 18.0 },
      { key: 'WHATSAPP',            label: 'WhatsApp Leads',       count: 189, deltaPct: 12.5 },
      { key: 'WEBSITE',             label: 'Website Leads',        count: 156, deltaPct:  9.3 },
      { key: 'CONSULTATION_BOOKED', label: 'Consultations Booked', count:  86, deltaPct: 14.8 },
    ],
    conversionRatePct: 18.5,
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
  ['GET', '/platform/tenants/paged',        tenantsList],
  ['GET', '/platform/onboarding-activity',  onboardingActivity],
  ['GET', '/platform/popular-modules',      popularModules],
  ['GET', '/platform/health',               health],

  // Clinic ops dashboard
  ['GET', '/dashboard/today',               dashboardToday],
  ['GET', '/appointments/today',            appointmentsToday],
  ['GET', '/sessions/in-progress',          sessionsInProgress],
  ['GET', '/encounters/recent',             encountersRecent],
  ['GET', '/reports/revenue-split',         revenueSplit],
  ['GET', '/pharmacy/stock/alerts',         stockAlerts],
  ['GET', '/reports/doctor-earnings',       doctorEarnings],
  ['GET', '/patients/queue',                patientQueue],
  ['GET', '/crm/funnel',                    crmFunnel],
  ['GET', '/crm/lead-sources',              crmLeadSources],
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
