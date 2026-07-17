// EDD / gestational-age engine (pure, unit-testable).
//
// All gestational-age (GA) displays in the OB/GYN pack derive from a single
// working EDD (`eddFinal`). This module computes EDD by Naegele's rule (LMP)
// and by ultrasound dating, GA at any date, and the ACOG/WHO re-dating
// decision when LMP- and USG-dating disagree.
//
// Sources: pregnancy is dated as 280 days (40 wk) from LMP (Naegele). Re-dating
// thresholds follow ACOG "Methods for Estimating the Due Date" (Committee
// Opinion 700).

const MS_PER_DAY = 86_400_000;
export const TERM_DAYS = 280; // 40 weeks

/** Strip a Date to UTC midnight so day arithmetic ignores time-of-day/TZ. */
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole-day difference b - a (positive when b is after a). */
export function dayDiff(a: Date, b: Date): number {
  return Math.round((utcMidnight(b) - utcMidnight(a)) / MS_PER_DAY);
}

export function addDays(d: Date, n: number): Date {
  return new Date(utcMidnight(d) + n * MS_PER_DAY);
}

/** Naegele: EDD = LMP + 280 days. */
export function eddFromLmp(lmp: Date): Date {
  return addDays(lmp, TERM_DAYS);
}

/**
 * EDD from an ultrasound-assigned GA at the scan date.
 * EDD = scanDate + (280 − gaAtScanInDays).
 */
export function eddFromUsg(scanDate: Date, gaWeeks: number, gaDays = 0): Date {
  const gaAtScan = gaWeeks * 7 + gaDays;
  return addDays(scanDate, TERM_DAYS - gaAtScan);
}

export interface GestationalAge {
  /** Total days of gestation at the reference date (can be negative pre-conception, capped ≥0 by callers). */
  totalDays: number;
  weeks: number;
  days: number;
  /** e.g. "28+3". */
  label: string;
}

/** GA at `atDate` derived from the working EDD. */
export function gestationalAge(eddFinal: Date, atDate: Date): GestationalAge {
  const totalDays = TERM_DAYS - dayDiff(atDate, eddFinal);
  const weeks = Math.trunc(totalDays / 7);
  const days = ((totalDays % 7) + 7) % 7; // non-negative remainder
  return { totalDays, weeks, days, label: `${weeks}+${days}` };
}

/**
 * ACOG re-dating threshold (in days) by GA-at-scan measured in completed weeks.
 * If |EDD_by_LMP − EDD_by_USG| exceeds this, USG dating should be adopted.
 */
export function redatingThresholdDays(gaWeeksAtScan: number): number {
  if (gaWeeksAtScan < 9) return 5; //  ≤ 8+6  (CRL)
  if (gaWeeksAtScan < 16) return 7; //  9+0 – 15+6
  if (gaWeeksAtScan < 22) return 10; // 16+0 – 21+6
  if (gaWeeksAtScan < 28) return 14; // 22+0 – 27+6
  return 21; //                          ≥ 28+0
}

export interface RedatingDecision {
  discrepancyDays: number;
  thresholdDays: number;
  shouldRedate: boolean;
  recommendedMethod: 'LMP' | 'USG';
}

/**
 * Decide whether to re-date from LMP to USG. `gaWeeksAtScan` is the USG GA
 * (completed weeks) used to pick the threshold, per ACOG.
 */
export function redatingDecision(
  eddByLmp: Date,
  eddByUsg: Date,
  gaWeeksAtScan: number,
): RedatingDecision {
  const discrepancyDays = Math.abs(dayDiff(eddByLmp, eddByUsg));
  const thresholdDays = redatingThresholdDays(gaWeeksAtScan);
  const shouldRedate = discrepancyDays > thresholdDays;
  return {
    discrepancyDays,
    thresholdDays,
    shouldRedate,
    recommendedMethod: shouldRedate ? 'USG' : 'LMP',
  };
}
