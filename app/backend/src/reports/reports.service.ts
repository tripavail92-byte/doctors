import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';

type CountRow = { _count: { _all: number } } & Record<string, unknown>;

function byKey(rows: CountRow[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r[key])] = r._count._all;
  return out;
}
function total(rows: CountRow[]): number {
  return rows.reduce((s, r) => s + r._count._all, 0);
}

/**
 * Read-only analytics aggregated across the tenant's live data. Every query
 * runs through forTenant so the numbers are tenant-isolated by RLS.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const [
        patients,
        encByStatus,
        invAgg,
        invByStatus,
        payAgg,
        refundAgg,
        labByStatus,
        dispenses,
        dispSum,
        immunizations,
        instrumentResponses,
        observations,
        activePacks,
      ] = await Promise.all([
        tx.patient.count(),
        tx.encounter.groupBy({ by: ['status'], _count: { _all: true } }),
        tx.invoice.aggregate({ _sum: { total: true, paid: true }, _count: { _all: true }, where: { status: { not: 'VOID' } } }),
        tx.invoice.groupBy({ by: ['status'], _count: { _all: true } }),
        tx.payment.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
        tx.refund.aggregate({ _sum: { amountPkr: true } }),
        tx.labOrder.groupBy({ by: ['status'], _count: { _all: true } }),
        tx.dispense.count(),
        tx.dispense.aggregate({ _sum: { totalPkr: true } }),
        tx.immunization.count(),
        tx.scoredInstrumentResponse.count(),
        tx.observation.count(),
        tx.packActivation.count({ where: { status: 'ACTIVE' } }),
      ]);

      const billed = invAgg._sum.total ?? 0;
      const collected = invAgg._sum.paid ?? 0;
      return {
        patients,
        activePacks,
        encounters: { total: total(encByStatus as CountRow[]), byStatus: byKey(encByStatus as CountRow[], 'status') },
        billing: {
          invoices: invAgg._count._all,
          billedPkr: billed,
          collectedPkr: collected,
          outstandingPkr: billed - collected,
          byStatus: byKey(invByStatus as CountRow[], 'status'),
          paymentsPkr: payAgg._sum.amount ?? 0,
          refundsPkr: refundAgg._sum.amountPkr ?? 0,
        },
        lab: { orders: total(labByStatus as CountRow[]), byStatus: byKey(labByStatus as CountRow[], 'status') },
        pharmacy: { dispenses, revenuePkr: dispSum._sum.totalPkr ?? 0 },
        clinical: { immunizations, instrumentResponses, observations },
      };
    });
  }

  async revenue() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const [payByMethod, dispByMethod, refundAgg] = await Promise.all([
        tx.payment.groupBy({ by: ['method'], _sum: { amount: true }, _count: { _all: true } }),
        tx.dispense.groupBy({ by: ['paymentMethod'], _sum: { totalPkr: true }, _count: { _all: true } }),
        tx.refund.aggregate({ _sum: { amountPkr: true } }),
      ]);
      const clinicByMethod: Record<string, number> = {};
      for (const r of payByMethod) clinicByMethod[String(r.method)] = r._sum.amount ?? 0;
      const pharmacyByMethod: Record<string, number> = {};
      for (const r of dispByMethod) pharmacyByMethod[String(r.paymentMethod)] = r._sum.totalPkr ?? 0;

      const clinicTotal = Object.values(clinicByMethod).reduce((a, b) => a + b, 0);
      const pharmacyTotal = Object.values(pharmacyByMethod).reduce((a, b) => a + b, 0);
      const refunds = refundAgg._sum.amountPkr ?? 0;
      return {
        clinic: { byMethod: clinicByMethod, totalPkr: clinicTotal },
        pharmacy: { byMethod: pharmacyByMethod, totalPkr: pharmacyTotal },
        refundsPkr: refunds,
        netRevenuePkr: clinicTotal + pharmacyTotal - refunds,
      };
    });
  }
}
