# Release 1 — Timeline, Team and Delivery Sequence

_Release 1 replan — scoped to one aesthetic clinic, architecture kept universal._

# HEALTH OS — RELEASE 1 DELIVERY PLAN (timeline, team, sequence)

**Source of estimates:** the five golden-thread traces, cross-checked against `docs/audit-01-architecture-verdict.md:43-67` (the branch migration cost) and `docs/audit-02-roadmap.md:227-243` (the 15 ordering traps). Nothing below re-derives the audit.

---

## 0. THE MULTIPLIER — and what I changed in the bottom-up numbers

**Raw trace estimates:** corrections 64.25 + 1A 48.5 + 1B 148.75 + 1C 50.5 = **312.0 developer-days.**

Three adjustments before any multiplier:

| Adjustment | Days | Why |
|---|---|---|
| **Deduplicate cross-trace overlap** | −7.5 | The traces were walked independently and costed the same work twice: the appointment transition guard (hop 1-2 @1.0 and hop 7-8 @0.5), the `GET /appointments` filters (hop 1-2 @1.5, hop 7-8 @1.0), the `Room` model (hop 1-2 @1.5, hop 7-8 @3.0), the role-shaped landing dashboard (hop 9-10 @2.5, 1A @2.0), `hr.core` in the DERMATOLOGY edition (twice @0.5), the patient-chart invoice field names (twice @0.5). |
| **Right-size the branch-column migration** | −8.5 | Each hop costed branch columns for its own tables (2+2+3+4+3.5 = 14.5 raw) *and* the 1A trace costed the whole repo-wide migration at 2.0. It is one migration. `audit-01:61` costs the full version at three weeks for ~28 tables. Under the partner's single-branch rule (nullable columns, backfill to `MAIN`, no RLS predicate, no `NOT NULL`) the honest number is **8 raw days** across ~30 tables plus indexes and backfill, with `auto-stamp` costed separately at 4. |
| **Add before/after photos — the traces missed it entirely** | +6 raw | 1B explicitly requires before/after photos. No trace has a newWork item for it. The media/photos backend is one of the six built-but-orphaned modules; `PhotoSession` appears only in the 1A branch-column list. Capture UI on the treatment session, side-by-side compare on the chart, consent gating, branch columns: **6 raw days.** |

**Net raw: 302 developer-days.**

**Multiplier applied: ×1.5.** Not 1.2, not 2.0. Here is what the 50% buys, and why it is not larger:

- **What it covers:** integration between hops (the traces are per-hop and connect nothing to each other); code review and rework; UAT bug-fix cycles with the clinic; migration/backfill verification passes; environment and deploy friction (this is a Windows dev box with a documented Prisma/libpq URL split and dev servers that die with the shell); requirement clarification with a Lahore customer in a different timezone.
- **Why not higher:** the traces already carry ~23 raw days of *explicitly costed* adversarial test work (appointments suite 3, 1A suites 4, hop 7-8 verification pass 5, commission adversarial suite 3, plus per-item test riders). Most estimates omit QA entirely and need 1.8-2.0×. These do not.
- **Why not lower:** this project's own memory records that green suites have **twice** certified broken safety code, and the audit found a live privilege escalation that a green onboarding suite runs straight through (`test/safety/tenant_onboarding_suite.py:88`). Verification here is not a formality; it is a rework generator.

> **302 × 1.5 = 453 loaded developer-days.**

---

## A. TIMELINE BY MODULE

Loaded days (post-multiplier). "Weeks, single owner" = days ÷ 4.5 productive days/week — the 1.5× covers technical friction, the 4.5 covers standups, holidays, sickness and customer calls.

### Slice 1A — Security & foundation — **90 days**

| Workstream | Days | Weeks (1 owner) | What it unblocks |
|---|---|---|---|
| Security & permissions — escalation fix, `@Roles` sweep on the 10 R1 controllers + CI coverage guard, nav role filter, distinct 403 codes, entitlement-fetch resilience, `hr.core` into `CLINIC_ADDONS`, platform tenant counts, billing/stock custody role splits | 17 | 3.8 | **Everything.** The four-call `PLATFORM_ADMIN` exploit is live today; no screen may ship to a real clinic until it is closed and a red-then-green suite proves it. |
| Users & staff — Users module (8 endpoints), staff screen, membership update/revoke, `tokenVersion` + deactivate, AuditLog writes on privileged mutations | 20 | 4.4 | Every other slice. Today only the owner exists; there is no users controller among the 30 in `app/backend/src`. A receptionist and a doctor cannot be brought into existence, so 1B cannot be tested by anyone but the owner. |
| Clinic configuration — `ClinicProfile`, `WorkingHours`, `ClinicHoliday`, `Room`, `ClinicPaymentMethod`, one settings screen with four tabs | 21 | 4.7 | Calendar (hours), session board (rooms), billing (payment methods — fixes the hardcoded CASH refund), invoice print header. |
| Branch context & stamping — `TenantCtx` extension, login-token claims, default-branch guarantee, ~30 nullable columns + composite indexes + backfill to `MAIN`, Prisma auto-stamp extension, `branch_stamping_suite.py` | 28 | 6.2 | The partner's binding clarification #1. **Unrecoverable if delayed** — every row written before it has a guessed branch forever. |
| Role-shaped landing + provider directory read | 4 | 0.9 | Stops the app's index route 403-ing for 5 of 8 roles; gives the booking dialog something to populate a doctor dropdown from. |

