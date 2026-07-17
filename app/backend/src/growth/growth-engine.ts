// WHO-LMS growth engine.
//
// The LMS method expresses a child's anthropometry as a z-score against a
// reference distribution whose shape at each age/length & sex is captured by
// three parameters L (Box-Cox power), M (median) and S (coefficient of
// variation):
//
//   Z = ((value / M)^L - 1) / (L * S)      (L != 0)
//   Z = ln(value / M) / S                  (L == 0)
//
// For the skewed WEIGHT-based indicators (wfa, wfh, bmifa), WHO constrains the
// tails beyond |z| = 3 with a linear extrapolation so an implausible value
// can't explode the score; height/head indicators use the plain z.
//
// This file is the pure math + WHO classification; reference tables live in
// who-lms.ts and are supplied to it.

export type GrowthIndicator =
  | 'wfa' //  weight-for-age
  | 'lhfa' // length/height-for-age
  | 'wfh' //  weight-for-length/height
  | 'bmifa' // BMI-for-age
  | 'hcfa'; // head-circumference-for-age

/** Indicators whose distribution is skewed enough to need WHO tail correction. */
export const WEIGHT_BASED: GrowthIndicator[] = ['wfa', 'wfh', 'bmifa'];

/** The x-axis of each indicator's reference table. */
export function indicatorXUnit(indicator: GrowthIndicator): 'months' | 'cm' {
  return indicator === 'wfh' ? 'cm' : 'months';
}

export interface LmsPoint {
  x: number; // age in months, or length/height in cm (wfh)
  L: number;
  M: number;
  S: number;
}

export interface GrowthResult {
  z: number;
  percentile: number; // 0..100
  classification: string;
}

function round(x: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

/** The measurement value at a given z-score (LMS inverse) — used for curves + tails. */
export function measurementAtZ(L: number, M: number, S: number, z: number): number {
  if (L === 0) return M * Math.exp(S * z);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

/** Raw LMS z-score (no tail correction). */
export function lmsZScoreRaw(L: number, M: number, S: number, value: number): number {
  if (L === 0) return Math.log(value / M) / S;
  return (Math.pow(value / M, L) - 1) / (L * S);
}

/**
 * LMS z-score. With `applyTail`, values beyond ±3 z are linearly extrapolated
 * from the distance between the ±2 and ±3 cutoffs (WHO Child Growth Standards
 * method for weight-based indicators).
 */
export function lmsZScore(
  L: number,
  M: number,
  S: number,
  value: number,
  applyTail = false,
): number {
  const z = lmsZScoreRaw(L, M, S, value);
  if (!applyTail || Math.abs(z) <= 3) return z;
  if (z > 3) {
    const sd3 = measurementAtZ(L, M, S, 3);
    const sd2 = measurementAtZ(L, M, S, 2);
    return 3 + (value - sd3) / (sd3 - sd2);
  }
  const sd3 = measurementAtZ(L, M, S, -3);
  const sd2 = measurementAtZ(L, M, S, -2);
  return -3 + (value - sd3) / (sd2 - sd3);
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26) -> percentile 0..100.
export function zToPercentile(z: number): number {
  return round(normCdf(z) * 100, 1);
}

function normCdf(z: number): number {
  const p0 = 0.2316419;
  const az = Math.abs(z);
  const t = 1 / (1 + p0 * az);
  const d = 0.3989422804014327 * Math.exp((-az * az) / 2);
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const upperTail = d * poly; // P(Z > az)
  return z >= 0 ? 1 - upperTail : upperTail;
}

// WHO growth-standard interpretation cut-offs (SD/z bands).
export function classify(indicator: GrowthIndicator, z: number): string {
  switch (indicator) {
    case 'wfa':
      if (z < -3) return 'Severely underweight';
      if (z < -2) return 'Underweight';
      if (z <= 2) return 'Normal weight';
      return 'Above normal (assess weight-for-length)';
    case 'lhfa':
      if (z < -3) return 'Severely stunted';
      if (z < -2) return 'Stunted';
      if (z <= 3) return 'Normal stature';
      return 'Very tall (review)';
    case 'wfh':
      if (z < -3) return 'Severe wasting';
      if (z < -2) return 'Wasting';
      if (z <= 2) return 'Normal';
      if (z <= 3) return 'Overweight';
      return 'Obese';
    case 'bmifa':
      if (z < -3) return 'Severe wasting';
      if (z < -2) return 'Wasting';
      if (z <= 1) return 'Normal';
      if (z <= 2) return 'Risk of overweight';
      if (z <= 3) return 'Overweight';
      return 'Obese';
    case 'hcfa':
      if (z < -2) return 'Microcephaly (below normal)';
      if (z <= 2) return 'Normal head circumference';
      return 'Macrocephaly (above normal)';
  }
}

export function growthResult(
  indicator: GrowthIndicator,
  L: number,
  M: number,
  S: number,
  value: number,
): GrowthResult {
  const applyTail = WEIGHT_BASED.includes(indicator);
  const z = round(lmsZScore(L, M, S, value, applyTail), 2);
  return { z, percentile: zToPercentile(z), classification: classify(indicator, z) };
}
