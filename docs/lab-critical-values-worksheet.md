# Worksheet — lab critical (panic) values

**For:** the lab lead or supervising physician.
**Belongs to:** sheet C1 of the [clinical sign-off register](clinical-sign-off-register.md).
**Time to complete:** about twenty minutes. Two tables and one question.

---

## Why you are being asked

Health OS flags every result **low / normal / high** against its reference range. There is
**no critical tier**. A haemoglobin of 3.1 g/dL and one of 11.5 are both simply "low".

The software cannot tell them apart because nobody has told it where the critical
boundaries are. Those numbers were deliberately **not invented by the engineer** — a
fabricated panic threshold is worse than none, because it looks authoritative.

Anything you leave blank stays as it is now: flagged only by reference range, with no
critical alert. Blank is a valid answer if a test has no meaningful panic value.

---

## Table 1 — tests the system can order today

Reference ranges below are **adult defaults already in the software**, shown so you can see
what the critical values sit outside of. Fill in only the two right-hand columns.

Where published limits were found and independently verified, they are shown as a
**starting point to confirm or overrule** — not as a recommendation. All are **foreign**
(US, Spain, Thailand, Australia); whether they transfer to Lahore is your judgement, and for
haemoglobin and platelets we would specifically expect them not to.

| Code | Test | Unit | Current normal range | Published critical LOW | Published critical HIGH | **Your LOW** | **Your HIGH** |
|---|---|---|---|---|---|---|---|
| `HB` | Haemoglobin | g/dL | 12 – 16 | median **6.0** (range 5.0–7.0) | median **20.0** (19.0–22.5) | | |
| `WBC` | White cell count | 10⁹/L | 4 – 11 | median **1.4** (0.5–2.0) | median **50** (25–150) | | |
| `PLT` | Platelet count | 10⁹/L | 150 – 400 | median **20** (10–50) | median **1000** (600–1000) | | |
| `GLU_F` | Fasting glucose | mg/dL | 70 – 100 | median **50** (39–60) | median **500** (399–1000) | | |
| `HBA1C` | HbA1c | % | 4 – 5.7 | *absent from every list* | *absent* | | |
| `CREAT` | Creatinine | mg/dL | 0.6 – 1.3 | *not confirmed — see note* | *not confirmed* | | |
| `UREA` | Urea | mg/dL | 15 – 40 | ⚠️ **units trap — see note** | ⚠️ | | |
| `ALT` | ALT (SGPT) | U/L | 7 – 56 | *absent from every list* | *absent* | | |
| `TCHOL` | Total cholesterol | mg/dL | up to 200 | *absent* | *absent* | | |
| `LDL` | LDL cholesterol | mg/dL | up to 100 | *absent* | *absent* | | |
| `TSH` | TSH | mIU/L | 0.4 – 4.0 | *some labs set one; no number obtained* | *ditto* | | |
| `CRP` | C-reactive protein | mg/L | 0 – 5 | *absent* | *absent* | | |

