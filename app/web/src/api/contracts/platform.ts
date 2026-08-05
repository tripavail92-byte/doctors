/**
 * Platform-admin dashboard endpoints.
 *
 * These types are the shape the UI expects. They are also the shape the STUB
 * returns (dev-time, VITE_STUB_API=1) and the shape the BACKEND must implement.
 * A single source of truth avoids "the page reads x, the endpoint returns y"
 * — see PatientRecordPage's five dead sections for what that costs.
 *
 * Each type below has a matching Markdown contract at
 * docs/contracts/platform-*.md — read that for units, invariants, error
 * shapes, and the four UI states this type feeds.
 */

// --- GET /platform/summary --------------------------------------------------

export type SummaryPeriod = 'this-month' | 'last-30d' | 'last-90d' | 'ytd' | 'custom';

export interface SummaryDelta {
  count: number;
  /** Signed percentage vs the compared-to period. `null` when comparison unavailable. */
  deltaPct: number | null;
}

export interface SummaryMrr {
  /** Integer PKR (units of one rupee), matching every other billing surface. */
  pkr: number;
  deltaPct: number | null;
}

export interface PlatformSummary {
  period: { from: string; to: string };
  comparedTo: { from: string; to: string };
  organizations: SummaryDelta;
  clinics: SummaryDelta;
  activeSubs: SummaryDelta;
  mrr: SummaryMrr;
}

// --- GET /platform/clinic-distribution --------------------------------------

export interface DistributionBucket {
  /** Mirrors the Edition enum so the client-side colour lookup is stable. */
  key: string;
  label: string;
  count: number;
  /** count / total * 100, one decimal. May not sum to exactly 100. */
  pct: number;
}

export interface ClinicDistribution {
  total: number;
  buckets: DistributionBucket[];
}

// --- GET /platform/tenants --------------------------------------------------

export interface TenantListParams {
  limit?: number;   // 1–50, default 10
  offset?: number;  // default 0
  q?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

export interface TenantRowModule {
  key: string;
  label: string;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  edition: string;
  status: string;
  patients: number;
  users: number;
  branches: number;
  /** Up to 6 modules for the table's icon row. Ordered category-then-key. */
  modules: TenantRowModule[];
  createdAt: string;
}

export interface TenantListResponse {
  total: number;
  limit: number;
  offset: number;
  rows: TenantRow[];
}

// --- GET /platform/onboarding-activity --------------------------------------

export type OnboardingKind = 'TENANT_CREATED' | 'BRANCH_ADDED' | 'SUSPENDED';

export interface OnboardingActivityRow {
  tenantId: string;
  name: string;
  edition: string;
  branches: number;
  createdAt: string;
  kind: OnboardingKind;
}

export interface OnboardingActivityResponse {
  rows: OnboardingActivityRow[];
}

// --- GET /platform/popular-modules ------------------------------------------

export interface PopularModule {
  key: string;
  label: string;
  activeClinics: number;
}

export interface PopularModulesResponse {
  modules: PopularModule[];
}

// --- GET /platform/health ---------------------------------------------------

export type HealthLevel = 'healthy' | 'degraded' | 'down';

export interface HealthCheck {
  key: string;
  label: string;
  status: HealthLevel;
  note: string | null;
}

export interface PlatformHealth {
  status: HealthLevel;
  checks: HealthCheck[];
  lastCheckedAt: string;
}
