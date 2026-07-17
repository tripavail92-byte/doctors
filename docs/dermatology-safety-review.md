# Dermatology pack — adversarial safety review

**Date:** 2026-07-16
**Method:** 23-agent adversarial workflow (attack → refute → report) against the grading
engines, the NB-UVB dose engine, and the service layer. Formula claims were checked
against published sources; behavioural claims were reproduced by executing the engine.
**Result:** 14 confirmed defects of 19 candidates. All fixed and re-verified.

## Why the original suite missed all of this

The first dermatology suite passed **60/60** while every defect below was live. It tested
each rule *in isolation* and never two hazards at once. The dose engine's failures live
entirely at the **intersections**: burn × next-visit, grade-2 × gap, MED × ceiling ×
restart. A green suite proved only that the happy path of each rule worked.

There were **zero tests covering erythema** before this review.

## Confirmed defects

### 1. Burn amnesia — the interlock fired once, then escalated past the burning dose (critical)

A grade-3 hold was stored `{skipped: true, deliveredAt: null}`. Both ledger filters exclude
such a row, so the next visit's "last delivered session" was the pre-burn one. Reproduced:
type III, session 5 delivers 1000 → grade-3 blistering → next visit suggests **1150 mJ/cm²
(+15%)** with an audit trail reading *"last erythema grade 0"*. `burnFlag` had **zero
readers anywhere in the codebase**.

**Fix:** `PhototherapyCourse.burnHoldDoseMj` / `burnHoldAt` carry the burn across visits;
the engine anchors on the *burning* dose, not the last delivered one, and clears the hold
once a session is actually delivered. Verified: next visit now suggests 288 (−50%), never
above the burning dose.

### 2. Grade-2 erythema short-circuited the gap rules — a monotonicity inversion (critical)

First-match-wins returned the grade-2 HOLD before ever reaching the gap rules. So a patient
who reacted at 1500 and then missed a month was dosed at **1500**, while an identical
patient with *no reaction* correctly restarted at **500**. Demonstrated over-exposure
earned you 3× more UV. `gapRule()`'s own docstring asserted the opposite invariant — the
file contradicted itself.

**Fix:** rules no longer race to return. Every applicable hazard proposes a candidate dose
and **the most conservative wins**, so hazards can only compound downward. The rationale
names every hazard considered, not just the winner. The one early return is grade-3, which
is a refusal to treat rather than a dose.

Invariant now regression-tested: *for fixed ledger state, suggested dose is non-increasing
as erythema grade goes 0 → 1 → 2 → 3.*

### 3. RESTART and HOLD returned unclamped doses (critical)

Each branch clamped on its own — and two drifted. With a MED unit slip (J/cm² entered as
mJ/cm²), a type II course stored `startDoseMj: 7000` beside `maxDoseMj: 2000`. Session 1
was safe because START clamped, so nobody noticed; a >4-week gap then returned **7000,
`capped: false`** — 3.5× the ceiling. The only ceiling check guarded the *manual* override.

**Fix:** one `clamp()` at the single exit that every return funnels through, so a new branch
cannot reintroduce the class. Rationale is built post-clamp, so the audit trail never quotes
a dose that was not offered. `createCourse` rejects an obvious unit slip and clamps the
stored start so `start ≤ max` always holds.

### 4. `erythemaGrade` was written to the wrong row (major)

`lastErythemaGrade` describes the *previous* session but was stamped on the *new* row, then
read back as if it described that row. Session 1's actual reaction could never land on
session 1. This was defect #1's sibling — the grade-3 landed on a row the filter excludes.

**Fix:** back-written onto the session it describes, inside the same transaction. A new row
records grade 0 meaning *"not yet assessed"*, never *"no erythema"*.

### 5. Nested transaction → pool deadlock (major)

`grade()` held a `forTenant` transaction and called `observations.record()`, which opens its
**own** transaction — a second connection checkout while the first is held. With the default
pool of 9, nine concurrent requests deadlock until `pool_timeout` → 500. It also broke
atomicity: the Observation committed even if the outer write rolled back.

**This affected ophthalmology and rehab too**, not just dermatology.

**Fix:** `ObservationsService.recordIn(tx, ...)` threads the existing transaction;
`record()` remains as the standalone wrapper. All four nested call sites converted.

