import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { NotFoundException } from '@nestjs/common';
import { BodySide } from '@prisma/client';
import { METRICS, metricRef } from './reference-ranges';
import { BodySideName, normalizeSide } from './laterality';
import { summarizeTrend, TrendSummary } from './trends';
import { aggregate } from './trend-aggregation';
import { CreateTrendAnnotationDto } from './dto/create-trend-annotation.dto';

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

  // -------------------------------------------------------------------------
  // Declarative trend charts (TrendChartDefinition + TrendAnnotation)
  // -------------------------------------------------------------------------

  // The tenant's active chart definitions (pack-shipped, tenant-overridable).
  listDefinitions(packKey?: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.trendChartDefinition.findMany({
        where: { active: true, ...(packKey ? { packKey } : {}) },
        orderBy: { key: 'asc' },
      }),
    );
  }

  private async loadDefinition(chartKey: string) {
    const def = await this.prisma.forCurrentTenant((tx) =>
      tx.trendChartDefinition.findUnique({ where: { tenantId_key: { tenantId: getTenant().tenantId!, key: chartKey } } }),
    );
    if (!def || !def.active) throw new NotFoundException(`Trend chart "${chartKey}" not found`);
    return def;
  }

  /**
   * Render a chart for one patient: the definition, the aggregated series (one
   * per side if the definition splits), the bands/targets to draw, and the
   * clinician annotations pinned on it. Bands are resolved server-side so the
   * client never re-derives clinical thresholds.
   */
  async chartForPatient(
    chartKey: string,
    patientId: string,
    opts?: { from?: string; to?: string; side?: string },
  ) {
    const def = await this.loadDefinition(chartKey);
    const { tenantId } = getTenant();
    const sideFilter = opts?.side ? this.resolveSide(opts.side) : undefined;

    const [rows, annotations] = await this.prisma.forTenant(tenantId, async (tx) => {
      const obs = await tx.observation.findMany({
        where: {
          patientId,
          metric: { in: def.observationCodes },
          ...(sideFilter ? { side: sideFilter as BodySide } : {}),
          ...(opts?.from || opts?.to
            ? { recordedAt: { ...(opts?.from ? { gte: new Date(opts.from) } : {}), ...(opts?.to ? { lte: new Date(opts.to) } : {}) } }
            : {}),
        },
        orderBy: { recordedAt: 'asc' },
      });
      const anns = await tx.trendAnnotation.findMany({
        where: { patientId, chartKey },
        orderBy: { atDateTime: 'asc' },
      });
      return [obs, anns] as const;
    });

    const series = aggregate(
      rows.map((r) => ({ value: r.value, recordedAt: r.recordedAt, side: (r.side as BodySideName | null) ?? null })),
      def.aggregation,
      def.splitByLaterality,
    );

    return {
      definition: def,
      series,
      referenceBands: def.referenceBands ?? [],
      targetLines: def.targetLines ?? [],
      annotations,
    };
  }

  // Delta / min / max / slope summary for a chart, reusing summarizeTrend over
  // the definition's pooled observations.
  async chartSummary(chartKey: string, patientId: string, side?: string) {
    const def = await this.loadDefinition(chartKey);
    const { tenantId } = getTenant();
    const resolvedSide = side ? this.resolveSide(side) : null;
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.observation.findMany({
        where: {
          patientId,
          metric: { in: def.observationCodes },
          ...(resolvedSide ? { side: resolvedSide as BodySide } : {}),
        },
        orderBy: { recordedAt: 'asc' },
      }),
    );
    return summarizeTrend(
      { key: def.key, label: def.title, unit: def.unit },
      rows.map((r) => ({ value: r.value, recordedAt: r.recordedAt })),
      resolvedSide,
    );
  }

  async createAnnotation(dto: CreateTrendAnnotationDto) {
    const { tenantId, userId } = getTenant();
    // The chart must exist for this tenant — an annotation on a chart nobody
    // renders is a note that never surfaces.
    await this.loadDefinition(dto.chartKey);
    const side = dto.side ? (this.resolveSide(dto.side) as BodySide | null) : null;
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.trendAnnotation.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          chartKey: dto.chartKey,
          atDateTime: new Date(dto.atDateTime),
          label: dto.label,
          side,
          linkedResourceId: dto.linkedResourceId ?? null,
          createdById: userId ?? null,
        },
      }),
    );
  }
}
