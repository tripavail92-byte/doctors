import { EPI_SCHEDULE, ScheduledDose } from './epi-schedule';

// Catch-up / minimum-interval schedule engine.
//
// The age-based engine this replaces answered one question: "is this dose due
// by age?" That is not enough to run a real EPI clinic, because it silently
// accepts doses that do not count.
//
// Three failures it could not see:
//
//   1. A dose given TOO SOON after the previous one does not immunise. WHO's
//      general principle is a 4-week minimum between primary-series doses; a
//      dose given at a shorter interval must be repeated. Reporting it as
//      "given" leaves the child under-immunised with a card that says otherwise
//      — the most dangerous state, because it stops anyone looking.
//   2. Dose 3 was reported "due" while dose 2 was never given. A primary series
//      is a sequence, and the due date of dose N depends on when dose N-1
//      actually happened, not only on the child's birthday.
//   3. A dose stays "overdue" forever. Some vaccines have an upper age after
//      which they are not given at all (rotavirus, because intussusception risk
//      rises with age). Nagging a 5-year-old's card about a rotavirus dose
//      trains staff to ignore the overdue list.
//
// CLINICAL REVIEW REQUIRED. The 28-day minimum interval is WHO's general
// principle for the primary series, and the rotavirus age ceiling follows the
// WHO position paper's intent, but neither has been checked against Pakistan's
// FDI schedule for this deployment. The engine is independent of the numbers —
// they live in epi-schedule.ts and belong in the database.

export type DoseStatus =
  | 'given' // validly given
  | 'given_invalid' // given, but too soon after the previous dose — must repeat
  | 'due'
  | 'overdue'
  | 'upcoming'
  | 'blocked' // the preceding dose in this series has not been given
  | 'aged_out'; // past the age at which this vaccine is given at all

export interface GivenDose {
  vaccineCode: string;
  dose: string;
  givenAt: Date;
  lotNumber?: string | null;
}

export interface ScheduleRow extends ScheduledDose {
  dueDate: string; // ISO (yyyy-mm-dd) — age-based, or interval-based if later
  status: DoseStatus;
  givenAt?: string;
  lotNumber?: string | null;
  /** Why this row is blocked / invalid / aged out — shown to the clinician. */
  reason?: string;
  /** Days after the previous dose in this series, when known. */
  intervalDays?: number;
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DAY);

/**
 * Compute a child's schedule with catch-up rules.
 *
 * The due date of a dose is the LATER of:
 *   - its age-based date (DOB + ageOffsetDays), and
 *   - the earliest date the minimum interval from the previous dose allows.
 *
 * That single rule is what makes catch-up work: a child who starts late does
 * not get their whole primary series compressed into one week just because
 * every age-based date has already passed.
 */
