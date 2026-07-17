// Types for the shared Scored-Instrument engine.
//
// One engine drives every questionnaire/grading tool in the platform (GAGS,
// PHQ-9, GAD-7, Oswestry, and any pack-authored instrument). An instrument is
// pure data — a list of items + a scoring method + severity bands — so adding a
// new one is a data change, not code.

export type ScoringMethod =
  | 'sum' // total = Σ answer values (PHQ-9, GAD-7)
  | 'weighted' // total = Σ (item.weight × answer value) (GAGS regional factors)
  | 'percent'; // total = round(Σ answers ÷ Σ answered-item max × 100) (Oswestry)

export interface InstrumentOption {
  label: string;
  value: number;
}

export interface InstrumentItem {
  key: string;
  label: string;
  weight?: number; // used by 'weighted'
  max?: number; // used by numeric items with no options
  options?: InstrumentOption[];
}

export type Severity =
  | 'none'
  | 'minimal'
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'very_severe'
  | 'crippled';

export interface SeverityBand {
  label: string;
  min: number; // inclusive
  max: number; // inclusive
  severity: Severity;
}

/**
 * A safety/clinical flag that fires independently of the total score.
 *
 * The canonical example is PHQ-9 item 9 (self-harm): a positive response must
 * raise a risk flag even when the overall depression score is low. `item` +
 * threshold is evaluated against the raw answer value; if `item` is omitted the
 * rule is evaluated against the computed total `score`.
 */
export interface FlagRule {
  flag: string;
  /** Item key to test; omit to test the total score instead. */
  item?: string;
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
  eq?: number;
  /** Human-readable guidance shown when the flag fires. */
  message?: string;
  /** Marks a flag that requires immediate clinical attention. */
  critical?: boolean;
}

export interface InstrumentDefinitionSpec {
  key: string;
  name: string;
  specialty?: string;
  version: string;
  scoring: ScoringMethod;
  description?: string;
  items: InstrumentItem[];
  bands: SeverityBand[];
  /** Safety flags that fire independently of the band (e.g. PHQ-9 self-harm). */
  flagRules?: FlagRule[];
  /**
   * When set, each recorded total score is also written back as an Observation
   * under this metric key, so scores auto-trend via the longitudinal Trends
   * engine (e.g. 'phq9_score'). No write-back when omitted.
   */
  observationMetric?: string;
}

export interface ScoreResult {
  score: number;
  maxScore: number;
  band: string;
  severity: Severity | 'none';
  /** Fired safety/clinical flags (empty when none). */
  flags: string[];
}
