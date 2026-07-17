// Booking-time helpers (pure): obstetric-history validation and auto risk flags.

export interface BookingInput {
  dob?: Date | null;
  bookingDate: Date;
  gravida: number;
  para: number;
  abortus: number;
  rhFactor?: 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN' | null;
  prevCsCount?: number | null;
  fetusCount?: number | null;
}

/**
 * Age in completed years at the booking date. Calendar-based (not days/365.25)
 * so an exact birthday returns the correct age with no leap-day drift.
 */
export function ageYears(dob: Date, at: Date): number {
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const m = at.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/**
 * Validate obstetric history. Gravida must be ≥ para + abortus (a woman can't
 * have more completed outcomes than pregnancies). Returns an error string or null.
 */
export function validateObstetricHistory(b: {
  gravida: number;
  para: number;
  abortus: number;
}): string | null {
  if (b.gravida < 0 || b.para < 0 || b.abortus < 0) return 'G/P/A cannot be negative';
  if (b.gravida < b.para + b.abortus) {
    return 'gravida must be ≥ para + abortus';
  }
  return null;
}

/**
 * Auto-derived booking risk flags. These are added to any clinician-selected
 * flags; the RH_NEGATIVE flag in particular drives the anti-D task.
 */
export function computeAutoRiskFlags(b: BookingInput): string[] {
  const flags = new Set<string>();

  if (b.dob) {
    const age = ageYears(b.dob, b.bookingDate);
    if (age < 18) flags.add('AGE_UNDER_18');
    if (age > 35) flags.add('AGE_OVER_35');
  }
  if (b.para >= 5) flags.add('GRAND_MULTIPARA');
  if (b.rhFactor === 'NEGATIVE') flags.add('RH_NEGATIVE');
  if ((b.prevCsCount ?? 0) > 0) flags.add('PREV_CS');
  if ((b.fetusCount ?? 1) > 1) flags.add('MULTIPLE_PREGNANCY');

  return [...flags];
}
