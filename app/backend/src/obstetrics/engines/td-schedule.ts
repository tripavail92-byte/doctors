// Maternal tetanus (TT/Td) 5-dose schedule for women of childbearing age (pure).
// Intervals: TT1 at first contact; TT2 ≥4 wk after TT1; TT3 ≥6 mo after TT2;
// TT4 ≥1 yr after TT3; TT5 ≥1 yr after TT4.
// Source: WHO/SAGE maternal tetanus schedule; Pakistan FDI/EPI.

const MS_PER_DAY = 86_400_000;

export interface TdDoseGiven {
  dose: number; // 1..5
  date: Date;
}

export type TdStatus = 'GIVEN' | 'DUE' | 'UPCOMING';

export interface TdScheduleRow {
  dose: number;
  status: TdStatus;
  /** Earliest date this dose may be given (null until the prior dose is given). */
  dueDate: Date | null;
}

// Minimum gap (days) BEFORE dose N, measured from dose N-1. Index by dose number.
const GAP_DAYS_BEFORE: Record<number, number> = {
  2: 28, //  4 weeks after TT1
  3: 182, // ~6 months after TT2
  4: 365, // ~1 year after TT3
  5: 365, // ~1 year after TT4
};

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/**
 * Compute the 5-dose Td schedule state given the doses already recorded.
 * A dose is DUE when its earliest date has arrived, UPCOMING when it has a
 * future earliest date, and null-dated when the prior dose has not been given.
 */
export function computeTdSchedule(given: TdDoseGiven[], today: Date): TdScheduleRow[] {
  const givenByDose = new Map(given.map((g) => [g.dose, g.date]));
  const rows: TdScheduleRow[] = [];

  for (let dose = 1; dose <= 5; dose++) {
    if (givenByDose.has(dose)) {
      rows.push({ dose, status: 'GIVEN', dueDate: givenByDose.get(dose)! });
      continue;
    }
    let dueDate: Date | null;
    if (dose === 1) {
      dueDate = today; // TT1 can be given at first contact
    } else {
      const prev = givenByDose.get(dose - 1);
      dueDate = prev ? addDays(prev, GAP_DAYS_BEFORE[dose]) : null;
    }
    const status: TdStatus =
      dueDate == null ? 'UPCOMING' : dueDate.getTime() <= today.getTime() ? 'DUE' : 'UPCOMING';
    rows.push({ dose, status, dueDate });
  }
  return rows;
}