Primary source for the four with data: Shah et al., *Diagnostics* 2025;15(5):604 — a survey
of **50 US critical-value lists**, 2024 data.
[PMC11899349](https://pmc.ncbi.nlm.nih.gov/articles/PMC11899349/). Corroborated variously by
Siriraj (PLoS One 2025), Arbiol-Roca (Biochem Med 2019, Spain), Campbell & Horvath (36
Australasian labs, 2012) and URMC 2008 — **all of which disagree with each other**, which is
itself the point: there is no single right answer, only your clinic's answer.

> **⚠️ `UREA` — do not compare our range to a published one without converting.** Our test is
> **urea** (whole molecule, normal 15–40 mg/dL). Published lists overwhelmingly report urea
> **nitrogen** (BUN). **Urea ≈ BUN × 2.14.** Putting "ours 15–40" beside a BUN figure of 95
> invites a serious misreading, so we have deliberately left this row blank rather than
> populate it.

> **Note on the absences.** HbA1c, ALT, cholesterol, LDL and CRP appear in **none** of the
> published critical-value lists we checked. That is not an oversight on our part — these are
> not conventionally treated as panic-value analytes. If you want thresholds on them, they
> will be your clinic's own, which is fine, but worth knowing.

> **Note on creatinine.** A candidate figure was rejected on checking: the submission misread
> a percentage as a count and misattributed the paper's first author. We would rather show
> you nothing than a number we could not stand behind.

*(`URINE_CS`, urine culture, is a text result and has no numeric threshold.)*

---

## Table 2 — tests that are NOT in the catalogue

This is the part we got wrong, and you should know about it.

The sign-off register illustrated the problem with *"a potassium of 7.5 mmol/L"* — and
**potassium is not in the catalogue.** Neither are sodium, calcium, or INR. The clinic
cannot currently order them at all, so a critical value for them would have nothing to
attach to.

The catalogue is **starter data**, not a considered menu. Before critical values are worth
setting, tell us which of these the clinic actually runs. Add any others at the bottom.

| Test | Do you run it? | Unit you report in | Published critical limits (foreign) | **Your LOW** | **Your HIGH** |
|---|---|---|---|---|---|
| Potassium | ☐ yes ☐ no | | *numbers rejected on checking — see note* | | |
| Sodium | ☐ yes ☐ no | mmol/L | LOW **120–125**, HIGH **155–160** — convergent across four countries, 17 years | | |
| Calcium | ☐ yes ☐ no | | *rejected — see note* | | |
| INR / PT | ☐ yes ☐ no | | verified but wide; PTT alone spans 69–200 s | | |
| Bilirubin (total) | ☐ yes ☐ no | mg/dL | **neonatal only** — no adult critical value in any list | | |
| Magnesium | ☐ yes ☐ no | | ⚠️ sources use **three incompatible units** (mmol/L, mg/dL, mEq/L) | | |
| Troponin | ☐ yes ☐ no | | Australasian median 0.05 µg/L; **3 of 36 labs phone every result** rather than use a threshold | | |
| _______________ | ☐ yes | | | | |
| _______________ | ☐ yes | | | | |

> **Two rows deliberately left empty, and why.** For **potassium**, the candidate figures
> misstated the cited paper (it says <2.8/>6.0; the submission said <2.9/>5.9) — a
> correct-looking citation with wrong numbers is exactly the failure this document exists to
> avoid. For **calcium**, one cited paper could not be shown to exist at all, and the source
> that does exist has since published a **correction specifically about its calcium table**
> (*Diagnostics* 2026;16(13):2057, 1 July 2026: entries interchanged, ionised calcium units
> wrong). Both are yours to supply.

> **Sodium is the one we would actually lean on.** Four independent lists across four
> countries and seventeen years converge on roughly the same limits — that consistency is
> unusual in this data and worth something.

---

## The one behaviour question

When a result crosses a critical boundary, what should the software do? Tick one.

- [ ] **Flag only** — show it prominently on the report; no workflow change.
- [ ] **Block the report** — the result cannot be released until someone acknowledges it.
- [ ] **Require a recorded callback** — the report is held until a user records that the
      ordering clinician was contacted, with the time and who was spoken to.
- [ ] Something else: ______________________________________________

A note on the third option, since it is the one with teeth: it creates an auditable record
that the call happened. It also means an unacknowledged critical result **stops** the
report, so it needs someone rostered to see it. Do not choose it unless that person exists.

---

## Anything else we should know

Age- or sex-specific critical values, analyser differences, tests where your unit differs
from the table above:

<br><br><br>

---

Completed by: ____________________  Role: ____________________

Signed: ____________________  Date: __________

---

*When these come back, the values enter the lab catalogue and an automated test is written
for each one, so a number cannot later be changed by accident without the test failing.*
