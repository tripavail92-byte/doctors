// NB-UVB phototherapy dose engine.
//
// AUTHORITY: the suggested dose is computed here, server-side, from the
// protocol + the course's skin type + the ledger history. The client never
// sets the cumulative dose and cannot bypass the ceiling. A clinician may
// override the suggestion, but only with a typed reason, and the whole
// decision is persisted for audit.
//
// RULE COMBINATION: **the most conservative applicable rule wins.**
//
// Deliberately NOT first-match-wins, and with NO early returns — every hazard
// contributes a candidate dose and the lowest is applied, so hazards can only
// ever compound downward. Two generations of this file got that wrong:
//
//   v1 returned on the first matching rule: grade-2 erythema + a 30-day gap
//   held at the last dose (1500) while an identical patient with NO reaction
//   restarted at 500 — demonstrated over-exposure bought 3x more UV.
//
//   v2 fixed that but kept ONE early return for grade 3, on the reasoning that
//   a burn "outranks" everything. It did not: {last: 2000, gap: 42} gave 500
//   (RESTART) at grade 0 but 1000 (SKIP_BURN) at grade 3 — the worst possible
//   reaction bought twice the dose, and the burn-hold anchor was skipped too.
//
// The lesson is structural: an early return is a rule that silently outranks
// every rule below it, which is the bug this design exists to prevent. Whether
// to TREAT (skip) and WHAT DOSE to record are now decided separately — skip
// comes from the reaction alone, the number from the candidate list.
//
// INVARIANTS (regression-tested in test/safety/derma_safety_suite.py):
//   1. For fixed lastDoseMj and gapDays, suggestedMj is non-increasing as
//      erythema grade goes 0 -> 1 -> 2 -> 3.
//   2. For fixed lastDoseMj and grade, suggestedMj never exceeds the tolerance
//      the gap implies: hold at 7-14d, -25% at 2-3wk, -50% at 3-4wk, and the
//      NAIVE START DOSE beyond 4wk. Note this is deliberately NOT plain
//      monotonicity in gapDays — the 3-4 week rule is more conservative than
//      the restart that follows it, so 28d can suggest less than 29d. Both are
//      at or below naive tolerance, which is the property that matters.
//   3. No path returns a dose above the ceiling.
//   4. No path returns a dose above an unresolved burn anchor.
//
//   v3 broke 1 and 4 again, three more ways: the floor could lift a dose ABOVE
//   both candidates (including above the burning dose); a measured MED bounded
//   only the start, not the ceiling, so a patient could be walked to 25x their
//   own MED; and the service's override guard read the PERSISTED hold, which is
//   still null on the visit the burn is first reported.
//
//   The through-line across all three rounds: safety state reconstructed at
//   more than one site drifts. There is now exactly one burn anchor, derived
//   once per request in recordSession, and one clamp, at one exit.

export type DoseAction =
  | 'START'
  | 'ESCALATE'
  | 'HOLD'
  | 'REDUCE'
  | 'SKIP_BURN'
  | 'RESTART'
  | 'POST_BURN_REDUCE'
  | 'CAPPED';

export interface DoseDecision {
  suggestedMj: number;
  action: DoseAction;
  ruleFired: string;
  rationale: string;
  /** True when the session must not be delivered (burn interlock). */
  skip: boolean;
  burnFlag: boolean;
  /**
   * The dose has decayed below a therapeutic level — the course has lapsed and
   * needs a prescriber to restart it. NOT auto-corrected: raising the dose to a
   * floor is how an earlier version came to suggest the exact dose that had
   * burned the patient.
   */
  lapsed?: boolean;
  capped: boolean;
  cappedAtMj?: number;
  /** Every hazard that applied, not just the winning one — for the audit trail. */
  consideredRules?: string[];
}

export interface PhototherapyProtocolRules {
  startBySkinType: Record<string, number>; // mJ/cm2
  maxBySkinType: Record<string, number>; // mJ/cm2 ceiling
  incrementPct: number;
}

// Reference NB-UVB protocol (system-seeded; a tenant may clone and edit).
// Start/max doses by Fitzpatrick type follow common NB-UVB skin-type protocols.
export const NBUVB_STANDARD: PhototherapyProtocolRules = {
  startBySkinType: { 1: 300, 2: 300, 3: 500, 4: 500, 5: 800, 6: 800 },
  maxBySkinType: { 1: 2000, 2: 2000, 3: 3000, 4: 3000, 5: 5000, 6: 5000 },
  incrementPct: 15,
};

