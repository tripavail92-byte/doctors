# Release 1 — First Live Demo and Acceptance Tests

_Release 1 replan — scoped to one aesthetic clinic, architecture kept universal._

# DELIVERABLE 9 — THE FIRST LIVE DEMO
### Health OS · Release 1 acceptance demo · one aesthetic clinic, Lahore

---

## 0. HOW TO READ THIS

This is the demo we perform for the clinic owner the day Release 1 is called done. Every scene below is backed by a specific item in the Release 1 slice plan; nothing here is a mockup, a static HTML screen from `frontend/screens/`, or a Prisma model with no UI. Where something in the demo is stubbed or fixture-driven rather than live, it says so in the scene, not in a footnote.

**Demo hygiene (non-negotiable, learned the hard way):** the demo database is reset immediately before the demo. The adversarial safety suites leave ~66 probe patients per run behind, and a demo that opens on a patient list containing `probe-tenant-b-4f2a` is over before it starts. Reset → reseed the aesthetic starter catalogue and consumables → walk scene 1 once as a smoke test → then bring the owner in.

**The cast** (all created live in Scene 1, not seeded):

| Person | Role | What they do in the demo |
|---|---|---|
| Dr. Hina Qureshi | OWNER | Owns Glow Aesthetics, DHA Phase 5, Lahore. Sets up staff, reads the money at close of day. |
| Mehwish Iqbal | RECEPTION | Front desk. Books, checks in, takes cash. |
| Usman Sheikh | SALES | Works Facebook/WhatsApp leads. |
| Dr. Bilal Ahmad | DOCTOR | Aesthetic physician. 30% of net collection on what he performs. |
| Ayesha Nawaz | TREATMENT | Laser/facial therapist. Salaried, PKR 60,000. |

**The patient:** Zainab Malik, 29, 0300-4417XXX, WhatsApp same number. Came from a Facebook ad for a winter laser package.

**The money the demo moves:** one invoice of PKR 99,000, one cash advance of PKR 40,000, one refund of PKR 10,000, one doctor's share of PKR 3,273, one payroll run.

Total running time, rehearsed: **40–45 minutes**, plus 10 minutes of the owner driving it himself (Scene 16 — the part that actually sells it).

---

## A. THE DEMO SCRIPT

### Scene 1 — The owner sets up his own clinic (4 min)
**Who:** Dr. Hina Qureshi (OWNER). **Screen:** `/admin/settings`, then `/admin/staff`.

She logs in. The landing dashboard shows today's tiles at **zero** — no patients, no collections, no appointments — because it is a brand new clinic. She goes to **Clinic settings** and types the real thing: *Glow Aesthetics Clinic*, DHA Phase 5 Lahore, phone, WhatsApp number, currency PKR, invoice prefix `GAC`, opening hours 12:00–20:00 Mon–Sat, closed Sunday. She adds three rooms: *Consult 1*, *Laser Room*, *Injectables Room*. She ticks the payment methods this clinic actually takes — Cash, Card, Bank transfer — and marks Bank transfer as "requires reference".

Then **Staff → Add staff**, four times: Mehwish (Reception), Usman (Sales), Dr. Bilal (Doctor), Ayesha (Treatment). She sets each an initial password; each is flagged *must change password at first login*.

**What the audience should notice:** the owner did this, not us. There is no configuration file, no phone call to the vendor, no SQL. Four staff accounts existed nowhere five minutes ago.

---

### Scene 2 — Every person sees a different, correct application (3 min)
**Who:** all five, in four browser windows. **Screen:** the sidebar.

Mehwish logs in: Patients, Appointments, Queue, Billing. Usman: Leads, Follow-ups, Patients. Dr. Bilal: Queue, Patients, Consultations, Sessions, My Earnings. Ayesha: Queue, Sessions, Inventory. Dr. Hina: all of it, plus Reports, Payroll, Staff, Settings.

Dr. Hina then does the demo's one deliberate attack. Using her own OWNER account she attempts, live, to grant herself a `PLATFORM_ADMIN` membership through the API — the exact four-call sequence that works on today's code. The request is **rejected at the DTO, again at the service, and the token mint refuses to sign it**. She then tries a hand-forged token with `role: PLATFORM_ADMIN` and gets a 403 with a logged security event.

**What the audience should notice:** nobody sees a menu item that then refuses them. And the clinic owner — the most trusted user in the building — cannot climb out of her own clinic into anybody else's.

---

### Scene 3 — A lead arrives while nobody is looking (2 min)
**Who:** Usman (SALES). **Screen:** `/leads`.

