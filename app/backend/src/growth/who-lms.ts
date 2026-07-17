import { GrowthIndicator, indicatorXUnit, LmsPoint } from './growth-engine';

export type Sex = 'male' | 'female';

// ---------------------------------------------------------------------------
// SAMPLE / STARTER reference data — NOT the full WHO tables.
//
// The anchors below are drawn from the WHO Child Growth Standards (0–5 y) but
// are ABRIDGED to a handful of points per indicator for linear interpolation.
// They MUST be replaced with the official, complete month-by-month (and
// cm-by-cm for weight-for-length) WHO LMS tables — freely available from
// who.int/tools/child-growth-standards — before any clinical use.
//
// The ENGINE (growth-engine.ts) is production-grade (LMS z-score, WHO tail
// correction, all 5 indicators, curve inversion); only THIS DATA is a stub.
// To go live: drop in the full tables (same {x,L,M,S} shape) — no code change.
// ---------------------------------------------------------------------------

// weight-for-age (x = age months)
const WFA: Record<Sex, LmsPoint[]> = {
  male: [
    { x: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
    { x: 1, L: 0.2297, M: 4.4709, S: 0.13395 },
    { x: 2, L: 0.197, M: 5.5675, S: 0.12385 },
    { x: 3, L: 0.1738, M: 6.3762, S: 0.11727 },
    { x: 6, L: 0.1257, M: 7.934, S: 0.1108 },
    { x: 12, L: 0.0486, M: 9.6479, S: 0.10958 },
    { x: 24, L: -0.0891, M: 12.1515, S: 0.10827 },
    { x: 60, L: -0.2947, M: 18.3366, S: 0.11726 },
  ],
  female: [
    { x: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
    { x: 1, L: 0.1714, M: 4.1873, S: 0.13724 },
    { x: 2, L: 0.0962, M: 5.1282, S: 0.13 },
    { x: 3, L: 0.0402, M: 5.8458, S: 0.12619 },
    { x: 6, L: -0.0756, M: 7.297, S: 0.12204 },
    { x: 12, L: -0.1683, M: 8.9481, S: 0.12197 },
    { x: 24, L: -0.2451, M: 11.4775, S: 0.12174 },
    { x: 60, L: -0.4093, M: 17.6716, S: 0.13273 },
  ],
};

// length/height-for-age (x = age months)
const LHFA: Record<Sex, LmsPoint[]> = {
  male: [
    { x: 0, L: 1, M: 49.8842, S: 0.03795 },
    { x: 6, L: 1, M: 67.6236, S: 0.03165 },
    { x: 12, L: 1, M: 75.7488, S: 0.0353 },
    { x: 24, L: 1, M: 87.1161, S: 0.03664 },
    { x: 60, L: 1, M: 110.0, S: 0.04 },
  ],
  female: [
    { x: 0, L: 1, M: 49.1477, S: 0.0379 },
    { x: 6, L: 1, M: 65.7311, S: 0.03227 },
    { x: 12, L: 1, M: 74.015, S: 0.03612 },
    { x: 24, L: 1, M: 85.7153, S: 0.03758 },
    { x: 60, L: 1, M: 109.4, S: 0.0416 },
  ],
};

// weight-for-length/height (x = length/height in cm)
const WFH: Record<Sex, LmsPoint[]> = {
  male: [
    { x: 45, L: -0.3521, M: 2.441, S: 0.09182 },
    { x: 50, L: -0.3833, M: 3.278, S: 0.0834 },
    { x: 60, L: -0.2673, M: 6.062, S: 0.08066 },
    { x: 70, L: -0.2196, M: 8.658, S: 0.0817 },
    { x: 80, L: -0.1738, M: 10.749, S: 0.08444 },
    { x: 90, L: -0.1553, M: 12.671, S: 0.08726 },
    { x: 100, L: -0.149, M: 15.083, S: 0.08987 },
    { x: 110, L: -0.1637, M: 18.117, S: 0.09204 },
  ],
  female: [
    { x: 45, L: -0.3833, M: 2.461, S: 0.09008 },
    { x: 50, L: -0.2831, M: 3.232, S: 0.08761 },
    { x: 60, L: -0.1533, M: 5.664, S: 0.08677 },
    { x: 70, L: -0.0966, M: 8.126, S: 0.08857 },
    { x: 80, L: -0.0554, M: 10.314, S: 0.09189 },
    { x: 90, L: -0.0331, M: 12.472, S: 0.09562 },
    { x: 100, L: -0.019, M: 14.899, S: 0.09892 },
    { x: 110, L: -0.0132, M: 18.006, S: 0.10163 },
  ],
};

// BMI-for-age (x = age months)
const BMIFA: Record<Sex, LmsPoint[]> = {
  male: [
    { x: 0, L: -0.3053, M: 13.4069, S: 0.09590 },
    { x: 3, L: -0.1088, M: 16.898, S: 0.08414 },
    { x: 6, L: 0.0, M: 17.3402, S: 0.08514 },
    { x: 12, L: 0.0, M: 17.0475, S: 0.08387 },
    { x: 24, L: -0.1401, M: 16.0176, S: 0.08387 },
    { x: 60, L: -0.7387, M: 15.2641, S: 0.08015 },
  ],
  female: [
    { x: 0, L: -0.0631, M: 13.3363, S: 0.09272 },
    { x: 3, L: 0.0742, M: 16.4127, S: 0.08688 },
    { x: 6, L: 0.0625, M: 16.8952, S: 0.08770 },
    { x: 12, L: -0.0093, M: 16.5981, S: 0.08698 },
    { x: 24, L: -0.1533, M: 15.6883, S: 0.08698 },
    { x: 60, L: -0.8886, M: 15.2211, S: 0.08757 },
  ],
};

// head-circumference-for-age (x = age months)
const HCFA: Record<Sex, LmsPoint[]> = {
  male: [
    { x: 0, L: 1, M: 34.4618, S: 0.03686 },
    { x: 3, L: 1, M: 40.5135, S: 0.03077 },
    { x: 6, L: 1, M: 43.3065, S: 0.02902 },
    { x: 12, L: 1, M: 45.9915, S: 0.02790 },
    { x: 24, L: 1, M: 48.2683, S: 0.02761 },
    { x: 60, L: 1, M: 50.75, S: 0.02781 },
  ],
  female: [
    { x: 0, L: 1, M: 33.8787, S: 0.03496 },
    { x: 3, L: 1, M: 39.5328, S: 0.03130 },
    { x: 6, L: 1, M: 42.1995, S: 0.02970 },
    { x: 12, L: 1, M: 44.8781, S: 0.02867 },
    { x: 24, L: 1, M: 47.24, S: 0.02839 },
    { x: 60, L: 1, M: 49.68, S: 0.02857 },
  ],
};

const TABLES: Record<GrowthIndicator, Record<Sex, LmsPoint[]>> = {
  wfa: WFA,
  lhfa: LHFA,
  wfh: WFH,
  bmifa: BMIFA,
  hcfa: HCFA,
};

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Raw table points for a sex/indicator (used to build reference curves). */
export function tableFor(sex: Sex, indicator: GrowthIndicator): LmsPoint[] {
  return TABLES[indicator]?.[sex] ?? [];
}

/**
 * Look up (or linearly interpolate) LMS parameters for a sex/indicator at x
 * (age in months, or length/height in cm for wfh). Clamps to the table's
 * endpoints outside its range.
 */
export function lookupLMS(
  sex: Sex,
  indicator: GrowthIndicator,
  x: number,
): LmsPoint | null {
  const pts = tableFor(sex, indicator);
  if (pts.length === 0) return null;
  if (x <= pts[0].x) return pts[0];
  const last = pts[pts.length - 1];
  if (x >= last.x) return last;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x >= a.x && x <= b.x) {
      const f = (x - a.x) / (b.x - a.x);
      return { x, L: lerp(a.L, b.L, f), M: lerp(a.M, b.M, f), S: lerp(a.S, b.S, f) };
    }
  }
  return last;
}

export { indicatorXUnit };
