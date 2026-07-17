// Typed shapes for the Health OS API responses the SPA consumes.
// These mirror the NestJS controllers/services (see app/backend/src).

export interface LoginResponse {
  accessToken: string;
}

/** Decoded JWT body (see auth/jwt.strategy.ts JwtPayload). */
export interface JwtClaims {
  sub: string;
  tenantId: string | null;
  role: string;
  isPlatformAdmin: boolean;
  iat?: number;
  exp?: number;
}

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  phone: string;
  dob: string | null;
  gender: string | null;
  createdAt: string;
}

export interface ReportSummary {
  patients: number;
  activePacks: number;
  encounters: { total: number; byStatus: Record<string, number> };
  billing: {
    invoices: number;
    billedPkr: number;
    collectedPkr: number;
    outstandingPkr: number;
    byStatus: Record<string, number>;
    paymentsPkr: number;
    refundsPkr: number;
  };
  lab: { orders: number; byStatus: Record<string, number> };
  pharmacy: { dispenses: number; revenuePkr: number };
  clinical: { immunizations: number; instrumentResponses: number; observations: number };
}

export interface RevenueReport {
  clinic: { byMethod: Record<string, number>; totalPkr: number };
  pharmacy: { byMethod: Record<string, number>; totalPkr: number };
  refundsPkr: number;
  netRevenuePkr: number;
}

export interface IntegrationsStatus {
  whatsapp: { provider: string; mode: 'live' | 'stub' };
  fbr: { provider: string; mode: 'live' | 'stub' };
  telehealth: { provider: string; mode: 'live' | 'stub' };
}

// ---- Dental (odontogram) ----

export interface ToothConditionRef {
  code: string;
  label: string;
  dmft: 'D' | 'M' | 'F' | null;
  color: string;
}

export interface DentalReference {
  teeth: { fdi: string; quadrant: number; type: string }[];
  conditions: ToothConditionRef[];
  surfaces: string[];
}

export interface OdontogramTooth {
  fdi: string;
  quadrant: number;
  type: string;
  condition: string;
  surfaces: string[] | null;
  note: string | null;
}

export interface Dmft {
  decayed: number;
  missing: number;
  filled: number;
  dmft: number;
  soundTeeth: number;
}

export interface Odontogram {
  patientId: string;
  teeth: OdontogramTooth[];
  dmft: Dmft;
}

export interface PerioSummary {
  stage: string;
  bopPercent: number;
  maxPocketMm: number;
  maxCalMm: number;
  worstFurcation: string;
}

export interface PerioExam {
  id: string;
  examType: string;
  createdAt: string;
}

// ---- Growth (WHO-LMS) ----

export type GrowthIndicator = 'wfa' | 'lhfa' | 'wfh' | 'bmifa' | 'hcfa';

export interface GrowthCurves {
  sex: string;
  indicator: GrowthIndicator;
  xUnit: 'months' | 'cm';
  zLines: number[];
  curves: Record<string, { x: number; value: number }[]>;
}

export interface GrowthPoint {
  recordedAt: string;
  ageMonths: number;
  x: number;
  value: number;
  z: number | null;
  percentile: number | null;
  classification: string;
}

export interface GrowthSeries {
  patientId: string;
  sex: string;
  indicator: GrowthIndicator;
  xUnit: 'months' | 'cm';
  count: number;
  points: GrowthPoint[];
}

// ---- Dose calculator ----

export interface DoseConcentration {
  label: string;
  mgPerMl: number;
}

export interface DoseRule {
  key: string;
  name: string;
  mgPerKgPerDay: number;
  dosesPerDay: number;
  maxSingleMg?: number;
  maxDailyMg?: number;
  form?: string;
  note?: string;
  concentrations?: DoseConcentration[];
  roundingStepMl?: number;
  minAgeMonths?: number;
  maxWeightKgForRule?: number;
  cautions?: string[];
  highRisk?: boolean;
}

export interface DoseResult {
  drug?: string;
  form?: string;
  highRisk?: boolean;
  weightKg: number;
  mgPerKgPerDay: number;
  dosesPerDay: number;
  perDayMg: number;
  perDoseMg: number;
  cappedDaily: boolean;
  cappedSingle: boolean;
  volumePerDoseMl: number | null;
  volumePerDayMl: number | null;
  rounded: boolean;
  blocked: boolean;
  blockReason: string | null;
  notes: string[];
}

// ---- Obstetrics (ANC card) ----

export interface Ga {
  weeks: number;
  days: number;
  label: string;
}

export interface AncVisit {
  id: string;
  visitDate: string;
  contactNumber: number | null;
  gaWeeks: number | null;
  gaDays: number | null;
  weightKg: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  fundalHeightCm: number | null;
  fhrBpm: number | null;
  presentation: string | null;
  urineAlbumin: string | null;
  hbGdl: number | null;
  oedema: string | null;
  dangerSigns: string[];
  alertFlags: string[];
  nextVisitDate: string | null;
}

export interface TdScheduleRow {
  dose: number;
  status: 'GIVEN' | 'DUE' | 'UPCOMING';
  dueDate: string | null;
}

export interface PregnancyEpisode {
  id: string;
  gravida: number;
  para: number;
  abortus: number;
  eddFinal: string | null;
  eddMethod: string;
  rhFactor: string | null;
  riskFlags: string[];
  fetusCount: number;
  status: string;
  gaNow: Ga | null;
  ancVisits: AncVisit[];
  tdSchedule: TdScheduleRow[];
  partograms?: PartogramRef[];
}

export interface EpisodeSummary {
  id: string;
  status: string;
  eddFinal: string | null;
  gaNow: Ga | null;
}

export interface PartogramRef {
  id: string;
  status: string;
  startedAt: string;
}

export interface PartogramEntry {
  id: string;
  recordedAt: string;
  cervicalDilationCm: number | null;
  descentFifths: number | null;
  contractionsPer10Min: number | null;
  contractionDurationSec: number | null;
  fhrBpm: number | null;
  fhrDeceleration: string | null;
  amnioticFluid: string | null;
  caput: number | null;
  moulding: number | null;
  maternalPulse: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  temperatureC: number | null;
  alertFlags: string[];
}

export interface Partogram {
  id: string;
  startedAt: string;
  parity: number;
  membraneStatus: string;
  status: string;
  closedAt: string | null;
  companionPresent: boolean | null;
  entries: PartogramEntry[];
}
