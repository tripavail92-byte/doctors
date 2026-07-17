// SUPERSEDED by ./schedule.engine.ts.
//
// This computed a purely age-based schedule and could not see three failures
// that matter clinically: a dose given too soon after the previous one (it does
// not immunise, and must be repeated), a dose reported due while its predecessor
// was never given, and a dose that stays overdue for life past the age at which
// the vaccine is given at all.
//
// Re-exported so no caller breaks; import from ./schedule.engine directly.
export {
  computeSchedule,
  scheduleSummary,
  type DoseStatus,
  type GivenDose,
  type ScheduleRow,
} from './schedule.engine';