Usman's pipeline board is open on Kanban. Nobody touches the keyboard. A new card appears in **New**: *Zainab Malik · Facebook · "Laser Hair Removal — Winter Package"*. It came in through the public webhook endpoint.

*Honest caveat, stated aloud in the room:* if the clinic's Meta app is connected by demo day, this is a genuinely live ad lead. If it is not, we replay a recorded Meta payload through the same public endpoint — the code path, signature check, deduplication and lead creation are identical; only the sender is a fixture. We say which one it is before we click.

Usman also types a second lead by hand: *Fatima Sheikh · WhatsApp enquiry · Botox*.

**What the audience should notice:** the raw webhook payload is stored before it is parsed, and Meta's retry of the same lead over the next 36 hours creates **one** card, not four.

---

### Scene 4 — Working the lead like a salesperson (3 min)
**Who:** Usman. **Screen:** lead detail drawer.

He opens Zainab's card. He logs a call: *outbound · WhatsApp · "asked about full-face laser price, sent package details"*. He schedules a follow-up for tomorrow 14:00. He clicks **Send WhatsApp**, picks the price-list template, sends it. A message row appears in the drawer's timeline with a delivery id.

*Honest caveat:* WhatsApp runs against the clinic's own Business number if credentials are loaded on demo day; otherwise it runs in stub mode and shows a synthetic message id. Either way the outbound message is **logged**, which is the part that cannot be reconstructed later.

**What the audience should notice:** the follow-up now exists as an obligation, not a memory. Usman's Follow-ups worklist shows *Overdue 0 · Today 1 · Upcoming 3*.

---

### Scene 5 — Lead becomes a patient and an appointment in one action (4 min)
**Who:** Usman, then Mehwish. **Screen:** convert dialog → `/appointments`.

Next "morning" (we change the date filter). Usman opens **Follow-ups → Today**, sees Zainab, clicks **Convert**. The dialog confirms her demographics, then shows Dr. Bilal's calendar for Thursday. He picks 16:00, service *Consultation*, and saves.

One transaction produces: a Patient with MRN **P-00007**, an Appointment at Thursday 16:00 with source `LEAD`, and the lead moves to *Appointment booked* — carrying **source = Facebook** and **salesperson = Usman** onto the patient record.

Mehwish then tries to book another patient with Dr. Bilal at 16:15. The system refuses with a conflict warning: Dr. Bilal is not free. She books 17:00 instead.

**What the audience should notice:** the double-booking is refused by the **database**, not by a JavaScript check — two receptionists clicking simultaneously cannot both win. And the answer to "where did this patient come from and who brought her" is now stored on the patient, at the one moment it is still knowable.

---

### Scene 6 — Thursday, 15:52. Check-in and the queue (2 min)
**Who:** Mehwish. **Screen:** `/queue`.

Zainab arrives. Mehwish finds her on the day sheet and clicks **Check in**. She jumps to the **Waiting** column with token **A-04** and a wait timer that starts counting. A walk-in patient arrives at the same moment; Mehwish uses **Walk-in**, types a name and phone, and he lands in the same queue with source `WALK_IN`.

Dr. Bilal's screen — a different browser, untouched — now shows Zainab in his waiting list.

**What the audience should notice:** the wait timer. It is real elapsed time from a stored check-in timestamp, which is also what the queue is ordered by.

---

### Scene 7 — The consultation (5 min)
**Who:** Dr. Bilal (DOCTOR). **Screen:** `/consultation/:encounterId`.

He clicks **Call next**. Zainab's chart opens. Across the top: name, MRN, age, and — because she declared it at registration — a red **ALLERGY: Sulfa drugs (rash)** banner.

The consultation form has three parts on one page:
- The **shared core consultation** every clinic gets: chief complaint, history, examination, assessment, diagnosis, plan, follow-up date.
- The **dermatology/aesthetic template**: Fitzpatrick skin type, prior treatments, isotretinoin in last 6 months, pregnancy/breastfeeding flag, consent taken.
- The **clinic's own custom fields**, which Dr. Hina added in Settings this morning: *"How did you hear about us"* and *"Preferred contact time"*.

He types: chief complaint *unwanted facial hair + dull skin*; diagnosis *Hirsutism, mild — PCOS suspected*; follow-up in 4 weeks. He leaves *consent taken* blank and hits Save — the form refuses and points at the field. He ticks it and saves.