### 6. VASI regions overlapped — true ceiling 107 against a declared max of 100 (major)

`upper_limbs: 18` and `lower_limbs: 36` are whole-limb rule-of-nines values that already
contain hands and feet, so a separate `hands_feet: 8` double-counted. Since VASI response is
read as *% change* in T-VASI, an inflated baseline distorts every treatment-response reading.

**Fix:** mutually exclusive regions summing to exactly 100, hands and feet split out
(acral vitiligo responds differently). A module-load invariant now asserts the sum — an
overlapping table is invisible to every test that scores less than the whole body, which is
every realistic test. `max` is derived from the table rather than restated.

### 7. EASI adult/child weights came from the client (major)

`child` was a client boolean, while the patient's DOB sat unread in the same transaction.
The engine refuses a client-supplied *band* but accepted the weights that produce the score
the band derives from — the same hole one level down. Failing input: a 5-year-old scored
6.0 "mild" on adult weights vs 12.0 "moderate" correctly.

**Fix:** derived from DOB inside the transaction; 400 if DOB is absent. `growth` and
`immunization` already did this — EASI was the outlier.

### 8. MASI and mMASI shared one trend series (major)

Both wrote to `masi_score`, but MASI is 0–48 and mMASI is 0–24. Since MASI bands are
deliberately null ("track change over time instead"), **the trend line is the only
interpretation offered — and it was the broken one.** An unchanged patient graded MASI 20
then mMASI 15 read as "25% improvement".

**Fix:** `mmasi_score` gets its own metric and reference range. Deliberately **not**
rescaled ×2 — the instruments are not linearly related; that would swap an obvious
discontinuity for a subtler one.

### 9–11. Others

- **Dead skip branch:** the throw made `skipped: true` unreachable, so a burn hold left no
  ledger row at all and was silently indistinguishable from a no-show. Now the hold is
  persisted and returned as `held: true` — throwing would roll back the row that records it.
- **`sessionNo` race:** read-max-then-insert with no lock. The unique constraint prevented
  the duplicate, but only *after* both requests had already decided a dose, and P2002 was
  caught nowhere → opaque 500 on patient-safety code. Now `pg_advisory_xact_lock` per course,
  taken before the decision so it reads a stable ledger.
- **RECEPTION could override the burn interlock:** `recordSession` used `CLINICAL_ROLES`, so a
  receptionist could POST `{lastErythemaGrade: 3, overrideBurnHold: true, overrideDoseMj: 3000}`
  — while the engine's own rationale said "notify prescriber". Now `PRESCRIBER_ROLES`.

## Instructive refutations

Not everything alleged was real, and the refuters earned their keep:

- **`gapDays` negative on clock skew** — refuted. `deliveredAt` is server-generated with no
  client path, and the proposed `Math.max(0, …)` clamp would *launder* a corrupt-clock event
  into a plausible row.
- **`endedAt` nulling** — refuted. The ternary enforces a real invariant; the "fix" would
  have created the inconsistency it claimed to fix.
- **"Two definitions of delivered"** — conceded its own failing state was unreachable.

## Verification

`derma_safety_demo.py` — **29/29**, covering exactly the intersections that were broken:
burn-then-omit-grade; the monotonicity property; grade-2 × 42d / 21d / on-schedule; a burned
patient never dosed above an unburned one; RESTART with MED > ceiling; the grade back-write;
the required-grade rule; the VASI region-sum invariant; MASI/mMASI separation; EASI from DOB.

Plus `derma_demo.py` 61/61, `rehab_demo.py` 28/28, and 18 module suites with zero 500s.

**Note the D3 lesson:** the first version of the grade-2 × gap test passed against the
*broken* engine, because a one-session course ties HOLD and RESTART at 500. It only detects
the bug once the ladder has escalated (661 vs 500). A test that cannot fail proves nothing.

## Round 2 — re-attacking the rewrite found 15 more, including two of my own fixes

The rewrite was re-attacked by a second 27-agent workflow **because it was patient-safety
code I had just rewritten**, and a suite I wrote myself passing 29/29 is not evidence. It
confirmed 15 defects — and two of the round-1 fixes were **defeated by the rewrite's own
structure**.

### The lesson: an early return IS the bug

