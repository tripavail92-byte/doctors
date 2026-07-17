// Visual-acuity notation & logMAR conversion (pure).
//
//   logMAR = log10(denominator / numerator)   → 6/6 = 0.00, 6/12 = 0.30, 6/60 = 1.00
//   (Snellen 20/x identical: 20/20 = 0, 20/40 = 0.30)
// Low-vision tokens map to a monotone worse-is-higher logMAR so VA trends sort
// correctly (Bach/Lange convention).

export const LOWVISION_LOGMAR: Record<string, number> = { CF: 2.0, HM: 3.0, PL: 4.0, NPL: 5.0 };

export type VaParse =
  | { kind: 'snellen'; numerator: number; denominator: number; logmar: number }
  | { kind: 'logmar'; logmar: number }
  | { kind: 'lowvision'; token: 'CF' | 'HM' | 'PL' | 'NPL'; logmar: number };

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function snellenToLogmar(num: number, den: number): number {
  return round2(Math.log10(den / num));
}

/** Parse a VA string (Snellen "6/12" or "20/40", decimal logMAR "0.30", or CF/HM/PL/NPL). */
export function parseVa(input: string): VaParse | null {
  const s = input.trim().toUpperCase();
  const lv = s.replace(/@.*$/, '').trim(); // drop "CF@1m" distance suffix
  if (lv in LOWVISION_LOGMAR) {
    return { kind: 'lowvision', token: lv as 'CF' | 'HM' | 'PL' | 'NPL', logmar: LOWVISION_LOGMAR[lv] };
  }
  const snellen = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (snellen) {
    const num = parseFloat(snellen[1]);
    const den = parseFloat(snellen[2]);
    if (num > 0 && den > 0) return { kind: 'snellen', numerator: num, denominator: den, logmar: snellenToLogmar(num, den) };
    return null;
  }
  const dec = s.match(/^-?\d+(?:\.\d+)?$/);
  if (dec) {
    const v = parseFloat(s);
    if (v >= -0.3 && v <= 5) return { kind: 'logmar', logmar: round2(v) };
  }
  return null;
}

export function toLogmar(input: string): number | null {
  return parseVa(input)?.logmar ?? null;
}

/**
 * Pinhole-improvement rule: an improvement of ≥ 0.20 logMAR (~2 Snellen lines)
 * on pinhole suggests a refractive cause; less suggests possible pathology.
 */
export function pinholeHint(unaidedLogmar: number, pinholeLogmar: number): 'refractive' | 'suspect_pathology' {
  return unaidedLogmar - pinholeLogmar >= 0.2 ? 'refractive' : 'suspect_pathology';
}
