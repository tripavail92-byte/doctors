# Health OS — Release Plan v2 (for approval)

Supersedes `r1-01` … `r1-04`. Incorporates the fourteen workflow and commercial gaps raised
in review, and restructures delivery into three phases.

Status: **awaiting approval.** Section 5 lists decisions that must come from the clinic owner
before the affected work can start — they are commercial policy, not engineering choices, and
guessing them produces wrong refund amounts and wrong doctor payouts.

---

## 1. What changed from v1

Three things.

**The data spine is now specified explicitly** rather than left to emerge. Section 3 defines
the chain from appointment through to commission earning, every foreign key on it, and the
rule that resolves each one. Half of this chain already exists in the schema — the gap was
never as wide as v1 implied, but the missing half is load-bearing.

**Fourteen gaps are closed** (section 4), each with its schema delta, endpoints, screens,
effort, and phase.

**Delivery is now three phases** (section 6), each independently shippable. Phase 1 alone
gives the Lahore clinic a working day. Phases 2 and 3 add money depth and workforce.

Everything v1 said about the privilege escalation, the misleading UI defects, and the
architecture asymmetries (branch columns, sign-and-lock, and the message log being cheap now
and unrecoverable later) still stands unchanged.

---

## 2. Ground truth this plan is built on

Verified directly against `app/backend/prisma/schema.prisma` while writing this document, so
the deltas below are exact.

**Already present and reusable:**

| Fact | Why it matters |
|---|---|
| `TreatmentPlanItem.serviceCatalogItemId` exists | Plan lines already trace to the catalogue. Only the *invoice* line lacks it. |
| `TreatmentPlanItem.quantity` exists | This is the session count. Materialisation has its input already. |
| `Invoice.planId` exists (documented as provenance) | Invoice → plan is already joined. |
| `Encounter.appointmentId` and `Encounter.providerId` exist | The consulting doctor is already recorded. |
| `Payment.reference` is `@@unique([tenantId, reference])` | Webhook idempotency is already modelled. |
| `ServiceCatalogItem.durationMin`, `lateralizable`, `bilateralPricePkr` | Booking duration and per-side pricing already exist. |

**Absent, and on the critical path:**

| Missing | Consequence |
|---|---|
| No `TreatmentSession` model of any kind | The hop the release is named after cannot happen. |
| `InvoiceLineItem` has no `serviceCatalogItemId`, `performedById`, `treatmentSessionId` | Revenue cannot be attributed to a person or a service. |
| `Payment` has no line allocation | Cannot say which line a part-payment paid for. |
| `Refund` is invoice-level, no lines | Clawback is undefined. |
| `Invoice` has `total` only — no subtotal, discount or tax | Discounts cannot be recorded at all. |
| `Employee` has no `userId` | The doctor who performs and the person payroll pays are different populations. |
| `Appointment.service` is free text, no `serviceCatalogItemId` | Bookings do not trace to the catalogue. |
| `StockItem` is a flat batch row — no item master, no branch | No per-branch stock, no consumable cost roll-up. |
| No `Room`, `CashDrawerSession`, `ProviderSchedule`, `AttendanceDevice`, `IntegrationConnection` | Items 7, 9, 11, 12 below. |

---

## 3. The canonical data spine

This is the backbone of items 1–5. Everything downstream — margin, doctor share, refund
clawback, "which visits were never billed" — is a query over this chain. Existing edges are
marked ✅, new edges ➕.

```
Appointment ─➕ serviceCatalogItemId          (what was booked)
     │
     ✅ Encounter.appointmentId
     ↓
Encounter ─✅ providerId                       ROLE 1: consulting doctor
     │
     ✅ TreatmentPlan.encounterId
     ↓
TreatmentPlan ──✅ items ──→ TreatmentPlanItem ─✅ serviceCatalogItemId
     │                              │  quantity = session count
     │                              │
     │                              ➕ materialises N rows on ACCEPT
     │                              ↓
     │                     TreatmentSession ─➕ planItemId
     │                                       ─➕ appointmentId   (when scheduled)
     │                                       ─➕ performedById    ROLE 2: performer
     │                                       ─➕ roomId
     │                                       ─➕ sequenceNo
     │                                       ─➕ status
     │                                       ─➕ consumableCostPkr
     │                                            │
     │                                            ➕ StockIssue.treatmentSessionId
     │
     ✅ Invoice.planId                            ➕ Invoice.appointmentId
     ↓
Invoice ─➕ subtotalPkr / discountPkr / taxPkr / totalPkr
     │
     ✅ lines
     ↓
InvoiceLineItem ─➕ serviceCatalogItemId
                ─➕ treatmentSessionId
                ─➕ performedById
                ─➕ discountPkr
     │
     ├─➕ PaymentAllocation (paymentId, invoiceLineItemId, amountPkr)
     └─➕ RefundLine        (refundId,  invoiceLineItemId, amountPkr)
                                   │
                                   ↓
                        CommissionEarning ─➕ beneficiaryUserId   ROLE 3: recipient
                                          ─➕ sourceType / sourceId
                                          ─➕ ruleId, basisPkr, amountPkr
                                          ─➕ sign (+1 accrual / −1 clawback)
```