I fixed "first-match-wins" by making every hazard propose a candidate and taking the
lowest — then kept **one** early return for grade 3, reasoning that a burn outranks
everything. It doesn't:

```
{last: 2000, gap: 42}  →  grade 0/1/2 = 500 RESTART
                          grade 3     = 1000 SKIP_BURN   ← the worst reaction, 2× the dose
```

The early return skipped the gap candidate *and* the burn-hold anchor. It was the identical
class of bug, one branch over. My monotonicity test missed it because it used `gapDays: 0`,
where the gap candidate doesn't exist.

An early return is a rule that silently outranks every rule below it — which is precisely
what this design exists to prevent. Grade-3 is now a candidate like any other, and the two
decisions are separated: **whether to treat** (`skip`) comes from the reaction alone;
**what dose to record** comes from the candidate list.

### The gap axis was inverted too

`gapRule` returns *factors* for 7–28 days but RESTART returned an *absolute* start dose, so
`Math.min` discarded it whenever `last × 0.5 < startDose`:

```
last=350:  gap 28 → 175 (REDUCE)  |  gap 29 → 402 (ESCALATE)
```

A longer absence bought a bigger dose. RESTART is now `min(startDose, last × 0.5)` — capped
at what the 3–4 week rule would have allowed. This under-doses slightly versus "restart at
the naive start dose", which is the safe direction.

### The override could out-dose and erase a burn

`overrideDoseMj` was bounded only by the ceiling, so a course with a documented blister at
1000 could deliver **1500** on a typed reason — and the grade back-write then reset the
recorded grade 3 → 0, `burnFlag` → false, erasing the burn from the record entirely. Now:
while a burn is unresolved the override may only go **downward**; the back-write never
lowers a recorded reaction (`Math.max`); the hold arms only on an actual hold and clears
only once a session is delivered **at or below** the reduced dose.

### Also fixed in round 2

- **MED guard was dead code for types V/VI** — anchored to the ceiling it needed
  `medMj > 10714` while the DTO capped at 10000, so a type VI course with MED 10000
  delivered 5000 mJ against an 800 protocol start. Now anchored to the protocol *start*
  (reject if `start > protocolStart × 2`), and the DTO bound is 3000.
- **`modality` was stored and never read** — a `BB_UVB` course was silently dosed off the
  NB-UVB table (~10× a broadband start). Now refused until each modality has its own table.
- **No dose floor** — repeated sub-4-week gaps halved forever (500 → … → 1, a fixed point).
  Floored at 10% of the start dose, with the rationale telling the clinician the course has
  effectively lapsed. *(The floor value needs clinical sign-off.)*
- **Preview accepted grades the record path rejected** — `?lastErythemaGrade=2.5` missed
  every `===` and fell into escalate: a worse reaction than grade 2 previewed a *higher*
  dose. Now validated at the engine boundary.
- **Future DOB selected child EASI weights** (`ageYears` is signed, `-1 <= 7`).
- **`GradeDto.child` was left inert** — now removed, so the pipe rejects it outright rather
  than silently ignoring it.
- **SCORAD banded 0 as "mild"** while PASI/EASI/GAGS band 0 as "clear".

### Round-2 verification

`derma_safety_demo.py` is now **52/52** and tests the full grade × gap grid rather than one
axis at a time:

| gap | grade 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| 0d | 760 | 760 | 661 | 331 |
| 21d | 496 | 496 | 496 | 331 |
| 42d | 331 | 331 | 331 | 331 |

Non-increasing along both axes, at every cell. Plus `derma_demo.py` 62/62, `rehab_demo.py`
28/28, and 20 module suites with zero 500s.

## Still owed — clinical sign-off before any patient use

1. **The VASI region table.** The caps are rule-of-nines–derived and self-consistent, but
   **not** checked against Hamzavi (2004). A dermatologist must confirm them, and confirm
   that hands/feet score separately.
2. **Whether a burn hold belongs in the ledger** as a clinical event (implemented as yes).
3. **Whether `overrideBurnHold` should exist at all.** The override is reason-gated and
   audited, and is not itself a defect — but it was the *only* path to the engine's own
   −50% restart dose, which was an accident of defect #1 rather than a design.
4. **"Most conservative applicable rule wins"** as the intended semantics for every
   intersection.
