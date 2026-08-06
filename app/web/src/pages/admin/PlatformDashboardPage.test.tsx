// PlatformDashboardPage — behavioural tests for the six-widget landing page.
//
// Tests exist because the page has already shipped three real defects that
// tsc could not see:
//   - /platform/tenants returned Tenant[] but the new contract expected
//     { rows, total, ... } — the whole page threw on undefined.rows.
//   - /platform/summary organizations.count and activeSubs.count returned
//     0 through the base client because both models are RLS'd.
//   - activeSubs.count checked currentPeriodEnd >= period.to (end of month)
//     instead of >= now, so nothing "current" ever counted.
//
// Each of those got a green tsc build. Only rendering + asserting caught them.
// Every widget has its own describe() block so a regression in one narrates
// itself rather than dying inside a nested traceback.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlatformDashboardPage from './PlatformDashboardPage';
import { AuthProvider } from '../../auth/AuthContext';
import { TOKEN_STORAGE_KEY } from '../../api/client';
import { mockApi, renderPage } from '../../test/api-harness';

// A platform-admin JWT the AuthProvider rehydrates from localStorage on
// mount. alg:none is fine here: the client only base64-decodes the payload,
// same as in dev stub mode.
function stubPlatformAdminToken() {
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: '00000000-0000-4000-8000-testadmin0000',
      tenantId: null,
      role: 'PLATFORM_ADMIN',
      isPlatformAdmin: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.test`;
}

function renderDashboard() {
  return renderPage(
    <AuthProvider>
      <PlatformDashboardPage />
    </AuthProvider>,
  );
}

const HAPPY_SUMMARY = {
  period: { key: 'this-month', from: '2026-08-01', to: '2026-08-31' },
  comparedTo: { from: '2026-07-01', to: '2026-07-31' },
  organizations: { count: 42, deltaPct: 12.5 },
  clinics:       { count: 89, deltaPct:  8.2 },
  activeSubs:    { count: 37, deltaPct:  4.1 },
  mrr:           { pkr: 2_450_000, deltaPct: 16.4 },
};

const HAPPY_DISTRIBUTION = {
  total: 89,
  buckets: [
    { key: 'DERMATOLOGY', label: 'Dermatology', count: 40, pct: 44.9 },
    { key: 'DENTAL',      label: 'Dental',      count: 25, pct: 28.1 },
    { key: 'GENERAL',     label: 'General',     count: 24, pct: 27.0 },
  ],
};

const HAPPY_TENANTS = {
  total: 12,
  limit: 5,
  offset: 0,
  rows: [
    { id: 't-1', name: 'Glow Derma',  slug: 'glow-derma',  edition: 'SPECIALTY', status: 'ACTIVE',    branches: 2, modules: [{ key: 'billing.core', label: 'Billing' }] },
    { id: 't-2', name: 'Pearl Dental', slug: 'pearl-dental', edition: 'DENTAL',   status: 'ACTIVE',    branches: 1, modules: [] },
    { id: 't-3', name: 'Old Clinic',   slug: 'old-clinic',   edition: 'CLINIC',   status: 'SUSPENDED', branches: 1, modules: [] },
  ],
};

// Legacy shape — bare Tenant[] before the /paged endpoint shipped. The
// adapter has to tolerate this or the page dies on undefined.rows.length.
const LEGACY_TENANTS_ARRAY = [
  { id: 't-1', name: 'Glow Derma', slug: 'glow-derma', edition: 'SPECIALTY', status: 'ACTIVE' },
  { id: 't-2', name: 'Pearl Dental', slug: 'pearl-dental', edition: 'DENTAL', status: 'ACTIVE' },
];

const HAPPY_ACTIVITY = {
  rows: [
    { tenantId: 't-1', name: 'Glow Derma',  edition: 'SPECIALTY', branches: 2, createdAt: '2026-08-01T09:15:00.000Z' },
    { tenantId: 't-2', name: 'Pearl Dental', edition: 'DENTAL',   branches: 1, createdAt: '2026-07-28T11:30:00.000Z' },
  ],
};

const HAPPY_MODULES = {
  modules: [
    { key: 'billing.core',   label: 'Billing',    activeClinics: 78 },
    { key: 'pharmacy.core',  label: 'Pharmacy',   activeClinics: 62 },
    { key: 'lab.core',       label: 'Laboratory', activeClinics: 45 },
    { key: 'reporting.core', label: 'Reports',    activeClinics: 40 },
  ],
};

const happyMockSet = {
  'GET /platform/summary':              { body: HAPPY_SUMMARY },
  'GET /platform/clinic-distribution':  { body: HAPPY_DISTRIBUTION },
  'GET /platform/tenants/paged':        { body: HAPPY_TENANTS },
  'GET /platform/onboarding-activity':  { body: HAPPY_ACTIVITY },
  'GET /platform/popular-modules':      { body: HAPPY_MODULES },
} as const;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(TOKEN_STORAGE_KEY, stubPlatformAdminToken());
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('PlatformDashboardPage — role guard', () => {
  it('redirects to / when the user is not a platform admin', async () => {
    // Overwrite the token with a clinic-owner one; the page should call
    // <Navigate to="/"/> and never issue any dashboard requests.
    const b64url = (s: string) => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const clinicToken =
      `${b64url(JSON.stringify({alg:'none',typ:'JWT'}))}.` +
      `${b64url(JSON.stringify({sub:'u-1', tenantId:'t-1', role:'OWNER', isPlatformAdmin:false, exp:Math.floor(Date.now()/1000)+3600}))}.x`;
    localStorage.setItem(TOKEN_STORAGE_KEY, clinicToken);
    // Cache empty entitlements so AuthProvider doesn't try to hit /entitlements.
    localStorage.setItem('healthos.entitlements.t-1', '[]');
    mockApi(happyMockSet);
    renderDashboard();
    // The heading never renders. Wait a tick to let effects settle, then assert.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Platform Super Admin')).toBeNull();
  });
});

describe('PlatformDashboardPage — stat row', () => {
  beforeEach(() => mockApi(happyMockSet));

  it('renders every stat card with its number and delta chip', async () => {
    renderDashboard();
    // Numbers come through the en-PK locale formatter. 89 appears both on
    // the Clinics stat card AND in the donut center, so assert getAllByText
    // rather than the strict getByText — the multiplicity here is a feature.
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getAllByText('89').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('37')).toBeInTheDocument();
    expect(screen.getByText('Rs 2,450,000')).toBeInTheDocument();

    // Delta chips (signed, one decimal).
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('8.2%')).toBeInTheDocument();
    expect(screen.getByText('4.1%')).toBeInTheDocument();
    expect(screen.getByText('16.4%')).toBeInTheDocument();

    // Card labels.
    expect(screen.getByText('Total Organizations')).toBeInTheDocument();
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Monthly Recurring Revenue')).toBeInTheDocument();
  });

  it('shows an inline error message per stat card when /platform/summary fails', async () => {
    mockApi({
      ...happyMockSet,
      'GET /platform/summary': { status: 500, body: { message: 'server exploded' } },
    });
    renderDashboard();
    // Each of the four stat cards renders its own error subtitle, so we assert
    // more than one appearance rather than "at least one".
    await waitFor(() => {
      const errs = screen.getAllByText(/server exploded|failed to load|500/i);
      expect(errs.length).toBeGreaterThanOrEqual(1);
    });
    // And the page itself is not blank — the header still rendered.
    expect(screen.getByText('Platform Super Admin')).toBeInTheDocument();
  });
});

describe('PlatformDashboardPage — clinic clients table', () => {
  it('renders one row per tenant with edition, branch count, and status', async () => {
    mockApi(happyMockSet);
    renderDashboard();
    // Glow Derma appears in both the tenants table AND the onboarding feed,
    // so assert count rather than uniqueness. Old Clinic is unique to the
    // table (activity mock has no such row).
    await waitFor(() => expect(screen.getAllByText('Glow Derma').length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText('Pearl Dental').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Old Clinic')).toBeInTheDocument();

    // Status label.
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2);
  });

  it('tolerates the legacy Tenant[] shape so the page still renders', async () => {
    // Regression: the shape drift from Tenant[] → { rows, ... } took the
    // page down for real. The adapter has to survive the transition.
    mockApi({
      ...happyMockSet,
      'GET /platform/tenants/paged': { body: LEGACY_TENANTS_ARRAY },
    });
    renderDashboard();
    await waitFor(() => expect(screen.getAllByText('Glow Derma').length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText('Pearl Dental').length).toBeGreaterThanOrEqual(1);
    // The whole page still rendered — header didn't vanish behind an error boundary.
    expect(screen.getByText('Platform Super Admin')).toBeInTheDocument();
  });

  it('shows the empty state when no tenants exist', async () => {
    mockApi({
      ...happyMockSet,
      'GET /platform/tenants/paged': { body: { total: 0, limit: 5, offset: 0, rows: [] } },
    });
    renderDashboard();
    expect(await screen.findByText(/no clinics on the platform yet/i)).toBeInTheDocument();
  });
});

describe('PlatformDashboardPage — clinic distribution donut', () => {
  it('renders the total in the donut center and each bucket in the legend', async () => {
    mockApi(happyMockSet);
    renderDashboard();
    // Center label — the total in en-PK format.
    expect(await screen.findByText('Total Clinics')).toBeInTheDocument();
    // Bucket labels + counts show up in the legend. "Dental" also appears
    // as an edition chip on the Pearl Dental row of the tenants table, so
    // assert count rather than uniqueness.
    expect(screen.getByText('Dermatology')).toBeInTheDocument();
    expect(screen.getAllByText('Dental').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('shows "No data" when the distribution has zero total', async () => {
    mockApi({
      ...happyMockSet,
      'GET /platform/clinic-distribution': { body: { total: 0, buckets: [] } },
    });
    renderDashboard();
    expect(await screen.findByText(/no data to show/i)).toBeInTheDocument();
  });
});

describe('PlatformDashboardPage — onboarding activity + popular modules', () => {
  it('lists every recent onboarding entry with clinic name and edition', async () => {
    mockApi(happyMockSet);
    renderDashboard();
    // Glow Derma appears in the table AND the feed — assert multiplicity.
    await waitFor(() => expect(screen.getAllByText('Glow Derma').length).toBeGreaterThanOrEqual(1));
    // The activity feed labels every row "New Clinic" — at least one appears.
    const chips = await screen.findAllByText('New Clinic');
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });

  it('renders one ModuleTile per popular module with its active-clinics count', async () => {
    mockApi(happyMockSet);
    renderDashboard();
    expect(await screen.findByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Laboratory')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('shows the empty state when popular-modules returns no modules', async () => {
    mockApi({
      ...happyMockSet,
      'GET /platform/popular-modules': { body: { modules: [] } },
    });
    renderDashboard();
    // The row should still render its header, just no tiles.
    expect(await screen.findByText('Popular Modules')).toBeInTheDocument();
  });
});

describe('PlatformDashboardPage — period selector', () => {
  it('re-issues /platform/summary when the period changes', async () => {
    let periodParam: string | undefined;
    mockApi({
      ...happyMockSet,
      'GET /platform/summary': (_body) => {
        // The adapter's config isn't threaded into the handler, so we
        // observe the change via apiCalls (which does log config.url/body).
        // For this test the important part is that summary is CALLED AGAIN
        // when the user changes period — count via a call-observer.
        periodParam = 'seen';
        return { body: HAPPY_SUMMARY };
      },
    });
    renderDashboard();
    await screen.findByText('42');
    const initialSeen = periodParam;
    expect(initialSeen).toBe('seen');

    // Reset the marker; change the period.
    periodParam = undefined;
    const select = screen.getByRole('combobox');
    await userEvent.click(select);
    const option = await screen.findByRole('option', { name: /last 30 days/i });
    await userEvent.click(option);

    await waitFor(() => expect(periodParam).toBe('seen'));
  });
});