**Resolution rules — stated once, implemented once:**

- `InvoiceLineItem.performedById` defaults from `TreatmentSession.performedById` when the line
  has a session; otherwise from `Encounter.providerId`. An admin may override it, and the
  override writes an `AuditLog` row. It is never silently null.
- `PaymentAllocation` is written inside the existing row-locked `applyPayment` transaction
  (`billing.service.ts:402-441`). Default allocation is oldest-line-first; an explicit
  allocation may be supplied.
- `CommissionEarning` is **append-only**, keyed to `Payment` and `RefundLine` rows — never
  recomputed over `Invoice.paid`, because `paid` is mutable and a refund decreases it.
  Recompute-on-read pays commission on returned money.

---

## 4. The fourteen gaps

Effort is developer-days, raw. Apply the ×1.55 loading factor from `r1-05` for calendar
planning.

### 4.1 Automatic session creation on plan acceptance — 3d — Phase 1

On `TreatmentPlan.status → ACCEPTED`, materialise `quantity` `TreatmentSession` rows per
`TreatmentPlanItem`, in the **same transaction** as the status change.

New model `TreatmentSession`: `id, tenantId, organizationId, clinicId, branchId, patientId,
planId, planItemId, sequenceNo, status, appointmentId?, performedById?, roomId?,
performedAt?, consumableCostPkr (default 0), consumablesConfirmedAt?, notes?`.

Status enum: `SCHEDULED → IN_PROGRESS → PERFORMED → CONSUMABLES_CONFIRMED → CLOSED`, plus
terminal `CANCELLED` and `NO_SHOW`.

Idempotency: `@@unique([planItemId, sequenceNo])`. Re-running acceptance cannot duplicate.

**This must respect an existing scar.** `emr.service.ts:201-208` documents a treatment plan
that re-entered `PROPOSED` and was invoiced three times for PKR 240,000. The same state
machine that forbids re-acceptance must gate materialisation — one accepted transition, one
set of sessions, enforced by the unique key and not by a service-layer `if`.

Sessions are created **unscheduled**. Scheduling attaches an `appointmentId` later.

Acceptance test: accept a 6-session laser plan → exactly 6 rows, sequence 1–6, all
`SCHEDULED`; call accept again → 409, still 6 rows.

### 4.2 Explicit linkage across the spine — 6d — Phase 1 (columns) / Phase 2 (allocation)

Phase 1 columns: `Appointment.serviceCatalogItemId`, `Invoice.appointmentId`,
`InvoiceLineItem.serviceCatalogItemId`, `InvoiceLineItem.treatmentSessionId`,
`InvoiceLineItem.performedById`.

Phase 2 tables: `PaymentAllocation`, `RefundLine`.

`billing.service.ts:502-504` (`createFromPlan`) currently maps only
`{code, name, unitPricePkr, quantity}` and drops the catalogue id that the plan item already
carries. Fixing that one mapping is most of this item.

Also forward both new fields through `expandLaterality`, where one input line becomes two.

Unlocks: "which visits were never billed", revenue by service, revenue by doctor, margin per
treatment. All of it is unrecoverable for any row written before these columns exist — this
is the highest ratio work in the plan and it belongs in the first sprint that touches billing.

### 4.3 Three separated roles — 5d — Phase 1 (capture) / Phase 2 (commission)

| Role | Field | Set when |
|---|---|---|
| Consulting doctor | `Encounter.providerId` ✅ exists | Consultation opened |
| Session performer | `TreatmentSession.performedById` ➕ | Session started or completed |
| Commission recipient | `CommissionEarning.beneficiaryUserId` ➕ | Rule evaluation |

These are **three different people in the normal case**, not an edge case: the dermatologist
consults, a laser technician performs, and the salesperson who converted the lead earns a
share. One session therefore produces **multiple** `CommissionEarning` rows with different
beneficiaries and different rules, plus one `CLINIC_RESIDUAL` row so the split always sums
to the basis.

