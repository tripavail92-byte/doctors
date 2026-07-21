# Clinical sign-off register

**Status: OPEN.** Health OS is not cleared for patient use until the ⛔ items below are
settled. Values verified against the code on 2026-07-21.

> ### 📚 An evidence pass was done on 2026-07-21 — please read this first
>
> Sheets now carry a **📚 block** showing what the published sources actually say, so where
> possible you are **confirming a cited value rather than supplying one from memory**. Every
> citation was independently checked twice; anything that could not be confirmed says so.
>
> **This is evidence, not sign-off.** A citation is not a signature, and no value here is
> correct for this clinic until you say it is. Several sources are foreign (US, UK, Spain,
> Australia) and whether they transfer to Lahore is exactly the judgement we cannot make.
>
> **Four things changed materially, and you should look at these first:**
>
> | | |
> |---|---|
> | **B1b — NEW SHEET** | We think **Hepatitis B at birth is missing from the schedule entirely.** A row that does not exist can never be flagged as due, so a card reads *complete* for a child who never had it. |
> | **B3 — re-rated ⚠️ → ⛔** | Our rotavirus ceiling of 224 days is **RotaTeq's**; Pakistan appears to use **Rotarix** (168 days). Between those we currently permit an off-label dose. We need a brand name off a vial. |
> | **A3 — we differ from every source** | Our missed-treatment ladder is shifted one band later than the published ones, so at every gap length **we deliver more dose**, not less. |
> | **A4 — region table is not the published one** | The VASI formula is right; the region weights are ours, and the 7th "genitalia" region appears in no source. |
>
> Where we found nothing, the sheet says **NO SOURCE CONFIRMED** and stays blank. We would
> rather hand you an honest gap than a plausible-looking number — which is the whole reason
> this register exists.

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

Two further items sit outside the sheets because they are design decisions rather than
values to confirm:

- **[Imaging report amendments](imaging-report-amendments.md)** — a finalized report cannot
  currently be corrected at all. A design grounded in FHIR/IHE/DICOM/RCR is proposed there,
  with three questions the standards leave to you. The Punjab Healthcare Commission MSDS
  (indicators 59, 60, 61, 73) applies in Lahore and requires a written amendment SOP, so
  this needs a clinic process as well as code.
- **Pediatrics pack** — `pack.pediatrics` is sold in every SPECIALTY edition but no pack
  exists. Before any engineering: **ASQ-3 prohibits electronic reproduction**, and
  **M-CHAT-R/F requires a licence agreement for a multi-tenant product** — someone must
  email the authors before an engineer types the items into a manifest.

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

### 📚 What the published sources say — GAP BANDS: **WE DIFFER**

This is the clearest divergence found, and it runs one way: **at every gap length our
software delivers MORE dose than the published ladders.**

| Gap | Vitiligo Working Group | Our software |
|---|---|---|
| 4–7 days | hold dose constant | still escalating normally |
| 8–14 days | **−25%** | hold |
| 15–21 days | **−50%** | −25% |
| 22–28 days | **restart at initial dose** | −50% |
| over 28 days | (already restarted) | restart |

