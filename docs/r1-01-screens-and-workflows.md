# Release 1 — Screens and Workflows

_Release 1 replan — scoped to one aesthetic clinic, architecture kept universal._

# HEALTH OS — RELEASE 1 SCREENS & WORKFLOWS

**Scope authority:** the partner mandate (1A/1B/1C, single Lahore aesthetic clinic, PKR, WhatsApp, English, one branch). Built by cutting `docs/audit-03-screen-plan.md` (~105 screens) down against the golden-thread traces and re-verified against the live codebase (route decorators, `editions.ts`, `nav.ts`, `App.tsx`, Prisma enums).

**Headline number: 52 screens.** 9 of them already exist in some form (7 UPGRADE + 2 EXISTS-with-fixes); 43 are new. 8 further specialty screens carry forward at zero build cost. That is a 50% cut from the audit backlog, and every screen below is on the Lead → … → Report thread or is a hard prerequisite for it.

**Estimating convention (important — the audit's per-hop `effortDays` blended frontend and backend; these do not).**
- The **Days** column in section A is **frontend only**.
- Backend prerequisites are costed separately in section D.
- Totals: **FE ≈ 158 days** (124.5 screens + 33.5 primitives), **BE ≈ 196 days**. Grand total ≈ **354 developer-days**.
- At **2 backend + 2 frontend**: 1A+1B (the openable product) ≈ **16–18 weeks**; full Release 1 incl. 1C ≈ **24–26 weeks**. At **1 BE + 1 FE** it is ~9 months and worse than the old plan — the cut only pays off with a pair on each side.

---

# A. THE RELEASE 1 SCREEN LIST

Status: **EXISTS** = chain complete and reachable, needs only defect fixes · **UPGRADE** = screen exists but materially deficient · **NEW**.
All endpoints are written in the codebase's actual convention (`@Controller()` roots are flat: `/invoices`, `/encounters`, `/service-catalog`; prefixed controllers are `/crm/*`, `/hr/*`, `/appointments/*`, `/patients/*`, `/org/hierarchy/*`, `/platform/tenants/*`).

## Group 0 — Access & shell (2 screens, 1.5 d)
*Not in the partner's nine groups, but it must be named: `mustChangePassword` has nowhere to land today.*

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 0.1 | Login | `/login` | 1A | EXISTS | Authenticate and, when the token carries `mustChangePassword`, redirect to 0.2 instead of the landing page. | `POST /auth/login` | 0.5 |
| 0.2 | Change password | `/change-password` | 1A | NEW | Force a password change at first login and after an admin reset; bumps `User.tokenVersion` server-side so old tokens die. | `POST /auth/change-password` | 1 |

## Group 1 — Platform Admin (2 screens, 3 d)
*Deliberately minimal. One clinic is onboarded once, by the implementer in the room. No platform dashboard, no organisation portal, no module matrix, no quotas, no subscriptions UI — all deferred.*

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 1.1 | Clinics list | `/admin/tenants` | 1A | UPGRADE | Show the tenant roster with **truthful** patient/user counts (today they are structurally always 0 — `platform-tenants.service.ts:56-59` groups on the base client outside `forTenant`), plus search. No pagination needed at n=1. | `GET /platform/tenants` | 1.5 |
| 1.2 | Onboard clinic dialog | modal on 1.1 | 1A | UPGRADE | Keep the existing flat dialog; add clinic phone/email/address so the auto-created `MAIN` branch row is complete rather than name+code+city. No 6-step wizard, no module toggles, no organisation picker. | `POST /platform/tenants/onboard` | 1.5 |

## Group 2 — Clinic Setup (6 screens, 15.5 d)

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 2.1 | Staff & user accounts | `/admin/staff` | 1A | NEW | Create, edit, deactivate and reset-password the clinic's login accounts and assign role + branch. **This is the single largest blocker in Release 1 — there is no users controller in the backend and no second user can exist today.** Role dropdown must be fed from an `ASSIGNABLE_ROLES` allowlist that excludes `PLATFORM_ADMIN` and `OWNER`. | `GET/POST /users`, `GET/PATCH /users/:id`, `POST /users/:id/deactivate`, `POST /users/:id/reactivate`, `POST /users/:id/reset-password` | 3 |
| 2.2 | Clinic settings (4 tabs) | `/admin/settings` | 1A | NEW | One page, four tabs — **Profile & tax** (legal name, phone, WhatsApp, address, PKR, invoice prefix/footer, NTN/STRN, default tax rate), **Working hours** (7-row grid + holidays), **Rooms** (CRUD table, ~6 rows), **Payment methods** (toggle list over the `PaymentMethod` enum with a `requiresReference` flag). | `GET/PATCH /clinic/profile`, `GET/PUT /clinic/working-hours`, `GET/POST/DELETE /clinic/holidays`, `GET/POST/PATCH/DELETE /clinic/rooms`, `GET/PUT /clinic/payment-methods` | 4 |
| 2.3 | Branches | `/admin/branches` | 1A | NEW | List and edit the single `MAIN` branch created at onboarding. **Create button present but disabled** with "multi-branch available in a later release" — the model must be honest even though the feature is deferred. | `GET /org/hierarchy/summary`, `POST /org/hierarchy/branches`, `PATCH /org/branches/:id` | 1 |
| 2.4 | Service & treatment catalogue | `/admin/services` | 1B | NEW | Let the clinic edit its own prices. Table + editor for code, name, category, `pricePkr`, `durationMin`, `taxRatePct`, `sessionsIncluded`, `defaultCommissionPct`, active. Rows show a PACK/TENANT source badge. | `GET /service-catalog`, `POST /service-catalog`, `GET/PATCH/DELETE /service-catalog/:id` | 3 |
| 2.5 | Custom fields | `/admin/custom-fields` | 1B | NEW | A plain table + add/edit dialog for extra Patient and Encounter fields (key, label, type, options, required, order). **No designer canvas, no drag-and-drop, no conditional visibility** — this is explicitly not the deferred form builder. | `GET/POST/PATCH/DELETE /custom-fields` | 2 |
| 2.6 | Commission rules | `/admin/commissions` | 1C | NEW | Rule list + editor: scope (tenant default / service category / specific doctor), basis (`PCT_NET_COLLECTION`, `PCT_AFTER_CONSUMABLE`), rate in basis points, `effectiveFrom`/`effectiveTo`. Include the worked-example card ("30% on net collection → on PKR 18,333 collected the doctor earns PKR 5,499, the clinic keeps PKR 12,834"). | `GET/POST /commissions/rules`, `PATCH /commissions/rules/:id` | 2.5 |

## Group 3 — Front Desk (7 screens, 17 d)

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 3.1 | Appointment calendar | `/appointments` | 1B | NEW | Day view with provider columns and a week view, colour by `AppointmentStatus`, now-line, click-empty-slot-to-book. **The single biggest missing screen in Release 1** — `/appointments` appears nowhere in `app/web/src` today. | `GET /appointments?from&to&providerId&roomId&status`, `GET /users?roles=DOCTOR,TREATMENT`, `GET /clinic/rooms` | 5 |
| 3.2 | Book / edit appointment dialog | modal | 1B | NEW | Patient search, provider, room, service, start, duration, source; surfaces the 409 from the Postgres `EXCLUDE` constraint as an inline "Dr X is already booked at 15:00" warning rather than a toast. | `POST /appointments`, `PATCH /appointments/:id`, `GET /patients?q=`, `GET /service-catalog` | 2 |
| 3.3 | Appointment detail drawer | drawer | 1B | NEW | Status actions (check-in, start, complete, cancel-with-reason, no-show), reschedule, and the status history from `AppointmentStatusEvent`. Illegal transitions are not rendered as buttons. | `GET /appointments/:id`, `PATCH /appointments/:id/{check-in,start,complete,cancel,no-show}` | 2 |
| 3.4 | Day sheet | `/appointments/day` | 1B | NEW | Today's list in arrival order with one-tap check-in, a "Send WhatsApp reminder" action per row, and a walk-in button. | `GET /appointments/day-sheet?date&providerId`, `POST /appointments/walk-in`, `POST /integrations/whatsapp/messages` | 2 |
| 3.5 | Patient queue board | `/queue` | 1B | NEW | Waiting / In room / Done columns ordered by `checkedInAt` with wait times, per-doctor filter, one-tap call and complete. **Derived from Appointment — no separate queue table.** | `GET /appointments/day-sheet`, `PATCH /appointments/:id/{start,complete}` | 2.5 |
| 3.6 | Patient list & search | `/patients` | 1B | UPGRADE | Server-driven search over name/MRN/phone/CNIC with pagination. Today the whole PHI roster ships to the browser and is filtered client-side (`PatientsPage.tsx:88-98`). | `GET /patients?q=&take=&cursor=` | 1.5 |
| 3.7 | Register / edit patient dialog | modal | 1B | UPGRADE | Full demographics (WhatsApp, CNIC, address, emergency contact, blood group, referral source, marketing consent, clinic custom fields) and — new — an **edit** path. `PATCH /patients/:id` exists today with zero consumers, so a registration typo is currently permanent. | `POST /patients`, `PATCH /patients/:id`, `GET /custom-fields?entity=PATIENT` | 2 |

## Group 4 — Clinical (10 screens, 31 d)

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 4.1 | Patient record 360 | `/patients/:id` | 1B | UPGRADE | Fix the six dead field names (`startedAt`→`occurredAt`, `issuedAt/invoiceNumber/totalPkr`→`createdAt/number/total`, `o.createdAt`→`orderedAt`, `administeredAt/doseNumber`→`givenAt/dose`), **hide** sections the DERMATOLOGY edition does not buy instead of rendering three permanent blue notices, and add tabs: Visits, Plans, Invoices & ledger, Photos, Prescriptions. Allergy banner in the header. | `GET /patients/:id`, `GET /patients/:id/encounters`, `/treatment-plans`, `/invoices`, `/photo-sessions`, `/prescriptions`, `/allergies`, `/ledger` | 4 |
| 4.2 | Consultation workspace | `/consultation/:encounterId` | 1B | NEW | Patient header + allergy banner; chief complaint / assessment / diagnosis / follow-up date as **first-class controls**; pack intake groups and note sections rendered by the generic form renderer; order-set picker; prescription block; save-and-close; sign-and-lock. | `POST /encounters`, `POST /intake-submissions`, `POST /note-instances`, `PATCH /encounters/:id/status`, `PATCH /encounters/:id/sign`, `GET /intake-groups?packKey=`, `GET /note-templates?packKey=`, `GET /order-sets?packKey=` | 4 |
| 4.3 | Encounter timeline + note viewer | tab on 4.1 | 1B | NEW | Expandable per-visit timeline rendering each note against the template that produced it (read-only mode of the same renderer), plus amendment history. | `GET /patients/:id/encounters`, `/note-instances`, `/intake-submissions` | 2 |
| 4.4 | Prescription block + printable Rx | inline on 4.2 + tab on 4.1 | 1B | NEW | Repeatable lines (drug, strength, frequency, duration, instructions), browser-print Rx on clinic letterhead. **Note: today the only prescription path is `POST /dose/commit` behind `dosing.core`, which this edition does not grant — a Lahore aesthetic doctor can neither write nor read a prescription.** | `POST /prescriptions`, `GET /patients/:id/prescriptions` (both must be re-exposed under `emr.core`) | 2.5 |
| 4.5 | Allergies & medications | header + section on 4.1 | 1B | NEW | Structured allergy and current-medication lists with an always-visible red banner. Not optional for a clinic injecting botox and running lasers — today allergies survive only as a text key inside one pack's intake JSON that nothing reads back. | `GET/POST/PATCH /patients/:id/allergies`, `.../medications` | 2 |
| 4.6 | Treatment plan builder | `/patients/:id/plans/new` | 1B | NEW | Catalogue-driven line picker, sessions per line, package price, plan-level discount, running total, save as `PROPOSED`, printable quote. **Today no React route touches treatment plans at all** — the only producer is the legacy static `aesthetic-workspace.html`. | `GET /service-catalog`, `POST /treatment-plans` | 5 |
| 4.7 | Plan list + detail | tab on 4.1 | 1B | NEW | Plans with status, session progress ("3 of 6 done"), printable quote, and a **Convert to invoice** action that finally gives `POST /invoices {planId}` its first caller in the repository. | `GET /patients/:id/treatment-plans`, `POST /invoices {planId}`, `PATCH /treatment-plans/:id/status` | 2 |
| 4.8 | Before/after photo gallery | tab on 4.1 | 1B | NEW | Consent gate, capture/upload with pose+date metadata, side-by-side and slider compare. **The backend is complete and has zero UI callers** — `media.controller.ts:50-103`, and `media.core` is already granted to DERMATOLOGY via `CLINIC_ADDONS`. Headline aesthetic feature, cheapest clinical win. | `POST /consent`, `GET /patients/:id/consent`, `POST /photo-sessions`, `GET /patients/:id/photo-sessions`, `POST /photo-sessions/:id/photos`, `GET /photos/:assetId/raw` | 3.5 |
| 4.9 | Session board | `/sessions` | 1B | NEW | Today's treatment sessions grouped by room: Scheduled / In progress / Done, with start and complete actions and the performing staff member. | `GET /sessions?date&status&roomId`, `PATCH /sessions/:id/{start,complete,cancel}` | 3 |
| 4.10 | Session detail drawer | drawer | 1B | NEW | Start/complete, performed-by and assisted-by, notes, and the **consumables panel** — pre-filled from the service's bill of materials, editable, showing running consumable cost. | `GET /sessions/:id`, `POST /inventory/issues`, `GET /service-catalog/:id/consumables` | 3 |

**Carried forward at zero build cost (entitled to this clinic, already reachable, regression-test only):** `/grading` severity grading (PASI/EASI/SCORAD), `/phototherapy`, `/trends`. **Carried forward but NOT entitled to DERMATOLOGY and therefore invisible to this customer — do not demo them:** `/dental`, `/growth`, `/dose`, `/anc`, `/partogram`, `/lab`, `/ipd`, `/ophthalmology`, `/rehab`, `/immunization`.

## Group 5 — Billing (6 screens, 13.5 d)

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 5.1 | Billing workspace | `/billing` | 1B | UPGRADE | Fix four defects that silently corrupt the ledger: refund method is hardcoded `CASH` (`BillingPage.tsx:604`), void sends **no body** so `voidReason` is always NULL (`:668`), payments send no reference so the idempotency guard never runs (`:505-508`), and lines mint synthetic `SVC-n` codes matching no catalogue row (`:319`). Then add: catalogue picker, performer selector, discount dialog with reason, subtotal/discount/tax/total breakdown. Delete the "Simulate gateway pay" button; hide "File with FBR". | `POST /invoices`, `GET /patients/:patientId/invoices`, `GET /invoices/:id`, `POST /invoices/:id/payments`, `POST /invoices/:id/refunds`, `PATCH /invoices/:id/void`, `POST /invoices/:id/discount` | 3 |
| 5.2 | Invoice register | `/billing/invoices` | 1B | NEW | Clinic-wide filterable invoice list (status, date range, patient). Today the controller exposes only per-patient list and get-by-id, so "who owes us money" has no data path. | `GET /invoices?from&to&status&q` | 2 |
| 5.3 | Printable invoice / receipt | print view | 1B | NEW | Browser-print document on clinic letterhead with NTN, line breakdown, tax, payments, balance. **No print or PDF generation exists anywhere in the product.** No PDF service — a `@media print` stylesheet. | `GET /invoices/:id`, `GET /clinic/profile` | 2 |
| 5.4 | Advance payment & apply-credit dialog | modal | 1B | NEW | Take a deposit against the patient account before any invoice exists, and apply credit at settlement. **Structurally impossible today** — `Payment.invoiceId` is NOT NULL and `applyPayment` 400s any overpayment. An aesthetic clinic selling six-session laser packages cannot operate without this. | `POST /patients/:id/advance-payments`, `POST /invoices/:id/apply-credit`, `GET /patients/:id/credits` | 1.5 |
| 5.5 | Patient ledger & statement | tab on 4.1 + print | 1B | NEW | Running balance and a printable statement over a date range. Replaces today's client-side sum over one patient's open invoices. | `GET /patients/:id/ledger`, `GET /patients/:id/balance`, `GET /patients/:id/statement?from&to` | 2.5 |
| 5.6 | Day book / receivables | `/billing/daybook` | 1B | NEW | "What did we take today" by payment method (net of refunds by method), and outstanding-by-patient. This is the reception day-close screen. | `GET /payments?from&to`, `GET /invoices?status=UNPAID,PARTIAL` | 2.5 |

## Group 6 — Inventory (6 screens, 10.5 d)
*Entitlement blocker: consumables ride on the `pharmacy.core`-gated controller, which **DERMATOLOGY does not grant**. Release 1 introduces a new `inventory.core` key in `CLINIC_ADDONS` and a new `/inventory/*` controller; `pharmacy.core` stays as retail POS and stays off for this clinic.*

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 6.1 | Item master | `/inventory/items` | 1B | NEW | Create and edit consumables — Botox 100u vial, HA filler 1 ml, PRP kit, numbing cream, microneedling cartridge, cannulas, gauze — with unit, cost, sell price, reorder level, expiry-warn days. **Today the item catalogue is an 8-row hardcoded TypeScript array compiled into the binary (`formulary.ts:13-22`); a filler syringe cannot be stocked at any price.** | `GET/POST /inventory/items`, `PATCH /inventory/items/:id` | 3 |
| 6.2 | Stock on hand | `/inventory` | 1B | UPGRADE | Rebuild the stock tab of `PharmacyPage`: list **every** stocked item including zero-stock ones (`pharmacy.service.ts:58` filters `quantityOnHand > 0`, so a sold-out item vanishes from the screen), show in-date lots with batch and expiry, and an alerts panel (below reorder / expiring 30-60-90 / expired). | `GET /inventory/stock`, `GET /inventory/alerts` | 2.5 |
| 6.3 | Receive stock dialog | modal | 1B | UPGRADE | Receive against an item from the master rather than the compiled formulary; supplier name as free text, batch, expiry, quantity, unit cost. | `POST /inventory/receipts` | 1 |
| 6.4 | Item ledger | `/inventory/items/:id` | 1B | NEW | Immutable movement history answering "why is this 43 and not 50". Today `quantityOnHand` is mutated in place with no `updatedAt` and the question is unanswerable from day one. | `GET /inventory/items/:id/ledger`, `GET /inventory/movements?itemId&from&to` | 1.5 |
| 6.5 | Write-off / expiry pull | `/inventory/write-offs` | 1B | NEW | Turn today's advisory expired list (`PharmacyPage.tsx:233-245`) into a "write off these units" action with reason and actor. Expired units currently sit in `quantityOnHand` forever. | `POST /inventory/write-offs`, `POST /inventory/batches/:id/discard` | 1.5 |
| 6.6 | Service consumables (BOM) | tab on 2.4 | 1B | NEW | Default consumables per service, so the nurse only overrides. This is what makes the cost data actually get captured under time pressure rather than skipped. | `GET/POST /service-catalog/:id/consumables` | 1 |

## Group 7 — CRM (5 screens, 11.5 d)

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 7.1 | Lead pipeline board | `/leads` | 1C | UPGRADE | Flat table → stage columns (New, Contacted, Qualified, Follow-up, Appointment booked, Converted, Lost) with a "Move to" menu (no drag — 1.5 d cheaper and exactly as correct). Owner column, source **dropdown** replacing the free-text field at `CrmPage.tsx:165`, marketing-consent checkbox, mark-lost dialog with a required reason. | `GET /crm/leads`, `POST /crm/leads`, `PATCH /crm/leads/:id/status`, `POST /crm/leads/:id/assign`, `POST /crm/leads/:id/lost`, `GET /crm/funnel` | 3 |
| 7.2 | Lead detail drawer | drawer | 1C | NEW | Overview, log a call/WhatsApp/note, schedule a follow-up, activity timeline, message history, convert action. **Pure frontend — `GET /crm/leads/:id`, `POST /crm/leads/:id/activities` and `PATCH /crm/leads/:id/activities/:activityId/done` are built, guarded, registered and have zero callers.** | as above + `POST /integrations/whatsapp/messages` | 2.5 |
| 7.3 | Follow-up worklist | `/leads/followups` | 1C | NEW | Overdue / Today / Upcoming, one-tap Done, snooze, "mine" filter. `GET /crm/followups` exists with no caller. | `GET /crm/followups`, `PATCH /crm/leads/:id/activities/:activityId/done` | 1.5 |
| 7.4 | Convert to patient + appointment | modal | 1C | NEW | The hop's acceptance criterion: confirm demographics, pick a slot, and create Patient **and** Appointment inside the transaction that already holds the `FOR UPDATE` lock — carrying source and salesperson onto the Patient, which `crm.service.ts:137-139` currently discards at exactly the moment attribution becomes financially load-bearing. | `POST /crm/leads/:id/convert` (extended with `{providerId,start,end,serviceCatalogItemId,roomId}`) | 2.5 |
| 7.5 | Integrations & webhook log | `/integrations` | 1C | UPGRADE | Connection status, last-received timestamp, webhook event log with replay, outbound message log. | `GET /integrations/status`, `GET /integrations/webhook-events`, `POST /integrations/webhook-events/:id/replay` | 2 |

## Group 8 — Workforce (5 screens, 13 d)
*Entitlement blocker: `hr.core` is bundled only into HOSPITAL and ENTERPRISE (`editions.ts:143,145`). The entire payroll module — ~630 lines of careful, tested code — is commercially invisible to the customer it is being built for. **Adding `hr.core` to `CLINIC_ADDONS` is half a day and is the cheapest win in Release 1.***

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 8.1 | Staff & employment records | `/hr/staff` | 1C | NEW | Employee profile (CNIC, salary, join date, status) and the **Employee ↔ User link**, without which the doctor who treats and the person payroll pays are two unlinked populations. `POST /hr/employees` and `PATCH /hr/employees/:id/status` exist today with no UI caller — employees can only enter the system via `demo-seed.ts`. | `GET/POST /hr/employees`, `PATCH /hr/employees/:id`, `PATCH /hr/employees/:id/status` | 3 |
| 8.2 | Attendance sheet | `/hr/attendance` | 1C | NEW | Month grid per employee with first-in / last-out / minutes worked / status, manual punch, and a supervisor correction that is audit-logged. Manual punch is **required, not optional** — the camera will be down. | `GET /attendance/days?from&to&employeeId`, `POST /attendance/punch`, `PATCH /attendance/days/:id` | 3 |
| 8.3 | Payroll runs | `/payroll` | 1C | UPGRADE | Keep the existing draft/finalize/discard discipline and stale-slip warning; add the period filter, the deduction **reason** field the DTO already validates and nothing persists, the commission sweep line, and absence deductions from 8.2. | `POST /hr/payroll/runs`, `GET /hr/payroll/runs`, `GET /hr/payroll/runs/:id`, `PATCH /hr/payroll/runs/:id/finalize`, `DELETE /hr/payroll/runs/:id` | 3 |
| 8.4 | Printable payslip | print view | 1C | NEW | Per-employee payslip with components line by line (basic, commission, absence deduction, advance, net) — print stylesheet, no PDF service. | `GET /hr/payroll/payslips/:id` | 1.5 |
| 8.5 | My earnings | `/me/earnings` | 1C | NEW | A doctor or salesperson sees their own accrued and paid commission, line by line with invoice number, service and date. **Scoped to self at the service layer, not the UI** — a DOCTOR must not read a colleague's statement by changing an id. | `GET /commissions/me?from&to` | 2.5 |

## Group 9 — Dashboards (3 screens, 8 d)

| # | Screen | Route | Slice | Status | Must do | Endpoints | Days |
|---|---|---|---|---|---|---|---|
| 9.1 | Today landing (role-shaped) | `/` | 1A → 1C | UPGRADE | **Fix first, before anything else: the index route renders a red 403 alert for 5 of 8 roles** (`App.tsx:42` → `reports.controller.ts:11-13`). Replace with a role-shaped endpoint — reception sees arrivals, queue and unpaid-at-desk; doctor sees their schedule and own accrued share; owner/finance sees collections, outstanding, appointments, patients seen, doctor share and clinic share for **today**. Also hoist the conditional `useApi` call above the platform-admin early return (`DashboardPage.tsx:27-28`). | `GET /dashboard/today` | 3 |
| 9.2 | Reports centre | `/reports` | 1B → 1C | UPGRADE | Add a date-range bar (Today / 7d / MTD / Custom) — **both report endpoints accept zero query parameters today and every number in the product is inception-to-date**. Reconcile the two contradictions first: payments on VOID invoices are counted while VOID invoices are excluded, and refunds are subtracted as one scalar so a cash refund never reduces the CASH line. Then add revenue-by-service and revenue-by-doctor panels. | `GET /reports/summary?from&to`, `GET /reports/revenue?from&to`, `GET /reports/revenue/by-service`, `GET /reports/revenue/by-doctor` | 3 |
| 9.3 | Commission & revenue-share report | `/reports/revenue-share` | 1C | NEW | Clinic share vs doctor share over a period, per doctor, drilling to the earnings lines that make it up. | `GET /reports/revenue-share?from&to`, `GET /commissions/earnings?from&to&payeeUserId` | 2 |

### Screen totals

| Group | Screens | FE days |
|---|---|---|
| 0 Access & shell | 2 | 1.5 |
| 1 Platform Admin | 2 | 3 |
| 2 Clinic Setup | 6 | 15.5 |
| 3 Front Desk | 7 | 17 |
| 4 Clinical | 10 | 31 |
| 5 Billing | 6 | 13.5 |
| 6 Inventory | 6 | 10.5 |
| 7 CRM | 5 | 11.5 |
| 8 Workforce | 5 | 13 |
| 9 Dashboards | 3 | 8 |
| **Total** | **52** | **124.5** |

By slice: **1A = 12 screens**, **1B = 27 screens**, **1C = 13 screens**.

---

# B. SHARED UI PRIMITIVES

18 primitives, **33.5 days**. Build before the screens they back — but note that only P1–P6 are true blockers; the rest can land just-in-time.

| # | Primitive | Days | What it must do | Backs |
|---|---|---|---|---|
| U1 | **`<PackFormRenderer>`** | 3 | Renders and collects all seven manifest field types (`manifest.types.ts:11-18`: text, textarea, number, select, multiselect, boolean, date) plus required marks, help text, units, dirty tracking, per-field errors, and a **read-only viewer mode**. A working reference implementation exists at `aesthetic-workspace.html:140-166`; port it, do not redesign it. Verify in the vitest jsdom harness, **not the browser** — MUI Select cannot be driven by browser automation. | 4.2, 4.3, 3.7, 2.5 — **the single highest-leverage primitive; one component unblocks the consultation, custom fields and every future pack** |
| U2 | **`<EntityTable>`** | 4 | Column defs, server-driven pagination/sort/search, filter chips, row actions, sticky header, four states (loading / empty / gated / failed). Zero pagination exists anywhere in the product today. | ~20 screens |
| U3 | **`useApi` v2** | 2 | Add mutations (POST/PATCH/DELETE), manual cache invalidation, and refetch to the current 119-line GET-only hook. **Deliberately not TanStack Query** — adopting a query layer mid-Release-1 is a schedule risk, and no Release 1 screen needs more than 4 concurrent reads. | everything |
| U4 | **Nav model v2 + gates** | 2.5 | `roles?: UserRole[]` on `NavItem`; `filterNav(groups, entitlements, role)` requiring **both** predicates — today it filters on entitlement only and never on role, so a DOCTOR is shown Reports, Payroll and Billing and 403s on all three. Plus `useEntitlement()`, `useRole()`, `<Gate>` and route-level gating (routes are currently ungated; a typed URL renders an empty page that then 403s). Ship `AppShell.test.tsx` asserting the visible item set for each of the 8 roles. | shell |
| U5 | **Error/state taxonomy** | 1.5 | Distinguish 403-role from 403-entitlement — `FetchErrorBanner.tsx:21-35` currently tells a doctor denied by role that their clinic has not paid. Requires the backend to tag `ForbiddenException` with `ROLE_REQUIRED` / `ENTITLEMENT_REQUIRED`. Also: an entitlements fetch failure must be an **error state, not `[]`** (`AuthContext.tsx:55-62` swallows it, then persists `[]` to localStorage, permanently emptying the sidebar). Generalise `RecordSection.tsx:38-106`, which already models the four states correctly. | everything |
| U6 | **`<CalendarGrid>`** | 5 | Day and week, provider (or room) resource columns, colour-by-status, now-line, click-empty-slot, conflict highlight. **No calendar of any kind exists** — `grep -ri calendar app/web/src` returns nothing. No drag-to-move, no month view. | 3.1 |
| U7 | **`<AsyncAutocomplete>`** | 2 | Debounced server-side lookup for patient / provider / service / inventory item. Eleven pages currently pull the entire patient roster into a dropdown. Retire those **only on the screens Release 1 touches**; the full sweep is Release 1.5. | 3.2, 3.7, 4.6, 5.1, 4.10 |
| U8 | **`<PrintableDocument>`** | 2 | `@media print` shell with clinic letterhead, NTN, footer, page breaks. **No print or PDF generation exists anywhere.** No PDF service in Release 1. | 5.3, 5.5, 4.4, 4.7, 8.4 |
| U9 | **`<DetailDrawer>`** | 1.5 | Right-side drawer with tabs, deep-linkable (`?drawer=lead:123`). Avoids five near-identical detail pages. | 3.3, 4.10, 7.2 |
| U10 | **`<ConfirmDialog>` with reason capture** | 1 | Typed confirm + **mandatory** reason field. Directly fixes the void-with-no-body defect at `BillingPage.tsx:668`. | 5.1, 3.3, 6.5, 7.1, 8.3 |
| U11 | **Money primitives** | 1 | `formatPkr()`, `<MoneyField>` with an int4 ceiling guard (`MAX_INT4` is enforced at `billing.service.ts:18` — the UI must not allow a value that will 400), and commission rounding display in basis points. | 5.x, 4.6, 2.4, 2.6 |
| U12 | **`<PhotoCompare>` + uploader** | 2.5 | Before/after slider, side-by-side, pose/date metadata, multipart upload with progress. Note `media.controller.ts:95-99` takes base64 in JSON today — the component needs a multipart path alongside. | 4.8 |
| U13 | **`<DateRangeBar>`** | 1.5 | Today / 7d / MTD / Custom presets with URL-synced state so a filtered report is linkable. **No branch selector** — one branch. | 9.1, 9.2, 9.3, 5.6, 6.4 |
| U14 | **`<StatusChip>`** | 0.5 | One central status→colour/label map for `AppointmentStatus`, `InvoiceStatus`, `LeadStatus`, `TreatmentPlanStatus`, `EmployeeStatus`, session status. Prevents a dozen divergent colour choices. | ~15 screens |
| U15 | **`<Timeline>`** | 1 | Encounter history, lead activity, status-change history, stock movements. | 4.3, 7.2, 3.3, 6.4 |
| U16 | **`<StatCard>`** | 1 | Value + label + icon + loading skeleton + click-through. Delta chips only where a comparison period actually exists. | 9.1, 9.2, 5.6 |
| U17 | **`<MiniChart>`** | 1.5 | ~120 lines of hand-rolled SVG: horizontal bar, donut, funnel. **Explicitly no charting library** — Release 1 needs three chart shapes, and adopting a library is a dependency decision that should be made in Release 2 with the full report set in view. Accessible (labels, not colour-only) and printable. | 9.1, 9.2, 9.3, 7.1 |
| U18 | **`<PageHeader>`** | 0.5 | Title, breadcrumb, primary/secondary actions. Consistency across 52 screens. | all |

**Deliberately NOT built in Release 1:** `<WizardShell>` (registration is a dialog, the plan builder is a page), `<SetupChecklist>` with completion ring (decoration for a customer whose setup is done by the implementer in the room), `<ModuleToggleGrid>`, `<SignaturePad>` (sign-and-lock is a typed confirm plus a server-stamped `signedById`/`signedAt`, not a drawn signature), `<KanbanBoard>` with drag (stage columns plus a "Move to" menu), a charting library, TanStack Query, responsive `AppShell` v2 (fix the fixed 248 px drawer only if the clinic actually works on tablets — ask before spending 2 days).

---

# C. THE WORKFLOWS

Notation: **[S]** screen · **→** API call · **⇒** state transition · **⚠** a guard that must exist before the step is shippable.

---

## W1 — Lead capture → assignment → follow-up → convert to appointment

1. **Capture.** [S 7.1 `/leads`] Sales clicks *New lead*. Fields: name, phone, **source dropdown** (Walk-in, Referral, Facebook, Instagram, WhatsApp, Phone), interest (service picker), marketing-consent checkbox, notes.
   → `POST /crm/leads` ⇒ `Lead.status = NEW`. Server stamps `organizationId/clinicId/branchId` from `TenantCtx`.
   *Automated capture (Meta Lead Ads / website form) writes the same row via `POST /public/forms/:formKey` → `WebhookEvent` → `Lead` with `channel` and `externalLeadId`.* ⚠ `@@unique([source, externalEventId])` is mandatory — Meta retries for ~36 h and without it one ad lead becomes many.
2. **Assign.** [S 7.1] Owner selects rows → *Assign to*. → `POST /crm/leads/:id/assign {userId}` ⇒ writes `assignedToId`, `assignedById`, `assignedAt`.
   ⚠ `assignedToId` is a bare uuid with no FK today (`schema.prisma:1003`) — the `@relation` to User must land first or a cross-tenant uuid is accepted.
   Sales filters the board to *My leads* (a filter tab — **not** row-level enforcement, which is deferred).
3. **Contact.** [S 7.2 lead drawer] *Log activity* → type CALL / WHATSAPP / NOTE, direction IN/OUT, outcome, body.
   → `POST /crm/leads/:id/activities` (zero callers today). Sales sets status → `POST/PATCH /crm/leads/:id/status` ⇒ `NEW → CONTACTED`.
   *Send WhatsApp:* → `POST /integrations/whatsapp/messages` (zero callers anywhere in the repo) → writes a `Message` row. ⚠ `SALES` is excluded from `FRONT_DESK_ROLES` (`role-groups.ts:20-25`) and 403s on this route today.
4. **Schedule follow-up.** [S 7.2] *Schedule follow-up* with a due date → `POST /crm/leads/:id/activities {dueAt}`; denormalised onto `Lead.nextFollowUpAt` (indexed) ⇒ `CONTACTED → FOLLOW_UP`.
5. **Work the list.** [S 7.3 `/leads/followups`] → `GET /crm/followups` (zero callers today) grouped Overdue / Today / Upcoming. *Done* → `PATCH /crm/leads/:id/activities/:activityId/done`.
6. **Qualify.** ⇒ `FOLLOW_UP → QUALIFIED`.
7. **Convert.** [S 7.4] Confirm demographics; pick a slot from the calendar's availability.
   → `POST /crm/leads/:id/convert {providerId, start, end, serviceCatalogItemId, roomId}`.
   Inside the **existing** `FOR UPDATE` transaction (`crm.service.ts:124-146` — keep the advisory-lock MRN scheme unchanged): create `Patient` **carrying source, interest, `assignedToId` as salesperson-of-record and `marketingOptIn`**; create `Appointment`; set `convertedPatientId`, `appointmentId`, `convertedAt` ⇒ `QUALIFIED → APPOINTMENT_BOOKED`, then `→ CONVERTED`.
   ⚠ The `EXCLUDE` constraint (W2 step 2) must exist first, or conversion can create a double-booking.
   ⚠ `PATCH /crm/leads/:id/status` must **refuse `CONVERTED` entirely** — setting it via that route leaves `convertedPatientId` NULL and bricks the lead permanently (`crm.service.ts:132-134` then rejects the real convert forever).
8. **Lose.** → `POST /crm/leads/:id/lost {reason}` (required free text) ⇒ `→ LOST`. Terminal.

**Legal transitions:** `NEW → CONTACTED → QUALIFIED → FOLLOW_UP ↔ QUALIFIED → APPOINTMENT_BOOKED → CONVERTED`; any non-terminal `→ LOST`. `CONVERTED` reachable **only** from `convert()`.

---

## W2 — Appointment booking → reminder → check-in → queue → in progress → complete

1. **Open the calendar.** [S 3.1 `/appointments`] → `GET /appointments?from&to&providerId&status`.
   ⚠ Today this returns **every appointment ever booked**, unfiltered and unpaginated, with the full patient row joined, against `@@index([tenantId])` only. Add the filters, cap the page, trim the join to `{id,mrn,name,phone}`, and add `@@index([tenantId, start])` and `@@index([tenantId, providerId, start])` **before** the screen is written.
2. **Book.** [S 3.2] Click an empty slot → dialog prefilled with provider and time. Patient via `<AsyncAutocomplete>` (`GET /patients?q=`), service from `GET /service-catalog` (drives default duration), room from `GET /clinic/rooms`, source (`WALK_IN | PHONE | WHATSAPP | REFERRAL | ONLINE | LEAD`).
   → `POST /appointments` ⇒ `AppointmentStatus = BOOKED`.
   ⚠ Three guards must land first: (a) `ensurePatient`/`ensureProvider` **inside the RLS transaction** — every other module does this (`emr.service.ts:257-260`) and appointments simply does not, and Postgres FK checks bypass RLS so the FK proves existence *somewhere*, not membership in this tenant; (b) `start < end` plus a max duration; (c) a Postgres **`EXCLUDE` constraint** using `tstzrange` over `(providerId, [start,end))` filtered to non-cancelled statuses. **A read-then-write overlap check in the service is not an acceptable fix and must not be accepted as one** — this codebase has already been bitten by that exact TOCTOU shape twice.
3. **Confirm / remind.** [S 3.4 `/appointments/day`] *Send WhatsApp reminder* on a row → `POST /integrations/whatsapp/messages` with name/time/service prefilled → writes a `Message` row. ⇒ optionally `BOOKED → CONFIRMED`.
   **Deliberately manual, not scheduled.** There is no scheduler primitive of any kind in the backend (no `@Cron`, no `ScheduleModule`, no BullMQ, no `setInterval`, none of those packages in `package.json`), so the first timed reminder pays for the entire substrate. A button gets most of the value for one clinic at about a sixth of the cost.
4. **Check in.** [S 3.4 or 3.1] *Check in* → `PATCH /appointments/:id/check-in` ⇒ `BOOKED|CONFIRMED → CHECKED_IN`, writes `checkedInAt`, assigns `tokenNumber`, writes an `AppointmentStatusEvent`.
   *Walk-in:* → `POST /appointments/walk-in` creates patient-or-existing + appointment (`source=WALK_IN`, `start=now`) + check-in in **one** transaction.
5. **Queue.** [S 3.5 `/queue`] → `GET /appointments/day-sheet?date&providerId`. Waiting column ordered by `checkedInAt` with live wait times.
6. **Call in.** *Start* → `PATCH /appointments/:id/start` ⇒ `CHECKED_IN → IN_PROGRESS`, writes `startedAt`. Card moves to *In room*. This is the handoff to W4 (consultation) or W7 (session).
7. **Complete.** → `PATCH /appointments/:id/complete` ⇒ `IN_PROGRESS → COMPLETED`, writes `completedAt`. Terminal.
8. **Cancel / no-show.** → `PATCH /appointments/:id/cancel {reason}` (reason **required**) or `.../no-show {reason}` ⇒ terminal, with actor and timestamp.
9. **Reschedule.** [S 3.3] → `PATCH /appointments/:id {start,end,providerId,roomId,reason}` — writes `rescheduledFromId` and a status event. **There is no route that can change an appointment's time today, only its status.**

**Legal transitions (`APPOINTMENT_TRANSITIONS`, modelled on `PLAN_TRANSITIONS` at `emr.service.ts:228-233`):**
`BOOKED → CONFIRMED | CHECKED_IN | CANCELLED | NO_SHOW` · `CONFIRMED → CHECKED_IN | CANCELLED | NO_SHOW` · `CHECKED_IN → IN_PROGRESS | NO_SHOW | CANCELLED` · `IN_PROGRESS → COMPLETED | CANCELLED` · `COMPLETED`, `CANCELLED`, `NO_SHOW` are **terminal**.
⚠ Today `appointments.service.ts:57-63` writes whatever arrives: `COMPLETED → BOOKED`, `CANCELLED → IN_PROGRESS` and `NO_SHOW → CHECKED_IN` all succeed. **The guard must land before the lifecycle timestamp columns**, or the columns record contradictory histories (`checkedOutAt` before `checkedInAt`).

---

## W3 — New patient registration and matching an existing patient

1. **Search first, always.** [S 3.6 `/patients`] Reception types a phone number or name → `GET /patients?q=&take=20`. The registration dialog is reachable **only** from a search that returned nothing, so "new patient" is never the first action.
2. **Match.** Results show MRN, name, phone, DOB, last visit. Click → [S 4.1] `/patients/:id`. Done.
3. **Register.** [S 3.7] *Register new patient*: name, phone, **WhatsApp number**, DOB, gender, CNIC, address, city, emergency contact (name/phone/relation), blood group, referral source, marketing consent, plus the clinic's own fields from `GET /custom-fields?entity=PATIENT`.
   → `POST /patients` ⇒ MRN minted under a per-tenant advisory lock from `MAX(P-nnnnn)` (`patients.service.ts:41-59` — keep this, it is correct).
4. **Duplicate defence.** Two database constraints, no fuzzy matching in Release 1: `@@unique([tenantId, mrn])` (exists, and its 409 is already translated into a receptionist-readable message at `patients.service.ts:88-113`) and a new **partial unique index on `(tenantId, identificationNumber)`** so one CNIC cannot open two charts. A 409 on CNIC renders as "This CNIC is already registered as MRN P-00142 — open that chart?" with a link.
5. **Correct a mistake.** [S 3.7, edit mode from the 4.1 header] → `PATCH /patients/:id`. **This route exists today with zero consumers on any screen**, so a typed phone number or DOB — which drives age-based clinical rules — is currently permanent.
6. **From a lead.** W1 step 7 creates the Patient directly; reception never retypes. The lead's source and salesperson ride along.
7. **Merge.** Deferred. The two unique indexes prevent the common case; merge is Release 1.5.

---

## W4 — Consultation: open encounter → assessment → diagnosis → notes → prescription → sign and lock

1. **Enter.** From [S 3.5 `/queue`] *Start* (which fires W2 step 6) or [S 4.1] *Start consultation*.
   → `POST /encounters {patientId, appointmentId, providerId, packKey, reason}` ⇒ `EncounterStatus = OPEN`. Navigate to [S 4.2] `/consultation/:encounterId`.
2. **Header.** Patient identity, age, MRN, **red allergy banner** from `GET /patients/:id/allergies`, and the appointment's service. Always visible, never scrolled away.
3. **Intake.** `GET /intake-groups?packKey=aesthetic` → rendered by `<PackFormRenderer>`. The derma/aesthetic groups already exist as seeded tenant rows on every onboarding (`aesthetic.manifest.ts:21-68`, `dermatology.manifest.ts:15-30`, seeded at `platform-tenants.service.ts:310-339`) — **no authoring work, the React app has simply never called the endpoint.**
   → `POST /intake-submissions {encounterId, patientId, groupKey, data}`.
4. **Assessment & diagnosis.** First-class controls, **not** keys inside a JSON blob: chief complaint, examination, assessment, `diagnosisText`, optional `diagnosisCode` (free text plus a nullable code — **no ICD-10 picker**), `followUpDate`.
   ⚠ These must become **Encounter columns**. Today `Encounter` (`schema.prisma:1574-1595`) is an envelope with no clinical content and there is no `followUpDate` anywhere in the schema, so "how many acne patients last month" and "who is due for follow-up" are both unanswerable and no report or reminder can ever read them. Index `(tenantId, followUpDate)`.
5. **Note.** `GET /note-templates?packKey=` → rendered by the same component. Release 1 seeds **one shared `core:consultation` template** (chief complaint, history, examination, assessment, diagnosis, plan, next steps) unconditionally for every tenant, and keeps the aesthetic and derm templates as **additional** sections rather than replacements.
   → `POST /note-instances {encounterId, patientId, templateKey, data}`.
   ⚠ Server-side validation against `NoteTemplate.schema` inside the same RLS transaction — unknown key, wrong type, missing required, rejected with the field named. Today `emr.service.ts:108-125` passes `data` straight through, so a note omitting `consent_taken` (marked `required: true` at `aesthetic.manifest.ts:90`) is accepted silently on the artifact that carries medico-legal weight.
6. **Prescribe.** [S 4.4] Repeatable lines → `POST /prescriptions`. ⚠ `Prescription.mgPerDose/dosesPerDay/mgPerDay` are non-null (`schema.prisma:2827-2829`), forcing the paediatric weight-based shape; they must become nullable with `drugName`, `strength`, `frequencyText`, `durationText` added, or a topical cannot be expressed. And the route must be exposed under `emr.core` — the only prescription path today is behind `dosing.core`, which this edition does not grant.
7. **Orders / aftercare.** `GET /order-sets?packKey=` → picker appends aftercare advice to the note.
8. **Propose a plan.** *Create treatment plan* hands `encounterId` to W5. `POST /treatment-plans` already accepts it and cross-checks the patient (`emr.service.ts:170`).
9. **Close.** → `PATCH /encounters/:id/status {status: COMPLETED}` ⇒ `OPEN → COMPLETED`.
10. **Sign and lock.** → `PATCH /encounters/:id/sign` and `PATCH /note-instances/:id/sign` ⇒ writes `signedById`, `signedAt`, `lockedAt`. After locking, the note is read-only; a correction is `POST /note-instances/:id/amend {reason}` writing a **whole new row** (`NoteAmendment` with `supersedesId`), never a delta — following the `ImagingReport` precedent at `schema.prisma:1125-1141`.
    ⚠ **This cannot be retrofitted.** `signedById`/`signedAt` exist on exactly one model out of 94 (`EyeExam`, `schema.prisma:2355-2356`). Every note written before signing ships is permanently unattributable and the clinical record has no medico-legal standing. Budget the full adversarial suite: edit after signing, sign another clinician's note, sign cross-tenant, amend without a reason, contradictory timestamps.
11. **Delete `app/backend/public/aesthetic-workspace.html`** and its link from `public/index.html:44` the day this screen lands. It ships in the production image, is the only working consumer of the EMR write path, and is exactly how work gets reported as done. Copy its renderer logic into `<PackFormRenderer>` first; do not leave both.

---

## W5 — Treatment plan: propose multi-session package → price → accept → schedule sessions

1. **Build.** [S 4.6 `/patients/:id/plans/new`], entered from the consultation or the chart. Add lines from `GET /service-catalog`: service, `sessionsTotal` (e.g. 6 for a laser course), unit price, package price, per-line discount. Running total with subtotal / discount / tax / total.
2. **Save.** → `POST /treatment-plans {patientId, encounterId, items:[{serviceCatalogItemId, code, name, unitPricePkr, quantity, sessionsTotal}]}` ⇒ `TreatmentPlanStatus = PROPOSED`. Line totals are recomputed server-side with int4 overflow bounds (`emr.service.ts:135-185` — keep).
3. **Quote.** [S 4.7] *Print quote* → `<PrintableDocument>` on clinic letterhead with `validUntil`. Browser print, no PDF service.
4. **Accept and invoice — one action, not two.** [S 4.7] *Accept & create invoice* → `POST /invoices {planId}` → `billing.service.ts:485-526` flips the plan under a row lock ⇒ `PROPOSED → ACCEPTED` and creates the invoice, protected by the `invoice_one_per_plan` partial unique index (`constraints.sql:28`).
   ⚠ **Two blocking fixes.** (a) `PATCH /treatment-plans/:id/status` currently permits `PROPOSED → ACCEPTED` (`emr.service.ts:229`) while `createFromPlan` refuses anything not `PROPOSED` (`billing.service.ts:495`) — so marking a plan accepted in the chart makes it **un-invoiceable forever**, with no way back by design (nothing may return to `PROPOSED`, because that reset previously caused a 240,000 PKR triple-bill, documented at `emr.service.ts:201-208`). Remove `PROPOSED → ACCEPTED` from the manual transition table and let invoicing own it exclusively. (b) `DOCTOR` is excluded from `FINANCE_ROLES` (`role-groups.ts:26-31`) and 403s on every billing route, so the person who proposes the plan cannot convert it — either widen the conversion route's role list or make conversion an explicit reception action.
   ⚠ `createFromPlan` at `billing.service.ts:500` maps only `{code,name,unitPricePkr,quantity}` and **drops `serviceCatalogItemId`**, which the plan already carried (`schema.prisma:1657`). Provenance is destroyed at exactly the conversion step. Fix before any real invoice is written.
5. **Schedule the sessions.** [S 4.7] *Schedule sessions* → for each session, `POST /treatment-plans/:planId/items/:itemId/sessions` ⇒ `TreatmentSession` at `SCHEDULED`, optionally with an `Appointment` booked through W2 step 2. Plan shows "0 of 6 scheduled, 0 of 6 done".
6. **Revenue recognition:** on sale, not on redemption, for Release 1. A package is one plan item with `sessionsTotal > 1` and a package price — **no separate ServicePackage/PatientPackage catalogue.**

**Legal transitions:** `PROPOSED → ACCEPTED` (invoicing only) `→ COMPLETED` (all sessions done) · `PROPOSED | ACCEPTED → CANCELLED`. Nothing ever returns to `PROPOSED`.

---

## W6 — Payment: invoice → discount/tax → full or advance payment → outstanding balance → receipt

1. **Raise.** [S 5.1 `/billing`] Either from a plan (W5 step 4) or manually: lines picked from the **catalogue**, not typed.
   → `POST /invoices {patientId, lines:[{serviceCatalogItemId, quantity, performedById}]}` ⇒ `InvoiceStatus = UNPAID`, number minted hole-free under a per-tenant advisory lock from `MAX` (`billing.service.ts:536-552` — keep).
   ⚠ **Do this migration first, before any invoice carries real money:** `InvoiceLineItem` gains `serviceCatalogItemId` and `performedById` (nullable, FK, `@@index([tenantId, serviceCatalogItemId])`), forwarded through `buildLines`, `createFromPlan` and `appendLine`. The DTO already **accepts and validates `serviceCatalogItemId` and then silently discards it** (`create-invoice.dto.ts:19-21` vs `billing.service.ts:449-473`) — the API contract is currently lying. Without these two columns, per-service revenue, doctor commission, package redemption and price-variance are all arithmetically impossible, and retrofitting means backfilling rows that already carry money.
   ⚠ When `serviceCatalogItemId` is supplied, resolve `code/name/unitPricePkr/taxRatePct` **server-side** from the catalogue row in the same RLS transaction. Today every price arrives from the request body (`create-invoice.dto.ts:35`) and any RECEPTION token can bill any amount with nothing recording that it differed from list.
2. **Discount.** [S 5.1] → `POST /invoices/:id/discount {lineId, amountOrPct, reason, approvedById}`. Two-tier cap in config (RECEPTION up to X%, OWNER/ADMIN unlimited) — **no DiscountPolicy table**. Today a discount is an untracked lower price typed into the free-text price field, so money leaving through discretionary pricing is invisible to every report.
3. **Tax.** Computed from the catalogue item's `taxRatePct` with one tenant default. Invoice decomposes into `subtotalPkr / discountPkr / taxPkr / total`.
   ⚠ **The most expensive retrofit in the domain**, and it gets worse with every invoice written. `Invoice.total` is one undifferentiated Int today (`schema.prisma:533`). It must land before go-live.
4. **Take payment.** [S 5.1] Amount, **method** (from `GET /clinic/payment-methods`, not hardcoded), and an **optional reference** (receipt-book number, card last-4).
   → `POST /invoices/:id/payments {amountPkr, method, reference}` — row-locked, overpayment-refusing, reference-idempotent (`billing.service.ts:402-441`, keep). ⇒ `UNPAID → PARTIAL → PAID` as `paid` reaches `total`. Writes a `PatientLedgerEntry` of type `PAYMENT` **in the same transaction that already holds the invoice row lock**, and fires the commission accrual of W8.
   ⚠ The UI currently posts only `{amountPkr, method}` (`BillingPage.tsx:505-508`), so `findByReference` never runs and the receipt-book collision it was written to defend against cannot be expressed by the product.
5. **Advance / deposit.** [S 5.4] Before any invoice exists: → `POST /patients/:id/advance-payments {amountPkr, method, reference}` ⇒ unallocated `Payment` + `PatientLedgerEntry` of type `CREDIT`, raising `PatientAccount.balance`. At settlement: → `POST /invoices/:id/apply-credit`, writing `PaymentAllocation` rows.
   ⚠ Requires `Payment.invoiceId` to become **nullable** — today it is NOT NULL (`schema.prisma:622`), so taking a deposit on a six-session laser package is structurally impossible rather than merely unbuilt.
6. **Outstanding.** [S 4.1 ledger tab / S 5.5] → `GET /patients/:id/balance` and `/ledger`. **Relabel the `/billing` KPI card from "outstanding" to "this patient owes"** — it sums only the selected patient's invoices and an owner reads it as clinic-wide.
7. **Receipt.** [S 5.3] → `<PrintableDocument>` with clinic letterhead, NTN, lines, tax, payments, balance.
8. **Refund.** → `POST /invoices/:id/refunds {amountPkr, method, reason}` — **method chosen, not hardcoded `CASH`** (`BillingPage.tsx:604`). Writes a negative ledger entry and a negative commission earning.
9. **Void.** → `PATCH /invoices/:id/void {reason}` — **reason required**; today the UI sends no body at all (`:668`) so `voidReason` is permanently NULL and the audit trail can answer who and when but never on whose say-so. Refused while `paid > 0`.
10. **Add `CHECK (paid <= total AND paid >= 0)` to `constraints.sql`.** `billing.service.ts:34` documents this constraint as existing; it does not — `constraints.sql` contains three partial unique indexes and zero CHECKs, and the JS guard at `:414` is the sole defence.

---

## W7 — Session execution: start → room → perform → consume inventory → complete → next session due

1. **Today's board.** [S 4.9 `/sessions`] → `GET /sessions?date=today&branchId` grouped by room, plus today's `CHECKED_IN`/`IN_PROGRESS` appointments from the day-sheet.
2. **Start.** [S 4.10] *Start* → `PATCH /sessions/:id/start` ⇒ `SCHEDULED → IN_PROGRESS`, writes `startedAt`, `performedById`, `roomId`.
   ⚠ `TreatmentSession` does not exist today. A performed session must be a first-class row distinct from the `Appointment` that booked it and the `TreatmentPlanItem` that sold it: `(tenantId, org/clinic/branch, patientId, treatmentPlanId, treatmentPlanItemId, appointmentId?, encounterId?, roomId?, sessionNo, status, startedAt, completedAt, performedById, assistedById?, notes, consumableCostPkr)` with `@@unique(tenantId, treatmentPlanItemId, sessionNo)`. **Copy the shape from the two working session engines (`RehabSession` at `schema.prisma:2578-2600`, `PhototherapySession` at `:2695-2730`) — do not refactor them into it.**
3. **Consume.** [S 4.10 consumables panel] Pre-filled from `GET /service-catalog/:id/consumables`; the nurse adjusts quantities.
   → `POST /inventory/issues {treatmentSessionId, issueType: PROCEDURE_CONSUMPTION, lines:[{itemId, quantity}]}`.
   Server: FEFO batch decrement with deterministic lock ordering, in-date filtering, insufficient-stock refusal and per-batch provenance — **extract the existing engine at `pharmacy.service.ts:119-220` into a shared `StockLedgerService.consume()` used by both dispense and issue.** Hand-copying that lock discipline a second time is how it silently diverges.
   Each line **snapshots `unitCostPkr`** onto `StockIssueLine` (never joins live — a later price change must not restate last quarter's margins), emits a `StockMovement` row in the same transaction, and rolls up to `TreatmentSession.consumableCostPkr`.
   ⚠ `unitCostPkr` is collected by the receive form and written by the service today and **read by nothing anywhere in the repo** — the clinic is entering cost data that produces no margin, no COGS and no commission basis.
4. **Complete.** → `PATCH /sessions/:id/complete` ⇒ `IN_PROGRESS → COMPLETED`, writes `completedAt`, increments `TreatmentPlanItem.sessionsCompleted`, writes a `PlanSessionRedemption` row.
5. **Close the appointment.** → `PATCH /appointments/:id/complete` ⇒ `IN_PROGRESS → COMPLETED` (W2 step 7).
6. **Next session due.** [S 4.7] The plan shows "4 of 6 done, next due 14 Aug". *Book next* returns to W2 step 2. **No automatic reminder** — the scheduler is deferred; the front desk books it while the patient is standing there, which is what actually happens.
7. **Stock consequences.** [S 6.2] The alerts panel now shows anything below `reorderLevel`. ⚠ Drop the `quantityOnHand > 0` filter first (`pharmacy.service.ts:58`) or a sold-out item cannot trigger its own alert — it simply disappears from the screen.

**Legal transitions:** `SCHEDULED → IN_PROGRESS → COMPLETED` · `SCHEDULED → CANCELLED | NO_SHOW`. Terminal states never walk backwards.

---

## W8 — Commission: payment received → attribute to performer → compute share → ledger entry → doctor earnings

*Zero commission code exists today — a case-insensitive search across `D:\asthetic2\app` returns nothing. This workflow is built entirely on the attribution spine from W6 step 1.*

1. **Attribute.** At invoice creation, each `InvoiceLineItem.performedById` defaults from `Appointment.providerId` (`schema.prisma:513`, NOT NULL, FK to User) or `Encounter.providerId`, overridable from a performer selector on the line. `Employee.userId` (new, `@@unique([tenantId, userId])`) links the person who treats to the person payroll pays — **today they are two unlinked populations.**
2. **Resolve the rule.** On payment, look up the effective `CommissionRule` by scope precedence (specific doctor → service category → tenant default) and by `effectiveFrom/effectiveTo`, so changing a rate never restates last month. Rate stored in **basis points** (Int) so it is exact.
3. **Accrue.** Inside `applyPayment` (`billing.service.ts:402-441`), in the **same transaction, under the existing invoice row lock**:
   - Allocate the payment **pro-rata across invoice lines** (partial payments are normal).
   - Base = allocated amount; for `PCT_AFTER_CONSUMABLE`, subtract the frozen `consumableCostPkr` snapshot from W7 step 3 first.
   - Write one `CommissionEarning` per (payment, line, payee), floored in basis points, plus an explicit `CLINIC_RESIDUAL` row for the rounding remainder so the ledger sums **exactly** to the payment.
   - Idempotency: `@@unique([tenantId, sourceType, sourceId, invoiceLineItemId, payeeUserId])`.
   **Keyed to individual `Payment` and `Refund` rows — never recomputed over the mutable `Invoice.paid`.**
4. **Reverse.** The refund path (`billing.service.ts:225-260`) writes **negative** earnings against the same lines in the same transaction.
5. **Reconcile before shipping any of this.** `reports.service.ts:44` reads `Invoice.paid` and `:46` reads `SUM(Payment.amount)` as if interchangeable; `billing.service.ts` maintains `payments − refunds == paid` carefully but **nothing asserts it**. Add a per-tenant reconciliation assertion that fails loudly, and run it in the suite **first**. A commission engine built on two conventionally-equal sources will eventually disagree, and it surfaces as a wrong cheque to a doctor.
6. **Read.** [S 8.5 `/me/earnings`] → `GET /commissions/me?from&to` — scoped to self **at the service layer**. [S 9.3] → `GET /reports/revenue-share?from&to` for the owner.
7. **Pay.** W10 step 4 sweeps unpaid earnings into the payslip and stamps `payslipId` on each so it can never be paid twice.
8. **Salesperson share** reuses the same ledger and the same statement screen — `Invoice.salespersonUserId` stamped at creation from the converting lead (W1 step 7), with a manual override. **No second engine.**
9. **Adversarial suite (non-negotiable, 3 days).** Partial payment; refund after a finalized payroll run; rule rate changed mid-period; two performers on one invoice; void after full refund; concurrent payments on one invoice; rounding residual sums to exactly zero; re-delivered gateway webhook producing no second earning. This project's green suites have twice certified broken safety code.

**Only two bases in Release 1:** `PCT_NET_COLLECTION` and `PCT_AFTER_CONSUMABLE`. The discriminated enum makes the other five additive.

---

## W9 — Day close: reception day summary + owner dashboard

**Reception, ~7 pm:**
1. [S 3.5 `/queue`] Clear the board — anyone still in *Waiting* is either completed or marked `NO_SHOW` with a reason. No appointment may end the day in a non-terminal state.
2. [S 5.6 `/billing/daybook`] → `GET /payments?from=today&to=today` grouped by method, **net of refunds grouped by method**.
   ⚠ `reports.service.ts:85` aggregates `Refund` with `_sum` only and subtracts it as a single scalar even though `Refund.method` exists (`schema.prisma:1177`), so a cash refund never reduces the CASH line and **the drawer cannot be reconciled against the system**. Fix before this screen ships.
3. Count physical cash against the CASH line. Discrepancies are noted, not enforced — **no `CashDrawerSession` model in Release 1.**
4. → `GET /invoices?status=UNPAID,PARTIAL` — who owes what, for tomorrow's follow-up calls.
5. [S 3.4] Tomorrow's day sheet: send WhatsApp reminders in a batch of manual sends.

**Owner, any time:**
6. [S 9.1 `/`] → `GET /dashboard/today` — collections today, outstanding, appointments today, patients seen, **doctor share accrued today, clinic share today**, low-stock count.
   ⚠ This endpoint must be **role-shaped and open to any authenticated tenant user**. Today the index route calls `/reports/summary`, which is `@Roles(OWNER, ADMIN, FINANCE)` + `reporting.core`, so RECEPTION, DOCTOR, SALES, TREATMENT and INVENTORY meet a red error alert as the first screen after logging in, and a SOLO clinic's own owner does too. Keep `/reports/*` finance-only. Ship a role-matrix test covering all 8 roles.
7. [S 9.2 `/reports`] Date range → collections by method, revenue by service, revenue by doctor.
   ⚠ Reconcile the VOID contradiction first: `summary()` excludes VOID invoices at `reports.service.ts:44` while the payment, refund and per-method aggregates at `:46`, `:47`, `:83` do not — so a voided-and-refunded invoice's payment appears in one screen and not the other. Assert `summary().billing.paymentsPkr == revenue().clinic.totalPkr` for the same range.
8. [S 9.3 `/reports/revenue-share`] Doctor share vs clinic share for the month, per doctor, drilling to the earning lines.

---

## W10 — Payroll run: attendance → fixed salary + commission → payslip

1. **Prerequisite, half a day, do it before 1C starts:** add `hr.core` to `CLINIC_ADDONS` (`editions.ts:65`) and backfill `TenantEntitlement` rows. Until then `nav.ts:77` hides Payroll and every `/hr/*` call 403s for this customer — the module demos only because `seed.ts` deliberately over-grants `ALL_FEATURE_KEYS`.
2. **Staff exist.** [S 8.1 `/hr/staff`] Employees created and linked to User accounts. **A clinic that hires a nurse cannot pay her today** — `POST /hr/employees` has no UI caller and employees enter only via `demo-seed.ts`.
3. **Attendance closed.** [S 8.2] Camera punches arrive at `POST /attendance/ingest` (HMAC-signed, `@@unique([tenantId, deviceId, externalEventId])` so a camera re-sending yesterday cannot double-count); gaps filled by `POST /attendance/punch`; supervisor corrections via `PATCH /attendance/days/:id`, audit-logged. `AttendanceDay` is **materialised**, not recomputed on read, so a run is reproducible months later.
   *The vendor camera adapter sits behind an `AttendanceProvider` seam and cannot be scheduled until the device is chosen and installed. The manual path must ship regardless.*
4. **Draft the run.** [S 8.3 `/payroll`] Pick the period → *Compute draft* → `POST /hr/payroll/runs {period}` ⇒ `PayrollRun = DRAFT` with per-employee `Payslip` rows. Components, each a `PayslipComponent` row with a sign and a `sourceRef`:
   - Basic salary from `Employee.baseSalaryPkr`, **prorated** for joiners and leavers (`hr.service.ts:210-212` names this as open; a clinic that hires on the 12th hits it in month one).
   - **Commission**: sweep unpaid `CommissionEarning` rows for the period and stamp `payslipId` on each.
   - Absence and late deductions from `AttendanceDay`, with the reason on the line.
   - Manual deductions, **with the `reason` the DTO already validates and nothing persists**.
   ⚠ Fix `hr.service.ts:95` first: it filters to `status: 'ACTIVE'`, so an employee on two days' paid leave is excluded from the run entirely and receives **zero for the month**. Include `ON_LEAVE` at full pay and let the operator record an explicit deduction.
5. **Review.** [S 8.3] Pre-run projection versus the draft; the existing stale-slip warning (`PayrollPage.tsx:354`) flags any slip computed before an employee record changed. Discard and recompute → `DELETE /hr/payroll/runs/:id`.
6. **Finalize.** → `PATCH /hr/payroll/runs/:id/finalize` ⇒ `DRAFT → FINALIZED`. Immutable. Confirmation dialog states the employee count and net total.
7. **Distribute.** [S 8.4] → `GET /hr/payroll/payslips/:id` → printable payslip showing every component so the payslip states **why** pay was reduced.
8. **Doctor's own view.** [S 8.5 `/me/earnings`] shows accrued vs paid, reconciling to the payslip's commission line.

---

# D. BACKEND PREREQUISITES, ORDERED

| # | Item | Slice | Days | Gates |
|---|---|---|---|---|
| BE1 | **Close the PLATFORM_ADMIN escalation** — three fixes (RolesGuard corroborates `isPlatformAdmin`; `ASSIGNABLE_ROLES` allowlist re-enforced in the service; `switchContext` re-reads the User row) + `privilege_escalation_suite.py` performing the literal four-call exploit | 1A | 2.5 | everything — **do this first, it is live today** |
| BE2 | TenantCtx carries org/clinic/branch; login token carries context claims; default-branch guarantee | 1A | 4 | **the cheapest permanently-unrecoverable item in Release 1** |
| BE3 | Entitlement corrections: `hr.core` + new `inventory.core` into `CLINIC_ADDONS`; re-run `check-entitlement-coverage.ts` | 1A | 0.5 | Groups 6, 8 |
| BE4 | `@Roles` sweep on the ~10 Release-1 controllers + `check-role-coverage.ts` (`RolesGuard` is fail-open: 39 of 207 handlers have no `@Roles`, including `GET /patients`) | 1A | 2 | U4, all |
| BE5 | Users module + `tokenVersion` + membership role update/revoke | 1A | 7 | 2.1, 3.1, 8.1 — **the largest single blocker** |
| BE6 | `AuditLog` columns + writes on privileged mutations | 1A | 2 | — |
| BE7 | org/clinic/branch columns + backfill on ~20 Release-1 tables | 1A | 2 | BE8 |
| BE8 | Auto-stamp Prisma client extension + CI guard (the alternative is hand-editing ~30 create sites forever) | 1A | 4 | all writes |
| BE9 | Clinic profile / working hours / rooms / payment-method APIs | 1A | 8.5 | 2.2 |
| BE10 | 1A safety suites (escalation, staff management, branch stamping) | 1A | 4 | — |
| BE11 | **`InvoiceLineItem.serviceCatalogItemId` + `performedById`** forwarded through all three creation paths | 1B | 2 | **cheapest high-value item in the project — before any invoice carries real money** |
| BE12 | Appointments: filters + indexes, transition guard, tenant checks + `EXCLUDE` constraint, lifecycle columns + status events, reschedule, day-sheet, walk-in | 1B | 10.5 | W2, W7 |
| BE13 | Patient demographics, server-side search, allergies/medications, custom fields | 1B | 8 | W3 |
| BE14 | Encounter clinical columns, note/intake validation, core consultation template, sign-and-lock + amendments, prescribing | 1B | 12.5 | W4 |
| BE15 | Catalogue write API + source discriminator; plan sessions; plan-status collision fix; server-side price resolution | 1B | 14 | W5 |
| BE16 | Invoice money decomposition; discounts; ledger + account; advances + allocations; statement; register/daybook queries; tax identity; CHECK constraint | 1B | 22 | W6 |
| BE17 | `InventoryItem` master; `TreatmentSession`; shared `StockLedgerService.consume()` + `StockIssue`; `StockMovement` ledger; BOM; reorder alerts; write-offs; seed | 1B | 26 | W7 |
| BE18 | 1B integration + safety suites (appointments concurrency, session/inventory races, billing) | 1B | 8 | — |
| BE19 | CRM: assignment relation, transition guard, `ParseUUIDPipe`, convert attribution, stages, one-txn convert | 1C | 6.75 | W1 |
| BE20 | Public ingestion substrate + Meta/WhatsApp inbound (stub credentials, recorded fixtures) + message log | 1C | 8 | W1 |
| BE21 | `CommissionRule` + `CommissionEarning` ledger + self-scoped read + adversarial suite | 1C | 13 | W8 |
| BE22 | Reports: period params, VOID reconciliation, refunds by method, by-doctor/by-service, `/dashboard/today` | 1C | 7 | W9 |
| BE23 | `Employee.userId`, `PayslipComponent`, proration, `ON_LEAVE` fix, attendance core, attendance→payroll, salesperson attribution, consumable-cost snapshot | 1C | 20 | W10 |
| BE24 | 1C suites | 1C | 4 | — |

**BE total ≈ 196 days** (1A ≈ 35.5 · 1B ≈ 103 · 1C ≈ 58).

---

# E. THINGS THIS PLAN DELIBERATELY DOES NOT BUILD

Named so nobody re-adds them by accident: multi-branch consolidated reporting and branch-scoped RLS (columns land, predicates do not — a branch policy with no explicit `WITH CHECK` reuses its `USING` expression as the insert check and surfaces as scattered 500s); the reminder **scheduler** (no scheduler primitive exists at all, so the first timed feature pays for the whole substrate — a manual WhatsApp button instead); the form builder, clinical rules engine and role–permission matrix; insurance/corporate billing; purchase orders, suppliers, stock counts, transfers and inventory valuation; ProviderSchedule/free-slot suggestion and drag-to-reschedule and month view; the WhatsApp conversation inbox and template registry; per-tenant integration credentials (**flag as a HARD GATE on the second paying integration customer — the day a real `WHATSAPP_PHONE_NUMBER_ID` is set with two tenants on the box, every clinic sends from one clinic's number**); the platform dashboard, organisation portal, module matrix, quotas and subscriptions UI; leave management, rosters, shifts, advances and loans; expenses and P&L; server-generated PDFs; the audit-log viewer (write the rows, read them with SQL); patient merge; PDF/ICD-10/coded diagnosis; the async-autocomplete refactor of the other eleven screens.

**And one standing rule:** `frontend/screens/` holds 108 static HTML mockups with zero network calls, and `app/backend/public/aesthetic-workspace.html` ships in the production image. Move the former to `design/mockups/` with a non-functional README and delete the latter the day screen 4.2 lands. Neither may ever be counted as progress.