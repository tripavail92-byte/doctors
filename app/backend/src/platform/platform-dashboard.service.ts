import { Injectable, Logger } from '@nestjs/common';
import { Edition, TenantStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { FEATURES } from '../entitlements/editions';

/**
 * Aggregations for the platform-admin dashboard.
 *
 * WHY THIS SERVICE EXISTS SEPARATELY FROM PlatformTenantsService
 * --------------------------------------------------------------
 * PlatformTenantsService.list() is the flat-array endpoint TenantsPage.tsx
 * already consumes. This class is the aggregation surface the new dashboard
 * needs — different shape, different reads, different pagination. Splitting
 * them means the legacy read stays untouched and the new endpoints have a
 * home that can grow (search, filter, drill-down) without disturbing anyone.
 *
 * MULTI-TENANCY IN AGGREGATIONS
 * -----------------------------
 * Tenant, Plan, Subscription, TenantEntitlement carry no tenant_isolation
 * policy (they cross tenant boundaries by design — see rls.sql), so the base
 * client can read them freely. Patient / User / Encounter / etc. DO carry the
 * policy, and the "counts always zero" bug (fixed in aefe729) is the standing
 * evidence that a naked groupBy on the runtime role returns nothing. When
 * counting per-tenant business data, this service uses the same per-tenant
 * forTenant() pattern that fix established. Aggregations that only ever look
 * at Tenant/Plan/Subscription/TenantEntitlement stay on the base client.
 */

export type SummaryPeriod = 'this-month' | 'last-30d' | 'last-90d' | 'ytd' | 'custom';

interface Range {
  from: Date;
  to: Date;
}

@Injectable()
export class PlatformDashboardService {
  private readonly logger = new Logger(PlatformDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // GET /platform/summary — four stat cards
  // ---------------------------------------------------------------------------

  async summary(period: SummaryPeriod, customFrom?: string, customTo?: string) {
    const now = new Date();
    const [current, previous] = periodRanges(now, period, customFrom, customTo);

    // Every count is "as of the END of the period" for stock-style metrics
    // (organizations, clinics, active subs), and "created within the period"
    // for MRR (only counts subscriptions active at period end, priced from
    // their plan). Delta compares current to previous.

    // ----- Organizations: distinct orgs with at least one clinic link to an
    // ACTIVE tenant, "as-of" the end of the period.
    //
    // Both Organization AND OrganizationClinic are under RLS. A naked
    // organization.count() on the base client (no app.tenant_id set) fails
    // closed to zero — the exact "structurally-always-zero" trap this class
    // has been burned by three times now. The fix is to loop over active
    // tenants, read their linked orgs through forTenant(), and dedupe the
    // organizationId set. Small N (dozens of tenants), one indexed lookup
    // per tenant, no cross-tenant read on a bypassing role.
    const [orgCurrent, orgPrevious] = await Promise.all([
      this.distinctOrganizationsAsOf(current.to),
      this.distinctOrganizationsAsOf(previous.to),
    ]);

    // ----- Clinics (Tenant rows) — active only, as-of counts
    const clinicCurrent = await this.prisma.tenant.count({
      where: { createdAt: { lte: current.to }, status: TenantStatus.ACTIVE },
    });
    const clinicPrevious = await this.prisma.tenant.count({
      where: { createdAt: { lte: previous.to }, status: TenantStatus.ACTIVE },
    });

    // ----- Active subscriptions and MRR
    //
    // Subscription is under RLS — aggregated via forTenant() per tenant.
    //
    // "Active NOW" is the meaningful current-period value; "active at the
    // end of the last period" is the meaningful comparison. Using
    // current.to (a future instant) for the current value would exclude
    // subs that are active today but whose currentPeriodEnd falls before
    // period end — for a monthly clinic subscription mid-month, that is
    // exactly wrong. Real production bit: 3 ACTIVE subs each ending in ~2
    // weeks read as `0 active` before this fix.
    const [subCurrent, mrrCurrent, subPrevious, mrrPrevious] = await this.subscriptionsAndMrrAt(
      now,
      previous.to,
    );

    return {
      period: { from: iso(current.from), to: iso(current.to) },
      comparedTo: { from: iso(previous.from), to: iso(previous.to) },
      organizations: { count: orgCurrent, deltaPct: pctDelta(orgCurrent, orgPrevious) },
      clinics: { count: clinicCurrent, deltaPct: pctDelta(clinicCurrent, clinicPrevious) },
      activeSubs: { count: subCurrent, deltaPct: pctDelta(subCurrent, subPrevious) },
      mrr: { pkr: mrrCurrent, deltaPct: pctDelta(mrrCurrent, mrrPrevious) },
    };
  }

  /**
   * Count DISTINCT Organizations reachable through any ACTIVE tenant whose
   * clinic-link was created on or before `asOf`. Reads through forTenant() so
   * the RLS trap that returned zero on the base client cannot recur.
   */
  private async distinctOrganizationsAsOf(asOf: Date): Promise<number> {
    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.ACTIVE, createdAt: { lte: asOf } },
      select: { id: true },
    });
    const orgs = new Set<string>();
    await Promise.all(
      activeTenants.map(async (t) => {
        try {
          const links = await this.prisma.forTenant(t.id, (tx) =>
            tx.organizationClinic.findMany({
              where: { createdAt: { lte: asOf } },
              select: { organizationId: true },
            }),
          );
          for (const l of links) orgs.add(l.organizationId);
        } catch (e) {
          this.logger.warn(
            `distinctOrganizationsAsOf: failed for tenant ${t.id}: ${(e as Error).message}`,
          );
        }
      }),
    );
    return orgs.size;
  }

  /**
   * Subscription count + MRR (whole PKR) as of two points in time.
   *
   * Returns [countAtA, mrrAtA, countAtB, mrrAtB] so the caller gets both
   * period ends from one pass over the tenants. Reads Subscription rows
   * through forTenant() — Subscription carries the tenant_isolation RLS
   * policy and a naked query on the base client returns zero.
   *
   * Plan is NOT tenant-scoped (rls.sql leaves it policy-less — plans are
   * global), so it can be joined once on the base client.
   */
  private async subscriptionsAndMrrAt(
    a: Date,
    b: Date,
  ): Promise<[number, number, number, number]> {
    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.ACTIVE },
      select: { id: true },
    });

    // Collect (planId, count) pairs at each cutoff across every tenant.
    // Aggregating in JS is negligible at N = dozens of tenants; when N
    // grows past a few hundred this becomes a SECURITY DEFINER aggregate.
    let countA = 0;
    let countB = 0;
    const planCountA = new Map<string, number>();
    const planCountB = new Map<string, number>();

    await Promise.all(
      activeTenants.map(async (t) => {
        try {
          const subs = await this.prisma.forTenant(t.id, (tx) =>
            tx.subscription.findMany({
              where: { status: 'ACTIVE' },
              select: { planId: true, currentPeriodEnd: true },
            }),
          );
          for (const s of subs) {
            if (s.currentPeriodEnd >= a) {
              countA += 1;
              planCountA.set(s.planId, (planCountA.get(s.planId) ?? 0) + 1);
            }
            if (s.currentPeriodEnd >= b) {
              countB += 1;
              planCountB.set(s.planId, (planCountB.get(s.planId) ?? 0) + 1);
            }
          }
        } catch (e) {
          this.logger.warn(
            `subscriptionsAndMrrAt: failed for tenant ${t.id}: ${(e as Error).message}`,
          );
        }
      }),
    );

    // Price the counts against Plan.pricePkr. Plan has no RLS.
    const allPlanIds = new Set([...planCountA.keys(), ...planCountB.keys()]);
    let mrrA = 0;
    let mrrB = 0;
    if (allPlanIds.size > 0) {
      const plans = await this.prisma.plan.findMany({
        where: { id: { in: [...allPlanIds] } },
        select: { id: true, pricePkr: true },
      });
      const priceById = new Map(plans.map((p) => [p.id, p.pricePkr]));
      for (const [planId, n] of planCountA) mrrA += n * (priceById.get(planId) ?? 0);
      for (const [planId, n] of planCountB) mrrB += n * (priceById.get(planId) ?? 0);
    }

    return [countA, mrrA, countB, mrrB];
  }

  // ---------------------------------------------------------------------------
  // GET /platform/clinic-distribution — donut
  // ---------------------------------------------------------------------------

  async clinicDistribution() {
    const rows = await this.prisma.tenant.groupBy({
      by: ['edition'],
      where: { status: TenantStatus.ACTIVE },
      _count: { _all: true },
    });
    const total = rows.reduce((s, r) => s + r._count._all, 0);

    const buckets = rows
      .filter((r) => r._count._all > 0)
      .map((r) => {
        const count = r._count._all;
        return {
          key: r.edition,
          label: editionLabel(r.edition),
          count,
          pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { total, buckets };
  }

  // ---------------------------------------------------------------------------
  // GET /platform/tenants — paginated with modules + branch counts
  // ---------------------------------------------------------------------------

  async tenants(limit = 10, offset = 0, q?: string, status?: TenantStatus) {
    // Belt-and-braces the DTO would enforce — reject junk here too.
    const take = Math.max(1, Math.min(50, Math.floor(limit)));
    const skip = Math.max(0, Math.floor(offset));

    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { slug: { contains: q, mode: 'insensitive' as const } }] }
        : {}),
    };
    const [total, tenants] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, slug: true, edition: true, status: true, createdAt: true },
        take,
        skip,
      }),
    ]);

    // Per-tenant counts + entitlements. Same forTenant() pattern that
    // PlatformTenantsService uses — the naked groupBy alternative returned
    // zero for weeks (fixed in aefe729).
    const rows = await Promise.all(
      tenants.map(async (t) => {
        try {
          return await this.prisma.forTenant(t.id, async (tx) => {
            const [patients, users, branches, ents] = await Promise.all([
              tx.patient.count(),
              tx.user.count(),
              tx.branch.count({ where: { isActive: true } }),
              tx.tenantEntitlement.findMany({ where: { enabled: true }, select: { featureKey: true } }),
            ]);
            const enabled = new Set(ents.map((e) => e.featureKey));
            const modules = FEATURES.filter((f) => enabled.has(f.key))
              .sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key))
              .slice(0, 6)
              .map((f) => ({ key: f.key, label: f.name }));
            return {
              ...t,
              patients,
              users,
              branches,
              modules,
              createdAt: iso(t.createdAt),
            };
          });
        } catch (e) {
          this.logger.error(
            `Failed to expand tenant ${t.id} (${t.slug}) for dashboard row: ` +
              (e instanceof Error ? e.message : String(e)),
          );
          return {
            ...t,
            patients: null as unknown as number,
            users: null as unknown as number,
            branches: null as unknown as number,
            modules: [] as { key: string; label: string }[],
            createdAt: iso(t.createdAt),
          };
        }
      }),
    );

    return { total, limit: take, offset: skip, rows };
  }

  // ---------------------------------------------------------------------------
  // GET /platform/onboarding-activity — recent feed
  // ---------------------------------------------------------------------------

  async onboardingActivity(limit = 5) {
    const take = Math.max(1, Math.min(20, Math.floor(limit)));
    // Sourced from Tenant.createdAt for now. When AuditLog carries a first-
    // class onboarding event, this reads from there and picks up BRANCH_ADDED
    // etc. for free — the contract's `kind` field is ready for it.
    const recent = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, name: true, slug: true, edition: true, createdAt: true },
    });

    // Per-tenant branch count. See the tenants() rationale — same reason.
    const rows = await Promise.all(
      recent.map(async (t) => {
        let branches = 0;
        try {
          branches = await this.prisma.forTenant(t.id, (tx) =>
            tx.branch.count({ where: { isActive: true } }),
          );
        } catch (e) {
          this.logger.warn(`onboardingActivity: branch count failed for ${t.slug}: ${(e as Error).message}`);
        }
        return {
          tenantId: t.id,
          name: t.name,
          edition: t.edition,
          branches,
          createdAt: iso(t.createdAt),
          kind: 'TENANT_CREATED' as const,
        };
      }),
    );

    return { rows };
  }

  // ---------------------------------------------------------------------------
  // GET /platform/popular-modules — top-8 tile grid
  // ---------------------------------------------------------------------------

  async popularModules() {
    // TenantEntitlement is tenant-scoped and carries the RLS tenant_isolation
    // policy — a naked findMany on the base client returns zero rows, same
    // "structurally-always-zero" trap that made the tenant patient/user
    // counts read 0 for weeks. Loop over ACTIVE tenants, read entitlements
    // inside forTenant() for each, then aggregate.
    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.ACTIVE },
      select: { id: true },
    });

    const counts = new Map<string, number>();
    await Promise.all(
      activeTenants.map(async (t) => {
        try {
          const rows = await this.prisma.forTenant(t.id, (tx) =>
            tx.tenantEntitlement.findMany({
              where: { enabled: true },
              select: { featureKey: true },
            }),
          );
          for (const r of rows) counts.set(r.featureKey, (counts.get(r.featureKey) ?? 0) + 1);
        } catch (e) {
          this.logger.warn(
            `popularModules: failed to read entitlements for tenant ${t.id}: ${(e as Error).message}`,
          );
        }
      }),
    );

    const labelFor = new Map(FEATURES.map((f) => [f.key, f.name]));
    const modules = [...counts.entries()]
      .map(([key, activeClinics]) => ({
        key,
        label: labelFor.get(key) ?? key,
        activeClinics,
      }))
      .sort((a, b) => b.activeClinics - a.activeClinics)
      .slice(0, 8);

    return { modules };
  }

  // ---------------------------------------------------------------------------
  // GET /platform/health — sidebar system-health card
  // ---------------------------------------------------------------------------

  async health() {
    const checks: Array<{ key: string; label: string; status: 'healthy' | 'degraded' | 'down'; note: string | null }> = [];

    // Database: SELECT 1. Fails => down.
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.push({ key: 'db', label: 'Database', status: 'healthy', note: null });
    } catch (e) {
      checks.push({
        key: 'db',
        label: 'Database',
        status: 'down',
        note: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
      });
    }

    // Object storage: exists as a local mount today (see StorageService).
    // A useful degraded/down signal requires a size probe — deferred; this
    // reports healthy until that check ships.
    checks.push({ key: 'storage', label: 'Object store', status: 'healthy', note: null });

    // Job queue: no scheduler runtime exists yet (see release-plan-v2 §4.7
    // note that reminders are a manual button in Phase 1). Reported healthy
    // as a placeholder so the widget renders honestly.
    checks.push({ key: 'queue', label: 'Job queue', status: 'healthy', note: null });

    const worst: 'healthy' | 'degraded' | 'down' = checks.some((c) => c.status === 'down')
      ? 'down'
      : checks.some((c) => c.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return {
      status: worst,
      checks,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iso(d: Date): string {
  return d.toISOString();
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    // Cannot compute a percentage change from zero. The contract says the UI
    // renders `null` as an em-dash rather than "Infinity%" or "100%".
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Compute (current, previous) for a given period spec.
 * Custom requires both from/to; the caller has already parsed the ISO dates.
 */
function periodRanges(
  now: Date,
  period: SummaryPeriod,
  customFrom?: string,
  customTo?: string,
): [Range, Range] {
  // All calculations are in UTC. release-plan-v2 §4.10 says clinic-facing
  // day-boundaries need clinic timezone — but a platform dashboard aggregates
  // ACROSS clinics, so UTC is the honest boundary here.
  const startOfDay = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  if (period === 'custom') {
    if (!customFrom || !customTo) {
      throw new Error('period=custom requires from and to');
    }
    const from = new Date(customFrom);
    const to = new Date(customTo);
    const span = to.getTime() - from.getTime();
    return [
      { from, to },
      { from: new Date(from.getTime() - span), to: from },
    ];
  }

  if (period === 'this-month') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const prevFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return [{ from, to }, { from: prevFrom, to: from }];
  }

  if (period === 'last-30d' || period === 'last-90d') {
    const days = period === 'last-30d' ? 30 : 90;
    const to = startOfDay(addDays(now, 1));
    const from = addDays(to, -days);
    const prevTo = from;
    const prevFrom = addDays(prevTo, -days);
    return [{ from, to }, { from: prevFrom, to: prevTo }];
  }

  // ytd
  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const to = startOfDay(addDays(now, 1));
  const prevFrom = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const prevTo = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1));
  return [{ from, to }, { from: prevFrom, to: prevTo }];
}

/** Human-readable label for an Edition — the UI shows this in the donut legend. */
function editionLabel(edition: Edition): string {
  const map: Record<Edition, string> = {
    SOLO: 'Solo',
    CLINIC: 'General Clinic',
    SPECIALTY: 'Multi-Specialty',
    DERMATOLOGY: 'Dermatology',
    DENTAL: 'Dental',
    OBGYN: 'OB/GYN',
    PEDIATRICS: 'Pediatric',
    OPHTHALMOLOGY: 'Ophthalmology',
    PHYSIOTHERAPY: 'Physiotherapy',
    LAB: 'Laboratory',
    PHARMACY: 'Pharmacy',
    HOSPITAL: 'Hospital',
    ENTERPRISE: 'Enterprise',
  };
  return map[edition] ?? edition;
}