### Slice 1B — Small clinic operations — **277 days**

| Workstream | Days | Weeks (1 owner) | What it unblocks |
|---|---|---|---|
| Patient record & demographics — 6 dead field names, entitlement-gate the 3 unpurchased chart sections, edit dialog, ~18 demographic columns, structured allergies + red banner, server-side patient search | 17 | 3.8 | Registration, consultation header, CNIC uniqueness, WhatsApp number. |
| Appointments, calendar & queue — filtered/indexed `GET`, transition guard, `EXCLUDE` overlap constraint, lifecycle columns + status events, reschedule, Room, day/week calendar, day sheet, queue board, safety suite | 34 | 7.6 | Check-in, queue, session board, lead→appointment convert, "today's schedule" on the dashboard. |
| Consultation & clinical notes — pack-form renderer (7 field types), `/consultation/:encounterId`, Encounter clinical columns, server-side note validation, core shared consultation template, encounter timeline | 21 | 4.7 | The hybrid-specialty strategy. The renderer is reused by custom fields, intake, note viewing and every future pack. |
| Sign-and-lock & prescribing | 14 | 3.1 | **Medico-legal standing.** `signedById/signedAt` exist on 1 of 94 models. Every note written before this ships is permanently unattributable. |
| Service catalogue & attribution spine — `source` discriminator + write API + editor, server-side price resolution, `InvoiceLineItem.serviceCatalogItemId` + `performedById`, `Employee.userId`, `Payment.createdById` | 24 | 5.3 | All revenue reporting, all commission, package session decrement, discount variance. |
| Invoicing, discounts & tax — subtotal/discount/tax decomposition, role-capped discounts with reason, `CHECK (paid <= total)`, three BillingPage data-falsification defects, clinic tax/legal identity | 18 | 4.0 | A lawful printed invoice. **Gets more expensive with every invoice written.** |
| Treatment plans & packages — sessions per plan item, redemption audit, plan builder screen, printable quote, plan-status collision fix, plan→invoice glue | 15 | 3.3 | "Six laser sessions" as a sellable, redeemable thing. |
| Patient ledger, advances & receivables — append-only `PatientLedgerEntry`, `PatientAccount`, nullable `Payment.invoiceId` + `PaymentAllocation`, statement, day-book, paid-vs-payments reconciliation assertion | 23 | 5.1 | Deposits (structurally impossible today), credit balances, "who owes us money", "what did we take today". |
| Inventory item master & movement ledger — `InventoryItem` replacing the 8-row hardcoded formulary, immutable `StockMovement`, reorder alerts, expiry write-off, seed data | 20 | 4.4 | Botox, filler, PRP kits and numbing cream can exist as stockable things at all. |
| Treatment sessions & consumption — `TreatmentSession` + state machine, session board + drawer, shared `StockLedgerService.consume()` extracted from the proven FEFO engine, `ServiceConsumable` BOM, verification pass | 37 | 8.2 | Hop 7-8 of the golden thread, and the only path to a real consumable cost. |
| Before/after photos *(traces omitted this)* | 9 | 2.0 | The single most demo-critical aesthetic-clinic feature. |
| Commission engine — `CommissionRule` (2 bases, basis points, effective-dated), append-only `CommissionEarning` keyed to `Payment`/`Refund`, doctor statement, adversarial suite | 27 | 6.0 | Doctor share, clinic share, hop 9. |
| Reporting & owner dashboard — `from`/`to` on both endpoints, VOID reconciliation between the two contradicting reports, per-method refunds, revenue by doctor/service, `GET /dashboard/today` | 12 | 2.7 | Every finance number today is inception-to-date. "What did we take today" is currently unobtainable. |
| Custom fields *(explicitly not the form builder)* | 6 | 1.3 | The partner's clarification #2, at ~7% of the builder's cost. |

### Slice 1C — Sales & workforce — **85.5 days**

| Workstream | Days | Weeks (1 owner) | What it unblocks |
|---|---|---|---|
| CRM pipeline & follow-up — lead detail drawer + activity timeline, follow-up worklist, assignment (`assignedToId` is a dead column with no FK), kanban with real stages, lost reason, status guard, UUID pipes, outbound message log, manual WhatsApp send | 20 | 4.4 | Wires the four orphaned CRM routes. **Highest ratio in the project.** |
| Lead → booked appointment in one click | 4 | 0.9 | The hop 1-2 acceptance criterion. |
| Automated lead ingestion — public-route substrate (the first unauthenticated route in the product), Meta Lead Ads, WhatsApp inbound, webhook event log + replay | 10 | 2.2 | Facebook/WhatsApp lead capture. |
| Payroll & payslips — staff directory wiring, `PayslipComponent` child table, period/number/gross, commission sweep with `payslipId` stamping, proration, `ON_LEAVE` zero-pay fix | 17 | 3.8 | Fixed-salary payroll. The module is ~630 lines already written and carefully done; it is entitlement-locked away from the buyer. |
| Attendance — `AttendanceDevice`/`AttendanceEvent`/materialised `AttendanceDay`, manual punch, supervisor correction, deduction components | 13 | 2.9 | Camera attendance. Manual punch is mandatory, not optional — the camera will be down. |
| *Vendor camera adapter* | *4.5* | *1.0* | **Not schedulable.** Needs the device chosen, bought and installed in Lahore. |
| Sales commission & management reports — salesperson attribution on Invoice, consumable cost snapshot onto the invoice line, revenue-by-service, commission summary, consumption/margin | 17 | 3.8 | The management dashboard and the `PCT_AFTER_CONSUMABLE` basis. |

