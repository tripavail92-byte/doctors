import {
  FlagRule,
  InstrumentDefinitionSpec,
  InstrumentItem,
  ScoreResult,
} from './instrument.types';

// Maximum attainable raw value for a single item.
function itemMax(item: InstrumentItem): number {
  if (item.options && item.options.length > 0) {
    return Math.max(...item.options.map((o) => o.value));
  }
  return item.max ?? 0;
}

/**
 * Pure scoring of an instrument against a map of answers (item key -> value).
 *
 * Deterministic and side-effect free so it can be unit-tested and run either
 * on the server (persisting a ScoredInstrumentResponse) or in the UI for a
 * live preview. Missing answers count as 0 for sum/weighted, and are excluded
 * from the denominator for percent (so a partially-completed ODI still scores
 * against what was answered).
 */
export function scoreInstrument(
  def: InstrumentDefinitionSpec,
  answers: Record<string, number>,
): ScoreResult {
  let raw = 0;
  let answeredMax = 0;
  let totalMax = 0;

  for (const item of def.items) {
    const max = itemMax(item);
    totalMax += def.scoring === 'weighted' ? max * (item.weight ?? 1) : max;

    const answered = Object.prototype.hasOwnProperty.call(answers, item.key);
    const value = answered ? Number(answers[item.key]) || 0 : 0;
    if (answered) answeredMax += max;

    raw += def.scoring === 'weighted' ? value * (item.weight ?? 1) : value;
  }

  let score: number;
  let maxScore: number;
  if (def.scoring === 'percent') {
    maxScore = 100;
    score = answeredMax > 0 ? Math.round((raw / answeredMax) * 100) : 0;
  } else {
    maxScore = totalMax;
    score = raw;
  }

  const band = def.bands.find((b) => score >= b.min && score <= b.max);
  return {
    score,
    maxScore,
    band: band ? band.label : 'Unclassified',
    severity: band ? band.severity : 'none',
    flags: evaluateFlags(def.flagRules, answers, score),
  };
}

/** True when `value` satisfies the comparators present on the rule. */
function ruleMatches(rule: FlagRule, value: number): boolean {
  if (rule.gte != null && !(value >= rule.gte)) return false;
  if (rule.gt != null && !(value > rule.gt)) return false;
  if (rule.lte != null && !(value <= rule.lte)) return false;
  if (rule.lt != null && !(value < rule.lt)) return false;
  if (rule.eq != null && !(value === rule.eq)) return false;
  // A rule with no comparator never fires (avoids accidental always-on flags).
  return rule.gte != null || rule.gt != null || rule.lte != null || rule.lt != null || rule.eq != null;
}

/**
 * Evaluate safety flag rules. Item-scoped rules test the raw answer (a missing
 * answer counts as 0); score-scoped rules test the computed total. Fires
 * independently of the severity band so e.g. a low total PHQ-9 with a positive
 * self-harm item still raises the flag. De-duplicated, order-stable.
 */
export function evaluateFlags(
  rules: FlagRule[] | undefined,
  answers: Record<string, number>,
  score: number,
): string[] {
  if (!rules?.length) return [];
  const flags = new Set<string>();
  for (const rule of rules) {
    const value = rule.item
      ? Number(answers[rule.item]) || 0
      : score;
    if (ruleMatches(rule, value)) flags.add(rule.flag);
  }
  return [...flags];
}
