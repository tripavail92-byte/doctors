// Pakistan Expanded Programme on Immunization (EPI) routine childhood schedule.
//
// Reference data (like the WHO-LMS tables) — the compute engine is independent
// of the exact rows.
//
// VERIFY BEFORE CLINICAL DEPLOYMENT. These rows were checked against Pakistan's
// National Immunization Policy 2022 (epi.gov.pk), which specifies TWO IPV doses
// under one year, the second given ~4 months after the first and coinciding with
// the 9-month measles contact. The Federal Directorate of Immunization site
// could not be fetched directly at the time of writing (TLS failure), so the
// schedule below is corroborated but NOT read off the primary source. A missing
// or mistimed row here means a child is never flagged for a dose — the failure
// is silent, which is exactly why this table must be signed off by someone with
// the official schedule in hand.
//
// This is also why the schedule belongs in the database rather than here: a
// clinic cannot correct a national schedule change without a deploy. Tracked as
// the config-driven ImmunizationSchedule work.

export interface ScheduledDose {
  vaccineCode: string; // 'BCG','OPV','PENTA','PCV','ROTA','IPV','MR','TCV'
  vaccineName: string;
  dose: string; // '0','1','2','3'
  ageOffsetDays: number; // days after birth
  ageLabel: string; // 'Birth','6 weeks','9 months'
  route: string; // ID / oral / IM / SC

  /**
   * Minimum days since the PREVIOUS dose of this vaccine. A dose given sooner
   * does not immunise and must be repeated — the engine reports it as
   * `given_invalid` rather than `given`.
   *
   * 28 days is WHO's general principle for primary-series intervals. CONFIRM
   * per-vaccine against the FDI schedule before clinical use.
   */
  minIntervalDays?: number;

  /** Minimum age. A dose given younger does not count (e.g. nothing before 6wk). */
  minAgeDays?: number;

  /**
   * Age past which this vaccine is not given at all. Without it, a dose stays
   * "overdue" for life and staff learn to ignore the overdue list.
   */
  maxAgeDays?: number;
}

const W6 = 42;
const W10 = 70;
const W14 = 98;
const M9 = 274;
const M15 = 456;

// WHO's general minimum interval between primary-series doses.
const MIN_INTERVAL = 28;

export const EPI_SCHEDULE: ScheduledDose[] = [
  { vaccineCode: 'BCG', vaccineName: 'BCG', dose: '1', ageOffsetDays: 0, ageLabel: 'Birth', route: 'ID' },
  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '0', ageOffsetDays: 0, ageLabel: 'Birth', route: 'oral' },

  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'oral', minAgeDays: W6, minIntervalDays: MIN_INTERVAL },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'IM', minAgeDays: W6 },
  { vaccineCode: 'PCV', vaccineName: 'PCV10 (pneumococcal)', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'IM', minAgeDays: W6 },
  // Rotavirus has an UPPER age limit: intussusception risk rises with age at
  // first dose, so a late start is not caught up — it is abandoned.
  // CONFIRM the exact ceiling against the FDI schedule; 32 weeks follows the
  // WHO position paper's intent, it is not read off the national table.
  { vaccineCode: 'ROTA', vaccineName: 'Rotavirus', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'oral', minAgeDays: W6, maxAgeDays: 224 },

  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'oral', minIntervalDays: MIN_INTERVAL },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'IM', minIntervalDays: MIN_INTERVAL },
  { vaccineCode: 'PCV', vaccineName: 'PCV10 (pneumococcal)', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'IM', minIntervalDays: MIN_INTERVAL },
  { vaccineCode: 'ROTA', vaccineName: 'Rotavirus', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'oral', minIntervalDays: MIN_INTERVAL, maxAgeDays: 224 },

  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '3', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'oral', minIntervalDays: MIN_INTERVAL },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '3', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'IM', minIntervalDays: MIN_INTERVAL },
  { vaccineCode: 'PCV', vaccineName: 'PCV10 (pneumococcal)', dose: '3', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'IM', minIntervalDays: MIN_INTERVAL },
  { vaccineCode: 'IPV', vaccineName: 'IPV (injectable polio)', dose: '1', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'IM', minAgeDays: W14 },

  { vaccineCode: 'MR', vaccineName: 'Measles-Rubella', dose: '1', ageOffsetDays: M9, ageLabel: '9 months', route: 'SC', minAgeDays: M9 },
  { vaccineCode: 'TCV', vaccineName: 'Typhoid conjugate (TCV)', dose: '1', ageOffsetDays: M9, ageLabel: '9 months', route: 'IM', minAgeDays: M9 },
  // ---------------------------------------------------------------------------
  // IPV-2 @ 9 months. AWAITING CLINICAL SIGN-OFF — see the header note.
  //
  // This row was ABSENT, which meant a child was never flagged for their second
  // polio dose and the card read "complete". A missing row fails silently: you
  // cannot see a dose that was never scheduled.
  //
  // Added on the strength of Pakistan's National Immunization Policy 2022, which
  // specifies TWO IPV doses under one year with the second ~4 months after the
  // first, coinciding with the 9-month measles contact. The FDI site could not
  // be fetched to read the canonical table directly (TLS failure), so this is
  // corroborated, NOT read off the primary source. Confirm the dose exists and
  // its age before this schedule drives a real clinic.
  // ---------------------------------------------------------------------------
  { vaccineCode: 'IPV', vaccineName: 'IPV (injectable polio)', dose: '2', ageOffsetDays: M9, ageLabel: '9 months', route: 'IM', minIntervalDays: 112 },

  { vaccineCode: 'MR', vaccineName: 'Measles-Rubella', dose: '2', ageOffsetDays: M15, ageLabel: '15 months', route: 'SC', minIntervalDays: MIN_INTERVAL },
];
