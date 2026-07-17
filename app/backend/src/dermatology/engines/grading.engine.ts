// Dermatology grading engines.
//
// Region-weighted severity scores that the generic Scored-Instrument engine
// (sum/weighted/percent) cannot express: each of these multiplies per-region
// sign scores by an area score AND a region weight. Results still persist to
// the shared ScoredInstrumentResponse table — no bespoke tables.
//
// Every score here is clinician-entered decision support. Severity bands are
// COMPUTED, never accepted from the client.

export type Band = 'clear' | 'almost_clear' | 'mild' | 'moderate' | 'severe' | 'very_severe';

export interface GradingResult {
  key: string;
  score: number;
  band: Band | null;
  /** Per-region (or per-component) contributions, for the UI's bars + audit. */
  subscores: Record<string, number>;
  max: number;
  /** Notes the engine wants surfaced (e.g. why no band exists). */
  notes?: string[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

function req(v: unknown, label: string, lo: number, hi: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`${label} is required and must be a number`);
  }
  if (v < lo || v > hi) throw new Error(`${label} must be ${lo}-${hi} (got ${v})`);
  return v;
}

// Area score 0-6 is an ordinal band of % involvement, not a percentage.
export const AREA_BANDS = [
  { score: 0, label: '0%' },
  { score: 1, label: '<10%' },
  { score: 2, label: '10-29%' },
  { score: 3, label: '30-49%' },
  { score: 4, label: '50-69%' },
  { score: 5, label: '70-89%' },
  { score: 6, label: '90-100%' },
];

// ---------------------------------------------------------------------------
// GAGS — Global Acne Grading System. Local = region factor x lesion grade.
// ---------------------------------------------------------------------------

export const GAGS_REGIONS = [
  { key: 'forehead', label: 'Forehead', factor: 2 },
  { key: 'cheek_r', label: 'Right cheek', factor: 2 },
  { key: 'cheek_l', label: 'Left cheek', factor: 2 },
  { key: 'nose', label: 'Nose', factor: 1 },
  { key: 'chin', label: 'Chin', factor: 1 },
  { key: 'chest_back', label: 'Chest and back', factor: 3 },
];

export const GAGS_LESIONS = [
  { grade: 0, label: 'None' },
  { grade: 1, label: 'Comedones' },
  { grade: 2, label: 'Papules' },
  { grade: 3, label: 'Pustules' },
  { grade: 4, label: 'Nodules' },
];

/** GAGS 0-44. Bands: 1-18 mild, 19-30 moderate, 31-38 severe, >=39 very severe. */
export function scoreGags(input: Record<string, number>): GradingResult {
  const subscores: Record<string, number> = {};
  let total = 0;
  for (const r of GAGS_REGIONS) {
    const grade = req(input[r.key], `GAGS region "${r.key}"`, 0, 4);
    const local = r.factor * grade;
    subscores[r.key] = local;
    total += local;
  }
  let band: Band;
  if (total === 0) band = 'clear';
  else if (total <= 18) band = 'mild';
  else if (total <= 30) band = 'moderate';
  else if (total <= 38) band = 'severe';
  else band = 'very_severe';
  return { key: 'gags', score: total, band, subscores, max: 44 };
}

// ---------------------------------------------------------------------------
// PASI — Psoriasis Area and Severity Index.
// Per region: (erythema + induration + desquamation) x area(0-6) x weight.
// Signs are 0-4. Max = 12 x 6 x 1.0 = 72.
// ---------------------------------------------------------------------------

export const PASI_REGIONS = [
  { key: 'head', label: 'Head and neck', weight: 0.1 },
  { key: 'upper_limbs', label: 'Upper limbs', weight: 0.2 },
  { key: 'trunk', label: 'Trunk', weight: 0.3 },
  { key: 'lower_limbs', label: 'Lower limbs', weight: 0.4 },
];

export interface PasiRegionInput {
  area: number; // 0-6 band
  erythema: number; // 0-4
  induration: number; // 0-4
  desquamation: number; // 0-4
}

