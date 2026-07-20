# Clinical sign-off register

**Status: OPEN.** Health OS is not cleared for patient use until the ⛔ items below are
settled. Values verified against the code on 2026-07-21.

---

## What this is, in one paragraph

Every clinical number in this software came from one of three places: a published
standard, a value derived from a standard, or a value chosen by the engineer because the
code needed one. This document lists everything in the second and third categories.
Software should not be the author of a clinical threshold.

**Nothing here is a bug.** The engine does what is written and is covered by automated
safety tests. The question is whether what is written is what you would sign your name to.

**What we need from you:** for each item, either *confirm the current value* or *give the
correct one*. A one-line answer is enough. If a value changes, the corresponding automated
test changes with it, so a wrong number cannot quietly come back.

---

## Route these to the right person

Nothing needs one person to answer everything. Each block can be returned independently.

| Sheets | Who should answer | Blocks |
|---|---|---|
| **A1–A3** ⛔ | Prescribing dermatologist | Phototherapy — the whole module |
| **A4–A5** ⚠️ | Prescribing dermatologist | Nothing; scores are advisory |
| **B1–B3** ⛔⚠️ | Whoever owns vaccination practice | Pediatrics / EPI module |
| **C1** ⛔ | Lab lead or supervising physician | Lab results reporting |
| **C2** ⚠️ | Ophthalmologist | Nothing; banding is advisory |
| **D1–D3** 💼 | Practice owner — business policy, not clinical | Payroll and billing controls |

⛔ = settle before this module touches a patient  ⚠️ = safe to run, review when convenient
💼 = business policy

**Partial sign-off is useful.** Returning **B** alone clears pediatrics/EPI; returning **A1–A3**
alone clears phototherapy. The aesthetic, dental, ophthalmology, physiotherapy, billing and
records modules are not blocked by anything on this list.

---

# A. Dermatology — phototherapy and scoring

## ⛔ A1. When is a patient safe to escalate again after a burn?

**Situation.** A patient has a grade-3 (blistering) reaction at dose *D*.

**What the software does today.** Every one of that patient's active courses is held at
*D* — the next dose may only go down. A course is released from that hold only once **that
same course** delivers a session at or below *D*/2.

**Why we are asking.** Until 2026-07-18 tolerance shown on *any one* course released the
hold on *all* of them. A second, higher-dose course could spring back to its pre-burn
trajectory and deliver roughly **three times the dose that had just blistered the patient**.
The fix makes each course re-establish tolerance on its own. That is a defensible reading —
tolerance at one body site is not proof for another — but it is a clinical judgement, not a
technical one.

**Your decision** — tick one:

- [ ] Correct as-is: tolerance is re-established **per course / body site**
- [ ] Change to: tolerance is re-established **per patient** (any course releases all)
- [ ] Other: ______________________________________________

Signed: ____________________  Date: __________

---

## ⛔ A2. Is the dose ceiling of MED × 6 right for your protocol?

**What the software does today.** Where a patient's Minimal Erythema Dose (MED) has been
measured, the dose ceiling is **`MED × 6`** (`MED_CEILING_MULTIPLE = 6`), and it bounds the
ceiling, not merely the starting dose. With no MED recorded, the ceiling is the Fitzpatrick
skin-type table value.

**Why we are asking.** The multiple of 6 was **chosen by the engineer** as a conservative
bound. It is not taken from a named protocol. Without it, a patient with a low measured MED
could be walked up to the skin-type maximum — in one traced case, **25× their own measured
erythema threshold**.

**Your decision:**

- [ ] Confirm **× 6**
- [ ] Use **× ____** instead
- [ ] It should differ by modality (NB-UVB vs PUVA) or indication — details: ____________

Signed: ____________________  Date: __________

---

## ⛔ A3. Confirm the gap bands, the grade-1 half-step, and the dose floor

**What the software does today** — all values read from the running code:

| Time since last treatment | Action |
|---|---|
| under 7 days | normal escalation |
| 7–14 days | **hold** (no increase) |
| 15–21 days | **−25%** |
| 22–28 days | **−50%** |
| over 28 days | **restart** at the protocol starting dose |

