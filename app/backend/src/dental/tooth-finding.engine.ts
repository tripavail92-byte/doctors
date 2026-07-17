import { dmftOf, ToothRef } from './tooth-reference';

// Reduce the append-only finding chain to a current chart.
//
// The chain is the truth; this is a projection of it. Keeping the reduction
// pure (no DB, no dates from the clock) means the chart shown to a clinician is
// reproducible from the rows alone — which is what makes the history worth
// keeping in the first place.

export interface FindingRow {
  id: string;
  toothFdi: string;
  surfaces: string[];
  condition: string;
  status: string;
  supersededById: string | null;
  createdAt: Date;
}

export interface ChartEntry {
  toothFdi: string;
  condition: string;
  surfaces: string[];
  status: string;
  recordedAt: Date;
  /** How many findings this tooth has accumulated, superseded ones included. */
  historyCount: number;
}

/**
 * The active tip per tooth: the newest finding that nothing supersedes.
 *
 * Ties on createdAt are broken by id so the projection is deterministic — two
 * findings recorded in the same millisecond (a bulk chart import) must not make
 * the chart flicker between renders.
 */
export function currentChart(rows: FindingRow[]): ChartEntry[] {
  const byTooth = new Map<string, FindingRow[]>();
  for (const r of rows) {
    byTooth.set(r.toothFdi, [...(byTooth.get(r.toothFdi) ?? []), r]);
  }

  const out: ChartEntry[] = [];
  for (const [toothFdi, all] of byTooth) {
    const active = all
      .filter((r) => r.supersededById === null)
      .sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1),
      );
    if (!active.length) continue; // every finding superseded and nothing re-tipped
    const tip = active[0];
    out.push({
      toothFdi,
      condition: tip.condition,
      surfaces: tip.surfaces,
      status: tip.status,
      recordedAt: tip.createdAt,
      historyCount: all.length,
    });
  }
  return out.sort((a, b) => a.toothFdi.localeCompare(b.toothFdi));
}

/**
 * DMFT over the CURRENT chart.
 *
 * Counted from the projection, not the raw chain: a tooth that was carious and
 * has since been filled must count once as F, not once as D and once as F.
 * Only permanent teeth count toward DMFT — the primary-dentition index is dmft
 * (lowercase) and is a separate measure, so mixing them would inflate both.
 */
export function dmftFromChart(
  chart: ChartEntry[],
  isPermanent: (fdi: string) => boolean,
): { D: number; M: number; F: number; total: number; teethScored: number } {
  let D = 0;
  let M = 0;
  let F = 0;
  let teethScored = 0;
  for (const e of chart) {
    if (!isPermanent(e.toothFdi)) continue;
    teethScored++;
    const cat = dmftOf(e.condition);
    if (cat === 'D') D++;
    else if (cat === 'M') M++;
    else if (cat === 'F') F++;
  }
  return { D, M, F, total: D + M + F, teethScored };
}

/** The teeth a chart of this dentition should cover, for completeness display. */
export function expectedTeeth(refs: ToothRef[]): string[] {
  return refs.map((r) => r.fdi);
}