export function scorePasi(input: Record<string, PasiRegionInput>): GradingResult {
  const subscores: Record<string, number> = {};
  let total = 0;
  for (const r of PASI_REGIONS) {
    const v = input[r.key];
    if (!v) throw new Error(`PASI region "${r.key}" is required (partial entry cannot be scored)`);
    const area = req(v.area, `PASI ${r.key} area`, 0, 6);
    const e = req(v.erythema, `PASI ${r.key} erythema`, 0, 4);
    const i = req(v.induration, `PASI ${r.key} induration`, 0, 4);
    const d = req(v.desquamation, `PASI ${r.key} desquamation`, 0, 4);
    const contrib = (e + i + d) * area * r.weight;
    subscores[r.key] = round2(contrib);
    total += contrib;
  }
  const score = round1(total);
  // "Rule of tens" convention: >10 = severe. Below that, 5-10 moderate.
  let band: Band;
  if (score === 0) band = 'clear';
  else if (score < 5) band = 'mild';
  else if (score <= 10) band = 'moderate';
  else band = 'severe';
  return { key: 'pasi', score, band, subscores, max: 72 };
}

// ---------------------------------------------------------------------------
// EASI — Eczema Area and Severity Index.
// Per region: (erythema + induration/papulation + excoriation + lichenification)
//             x area(0-6) x weight.
//
// NOTE ON A SPEC DEVIATION: the build spec says EASI signs are scored 0-4 AND
// that the total is 0-72. Those are mutually inconsistent — 4 signs at 0-4 give
// (4x4) x 6 x 1.0 = 96, not 72. Published EASI grades each sign 0-3, which
// yields the documented 72 ceiling. We implement the clinically correct 0-3.
// ---------------------------------------------------------------------------

export const EASI_REGIONS_ADULT = [
  { key: 'head', label: 'Head and neck', weight: 0.1 },
  { key: 'upper_limbs', label: 'Upper limbs', weight: 0.2 },
  { key: 'trunk', label: 'Trunk', weight: 0.3 },
  { key: 'lower_limbs', label: 'Lower limbs', weight: 0.4 },
];

// Children <=7y carry proportionally more head and less leg.
export const EASI_REGIONS_CHILD = [
  { key: 'head', label: 'Head and neck', weight: 0.2 },
  { key: 'upper_limbs', label: 'Upper limbs', weight: 0.2 },
  { key: 'trunk', label: 'Trunk', weight: 0.3 },
  { key: 'lower_limbs', label: 'Lower limbs', weight: 0.3 },
];

export interface EasiRegionInput {
  area: number; // 0-6
  erythema: number; // 0-3
  induration: number; // 0-3 (induration/papulation)
  excoriation: number; // 0-3
  lichenification: number; // 0-3
}

export function scoreEasi(
  input: Record<string, EasiRegionInput>,
  opts: { child?: boolean } = {},
): GradingResult {
  const regions = opts.child ? EASI_REGIONS_CHILD : EASI_REGIONS_ADULT;
  const subscores: Record<string, number> = {};
  let total = 0;
  for (const r of regions) {
    const v = input[r.key];
    if (!v) throw new Error(`EASI region "${r.key}" is required (partial entry cannot be scored)`);
    const area = req(v.area, `EASI ${r.key} area`, 0, 6);
    const e = req(v.erythema, `EASI ${r.key} erythema`, 0, 3);
    const i = req(v.induration, `EASI ${r.key} induration/papulation`, 0, 3);
    const x = req(v.excoriation, `EASI ${r.key} excoriation`, 0, 3);
    const l = req(v.lichenification, `EASI ${r.key} lichenification`, 0, 3);
    const contrib = (e + i + x + l) * area * r.weight;
    subscores[r.key] = round2(contrib);
    total += contrib;
  }
  const score = round1(total);
  // Leshem et al. validated EASI strata.
  let band: Band;
  if (score === 0) band = 'clear';
  else if (score <= 1.0) band = 'almost_clear';
  else if (score <= 7.0) band = 'mild';
  else if (score <= 21.0) band = 'moderate';
  else if (score <= 50.0) band = 'severe';
  else band = 'very_severe';
  return {
    key: 'easi',
    score,
    band,
    subscores,
    max: 72,
    notes: [opts.child ? 'Child (<=7y) region weights applied' : 'Adult region weights applied'],
  };
}

// ---------------------------------------------------------------------------
// SCORAD — SCORing Atopic Dermatitis.  Score = A/5 + 7B/2 + C  (0-103)
//   A = extent %BSA (rule of nines), 0-100
//   B = 6 intensity signs, 0-3 each  -> 0-18
//   C = 2 VAS (pruritus, sleeplessness), 0-10 each -> 0-20
// ---------------------------------------------------------------------------