Reconciliation UI: a session whose performer differs from its invoice line's performer is
flagged on the day-close screen for an admin to resolve before the day is locked. Silent
divergence is how the wrong doctor gets paid.

Also required here: `Employee.userId` (nullable FK, unique). Without it the person who
performs and the person payroll pays cannot be joined.

`Encounter.providerId` is currently a nullable uuid with **no `@relation` and no FK** — it
accepts a cross-tenant uuid today. Add the constraint as part of this item.

### 4.4 Consumables confirmed before after-consumable commission — 4d — Phase 2

`PCT_AFTER_CONSUMABLE` is arithmetically undefined until consumable cost is known, and today
nothing orders those two events.

Rule: an earning of that type accrues at the **later** of (a) payment received against the
line, and (b) `TreatmentSession.status = CONSUMABLES_CONFIRMED`. Both events call the same
`tryAccrue(sessionId)`, which is a no-op unless both conditions hold and no earning exists
for that idempotency key.

Late correction: if consumables are amended after accrual, write an **adjusting earning**
(sign −1 for the original, +1 for the corrected). Never mutate an accrued row. The doctor's
ledger must read as a bank statement, not as a spreadsheet cell that changed.

Acceptance test: confirm-then-pay and pay-then-confirm produce identical final balances;
amending consumables afterwards leaves exactly three rows, netting correctly.

### 4.5 Line-level refund and discount allocation — 6d — Phase 2

Invoice decomposition: `subtotalPkr`, `discountPkr`, `taxPkr`, `totalPkr`, with
`InvoiceLineItem.discountPkr` per line. Retrofitting tax after real invoices accumulate means
two incompatible invoice eras forever, so this lands before the clinic trades.

`RefundLine(refundId, invoiceLineItemId, amountPkr)`. A refund is the sum of its lines.
Default allocation is proportional to line net; the user may refund a specific line instead,
and the UI must show which.

Clawback: every `RefundLine` generates a matching negative `CommissionEarning` against the
same beneficiary and source. Append-only, so the doctor sees the reversal.

Also add the `CHECK (paid >= 0 AND paid <= total)` constraint to `constraints.sql` that
`billing.service.ts:34` **already claims exists and does not**. A false safety comment is
worse than no comment.

### 4.6 Patient and service catalogue CSV import — 5d — Phase 1

The single highest-probability day-one rejection cause. The clinic has ~400 patients in Excel
and a paper appointment book. Without this, reception runs two systems and the product becomes
"the thing we type into afterwards."

`ImportJob(id, tenantId, kind, status, rowCount, okCount, errorCount, reportJson, createdById)`.

Flow: upload → **dry run** → preview table with per-row status → duplicate report → commit.
Duplicate detection on **phone first** (the field always captured), then CNIC, then MRN.
MRN minting must go through the existing advisory-locked `nextMrn` path
(`patients.service.ts:41-59`), not a bulk insert that bypasses it.

Catalogue import is the same machinery with a different column map.

### 4.7 Provider schedules, holidays and time-off — 6d — Phase 1

`ProviderSchedule(providerId, dayOfWeek, startLocal, endLocal, effectiveFrom, effectiveTo)`,
`ProviderTimeOff(providerId, startsAt, endsAt, reason)`,
`ClinicHoliday(clinicId, date, name)`.

Calendar greys out non-working hours, holidays and time-off. Booking into them **warns and
requires confirmation** rather than hard-blocking — clinics genuinely do book exceptions, and
a hard block gets worked around by booking the wrong doctor.

This is also the missing half of the partner's "doctor and staff setup": today a provider has
no working hours anywhere, so the calendar has nothing to draw.

### 4.8 Thermal receipt printing — 1.5d — Phase 1

Two documents, not one:

- **Receipt** — 80mm thermal (and a 58mm variant), the desk's most frequent physical action.
- **Invoice / statement / quote / prescription** — A4.

An A4 layout on a thermal roll is unusable. Confirm with the clinic which printer is on the
desk before building; if the answer is "we send it on WhatsApp", the receipt becomes a PDF
attachment and the thermal stylesheet is dropped.

Print output is not testable in the jsdom harness — it gets verified by eye, and the plan
should say so rather than implying coverage.

### 4.9 Cash drawer opening and closing — 3d — Phase 1

`CashDrawerSession(id, tenantId, branchId, openedById, openedAt, openingFloatPkr, closedById?,
closedAt?, countedPkr?, expectedPkr?, variancePkr?, notes?)`.