**TOTAL: 452.5 ≈ 453 loaded developer-days.**

---

## B. TEAM SIZE

Capacity model: 4.5 productive days per person-week. Multi-person throughput is discounted for coordination and handoff wait — 2 people ≈ 1.8×, 3 ≈ 2.6×, 4 ≈ 3.2×. Assumed start **Monday 3 August 2026**.

| Option | Effective throughput | Elapsed | Release 1 complete | Clinic opens its doors |
|---|---|---|---|---|
| **A — 1 full-stack** | 1.0× | 101 weeks | ~mid-July 2028 | ~Nov 2027 |
| **B — 1 backend + 1 frontend** | 1.8× | 56 weeks | ~30 Aug 2027 | ~early May 2027 |
| **C — 2 backend + 1 frontend** ⭐ | 2.6× | **41.5 weeks** | **20 May 2027** | **15 Feb 2027** |
| **D — 2 backend + 2 frontend** | 3.2× | 36 weeks | ~12 Apr 2027 | ~1 Feb 2027 |

### Recommended: **Option C — 2 backend + 1 frontend.**

**Ownership**

- **Engineer A — senior backend / tech lead.** Owns the entire critical path: the escalation fix, `TenantCtx`, the branch migration and auto-stamp extension, the attribution spine, invoice decomposition, the patient ledger, the commission ledger, and every safety suite. Roughly 20% of A's time is adversarial verification — writing the suite that is **red against `main` first**. That 20% is inside the 1.5×, not on top of it.
- **Engineer B — backend.** Owns everything that hangs off the spine: appointments/calendar/queue, EMR and the consultation API, inventory item master and the shared consume path, treatment sessions, catalogue, CRM, HR/payroll, integrations.
- **Engineer C — frontend.** Owns every screen, the pack-form renderer, and the `app/web` vitest jsdom harness. (Verify UI in vitest, never browser automation — MUI Selects cannot be driven by browser automation.)

**Where the parallelism actually is:** slice 1B. Four genuinely independent streams run at once — clinical (patient record → consultation → sign-and-lock), scheduling (calendar → queue → sessions), money (catalogue → invoice → ledger), inventory (item master → movement ledger → consumption). That is why 1B compresses from 62 single-owner weeks to 24.

**Where it is NOT:**
1. **Slice 1A.** The chain escalation-fix → `TenantCtx` → login claims → branch columns → auto-stamp → stamping suite is ~28 loaded days of one person's work and admits no shortcut. B and C have only ~45 days of genuinely parallel work (clinic config, settings screen, role/nav fixes, users module) to fill 8 weeks. **Expect 15-20% idle capacity in 1A.** This is the whole reason Option D buys only 5 weeks for 33% more cost.
2. **The money spine inside 1B.** Attribution columns → catalogue discriminator → invoice decomposition → patient ledger → commission ledger is single-threaded and A owns all of it. Adding a third backend engineer does not shorten it.
3. **The frontend is a single point of failure.** Screens are ~35% of the work (≈160 days) against a 41-week program at 4.5 d/wk = 185 days capacity. Engineer C is ~87% loaded with no slack. Two weeks of C's absence directly slips the calendar, the consultation screen and the session board. **Hire a frontend engineer who can write NestJS controllers**, and treat that as a hard requirement, not a nice-to-have.

**Option B is viable but commercially wrong:** it pushes the clinic's opening from February to May 2027 and Release 1 to September 2027 — 15 more weeks of a customer waiting and no revenue. The marginal engineer costs roughly one-third of a salary-year and buys back a full quarter of trading.

---

## C. CLICKABLE DELIVERY SEQUENCE

24 increments. Every one ends with a human logging in and doing something new in a browser. No back-end-only milestone. Elapsed weeks assume Option C, cumulative from a 3 Aug 2026 start.

### Phase 1A — foundation (weeks 1-8)

**1. Lock the door** — 13 days — *ends week 1.5*
**Clickable:** log in as each of the 8 roles and see a sidebar containing only items that actually work. A doctor no longer sees Billing, Reports and Payroll and gets 403'd on all three. A refusal now reads "your role does not have access" instead of "not included in your plan". A failed `/entitlements` call no longer silently empties the nav.
*Screens:* AppShell nav, FetchErrorBanner, `AppShell.test.tsx` (8-role matrix). *Backend:* `roles.guard.ts` `PLATFORM_ADMIN` corroboration, `ASSIGNABLE_ROLES` allowlist in `create-membership.dto.ts`, role re-check in `switchContext`, `@Roles` sweep on the 10 R1 controllers, `check-role-coverage.ts`, `hr.core` → `CLINIC_ADDONS`, `privilege_escalation_suite.py`.
> **Gate: do not mark done until `privilege_escalation_suite.py` is RED against `main` and green against the branch.**