export interface DoseContext {
  fitzpatrickType: number; // 1-6
  protocol: PhototherapyProtocolRules;
  /** Dose of the last DELIVERED session, if any. */
  lastDoseMj?: number | null;
  /** Erythema grade recorded against that last delivered session (0-3). */
  lastErythemaGrade?: number | null;
  /** Whole days since the last delivered session (i.e. since the last UV). */
  gapDays?: number | null;
  /**
   * Dose that previously caused a grade-3 burn and has not yet been superseded
   * by a delivered session. Carries the interlock ACROSS visits: without it the
   * burn row (skipped, no deliveredAt) is invisible to the ledger filters and
   * the engine happily escalates above the dose that blistered the patient.
   */
  burnHoldDoseMj?: number | null;
  /** Optional Minimal Erythema Dose; when present it overrides the skin-type start. */
  medMj?: number | null;
  /** Course-level override of the protocol default. */
  incrementPct?: number | null;
  maxDoseMj?: number | null;
}

const roundDose = (mj: number): number => Math.round(mj);

/**
 * Missed-session rules. Never silently keep escalating after a long gap —
 * tolerance decays, so the previous dose can burn.
 */
export function gapRule(gapDays: number): { action: DoseAction; factor: number; rule: string } | null {
  if (gapDays < 7) return null; // on schedule — normal escalation
  if (gapDays <= 14) return { action: 'HOLD', factor: 1.0, rule: 'gap_7_14d_hold' };
  if (gapDays <= 21) return { action: 'REDUCE', factor: 0.75, rule: 'gap_2_3w_reduce_25' };
  if (gapDays <= 28) return { action: 'REDUCE', factor: 0.5, rule: 'gap_3_4w_reduce_50' };
  return { action: 'RESTART', factor: 0, rule: 'gap_over_4w_restart' };
}

/**
 * The dose a >4-week gap restarts at: the naive start dose for this skin type.
 *
 * This has been wrong in both directions, so the reasoning is recorded.
 *
 * v2 returned the naive start dose plainly. That inverted the gap axis, because
 * every shorter gap applies a FACTOR while this is an ABSOLUTE: with last=350
 * and start=500, a 28-day gap gave 175 but a 29-day gap gave 500.
 *
 * v3 "fixed" that by capping at `min(start, last * 0.5)`. That removed the
 * inversion and introduced a RATCHET: each lapse halves the anchor, so a
 * patient who misses five weeks repeatedly walks 500 -> 250 -> 125 -> 63 -> 50
 * and the course dies at the floor. Restarting is supposed to be a reset, not a
 * penalty that compounds.
 *
 * The mistake both times was treating gap-monotonicity as the safety invariant.
 * It is not. The safety requirement is that the dose never exceeds the
 * patient's TOLERANCE, and after >4 weeks off, tolerance is naive by
 * definition — which is exactly the dose a brand-new patient of this skin type
 * receives. So the naive start dose is safe here, and the 28-vs-29-day step up
 * is real but harmless: the 3-4 week rule is simply more conservative than the
 * restart it precedes.
 *
 * CLINICAL REVIEW: that discontinuity is the protocol's own shape, not a
 * derivation of mine, and a dermatologist should confirm it is intended.
 */
function restartDose(ctx: DoseContext): number {
  return startDoseFor(ctx);
}

/**
 * Minimum therapeutic dose. Below this the course has effectively lapsed:
 * repeated sub-4-week gaps each halve the dose (500 -> 250 -> ... -> 1), and
 * the engine would go on "escalating" from 1 mJ forever without ever tripping
 * the restart rule.
 *
 * Used only to FLAG the lapse (DoseDecision.lapsed), never to raise the dose.
 *
 * CLINICAL REVIEW: 10% of the skin-type start is a reasoned floor, not a
 * sourced one. A dermatologist should set the real minimum therapeutic dose.
 */
function doseFloor(ctx: DoseContext): number {
  return Math.max(1, Math.round(startDoseFor(ctx) * 0.1));
}

export function startDoseFor(ctx: DoseContext): number {
  // A measured MED beats the skin-type table when available.
  if (ctx.medMj && ctx.medMj > 0) return roundDose(ctx.medMj * 0.7);
  const start = ctx.protocol.startBySkinType[String(ctx.fitzpatrickType)];
  if (start == null) {
    throw new Error(
      `No start dose for Fitzpatrick type ${ctx.fitzpatrickType}. Skin type must be I-VI and typed before starting phototherapy.`,
    );
  }
  return start;
}

