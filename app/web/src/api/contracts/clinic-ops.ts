/**
 * Clinic ops dashboard endpoints.
 *
 * One type per endpoint. Same source-of-truth pattern as platform.ts —
 * the stub, the UI, and (eventually) the backend all read these types.
 *
 * Every endpoint carries a Markdown contract at docs/contracts/*.md.
 * For units, invariants, and the four UI states this type feeds, read
 * the contract before changing the shape.
 */

// --- GET /dashboard/today --------------------------------------------------

export interface CountWithDelta {
  count: number;
  /** Signed percentage, one decimal. null when comparison unavailable. */
  deltaPct: number | null;
}

export interface PkrWithDelta {
  pkr: number;
  deltaPct: number | null;
}

export interface DashboardToday {
  generatedAt: string;
  todayLocal: string;
  appointmentsToday: CountWithDelta;
  activePatients: CountWithDelta;
  revenueThisMonth: PkrWithDelta;
  outstandingBalance: PkrWithDelta;
}

// --- GET /appointments/today -----------------------------------------------

export type AppointmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

export interface AppointmentRow {
  id: string;
  start: string;
  end: string;
  durationMin: number;
  status: AppointmentStatus;
  patient: { id: string; name: string; mrn: string };
  provider: { id: string; name: string };
  service: { id: string | null; label: string };
  roomLabel: string | null;
}

export interface AppointmentsTodayResponse {
  todayLocal: string;
  rows: AppointmentRow[];
}

// --- GET /sessions/in-progress ---------------------------------------------

export type SessionStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PERFORMED'
  | 'CONSUMABLES_CONFIRMED'
  | 'CLOSED'
  | 'NO_SHOW'
  | 'CANCELLED';

export interface RoomSession {
  id: string;
  patient: { id: string; name: string; mrn: string };
  service: string;
  startedAt: string;
  expectedDurationMin: number;
  elapsedMin: number;
  remainingMin: number;
  /** 0–100, capped server-side. */
  progressPct: number;
  status: SessionStatus;
}

export interface RoomStatusRow {
  roomId: string;
  roomLabel: string;
  session: RoomSession | null;
}

export interface SessionsInProgressResponse {
  asOf: string;
  rooms: RoomStatusRow[];
}

// --- GET /encounters/recent -------------------------------------------------

export interface RecentEncounter {
  id: string;
  patient: { id: string; name: string; mrn: string };
  provider: { id: string; name: string };
  occurredAt: string;
  concern: string | null;
  recommendation: string | null;
}

export interface RecentEncountersResponse {
  rows: RecentEncounter[];
}

// --- GET /reports/revenue-split --------------------------------------------

export type RevenuePeriod = 'today' | 'this-week' | 'this-month' | 'last-30d';

export interface RevenueSplit {
  period: { from: string; to: string };
  totalPkr: number;
  clinicPkr: number;
  /** Percentage that goes to the clinic, 0-100, one decimal. Sums with doctorPct to exactly 100. */
  clinicPct: number;
  doctorPkr: number;
  doctorPct: number;
}

// --- GET /pharmacy/stock/alerts --------------------------------------------

export type StockSeverity = 'critical' | 'low';

export interface StockAlertRow {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  reorderAt: number;
  severity: StockSeverity;
  note: string | null;
}

export interface StockAlertsResponse {
  rows: StockAlertRow[];
}

// --- GET /reports/doctor-earnings ------------------------------------------

export interface DoctorEarningRow {
  userId: string;
  name: string;
  pkr: number;
  deltaPct: number | null;
}

export interface DoctorEarningsResponse {
  period: { from: string; to: string };
  rows: DoctorEarningRow[];
}

// --- GET /patients/queue ---------------------------------------------------

export type QueueStatus = 'CHECKED_IN' | 'WAITING' | 'CONSULTATION' | 'IN_PROGRESS' | 'DONE';

export interface QueueRow {
  patient: { id: string; name: string; mrn: string };
  arrivedAt: string;
  waitedMin: number;
  status: QueueStatus;
  appointmentId: string | null;
  roomLabel: string | null;
}

export interface QueueResponse {
  asOf: string;
  rows: QueueRow[];
}

// --- GET /crm/funnel — already implemented backend-side --------------------

export interface CrmFunnel {
  total: number;
  byStatus: Record<string, number>;
  conversionRatePct: number;
}
