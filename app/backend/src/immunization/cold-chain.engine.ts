import { VvmStage } from '@prisma/client';

// Cold-chain rules: may this vial be used, and which vial next?
//
// Vaccines are not ordinary stock. Potency depends on an unbroken cold chain,
// and a heat-damaged vial is visually identical to a good one — the VVM square
// on the label is the only field evidence, and it is irreversible. So "in date
// and in the fridge" is not sufficient: a vial can be weeks from expiry, cold
// right now, and already dead from a transport excursion last month.
//
// This matters more than ordinary stock control because the failure is silent
// and delayed. A dud dose produces a child who is immunised on paper and
// susceptible in fact. Nobody finds out until an outbreak.

export interface BatchLike {
  id: string;
  vaccineCode: string;
  lotNumber: string;
  expiry: Date;
  vvmStage: VvmStage;
  dosesRemaining: number;
  discardedAt?: Date | null;
}

export type UsabilityCode =
  | 'usable'
  | 'expired'
  | 'vvm_discard'
  | 'discarded'
  | 'empty';

export interface Usability {
  usable: boolean;
  code: UsabilityCode;
  reason?: string;
  /** Use this vial before others of the same vaccine, and say why. */
  usePriority?: string;
}

/** VVM stages 3 and 4 mean the vial has had too much cumulative heat. */
export const VVM_DISCARD: VvmStage[] = ['STAGE_3', 'STAGE_4'];

/**
 * Can this vial be used right now?
 *
 * Order matters only for the message: a vial that is both expired and VVM-3 is
 * equally unusable either way, but the reason a clinician is shown should be the
 * one they can act on — VVM first, because it implicates the fridge and the rest
 * of its neighbours, not just this vial.
 */
export function batchUsability(b: BatchLike, now: Date): Usability {
  if (b.discardedAt) {
    return { usable: false, code: 'discarded', reason: `Lot ${b.lotNumber} was discarded.` };
  }
  if (VVM_DISCARD.includes(b.vvmStage)) {
    return {
      usable: false,
      code: 'vvm_discard',
      reason:
        `Lot ${b.lotNumber} is at VVM ${b.vvmStage.replace('STAGE_', 'stage ')} — the vial has ` +
        `had too much cumulative heat and must be discarded. Check the fridge and the rest of ` +
        `this shipment.`,
    };
  }
  if (b.expiry.getTime() <= now.getTime()) {
    return {
      usable: false,
      code: 'expired',
      reason: `Lot ${b.lotNumber} expired on ${b.expiry.toISOString().slice(0, 10)}.`,
    };
  }
  if (b.dosesRemaining <= 0) {
    return { usable: false, code: 'empty', reason: `Lot ${b.lotNumber} has no doses left.` };
  }
  return {
    usable: true,
    code: 'usable',
    usePriority:
      b.vvmStage === 'STAGE_2'
        ? `Lot ${b.lotNumber} is at VVM stage 2 — still usable, but use it before stage-1 stock.`
        : undefined,
  };
}

/**
 * Pick the vial to use next.
 *
 * NOT plain FEFO (first-expiry-first-out), which is what the pharmacy does for
 * ordinary stock. VVM stage 2 wins over an earlier expiry, because a stage-2
 * vial is already part-way through its heat budget and will cross into stage 3
 * — becoming waste — while a stage-1 vial that expires sooner is still fine
 * until its date. Sorting by expiry alone quietly throws away the stock most at
 * risk of being lost.
 *
 * Within a VVM stage it IS first-expiry-first-out.
 */
export function pickBatch<T extends BatchLike>(batches: T[], now: Date): T | null {
  const usable = batches.filter((b) => batchUsability(b, now).usable);
  if (!usable.length) return null;

  const stageRank = (s: VvmStage) => (s === 'STAGE_2' ? 0 : 1); // stage 2 first
  return usable.sort(
    (a, b) =>
      stageRank(a.vvmStage) - stageRank(b.vvmStage) ||
      a.expiry.getTime() - b.expiry.getTime() ||
      a.lotNumber.localeCompare(b.lotNumber), // deterministic tie-break
  )[0];
}

/** Batches to pull from the fridge now, with the reason for the discard log. */
export function expiredOrDamaged(batches: BatchLike[], now: Date) {
  return batches
    .filter((b) => !b.discardedAt)
    .map((b) => ({ batch: b, verdict: batchUsability(b, now) }))
    .filter((x) => !x.verdict.usable && x.verdict.code !== 'empty')
    .map((x) => ({
      id: x.batch.id,
      lotNumber: x.batch.lotNumber,
      vaccineCode: x.batch.vaccineCode,
      dosesRemaining: x.batch.dosesRemaining,
      code: x.verdict.code,
      reason: x.verdict.reason,
    }));
}
