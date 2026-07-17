// Weight-based dose calculator (pure).
//
//   perDay  = weightKg * mgPerKgPerDay      (capped at maxDailyMg)
//   perDose = perDay / dosesPerDay          (capped at maxSingleMg)
//
// Plus concentration -> volume (mL) conversion, rounding to a dosing step
// (which must NEVER round up past a cap), and age/weight validity blocking.
// Caps are hard limits; the result is a recommendation a clinician confirms.

export interface DoseInput {
  weightKg: number;
  mgPerKgPerDay: number;
  dosesPerDay: number;
  maxSingleMg?: number;
  maxDailyMg?: number;
  // Validity gates
  ageMonths?: number;
  minAgeMonths?: number;
  maxWeightKgForRule?: number;
  // Concentration -> volume
  concentrationMgPerMl?: number;
  roundingStepMl?: number;
  cautions?: string[];
}

export interface DoseResult {
  weightKg: number;
  mgPerKgPerDay: number;
  dosesPerDay: number;
  perDayMg: number;
  perDoseMg: number;
  cappedDaily: boolean;
  cappedSingle: boolean;
  volumePerDoseMl: number | null;
  volumePerDayMl: number | null;
  rounded: boolean;
  /** Hard-blocked (e.g. below minimum age) — must not be committed as-is. */
  blocked: boolean;
  blockReason: string | null;
  notes: string[];
}

function round(x: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

export function computeDose(i: DoseInput): DoseResult {
  const notes: string[] = [];

  let perDay = i.weightKg * i.mgPerKgPerDay;
  let cappedDaily = false;
  if (i.maxDailyMg != null && perDay > i.maxDailyMg) {
    perDay = i.maxDailyMg;
    cappedDaily = true;
    notes.push(`Daily dose capped at max ${i.maxDailyMg} mg/day`);
  }

  let perDose = perDay / i.dosesPerDay;
  let cappedSingle = false;
  if (i.maxSingleMg != null && perDose > i.maxSingleMg) {
    perDose = i.maxSingleMg;
    cappedSingle = true;
    notes.push(`Single dose capped at max ${i.maxSingleMg} mg`);
  }

  // Concentration -> volume, with rounding that never exceeds the single cap.
  let volumePerDoseMl: number | null = null;
  let volumePerDayMl: number | null = null;
  let rounded = false;
  if (i.concentrationMgPerMl != null && i.concentrationMgPerMl > 0) {
    const rawVolume = perDose / i.concentrationMgPerMl;
    let vol = rawVolume;
    const step = i.roundingStepMl ?? 0;
    if (step > 0) {
      vol = Math.round(rawVolume / step) * step;
      // Never round UP past the single-dose cap.
      if (i.maxSingleMg != null && vol * i.concentrationMgPerMl > i.maxSingleMg + 1e-9) {
        vol = Math.floor(rawVolume / step) * step;
      }
      if (Math.abs(vol - rawVolume) > 1e-9) {
        rounded = true;
        notes.push(`Rounded to ${round(vol)} mL (${round(vol * i.concentrationMgPerMl)} mg)`);
      }
    }
    volumePerDoseMl = round(vol);
    volumePerDayMl = round(vol * i.dosesPerDay);
  }

  // Validity gates.
  let blocked = false;
  let blockReason: string | null = null;
  if (i.minAgeMonths != null && i.ageMonths != null && i.ageMonths < i.minAgeMonths) {
    blocked = true;
    blockReason = `Rule not valid below ${i.minAgeMonths} months (age ${i.ageMonths} mo)`;
    notes.push(blockReason);
  }
  if (i.maxWeightKgForRule != null && i.weightKg > i.maxWeightKgForRule) {
    notes.push(`Weight ${i.weightKg} kg exceeds this rule's range (> ${i.maxWeightKgForRule} kg) — consider adult dosing`);
  }
  for (const c of i.cautions ?? []) notes.push(c);

  return {
    weightKg: i.weightKg,
    mgPerKgPerDay: i.mgPerKgPerDay,
    dosesPerDay: i.dosesPerDay,
    perDayMg: round(perDay, 1),
    perDoseMg: round(perDose, 1),
    cappedDaily,
    cappedSingle,
    volumePerDoseMl,
    volumePerDayMl,
    rounded,
    blocked,
    blockReason,
    notes,
  };
}