Then **Sign & lock**. The note stamps *Signed by Dr. Bilal Ahmad, Thursday 16:11*. He immediately tries to edit a line of it. The system refuses and offers **Amend** instead, which demands a reason and creates a **new** version alongside the original.

**What the audience should notice:** the templates were not built for this demo — they ship with the aesthetic and dermatology packs and are seeded for every clinic on day one. And the note cannot be quietly rewritten after the fact, which is the entire medico-legal value of the record.

---

### Scene 8 — The treatment plan (4 min)
**Who:** Dr. Bilal. **Screen:** `/treatment-plans/:patientId`.

He builds the plan from the clinic's own price list — no typing prices:

| Line | From catalogue | Sessions | List | Plan price |
|---|---|---|---|---|
| Laser hair removal — full face | LHR session @ 9,000 | 6 | 54,000 | **48,000** |
| HydraFacial | @ 15,000 | 1 | 15,000 | 15,000 |
| Botox — forehead + crow's feet | per area @ 18,000 | 2 areas | 36,000 | 36,000 |

He applies a **PKR 6,000 package discount** and must give a reason: *Winter package promo*. Running total: subtotal 105,000 − discount 6,000 = **PKR 99,000**. He prints the quote for Zainab to take home (browser print — no PDF service, deliberately).

**What the audience should notice:** the discount is a recorded, attributed, reason-carrying event — not a lower number typed into a price box. The owner can later ask "how much did we give away last month, and who approved it."

---

### Scene 9 — Plan becomes a bill (3 min)
**Who:** Mehwish. **Screen:** `/billing`.

Zainab says yes at the desk. Mehwish opens the plan and clicks **Convert to invoice**. Invoice **GAC-00042** appears: three lines, subtotal PKR 105,000, discount PKR 6,000, tax PKR 0, **total PKR 99,000**. Each line carries the service it came from and **who will perform it** — laser and facial to Ayesha, Botox to Dr. Bilal.

Mehwish then clicks **Convert to invoice** on the same plan a second time. Refused: this plan is already invoiced.

*Honest note said aloud:* tax shows 0% because this clinic's catalogue is configured at 0%. The subtotal/discount/tax structure exists in the invoice from day one so it never has to be retrofitted; FBR e-filing is deliberately not in Release 1.

**What the audience should notice:** the second click. This exact code path once triple-billed a plan for PKR 240,000, and the guard against it is now demonstrable in front of the customer.

---

### Scene 10 — Cash, and a receipt book (3 min)
**Who:** Mehwish. **Screen:** invoice detail.

Zainab pays **PKR 40,000 cash** as an advance on the package. Mehwish records it: method *Cash*, reference *RCPT-1187* from the paper receipt book. The invoice moves to **PARTIAL**: paid 40,000, **outstanding PKR 59,000**.

She then, deliberately, records the same PKR 40,000 with the same reference again — the classic double-entry at a busy desk. The system returns the **original** payment instead of creating a second one. She tries once more with a different amount under the same reference and is refused outright.

She tries to overpay — PKR 70,000 against a 59,000 balance. In Release 1 that is accepted as **PKR 59,000 settled + PKR 11,000 credit on the patient's account**, visible on the patient's ledger. (She undoes this before continuing.)

**What the audience should notice:** the patient ledger line that just appeared. Every rupee in and out of this patient's account, in order, with a running balance and a printable statement.

---

### Scene 11 — The treatment actually happens (5 min)
**Who:** Ayesha (TREATMENT), then Dr. Bilal. **Screen:** `/sessions`.

The session board is grouped by room. Zainab's package produced session cards automatically: **Laser 1 of 6**, **HydraFacial 1 of 1**, **Botox**.

Ayesha starts **Laser 1 of 6** in Laser Room. She captures a **before photo** on the tablet — the system checks the photography consent recorded at registration and refuses if it is absent. She completes the session and takes an **after photo**; the pair renders side by side on Zainab's chart.

The consumables panel is **pre-filled from the service's bill of materials**: cooling gel 15 ml. She confirms.

Dr. Bilal then runs the **Botox** session in Injectables Room. His consumables panel pre-fills: Botulinum toxin 40 U, numbing sachet ×1, 30G needle ×2. He actually used **three** needles, so he changes 2 → 3. He completes the session.

The moment he clicks Complete:
- Botox stock: **300 U → 260 U**, taken from batch **BTX-2609A (exp 03/2027)** — the *nearest expiry first*, not the newest.
- Consumable cost on the session: **PKR 13,370** (40 U × 320 + 450 + 3 × 60).
- Zainab's plan now reads **Laser 1 of 6 · HydraFacial done · Botox done**.

