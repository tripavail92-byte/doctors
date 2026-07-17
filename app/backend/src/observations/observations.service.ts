import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { METRICS, metricRef } from './reference-ranges';
import { BodySideName, normalizeSide } from './laterality';
import { summarizeTrend, TrendSummary } from './trends';

/**
 * Observations + Trends engine.
 *
 * Observations are a tenant-scoped time series (RLS). The Trends engine is a
 * pure function over them (see trends.ts); this service is the persistence +
 * tenant-scoping wrapper, plus grouping for the all-metrics view.
 */
@Injectable()
export class ObservationsService {
  constructor(private readonly prisma: PrismaService) {}

  // The reference-range catalog (for pickers / UI).
  metrics() {
    return Object.values(METRICS);
  }

  // Normalize a laterality input, rejecting a non-empty but unrecognised value.
  private resolveSide(input?: string): BodySideName | null {
    const side = normalizeSide(input);
    if (side === undefined) {
      throw new BadRequestException(
        `Unrecognized side "${input}" (use OD/OS, AD/AS, L/R, or bilateral)`,
      );
    }
    return side;
  }

  /**
   * Record an observation on an EXISTING transaction.
   *
   * Callers that are already inside `prisma.forTenant(...)` must use this, not
   * `record()`. `record()` opens its own transaction, so calling it from within
   * another one checks out a second pooled connection while the first is still
   * held. With the default pool (9), nine concurrent such requests deadlock:
   * every connection is held by a caller waiting for a connection that nobody
   * can release, until pool_timeout turns it into a 500. It also breaks
   * atomicity — the Observation would commit even if the outer write rolled
   * back, leaving a trend point for a clinical record that does not exist.
   */
  recordIn(
    tx: Prisma.TransactionClient,
    patientId: string,
    metric: string,
    value: number,
    unit?: string,
    note?: string,
    recordedAt?: string,
    side?: string,
  ) {
    const { tenantId, userId } = getTenant();
    const ref = metricRef(metric);
    const resolvedUnit = unit ?? (ref.unit || null);
    const resolvedSide = this.resolveSide(side);
    return tx.observation.create({
      data: {
        tenantId: tenantId!,
        patientId,
        metric,
        value,
        unit: resolvedUnit,
        side: resolvedSide,
        note: note ?? null,
        recordedById: userId ?? null,
        // undefined -> Prisma applies @default(now())
        recordedAt: recordedAt ? new Date(recordedAt) : undefined,
      },
    });
  }

  /** Standalone record — opens its own tenant transaction. See recordIn(). */
  record(
    patientId: string,
    metric: string,
    value: number,
    unit?: string,
    note?: string,
    recordedAt?: string,
    side?: string,
  ) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      this.recordIn(tx, patientId, metric, value, unit, note, recordedAt, side),
    );
  }

  list(patientId: string, metric?: string, side?: string) {
    const resolvedSide = this.resolveSide(side);
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.observation.findMany({
        where: {
          patientId,
          ...(metric ? { metric } : {}),
          ...(resolvedSide ? { side: resolvedSide } : {}),
        },
        orderBy: { recordedAt: 'asc' },
      }),
    );
  }

  async trend(
    patientId: string,
    metric: string,
    side?: string,
  ): Promise<TrendSummary> {
    const resolvedSide = this.resolveSide(side);
    const rows = await this.list(patientId, metric, side);
    return summarizeTrend(
      metricRef(metric),
      rows.map((r) => ({ value: r.value, recordedAt: r.recordedAt })),
      resolvedSide,
    );
  }

  // One trend summary per distinct (metric, side) the patient has data for.
  async trendsAll(patientId: string): Promise<TrendSummary[]> {
    const { tenantId } = getTenant();
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.observation.findMany({
        where: { patientId },
        orderBy: { recordedAt: 'asc' },
      }),
    );
    const groups = new Map<
      string,
      { metric: string; side: BodySideName | null; obs: { value: number; recordedAt: Date }[] }
    >();
    for (const r of rows) {
      const side = (r.side as BodySideName | null) ?? null;
      const key = `${r.metric}|${side ?? ''}`;
      const g = groups.get(key) ?? { metric: r.metric, side, obs: [] };
      g.obs.push({ value: r.value, recordedAt: r.recordedAt });
      groups.set(key, g);
    }
    return Array.from(groups.values()).map((g) =>
      summarizeTrend(metricRef(g.metric), g.obs, g.side),
    );
  }
}