export function computeSchedule(
  dob: Date,
  today: Date,
  given: GivenDose[],
  graceDays = 14,
): ScheduleRow[] {
  // Series are per vaccine, ordered by the schedule's own dose order.
  const bySeries = new Map<string, ScheduledDose[]>();
  for (const s of EPI_SCHEDULE) {
    bySeries.set(s.vaccineCode, [...(bySeries.get(s.vaccineCode) ?? []), s]);
  }

  const rows: ScheduleRow[] = [];

  for (const [vaccineCode, series] of bySeries) {
    const ordered = [...series].sort((a, b) => a.ageOffsetDays - b.ageOffsetDays);

    // The previous VALIDLY given dose in this series, walking forward, and the
    // set of doses that actually counted — a later dose is gated on validity,
    // not on a row merely existing.
    let prevValidAt: Date | null = null;
    const validDoses = new Set<string>();

    for (const s of ordered) {
      const ageDue = addDays(dob, s.ageOffsetDays);
      const rec = given.find((g) => g.vaccineCode === s.vaccineCode && g.dose === s.dose);

      // Earliest permissible date: age-based, or the interval from the previous
      // dose, whichever is later.
      const minInterval = s.minIntervalDays ?? 0;
      const intervalDue =
        prevValidAt && minInterval ? addDays(prevValidAt, minInterval) : null;
      const due =
        intervalDue && intervalDue.getTime() > ageDue.getTime() ? intervalDue : ageDue;

      const row: ScheduleRow = {
        ...s,
        dueDate: iso(due),
        status: 'upcoming',
      };

      if (rec) {
        row.givenAt = iso(rec.givenAt);
        row.lotNumber = rec.lotNumber ?? null;

        const gap = prevValidAt ? daysBetween(prevValidAt, rec.givenAt) : null;
        if (gap != null) row.intervalDays = gap;

        const tooSoonAfterPrev = gap != null && minInterval > 0 && gap < minInterval;
        const tooYoung =
          s.minAgeDays != null && daysBetween(dob, rec.givenAt) < s.minAgeDays;

        if (tooSoonAfterPrev) {
          // Does not count. Say so loudly — a card that reads "given" for an
          // invalid dose is worse than a blank, because nobody re-checks it.
          row.status = 'given_invalid';
          row.reason =
            `Given ${gap} days after the previous ${vaccineCode} dose; the minimum ` +
            `interval is ${minInterval} days. This dose does not count and must be repeated.`;
          // prevValidAt deliberately unchanged: an invalid dose does not anchor
          // the next one's interval.
        } else if (tooYoung) {
          row.status = 'given_invalid';
          row.reason =
            `Given at ${daysBetween(dob, rec.givenAt)} days of age; this vaccine is not ` +
            `given before ${s.minAgeDays} days. This dose does not count and must be repeated.`;
        } else {
          row.status = 'given';
          prevValidAt = rec.givenAt;
          validDoses.add(`${s.vaccineCode}|${s.dose}`);
        }
        rows.push(row);
        continue;
      }

      // Not given. Aged out?
      if (s.maxAgeDays != null && daysBetween(dob, today) > s.maxAgeDays) {
        row.status = 'aged_out';
        row.reason =
          `Past the maximum age for ${vaccineCode} (${s.maxAgeDays} days); this dose is ` +
          `no longer given.`;
        rows.push(row);
        continue;
      }

      // Blocked by a predecessor that is missing OR invalid.
      //
      // Validity, not mere presence: a dose given too soon does not immunise,
      // so the series has not actually advanced. Checking presence alone let an
      // invalid PENTA-2 unlock PENTA-3 — the child would be walked through the
      // rest of the series on top of a dose that did nothing, which is the exact
      // under-immunised-but-looks-complete state this engine exists to prevent.
      const priorDoses = ordered.filter((o) => o.ageOffsetDays < s.ageOffsetDays);
      const priorUnmet = priorDoses.find((p) => !validDoses.has(`${p.vaccineCode}|${p.dose}`));
      if (priorUnmet) {
        const wasAttempted = given.some(
          (g) => g.vaccineCode === priorUnmet.vaccineCode && g.dose === priorUnmet.dose,
        );
        row.status = 'blocked';
        row.reason = wasAttempted
          ? `${vaccineCode} dose ${priorUnmet.dose} did not count and must be repeated first.`
          : `${vaccineCode} dose ${priorUnmet.dose} must be given first.`;
        rows.push(row);
        continue;
      }

      if (today.getTime() < due.getTime()) {
        row.status = 'upcoming';
        if (intervalDue && intervalDue.getTime() > ageDue.getTime()) {
          row.reason =
            `Age-due ${iso(ageDue)}, but the ${minInterval}-day interval from the previous ` +
            `dose moves it to ${iso(due)}.`;
        }
      } else {
        row.status =
          daysBetween(due, today) > graceDays ? 'overdue' : 'due';
      }
      rows.push(row);
    }
  }

  // Preserve the schedule's own ordering for display.
  return rows.sort(
    (a, b) =>
      a.ageOffsetDays - b.ageOffsetDays || a.vaccineCode.localeCompare(b.vaccineCode),
  );
}

export function scheduleSummary(rows: ScheduleRow[]) {
  const count = (st: DoseStatus) => rows.filter((r) => r.status === st).length;
  return {
    total: rows.length,
    given: count('given'),
    givenInvalid: count('given_invalid'),
    due: count('due'),
    overdue: count('overdue'),
    upcoming: count('upcoming'),
    blocked: count('blocked'),
    agedOut: count('aged_out'),
    /** Doses that must be repeated because they were given too soon/too young. */
    mustRepeat: rows.filter((r) => r.status === 'given_invalid').map((r) => ({
      vaccineCode: r.vaccineCode,
      dose: r.dose,
      reason: r.reason,
    })),
  };
}