| Reaction last session | Action |
|---|---|
| grade 0 (none) | escalate |
| grade 1 | **half** the normal increment |
| grade 2 | **hold** |
| grade 3 (blistering) | **skip treatment**, −50%, and arm the burn hold in A1 |

**Dose floor.** If repeated reductions drive the dose below **10% of the skin-type starting
dose**, the course is flagged **LAPSED**. The software does *not* quietly raise the dose back
up; it states that a prescriber must restart the course.

**Why we are asking.** These are defensible readings of standard practice, but the specific
numbers — the band edges, the half-step, and the 10% floor — are the engineer's.

**Your decision:**

- [ ] All correct as shown
- [ ] Corrections: ________________________________________________

Signed: ____________________  Date: __________

---

## ⚠️ A4. VASI region table is derived, not cited

**What the software does today.** The Vitiligo Area Scoring Index uses a region/hand-unit
table derived from the **rule of nines**. It is arithmetically self-consistent and the total
is computed from the table rather than hard-coded.

**Why we are asking.** It has **not** been checked against **Hamzavi et al. (2004)**, the
source paper for VASI. The regional weights are derived, not quoted.

- [ ] Acceptable as derived
- [ ] Replace with the published table (please attach or cite)

Signed: ____________________  Date: __________

---

## ⚠️ A5. Severity bands

**What the software does today.**

- **PASI** — clear / mild (<5) / moderate (5–10) / severe (>10), the "rule of tens".
- **EASI** — signs graded 0–3 (not 0–4), giving the documented 0–72 ceiling. Child region
  weights apply **aged 7 and under**, taken from the patient's recorded date of birth and
  never from anything the user types.
- **MASI / mMASI** — **no severity bands at all**, deliberately. There is no consensus
  cut-off in the literature, so the software refuses to invent one and reports change over
  time instead.
- **GAGS** — standard region factors, lesion grade 0–4.

- [ ] Confirm PASI bands and the EASI child cutoff of ≤ 7 years
- [ ] I would rather MASI **did** have bands — use: ____________________
- [ ] Corrections: ________________________________________________

Signed: ____________________  Date: __________

---

# B. Pediatrics / EPI

## ⛔ B1. Is IPV-2 at 9 months correct as you practise it?

**What the software does today.** The schedule includes a **second IPV dose at 9 months**,
with a minimum interval of 112 days after IPV-1 at 14 weeks. The code cites Pakistan's
**National Immunization Policy 2022** (epi.gov.pk), which specifies two IPV doses under one
year.

**Why we are asking.** The citation has not been confirmed against the schedule your clinic
actually follows. If the timing or the dose is wrong, children will be marked due or overdue
incorrectly — on the card the parent is shown.

- [ ] Correct: IPV-2 at 9 months
- [ ] Wrong — correct timing is: ____________________
- [ ] IPV-2 should not be in the schedule at all

Signed: ____________________  Date: __________

---

## ⛔ B2. Is a flat 28-day minimum interval right for every vaccine?

**What the software does today.** A dose given **fewer than 28 days** after the previous
dose of the same vaccine is recorded as **invalid** — it does not count toward the series,
the card says loudly that it must be repeated, and the next dose is gated on it. The 28 days
is WHO's general principle for primary-series intervals, applied uniformly.

**Why we are asking.** Uniform application is the simplification. Some vaccines may need
their own minimum.

- [ ] Confirm 28 days for all vaccines
- [ ] These vaccines need a different minimum: ____________________________

Signed: ____________________  Date: __________

---

## ⚠️ B3. Rotavirus age ceiling of 224 days

**What the software does today.** Rotavirus doses are refused beyond **224 days (32 weeks)**
of age; the schedule marks the dose *aged out*.

**Why we are asking.** The ceiling differs between rotavirus vaccine brands.

- [ ] Confirm 224 days for the product we use
- [ ] Our product's ceiling is: ____________  (brand: ____________)

Signed: ____________________  Date: __________

---

# C. Lab and ophthalmology

## ⛔ C1. Lab results have no critical (panic) tier — we need your numbers

