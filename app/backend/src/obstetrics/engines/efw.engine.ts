// Estimated fetal weight (EFW) engine — Hadlock formulas (pure).
//
// Biometry is stored in millimetres; Hadlock formulas take centimetres, so we
// convert in exactly one place. EFW is never computed client-side.
//
// Hadlock-3 (HC/AC/FL), preferred:
//   log10(EFW) = 1.326 − 0.00326·AC·FL + 0.0107·HC + 0.0438·AC + 0.158·FL
// Hadlock-2 (BPD/AC/FL), fallback when HC is missing:
//   log10(EFW) = 1.335 − 0.0034·AC·FL + 0.0316·BPD + 0.0457·AC + 0.1623·FL
// (all measurements in cm; EFW in grams)
//
// Source: Hadlock FP et al. "Estimation of fetal weight with the use of head,
// body, and femur measurements" (Am J Obstet Gynecol 1985).

export type EfwFormula = 'HADLOCK3' | 'HADLOCK2';

export interface EfwBiometryMm {
  hcMm?: number | null;
  acMm?: number | null;
  flMm?: number | null;
  bpdMm?: number | null;
}

export interface EfwResult {
  efwGrams: number;
  formula: EfwFormula;
}

const mm2cm = (mm: number) => mm / 10;

/**
 * Compute EFW from biometry. Uses Hadlock-3 (HC/AC/FL) when HC, AC, FL are all
 * present; otherwise Hadlock-2 (BPD/AC/FL). Returns null when neither formula's
 * inputs are available. Throws on non-positive measurements (invalid biometry).
 */
export function estimateFetalWeight(b: EfwBiometryMm): EfwResult | null {
  const ac = b.acMm != null ? mm2cm(b.acMm) : null;
  const fl = b.flMm != null ? mm2cm(b.flMm) : null;
  const hc = b.hcMm != null ? mm2cm(b.hcMm) : null;
  const bpd = b.bpdMm != null ? mm2cm(b.bpdMm) : null;

  for (const [name, v] of Object.entries({ ac, fl, hc, bpd })) {
    if (v != null && !(v > 0)) throw new Error(`Invalid biometry: ${name} must be > 0`);
  }
  if (ac == null || fl == null) return null; // AC + FL are required by both formulas

  let log10: number;
  let formula: EfwFormula;
  if (hc != null) {
    log10 = 1.326 - 0.00326 * ac * fl + 0.0107 * hc + 0.0438 * ac + 0.158 * fl;
    formula = 'HADLOCK3';
  } else if (bpd != null) {
    log10 = 1.335 - 0.0034 * ac * fl + 0.0316 * bpd + 0.0457 * ac + 0.1623 * fl;
    formula = 'HADLOCK2';
  } else {
    return null;
  }
  return { efwGrams: Math.round(Math.pow(10, log10)), formula };
}