5. **The MED entry path** — `@Max(10000)` still permits values a clinician would never mean.
6. **PASI/MASI band boundaries** — PASI cut-offs vary by publication; the "rule of tens"
   convention is used here.
7. **The RESTART semantics.** `min(startDose, last × 0.5)` is more conservative than
   "restart at the naive start dose". It was chosen to keep the gap axis monotonic; confirm
   the under-dosing is acceptable, or supply the correct rule.
8. **The dose floor** (10% of the start dose). A reasoned guard against geometric collapse,
   not a sourced minimum therapeutic dose.

## Round 3 — 15 more, and the diagnosis that mattered

A third pass found 15 more, and its verdict was the most useful output of the whole
exercise: **"No. Not converging."** Every round the same class reappeared in new clothes,
and *two of round 2's own fixes were the top defects*.

The reviewers named the structural cause, which I had missed twice:

> Burn state is reconstructed ad hoc at four separate branch sites that must agree and
> don't. Until those collapse into a single derived anchor computed once per request,
> round 4 will find a fourth instance.

That was exactly right.

### The critical one — my fix, defeated by my own code

The override guard read `course.burnHoldDoseMj` — the **persisted** hold. But on the visit
a grade-3 is *first reported*, that column is still null. So on the one visit that matters
most, the "may only be overridden downward" rule never ran:

```
v4  POST {lastErythemaGrade: 3, overrideBurnHold: true,
          overrideReason: "pt travelling", overrideDoseMj: 3000}
    → engine: "Do not treat… Notify the prescriber", suggests 331
    → service: delivers 3000 mJ — 4.5× the burning dose — and the hold never arms
```

**Fix (structural, not local):** one `burnAnchor`, derived once per request *before* the
override block, from the current decision rather than the stale column — and the arm/clear
branches collapsed into a single block keyed on it.

### The others

- **A 0 mJ row resolved the burn.** `overrideDoseMj` was `@Min(0)`, and a lamp-fault row
  (attended, nothing delivered) cleared the hold — re-arming the full-dose override. Now
  `@Min(1)`, and clearing requires `doseMj > 0` at or below the reduced dose.
- **The floor out-dosed every candidate.** With a hold at 50, candidates were ESCALATE 57
  and POST_BURN_REDUCE 25 — and the floor lifted the answer to **50, the exact dose that
  burned**, above both, while the rationale read *"applied the most conservative"*. It also
  deadlocked the hold, which can only clear at ≤25.
- **A measured MED bounded only the start, not the ceiling.** MED 200 on type VI started at
  140 but was ceilinged at the table's 5000 — **25× the patient's own erythema threshold** —
  and grade-1-every-visit walked the ladder all the way there. `ceilingFor()` now bounds by
  `MED × 6`. *(The multiple needs clinical sign-off.)*
- **Grade 1 escalated identically to grade 0** — only the `ruleFired` string differed,
  naming a distinction the arithmetic didn't make. Now a half step.
- **`protocolKey` was free text**, stored and never resolved: `NBUVB_AGGRESSIVE` would be
  accepted and silently dosed off the standard table. Now `@IsIn`.

### The floor: two wrong answers before the right one

Worth recording, because both wrong answers looked reasonable:

1. **Raise a sub-floor dose to the floor** → suggested the burning dose, above every
   candidate.
2. **Bound the floor by the lowest candidate** → the floor can then never exceed the
   winner, so it never fires. Dead code, collapse restored.

Both tried to answer a clinical question with arithmetic. A course whose dose has decayed
below therapeutic has **lapsed**; the answer is a prescriber restarting it, not the engine
inventing a bigger number. The decision now carries `lapsed: true` and says so in the
rationale — **the dose stands**.

### Round-3 verification

`test/safety/derma_safety_suite.py` — **67/67**. It now lives **in the repo**: the reviewers
noted the engine's header cited a regression suite that existed only in a scratch directory,
which is its own kind of lie. Run it with `npm run check:derma-safety`.

## Round 4 — 4 confirmed of 17 (12 refuted), and the suite was blessing a bug

Round 4 asked one question: did collapsing burn state to a single anchor break the cycle?
Verdict: **not yet** — but 14 → 15 → 15 → **4** with a brutal refute bar (12 of 16 claims
killed) is a real change in shape. Both criticals were mine.

