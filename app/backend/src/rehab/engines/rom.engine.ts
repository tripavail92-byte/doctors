// Range-of-motion deficit engine (pure).
//
// Deficit % vs the normal reference:  >25% = red, 10–25% = amber, <10% = none.

export type DeficitBand = 'none' | 'amber' | 'red';

export interface RomDeficit {
  deficitPct: number;
  band: DeficitBand;
}

export function romDeficit(measuredDegrees: number, normalDegrees: number): RomDeficit {
  if (normalDegrees <= 0) return { deficitPct: 0, band: 'none' };
  const raw = ((normalDegrees - measuredDegrees) / normalDegrees) * 100;
  const deficitPct = Math.round(Math.max(0, raw));
  const band: DeficitBand = deficitPct > 25 ? 'red' : deficitPct >= 10 ? 'amber' : 'none';
  return { deficitPct, band };
}

export interface RomValidation {
  error?: string;
  warn?: string;
}

/**
 * Validate one ROM cell. Values are bounded by the reference ceiling; active
 * exceeding passive is a measurement-order artifact — warn, don't block.
 */
export function validateRom(input: {
  activeDegrees?: number | null;
  passiveDegrees?: number | null;
  maxDegrees: number;
}): RomValidation {
  const { activeDegrees: a, passiveDegrees: p, maxDegrees } = input;
  for (const [label, v] of [
    ['active', a],
    ['passive', p],
  ] as const) {
    if (v != null && (v < 0 || v > maxDegrees)) {
      return { error: `${label} ROM must be 0–${maxDegrees}° (normal-referenced ceiling)` };
    }
  }
  if (a != null && p != null && a > p) {
    return { warn: 'Active ROM exceeds passive — measurement-order artifact suspected' };
  }
  return {};
}