Every `Payment` with `method = CASH` links to the open session for its branch. Constraint: at
most one open session per branch — a partial unique index, not a service-layer check.

Close computes expected from linked payments and refunds, records the counted amount, and
stores the variance. This converts the day-close screen from informational into a control, and
it answers the owner's first real question in a cash business: *who was short PKR 3,000
yesterday.*

### 4.10 Timezone-correct daily reporting — 5d — Phase 1

The database refuses to boot in anything but UTC (`prisma.service.ts:102-146` probes six
months forward), and `TZ=UTC` is set on both Railway services. The clinic runs Asia/Karachi,
UTC+5. Every evening's takings currently land on the wrong day.

Do **not** change the database or the boot guard — both are correct. Add
`ClinicProfile.timezone` (default `Asia/Karachi`) and one shared helper:

```
clinicDayBounds(clinicId, localDate) -> { startUtc, endUtc }
```

Every day-boundary consumer routes through it: day sheet, day book, `/dashboard/today`,
`/reports?from&to`, attendance day materialisation, payroll period, "next session due".

Acceptance test: set the clock to 23:30 PKT, take a payment, assert it appears in today's day
book and not tomorrow's.

This also needs a date library decision — `app/web/package.json` currently has **none**
(no date-fns, dayjs, luxon or `@mui/x-date-pickers`), and every date input is a raw
`<TextField type="date">`. Adopting `@mui/x-date-pickers` alongside the calendar is the
cheapest path.

### 4.11 Clinic-specific WhatsApp credentials — 3d — Phase 1 (gate) / Phase 3 (use)

`IntegrationConnection(id, tenantId, provider, credentialsEnc, status, verifiedAt, lastErrorAt)`
with credentials encrypted at rest.

**Fail closed.** If a tenant has no connection row, sending is disabled and the UI says so.
It must never fall back to a process-wide environment variable, which is what happens today —
the moment a real `WHATSAPP_PHONE_NUMBER_ID` is set with two tenants on the box, every clinic
sends from one clinic's number. That is a cross-tenant identity leak and a Meta policy breach
on day one.

This is a **hard gate**: it must merge before any real WhatsApp credential touches any
environment, which is why it sits in Phase 1 even though messaging itself is Phase 3.

### 4.12 Camera device to employee mapping — 5d — Phase 3

`AttendanceDevice(id, tenantId, branchId, deviceKey, secretHash, lastSeenAt, status)`
`AttendanceEmployeeBinding(deviceId, externalRef, employeeId)`
`AttendanceEvent(id, tenantId, deviceId, employeeId?, externalRef, eventType, occurredAt, ingestedAt, raw)`
`AttendanceDay(tenantId, employeeId, localDate, firstIn, lastOut, workedMinutes, lateMinutes, overtimeMinutes, status)`

The device knows its own enrolment id, not your `Employee.id` — the binding table is what
makes a device swap a configuration change rather than a data migration.

Three properties that make this real work now and a credential swap later:

- **Per-device secret**, so ingestion is authenticated per device rather than by a shared key.
- **Offline backfill**: events carry the device's `occurredAt`, are ingested later, and are
  idempotent on `(deviceId, externalRef, occurredAt)`. Power cuts are normal in Lahore.
- **`AttendanceDay` is materialised, not computed on read**, so payroll reads a stable row.

No vendor credentials are fabricated. The ingestion endpoint and the binding UI are built and
testable against a simulator; connecting a real camera is a configuration step.

Note this is the first unauthenticated ingestion endpoint in a product whose entire tenant
model derives from a JWT. It needs throttling, a body cap and signature-before-parse —
`@nestjs/throttler` and `helmet` are both absent from `package.json` today.

### 4.13 Package cancellation, expiry, no-show and unused sessions — 7d — Phase 2

**This item is blocked on owner decisions.** See section 5. The engineering below is
straightforward; the numbers it produces are commercial policy, and guessing them means
refunding the wrong amount to a real customer.

Schema: `TreatmentPlan.expiresAt`, `TreatmentPlan.cancelledAt/cancelledById/cancellationReason`,
`TreatmentSession.status` gains `NO_SHOW` and `CANCELLED`, plus
`PlanSessionRedemption(sessionId, redeemedAt, countsAsConsumed)`.

The engine computes, on cancellation: sessions consumed, refund due, commission clawback. It
must be one function with one exit, and its output must be shown to the operator for
confirmation before anything is written.

