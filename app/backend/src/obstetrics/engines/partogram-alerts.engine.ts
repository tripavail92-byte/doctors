// WHO Labour Care Guide (LCG, 2020) alert engine (pure).
//
// Two layers:
//  1. Per-entry threshold checks (FHR, contractions, maternal obs).
//  2. Labour-progress check across the append-only entry history against the
//     LCG per-centimetre dilation time-limits (which replaced the old fixed
//     1 cm/h alert line).
//
// Server timestamps are authoritative (client clock is ignored) — the
// partogram is a medico-legal document.
//
// Source: WHO Labour Care Guide & User's Manual (2020).

const MS_PER_HOUR = 3_600_000;

export type AmnioticFluid = 'INTACT' | 'CLEAR' | 'MECONIUM' | 'BLOOD_STAINED' | 'ABSENT';

export interface PartogramEntryObs {
  recordedAt: Date;
  cervicalDilationCm?: number | null;
  contractionsPer10Min?: number | null;
  contractionDurationSec?: number | null;
  fhrBpm?: number | null;
  amnioticFluid?: AmnioticFluid | null;
  moulding?: number | null; // grade 0..3
  maternalPulse?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  temperatureC?: number | null;
}

/** Per-entry LCG threshold breaches. */
export function partogramEntryAlerts(e: PartogramEntryObs): string[] {
  const flags = new Set<string>();

  if (e.fhrBpm != null && (e.fhrBpm < 110 || e.fhrBpm >= 160)) flags.add('FHR_ABNORMAL');

  if (e.contractionsPer10Min != null && (e.contractionsPer10Min <= 2 || e.contractionsPer10Min > 5)) {
    flags.add('CONTRACTION_FREQUENCY');
  }
  if (e.contractionDurationSec != null && (e.contractionDurationSec < 20 || e.contractionDurationSec > 60)) {
    flags.add('CONTRACTION_DURATION');
  }

  if ((e.bpSystolic != null && e.bpSystolic >= 160) || (e.bpDiastolic != null && e.bpDiastolic >= 110)) {
    flags.add('SEVERE_HTN');
  }
  if (e.temperatureC != null && e.temperatureC >= 38) flags.add('FEVER');
  if (e.maternalPulse != null && e.maternalPulse > 120) flags.add('MATERNAL_TACHYCARDIA');
  if (e.amnioticFluid === 'MECONIUM' || e.amnioticFluid === 'BLOOD_STAINED') flags.add('LIQUOR_ABNORMAL');
  if (e.moulding != null && e.moulding >= 3) flags.add('MOULDING_SEVERE');

  return [...flags];
}

// LCG active-phase dilation time-limits: at N cm without progressing beyond N.
const DILATION_LIMIT_HOURS: Record<number, number> = {
  5: 6,
  6: 5,
  7: 3,
  8: 2.5,
  9: 2,
};

const FULL_DILATION_CM = 10;

export interface LabourProgressInput {
  /** All partogram entries (any order); only those with a dilation value are used. */
  entries: PartogramEntryObs[];
  parity: number;
  /** Reference "now"; defaults to the latest entry's recordedAt. */
  asOf?: Date;
}

/**
 * Progress alerts across the labour. Flags PROLONGED_LABOUR when the woman has
 * been at a given active-phase dilation longer than its LCG limit without
 * progressing, and PROLONGED_SECOND_STAGE past the parity-based limit from full
 * dilation.
 */
export function labourProgressAlerts(input: LabourProgressInput): string[] {
  const dilations = input.entries
    .filter((e) => e.cervicalDilationCm != null)
    .map((e) => ({ at: e.recordedAt, cm: e.cervicalDilationCm as number }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (dilations.length === 0) return [];

  const current = dilations[dilations.length - 1];
  // Reference "now" = the latest entry's recordedAt across ALL entries (not just
  // dilation-bearing ones) so a later vitals-only entry still advances the
  // elapsed-time checks. Falls back to the current dilation time if somehow later.
  const latestEntryMs = input.entries.reduce(
    (max, e) => Math.max(max, e.recordedAt.getTime()),
    current.at.getTime(),
  );
  const asOf = input.asOf ?? new Date(latestEntryMs);
  const flags: string[] = [];

  // Second stage: time since FIRST reaching full dilation.
  if (current.cm >= FULL_DILATION_CM) {
    const firstFull = dilations.find((d) => d.cm >= FULL_DILATION_CM)!;
    const hrs = (asOf.getTime() - firstFull.at.getTime()) / MS_PER_HOUR;
    const limit = input.parity > 0 ? 2 : 3; // parous 2 h, nulliparous 3 h
    if (hrs >= limit) flags.push('PROLONGED_SECOND_STAGE');
    return flags;
  }

  // Active phase: still at current cm (5..9) beyond its limit without progressing.
  const limit = DILATION_LIMIT_HOURS[current.cm];
  if (limit != null) {
    // Time since first reaching the current dilation value.
    const firstAtCurrent = dilations.find((d) => d.cm === current.cm)!;
    const hrs = (asOf.getTime() - firstAtCurrent.at.getTime()) / MS_PER_HOUR;
    if (hrs >= limit) flags.push('PROLONGED_LABOUR');
  }
  return flags;
}
