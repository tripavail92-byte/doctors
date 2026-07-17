// Laterality helpers — normalize the many clinical notations for body side
// into the canonical BodySide, and render side labels per body region.

export type BodySideName = 'LEFT' | 'RIGHT' | 'BILATERAL';

const ALIASES: Record<string, BodySideName> = {
  l: 'LEFT',
  left: 'LEFT',
  os: 'LEFT', // oculus sinister (left eye)
  as: 'LEFT', // auris sinistra (left ear)
  left_eye: 'LEFT',
  left_ear: 'LEFT',
  r: 'RIGHT',
  right: 'RIGHT',
  od: 'RIGHT', // oculus dexter (right eye)
  ad: 'RIGHT', // auris dextra (right ear)
  right_eye: 'RIGHT',
  right_ear: 'RIGHT',
  b: 'BILATERAL',
  bilateral: 'BILATERAL',
  both: 'BILATERAL',
  ou: 'BILATERAL', // oculus uterque (both eyes)
  au: 'BILATERAL', // auris utraque (both ears)
};

/**
 * Normalize a laterality notation (OD/OS eyes, AD/AS ears, L/R limbs, both/OU)
 * to the canonical BodySide. Returns null for absent input, undefined for a
 * non-empty but unrecognised value (so callers can reject it).
 */
export function normalizeSide(
  input?: string | null,
): BodySideName | null | undefined {
  if (input === undefined || input === null || input === '') return null;
  const key = String(input).trim().toLowerCase().replace(/\s+/g, '_');
  return ALIASES[key]; // undefined if not found
}

// Region-appropriate abbreviation (eye -> OD/OS/OU, ear -> AD/AS/AU, else L/R).
export function sideLabel(
  side: BodySideName | null | undefined,
  context?: 'eye' | 'ear',
): string {
  if (!side) return '';
  if (context === 'eye') {
    return side === 'LEFT' ? 'OS' : side === 'RIGHT' ? 'OD' : 'OU';
  }
  if (context === 'ear') {
    return side === 'LEFT' ? 'AS' : side === 'RIGHT' ? 'AD' : 'AU';
  }
  return side === 'LEFT' ? 'L' : side === 'RIGHT' ? 'R' : 'Bilateral';
}