### A rejection was destroying the burn it detected

The override guard sat inside the same transaction as the grade back-write. Rejecting an
illegal override threw — which **rolled back the very write recording the blister**:

```
v4  POST {lastErythemaGrade: 3, overrideBurnHold: true, overrideDoseMj: 3000}
    → 400 "may only be overridden DOWNWARD"        ← looks like the interlock working
    → DB: burnHoldDoseMj NULL, session grades 0/0/0 ← the burn never happened
    → two weeks on, erythema faded, clinician honestly grades 0
    → 760 mJ onto skin that blistered at 661
```

Nobody had to lie for it to bite. Moving the guard earlier was **not** enough — a rejection
writes nothing either way. The real insight: **the grade is a fact about a *past* session**
and cannot be contingent on whether the *current* request is accepted. `commitReaction()`
now lands the reaction and arms the hold in its own committed transaction, *before* the
session request is evaluated. Rejecting the request that carried it cannot unsay it.

**And my own test blessed the bug.** It asserted `hold == 'NULL'` under the label
*"hold still arms even though the override was refused"* — the label asserted the opposite
of its own assertion. Both were wrong, and they agreed with each other, so it stayed green.

### A burn was escapable by opening a new course

The interlock was keyed on the **course**. Skin belongs to the **patient**: a patient who
blistered at 575 on course A could have course B opened the same day and receive the naive
500 — or the full ceiling with an override, since the downward-only guard had no anchor to
arm against. The START branch also returned the start dose unconditionally, reading neither
the hold nor the gap.

Fixed both halves: `patientBurnHold()` takes the **lowest** unresolved anchor across all of
the patient's courses (lowest, because the interlock may only ratchet down), and the START
branch now proposes `POST_BURN_REDUCE` when a hold exists.

**The suite could not see any of this**, because every scenario shared one patient. Each
scenario now gets a fresh one.

### Also fixed

- `burnFlag` meant two things — "dosed under a hold" at write time, "caused a burn" at
  back-write time — and the back-write silently cleared the first. Now OR-ed.
- The ceiling rationale misattributed a MED-derived bound to the skin-type table
  ("skin type 6 maximum of 1200" when the type-VI max is 5000), pointing a prescriber at
  the wrong knob.

### Round-4 verification

`test/safety/derma_safety_suite.py` — **82/82**, including D18 (a refused override must not
discard the grade-3) and D24 (a burn survives opening a new course). Plus the functional
suite 62/62 and the dental suite 23/23, via `npm run check:clinical`.

**All three suites are now order- and replay-independent** — verified by running the whole
set twice back-to-back. They were not: the functional suite grabbed `patients?take=1`, a
shared row the safety suite burns, so once the interlock became patient-scoped its result
depended on what had run before it. A suite whose outcome depends on execution order is not
a check.

## Standing rule for this engine

Four rounds, four generations of one bug class. The invariants are stated at the top of
`phototherapy.engine.ts` and swept as **grids**, not points:

1. Dose is non-increasing as erythema grade rises, **at every gap**.
2. Dose is non-increasing as the gap grows, **at every grade**.
3. No path returns a dose above the ceiling.
4. No path returns a dose above an unresolved burn anchor.

The through-line across all four rounds: **safety state reconstructed at more than one site
drifts, and safety state scoped to the wrong entity escapes.** There is now exactly one
burn anchor, derived once per request, scoped to the PATIENT, and one clamp at one exit. A
change that needs to recompute either somewhere else is the warning sign — not the fix.

Three rules earned by being broken:

1. **A rule that must "outrank" the others cannot be an early return.** If a new rule can't
   be expressed as a candidate in the list, the design is wrong.
2. **A rejection must never be able to discard a clinical fact.** If a throw and a write
   share a transaction, the throw wins and the fact is lost. Facts about past events commit
   on their own.
3. **Ask what entity the state belongs to.** The burn hold was on the course; skin is on the
   patient. `cumulativeWarning` had the identical mismatch and was fixed one round earlier —
   the same question, unasked twice.

And for the suites: **a test whose setup makes two branches tie cannot fail; a suite whose
result depends on execution order is not a check; a label that contradicts its own assertion
will keep both wrong.** All three happened here.
