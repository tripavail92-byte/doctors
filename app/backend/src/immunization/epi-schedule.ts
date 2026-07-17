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
}

const W6 = 42;
const W10 = 70;
const W14 = 98;
const M9 = 274;
const M15 = 456;

export const EPI_SCHEDULE: ScheduledDose[] = [
  { vaccineCode: 'BCG', vaccineName: 'BCG', dose: '1', ageOffsetDays: 0, ageLabel: 'Birth', route: 'ID' },
  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '0', ageOffsetDays: 0, ageLabel: 'Birth', route: 'oral' },

  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'oral' },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'IM' },
  { vaccineCode: 'PCV', vaccineName: 'PCV10 (pneumococcal)', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'IM' },
  { vaccineCode: 'ROTA', vaccineName: 'Rotavirus', dose: '1', ageOffsetDays: W6, ageLabel: '6 weeks', route: 'oral' },

  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'oral' },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'IM' },
  { vaccineCode: 'PCV', vaccineName: 'PCV10 (pneumococcal)', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'IM' },
  { vaccineCode: 'ROTA', vaccineName: 'Rotavirus', dose: '2', ageOffsetDays: W10, ageLabel: '10 weeks', route: 'oral' },

  { vaccineCode: 'OPV', vaccineName: 'OPV (oral polio)', dose: '3', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'oral' },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '3', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'IM' },
  { vaccineCode: 'PCV', vaccineName: 'PCV10 (pneumococcal)', dose: '3', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'IM' },
  { vaccineCode: 'IPV', vaccineName: 'IPV (injectable polio)', dose: '1', ageOffsetDays: W14, ageLabel: '14 weeks', route: 'IM' },

  { vaccineCode: 'MR', vaccineName: 'Measles-Rubella', dose: '1', ageOffsetDays: M9, ageLabel: '9 months', route: 'SC' },
  { vaccineCode: 'TCV', vaccineName: 'Typhoid conjugate (TCV)', dose: '1', ageOffsetDays: M9, ageLabel: '9 months', route: 'IM' },
  { vaccineCode: 'MR', vaccineName: 'Measles-Rubella', dose: '2', ageOffsetDays: M15, ageLabel: '15 months', route: 'SC' },
];