Ayesha then tries to issue 400 U of Botox against a session. Refused — insufficient stock, and nothing is deducted.

**What the audience should notice:** the stock number on the inventory screen, in a different browser window, changing from 300 to 260 without a refresh-and-hope. And the numbing cream turning amber: **6 left, reorder level 20**.

---

### Scene 12 — The doctor's share (3 min)
**Who:** Dr. Bilal. **Screen:** `/me/earnings`.

His own earnings page, for today. The PKR 40,000 collection was allocated across the invoice's three lines in proportion to their value:

| Line | Share of the 40,000 | Rule | Doctor | Clinic |
|---|---|---|---|---|
| Laser (Ayesha, salaried) | 19,393 | — | 0 | 19,393 |
| HydraFacial (Ayesha, salaried) | 6,060 | — | 0 | 6,060 |
| Botox (Dr. Bilal) | 14,545 | 30% net collection | **4,363** | 10,182 |
| Rounding residual | 2 | — | 0 | 2 |
| **Total** | **40,000** | | **4,363** | **35,637** |

He tries to open another doctor's earnings by changing the id in the URL. 403 — enforced in the service, not hidden in the UI.

**What the audience should notice:** the commission accrued **when the money arrived**, not when the invoice was raised. Zainab still owes PKR 59,000; the doctor has not been credited a rupee of it.

---

### Scene 13 — The awkward question (3 min)
**Who:** Dr. Hina (OWNER). **Screen:** `/billing`.

The owner asks the question every owner asks: *"and if she cancels and I refund her?"*

Mehwish refunds **PKR 10,000 cash**, with a reason. Immediately:
- The patient's outstanding and ledger update.
- Dr. Bilal's earnings page drops from **PKR 4,363 to PKR 3,273** — a negative ledger row of −1,090 appears, dated today, pointing at the refund.
- Today's cash line on the dashboard falls by 10,000; the **cash** method line specifically, not a generic total.

Mehwish then tries to **void** the invoice. Refused — money has been taken against it. She voids a different, unpaid test invoice instead, and the system demands a reason and records who did it.

**What the audience should notice:** the clawback. The most common way a clinic system quietly loses money is paying commission on revenue that later went back out of the door.

---

### Scene 14 — Attendance and payroll (4 min)
**Who:** Dr. Hina. **Screen:** `/attendance`, then `/payroll`.

The attendance sheet for the month shows a per-employee grid: first in, last out, minutes worked, status. Ayesha's Thursday reads **first in 11:47**.

*Honest caveat:* if the camera is installed and configured by demo day, those are camera punches. If it is not, we demonstrate the **manual punch** and the signed ingest endpoint with a simulated device payload. The manual path is not a fallback we invented for the demo — it is in scope precisely because the camera will be down sometimes.

Ayesha was absent one day. Dr. Hina runs payroll for the period: a **draft** appears first, with a projection, before anything is committed.

| Ayesha Nawaz | | Dr. Bilal Ahmad | |
|---|---|---|---|
| Basic salary | 60,000 | Retainer | 50,000 |
| Absence (1 day) | −2,000 | Commission (July) | +3,273 |
| **Net** | **58,000** | **Net** | **53,273** |

She finalizes. The commission earnings are stamped with the payslip id — the same rupee **cannot** be swept into a second payroll run. She prints Ayesha's payslip.

**What the audience should notice:** the payslip explains itself line by line. "Why is my salary short 2,000" has an answer on the paper, traceable to a specific date on the attendance sheet.

---

### Scene 15 — Close of day (4 min)
**Who:** Dr. Hina. **Screen:** dashboard, then `/reports`.

Her dashboard, **for today**, not for all time:

- Collections today: **PKR 30,000** (40,000 in, 10,000 refunded) — broken down Cash / Card / Bank.
- Outstanding across all patients: **PKR 59,000**.
- Appointments today: 4. Patients seen: 3. Sessions completed: 3.
- Doctor share accrued today: **PKR 3,273**. Clinic share: **PKR 26,727**.
- Low stock: numbing cream 6 (reorder 20).

Then Reports, with a date range:
- **Revenue by service** — Botox 36,000, Laser package 48,000, HydraFacial 15,000.
- **Revenue by doctor** — Dr. Bilal 36,000; Ayesha 63,000.
- **Margin after consumables** — Botox: revenue 36,000, consumables 13,370, **margin 22,630 (63%)**.

She changes the range to *yesterday*. Every number goes to zero, correctly, because the clinic did nothing yesterday.

