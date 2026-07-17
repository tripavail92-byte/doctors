import { AefiOutcome, AefiSeverity } from '@prisma/client';

// AEFI — Adverse Event Following Immunization.
//
// "Following", not "caused by". Causality is assessed later, by a national
// committee, against the whole picture. The clinic's job is to REPORT, and the
// bar for reporting is deliberately low — under-reporting is the failure mode
// that kills people, because a bad lot is only visible as a cluster, and a
// cluster is only visible if the individual events were written down.
//
// So nothing here tries to decide whether the vaccine did it. It decides two
// much narrower things: how serious the event was, and whether it must be
// escalated to the national pharmacovigilance centre.

/**
 * WHO's "serious" criteria. This is a DEFINITION, not a judgement — an event is
 * serious if it meets any one of these, full stop. It is enumerated here rather
 * than left to a clinician's impression precisely so that a busy nurse at 6pm
 * cannot accidentally downgrade a hospitalisation to "minor".
 */
export const SERIOUS_CRITERIA = [
  { key: 'death', label: 'Resulted in death' },
  { key: 'life_threatening', label: 'Life-threatening' },
  { key: 'hospitalisation', label: 'Required or prolonged hospitalisation' },
  { key: 'disability', label: 'Persistent or significant disability/incapacity' },
  { key: 'congenital_anomaly', label: 'Congenital anomaly/birth defect' },
  { key: 'medically_important', label: 'Other medically important event' },
] as const;

export type SeriousCriterion = (typeof SERIOUS_CRITERIA)[number]['key'];

/** Events expected after routine immunisation and self-limiting. */
export const MINOR_SYMPTOMS = [
  'injection_site_soreness',
  'injection_site_swelling',
  'low_grade_fever',
  'irritability',
  'malaise',
  'mild_rash',
];

export interface AefiInput {
  symptoms: string[];
  criteriaMet?: SeriousCriterion[];
  outcome?: AefiOutcome;
  /** Clinician's own severity, if they recorded one. */
  statedSeverity?: AefiSeverity;
}

export interface AefiClassification {
  severity: AefiSeverity;
  /** SERIOUS events are reportable to the national centre. */
  reportable: boolean;
  reason: string;
  /** Which of WHO's serious criteria were met. */
  criteriaMet: SeriousCriterion[];
}

/**
 * Classify an AEFI.
 *
 * The severity can only ever be RAISED relative to what the clinician typed,
 * never lowered. If they say MINOR but tick "hospitalisation", it is SERIOUS —
 * the criterion is objective and the label is not. Allowing the stated severity
 * to win would let the most consequential events be filed as routine, which is
 * exactly how a bad lot stays invisible.
 */
export function classifyAefi(input: AefiInput): AefiClassification {
  const criteriaMet = input.criteriaMet ?? [];

  // An outcome of DIED is a serious criterion whether or not anyone ticked it.
  const impliedDeath = input.outcome === 'DIED' && !criteriaMet.includes('death');
  const allCriteria: SeriousCriterion[] = impliedDeath
    ? [...criteriaMet, 'death']
    : criteriaMet;

  if (allCriteria.length) {
    const labels = allCriteria
      .map((k) => SERIOUS_CRITERIA.find((c) => c.key === k)?.label ?? k)
      .join('; ');
    return {
      severity: 'SERIOUS',
      reportable: true,
      criteriaMet: allCriteria,
      reason:
        `Meets WHO serious criteria (${labels}). Reportable to the national ` +
        `pharmacovigilance centre regardless of suspected causality.`,
    };
  }

  const allMinor =
    input.symptoms.length > 0 && input.symptoms.every((s) => MINOR_SYMPTOMS.includes(s));

  // Severity may be raised by the clinician, never lowered by this function.
  const rank: Record<AefiSeverity, number> = { MINOR: 0, SEVERE: 1, SERIOUS: 2 };
  const computed: AefiSeverity = allMinor ? 'MINOR' : 'SEVERE';
  const stated = input.statedSeverity;
  const severity =
    stated && rank[stated] > rank[computed] ? stated : computed;

  return {
    severity,
    reportable: severity === 'SERIOUS',
    criteriaMet: [],
    reason: allMinor
      ? 'All symptoms are expected, self-limiting reactions to routine immunisation.'
      : 'Symptoms are outside the expected minor set — record and follow up.',
  };
}
