import { DoseRule } from '@prisma/client';
import { Concentration, Drug } from './drug-catalog';

// Maps a DoseRule row onto the shape the pure dose engine already consumes.
//
// The engine (dose-engine.ts) and its formulas are deliberately untouched by
// the move from a hardcoded catalog to the DB — only the source of the numbers
// changed. Keeping the `Drug` view type as the boundary means the engine has no
// idea a database exists, and stays trivially unit-testable.
export type DoseRuleView = Drug;

export function ruleToView(r: DoseRule): DoseRuleView {
  return {
    key: r.drugKey,
    name: r.displayName,
    mgPerKgPerDay: r.mgPerKgPerDay,
    dosesPerDay: r.dosesPerDay,
    maxSingleMg: r.maxSingleDoseMg ?? undefined,
    maxDailyMg: r.maxDailyDoseMg ?? undefined,
    form: r.form ?? undefined,
    concentrations: (r.concentrations as unknown as Concentration[]) ?? [],
    roundingStepMl: r.roundingStepMl || undefined,
    minAgeMonths: r.minAgeMonths ?? undefined,
    maxWeightKgForRule: r.maxWeightKgForRule ?? undefined,
    cautions: r.cautions ?? [],
    highRisk: r.highRisk,
  };
}

export function defaultConcentration(v: DoseRuleView): Concentration | undefined {
  return v.concentrations?.[0];
}
