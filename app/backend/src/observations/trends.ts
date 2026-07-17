import { MetricRef } from './reference-ranges';
import { BodySideName } from './laterality';

export type Flag = 'low' | 'normal' | 'high' | 'unknown';
export type Direction = 'up' | 'down' | 'flat' | 'na';

export interface TrendPoint {
  value: number;
  recordedAt: string; // ISO
  flag: Flag;
}

export interface TrendSummary {
  metric: string;
  side: BodySideName | null;
  label: string;
  unit: string;
  count: number;
  latest: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
  direction: Direction;
  min: number | null;
  max: number | null;
  mean: number | null;
  refLow?: number;
  refHigh?: number;
  latestFlag: Flag;
  series: TrendPoint[];
}

function round(x: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

// Classify a value against its reference range.
export function flagValue(ref: MetricRef, value: number): Flag {
  if (ref.low === undefined && ref.high === undefined) return 'unknown';
  if (ref.low !== undefined && value < ref.low) return 'low';
  if (ref.high !== undefined && value > ref.high) return 'high';
  return 'normal';
}

/**
 * Turn a series of raw observations into a trend summary: sorted series with
 * per-point flags, latest vs previous delta & direction, and min/max/mean.
 * Pure and order-independent (input may be in any order).
 */
export function summarizeTrend(
  ref: MetricRef,
  observations: { value: number; recordedAt: Date | string }[],
  side: BodySideName | null = null,
): TrendSummary {
  const sorted = [...observations].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const series: TrendPoint[] = sorted.map((o) => ({
    value: o.value,
    recordedAt: new Date(o.recordedAt).toISOString(),
    flag: flagValue(ref, o.value),
  }));

  const values = sorted.map((o) => o.value);
  const n = values.length;
  const latest = n ? values[n - 1] : null;
  const previous = n >= 2 ? values[n - 2] : null;
  const delta = latest !== null && previous !== null ? round(latest - previous) : null;
  const deltaPct =
    delta !== null && previous ? round((delta / previous) * 100, 1) : null;

  let direction: Direction = 'na';
  if (delta !== null) direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return {
    metric: ref.key,
    side,
    label: ref.label,
    unit: ref.unit,
    count: n,
    latest,
    previous,
    delta,
    deltaPct,
    direction,
    min: n ? Math.min(...values) : null,
    max: n ? Math.max(...values) : null,
    mean: n ? round(values.reduce((a, b) => a + b, 0) / n) : null,
    refLow: ref.low,
    refHigh: ref.high,
    latestFlag: latest !== null ? flagValue(ref, latest) : 'unknown',
    series,
  };
}
