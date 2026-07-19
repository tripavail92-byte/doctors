# Clinical sign-off register

**Status: OPEN — these items block real patient use.**

Every clinical number in Health OS came from one of three places: a published
standard, a value derived from a standard, or a value chosen by the engineer
because the code needed one. This document lists every item in the third and
second categories, because software should not be the author of a clinical
threshold.

Nothing here is a bug report. The engine behaves as written and is covered by
automated safety suites. The question in each case is whether *what is written*
is what a clinician would sign their name to.

**How to use this:** for each item, either (a) confirm the current value, or
(b) give the correct one. An item marked ⛔ should be settled before the module
touches a real patient; ⚠️ items are safe to run with but should be reviewed.

**Who should sign:** items 1–5 need a prescribing dermatologist or the
supervising physician. Items 6–8 need whoever owns the clinic's EPI/vaccination
practice. Items 9–11 are lab/records governance. Items 12–14 are business policy
(the practice owner), not clinical.

---

## ⛔ 1. Phototherapy — burn-hold resolution is now PER COURSE

**What the code does now.** When a patient has a grade-3 (blistering) reaction at
dose *D*, every one of that patient's active courses is held: the next dose may
only go down, anchored to *D*. A course is released from the hold only once **that
course** delivers a session at or below *D*/2.

**Why this needs you.** This changed on 2026-07-18. Previously, tolerance shown on
*any one* course released the hold on *all* of them — which let a second, higher-dose
course spring back to its pre-burn trajectory and deliver roughly **three times the
dose that had blistered the patient**. The fix makes each course re-establish
tolerance individually.

**The clinical question.** Is tolerance re-established **per course/body-site**, or
**per patient**? The code now assumes per-course (defensible: tolerance on one site
is not proof for another). If you want it strictly patient-wide, that is a different
— and also implementable — rule, but the current safety property depends on which
you choose.

---

## ⛔ 2. Phototherapy — the dose ceiling multiple (MED × 6)

**What the code does now.** Where a patient's Minimal Erythema Dose (MED) has been
measured, the dose ceiling is `MED × 6`, and this bounds the ceiling — not just the
starting dose. Where no MED is recorded, the ceiling is the Fitzpatrick skin-type
table value.

**Why this needs you.** The multiple of 6 was chosen by the engineer as a
conservative bound. It is not taken from a named protocol. It exists because
without it, a patient with a low measured MED could be walked up to the
skin-type table maximum — in one traced example, 25× their own measured erythema
threshold.

**The clinical question.** Is 6 the right multiple for your protocol? Should it
differ by modality (NB-UVB vs PUVA) or by indication?

---

## ⛔ 3. Phototherapy — restart, gap, and dose-floor semantics

**What the code does now.**
- A gap of **more than 4 weeks** restarts the protocol at the starting dose.
- Shorter gaps apply graduated reductions / forbid escalation.
- A grade-1 reaction permits a **half** increment; grade 2 **holds**; grade 3 **skips
  treatment** and reduces by 50%.
- If repeated reductions drive the dose below a minimum therapeutic level, the
  course is flagged **LAPSED** — the engine does *not* silently raise the dose; it
  states that a prescriber must restart the course.

**Why this needs you.** The gap thresholds, the half-step for grade 1, and the
concept of a "minimum therapeutic dose" are all defensible readings of standard
practice, but the specific numbers are the engineer's.

**The clinical question.** Confirm the gap bands and reductions, the grade-1
half-step, and the dose floor value.

---

## ⚠️ 4. Dermatology — VASI region table

**What the code does now.** The Vitiligo Area Scoring Index uses a region/hand-unit
table derived from the **rule of nines**.

**Why this needs you.** It has **not** been checked against Hamzavi et al. (2004),
the source paper for VASI. It is arithmetically self-consistent and the total is
derived from the table rather than hard-coded, but the regional weights are
derived, not cited.

**The clinical question.** Replace with the published table, or confirm the
derivation is acceptable for your use.

---

## ⚠️ 5. Dermatology — severity band thresholds

**What the code does now.**
- **PASI**: clear / mild (<5) / moderate (5–10) / severe (>10) — the "rule of tens".
- **EASI**: signs graded 0–3 (not 0–4), giving the documented 0–72 ceiling. Region
  weights change for children **aged 7 and under**, derived from the patient's
  recorded date of birth, never from client input.
- **MASI / mMASI**: **no severity bands at all** — deliberately. There is no
  consensus cut-off in the literature, so the software refuses to invent one and
  reports change over time instead.
- **GAGS**: standard region factors, 0–4 lesion grade.

**The clinical question.** Confirm the PASI bands and the EASI child-age cutoff of
≤7 years. The MASI decision (no bands) is a deliberate refusal to fabricate — say
if you would rather have thresholds.

---

## ⛔ 6. EPI — IPV second dose at 9 months

**What the code does now.** The immunization schedule includes an **IPV-2 dose at
9 months**. The code carries a prominent comment marking it as awaiting sign-off.

