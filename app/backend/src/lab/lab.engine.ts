import { LabTest } from './lab-catalog';

export type ResultFlag = 'low' | 'normal' | 'high' | 'reported' | 'unknown';

// Flag a numeric result against the test's reference range; text results (e.g.
// culture) are 'reported' (interpreted by the clinician, not range-flagged).
export function flagResult(
  test: LabTest,
  value: number | null | undefined,
  valueText?: string | null,
): ResultFlag {
  if (test.valueType === 'text' || value === null || value === undefined) {
    return valueText ? 'reported' : 'unknown';
  }
  if (test.refLow === undefined && test.refHigh === undefined) return 'reported';
  if (test.refLow !== undefined && value < test.refLow) return 'low';
  if (test.refHigh !== undefined && value > test.refHigh) return 'high';
  return 'normal';
}
