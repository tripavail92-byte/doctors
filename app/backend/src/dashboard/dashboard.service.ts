import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';

/**
 * Clinic-ops dashboard aggregations — the data behind the /ops screen
 * (reference #4). Every query runs through forTenant so RLS scopes it to the
 * caller's clinic; tenantId is NEVER placed in a WHERE clause.
 *
 * Honesty boundaries (documented per-method): three widgets depend on models
 * that do not exist yet and return empty rather than fabricated data —
 *   - sessions-in-progress needs a Room / TreatmentSession model,
 *   - doctor-earnings needs a CommissionEarning model,
 * The rest compute from live data (appointments, invoices, payments,
 * encounters, pharmacy stock, leads). Where a real figure needs a threshold
 * or split that isn't configured yet (stock reorder point, clinic/doctor
 * commission split), the response says so instead of inventing precision.
 */

// --- date helpers -----------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function startOfWeek(d: Date): Date {
  // Monday-based week.
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(s, -dow);
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Signed percentage change, one decimal. null when there's no prior baseline
 * to divide by (a delta of "∞%" is not a number worth showing). */
function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type Period = 'today' | 'this-week' | 'this-month' | 'last-30d' | 'last-90d';

function resolvePeriod(period: string | undefined, now: Date): { from: Date; to: Date } {
  const today = startOfDay(now);
  switch (period as Period) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'this-week':
      return { from: startOfWeek(now), to: addDays(today, 1) };
    case 'last-30d':
      return { from: addDays(today, -30), to: addDays(today, 1) };
    case 'last-90d':
      return { from: addDays(today, -90), to: addDays(today, 1) };
    case 'this-month':
    default:
      return { from: startOfMonth(now), to: addMonths(startOfMonth(now), 1) };
  }
}

// --- lead source normalization ----------------------------------------------
// Lead.source is free text written by several writers (WhatsApp webhook, web
// intake, manual entry). Normalize the common spellings into channel buckets
// so the funnel groups sensibly; anything unrecognized falls into OTHER.

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook Leads',
  WHATSAPP: 'WhatsApp Leads',
  WEBSITE: 'Website Leads',
  INSTAGRAM: 'Instagram Leads',
  REFERRAL: 'Referrals',
  WALK_IN: 'Walk-ins',
  OTHER: 'Other',
};

function normalizeSource(raw: string | null): string {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return 'OTHER';
  if (s.includes('whatsapp') || s === 'wa') return 'WHATSAPP';
  if (s.includes('face') || s === 'fb' || s.includes('meta')) return 'FACEBOOK';
  if (s.includes('insta') || s === 'ig') return 'INSTAGRAM';
  if (s.includes('web') || s.includes('site') || s.includes('form')) return 'WEBSITE';
  if (s.includes('referr') || s.includes('friend') || s.includes('word')) return 'REFERRAL';
  if (s.includes('walk')) return 'WALK_IN';
  return 'OTHER';
}