### 4.14 Image compression, storage monitoring, tested restore — 5d — Phase 1

Three separate problems currently bundled:

**Compression.** Downscale on upload to a 2000px longest edge (ample for clinical
photography) and record `originalBytes`. Before/after photography is the headline feature of
an aesthetics product, so quality is a real constraint — 2000px is the recommendation, not
an aggressive default, and it should be confirmed.

**The orphan bug.** `media.service.ts:81-92` writes bytes to storage *before and outside* the
transaction that inserts `PhotoAsset`. A failed insert orphans the bytes forever with no
reaper. Reverse the order or add a reaper — this is a real leak on a mounted volume.

**Monitoring.** Disk usage metric plus an alert threshold. `storage.service.ts:22` writes to
`STORAGE_DIR` on local disk with no quota and no cap. Six months of tablet-resolution pairs
on one volume is a foreseeable outage with clinical data in it.

**Backup.** Documented `pg_dump` plus volume snapshot, and — the part that actually matters —
a **rehearsed restore** with a written runbook and a recorded date of last test. A backup
nobody has restored is a hypothesis.

S3 migration stays deferred; `GET /photos/:assetId/raw` streams a Buffer today, so an adapter
returning presigned URLs is a controller change rather than the drop-in swap the code comment
claims.

---

## 5. Decisions required from the clinic owner

These determine money that moves. I will not choose them.

**Package lifecycle (item 4.13)**

1. **Validity period.** How long is a package valid from acceptance? *Proposed default: 12
   months.*
2. **Unused sessions at expiry.** Forfeited, refunded, or extendable on request?
   *Proposed default: forfeited, with a manager override that logs a reason.*
3. **Mid-course cancellation refund basis.** When a patient cancels after 2 of 6 sessions, is
   the refund `paid − (2 × package unit price)` or `paid − (2 × full list price)`? These give
   materially different numbers, and the second is the industry norm because it removes the
   package discount when the package is abandoned. *Proposed default: full list price.*
4. **No-show.** Does a no-show consume a session? *Proposed default: no, but the third
   no-show on one package does, and the patient is told this at sale.*
5. **Transferability.** May a package move to another patient or another service?
   *Proposed default: no.*

**Commission**

6. **Invoiced or collected?** *Strong recommendation: collected.* Paying on invoiced money
   means paying on money that may never arrive, and clawback disputes follow.
7. **Basis.** Gross, net of discount, or net of discount and consumables? The reference design
   showed "30% on Net Collection" — confirm which of the three that means.
8. **Split when three people are involved** (consultant, performer, salesperson) — the
   percentages and whether they come out of the clinic share or the doctor share.

**Operations**

9. **Receipt printer** on the front desk: 80mm thermal, 58mm, A4, or WhatsApp only?
10. **Image quality floor** for before/after photography — is a 2000px longest edge acceptable?

Items 1–5 block 4.13. Items 6–8 block the commission engine in Phase 2. Items 9–10 are small
but cheap to get wrong.

---

## 6. Three-phase delivery

Each phase ends with the clinic able to do more than it could before. No phase is a
backend-only milestone.

### Phase 0 — Security and honesty (1 week, non-negotiable)

Unchanged from v1 and still first. Close the privilege escalation with all three fixes plus
the adversarial suite; fix the six misleading-UI defects; correct the sidebar role filtering.
**The escalation is live on the Railway deployment today** — the routes answer `401`, not
`404`.

### Phase 1 — Core clinic operations

*Goal: the Lahore clinic runs a full working day on this, and stops using paper.*

Foundation: staff and user management; clinic profile, working hours, rooms, payment methods;
`organizationId`/`clinicId`/`branchId` stamped on every operational write with a single default
branch.

Golden thread, front half: patient registration **with CSV import** (4.6); appointment calendar
with provider schedules, holidays and time-off (4.7); check-in and queue; consultation screen
with sign-and-lock; treatment plans with **automatic session materialisation** (4.1); the
linkage columns (4.2 Phase-1 half); performer capture (4.3 Phase-1 half); invoice, payment,
outstanding balance; **thermal receipt** (4.8); **cash drawer** (4.9); **timezone-correct day
boundaries** (4.10); **image compression, storage monitoring and a rehearsed restore** (4.14);
**per-tenant integration credentials as a gate** (4.11).

Ends with: Lead entered by hand → appointment → patient → consultation → treatment plan →
sessions created → payment → printed receipt → correct day book at 11pm.

### Phase 2 — Finance, inventory and commissions