**2. Staff exist** — 20 days — *week 3.5*
**Clickable:** the owner adds a receptionist and a doctor, hands them passwords, they log in and are forced to change it. The owner corrects a wrong role and it actually changes. The owner deactivates a departing nurse and her open session dies on the next request.
*Screens:* `/admin/staff` — searchable table, Add-staff dialog, Edit role, Deactivate confirmation; new Administration nav group. *Endpoints:* `GET/POST/PATCH /users`, `/users/:id/deactivate|reactivate|reset-password`, `POST /auth/change-password`, membership update+revoke, AuditLog writes.

**3. The clinic describes itself** — 24 days — *week 5.5*
**Clickable:** the owner enters the clinic's legal name, phone, WhatsApp number, address, invoice prefix and footer; sets Mon-Sun opening hours and holidays; adds six rooms; toggles which payment methods the desk may use and which require a reference. All of it persists and reappears.
*Screens:* `/admin/settings` (Profile / Hours / Rooms / Payment methods), `/admin/branches`. *Endpoints:* `GET|PATCH /clinic/profile`, `/clinic/working-hours`, `/clinic/holidays`, `/clinic/rooms`, `/clinic/payment-methods`, `GET|PATCH /org/branches`. *Underneath:* `TenantCtx` gains org/clinic/branch, the **login** token carries context claims (not just switch-context), every auth path guarantees a `MAIN` branch.

**4. Every row knows where it happened** — 33 days — *week 8*
**Clickable:** every role now lands on a page that works instead of a red error — owner/admin/finance keep the report tiles, reception and doctor get a role-appropriate view. Booking and clinical screens can list the clinic's doctors.
*Screens:* role-shaped landing, provider picker component. *Endpoints:* `GET /dashboard/today`, `GET /staff/providers`. *Underneath:* ~30 nullable `organizationId/clinicId/branchId` columns + composite indexes + backfill to `MAIN`; the Prisma auto-stamp extension; `branch_stamping_suite.py` asserting via psql that a golden-thread walk writes non-null branch on every row.
> **Gate: timebox 5 days to prove the auto-stamp extension on 3 tables before committing to it.** The fallback — hand-editing ~30 create sites and every future one — is the single largest hidden cost in the plan.

### Phase 1B — daily operations (weeks 9-28)

**5. A patient chart that tells the truth** — 17 days — *week 9.5*
**Clickable:** register a patient with a WhatsApp number, CNIC, address, emergency contact and referral source; fix a typo afterwards; record a botox allergy and see a red banner on every screen that shows that patient; search 400 patients from the server instead of filtering the browser's copy. Chart sections for unpurchased modules disappear instead of showing a permanent blue notice.
*Screens:* Register-patient v2, demographics edit dialog, allergy/medication sections, allergy banner. *Endpoints:* extended `POST|PATCH /patients`, `GET /patients?q=&take=&cursor=`, `/patients/:id/allergies`, `/patients/:id/medications`.