export const SCORAD_SIGNS = [
  'erythema',
  'oedema_papulation',
  'oozing_crust',
  'excoriation',
  'lichenification',
  'dryness',
] as const;

export interface ScoradInput {
  extentPct: number; // A
  signs: Record<string, number>; // B, each 0-3
  pruritusVas: number; // C1
  sleeplessVas: number; // C2
}

export function scoreScorad(input: ScoradInput): GradingResult {
  const a = req(input.extentPct, 'SCORAD extent %BSA', 0, 100);
  let b = 0;
  const signSubs: Record<string, number> = {};
  for (const s of SCORAD_SIGNS) {
    const v = req(input.signs?.[s], `SCORAD sign "${s}"`, 0, 3);
    signSubs[s] = v;
    b += v;
  }
  const c1 = req(input.pruritusVas, 'SCORAD pruritus VAS', 0, 10);
  const c2 = req(input.sleeplessVas, 'SCORAD sleeplessness VAS', 0, 10);
  const c = c1 + c2;

  const score = round1(a / 5 + (7 * b) / 2 + c);
  let band: Band;
  if (score === 0) band = 'clear'; // consistent with PASI/EASI/GAGS
  else if (score < 25) band = 'mild';
  else if (score <= 50) band = 'moderate';
  else band = 'severe';

  return {
    key: 'scorad',
    score,
    band,
    subscores: { A_extent: round1(a / 5), B_intensity: round1((7 * b) / 2), C_subjective: c, ...signSubs },
    max: 103,
  };
}

// ---------------------------------------------------------------------------
// MASI — Melasma Area and Severity Index.
// Per region: area(0-6) x (darkness(0-4) + homogeneity(0-4)) x weight. Max 48.
// mMASI drops homogeneity: area x darkness x weight. Max 24.
// ---------------------------------------------------------------------------

export const MASI_REGIONS = [
  { key: 'forehead', label: 'Forehead', weight: 0.3 },
  { key: 'malar_r', label: 'Right malar', weight: 0.3 },
  { key: 'malar_l', label: 'Left malar', weight: 0.3 },
  { key: 'chin', label: 'Chin', weight: 0.1 },
];

export interface MasiRegionInput {
  area: number; // 0-6
  darkness: number; // 0-4
  homogeneity?: number; // 0-4, omitted for mMASI
}

export function scoreMasi(
  input: Record<string, MasiRegionInput>,
  opts: { modified?: boolean } = {},
): GradingResult {
  const subscores: Record<string, number> = {};
  let total = 0;
  for (const r of MASI_REGIONS) {
    const v = input[r.key];
    if (!v) throw new Error(`MASI region "${r.key}" is required (partial entry cannot be scored)`);
    const area = req(v.area, `MASI ${r.key} area`, 0, 6);
    const d = req(v.darkness, `MASI ${r.key} darkness`, 0, 4);
    let contrib: number;
    if (opts.modified) {
      contrib = area * d * r.weight;
    } else {
      const h = req(v.homogeneity, `MASI ${r.key} homogeneity`, 0, 4);
      contrib = area * (d + h) * r.weight;
    }
    subscores[r.key] = round2(contrib);
    total += contrib;
  }
  return {
    key: opts.modified ? 'mmasi' : 'masi',
    score: round1(total),
    // Deliberately null: MASI/mMASI have no consensus severity cut-offs in the
    // literature. Inventing thresholds would present made-up numbers as
    // clinical guidance. Track change over time instead (Trends engine).
    band: null,
    subscores,
    max: opts.modified ? 24 : 48,
    notes: ['MASI has no validated severity bands; interpret as change over time.'],
  };
}

// ---------------------------------------------------------------------------
// VASI — Vitiligo Area Scoring Index.
// Per site: hand units (1 HU ~= 1% BSA) x residual depigmentation fraction.
// T-VASI 0-100 (whole body ~= 100 hand units).
// ---------------------------------------------------------------------------