/**
 * Multiple of a measured MED that the ceiling may never exceed.
 *
 * CLINICAL REVIEW: 6x is a reasoned bound, not a sourced one — set by whoever
 * owns the protocol.
 */
export const MED_CEILING_MULTIPLE = 6;

export function ceilingFor(ctx: DoseContext): number {
  const skinTypeMax = ctx.protocol.maxBySkinType[String(ctx.fitzpatrickType)];
  if (skinTypeMax == null) {
    throw new Error(`No dose ceiling for Fitzpatrick type ${ctx.fitzpatrickType}.`);
  }
  let ceiling = ctx.maxDoseMj && ctx.maxDoseMj > 0 ? ctx.maxDoseMj : skinTypeMax;

  // A measured MED bounds the CEILING, not just the start dose.
  //
  // It previously only moved the start, so a patient with MED 200 on skin type
  // VI started at 140 and was ceilinged at the type-VI table value of 5000 —
  // 25x their own measured erythema threshold. With increment 50 and erythema
  // grade 1 reported at every visit, the ladder walked all the way there. The
  // whole point of measuring MED is that this patient is not the table.
  if (ctx.medMj && ctx.medMj > 0) {
    ceiling = Math.min(ceiling, Math.round(ctx.medMj * MED_CEILING_MULTIPLE));
  }
  return ceiling;
}

/**
 * Erythema grade must be an integer 0-3.
 *
 * The preview endpoint only checked Number.isFinite, so ?lastErythemaGrade=2.5
 * fell through every === comparison to the escalate branch: a WORSE reaction
 * than grade 2 returned a HIGHER dose than grade 2's hold. -1 did the same.
 */
function assertGrade(ctx: DoseContext): void {
  const g = ctx.lastErythemaGrade;
  if (g == null) return;
  if (!Number.isInteger(g) || g < 0 || g > 3) {
    throw new Error(`Erythema grade must be an integer 0-3 (got ${g}).`);
  }
}

function assertSkinType(ctx: DoseContext): void {
  if (!Number.isInteger(ctx.fitzpatrickType) || ctx.fitzpatrickType < 1 || ctx.fitzpatrickType > 6) {
    throw new Error(
      `Fitzpatrick skin type must be 1-6 (got ${ctx.fitzpatrickType}). Unknown skin type blocks phototherapy.`,
    );
  }
}

/**
 * The ONE place the ceiling is applied.
 *
 * Previously each branch clamped (or forgot to) on its own, and two of them —
 * RESTART and the grade-2 HOLD — drifted, returning doses above the skin-type
 * maximum with `capped: false`. Every return path now funnels through here, so
 * a new branch cannot reintroduce that class of bug. The rationale is built
 * appended here rather than rebuilt, so the audit line states both the value the
 * rules produced and the ceiling that overrode it — a clinician needs to see the
 * clamp happened, not just its result.
 */
function clamp(ctx: DoseContext, d: DoseDecision): DoseDecision {
  const ceiling = ceilingFor(ctx);
  if (d.suggestedMj <= ceiling) return d;
  return {
    ...d,
    suggestedMj: ceiling,
    capped: true,
    cappedAtMj: ceiling,
    rationale:
      `${d.rationale} Clamped to the skin type ${ctx.fitzpatrickType} maximum of ` +
      `${ceiling} mJ/cm2 (unclamped value would have been ${d.suggestedMj}).`,
  };
}

/**
 * Compute the dose for the NEXT session.
 *
 * `lastErythemaGrade` describes the reaction to the LAST DELIVERED session and
 * is what gates escalation, so it must be captured before this runs.
 */