**6. The front desk runs the day** — 34 days — *week 12.5*
**Clickable:** book an appointment against a doctor and a room, get a conflict warning if it overlaps, reschedule it, check the patient in, watch them move Waiting → In room → Done on a queue board, cancel with a required reason.
*Screens:* `/appointments` (day + week, provider columns, current-time marker), book/edit dialog, detail drawer with history, `/queue` board, walk-in flow. *Endpoints:* filtered+indexed `GET /appointments`, `PATCH /:id` (reschedule — no route can change an appointment's time today), `/check-in|start|complete|cancel|no-show`, `GET /appointments/day-sheet`, `POST /appointments/walk-in`, `/rooms`. *Underneath:* transition table, Postgres `EXCLUDE` constraint on `(providerId, tstzrange)`, `appointments` safety suite firing concurrent bookings of one slot.

**7. The doctor sees a patient** — 21 days — *week 14.5*
**Clickable:** start a consultation from the chart or the queue, fill the dermatology/aesthetic intake and note templates that are already seeded on every tenant, record chief complaint / diagnosis / follow-up date as real fields, save, and read the whole visit back on the patient's timeline.
*Screens:* `<PackFormRenderer>` (all 7 manifest field types), `/consultation/:encounterId`, expandable encounter timeline. *Endpoints:* the already-built, already-guarded `POST /encounters`, `/intake-submissions`, `/note-instances`, `PATCH /encounters/:id/status`, `GET /note-templates?packKey=`, `/intake-groups?packKey=`. Delete `public/aesthetic-workspace.html` and its `index.html` link the day this lands.

**8. The record becomes evidence** — 14 days — *week 15.5*
**Clickable:** sign a note and watch it lock, with "signed by Dr X on 14 Feb" on the face of it; amend it and be refused without a reason; write and print a prescription for a topical and a course of antibiotics.
*Screens:* sign-and-lock strip, amendment dialog + history, prescription block, printable Rx. *Endpoints:* `PATCH /encounters/:id/sign`, `/note-instances/:id/sign`, `POST /note-instances/:id/amend`, `POST /prescriptions` under `emr.core`.
> **Gate: this must ship before the clinic sees its first real patient.** There is no retroactive fix — trap 14.

**9. The clinic owns its price list** — 24 days — *week 17.5*
**Clickable:** the owner edits the eight seeded aesthetic services (Botox 18,000 / filler 55,000 / HydraFacial 15,000 …), changes a price, adds a new service with a tax rate and a default commission %, and the change survives a pack re-activation. Billing lines are picked from the catalogue instead of free-typed, and each line names the doctor who performed it.
*Screens:* `/settings/services` list + editor, catalogue picker + performer column on the billing line editor, Employee↔User link on the staff directory. *Endpoints:* `POST|PATCH|DELETE /service-catalog`, `PATCH /invoices/:id/lines/:lineId/performer`, `PATCH /hr/employees/:id`.
> **Two traps discharged here: the `source` discriminator before the editor (7), and `serviceCatalogItemId` + `performedById` before any revenue reporting (3).**

**10. An invoice that adds up and is lawful to hand over** — 18 days — *week 19*
**Clickable:** raise an invoice showing subtotal, discount, tax and total; apply a discount with a reason and a role cap; take a card payment recording the method and the receipt reference; refund by the method actually used; void with a required reason; print it with the clinic's NTN and address in the header.
*Screens:* invoice detail breakdown, discount dialog, refund method select, void reason field, payment reference field, printable invoice, `/settings/tax-profile`. *Removed:* the "Simulate gateway pay" button and the FBR filing button (which would file a `TaxRate: 0` return).

**11. A six-session package, sold** — 15 days — *week 20.5*
**Clickable:** the doctor builds a treatment plan from the catalogue with sessions per line and a package price, prints it as a quote, and reception converts it to an invoice in one click — once, provably.
*Screens:* `/treatment-plans/:patientId` builder, plan list on the chart, printable quote. *Endpoints:* existing `POST /treatment-plans` and `POST /invoices {planId}` — correct code with zero callers today — plus the `PROPOSED→ACCEPTED` collision fix that currently makes an accepted plan un-invoiceable forever.

**12. Money the clinic can reconcile** — 23 days — *week 22.5*
**Clickable:** take a 20,000 deposit against a laser package before any invoice exists; apply it at settlement; print a patient statement with opening, running and closing balance; open a day-book showing today's collections by method and who still owes money.
*Screens:* advance-payment dialog, apply-credit at settlement, patient statement, balance panel, day-book/receivables. *Endpoints:* `POST /patients/:id/advance-payments`, `/invoices/:id/apply-credit`, `GET /patients/:id/ledger|balance|statement`, `GET /invoices?from=&to=&status=`, `GET /payments?from=&to=`.

**13. Consumables that exist** — 20 days — *week 24*
**Clickable:** stock a 100u Botox vial, an HA filler syringe, a PRP kit and numbing cream — none of which can exist today, because `receiveStock()` rejects anything outside an 8-row array of generic drugs compiled into the binary. See a zero-stock item instead of it vanishing. Get a low-stock alert. Write off an expired lot instead of it sitting in `quantityOnHand` forever.
*Screens:* `/inventory/items` list + editor, alerts panel, item ledger, upgraded expiry worklist. *Endpoints:* `/inventory/items`, `/inventory/alerts`, `/inventory/movements`, `/inventory/write-offs`.

**14. The session that closes the golden thread** — 37 days — *week 27*
**Clickable:** open today's session board grouped by room; start session 3 of 6 for a laser package; the expected consumables pre-fill from the service's bill of materials; the nurse adjusts quantities; on complete, stock decrements FEFO by batch, the cost is snapshotted onto the session, and the patient's chart shows "3 of 6 done".
*Screens:* `/sessions` board, session detail drawer with consumables panel, Sessions tab on the chart. *Endpoints:* `POST /treatment-plans/:planId/items/:itemId/sessions`, `PATCH /sessions/:id/start|complete|cancel`, `GET /sessions`, `POST /inventory/issues`. *Underneath:* the FEFO/deterministic-lock/provenance engine at `pharmacy.service.ts:119-220` extracted into a shared `StockLedgerService.consume()` — **not hand-copied**, or the two copies silently diverge.

**15. Before and after** — 9 days — *week 28* — **🚩 CLINIC CAN OPEN — ~15 February 2027**
**Clickable:** capture consented before/after photos against a treatment session and view them side by side on the patient's chart.
> **At the end of increment 15 the clinic runs its whole day in the product:** lead → appointment → check-in → consultation → signed note → treatment plan → invoice → payment → session → stock consumption → photos. Increments 16-24 are built while the clinic is trading.

### Phase 1B tail + 1C — sales & workforce (weeks 29-41.5)

**16. The owner's daily number** — 12 days — *week 29*
**Clickable:** pick a date range and see collections, outstanding, patients seen, appointments and revenue by doctor and by service — and the dashboard and the reports page finally agree with each other about voided invoices.
*Endpoints:* `from`/`to` on `/reports/summary` and `/reports/revenue`, `/reports/revenue/by-doctor|by-service`, `GET /dashboard/today`.

**17. The doctor's share** — 27 days — *week 31.5*
**Clickable:** the owner sets "30% of net collection" for a doctor with an effective date; every payment taken from that moment writes an earning line; the doctor logs in and sees their own statement for the month, line by line; a refund writes a negative line rather than silently overpaying them.
*Screens:* `/settings/commissions`, `/me/earnings`. *Endpoints:* `/commissions/rules`, `GET /commissions/me`, `GET /reports/revenue-share`.
> Accrual runs **inside `applyPayment`'s existing invoice row lock**, keyed to `Payment`/`Refund` ids, never recomputed over the mutable `Invoice.paid` — trap 6. Adversarial suite covers partial payment, refund after a finalised payroll run, mid-period rate change, two performers on one invoice, concurrent payments, and rounding residual summing to exactly zero.
> *Honest note:* the mandate places "basic doctor commission" in 1B. It lands ~3.5 weeks **after** the doors open. This is safe only because the attribution columns ship in increment 9 — the earnings can be backfilled from immutable `Payment` rows. It is not safe to delay past the first month-end.

**18. The clinic's own fields** — 6 days — *week 32*
**Clickable:** the owner adds "How did you hear about us?" as a dropdown on registration and "Areas treated" on the consultation, and both render through the same renderer built in increment 7.
*Screens:* `/settings/custom-fields`, auto-appended "Clinic fields" block. Deliberately a **separate table**, not tenant edits to `NoteTemplate.schema` — `pack-seeding.ts` overwrites that on every re-activation.

**19. Leads that get followed up** — 20 days — *week 33.5*
**Clickable:** open a lead, see who owns it, assign it, log a WhatsApp call, schedule a follow-up, work an Overdue/Today/Upcoming worklist, drag a lead across a real pipeline, mark it lost with a reason — and every WhatsApp message sent is recorded.
*Screens:* lead detail drawer + timeline, `/leads/followups`, kanban board, source dropdown, send-reminder action. *Endpoints:* the four **already-built, already-guarded, zero-caller** CRM routes — `GET /crm/leads/:id`, `POST /crm/leads/:id/activities`, `PATCH .../done`, `GET /crm/followups` — plus assign/claim/lost and the `Message` log.
> **The message log must ship with the first WhatsApp button, not after — trap 11.** January's sends cannot be reconstructed in March.

**20. Lead to booked appointment in one click** — 4 days — *week 34*
**Clickable:** convert a lead to a patient *and* a booked appointment in one dialog, with source and salesperson carried onto the patient — inside the transaction that already holds the `FOR UPDATE` lock, and blocked by the `EXCLUDE` constraint if the slot is taken.

**21. Leads arrive by themselves** — 10 days — *week 35*
**Clickable:** a Facebook Lead Ads submission and a WhatsApp inbound message appear in the pipeline unaided; the owner sees a webhook event log with connection status and can replay a failed delivery.
*Endpoints:* `POST /public/forms/:formKey` — the **first unauthenticated route in the product** — `/public/integrations/meta/leadgen`, `/public/integrations/whatsapp`, `/integrations/webhook-events`. Verified end-to-end against recorded fixtures with stub credentials; must not require a live Meta account to be testable. Its own cross-tenant safety suite: getting this wrong is a cross-tenant write.

**22. Payroll the clinic can run** — 17 days — *week 36.5*
**Clickable:** add a nurse from the staff directory, run a draft payroll, see each payslip broken into basic / deductions / commission with a source reference per line, print it, finalize it. A mid-month joiner is prorated. Someone on leave is paid.
*Screens:* staff directory + add/edit employee, per-payslip printable view with component rows. *Endpoints:* `PATCH /hr/employees/:id`, `GET /hr/payroll/payslips/:id`. Commission earnings are swept into the payslip and stamped with `payslipId` so they can never be paid twice.

**23. Attendance** — 13 days (+4.5 camera adapter, *unschedulable*) — *week 38*
**Clickable:** a supervisor records a manual punch, sees a month grid per employee with first-in/last-out/minutes, corrects an entry with an audit trail, and the correction reduces pay through a named payslip component.
*Endpoints:* `POST /attendance/ingest` (HMAC webhook), `POST /attendance/punch`, `GET|PATCH /attendance/days`. `@@unique([tenantId, deviceId, externalEventId])` so a camera re-sending yesterday's punches cannot double-count.
> The **vendor camera adapter cannot be scheduled** until the device is chosen, purchased and installed in Lahore. Order it in week 1. The manual path ships regardless.

**24. The management dashboard** — 17 days — *week 39.5*
**Clickable:** the owner opens one screen and sees today's collections, doctor share vs clinic share, sessions in progress by room, low stock, lead funnel and conversion rate, consumption and margin by service — and salespeople see their commission on the same statement screen the doctors use.
*Endpoints:* `PATCH /invoices/:id/salesperson`, `/reports/revenue-by-service`, `/reports/commission`, `/reports/consumption`, `/reports/margin`.

**Pilot hardening & UAT** — 2 weeks — *ends week 41.5* — **Release 1 complete: 20 May 2027.**

---

## D. THE CRITICAL PATH

**One chain determines the end date. It is the money-attribution spine, and Engineer A owns all of it:**

```
close the PLATFORM_ADMIN escalation
  → TenantCtx carries org/clinic/branch
    → login token mints the claims (not just switch-context)
      → Users module (a second person must exist)
        → ~30 branch columns + backfill to MAIN
          → Prisma auto-stamp extension
            → InvoiceLineItem.serviceCatalogItemId + performedById + Employee.userId
              → ServiceCatalogItem source discriminator + write API
                → invoice subtotal/discount/tax decomposition
                  → PatientLedgerEntry (append-only)
                    → TreatmentSession + shared StockLedgerService.consume()
                      → consumable cost snapshot onto the invoice line
                        → CommissionEarning ledger keyed to Payment/Refund
                          → commission swept into PayslipComponent
                            → management dashboard
```

**Length: ~127 loaded developer-days ≈ 28 weeks of single-threaded work.** Adding engineers does not shorten it. **Release 1 cannot complete before ~week 30 at any team size** — which is exactly why Option D (4 engineers) buys only 5 weeks over Option C.

### The three things most likely to slip it

1. **The auto-stamp Prisma client extension (increment 4).** The plan assumes one extension writes `organizationId/clinicId/branchId` on every create by reading `TenantCtx`, inside the existing `forTenant` RLS transaction wrapper. If it does not compose cleanly with `PrismaService.forTenant` (`prisma.service.ts:170-183`), the fallback is hand-editing ~30 create sites and re-editing every new one forever — a permanent tax on all of 1B and 1C. **Mitigation: 5-day timeboxed spike on 3 tables in week 5. If it fails, cut the hand-edit into 1B's per-hop work and add 8 days.** This is the item I would bet on slipping.
2. **Invoice decomposition + the patient ledger (increments 10 and 12).** Retrofitting subtotal/discount/tax and an append-only ledger into `BillingService` — which already carries a `FOR UPDATE` row lock, amount-validated reference idempotency and hole-proof invoice numbering, and is the best-engineered code in the repo — is where a mistake loses money silently. The service's own docblock already documents a `CHECK (paid <= total)` that **does not exist** in `constraints.sql`. **Mitigation: no money change merges without a suite that is red against `main` first.** Budget for one full re-do of the ledger's allocation logic.
3. **The attendance camera (increment 23).** The only item in the plan with a physical, external, third-party dependency, and it sits in the final six weeks where there is no recovery room. Device selection, procurement to Lahore, installation, and an undocumented vendor webhook format. **Mitigation: select and order the device in week 1, not week 35. Ship manual punch regardless and treat the adapter as a post-Release-1 patch if the hardware is late.**

**Honourable mention:** Meta app review and business verification for Lead Ads webhooks (increment 21) can take weeks of elapsed calendar time with zero developer effort. Start the Meta app registration in week 1 alongside the camera order.

---

## E. ORDERING TRAPS THAT STILL BIND AT THIS SCOPE

Of the 15 in `docs/audit-02-roadmap.md:229-243`, **ten still bind Release 1**, two are modified by the partner's clarifications, and three are released — but two of those three become hard gates on customer #2 rather than disappearing.

### Still binding — hard

| # | Trap | Where it is discharged | What it costs if violated |
|---|---|---|---|
| **1** | **`branchId` before more rows.** | INC 4, week 8 | Every operational row written after go-live without it has a **guessed** branch forever. The partner's clarification makes this cheaper, not optional: columns + context now, cross-branch reporting deferred. |
| **3** | **`InvoiceLineItem.serviceCatalogItemId` + `performedById` before ANY revenue reporting or commission.** | INC 9, week 17.5 — **before the first real invoice in INC 10** | Every invoice raised before them is permanently unattributable. The DTO already accepts `serviceCatalogItemId` and silently discards it (`create-invoice.dto.ts:19-21` vs `billing.service.ts:449-473`), so the API contract is currently lying. |
| **4** | **Invoice subtotal/discount/tax decomposition before real invoices accumulate.** | INC 10, week 19 — **9 weeks before go-live** | Two incompatible invoice eras forever, or a backfill of every historical invoice. Go-live in February makes this urgent, not theoretical. |
| **5** | **The patient ledger before advances, credits and commission.** | INC 12, week 22.5 | Advances, credits, statements and commission all read from it. Building them on ad-hoc queries means rewriting all four. |
| **6** | **Commission as an append-only ledger keyed to `Payment`/`Refund`, never recomputed over `Invoice.paid`.** | INC 17, week 31.5 | `paid` is mutable and a refund decreases it. Recompute-on-read pays commission on returned money with no clawback — and the two sources are already read interchangeably at `reports.service.ts:44` and `:46` with nothing asserting they agree. **Ship the reconciliation assertion (INC 12) before the ledger.** |
| **7** | **`source`/override discriminator on the catalogue before shipping any editor.** | INC 9, week 17.5 | `pack-seeding.ts:37-46` overwrites `name`, `category`, `pricePkr` and `durationMin` unconditionally on **every** re-activation. Ship the editor first and the next pack upgrade silently wipes the clinic's prices. Directly binding — the catalogue editor is in Release 1. |
| **11** | **The message log before the first message is sent.** | INC 19, week 33.5 — **with the WhatsApp button, not after** | `whatsapp.service.ts:75-87` today persists nothing: not a `Message` row, not an `AuditLog` row. Its value is retroactive and cannot be backfilled. |
| **12** | **Users before memberships / RBAC screens.** | INC 2, week 3.5 | The membership endpoint has no `userId` to point at until users can be created. Also inverted: **close the escalation (INC 1) before shipping the staff screen (INC 2)**, or you hand an admin a UI whose role dropdown is a self-escalation vector. |
| **14** | **Sign-and-lock before the first real clinical note.** | INC 8, week 15.5 — **12.5 weeks before go-live** | `signedById`/`signedAt` exist on 1 of 94 models (`EyeExam`, `schema.prisma:2355-2356`). Every note written before this ships is permanently unattributable and the record has no medico-legal standing. No retroactive fix exists. |
| **13** | **AuditLog wired with the permission system.** | INC 2, week 3.5 — **modified** | Still binds, but **write explicit service-layer rows, not an interceptor.** An interceptor is cheaper to write and much harder to prove correct, and at this scope only ~8 privileged mutations need auditing. |

### Modified by the partner's clarifications

| # | Trap | Modification |
|---|---|---|
| **2** | *context → nullable columns → app population → backfill → RLS policy → NOT NULL* | **Execute the first four stages only. Stop before the RLS policy and the `NOT NULL` pass.** With exactly one branch there is no sibling branch to hide, and a branch predicate with no explicit `WITH CHECK` reuses `USING` as the insert check, producing scattered 500s in modules nobody touched (`audit-01:63`). Enforce non-null in the auto-stamp extension instead. **Saves ~3 weeks and removes the riskiest change in the plan.** The order of the surviving four stages is still load-bearing. |
| **8** | *Form renderer before form builder* | Automatically respected — the renderer ships (INC 7), the builder is deferred. **But it re-enters through custom fields:** `TenantCustomField` must be its own table, never tenant edits to `NoteTemplate.schema`, because `pack-seeding.ts:63-79` upserts and overwrites `schema` on every activation. A pack version bump would silently destroy every clinic customisation. |

### Released for Release 1 — but re-arm later

| # | Trap | Status |
|---|---|---|
| **9** | *Form engine before specialty pack #2* | Released — no second specialty in Release 1. **Re-arms as a hard gate the day a dental or paediatric customer is signed.** Ophthalmology's true cost was ~1,200 lines across schema, RLS, backend, frontend and four config files; pay that once more and you have paid for the engine twice. |
| **10** | *`IntegrationConnection` before any real WhatsApp credential* | Released for **one** tenant — `whatsapp.service.ts` reading process env is genuinely adequate. **HARD GATE on the second paying integration customer:** the day a real `WHATSAPP_PHONE_NUMBER_ID` is set with two tenants on the box, every clinic sends from one clinic's number — a cross-tenant identity leak and a Meta policy breach on day one. |
| **15** | *Choose the scheduler primitive once, deliberately* | Released — Release 1 has **no** scheduler by design (a manual "Send WhatsApp reminder" button on the day sheet). There is no `@Cron`, `ScheduleModule`, BullMQ or `setInterval` anywhere in `app/backend/src`. **Re-arms the moment anything timed is requested** — appointment reminders, recall campaigns, overdue-invoice dunning. The first such feature pays for the whole substrate, which is why reminders look small and are not. |

### Four new traps this scope introduces

| # | Trap | Where |
|---|---|---|
| **16** | **The appointment transition guard before the lifecycle timestamp columns.** `appointments.service.ts:57-63` writes any status over any status today. Land the columns first and they record contradictory histories — `checkedOutAt` before `checkedInAt`, a cancelled appointment marked complete pulling real stock. | INC 6 |
| **17** | **`Employee.userId` before any commission or payroll-commission work.** The doctor who performs and the person payroll pays are two unlinked populations (`schema.prisma:859-882`). Without the join, commission cannot reach a payslip. | INC 9, before INC 17 and 22 |
| **18** | **The `EXCLUDE` constraint before the calendar and before one-click lead→appointment convert.** A read-then-write overlap check in the service is **not** an acceptable substitute and must not be accepted as one — this is the same TOCTOU shape already fixed twice, for MRNs (`patients.service.ts:41-44`) and lead conversion (`crm.service.ts:14-21`). | INC 6, before INC 20 |
| **19** | **The `@Roles` coverage sweep before the staff screen.** 39 of 207 handlers carry no `@Roles` and `roles.guard.ts:23` returns true when the decorator is absent — including `GET /patients` and `GET /patients/:id`. Creating real staff accounts before the sweep hands a SALES or INVENTORY user the full clinical record. | INC 1, before INC 2 |

---

## SUMMARY FOR THE OWNER

| | |
|---|---|
| **Effort** | 453 loaded developer-days (302 raw bottom-up × 1.5, after removing 16 days of cross-trace double-counting and adding 9 for before/after photos, which the traces missed entirely) |
| **Team** | 2 backend (one senior, owning the critical path and all safety suites) + 1 frontend who can also write NestJS |
| **Start** | Monday 3 August 2026 |
| **Clinic opens its doors and runs its whole day in the product** | **~15 February 2027** — week 28, after increment 15 |
| **Release 1 complete (1A + 1B + 1C)** | **20 May 2027** — week 41.5, including 2 weeks of pilot hardening |
| **Floor at any team size** | ~30 weeks, set by the money-attribution chain, which is single-threaded |
| **First thing on Monday** | `app/backend/src/rbac/roles.guard.ts:38` — make the `PLATFORM_ADMIN` claim require `isPlatformAdmin === true`. Then the DTO allowlist, then the re-check in `switchContext`, then `privilege_escalation_suite.py`. **Do not mark it done until that suite is red against `main`.** Also on Monday, with zero developer time: order the attendance camera and register the Meta app. |

Two commercial notes the numbers hide. First, the clinic trades for **13 weeks** while 1C is still being built — that is real revenue starting in February, not May. Second, the six built-but-orphaned backends (appointments, media/photos, imaging, org-hierarchy, packs, service-catalog writes) are why this is 41 weeks and not 60: increments 6, 7, 11, 15 and 19 are substantially screen work over servers that are already written, guarded, registered and tested. The four zero-caller CRM routes in increment 19 are the single best ratio in the project — four developer-days of pure frontend turns a static lead list into a working follow-up system with no backend work, no migration and no new tables.