**What the software does today.** Results are flagged **low / normal / high** against each
test's reference range. There is **no critical tier**.

**Why we are asking — this is the most consequential item on the list.** A potassium of
**7.5 mmol/L**, which needs an immediate phone call, is flagged exactly the same "high" as a
mildly raised 5.5. The software cannot tell them apart, because the catalog holds no
critical thresholds. Inventing them was refused deliberately.

**What we need:** critical low/high values, on the worksheet prepared for this —
**[lab-critical-values-worksheet.md](lab-critical-values-worksheet.md)**. It lists the 12
numeric tests the system can order today with their units and current reference ranges
pre-filled, so only the critical columns need answering.

**One correction, found while preparing that worksheet.** The potassium example above is
badly chosen: **potassium is not in the test catalogue.** Neither are sodium, calcium or
INR — the clinic cannot order them at all today, so critical values for them would have
nothing to attach to. The catalogue is starter data, not a considered menu. The worksheet
therefore asks which tests you actually run *before* asking for their thresholds.

**And what should happen when one fires?**

- [ ] Flag it visually only
- [ ] Block the report until acknowledged
- [ ] Require a recorded callback to the ordering clinician
- [ ] Other: ____________________

Attach the value list, or ask us for a table to fill in.

Signed: ____________________  Date: __________

---

## ⚠️ C2. Intraocular pressure bands

**What the software does today.** Normal 10–21, raised 22–29, markedly raised 30–39,
**urgent ≥ 40** (flagged as *blocking*), hypotony < 10. Values outside 1–80 mmHg are refused
as implausible entries.

- [ ] Confirm, including the ≥ 40 "urgent" threshold
- [ ] What *blocking* should actually prevent in our workflow: ____________________

Signed: ____________________  Date: __________

---

# D. Business policy (practice owner — not clinical)

## 💼 D1. Are leavers paid for a part-month?

**Today.** A payroll run pays everyone ACTIVE when the run is computed. If someone is
terminated *after* a draft is computed, the draft still contains their payslip — the
software warns loudly but does **not** block finalizing, because a leaver may genuinely be
owed their final month. **There is no part-month proration anywhere.**

- [ ] Full month is correct
- [ ] Prorate by: ____________________ (calendar days / working days / other)

Signed: ____________________  Date: __________

---

## 💼 D2. Who may refund, void, and discount?

**Today.** Any user with a finance or front-desk role can take a payment, refund it, and
void the invoice, **with no second approval**. A 100% line discount is possible and is not
separately recorded as a write-off.

- Roles that may **refund**: ____________________
- Roles that may **void**: ____________________
- Second approval required above: PKR ____________
- [ ] A 100% discount should be recorded as a **write-off**, not a price

Signed: ____________________  Date: __________

---

## 💼 D3. Must a void carry a reason?

**Today.** Voiding records **who** and **when**, and the reason **if one is given**. A reason
is not required.

- [ ] Reason should be **mandatory**
- [ ] Optional is fine

Signed: ____________________  Date: __________

---

# Appendix — reviewed and NOT open questions

These were examined and need no sign-off:

- **Visual acuity → logMAR** (6/6 = 0.00, 6/60 = 1.00; CF/HM/PL/NPL mapped monotonically) —
  standard, verified.
- **ROM deficit banding** (>25% red, 10–25% amber) and the **modality contraindication
  table** (electrotherapy vs pacemaker, heat over malignancy) — standard; the interlock
  demands a senior override with a recorded reason.
- **Growth (WHO-LMS)**, **weight-based dosing**, **dental DMFT** — implemented from published
  standards.
- **Cold chain** — expired stock and VVM stage-3 vials are refused at administration, not
  merely reported. Pharmacy likewise refuses to dispense expired stock.
- **MRN uniqueness** — *closed 2026-07-20.* Was item 11 on this register. One MRN can now
  hold only one chart: the constraint is enforced in the database, a duplicate is refused
  with a clear message, and concurrent registration of the same MRN yields one chart, not
  several.

---

*Maintained alongside the code. When a value here changes, the matching automated test in
`app/backend/test/safety/` changes with it — so a superseded number cannot quietly return.*