Finally she counts the physical cash box against the **Cash** line and it matches to the rupee — because the refund was booked as a *cash* refund, with its method, not as an undifferentiated number.

**What the audience should notice:** the date range. Every figure answers "in this period", and the dashboard and the reports agree with each other about the same money — including about voided and refunded invoices.

---

### Scene 16 — The owner drives (10 min, unscripted)
We hand over the keyboard. He registers a patient of his own choosing, books it, bills it, pays it. We do not touch anything. This is the scene that decides the sale, and it is the reason every scene above must be a real screen against a real API.

---

### Scene 17 — Five minutes of SQL, on the projector (3 min)
For the technically-minded partner only. Three queries, live:

1. `SELECT count(*) FROM "Invoice" WHERE "branchId" IS NULL;` → **0**. Same for Patient, Appointment, Encounter, Payment, TreatmentSession, StockMovement. Every operational row written today knows which organisation, clinic and branch it happened at — even though this clinic has exactly one branch and no branch feature was built.
2. `SUM(payments) − SUM(refunds)` vs `SUM(invoice.paid)` per tenant → **equal**.
3. `SUM(stock movements)` per batch vs `quantityOnHand` → **equal**, and the commission ledger for the day sums exactly to the cash collected, residual included.

**What the audience should notice:** the branch columns. They cost us about two weeks now and they are the one thing in this entire release that cannot be added later without inventing history.

---

## B. THE PROOF POINTS — one per scene

The single artefact in each scene that a mockup cannot fake. If any of these does not happen live, that scene is not done.

| # | Scene | The one proof it is real software |
|---|---|---|
| 1 | Clinic setup | Four staff accounts that did not exist, log in on four other machines seconds later |
| 2 | Roles | The privilege-escalation attempt returns **403** and writes a security log line, performed live by the highest-privileged user in the room |
| 3 | Lead arrives | A card appears with **nobody touching a keyboard**, and Meta's duplicate retry produces no second card |
| 4 | Follow-up | The outbound WhatsApp message appears as a **stored row with a provider message id**, not a toast |
| 5 | Convert | One click produces **MRN P-00007 + a booked slot**, and the 16:15 double-booking is refused by a database constraint |
| 6 | Check-in | The **wait timer counts up** from a stored timestamp, and the doctor's untouched screen shows the patient |
| 7 | Consultation | Post-signature edit is **refused**; the amendment creates a second row and leaves the first byte-identical |
| 8 | Treatment plan | The **PKR 6,000 discount demands a reason** and stores who approved it |
| 9 | Plan → invoice | The **second conversion attempt is refused** — one invoice per plan |
| 10 | Payment | The duplicate receipt reference returns the **original payment**, and a ledger row appears with a running balance |
| 11 | Session | Botox stock goes **300 U → 260 U** on the FEFO batch, in a second window, and 400 U is refused with nothing deducted |
| 12 | Commission | **PKR 4,363** accrues on the 40,000 *collected*, not the 99,000 *billed* |
| 13 | Refund | The doctor's earnings **fall to PKR 3,273** and a −1,090 ledger row appears |
| 14 | Payroll | The finalized payslip's **commission line cannot be paid twice** (payslip id stamped on the earnings) |
| 15 | Reports | Switching the date range to yesterday sends **every figure to zero**, and dashboard = reports on the same money |
| 16 | Owner drives | He completes a flow we did not rehearse |
| 17 | SQL | `branchId IS NULL` returns **0** across every operational table |

---

## C. WHAT THE DEMO WILL NOT SHOW

Stated at the start of the meeting, before the first click, so it reads as discipline rather than as an excuse afterwards.

