// Trend point-stream aggregation (pure).
//
// A TrendChartDefinition says HOW to collapse a patient's raw observations before
// they are plotted: every point, one per day (mean), or the last per day. This is
// the pre-processing step; summarizeTrend() in trends.ts still does the
// delta/min/max/slope over whatever series comes out of here.

import type { BodySideName } from './laterality';

export type AggregationMode = 'RAW' | 'DAILY_MEAN' | 'LAST_PER_VISIT';

export interface Band {
  label: string;
  low?: number;
  high?: number;
  color: string;
}
export interface TargetLine {
  label: string;
  value: number;
}
export interface AggregatedPoint {
  t: string; // ISO
  value: number;
}
export interface AggregatedSeries {
  side: BodySideName | null;
  points: AggregatedPoint[];
}

interface RawObs {
  value: number;
  recordedAt: Date | string;
  side: BodySideName | null;
}

// Calendar-day bucket key. Uses the UTC date so a day is a stable, timezone-free
// bucket — the same instant always lands in the same day regardless of where it
// is read. (Clinics wanting local-day buckets would pass a tz-adjusted time.)
function dayKey(t: Date | string): string {
  return new Date(t).toISOString().slice(0, 10);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Collapse a raw observation stream into one or more plotted series.
 *
 * - RAW: every point, sorted by time.
 * - DAILY_MEAN: mean of the values sharing a calendar day, stamped at that day.
 * - LAST_PER_VISIT: the last value recorded on each calendar day.
 *
 * splitByLaterality=false yields a single series (side=null, all sides pooled);
 * true yields one series per distinct side present, so left and right plot apart.
 *
 * Pure and order-independent: input may arrive in any order.
 */
export function aggregate(
  obs: RawObs[],
  mode: AggregationMode,
  splitByLaterality: boolean,
): AggregatedSeries[] {
  // Partition into series first. When not splitting, everything pools into one
  // null-sided series — a chart that pools left+right must NOT then also emit
  // per-side lines, or a point is drawn twice.
  const bySide = new Map<BodySideName | null, RawObs[]>();
  for (const o of obs) {
    const seriesKey = splitByLaterality ? o.side : null;
    const arr = bySide.get(seriesKey) ?? [];
    arr.push(o);
    bySide.set(seriesKey, arr);
  }

  const out: AggregatedSeries[] = [];
  for (const [side, rows] of bySide) {
    out.push({ side, points: collapse(rows, mode) });
  }
  // Stable series order: null (pooled) first, then LEFT/RIGHT/BILATERAL by name.
  out.sort((a, b) => (a.side ?? '').localeCompare(b.side ?? ''));
  return out;
}

function collapse(rows: RawObs[], mode: AggregationMode): AggregatedPoint[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  if (mode === 'RAW') {
    return sorted.map((o) => ({ t: new Date(o.recordedAt).toISOString(), value: o.value }));
  }

  // Both day-bucketed modes group by calendar day. `sorted` is ascending, so the
  // last row seen for a day is the latest, and the running sum/count gives the mean.
  const byDay = new Map<string, { sum: number; count: number; lastT: string; lastValue: number }>();
  for (const o of sorted) {
    const k = dayKey(o.recordedAt);
    const iso = new Date(o.recordedAt).toISOString();
    const b = byDay.get(k) ?? { sum: 0, count: 0, lastT: iso, lastValue: o.value };
    b.sum += o.value;
    b.count += 1;
    b.lastT = iso; // ascending order → this is the day's latest
    b.lastValue = o.value;
    byDay.set(k, b);
  }

  const days = [...byDay.keys()].sort();
  return days.map((k) => {
    const b = byDay.get(k)!;
    if (mode === 'DAILY_MEAN') {
      // Stamp the mean at the START of the day, so a day is one point at a stable
      // time regardless of when its readings were taken.
      return { t: `${k}T00:00:00.000Z`, value: round2(b.sum / b.count) };
    }
    // LAST_PER_VISIT
    return { t: b.lastT, value: b.lastValue };
  });
}

/**
 * The band a value falls in — the FIRST band whose [low, high] contains it. A
 * band may be open-ended (low or high omitted). Used to colour a plotted point.
 */
export function classifyBand(bands: Band[], value: number): Band | null {
  for (const b of bands) {
    const okLow = b.low === undefined || value >= b.low;
    const okHigh = b.high === undefined || value <= b.high;
    if (okLow && okHigh) return b;
  }
  return null;
}

interface UnitLockedDef {
  unit: string;
  yMin?: number | null;
  yMax?: number | null;
  referenceBands?: unknown;
  targetLines?: unknown;
}

/**
 * Author-time guard: a definition's bands and targets must be internally
 * consistent with its axis. A band whose high < low, or a band/target lying
 * entirely outside an explicit [yMin, yMax], is a definition error — it would
 * draw a band nobody can see or an impossible range, and quietly mislead. Reject
 * it when the definition is created, not when a chart silently renders wrong.
 */
export function assertDefinitionSane(def: UnitLockedDef): void {
  const bands = (Array.isArray(def.referenceBands) ? def.referenceBands : []) as Band[];
  const targets = (Array.isArray(def.targetLines) ? def.targetLines : []) as TargetLine[];
  const yMin = def.yMin ?? null;
  const yMax = def.yMax ?? null;
  if (yMin !== null && yMax !== null && yMin >= yMax) {
    throw new Error(`yMin (${yMin}) must be below yMax (${yMax})`);
  }
  for (const b of bands) {
    if (b.low !== undefined && b.high !== undefined && b.low > b.high) {
      throw new Error(`Band "${b.label}" has low ${b.low} above high ${b.high}`);
    }
    if (yMin !== null && b.high !== undefined && b.high < yMin) {
      throw new Error(`Band "${b.label}" lies entirely below the axis (yMin ${yMin})`);
    }
    if (yMax !== null && b.low !== undefined && b.low > yMax) {
      throw new Error(`Band "${b.label}" lies entirely above the axis (yMax ${yMax})`);
    }
  }
  for (const tl of targets) {
    if (yMin !== null && tl.value < yMin) {
      throw new Error(`Target "${tl.label}" (${tl.value}) is below the axis (yMin ${yMin})`);
    }
    if (yMax !== null && tl.value > yMax) {
      throw new Error(`Target "${tl.label}" (${tl.value}) is above the axis (yMax ${yMax})`);
    }
  }
}