// Regions MUST be mutually exclusive and sum to 100 hand units.
//
// The first cut of this table used whole-limb rule-of-nines values (upper 18,
// lower 36) AND a separate hands_feet 8 — but the limb figures already contain
// hands and feet, so they were double-counted and the true ceiling was 107
// against a declared max of 100. Since VASI response is read as % change in
// T-VASI, an inflated baseline distorts every treatment-response reading.
//
// Hands and feet are split out deliberately: acral vitiligo responds
// differently and is scored separately in the published instrument.
//
// CLINICAL REVIEW REQUIRED: these per-region caps are derived from the rule of
// nines (arms 9 each incl. ~2.5 hand; legs 18 each incl. ~2.5 foot) and are
// self-consistent, but they have NOT been checked against the Hamzavi (2004)
// source table. A dermatologist must confirm before this is used on patients.
export const VASI_REGIONS = [
  { key: 'head_neck', label: 'Head and neck', maxHandUnits: 9 },
  { key: 'hands', label: 'Hands', maxHandUnits: 5 },
  { key: 'upper_limbs', label: 'Upper limbs (excl. hands)', maxHandUnits: 13 },
  { key: 'trunk', label: 'Trunk', maxHandUnits: 36 },
  { key: 'feet', label: 'Feet', maxHandUnits: 5 },
  { key: 'lower_limbs', label: 'Lower limbs (excl. feet)', maxHandUnits: 31 },
  { key: 'genitalia', label: 'Genitalia', maxHandUnits: 1 },
];

// 1 hand unit ~= 1% BSA, so a whole-body T-VASI is 100. Asserted at module load
// rather than trusted: an overlapping region table is invisible in every test
// that scores less than the whole body — which is every realistic test.
export const VASI_MAX = VASI_REGIONS.reduce((sum, r) => sum + r.maxHandUnits, 0);
if (VASI_MAX !== 100) {
  throw new Error(
    `VASI_REGIONS must partition the body into 100 hand units; got ${VASI_MAX}. ` +
      `Overlapping regions inflate T-VASI and corrupt every % -change reading.`,
  );
}

// Residual depigmentation is graded on a fixed ordinal set, not free entry.
export const VASI_DEPIGMENTATION = [0, 10, 25, 50, 75, 90, 100];

export interface VasiRegionInput {
  handUnits: number;
  depigmentationPct: number; // must be one of VASI_DEPIGMENTATION
}

export function scoreVasi(input: Record<string, VasiRegionInput>): GradingResult {
  const subscores: Record<string, number> = {};
  let total = 0;
  for (const r of VASI_REGIONS) {
    const v = input[r.key];
    if (!v) {
      subscores[r.key] = 0;
      continue; // an uninvolved site is legitimately absent
    }
    const hu = req(v.handUnits, `VASI ${r.key} hand units`, 0, r.maxHandUnits);
    const dep = v.depigmentationPct;
    if (!VASI_DEPIGMENTATION.includes(dep)) {
      throw new Error(
        `VASI ${r.key} depigmentation must be one of ${VASI_DEPIGMENTATION.join('/')}% (got ${dep})`,
      );
    }
    const contrib = hu * (dep / 100);
    subscores[r.key] = round2(contrib);
    total += contrib;
  }
  return {
    key: 'vasi',
    score: round1(total),
    // As with MASI: no validated severity bands for VASI. Response is measured
    // as % change in T-VASI over time, not by a band.
    band: null,
    subscores,
    max: VASI_MAX,
    notes: ['VASI has no validated severity bands; response = % change in T-VASI.'],
  };
}

// ---------------------------------------------------------------------------
// Dispatcher — one entry point for the controller.
// ---------------------------------------------------------------------------

export const GRADING_INSTRUMENTS = ['gags', 'pasi', 'easi', 'scorad', 'masi', 'mmasi', 'vasi'];

export function scoreGrading(
  key: string,
  answers: Record<string, unknown>,
  opts: { child?: boolean } = {},
): GradingResult {
  switch (key.toLowerCase()) {
    case 'gags':
      return scoreGags(answers as Record<string, number>);
    case 'pasi':
      return scorePasi(answers as unknown as Record<string, PasiRegionInput>);
    case 'easi':
      return scoreEasi(answers as unknown as Record<string, EasiRegionInput>, opts);
    case 'scorad':
      return scoreScorad(answers as unknown as ScoradInput);
    case 'masi':
      return scoreMasi(answers as unknown as Record<string, MasiRegionInput>);
    case 'mmasi':
      return scoreMasi(answers as unknown as Record<string, MasiRegionInput>, { modified: true });
    case 'vasi':
      return scoreVasi(answers as unknown as Record<string, VasiRegionInput>);
    default:
      throw new Error(`Unknown dermatology grading instrument "${key}"`);
  }
}
