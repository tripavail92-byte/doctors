// Reference-range catalog for observation metrics.
//
// Adult defaults — a real deployment would layer age/sex-specific ranges (and
// the growth engine handles pediatric anthropometry separately). `metric` keys
// are the stable identifiers stored on Observation.metric.

export interface MetricRef {
  key: string;
  label: string;
  unit: string;
  low?: number; // reference lower bound (inclusive)
  high?: number; // reference upper bound (inclusive)
  higherIsWorse?: boolean; // hint for UI colouring of out-of-range values
  decimals?: number;
}

export const METRICS: Record<string, MetricRef> = {
  weight_kg: { key: 'weight_kg', label: 'Weight', unit: 'kg', decimals: 1 },
  height_cm: { key: 'height_cm', label: 'Height', unit: 'cm', decimals: 1 },
  bmi: { key: 'bmi', label: 'BMI', unit: 'kg/m2', low: 18.5, high: 24.9, decimals: 1 },
  sbp_mmhg: { key: 'sbp_mmhg', label: 'Systolic BP', unit: 'mmHg', low: 90, high: 120, higherIsWorse: true },
  dbp_mmhg: { key: 'dbp_mmhg', label: 'Diastolic BP', unit: 'mmHg', low: 60, high: 80, higherIsWorse: true },
  hr_bpm: { key: 'hr_bpm', label: 'Heart rate', unit: 'bpm', low: 60, high: 100 },
  rr_bpm: { key: 'rr_bpm', label: 'Respiratory rate', unit: '/min', low: 12, high: 20 },
  temp_c: { key: 'temp_c', label: 'Temperature', unit: 'C', low: 36.1, high: 37.5, higherIsWorse: true, decimals: 1 },
  spo2_pct: { key: 'spo2_pct', label: 'SpO2', unit: '%', low: 95, high: 100 },
  hba1c_pct: { key: 'hba1c_pct', label: 'HbA1c', unit: '%', low: 4, high: 5.7, higherIsWorse: true, decimals: 1 },
  fbs_mgdl: { key: 'fbs_mgdl', label: 'Fasting glucose', unit: 'mg/dL', low: 70, high: 100, higherIsWorse: true },
  rbs_mgdl: { key: 'rbs_mgdl', label: 'Random glucose', unit: 'mg/dL', low: 70, high: 140, higherIsWorse: true },
  ldl_mgdl: { key: 'ldl_mgdl', label: 'LDL cholesterol', unit: 'mg/dL', high: 100, higherIsWorse: true },
  iop_mmhg: { key: 'iop_mmhg', label: 'Intraocular pressure', unit: 'mmHg', low: 10, high: 21, higherIsWorse: true },
  nprs: { key: 'nprs', label: 'Pain (NPRS)', unit: 'score', low: 0, high: 3, higherIsWorse: true },
  va_logmar: { key: 'va_logmar', label: 'Visual acuity (logMAR)', unit: 'logMAR', low: 0, high: 0.3, higherIsWorse: true, decimals: 2 },

  // Scored-instrument totals written back for auto-trending. `high` is the top
  // of the lowest-severity band, so any escalation reads as out-of-range.
  phq9_score: { key: 'phq9_score', label: 'PHQ-9 score', unit: 'score', low: 0, high: 4, higherIsWorse: true },
  gad7_score: { key: 'gad7_score', label: 'GAD-7 score', unit: 'score', low: 0, high: 4, higherIsWorse: true },
  gags_score: { key: 'gags_score', label: 'GAGS score', unit: 'score', low: 0, high: 18, higherIsWorse: true },
  pasi_score: { key: 'pasi_score', label: 'PASI', unit: 'score', low: 0, high: 5, higherIsWorse: true, decimals: 1 },
  easi_score: { key: 'easi_score', label: 'EASI', unit: 'score', low: 0, high: 7, higherIsWorse: true, decimals: 1 },
  scorad_score: { key: 'scorad_score', label: 'SCORAD', unit: 'score', low: 0, high: 25, higherIsWorse: true, decimals: 1 },
  // MASI/VASI have no validated severity bands, so no reference bound is set —
  // they are read as change over time, not against a threshold.
  // MASI (0-48) and mMASI (0-24) are DIFFERENT scales and are not linearly
  // related, so they get separate series. Mixing them in one trend made an
  // unchanged patient look 25% improved purely by switching instrument.
  masi_score: { key: 'masi_score', label: 'MASI', unit: 'score', higherIsWorse: true, decimals: 1 },
  mmasi_score: { key: 'mmasi_score', label: 'mMASI', unit: 'score', higherIsWorse: true, decimals: 1 },
  vasi_score: { key: 'vasi_score', label: 'T-VASI', unit: 'score', higherIsWorse: true, decimals: 1 },
  odi_percent: { key: 'odi_percent', label: 'Oswestry Disability Index', unit: '%', low: 0, high: 20, higherIsWorse: true },
};

// Look up a metric, falling back to a bare (rangeless) descriptor for unknown
// keys so the engine still works for pack-defined metrics not in the catalog.
export function metricRef(key: string): MetricRef {
  return METRICS[key] ?? { key, label: key, unit: '' };
}
