// Electrotherapy / modality contraindication engine (pure).
//
// Safety gate before applying a modality in a treatment session. BLOCK is a
// hard stop (senior override required); WARN is advisory.

export type SafetyVerdict = 'BLOCK' | 'WARN' | 'OK';

export interface SafetyHit {
  verdict: SafetyVerdict;
  message: string;
  overrideRole?: 'SENIOR';
}

/** Intake comorbidity flags the rules read. */
export interface SafetyIntake {
  pacemaker?: boolean;
  pregnant?: boolean;
  metalImplant?: boolean;
  impairedSensation?: boolean;
  malignancy?: boolean;
  dvtHistory?: boolean;
}

const ELECTRO = ['TENS', 'IFT', 'NMES'];
const THERMAL = ['HOT_PACK', 'US', 'LASER', 'SWD'];

export function checkModalitySafety(
  modalityCode: string,
  region: string,
  intake: SafetyIntake,
): SafetyHit[] {
  const hits: SafetyHit[] = [];
  const code = modalityCode.toUpperCase();
  const electro = ELECTRO.includes(code);
  const thermal = THERMAL.includes(code);
  const lumbarAbdo = /lumbar|abdomen|abdominal|pelvis/i.test(region);

  if (electro && intake.pacemaker) {
    hits.push({ verdict: 'BLOCK', message: 'Pacemaker contraindicates TENS/IFT/NMES', overrideRole: 'SENIOR' });
  }
  if (intake.pregnant && (electro || code === 'US' || code === 'TRACTION') && lumbarAbdo) {
    hits.push({ verdict: 'WARN', message: 'Pregnancy: caution with lumbar/abdominal electro/US/traction' });
  }
  if (code === 'US' && intake.metalImplant) {
    hits.push({ verdict: 'WARN', message: 'Metal implant under ultrasound site — verify location' });
  }
  if (thermal && intake.impairedSensation) {
    hits.push({ verdict: 'WARN', message: 'Impaired sensation — thermal burn risk' });
  }
  if (intake.malignancy && (electro || thermal)) {
    hits.push({ verdict: 'BLOCK', message: 'Active malignancy in the treatment field', overrideRole: 'SENIOR' });
  }
  if (intake.dvtHistory && (code === 'US' || code === 'MASSAGE')) {
    hits.push({ verdict: 'WARN', message: 'DVT history — avoid mechanical/US over the affected limb' });
  }
  return hits;
}

/** Worst verdict across hits (BLOCK > WARN > OK). */
export function worstVerdict(hits: SafetyHit[]): SafetyVerdict {
  if (hits.some((h) => h.verdict === 'BLOCK')) return 'BLOCK';
  if (hits.some((h) => h.verdict === 'WARN')) return 'WARN';
  return 'OK';
}