**Why this needs you.** This was added to align with a schedule change but has not
been confirmed against the current Pakistan EPI schedule.

**The clinical question.** Is IPV-2 at M9 correct for Pakistan EPI as you practise
it today? If the timing or presence is wrong, the schedule will mark children
as due/overdue incorrectly.

---

## ⛔ 7. EPI — the 28-day minimum interval

**What the code does now.** A dose given **fewer than 28 days** after the previous
dose of the same vaccine is recorded as **`given_invalid`** — it does not count, and
the card loudly says it must be repeated. This gates the next dose in the series.

**Why this needs you.** 28 days is the general minimum interval, but it is applied
uniformly across vaccines here.

**The clinical question.** Is a flat 28-day rule correct for every vaccine in your
schedule, or do specific vaccines need their own minimum interval?

---

## ⚠️ 8. EPI — rotavirus age ceiling

**What the code does now.** Rotavirus doses are refused beyond **224 days** (32
weeks) of age; the schedule marks the dose `aged_out`.

**The clinical question.** Confirm 224 days matches the product in use — the ceiling
differs between rotavirus vaccine brands.

---

## ⛔ 9. Laboratory — no critical / panic values

**What the code does now.** Lab results are flagged **low / normal / high** against
each test's reference range. There is **no critical (panic) tier**.

**Why this needs you.** A potassium of 7.5 mmol/L — a life-threatening result
requiring immediate callback — is flagged exactly the same "high" as a mildly
raised 5.5. The catalog carries no critical thresholds, so the software cannot
distinguish them.

Adding panic thresholds means choosing clinical numbers, which the engineer
deliberately did **not** fabricate.

**The clinical question.** Supply critical low/high values for the tests that have
them (potassium, sodium, glucose, calcium, haemoglobin, platelets, INR…), and say
what the software should do when one fires — flag only, block the report, or
require an acknowledged callback.

---

## ⚠️ 10. Ophthalmology — IOP bands and the "urgent" block

**What the code does now.** Intraocular pressure bands: normal 10–21, raised 22–29,
markedly raised 30–39, **urgent ≥40** (flagged `blocking`), hypotony <10. Values
outside 1–80 mmHg are refused as implausible.

**The clinical question.** These are standard, but confirm the ≥40 "urgent"
threshold and what `blocking` should actually prevent in your workflow.

---

## ⚠️ 11. Records — MRN uniqueness is not enforced

**What the code does now.** `Patient.mrn` has **no uniqueness constraint**. Two
patients can share a medical record number. Auto-generated MRNs (from lead
conversion) are now collision-safe under concurrency, but client-supplied MRNs are
unconstrained, and the current database already contains duplicates from testing.

**Why this needs you.** The MRN is the human key to a chart. Enforcing uniqueness
is a data-cleanup exercise across existing records, not just a code change.

**The question.** Should MRN be unique per clinic? If yes, we need a rule for
resolving the existing duplicates before the constraint can be added.

---

## 💼 12. Payroll — leavers and part-months

**What the code does now.** A payroll run pays every employee whose status is
ACTIVE at the moment the run is computed. If someone is terminated *after* a draft
run is computed, the draft still contains their payslip — the software **warns
loudly** but does **not** block finalizing, because a leaver may genuinely be owed
their final month. There is **no partial-month proration** anywhere.

**The question.** Is a leaver paid for their final part-month, and if so, prorated
how? Right now the full month is paid unless someone discards the draft.

---

## 💼 13. Billing — who may refund, void, and discount

**What the code does now.** Any user with a finance/front-desk role can take a
payment, refund it, and void the invoice — **with no second approval**. A 100%
line discount is possible and is not separately logged as a write-off.

**Why this needs you.** This is segregation of duties, and it is a business policy
decision, not a technical one. The engineer deliberately did not invent an
approval rule.

**The question.** Which roles may refund? Which may void? Above what value does a
refund or discount need a second person? Should a 100% discount be recorded as a
write-off rather than a price?

---

## 💼 14. Billing — is a void reason mandatory?

**What the code does now.** Voiding an invoice records **who** did it and **when**,
and records a **reason if one is given**. A reason is not currently required.

**The question.** Should a reason be mandatory to cancel a bill?

---

## Appendix — what is NOT on this list, and why

These were reviewed and are **not** open questions:

- **Visual acuity → logMAR** conversion (6/6 = 0.00, 6/60 = 1.00, CF/HM/PL/NPL
  mapped monotonically) — standard, verified.
- **ROM deficit banding** (>25% red, 10–25% amber) and the **modality
  contraindication table** (electrotherapy vs pacemaker, heat over malignancy) —
  standard; the interlock demands a senior override with a recorded reason.
- **Growth (WHO-LMS)**, **weight-based dosing**, **dental DMFT** — implemented from
  published standards.
- **Cold chain**: expired stock and VVM stage-3 vials are refused at
  administration, not merely reported. Pharmacy likewise refuses to dispense
  expired stock.

---

*Maintained alongside the code. If a value in this register changes, the
corresponding safety suite in `app/backend/test/safety/` changes with it.*