| Not in this demo | Why — deliberately deferred |
|---|---|
| **Multi-branch: a second branch, branch switching, consolidated reporting** | Every row already stores its branch (Scene 17). Only the features that *read across* branches are deferred — the customer has one branch, and cross-branch reporting is weeks of RLS work with no buyer. |
| **Other specialties: dental, paediatrics, ophthalmology, OB/GYN** | The pack architecture is live and dermatology/aesthetic templates ship in the demo. A second specialty pack is a configuration exercise for a second customer, not Release 1. |
| **The dynamic form builder** | Release 1 ships one shared consultation form, the derma/aesthetic templates, and simple custom fields the owner edits himself (Scene 7). A general form designer is the single highest-risk item in the whole plan and buys this clinic nothing. |
| **Insurance, corporate accounts, claims, pre-authorisation** | A Lahore aesthetic clinic is cash and card retail. Roughly three weeks of tables that would never be opened. |
| **Laboratory, radiology, IPD, retail pharmacy** | Not purchased by this clinic and not in its plan. The consumables in Scene 11 are clinic stock, not a retail pharmacy. |
| **Advanced reports: custom report builder, cross-tenant analytics, P&L, expense tracking** | Release 1 answers *what did we take, from whom, for what, and what did it cost us*. Profit-and-loss needs an expense ledger that does not exist and was not asked for. |
| **Online payments, Stripe, payment gateways** | No online payment in this market at this size. Cash, card-on-POS, bank transfer. The gateway code exists and stays hidden. |
| **Patient self-booking portal and a patient app** | Every booking in this clinic goes through the front desk or WhatsApp. |
| **Automatic scheduled reminders** | Release 1 has a **manual** "Send WhatsApp reminder" button (Scene 4). Timed reminders require a whole scheduling substrate that does not exist in the codebase; the first feature to need it pays for all of it. |
| **Email invitations and password reset by email** | No mail infrastructure, and this is a WhatsApp market. The owner sets an initial password and the staff member changes it at first login. |
| **Drug interaction checking, ICD-10 pickers, clinical rules engines** | Free-text diagnosis plus an optional code answers "what did we treat". A rules engine is a clinical-safety project of its own. |
| **Leave management, rosters, shift designer, overtime** | One clinic, one shift. Attendance, absence deduction and fixed salary are in; the roster designer is not. |
| **FBR e-invoice filing** | The invoice carries a proper tax structure so it never needs retrofitting, but filing under a shared, hardcoded zero-tax payload would submit materially wrong returns. Hidden until a real NTN and a real tax model exist. |
| **The 108 static HTML screens in `frontend/screens/`** | They make no network calls and never will. They are not part of this product and are not counted as progress. |

---

## D. EARLIER DEMO CHECKPOINTS

The owner sees working software roughly every three weeks, and each checkpoint tells the **smallest honest story that runs end to end**. Nothing is demoed that only works when an admin does it.

*Week markers assume two developers. With one, double the intervals — the sequence does not change, because each checkpoint is a hard prerequisite for the next.*

---

### Checkpoint 0 — "Nothing new, but nothing lies" · ~Week 1
**The story:** every one of the eight roles logs in and gets a working screen instead of a red error, and the security hole is closed.

**Demoed live:** all eight roles log in; no red banner on the landing page; no menu item that 403s on click; a role denial says "your role does not have access" instead of "not included in your plan"; the patient chart shows real invoice numbers and real dates instead of dashes and Rs 0; the billing screen sends a refund *method*, a void *reason* and a payment *reference*; and the privilege-escalation exploit is performed on camera and fails.

**Why this first:** it is one week, it removes every way the current product misleads its owner, and the escalation is live on `main` today.

---

### Checkpoint 1 — "A clinic the owner can staff" · ~Week 4
**The story:** an owner sets up his own clinic and hires his own staff, without us.

**Demoed live:** Scenes 1, 2 and 17. Clinic profile, hours, rooms, payment methods; create four staff; each logs in to a correctly different sidebar; deactivate one and watch their **already-issued token** stop working on the next request; and the SQL proof that every row written carries organisation, clinic and branch.

**Deliberately absent:** patients, money, appointments. This checkpoint is foundation only, and we say so.

**Why it matters commercially:** it is the first checkpoint at which the product could be *installed* somewhere.

---

### Checkpoint 2 — "The front desk's morning" · ~Weeks 8–9
**The story:** a lead becomes a patient sitting in the waiting room.

**Demoed live:** Scenes 3–6. Lead in (webhook + manual), activity logged, follow-up scheduled, WhatsApp sent and logged, convert to patient + booked appointment in one transaction, the double-booking refused, check-in, queue with a live wait timer, walk-in. Plus full patient registration and editing with allergies, CNIC, WhatsApp number and the emergency contact.

**Deliberately absent:** the consultation, the bill, the stock. Reception's day only.

**Why it matters:** it is the first checkpoint where a real clinic could genuinely use one part of the system for one job, all day, instead of a diary.

---

### Checkpoint 3 — "A visit that becomes a balance" · ~Weeks 13–14
**The story:** the doctor sees the patient, proposes a package, and the patient owes a number that is correct.

**Demoed live:** Scenes 7–10 and 13. Consultation on the shared + derma form with the allergy banner and custom fields; sign & lock with the post-signature edit refused; treatment plan with a six-session package and a reasoned discount; convert to invoice with the double-conversion refused; cash advance with the duplicate receipt reference caught; patient ledger, outstanding, printable statement; refund with the cash drawer reconciling.

