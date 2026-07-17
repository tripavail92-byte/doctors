// Intraocular-pressure alert banding + cup-disc asymmetry (pure).

export interface IopBand {
  key: string;
  label: string;
  min: number;
  max: number;
  severity: 'normal' | 'soft' | 'red' | 'urgent';
  blocking?: boolean;
}

// Evaluated highest-first. Normal 10–21; >21 soft; >30 red; >40 urgent; <10 hypotony.
export const IOP_BANDS: IopBand[] = [
  { key: 'urgent', label: 'Urgent review — acute pressure', min: 40, max: 80, severity: 'urgent', blocking: true },
  { key: 'red', label: 'Markedly raised IOP', min: 30, max: 39.9, severity: 'red' },
  { key: 'soft', label: 'Above statistical normal', min: 22, max: 29.9, severity: 'soft' },
  { key: 'normal', label: 'Within normal limits (10–21)', min: 10, max: 21.9, severity: 'normal' },
  { key: 'low', label: 'Ocular hypotony', min: 1, max: 9.9, severity: 'soft' },
];

export const IOP_HARD_MIN = 1.0;
export const IOP_HARD_MAX = 80.0;

/** Classify an IOP value; throws for physiologically implausible values. */
export function classifyIop(mmHg: number): IopBand {
  if (mmHg < IOP_HARD_MIN || mmHg > IOP_HARD_MAX) {
    throw new Error(`IOP ${mmHg} mmHg is outside the plausible range (${IOP_HARD_MIN}..${IOP_HARD_MAX})`);
  }
  return IOP_BANDS.find((b) => mmHg >= b.min && mmHg <= b.max) ?? IOP_BANDS[3];
}

export function iopAlert(mmHg: number): { severity: string; blocking: boolean; message: string } {
  const band = classifyIop(mmHg);
  return { severity: band.severity, blocking: band.blocking ?? false, message: band.label };
}

/** Cup-disc-ratio asymmetry > 0.20 between eyes is a glaucoma-suspect flag. */
export function cdrAsymmetry(cdrRight: number, cdrLeft: number): { asymmetric: boolean; delta: number } {
  const delta = Math.round(Math.abs(cdrRight - cdrLeft) * 100) / 100;
  return { asymmetric: delta > 0.2, delta };
}