Source: Vitiligo Working Group recommendations, Mohammad et al., *J Am Acad Dermatol* 2017,
Table II — [PDF](https://www.lightherapy.com/Content/upload/pdf/202219600/r202208280906221380993.pdf)
(doi:10.1016/j.jaad.2016.12.041). Corroborated in direction by AAD/NPF 2022 Table IV and by
NHS Scotland Photonet v6, both of which also reset at about **3 weeks** where we reset at 4.

**Three caveats that are yours to weigh, not ours:**
- VWG is **vitiligo-specific** and self-rated **level of evidence IV** (expert opinion).
- The AAD missed-dose table is printed under **broadband** UVB; applying it to NB-UVB is an
  extrapolation.
- Photonet counts **missed sessions**, we count **elapsed days**. At 3×/week these roughly
  coincide; for a twice-weekly patient they do not.

- [ ] Adopt the VWG ladder (start adjusting at 4 days, restart at 3 weeks)
- [ ] Keep ours deliberately — reason: ____________________________
- [ ] Other: ____________________________

### 📚 REACTION GRADES: partially supported, and our scale has one grade too few

The −50% for a severe reaction is supported. But published practice grades erythema
**E0–E4**, not 0–3, and puts **bullae at grade 4** — where the guidance is to withhold
treatment pending review, not to compute a reduced dose automatically.

Sources: British Association of Dermatologists / British Photodermatology Group 2022 §9.1
(E0–E4, E4 = "painful erythema with bullae"); NHS Scotland Photonet v6 Protocol 1.

**Two structural questions, not number changes:**
- Should we move to a 5-point E0–E4 scale?
- Should blistering produce a dose automatically at all, or stop and demand a prescriber?

**And one that affects this whole clinic:** the sources note erythema assessment is
**unreliable in Fitzpatrick IV–V skin** — most of your patients. The entire ladder rests on
that observation.

- [ ] Keep 0–3 with automatic −50%
- [ ] Move to E0–E4; bullae stops treatment and requires prescriber review
- [ ] Other: ____________________________

### 📚 DOSE FLOOR (10%): **NO SOURCE CONFIRMED**

We searched and found nothing usable. A candidate was rejected because it came from a drug
sponsor's trial protocol, which ranks below the guideline bodies and whose single number
does not transfer to a skin-type-stratified engine. **This remains the engineer's value and
needs yours.**

- [ ] 10% of the starting dose is acceptable
- [ ] Use instead: ____________  mJ/cm² or ____ % of start

Signed: ____________________  Date: __________

---

## ⚠️ A4. VASI region table is derived, not cited

**What the software does today.** The Vitiligo Area Scoring Index uses a region/hand-unit
table derived from the **rule of nines**. It is arithmetically self-consistent and the total
is computed from the table rather than hard-coded.

**Why we are asking.** It has **not** been checked against **Hamzavi et al. (2004)**, the
source paper for VASI. The regional weights are derived, not quoted.

### 📚 The formula is right; the region table is **not** the published one

The VASI formula itself (hand units x depigmentation percentage, summed) is confirmed. What
differs is the region breakdown: our table is rule-of-nines-derived, and published VASI uses
its own regional scheme. Two specific problems found:

- **Our 7th region, "genitalia", appears in no published VASI source.**
- **Our per-region caps exist in no published VASI source** and will reject legitimate
  entries in obese, very tall, paediatric or amputee patients.

- [ ] Acceptable as derived — we accept the software's regions are not the published ones
- [ ] Replace with the published table (please attach or cite)
- [ ] Remove the genitalia region
- [ ] Remove the per-region caps

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

### 📚 Sheet-by-sheet

**EASI — fully confirmed.** Signs 0-3, the 0-72 ceiling, both multiplier sets and the
under-8-years child cutoff all match the HOME core-outcome CRF. Our "aged 7 and under" is the
same rule as "under 8". Two optional refinements only: reject 0.5 inputs, and relabel the
area-1 band as "1-9%".

**GAGS — confirmed twice over.** Region factors, 0-4 grades and the maximum of 44 all check
out. **One boundary needs your ruling:** is "very severe" >= 39, or should the top tiers
collapse to three? And one SOP point: does "chest and back" mean upper back only?

**PASI — the severe threshold is sourced; the mild/moderate boundary is not.** ">10 = severe"
is Finlay's rule of tens. **The boundary at 5 appears in no source we could confirm** — four
published schemes disagree with each other, and one guideline body abandoned the model
entirely. You may absolutely adopt 5 as a clinic convention, but it should be **labelled as
convention rather than citation**.

**MASI — our stated reason is wrong.** The software reports no bands on the basis that no
consensus cut-off exists. Published cut-offs *do* exist (Zhang et al., *Clin Cosmet Investig
Dermatol* 2025). The decision to show no bands may still be right; the justification needs
replacing.

- [ ] Confirm EASI as implemented (incl. the under-8 child weighting)
- [ ] GAGS "very severe" boundary: >= ______  |  [ ] collapse to three tiers
- [ ] PASI: adopt 5 as a **clinic convention** (not a citation)  |  [ ] use ______ instead
- [ ] MASI: keep no bands  |  [ ] adopt bands: ____________________
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

### 📚 **AGREES** — confirmed against the Pakistani primary source

The Federal Directorate of Immunization schedule poster lists six visits. The 4th visit
(14 weeks) carries OPV-3, **IPV-1**, PCV-3 and Penta-3; the 5th visit (9 months) carries
**IPV-2**, MR-1 and TCV. That is exactly what the software does.

Source: [FDI vaccination schedule](https://www.epi.gov.pk/wp-content/uploads/2023/10/Vaccination_Schedule_2023.jpeg)
(poster, October 2023).

Two things to note. The schedule is published only as an **Urdu image**, not a data table —
please eyeball the poster yourself rather than take our reading of it. And the code cites
"National Immunization Policy 2022", **a document we could not locate**; the citation should
point at this poster instead, which is what actually corroborates the row.

Signed: ____________________  Date: __________

---

## ⛔ B1b. **We think a vaccine is missing entirely — Hepatitis B at birth**

*This sheet was not in the original register. It came out of checking B1 against the
national schedule.*

**What the software does today.** The birth visit contains **BCG and OPV-0 only**. Hepatitis
B appears solely inside Pentavalent at 6/10/14 weeks. **There is no standalone HepB
birth-dose row.**

**Why this matters more than a wrong number.** A row that does not exist can never be
flagged as due. The immunisation card therefore reads **complete** for a child who has not
had a birth dose — the software is not wrong on screen, it is silent.

**What the sources say.** The FDI poster's 1st visit (at birth) lists **three** vaccines:
BCG, OPV-0 and ہیپاٹائٹس-بی (Hepatitis B). The Punjab Primary & Secondary Healthcare
Department states Punjab has introduced the Hepatitis B birth dose into routine
immunisation. WHO gives the timing as "as soon as possible after birth (<24h)".

Sources: FDI poster (above);
[Punjab P&SHD Immunization](https://pshealthpunjab.gov.pk/Home/VerticalProgramImmunization).

- [ ] Yes — we give a HepB birth dose; add it to the schedule
- [ ] No — we do not, because: ____________________________

If yes, we need a window, because **no Pakistani source states a cut-off** and we will not
invent one: dose valid from birth to ____________ (WHO says <24h).

Signed: ____________________  Date: __________

---

## ⛔ B2. Is a flat 28-day minimum interval right for every vaccine?

**What the software does today.** A dose given **fewer than 28 days** after the previous
dose of the same vaccine is recorded as **invalid** — it does not count toward the series,
the card says loudly that it must be repeated, and the next dose is gated on it. The 28 days
is WHO's general principle for primary-series intervals, applied uniformly.

**Why we are asking.** Uniform application is the simplification. Some vaccines may need
their own minimum.

### 📚 **NO SOURCE CONFIRMED** — and the reason is worth reading

We tried twice and rejected both answers.

WHO does publish per-antigen minimum intervals, but the table carries this on every page:
**"The ages/intervals cited are for the development of country specific schedules and are
not for health workers… Health care workers should refer to their national immunization
schedules."** Our software uses such numbers to mark a real child's dose invalid and demand
it be repeated — precisely the use that document disclaims. We will not cite it at you.

US practice (ACIP) allows a 4-day grace period, which would make us look stricter than
guidance. But **Pakistan's own National EPI Policy and Strategic Guidelines 2014** states
the opposite — *"Any dose given before the recommended age or interval shall be considered
INVALID and should be repeated as recommended"* — which is exactly what we do. Showing you
the American rule would have implied a deviation that, measured against the governing
Pakistani document, does not exist.

**The honest position:** our behaviour matches the 2014 Pakistani clause. We could not
establish that the 2014 clause is still formally in force — the National Immunization Policy
2022 (read in full) is a governance document that neither restates it nor says it supersedes
it. So this is your call, and it is a policy question rather than a numerical one.

- [ ] Confirm 28 days for all vaccines
- [ ] These vaccines need a different minimum: ____________________________
- [ ] Allow a grace period of ____ days rather than invalidating

Signed: ____________________  Date: __________

---

## ⛔ B3. Rotavirus age ceiling of 224 days — **we think our number is the wrong product's**

*Re-rated from ⚠️ to ⛔ after checking. See below.*

**What the software does today.** Rotavirus doses are refused beyond **224 days (32 weeks)**
of age; the schedule marks the dose *aged out*.

### 📚 224 days is **RotaTeq's** ceiling — and Pakistan appears to use **Rotarix**

| Product | Doses | Label ceiling |
|---|---|---|
| **Rotarix** (RV1) | 2 | "completed by **24 weeks** of age" = **168 days** |
| **RotaTeq** (RV5) | 3 | "should not be given after **32 weeks**" = **224 days** ← our number |
| WHO position | — | would vaccinate up to **24 months**, stating this is knowingly off-label for all products |

The FDI schedule shows **two** rotavirus doses, at 6 and 10 weeks — the Rotarix pattern —
and a Pakistani cohort study states *"Rotarix™ is currently being introduced in Pakistan's
Expanded Program on Immunization."*

**So between 169 and 224 days our software today accepts and schedules a Rotarix dose that
the product's own label says should not be given.** That is why we re-rated this sheet.

Sources: [WHO rotavirus position paper, 23 July 2021](https://cdn.who.int/media/docs/default-source/immunization/position_paper_documents/rotavirus/rotavirus-summary-23july-2021.pdf);
Rotarix and RotaTeq US prescribing information via DailyMed; FDI poster (above);
Naveed et al., [PMC5989807](https://pmc.ncbi.nlm.nih.gov/articles/PMC5989807/).

**The first thing we need is not a clinical judgement — it is a brand name off a vial in
your fridge.**

- Brand actually stocked: ____________________
- [ ] **168** days (Rotarix label)
- [ ] **224** days (keep — only correct if the product is RotaTeq)
- [ ] **730** days (WHO, knowingly off-label)

Also: we apply one flat ceiling to **both** doses. Under the Rotarix label dose 1 must
effectively happen by ~20 weeks to leave 4 weeks before the cut-off.

- [ ] One ceiling for both doses is fine
- [ ] Dose 1 ceiling: ________  Dose 2 ceiling: ________

*If the brand is Rotavac or ROTASIIL — both 3-dose products — the whole row is wrong and we
will rebuild it.*

**No Pakistani source states a rotavirus age ceiling at all.** IMNCI 2019 and EPHS 2020 both
confirm the two-dose 6-and-10-week schedule but neither gives an upper limit or a brand.

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
