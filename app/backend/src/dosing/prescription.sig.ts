import { DoseResult } from './dose-engine';
import { Concentration, Drug } from './drug-catalog';

/**
 * Build the sig — the instruction a caregiver actually follows.
 *
 * Written for the person holding the syringe, not the prescriber: a parent in
 * Faisalabad reads "8.8 mL every 6 hours", not "60 mg/kg/day divided QID". The
 * volume is what prevents a tenfold overdose, so it leads.
 */
export function buildSig(
  drug: Drug,
  result: DoseResult,
  concentration?: Concentration,
): string {
  const hours = Math.round(24 / result.dosesPerDay);
  const parts: string[] = [`${drug.name} ${result.perDoseMg} mg`];

  if (result.volumePerDoseMl != null && concentration) {
    parts[0] += ` (${result.volumePerDoseMl} mL of ${concentration.label})`;
  }
  parts.push(`every ${hours} hours`);
  parts.push(`— ${result.dosesPerDay} doses/day, ${result.perDayMg} mg/day total`);

  // Surface the caps: a clinician reading the sig must be able to see that the
  // number was clamped rather than computed straight from weight.
  const caps: string[] = [];
  if (result.cappedSingle && drug.maxSingleMg) caps.push(`capped at the ${drug.maxSingleMg} mg max per dose`);
  if (result.cappedDaily && drug.maxDailyMg) caps.push(`capped at the ${drug.maxDailyMg} mg daily max`);
  if (caps.length) parts.push(`(${caps.join('; ')})`);

  return parts.join(' ');
}
