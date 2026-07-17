// ANC alert-rule engine (pure). Computed server-side on every AncVisit save —
// never client-only — so the clinical safety net can't be bypassed by a
// tampered client. Thresholds follow WHO ANC guidance.

export type Dipstick = 'NIL' | 'TRACE' | 'PLUS_1' | 'PLUS_2' | 'PLUS_3' | 'PLUS_4';
export type Presentation =
  | 'CEPHALIC'
  | 'BREECH'
  | 'TRANSVERSE'
  | 'OBLIQUE'
  | 'UNSTABLE'
  | 'NOT_ASSESSED';

export interface AncVisitVitals {
  gaWeeks?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  hbGdl?: number | null;
  fhrBpm?: number | null;
  presentation?: Presentation | null;
  fundalHeightCm?: number | null;
  urineAlbumin?: Dipstick | null;
}

/** Dipstick albumin of +1 or higher counts as significant proteinuria. */
function proteinuriaPositive(d?: Dipstick | null): boolean {
  return d === 'PLUS_1' || d === 'PLUS_2' || d === 'PLUS_3' || d === 'PLUS_4';
}

/**
 * Compute the ANC alert flags for a visit. Order is stable and de-duplicated.
 * Flags (mirroring the pack safety spec):
 *   HTN, SEVERE_HTN, PRE_ECLAMPSIA_SUSPECT, PROTEINURIA,
 *   ANEMIA, SEVERE_ANEMIA, FHR_ABNORMAL, MALPRESENTATION_LATE, SFH_LAG
 */
export function computeAncAlerts(v: AncVisitVitals): string[] {
  const flags = new Set<string>();

  // Blood pressure. Either systolic or diastolic breaching sets the flag.
  const sys = v.bpSystolic ?? null;
  const dia = v.bpDiastolic ?? null;
  const htn = (sys != null && sys >= 140) || (dia != null && dia >= 90);
  const severeHtn = (sys != null && sys >= 160) || (dia != null && dia >= 110);
  if (htn) flags.add('HTN');
  if (severeHtn) flags.add('SEVERE_HTN');

  // Proteinuria + HTN ⇒ suspected pre-eclampsia.
  if (proteinuriaPositive(v.urineAlbumin)) {
    flags.add('PROTEINURIA');
    if (htn) flags.add('PRE_ECLAMPSIA_SUSPECT');
  }

  // Anaemia (WHO pregnancy thresholds).
  if (v.hbGdl != null) {
    if (v.hbGdl < 7) flags.add('SEVERE_ANEMIA');
    else if (v.hbGdl < 11) flags.add('ANEMIA');
  }

  // Fetal heart rate.
  if (v.fhrBpm != null && (v.fhrBpm < 110 || v.fhrBpm > 160)) {
    flags.add('FHR_ABNORMAL');
  }

  // Malpresentation at/after 36 weeks.
  if (
    v.gaWeeks != null &&
    v.gaWeeks >= 36 &&
    v.presentation != null &&
    v.presentation !== 'CEPHALIC' &&
    v.presentation !== 'NOT_ASSESSED'
  ) {
    flags.add('MALPRESENTATION_LATE');
  }

  // Symphysis-fundal height lag (only meaningful from ~24 weeks; expected ≈ GA cm).
  if (v.gaWeeks != null && v.gaWeeks >= 24 && v.fundalHeightCm != null) {
    if (Math.abs(v.fundalHeightCm - v.gaWeeks) > 3) flags.add('SFH_LAG');
  }

  return [...flags];
}

/** True if any flag is a red-banner (severe) alert requiring escalation. */
export function hasSevereAlert(flags: string[]): boolean {
  return flags.some((f) =>
    ['SEVERE_HTN', 'SEVERE_ANEMIA', 'PRE_ECLAMPSIA_SUSPECT'].includes(f),
  );
}
