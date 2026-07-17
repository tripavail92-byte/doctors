// WHO 2016 ANC model — 8-contact schedule (pure).
// Contacts at GA (completed weeks): 1st ≤12, then 20, 26, 30, 34, 36, 38, 40.
// Source: WHO "Recommendations on Antenatal Care for a Positive Pregnancy
// Experience" (2016).

export interface AncContact {
  number: number;
  /** Target GA in weeks for this contact. */
  targetGaWeeks: number;
}

export const WHO_ANC_CONTACTS: AncContact[] = [
  { number: 1, targetGaWeeks: 12 },
  { number: 2, targetGaWeeks: 20 },
  { number: 3, targetGaWeeks: 26 },
  { number: 4, targetGaWeeks: 30 },
  { number: 5, targetGaWeeks: 34 },
  { number: 6, targetGaWeeks: 36 },
  { number: 7, targetGaWeeks: 38 },
  { number: 8, targetGaWeeks: 40 },
];

/**
 * Suggest the contact number for a visit at the given GA — the first scheduled
 * contact whose target week is ≥ the current GA (so a 22-wk visit maps to
 * contact 3 @26). Anything past 40 wk maps to the final contact. The first
 * contact absorbs everything ≤12 wk.
 */
export function suggestContactNumber(gaWeeks: number): number {
  for (const c of WHO_ANC_CONTACTS) {
    if (gaWeeks <= c.targetGaWeeks) return c.number;
  }
  return WHO_ANC_CONTACTS[WHO_ANC_CONTACTS.length - 1].number;
}

/** The next contact strictly after the current GA (for reminders), or null past term. */
export function nextContact(gaWeeks: number): AncContact | null {
  return WHO_ANC_CONTACTS.find((c) => c.targetGaWeeks > gaWeeks) ?? null;
}
