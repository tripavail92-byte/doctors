// Periodontal charting engine (pure).
//
// Six sites per tooth, ordered [DB, B, MB, DL, L, ML]. Clinical attachment loss
// (CAL) = pocket depth + recession at each site. Summaries drive the perio
// diagnosis hint (2017 AAP/EFP staging, simplified) and the BPE screen read.

export const PERIO_SITES = ['DB', 'B', 'MB', 'DL', 'L', 'ML'] as const;

export interface PerioToothInput {
  toothFdi: string;
  pocketMm: number[]; // 6
  recessionMm: number[]; // 6
  bleeding: boolean[]; // 6
  suppuration?: boolean[]; // 6
  plaque?: boolean[]; // 6
  furcation?: 'NONE' | 'I' | 'II' | 'III';
  mobility?: number | null;
}

export interface PerioToothSummary {
  toothFdi: string;
  cal: number[]; // per-site CAL
  maxPocket: number;
  maxCal: number;
  bleedingSites: number;
}

export interface PerioSummary {
  teeth: PerioToothSummary[];
  sitesTotal: number;
  bleedingSites: number;
  /** Bleeding on probing %, 0..100. */
  bopPercent: number;
  maxPocketMm: number;
  maxCalMm: number;
  /** Simplified AAP/EFP 2017 stage from worst interdental CAL. */
  stage: 'Health/Gingivitis' | 'Stage I' | 'Stage II' | 'Stage III' | 'Stage IV';
  worstFurcation: 'NONE' | 'I' | 'II' | 'III';
}

const SITE_COUNT = 6;

/** Validate a six-site array (length + numeric/boolean bounds). */
export function validateSites(name: string, arr: unknown[], kind: 'mm' | 'bool'): string | null {
  if (!Array.isArray(arr) || arr.length !== SITE_COUNT) {
    return `${name} must have exactly ${SITE_COUNT} sites`;
  }
  for (const v of arr) {
    if (kind === 'mm') {
      if (typeof v !== 'number' || v < 0 || v > 20) return `${name} values must be 0-20 mm`;
    } else if (typeof v !== 'boolean') {
      return `${name} values must be booleans`;
    }
  }
  return null;
}

function stageFromCal(maxCal: number): PerioSummary['stage'] {
  if (maxCal < 1) return 'Health/Gingivitis';
  if (maxCal <= 2) return 'Stage I';
  if (maxCal <= 4) return 'Stage II';
  if (maxCal <= 5) return 'Stage III';
  return 'Stage IV';
}

const FURCATION_RANK = { NONE: 0, I: 1, II: 2, III: 3 } as const;

export function summarizePerio(teeth: PerioToothInput[]): PerioSummary {
  const toothSummaries: PerioToothSummary[] = [];
  let sitesTotal = 0;
  let bleedingSites = 0;
  let maxPocketMm = 0;
  let maxCalMm = 0;
  let worstFurcation: 'NONE' | 'I' | 'II' | 'III' = 'NONE';

  for (const t of teeth) {
    const cal = t.pocketMm.map((p, i) => p + (t.recessionMm[i] ?? 0));
    const maxPocket = Math.max(0, ...t.pocketMm);
    const maxCal = Math.max(0, ...cal);
    const bleeds = t.bleeding.filter(Boolean).length;
    toothSummaries.push({ toothFdi: t.toothFdi, cal, maxPocket, maxCal, bleedingSites: bleeds });

    sitesTotal += SITE_COUNT;
    bleedingSites += bleeds;
    maxPocketMm = Math.max(maxPocketMm, maxPocket);
    maxCalMm = Math.max(maxCalMm, maxCal);
    const f = t.furcation ?? 'NONE';
    if (FURCATION_RANK[f] > FURCATION_RANK[worstFurcation]) worstFurcation = f;
  }

  const bopPercent = sitesTotal > 0 ? Math.round((bleedingSites / sitesTotal) * 1000) / 10 : 0;

  return {
    teeth: toothSummaries,
    sitesTotal,
    bleedingSites,
    bopPercent,
    maxPocketMm,
    maxCalMm,
    stage: stageFromCal(maxCalMm),
    worstFurcation,
  };
}

/** BPE sextant screen (codes 0-4) -> overall worst code + guidance. */
export function interpretBpe(sextants: number[]): { worst: number; advice: string } {
  const worst = sextants.length ? Math.max(...sextants) : 0;
  const advice =
    worst >= 4
      ? 'Comprehensive perio assessment + full pocket charting'
      : worst === 3
        ? 'Full pocket charting of affected sextants'
        : worst === 2
          ? 'Oral hygiene instruction + supragingival scaling'
          : worst === 1
            ? 'Oral hygiene instruction'
            : 'No treatment need';
  return { worst, advice };
}