// --- stock thresholds -------------------------------------------------------
// StockItem carries no per-item reorder point, so a low-stock view has no
// configured threshold to compare against. Rather than invent per-item levels,
// apply ONE transparent default and label every row with it, so an operator
// reads it as "below the default" not "below a level someone set for this item".
const DEFAULT_REORDER_POINT = 10;
const CRITICAL_AT = 3;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /dashboard/today
  async today() {
    const { tenantId } = getTenant();
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrow = addDays(todayStart, 1);
    const yesterday = addDays(todayStart, -1);
    const monthStart = startOfMonth(now);
    const lastMonthStart = addMonths(monthStart, -1);
    const activeFrom = addDays(todayStart, -90);
    const prevActiveFrom = addDays(todayStart, -180);

    return this.prisma.forTenant(tenantId, async (tx) => {
      const [
        apptToday,
        apptYesterday,
        activePatients,
        prevActivePatients,
        payMonth,
        refMonth,
        payLastMonth,
        refLastMonth,
        invAgg,
      ] = await Promise.all([
        tx.appointment.count({ where: { start: { gte: todayStart, lt: tomorrow } } }),
        tx.appointment.count({ where: { start: { gte: yesterday, lt: todayStart } } }),
        // "Active" = patients seen (an encounter) in the last 90 days.
        tx.encounter.findMany({
          where: { occurredAt: { gte: activeFrom } },
          select: { patientId: true },
          distinct: ['patientId'],
        }),
        tx.encounter.findMany({
          where: { occurredAt: { gte: prevActiveFrom, lt: activeFrom } },
          select: { patientId: true },
          distinct: ['patientId'],
        }),
        tx.payment.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: monthStart } } }),
        tx.refund.aggregate({ _sum: { amountPkr: true }, where: { createdAt: { gte: monthStart } } }),
        tx.payment.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
        tx.refund.aggregate({ _sum: { amountPkr: true }, where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
        tx.invoice.aggregate({ _sum: { total: true, paid: true }, where: { status: { not: 'VOID' } } }),
      ]);

      const revMonth = (payMonth._sum.amount ?? 0) - (refMonth._sum.amountPkr ?? 0);
      const revLastMonth = (payLastMonth._sum.amount ?? 0) - (refLastMonth._sum.amountPkr ?? 0);
      const outstanding = (invAgg._sum.total ?? 0) - (invAgg._sum.paid ?? 0);

      return {
        generatedAt: now.toISOString(),
        todayLocal: isoDate(todayStart),
        appointmentsToday: { count: apptToday, deltaPct: pctDelta(apptToday, apptYesterday) },
        activePatients: {
          count: activePatients.length,
          deltaPct: pctDelta(activePatients.length, prevActivePatients.length),
        },
        revenueThisMonth: { pkr: revMonth, deltaPct: pctDelta(revMonth, revLastMonth) },
        // Outstanding has no historical snapshot to diff against yet.
        outstandingBalance: { pkr: outstanding, deltaPct: null },
      };
    });
  }

  // GET /appointments/today
  async appointmentsToday() {
    const { tenantId } = getTenant();
    const todayStart = startOfDay(new Date());
    const tomorrow = addDays(todayStart, 1);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.appointment.findMany({
        where: { start: { gte: todayStart, lt: tomorrow } },
        orderBy: { start: 'asc' },
        include: { patient: true, provider: true, serviceCatalogItem: true },
      });
      return {
        todayLocal: isoDate(todayStart),
        rows: rows.map((a) => ({
          id: a.id,
          start: a.start.toISOString(),
          end: a.end.toISOString(),
          durationMin: Math.max(0, Math.round((a.end.getTime() - a.start.getTime()) / 60000)),
          status: a.status,
          patient: { id: a.patient.id, name: a.patient.name, mrn: a.patient.mrn },
          provider: { id: a.provider.id, name: a.provider.name },
          service: { id: a.serviceCatalogItemId, label: a.serviceCatalogItem?.name ?? a.service },
          // No Room model yet — appointments are not assigned to rooms.
          roomLabel: null as string | null,
        })),
      };
    });
  }

  // GET /encounters/recent
  async recentEncounters(limit = 5) {
    const { tenantId } = getTenant();
    const take = Math.min(Math.max(limit, 1), 50);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.encounter.findMany({
        orderBy: { occurredAt: 'desc' },
        take,
        include: {
          patient: true,
          treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 1, include: { items: true } },
        },
      });
      const providerIds = [...new Set(rows.map((r) => r.providerId).filter((x): x is string => !!x))];
      const providers = providerIds.length
        ? await tx.user.findMany({ where: { id: { in: providerIds } }, select: { id: true, name: true } })
        : [];
      const pmap = new Map(providers.map((p) => [p.id, p.name]));

      return {
        rows: rows.map((e) => {
          const plan = e.treatmentPlans[0];
          // "Recommendation" is the priced treatment plan; join the item names.
          // There is no free-text recommendation field on Encounter.
          const recommendation =
            plan && plan.items.length ? plan.items.map((i) => i.name).join(', ') : null;
          return {
            id: e.id,
            patient: { id: e.patient.id, name: e.patient.name, mrn: e.patient.mrn },
            provider: {
              id: e.providerId ?? '',
              name: e.providerId ? pmap.get(e.providerId) ?? 'Unknown' : '—',
            },
            occurredAt: e.occurredAt.toISOString(),
            concern: e.reason ?? null,
            recommendation,
          };
        }),
      };
    });
  }

  // GET /reports/revenue-split
  async revenueSplit(period?: string) {
    const { tenantId } = getTenant();
    const now = new Date();
    const { from, to } = resolvePeriod(period ?? 'this-month', now);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const [pay, ref] = await Promise.all([
        tx.payment.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: from, lt: to } } }),
        tx.refund.aggregate({ _sum: { amountPkr: true }, where: { createdAt: { gte: from, lt: to } } }),
      ]);
      const totalPkr = Math.max(0, (pay._sum.amount ?? 0) - (ref._sum.amountPkr ?? 0));
      // No commission model exists, so there is no doctor share to book yet —
      // 100% of collected revenue is the clinic's. The doctor split activates
      // when a CommissionEarning model lands (release 1 phase 2).
      return {
        period: { from: isoDate(from), to: isoDate(to) },
        totalPkr,
        clinicPkr: totalPkr,
        clinicPct: totalPkr > 0 ? 100 : 0,
        doctorPkr: 0,
        doctorPct: 0,
      };
    });
  }

  // GET /pharmacy/stock/alerts
  async stockAlerts() {
    const { tenantId } = getTenant();
    const today = startOfDay(new Date());
    return this.prisma.forTenant(tenantId, async (tx) => {
      // In-date batches only; expired stock is not "on hand" for dispensing.
      const batches = await tx.stockItem.findMany({ where: { expiry: { gte: today } } });
      const byDrug = new Map<string, { name: string; onHand: number }>();
      for (const b of batches) {
        const cur = byDrug.get(b.formularyCode) ?? { name: b.name, onHand: 0 };
        cur.onHand += b.quantityOnHand;
        byDrug.set(b.formularyCode, cur);
      }
      const rows = [...byDrug.entries()]
        .map(([code, v]) => ({ code, name: v.name, onHand: v.onHand }))
        .filter((v) => v.onHand <= DEFAULT_REORDER_POINT)
        .sort((a, b) => a.onHand - b.onHand)
        .map((v) => ({
          id: v.code,
          name: v.name,
          unit: 'unit',
          onHand: v.onHand,
          reorderAt: DEFAULT_REORDER_POINT,
          severity: v.onHand <= CRITICAL_AT ? ('critical' as const) : ('low' as const),
          note: `${v.onHand} in stock · default reorder level ${DEFAULT_REORDER_POINT}`,
        }));
      return { rows };
    });
  }

  // GET /patients/queue
  async patientQueue() {
    const { tenantId } = getTenant();
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrow = addDays(todayStart, 1);
    return this.prisma.forTenant(tenantId, async (tx) => {
      // No queue-timeline model yet; approximate from today's appointments that
      // are checked-in or in-progress. arrivedAt uses the appointment start.
      const appts = await tx.appointment.findMany({
        where: { start: { gte: todayStart, lt: tomorrow }, status: { in: ['CHECKED_IN', 'IN_PROGRESS'] } },
        include: { patient: true },
        orderBy: { start: 'asc' },
      });
      const rows = appts
        .map((a) => ({
          patient: { id: a.patient.id, name: a.patient.name, mrn: a.patient.mrn },
          arrivedAt: a.start.toISOString(),
          waitedMin: Math.max(0, Math.round((now.getTime() - a.start.getTime()) / 60000)),
          status: a.status === 'IN_PROGRESS' ? ('IN_PROGRESS' as const) : ('CHECKED_IN' as const),
          appointmentId: a.id,
          roomLabel: null as string | null,
        }))
        .sort((x, y) => {
          const rank = (s: string) => (s === 'IN_PROGRESS' ? 0 : 1);
          return rank(x.status) - rank(y.status) || x.arrivedAt.localeCompare(y.arrivedAt);
        });
      return { asOf: now.toISOString(), rows };
    });
  }

  // GET /sessions/in-progress — honest empty until a Room/TreatmentSession model exists.
  sessionsInProgress() {
    return { asOf: new Date().toISOString(), rooms: [] as Array<never> };
  }

  // GET /reports/doctor-earnings — honest empty until CommissionEarning exists.
  doctorEarnings(period?: string) {
    const { from, to } = resolvePeriod(period ?? 'today', new Date());
    return { period: { from: isoDate(from), to: isoDate(to) }, rows: [] as Array<never> };
  }

  // GET /crm/lead-sources — real: Lead.source grouped and normalized.
  async leadSources(period?: string) {
    const { tenantId } = getTenant();
    const now = new Date();
    const { from, to } = resolvePeriod(period ?? 'this-month', now);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const [grouped, convertedCount, totalCount] = await Promise.all([
        tx.lead.groupBy({
          by: ['source'],
          _count: { _all: true },
          where: { createdAt: { gte: from, lt: to } },
        }),
        tx.lead.count({ where: { createdAt: { gte: from, lt: to }, status: 'CONVERTED' } }),
        tx.lead.count({ where: { createdAt: { gte: from, lt: to } } }),
      ]);
      const buckets = new Map<string, number>();
      for (const g of grouped) {
        const key = normalizeSource(g.source);
        buckets.set(key, (buckets.get(key) ?? 0) + g._count._all);
      }
      const rows = [...buckets.entries()]
        .map(([key, count]) => ({ key, label: SOURCE_LABELS[key] ?? key, count, deltaPct: null }))
        .sort((a, b) => b.count - a.count);
      return {
        period: { from: isoDate(from), to: isoDate(to) },
        total: totalCount,
        rows,
        // Conversion here = leads that reached CONVERTED status / all leads in
        // the window. (No "consultation booked" event model, so CONVERTED is
        // the honest proxy for the funnel's conversion figure.)
        conversionRatePct: totalCount > 0 ? Math.round((convertedCount / totalCount) * 1000) / 10 : 0,
      };
    });
  }
}