**Deliberately absent:** sessions, stock, commission, payroll, dashboards.

**Why it matters:** this is the point of no return for data structure. Everything expensive to retrofit — the invoice's subtotal/discount/tax decomposition, the line's service and performer, the patient ledger, sign-and-lock — is in the ground before a single real invoice is written.

---

### Checkpoint 4 — The acceptance demo · ~Weeks 19–20
The full script in Section A. Sessions, before/after photos, inventory consumption with FEFO and cost, commission with clawback, attendance, payroll, and the owner's dashboard. This is the demo the release is judged on, and it is not scheduled until Section E is green.

---

## E. ACCEPTANCE TESTS

The rule that governs all of them, because this project has twice had green suites certify broken safety code:

> **A suite that has never been red does not count.** Every suite below must be demonstrated **failing against the pre-fix commit** and passing against the fix, in the same session, before the item is marked done. A suite written after the fix, against the fix, proves only that the code does what the code does.

Three further standing rules:

1. **No admin shortcuts.** Every step is executed with the HTTP token of the role that would really do it. A golden-thread test that uses an OWNER token to check a patient in has tested nothing about the receptionist.
2. **Assert against the database, not against the API's own read endpoint.** Verification goes through `app/backend/test/safety/_db.py` (`psql`), following the existing convention. An API asserting on its own output is self-attestation.
3. **Assert on absence too.** Every suite that asserts a rejection must also assert **zero rows written** — a 403 that still writes is the failure mode that hurts.

The suites follow the existing house style in `app/backend/test/safety/` (Python, `api()` / `ck()` / `msg()` helpers, `_db.psql()` verification), joining the 25 already there. Frontend assertions run in the `app/web` **vitest jsdom** harness, never browser automation — MUI Selects cannot be driven by a browser agent in this codebase.

---

### E1 · `privilege_escalation_suite.py` — the escalation is dead in all four variants
The named exploit and every way around the fix.

- Log in as a real clinic OWNER. `POST /org/hierarchy/memberships` with `role=PLATFORM_ADMIN` → **400**, and `psql` confirms **no membership row**.
- Same with `role=OWNER` (privilege *lateral* grant) → **400**.
- Force-insert the `PLATFORM_ADMIN` membership by raw SQL, then `POST /auth/switch-context` → **403, or a token whose role is not PLATFORM_ADMIN**. (This is the variant that survives if only the DTO is fixed.)
- Hand-forge a token with `role=PLATFORM_ADMIN, isPlatformAdmin=false`, call `GET /platform/tenants` and `POST /packs/publish` → **403** on both, and a security event is logged.
- Tenant A's OWNER attempts to read/modify Tenant B's patients, invoices and staff by id → **404/403**, never a row.
- A deactivated user's **previously issued** token → **401** on the next request.
- Companion, frontend: `AppShell.test.tsx` asserts the exact visible nav set for each of the 8 roles, and that no visible item maps to a controller that would refuse that role.

---

### E2 · `golden_thread_suite.py` — the whole thread closes, in role
One scripted run of the acceptance milestone, over HTTP, each hop with the correct role's token, each hop verified in the database before the next begins:

`SALES creates lead → SALES converts to patient + appointment → RECEPTION checks in → DOCTOR opens encounter, saves note, signs → DOCTOR creates plan → RECEPTION converts plan to invoice → RECEPTION records payment → TREATMENT starts and completes session → TREATMENT issues consumables → commission earning exists → OWNER reads the report and the numbers match.`

Assertions that make it worth running:
- Final report figures are computed **independently in the test** from the amounts the test itself posted, and compared — not read from the same endpoint twice.
- Every row created along the way carries a **non-null branchId equal to the tenant's MAIN branch** (this is `branch_stamping_suite.py`'s job, invoked here).
- The lead's **source and salesperson** survive onto the patient and onto the invoice.
- The test **fails** if any hop can only be completed with an OWNER or platform token.
- A second full run on the same tenant does not collide (MRN, invoice number, session number).

---

### E3 · `commission_ledger_suite.py` — commission never pays on money that came back
The suite the owner should care about most.

