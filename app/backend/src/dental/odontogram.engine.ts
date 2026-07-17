import { dmftOf, FDI_PERMANENT } from './tooth-reference';

export interface ToothState {
  fdi: string;
  quadrant: number;
  type: string;
  condition: string;
  surfaces: string[];
  note: string | null;
}

export interface DmftIndex {
  decayed: number;
  missing: number;
  filled: number;
  dmft: number; // D + M + F
  soundTeeth: number;
}

export interface Odontogram {
  teeth: ToothState[];
  dmft: DmftIndex;
}

interface ToothRecordLike {
  toothFdi: string;
  condition: string;
  surfaces?: unknown;
  note?: string | null;
}

/**
 * Build the full 32-tooth chart from the sparse set of charted records (teeth
 * with no record default to healthy), and compute the WHO DMFT index
 * (Decayed + Missing + Filled teeth) — the standard measure of caries burden.
 */
export function buildOdontogram(records: ToothRecordLike[]): Odontogram {
  const byTooth = new Map(records.map((r) => [r.toothFdi, r]));

  const teeth: ToothState[] = FDI_PERMANENT.map((t) => {
    const rec = byTooth.get(t.fdi);
    return {
      fdi: t.fdi,
      quadrant: t.quadrant,
      type: t.type,
      condition: rec?.condition ?? 'healthy',
      surfaces: Array.isArray(rec?.surfaces) ? (rec!.surfaces as string[]) : [],
      note: rec?.note ?? null,
    };
  });

  let decayed = 0;
  let missing = 0;
  let filled = 0;
  for (const t of teeth) {
    const cat = dmftOf(t.condition);
    if (cat === 'D') decayed++;
    else if (cat === 'M') missing++;
    else if (cat === 'F') filled++;
  }
  const dmft = decayed + missing + filled;

  return {
    teeth,
    dmft: { decayed, missing, filled, dmft, soundTeeth: teeth.length - dmft },
  };
}
