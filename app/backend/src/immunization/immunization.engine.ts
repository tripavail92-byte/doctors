import { EPI_SCHEDULE, ScheduledDose } from './epi-schedule';

export type DoseStatus = 'given' | 'due' | 'overdue' | 'upcoming';

export interface GivenDose {
  vaccineCode: string;
  dose: string;
  givenAt: Date;
  lotNumber?: string | null;
}

export interface ScheduleRow extends ScheduledDose {
  dueDate: string; // ISO date (yyyy-mm-dd)
  status: DoseStatus;
  givenAt?: string;
  lotNumber?: string | null;
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Compute a child's EPI schedule: each scheduled dose gets a due date (DOB +
 * age offset) and a status. Given doses are matched by (vaccineCode, dose);
 * unadministered doses are `upcoming` before their due date, `due` from the due
 * date, and `overdue` once past a grace window.
 */
export function computeSchedule(
  dob: Date,
  today: Date,
  given: GivenDose[],
  graceDays = 14,
): ScheduleRow[] {
  return EPI_SCHEDULE.map((s) => {
    const due = new Date(dob.getTime() + s.ageOffsetDays * DAY);
    const rec = given.find((g) => g.vaccineCode === s.vaccineCode && g.dose === s.dose);
    let status: DoseStatus;
    if (rec) {
      status = 'given';
    } else if (today.getTime() < due.getTime()) {
      status = 'upcoming';
    } else {
      status = (today.getTime() - due.getTime()) / DAY > graceDays ? 'overdue' : 'due';
    }
    return {
      ...s,
      dueDate: iso(due),
      status,
      givenAt: rec ? iso(rec.givenAt) : undefined,
      lotNumber: rec ? rec.lotNumber ?? null : undefined,
    };
  });
}

export function scheduleSummary(rows: ScheduleRow[]) {
  const count = (st: DoseStatus) => rows.filter((r) => r.status === st).length;
  return {
    total: rows.length,
    given: count('given'),
    due: count('due'),
    overdue: count('overdue'),
    upcoming: count('upcoming'),
  };
}
