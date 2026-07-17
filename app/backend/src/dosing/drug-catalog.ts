// Types for the weight-based dose calculator.
//
// The DRUGS catalog that used to live here is GONE as a runtime read path —
// dose rules now come from the DoseRule table (see dose-rule.seed.ts for the
// starter rows and dose-rule.mapper.ts for the DB -> engine view). A hardcoded
// catalog meant a clinic could not correct a wrong regimen without a deploy.
//
// These types remain because they are the boundary the pure engine consumes,
// which keeps dose-engine.ts free of any knowledge that a database exists.

export interface Concentration {
  label: string; // e.g. "120 mg/5 mL"
  mgPerMl: number;
}

export interface Drug {
  key: string;
  name: string;
  mgPerKgPerDay: number;
  dosesPerDay: number;
  maxSingleMg?: number;
  maxDailyMg?: number;
  form?: string;
  note?: string;
  // Dispensing / safety metadata
  concentrations?: Concentration[];
  roundingStepMl?: number; // round the measured volume to this step (e.g. 0.5 mL)
  minAgeMonths?: number; // rule invalid below this age
  maxWeightKgForRule?: number; // switch to adult dosing above this weight
  cautions?: string[];
  highRisk?: boolean; // flag for mandatory double-check
}