export function suggestDose(ctx: DoseContext): DoseDecision {
  assertSkinType(ctx);
  assertGrade(ctx);
  const increment = ctx.incrementPct ?? ctx.protocol.incrementPct;

  // First session of THIS course.
  //
  // An unresolved burn still applies. This branch used to return the naive
  // start dose unconditionally and read neither burnHoldDoseMj nor gapDays,
  // which made a burn escapable by opening a new course: a patient who
  // blistered at 575 on course A could have course B opened the same day and
  // receive the naive 500 — or the full ceiling with an override, since the
  // downward-only guard had no anchor to arm against. Skin belongs to the
  // patient, not the course.
  if (ctx.lastDoseMj == null) {
    const start = startDoseFor(ctx);
    const startRationale = ctx.medMj
      ? `First session: 70% of measured MED ${ctx.medMj} mJ/cm2.`
      : `First session: skin type ${ctx.fitzpatrickType} start dose ${start} mJ/cm2.`;

    if (ctx.burnHoldDoseMj) {
      const postBurn = roundDose(ctx.burnHoldDoseMj * 0.5);
      if (postBurn < start) {
        return clamp(ctx, {
          suggestedMj: postBurn,
          action: 'POST_BURN_REDUCE',
          ruleFired: 'post_burn_restart_50',
          rationale:
            `${startRationale} Reduced to ${postBurn} mJ/cm2: this patient has an unresolved ` +
            `grade-3 burn at ${ctx.burnHoldDoseMj} mJ/cm2, which a new course does not clear.`,
          skip: false,
          burnFlag: false,
          capped: false,
          consideredRules: ['start', 'post_burn_restart_50'],
        });
      }
    }

    return clamp(ctx, {
      suggestedMj: start,
      action: 'START',
      ruleFired: ctx.medMj ? 'start_from_med_70pct' : 'start_by_skin_type',
      rationale: startRationale,
      skip: false,
      burnFlag: false,
      capped: false,
      consideredRules: ['start'],
    });
  }

  const last = ctx.lastDoseMj;
  const grade = ctx.lastErythemaGrade ?? 0;

  // Whether to treat is decided by the reaction ALONE, and separately from what
  // dose to write down for when treatment resumes. Collapsing the two is what
  // made an earlier version return early on grade 3 and skip every other
  // hazard: {last: 2000, gap: 42} gave 500 (RESTART) at grade 0 but 1000
  // (SKIP_BURN) at grade 3 — the worst reaction bought twice the dose.
  const skip = grade >= 3;

  // The anchor a reduction applies to. After an unresolved burn it is the dose
  // that BURNED, not the last delivered one, and it can only ratchet downward.
  const anchor = ctx.burnHoldDoseMj ? Math.min(last, ctx.burnHoldDoseMj) : last;

  // Each applicable hazard proposes a dose; the lowest wins.
  const candidates: { mj: number; action: DoseAction; rule: string; why: string }[] = [];

  // Erythema axis.
  if (grade >= 3) {
    candidates.push({
      mj: roundDose(anchor * 0.5),
      action: 'SKIP_BURN',
      rule: 'erythema_grade3_skip_burn',
      why: `persistent erythema/blistering (grade 3) after ${anchor} mJ/cm2 requires -50% before treatment resumes`,
    });
  } else if (grade === 2) {
    candidates.push({
      mj: anchor,
      action: 'HOLD',
      rule: 'erythema_grade2_hold',
      why: `erythema persisting 24-48h (grade 2) holds at ${anchor} mJ/cm2`,
    });
  } else if (grade === 1) {
    // Grade 1 is a REACTION, not a clean visit: minimal erythema at <24h means
    // the last dose was at the edge of tolerance. It previously escalated by the
    // identical full step as grade 0 — only the ruleFired string differed, which
    // named a distinction the arithmetic did not make. Half-step instead.
    candidates.push({
      mj: roundDose(anchor * (1 + increment / 200)),
      action: 'ESCALATE',
      rule: 'erythema_grade1_half_step',
      why: `minimal erythema (grade 1) permits only a half step, +${increment / 2}% from ${anchor} mJ/cm2`,
    });
  } else {
    candidates.push({
      mj: roundDose(anchor * (1 + increment / 100)),
      action: 'ESCALATE',
      rule: 'no_erythema_step',
      why: `no erythema permits +${increment}% from ${anchor} mJ/cm2`,
    });
  }

  // Unresolved burn from a previous visit that no delivered session has yet
  // superseded. Contributes independently of the current reaction.
  if (ctx.burnHoldDoseMj) {
    candidates.push({
      mj: roundDose(ctx.burnHoldDoseMj * 0.5),
      action: 'POST_BURN_REDUCE',
      rule: 'post_burn_restart_50',
      why: `a grade-3 burn at ${ctx.burnHoldDoseMj} mJ/cm2 has not yet been followed by a delivered session, so resume at -50%`,
    });
  }

  // Missed-session axis.
  const gap = ctx.gapDays != null ? gapRule(ctx.gapDays) : null;
  if (gap) {
    if (gap.action === 'RESTART') {
      candidates.push({
        mj: restartDose(ctx),
        action: 'RESTART',
        rule: gap.rule,
        why: `${ctx.gapDays} days since the last session (>4 weeks) means tolerance is lost, so restart the protocol`,
      });
    } else {
      candidates.push({
        mj: roundDose(anchor * gap.factor),
        action: gap.action,
        rule: gap.rule,
        why:
          gap.factor === 1
            ? `${ctx.gapDays} days since the last session (1-2 weeks) forbids escalation`
            : `${ctx.gapDays} days since the last session requires a ${Math.round((1 - gap.factor) * 100)}% reduction`,
      });
    }
  }

  const winner = candidates.reduce((lo, c) => (c.mj < lo.mj ? c : lo));
  const others = candidates.filter((c) => c !== winner);

  // The reported ACTION names the governing clinical event, not whichever
  // candidate happened to win the arithmetic.
  //
  // Same principle as `skip`: a grade-3 always reads SKIP_BURN even if another
  // hazard set the number. Likewise a >4-week lapse always reads RESTART — with
  // last=350 and a 45-day gap, ESCALATE (402) legitimately beats RESTART (500)
  // on dose, but a ledger line reading "ESCALATE" after a six-week absence
  // describes the wrong event. The dose is the minimum; the label is the reason.
  const restarted = candidates.some((c) => c.action === 'RESTART');
  const action: DoseAction = skip ? 'SKIP_BURN' : restarted ? 'RESTART' : winner.action;

  // Geometric collapse is reported, never corrected by raising the dose.
  //
  // The first attempt at this RAISED a sub-floor winner up to the floor. With a
  // burn hold at 50 the candidates were ESCALATE 57 and POST_BURN_REDUCE 25 —
  // and the floor lifted the answer to 50, the exact dose that had blistered the
  // patient, above BOTH candidates, while the rationale read "applied the most
  // conservative". It also deadlocked the hold, which can only clear at <= 25.
  //
  // The second attempt bounded the floor by the lowest candidate, which made it
  // inert: the floor can then never exceed the winner, so it never fires and the
  // 500 -> 250 -> ... -> 1 collapse is back.
  //
  // Both attempts were trying to answer a clinical question with arithmetic. A
  // course whose dose has decayed below a therapeutic level has LAPSED, and the
  // fix is a prescriber restarting it — not the engine quietly inventing a
  // bigger number. So the dose stands, and the decision says so.
  const suggestedMj = winner.mj;
  const lapsed = !skip && suggestedMj < doseFloor(ctx);

  // Name every hazard, not just the winner — a clinician reading "hold at 1500"
  // needs to know a 30-day gap was also in play.
  let rationale = `Suggested ${suggestedMj} mJ/cm2: ${winner.why}.`;
  if (others.length) {
    rationale += ` Also considered: ${others.map((o) => `${o.why} (${o.mj} mJ/cm2)`).join('; ')}. Applied the most conservative.`;
  }
  if (lapsed) {
    rationale +=
      ` COURSE LAPSED: repeated reductions have driven the dose to ${suggestedMj} mJ/cm2, below the ` +
      `${doseFloor(ctx)} mJ/cm2 minimum therapeutic dose. This is not a treatment. A prescriber ` +
      `must restart the course rather than continue at this dose.`;
  }
  if (skip) {
    rationale = `Do not treat: ${rationale} Notify the prescriber.`;
  }

  return clamp(ctx, {
    suggestedMj,
    action,
    ruleFired: skip ? 'erythema_grade3_skip_burn' : winner.rule,
    rationale,
    skip,
    burnFlag: skip,
    lapsed,
    capped: false,
    consideredRules: candidates.map((c) => c.rule),
  });
}

/** Soft counselling threshold on lifetime UV load; higher risk in types I-II. */
export function cumulativeWarning(
  cumulativeMj: number,
  fitzpatrickType: number,
): string | null {
  const threshold = fitzpatrickType <= 2 ? 150_000 : 300_000;
  if (cumulativeMj >= threshold) {
    return `Cumulative NB-UVB exposure ${cumulativeMj} mJ/cm2 exceeds ${threshold} for skin type ${fitzpatrickType} — review lifetime UV load and counsel on skin-cancer surveillance.`;
  }
  return null;
}
