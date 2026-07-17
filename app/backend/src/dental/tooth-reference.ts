// FDI (ISO 3950) dentition + the condition catalog that drives the odontogram
// and the DMFT index.
//
// Both dentitions are here: permanent (quadrants 1-4, teeth 11-48) and primary
// (quadrants 5-8, teeth 51-85). A paediatric dental clinic charting a 4-year-old
// has no permanent teeth to record, so a permanent-only reference made the
// odontogram unusable for exactly the patients the Pediatrics pack targets.

export interface ToothRef {
  fdi: string; // '11'..'48'
  quadrant: number; // 1 upper-right, 2 upper-left, 3 lower-left, 4 lower-right
  type: string;
}

const TYPES = [
  'Central incisor',
  'Lateral incisor',
  'Canine',
  '1st premolar',
  '2nd premolar',
  '1st molar',
  '2nd molar',
  '3rd molar',
];

function quadrant(q: number): ToothRef[] {
  return TYPES.map((type, i) => ({ fdi: `${q}${i + 1}`, quadrant: q, type }));
}

// 32 permanent teeth: 11-18, 21-28, 31-38, 41-48.
export const FDI_PERMANENT: ToothRef[] = [1, 2, 3, 4].flatMap(quadrant);

// Primary teeth have no premolars and no third molar — 5 per quadrant, not 8.
const PRIMARY_TYPES = [
  'Central incisor',
  'Lateral incisor',
  'Canine',
  '1st molar',
  '2nd molar',
];

function primaryQuadrant(q: number): ToothRef[] {
  return PRIMARY_TYPES.map((type, i) => ({ fdi: `${q}${i + 1}`, quadrant: q, type }));
}

// 20 primary teeth: 51-55, 61-65, 71-75, 81-85.
export const FDI_PRIMARY: ToothRef[] = [5, 6, 7, 8].flatMap(primaryQuadrant);

export type DmftCategory = 'D' | 'M' | 'F' | null;

export interface ToothCondition {
  code: string;
  label: string;
  dmft: DmftCategory; // contribution to the DMFT index
  color: string; // odontogram fill hint
}

export const TOOTH_CONDITIONS: ToothCondition[] = [
  { code: 'healthy', label: 'Healthy', dmft: null, color: '#e7eaeb' },
  { code: 'caries', label: 'Caries (decayed)', dmft: 'D', color: '#D92D20' },
  { code: 'filled', label: 'Filled', dmft: 'F', color: '#2F6FEB' },
  { code: 'crown', label: 'Crown', dmft: 'F', color: '#C79A3A' },
  { code: 'root_canal', label: 'Root canal treated', dmft: 'F', color: '#6E2C57' },
  { code: 'missing', label: 'Missing', dmft: 'M', color: '#8a979c' },
  { code: 'implant', label: 'Implant', dmft: 'M', color: '#0E7C74' },
  { code: 'extraction_indicated', label: 'For extraction', dmft: null, color: '#E8590C' },
  { code: 'sealant', label: 'Sealant', dmft: null, color: '#1E9E6A' },
  // Mobility is a periodontal finding, not decay — it carries a Miller grade
  // (0-3) on the finding and contributes nothing to DMFT. Without this code the
  // ToothFinding.mobilityGrade field was unreachable: its guard required a
  // condition that did not exist.
  { code: 'mobile', label: 'Mobile (Miller grade)', dmft: null, color: '#B54708' },
];

// Valid tooth surfaces (MODBL).
export const SURFACES = ['M', 'O', 'D', 'B', 'L'] as const;

const CONDITION_CODES = new Set(TOOTH_CONDITIONS.map((c) => c.code));
const FDI_CODES = new Set(FDI_PERMANENT.map((t) => t.fdi));

export const isValidCondition = (c: string): boolean => CONDITION_CODES.has(c);
export const isValidTooth = (fdi: string): boolean => FDI_CODES.has(fdi);

const PRIMARY_CODES = new Set(FDI_PRIMARY.map((t) => t.fdi));
export const isValidPrimaryTooth = (fdi: string): boolean => PRIMARY_CODES.has(fdi);
/** Accepts either dentition — use this wherever a child may be charted. */
export const isValidToothAny = (fdi: string): boolean =>
  isValidTooth(fdi) || isValidPrimaryTooth(fdi);

export function toothTypeOf(fdi: string): 'PERMANENT' | 'PRIMARY' | null {
  if (FDI_CODES.has(fdi)) return 'PERMANENT';
  if (PRIMARY_CODES.has(fdi)) return 'PRIMARY';
  return null;
}

/**
 * Side from the quadrant digit. Quadrants 1/4 (and primary 5/8) are the
 * patient's RIGHT; 2/3 (and 6/7) are the LEFT.
 *
 * Deriving it — rather than accepting it — is what stops a wrong-site record:
 * the tooth number already says which side it is on, so a clinician cannot
 * chart tooth 11 and label it LEFT.
 */
export function archSideOf(fdi: string): 'LEFT' | 'RIGHT' | null {
  const q = Number(fdi[0]);
  if (q === 1 || q === 4 || q === 5 || q === 8) return 'RIGHT';
  if (q === 2 || q === 3 || q === 6 || q === 7) return 'LEFT';
  return null;
}
export const dmftOf = (condition: string): DmftCategory =>
  TOOTH_CONDITIONS.find((c) => c.code === condition)?.dmft ?? null;