*Goal: the owner can see what he actually earned, and stock reflects reality.*

Invoice decomposition into subtotal, discount, tax, total; **line-level refund allocation and
clawback** (4.5); `PaymentAllocation` (4.2 Phase-2 half); patient ledger and account statement;
advance payments and credit balance.

Inventory: item master with categories and units; per-branch stock; an immutable stock movement
ledger; **consumables issued against a treatment session with cost** (feeding 4.4); low-stock
alerts.

Commission: rules, the **append-only earning ledger**, **consumable-gated accrual** (4.4),
three-role beneficiary resolution (4.3 Phase-2 half), doctor earnings screen.

**Package lifecycle** (4.13) — gated on section 5 decisions 1–5.

Ends with: a completed session consumes stock at cost, the doctor's share appears on his own
screen, a refund claws it back correctly, and the P&L reconciles.

### Phase 3 — CRM, attendance and payroll

*Goal: the front of the funnel and the back office.*

CRM: the four already-built-but-unwired lead routes get screens (the cheapest win in the
project — roughly 4 days of pure frontend for a working follow-up system); pipeline board;
assignment; lost reasons; lead-to-appointment conversion carrying source and salesperson
through to attribution.

WhatsApp: inbound capture, outbound messaging on the per-tenant credentials from 4.11, and an
outbound message log. **Log messages from the first one sent** — its value is retroactive and
cannot be backfilled.

Attendance: **camera device binding and ingestion** (4.12), offline backfill, corrections.

Payroll: fixed salary plus attendance deductions plus commission from the Phase 2 ledger,
producing a payslip with real components.

---

## 7. Effort

The fourteen items add **64.5 raw developer-days**, ≈ **100 loaded** at the ×1.55 factor
established in `r1-05`. That factor was derived from this repo's own calibration — a ~400-line
page plus a ~400-line test is the house standard — and I am not discounting it.

| Item | Days | Phase |
|---|---|---|
| 4.1 Session materialisation | 3 | 1 |
| 4.2 Linkage spine | 6 | 1 / 2 |
| 4.3 Three roles | 5 | 1 / 2 |
| 4.4 Consumable-gated accrual | 4 | 2 |
| 4.5 Line-level refund and discount | 6 | 2 |
| 4.6 CSV import | 5 | 1 |
| 4.7 Provider schedules | 6 | 1 |
| 4.8 Thermal receipt | 1.5 | 1 |
| 4.9 Cash drawer | 3 | 1 |
| 4.10 Timezone | 5 | 1 |
| 4.11 Per-tenant credentials | 3 | 1 |
| 4.12 Camera binding | 5 | 3 |
| 4.13 Package lifecycle | 7 | 2 |
| 4.14 Images, storage, restore | 5 | 1 |

Phase 1 carries 37.5 of those days — deliberately, because eleven of the fourteen are either
unrecoverable-if-deferred or day-one rejection risks.

I am not putting calendar dates against the phases in this revision. The v1 estimate was
optimistic by ~1.6×, and quoting a date before the Phase 0 and Phase 1 sprints have produced
real velocity would repeat that mistake. **Recommendation: run Phase 0 plus the first three
Phase 1 increments, measure, then forecast.** The first honest date is roughly four weeks
away, not today.

---

## 8. Acceptance tests

Every one of these must exist as an adversarial suite in `app/backend/test/safety/`, in the
style of the 26 that already live there. The standing rule applies: **a suite must be red
against `main` before it is green against the branch**, or it is proving nothing.

| Suite | Asserts |
|---|---|
| `privilege_escalation_suite.py` | The four-call exploit ends in 403. |
| `golden_thread_suite.py` | Lead → … → report completes with no manual database edit. |
| `session_materialisation_suite.py` | 6-session plan yields exactly 6 sessions; re-accept is refused. |
| `commission_clawback_suite.py` | Refund reverses commission; no commission on returned money. |
| `consumable_accrual_suite.py` | Confirm-then-pay and pay-then-confirm agree; amendment nets correctly. |
| `stock_negative_suite.py` | Stock never goes negative under concurrent issue. |
| `note_immutability_suite.py` | A signed clinical note cannot be altered. |
| `timezone_dayboundary_suite.py` | 23:30 PKT payment lands in today's day book. |
| `cash_drawer_suite.py` | One open session per branch; variance computed correctly. |
| `import_dryrun_suite.py` | Dry run writes nothing; duplicates are reported, not created. |
| `whatsapp_tenant_isolation_suite.py` | A tenant with no connection row cannot send. |
