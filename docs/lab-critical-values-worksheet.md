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

| Code | Test | Unit | Current normal range | **Critical LOW** | **Critical HIGH** |
|---|---|---|---|---|---|
| `HB` | Haemoglobin | g/dL | 12 – 16 | | |
| `WBC` | White cell count | 10⁹/L | 4 – 11 | | |
| `PLT` | Platelet count | 10⁹/L | 150 – 400 | | |
| `GLU_F` | Fasting glucose | mg/dL | 70 – 100 | | |
| `HBA1C` | HbA1c | % | 4 – 5.7 | | |
| `CREAT` | Creatinine | mg/dL | 0.6 – 1.3 | | |
| `UREA` | Urea | mg/dL | 15 – 40 | | |
| `ALT` | ALT (SGPT) | U/L | 7 – 56 | | |
| `TCHOL` | Total cholesterol | mg/dL | up to 200 | | |
| `LDL` | LDL cholesterol | mg/dL | up to 100 | | |
| `TSH` | TSH | mIU/L | 0.4 – 4.0 | | |
| `CRP` | C-reactive protein | mg/L | 0 – 5 | | |

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

| Test | Do you run it? | Unit you report in | Normal range | **Critical LOW** | **Critical HIGH** |
|---|---|---|---|---|---|
| Potassium | ☐ yes ☐ no | | | | |
| Sodium | ☐ yes ☐ no | | | | |
| Calcium | ☐ yes ☐ no | | | | |
| INR / PT | ☐ yes ☐ no | | | | |
| Bilirubin (total) | ☐ yes ☐ no | | | | |
| Magnesium | ☐ yes ☐ no | | | | |
| Troponin | ☐ yes ☐ no | | | | |
| _______________ | ☐ yes | | | | |
| _______________ | ☐ yes | | | | |

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