- **Partial payment:** collect 40% of an invoice → the earning is 30% of the **40%**, never of the invoice total.
- **Refund clawback:** refund after accrual → a **negative** earning row appears against the same lines; net earnings fall; the ledger never goes below zero on a fully refunded invoice.
- **Refund after payroll:** refund money that was already paid out in a finalized run → the negative earning appears in the *next* period and is **not** silently deleted from the finalized payslip.
- **Void after full refund:** allowed, and produces no orphan positive earning.
- **Rate change mid-period:** change the rule from 30% to 25% → earnings accrued **before** the change are not restated.
- **Two performers on one invoice:** each earns only on their own lines.
- **Rounding:** the sum of all earning rows plus the residual row equals the payment **exactly**, to the rupee, for a payment that does not divide cleanly (the demo's own 40,000 / 99,000 case).
- **Idempotency:** replay the same payment webhook / same reference → **no second earning**.
- **Double-pay:** sweep earnings into a payroll run, then run payroll again for an overlapping period → the same earning **cannot** be paid twice.
- **Concurrency:** two payments posted simultaneously against one invoice → earnings sum correctly, no lost update.
- **Standing reconciliation check** (runs in CI, not just in this suite): per tenant, `SUM(Payment) − SUM(Refund) == SUM(Invoice.paid)` — because the reports read both and nothing currently asserts they agree.

---

### E4 · `stock_integrity_suite.py` — stock never goes negative, and never disagrees with its own history
- **Concurrency:** two sessions issue against the last remaining quantity **simultaneously** → exactly one succeeds, one gets a clean insufficient-stock error, and on-hand lands at **0, never negative**. (This is the assertion the whole suite exists for.)
- **FEFO:** with three batches in stock, consumption takes the **nearest expiry that is still in date**; an expired batch is never consumed even if it is the oldest.
- **Refusal is atomic:** an over-issue attempt deducts **nothing** from any batch — verified per batch in `psql`, not on the aggregate.
- **Ledger reconciliation:** for every batch, `SUM(StockMovement.signedQuantity) == quantityOnHand`, after a randomised sequence of receive / dispense / issue / write-off.
- **Cost snapshot:** change an item's cost after a session, re-read the session → the historical consumable cost is **unchanged**. (A price change must never restate last quarter's margin or commission.)
- **Write-off:** an expired batch can be written off, posts a WRITE_OFF movement, and is then absent from on-hand.
- **Zero stock is visible:** an item at 0 still appears on the inventory screen and still fires its low-stock alert (the current code hides it — this assertion is written against that bug).
- **Custody roles:** a RECEPTION token cannot receive stock, set cost, or write off; a DOCTOR/TREATMENT token can consume but not adjust.

---

### E5 · `clinical_note_immutability_suite.py` — a signed note is evidence, not a draft
- Sign a note, then `PATCH` its content → **409/403**, and `psql` confirms the stored JSON is **byte-identical** to before the attempt.
- Amend **without a reason** → **400**.
- Amend **with** a reason → a **new** row is created, `supersedesId` points at the original, the original is untouched, and both are retrievable in order.
- Sign a note authored by **another clinician** → **403**.
- Sign a note belonging to **another tenant** → **404/403**, no write.
- Sign **twice** → the second is refused; `signedAt` does not move.
- Contradictory timestamps (completed before started, signed before authored) → rejected.
- An unsigned note is still editable — the suite proves the lock is the *signature*, not the passage of time.
- The prescription written in the same encounter **locks with it**.
- Companion, frontend: `PatientRecordPage.test.tsx` asserts one **populated** row in every chart section against a realistic payload — the current tests stub every section with `[]`, which is exactly why six dead field names shipped unnoticed.

---

### E6 · The gate itself
Release 1 is not demoable until:

1. All six suites above are green **and each has been shown red against its pre-fix commit**.
2. `check-rls-coverage`, `check-rls-live`, `check-tenant-isolation`, `check-entitlement-coverage` and the new `check-role-coverage` all pass — every new table (TreatmentSession, StockIssue, StockMovement, CommissionEarning, PatientLedgerEntry, AttendanceDay, Room, InventoryItem, Message …) has an RLS policy and a role declaration.
3. The **full demo script in Section A is performed twice, on a freshly reset database, by someone who did not write it**, without a developer touching the keyboard, and timed.
4. The frontend vitest suites cover the new screens in the jsdom harness — calendar, queue, consultation renderer, plan builder, session board, earnings.
5. `docs/` records which demo elements are live-credentialed (WhatsApp, Meta, attendance camera) and which are fixture-driven **on that specific demo date**, signed off before the meeting.

If any one of these is amber, the demo is moved. A demo that has to be steered around a known failure is how this project got burned twice, and it is not worth the week it saves.