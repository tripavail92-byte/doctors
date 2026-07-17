// Refraction validation & transposition (pure). Same rules run client + server.

export interface RefractionInput {
  sphere: number;
  cylinder?: number | null;
  axis?: number | null;
  add?: number | null;
  pdBinocularMm?: number | null;
}

/** On the 0.25-dioptre grid iff value×4 is an integer. */
export function onQuarterGrid(v: number): boolean {
  return Number.isInteger(Math.round(v * 4 * 1e6) / 1e6);
}

export interface RefractionValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Field-level refraction validation:
 *   sphere ∈ [-30,+30] on grid; cyl ∈ [-10,+10] on grid;
 *   axis required + integer 1..180 iff cyl ≠ 0 (axis with cyl 0 → warning);
 *   add positive 0.25..4.00 on grid; PD 40..85 (warn outside 50..75).
 */
export function validateRefraction(r: RefractionInput): RefractionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (r.sphere < -30 || r.sphere > 30) errors.push('sphere out of range (-30..+30)');
  if (!onQuarterGrid(r.sphere)) errors.push('sphere must be on the 0.25 D grid');

  const cyl = r.cylinder ?? 0;
  if (r.cylinder != null) {
    if (cyl < -10 || cyl > 10) errors.push('cylinder out of range (-10..+10)');
    if (!onQuarterGrid(cyl)) errors.push('cylinder must be on the 0.25 D grid');
  }

  if (cyl !== 0) {
    if (r.axis == null) errors.push('axis is required when cylinder is non-zero');
    else if (!Number.isInteger(r.axis) || r.axis < 1 || r.axis > 180) errors.push('axis must be an integer 1..180');
  } else if (r.axis != null) {
    warnings.push('axis given with zero cylinder — clear the axis');
  }

  if (r.add != null) {
    if (r.add <= 0 || r.add > 4) errors.push('add must be positive, ≤ +4.00');
    else if (!onQuarterGrid(r.add)) errors.push('add must be on the 0.25 D grid');
  }

  if (r.pdBinocularMm != null) {
    if (r.pdBinocularMm < 40 || r.pdBinocularMm > 85) errors.push('PD out of plausible range (40..85 mm)');
    else if (r.pdBinocularMm < 50 || r.pdBinocularMm > 75) warnings.push('PD outside the typical 50..75 mm range');
  }

  return { errors, warnings };
}

/** Plus↔minus cylinder transposition. */
export function transpose(r: { sphere: number; cylinder: number; axis: number }): {
  sphere: number;
  cylinder: number;
  axis: number;
} {
  const sphere = r.sphere + r.cylinder;
  const cylinder = -r.cylinder;
  let axis = ((r.axis + 90) % 180) || 180; // keep in 1..180
  if (axis <= 0) axis += 180;
  return { sphere, cylinder, axis };
}
