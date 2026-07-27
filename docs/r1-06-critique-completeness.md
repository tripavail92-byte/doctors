# Release 1 — Completeness Critique

_Release 1 replan — scoped to one aesthetic clinic, architecture kept universal._

I read the four audit documents and verified the plan's load-bearing claims against the live schema and source. Findings below.

---

# COMPLETENESS CRITIQUE — RELEASE 1 PLAN

## 1. The golden thread: three real dead-ends and two ordering contradictions

I walked all ten hops against the screen list, the workflow list and Table C. Seven hops close cleanly. Three do not.

### ✅ Hops that close
| Hop | Screen | Endpoint | Verdict |
|---|---|---|---|
| Lead entry | 7.1 | `POST /crm/leads` | closes |
| Lead → Appointment | 7.4 | `POST /crm/leads/:id/convert` (extended) | closes |
| → Patient | same transaction | — | closes |
| Patient → Consultation | 3.5 → 4.2 | `POST /encounters` | closes |
| Consultation → Plan | 4.2 → 4.6 | `POST /treatment-plans` | closes |
| Plan → Invoice → Payment | 4.7 → 5.1 | `POST /invoices {planId}`, `POST /invoices/:id/payments` | closes *(one role blocker, below)* |
| Session → Inventory | 4.10 | `POST /inventory/issues` | closes |
| Share → Report | 9.3 | `GET /reports/revenue-share` | closes |

### ❌ DEAD-END 1 — Nothing creates a `TreatmentSession`. This is the hop the release is named after.

`W5 step 5` assigns session creation to screen 4.7 (`POST /treatment-plans/:planId/items/:itemId/sessions`). But **screen 4.7's own "Must do" and endpoint columns do not contain it** — 4.7 lists only `GET /patients/:id/treatment-plans`, `POST /invoices {planId}`, `PATCH /treatment-plans/:id/status`, and its 2-day estimate has no session scheduler in it. Screen 4.9 (session board) and 4.10 (drawer) only *read, start and complete* sessions. Screen 3.1/3.2 book Appointments, which are a different model.

So in the built product, after the invoice is paid, the session board is empty and stays empty. `E2 golden_thread_suite` has the same hole — it says "TREATMENT starts and completes session" and never creates one. The demo (Scene 11) papers over it with "Zainab's package produced session cards **automatically**", which is a fourth, undocumented behaviour that appears in no screen, no workflow step and no Table C row.

**Decide and add:** either (a) sessions are auto-materialised on plan acceptance inside `createFromPlan` (cheapest, matches the demo — 0.5 BE d), or (b) an explicit "Schedule sessions" panel on 4.7 with date/room/provider per session (2 FE + 0.5 BE d). Pick (a) as the default *plus* (b) as a rescheduling affordance. **Cost: ~2.5 days. Currently zero.**

### ❌ DEAD-END 2 — Commission accrues before the consumable cost exists, so `PCT_AFTER_CONSUMABLE` is arithmetically undefined

W8 step 3 accrues inside `applyPayment`, and for `PCT_AFTER_CONSUMABLE` says "subtract the frozen `consumableCostPkr` snapshot from W7 step 3 first". But W6 (payment) precedes W7 (session) in the thread, and in the demo the payment is Scene 10 and the session is Scene 11. **At accrual time the session does not exist and the cost is zero**, so the after-consumable basis silently degrades into net-collection. For a six-session package paid on day one, it is wrong for all six.

C66 (1.5 d) assumes the cost is readable at accrual. It is not. The honest options are a **deferred/adjusting earning** (accrue provisional at payment, post a correcting `CONSUMABLE_ADJUSTMENT` earning row when the session completes) or **accrue at session completion for that basis only**. Either way it changes the ledger's key shape, which is exactly the kind of decision C61's idempotency unique key (`sourceType, sourceId, invoiceLineItemId, payeeUserId`) forecloses if chosen late. **Add 3 days to C61/C66 and decide before the ledger is written.**

### ❌ DEAD-END 3 — The person who is paid is not the person who performed

`InvoiceLineItem.performedById` is stamped at invoice creation, defaulting from `Appointment.providerId` or `Encounter.providerId` (W8 step 1). For a package invoice raised from a plan, **no appointment and no session exist yet** — the demo (Scene 9) admits this: lines carry "who **will** perform it". `TreatmentSession.performedById` (C42) records who actually did. **Nothing in the plan reconciles the two.** If Ayesha is off and Dr Bilal covers the laser, Ayesha's line still earns.

**Add:** on session completion, re-point the earning to `TreatmentSession.performedById` (or refuse completion by a performer who differs from the line without an explicit override that rewrites the line + reverses/re-accrues). **~2 BE days, plus a case in `commission_ledger_suite.py`.**

### ⚠️ Ordering contradiction — `Refund` has no line

Verified: `Refund` (`schema.prisma:1172-1187`) is invoice-scoped with no line linkage, and **no Table C row adds one**. W8 step 4 says refunds "write negative earnings against the same lines". Which lines? The demo's −1,090 is only correct if refunds are pro-rata across lines — a rule stated nowhere in the plan. A real clinic refunds a *specific* thing ("we're refunding the HydraFacial"), which is not pro-rata and pays the wrong doctor back. Same defect on the plan-level discount: screen 4.6 says "plan-level discount", C33 puts `discountPkr` on `InvoiceLineItem`, and the allocation rule between them is unwritten — the demo silently pushes the whole 6,000 onto the laser line.

**Add `RefundLine(refundId, invoiceLineItemId, amountPkr)` and a stated allocation rule for both discount and refund (pro-rata default, line-specific override). ~2 days.** Without it a developer will pick pro-rata under deadline and the first doctor to argue about a refund will be right.

### ⚠️ Role blocker the plan flags but never resolves

W5 step 4(b): `DOCTOR` is excluded from `FINANCE_ROLES` (verified, `role-groups.ts:26-31`), so the clinician who built the plan cannot press "Accept & create invoice" on screen 4.7. The plan says "either widen the conversion route's role list or make conversion an explicit reception action" and then never chooses. **This is a UI dead-end on the doctor's own chart.** Choose: conversion is reception-only, and 4.7 renders "Send to front desk" for DOCTOR. 0 days to decide, 0.5 to build.

### ⚠️ Two smaller structural gaps on the thread

- **`Appointment.service` is free text** (`schema.prisma:517`) and no Table C row adds `serviceCatalogItemId`. So the booked service can never be reconciled with the billed service, the calendar cannot derive duration reliably, and "revenue per booked service" is uncomputable. **~1 day, same migration as C22.**
- **`Invoice` has no `appointmentId`/`encounterId`.** Screen 9.1 promises reception "unpaid-at-desk"; there is no join from a checked-in appointment to an invoice. More importantly, **"which visits today were never billed"** — the single largest revenue leak in a cash clinic — is unanswerable. **~1 day.**
- `Encounter.appointmentId` (`:1578`) has no relation and no unique — two encounters per appointment are possible, and the queue→consultation handoff is two un-transacted calls.

### ⚠️ One sequencing bug that requires a manual DB edit

Increment 9 (week 17.5) ships "**Employee↔User link on the staff directory**" and `PATCH /hr/employees/:id`. But the staff/employee screen is **8.1 / C69, scheduled at week 36.5 (1C)**. `PayrollPage.tsx` today only does a `GET /hr/employees`; there is no create and no edit. So between weeks 17 and 36 the only way to create an Employee row or set `userId` is `demo-seed.ts` or psql. **Move the minimal employee create/edit dialog into increment 9 (+2 FE days) or accept that commission has no payee record until week 36.**

---

## 2. Partner's list: everything is present, but four items are materially weaker than named

| Partner item | Planned? | Concern |
|---|---|---|
| Clinic onboarding | ✅ 1.1/1.2, BE9 | — |
| Clinic Admin login | ✅ 0.1/0.2 | — |
| Staff setup | ⚠️ 2.1 (users) | See below — **"doctor/staff setup" ≠ user accounts** |
| Patients | ✅ 3.6/3.7, C12 | — |
| Appointments | ✅ 3.1–3.4, C24 | — |
| Consultation | ✅ 4.2, C15 | — |
| Treatment plans + sessions | ⚠️ 4.6/4.7/4.9/4.10 | Session creation missing (§1) |
| Billing / payments / outstanding | ✅ 5.1–5.6 | — |
| Basic doctor commission | ⚠️ C60/C61 | **Partner put it in 1B; plan lands it week 31.5, 3.5 weeks after the doors open.** Plan says this honestly — good — but the owner must sign off explicitly. |
| Basic consumable inventory | ✅ 6.1–6.5 | Two docs disagree on the entitlement key (below) |
| Issue inventory vs session | ✅ 4.10, C44 | — |
| CRM leads / pipeline / assignment / follow-up | ✅ 7.1–7.4, C52–C56 | — |
| Camera attendance | ⚠️ C72/C74 | See §3 |
| Fixed-salary payroll | ✅ C70/C71 | — |
| Doctor + salesperson commission | ✅ C61/C75 | — |
| Basic management dashboard | ✅ 9.1/9.3 | — |

**The one genuinely dropped item:** the partner's 1B says "**doctor/staff setup**". The plan delivers login accounts (2.1) and clinic-wide working hours (C4) — but **no per-provider availability**: no doctor working days, no leave, no "Dr Bilal doesn't work Tuesdays". `ProviderSchedule` is explicitly deferred in D14. The consequence is immediate and receptionist-visible: a calendar with provider columns where every provider looks available every hour the clinic is open, so reception books a doctor on his day off and finds out when he doesn't show. The `EXCLUDE` constraint prevents double-booking, not booking into absence.

**Add: `ProviderSchedule` (providerId, dayOfWeek, start, end) + `ProviderTimeOff`, greyed-out columns on the calendar, a soft warning on booking. ~3 BE + 2 FE days.** This is the cheapest thing in this critique that the front desk will notice on day one.

**Inconsistency to resolve:** the screens doc (Group 6) introduces a **new `inventory.core` key in `CLINIC_ADDONS` and a new `/inventory/*` controller**, while the modules doc B10 says add **`pharmacy.core` (or split `inventory.core`) to `DERMATOLOGY_FEATURES`**, and B25 fixes roles on the existing `pharmacy.controller.ts`. Two documents, two different keys, two different bundles, and no statement of whether the retail POS/`PharmacyPage` survives. Verified `CLINIC_ADDONS = ['reporting.core','crm.core','media.core','packs.core']` (`editions.ts:65`) — adding either key there works for DERMATOLOGY, so pick one and delete the other sentence.

---

## 3. Camera attendance: the seam is the right idea and the wrong shape

What the plan has is correct as far as it goes — `AttendanceProvider` seam, `AttendanceDevice`/`AttendanceEvent`/materialised `AttendanceDay`, `@@unique([tenantId, deviceId, externalEventId])`, HMAC-signed ingest, mandatory manual punch, adapter marked unschedulable. Verified there is currently **zero** attendance code anywhere. Four things are missing, and three of them are what actually make it "real work now, credential swap later":

1. **No employee↔device identity mapping.** A ZKTeco/Hikvision device emits *its own* enrollment number, not your `Employee` uuid. Without `AttendanceEvent.externalPersonId` + an `EmployeeDeviceBinding(deviceId, externalPersonId, employeeId)` table and an enrollment screen, C74 is not an adapter — it is a rewrite of ingest plus a data-entry crisis on install day. **~1.5 days, and it is the single highest-leverage addition here.**

2. **The webhook assumption is probably wrong for this market.** Pakistani clinics buy ZKTeco or Hikvision. ZKTeco pushes over its own ADMS/iClock protocol or is polled via SDK; it does not send you an HMAC JSON webhook. **Define `POST /attendance/ingest` as the internal contract and make the adapter a small pull/relay worker** (a local agent or a poller), so the seam survives whatever device is bought. The plan's current shape quietly constrains the procurement decision.

3. **No offline backfill / late-event policy.** The camera buffers punches during a power cut and dumps them the next day. `AttendanceDay` is materialised (correctly), so ingest must accept a batch with old timestamps and **re-materialise closed days** — and there is no stated rule for what happens if payroll for that period is already `FINALIZED`. That is the same class as the refund-after-payroll case the plan already handles for commission; do the same thing here (adjustment in the next period, never a silent edit of a finalised run). **~1.5 days.**

4. **Device secret storage is unspecified.** "HMAC-signed" — where does the secret live? If it lands in `.env` you have reproduced the WhatsApp defect (§4) in a new module. Per-device secret, hashed at rest, rotatable from the device screen. **~0.5 day.**

Also missing: `deviceTimestamp` **and** `receivedAt` as separate columns (device clock skew is the most common attendance dispute), and a fixture device so the whole path is testable with recorded payloads today — which the plan does correctly for Meta and should copy verbatim here.

**Total to make the seam genuinely credential-swappable: ~4 days on top of C72's 7.** The plan currently forbids fabricating credentials (right) but has not made the pre-hardware work sufficient.

---

## 4. WhatsApp: the multi-tenant leak is real, and the plan's gate fires too late

Verified: `WhatsAppService` reads `config.get('integrations').whatsapp` **in its constructor** (`whatsapp.service.ts:39-42`) — a process-global singleton captured at boot. `mode()` returns `'live'` for *every* tenant as soon as one `phoneNumberId` + `accessToken` are set.

The plan's gate is "**a HARD GATE on the second paying integration customer**". That is the wrong trigger, for three reasons:

1. **`integrations.core` is in `SPECIALTY_SHARED`** (`editions.ts:78`), which is spread into DERMATOLOGY, DENTAL, OBGYN, PEDIATRICS, OPHTHALMOLOGY, PHYSIOTHERAPY, SPECIALTY, HOSPITAL and ENTERPRISE — **9 of 13 editions**. It is not a paid add-on you can count customers of; it ships with nearly every edition by default.
2. The leak does not require a *paying* second customer. It requires a **second tenant row on the same box** — which includes the demo tenant, any prospect trial, and the ~66 probe tenants the safety suites leave behind per run (recorded in project memory). The plan's own demo-hygiene note acknowledges those probe tenants exist.
3. `mode()` flipping globally means the day the credential is set, a *stub-mode* tenant silently becomes a live-mode tenant. There is no per-tenant kill switch.

So: **no, the plan does not fix this before a real credential is added**, and as written the first real credential on a shared box is a cross-tenant identity leak and a Meta policy breach on day one.

**Recommendation — do the minimum now, not the full `IntegrationConnection` CRUD:**
- Add `TenantIntegrationCredential(tenantId, provider, phoneNumberId, accessTokenEnc, wabaId, appSecret, isActive)` — write-only from a platform-admin path, no tenant-facing UI.
- Refactor `WhatsAppService` to resolve credentials **per call from `TenantCtx`**, not in the constructor; `mode()` becomes per-tenant.
- **Fail closed:** if a tenant has no credential row, send returns stub and says so in the response — never fall back to the global env var. Delete the global read entirely rather than leaving it as a default.
- One safety case in `E1`: two tenants, one credentialed → assert the uncredentialed tenant's send is stub and never touches Meta.

**Cost ~3 days.** It is cheaper than the C57 public-ingestion substrate the plan already accepts, and it removes the only item in the release that can breach a third-party platform policy. Note the same defect exists in `fbr.service.ts:39` (process-global NTN) — the plan hides the FBR button, which is an adequate answer *only* while the button stays hidden.

---

## 5. Dangerously implicit decisions

These will be decided by one developer, at 6pm, alone, and several of them are irreversible.

**Financially load-bearing:**

1. **Are catalogue prices tax-inclusive or tax-exclusive?** Never stated anywhere in 354 pages of plan. In Pakistan retail prices are quoted inclusive. If C32 assumes exclusive, every printed price and every quote is wrong by the tax rate, and the fix is a re-price of the whole catalogue. The demo dodges it by setting tax to 0%. **Decide in writing, put it on `ClinicProfile` as an explicit flag, and print the convention on the invoice.**
2. **Refund and discount allocation across lines** (§1) — pro-rata vs line-specific. Affects who gets clawed back.
3. **Partial-payment allocation across lines** — the plan says pro-rata, which is fine, but a patient paying "for the Botox only" is normal and unexpressible.
4. **Can an unallocated credit be refunded in cash?** `POST /invoices/:id/refunds` is invoice-scoped; C37 creates credits with no exit path. Dead end at the desk.
5. **Rounding convention for tax** — per line or per invoice. Causes a 1-rupee mismatch on the printed document and a support call.
6. **Discount cap tiers "in config"** (C33) — no table, no screen, no owner. It will become a hardcoded constant and the owner will never be able to change it.

**Clinically / operationally load-bearing:**

7. **Does a session relate to an appointment 1:1 or 1:N?** Demo Scene 11 runs three sessions inside one visit, so it is 1:N — but then `PATCH /appointments/:id/complete` and `PATCH /sessions/:id/complete` are two state machines a nurse must drive separately, and nobody said which one the queue board reads. Also: does completing the last session complete the appointment?
8. **Can a session be performed on an unpaid invoice?** The demo happily delivers all three treatments on a 40% deposit. There is no gate, no warning, no policy field. Every clinic owner has an opinion about this and it is not in the product.
9. **What happens when a patient abandons a package at 3 of 6?** Revenue is recognised on sale (correct), but the plan has no expiry, no `TreatmentPlan` cancellation-with-valuation, and `COMPLETED` requires all sessions done — so the plan sits `ACCEPTED` forever and the "sessions due" list grows monotonically. Needs a cancel path with an unused-session decision (forfeit / credit / refund).
10. **Does a no-show burn a prepaid session?** `NO_SHOW` exists in the session transitions; nothing says whether `sessionsCompleted` increments. Default will be "no", so the clinic eats every missed slot. Make it an owner-configurable flag or at minimum a documented, demoable choice.
11. **Timezone of "today".** `ClinicProfile` carries a timezone (C3) but no report, dashboard or day-book is stated to use it. The server is UTC; the clinic closes at 20:00 PKT = 15:00 UTC. Every evening's takings will fall into the wrong day at day-close. **This will be found on day one, by the receptionist, at the moment of maximum trust damage. ~1.5 days to thread the tz through the range queries — free if decided now.**
12. **Deleting/deactivating a catalogue item that sits on an active plan.**

---

## 6. What makes the clinic reject it on day one, with every ticket closed

Thinking as the receptionist and the owner, not the developer:

1. **The patient database is empty.** The clinic has 400 existing patients in Excel and a paper appointment book. **There is no data import anywhere in the plan** — not in Table C, not in the screen list; the timeline mentions "data migration rehearsal" in a buffer with no tooling scoped. Day one, reception runs two systems, searches the old Excel first, and within a week the product is "the thing we type into afterwards". **Add a CSV import for patients and the service catalogue with a dry-run/preview and a duplicate report: ~4 days.** This is the highest-probability rejection cause on this list.

2. **Receipts will print wrong.** `<PrintableDocument>` (U8) is an A4 `@media print` stylesheet. A Lahore clinic desk has an 80mm (or 58mm) thermal receipt printer. An A4 layout on a thermal roll is unusable, and "print a receipt" is the single most frequent physical action at the desk. **Add a thermal receipt stylesheet: ~1 day.** Also: nobody has decided whether the clinic *has* a printer, or whether the receipt is a WhatsApp message.

3. **No cash-drawer session.** Explicitly deferred ("discrepancies are noted, not enforced — no `CashDrawerSession` model"). In a cash business with a shift change, "who was short PKR 3,000 yesterday" is the owner's first real question and the product cannot answer it. The day-book shows a clinic total, not a cashier's total. **~2.5 days** and it converts the day-close screen from informational into a control.

4. **No automated reminders.** The manual WhatsApp button is a correct engineering decision and a wrong operational one: nobody presses it at 7pm. No-shows are the dominant economic problem in aesthetics. The owner will ask for this in week one and hear "that needs a scheduler substrate". **Either accept it explicitly with the owner before go-live, or budget the ~8-day scheduler and put reminders in 1C.** Do not let it be discovered.

5. **Registration is too slow for a queue.** Screen 3.7 is a single dialog with ~18 demographic fields plus custom fields. With three people waiting, reception will type a name and a phone and skip the rest — and then CNIC-based duplicate prevention (C12) never fires, because CNIC is the field they skipped. **State the required-field set explicitly (name, phone, gender, DOB-or-age) and make everything else deferrable from the chart.** Also: duplicate defence is MRN + CNIC only — **there is no phone-number duplicate check**, and phone is the field that is always captured. Add a soft duplicate warning on phone: ~0.5 day.

6. **The internet and the power will go down.** No offline story, no "the system is down" fallback, no printed day sheet. This may be unsolvable in Release 1, but the *answer* must exist before go-live: a printable day sheet the desk can fall back to, and a documented reconnection procedure. Currently the plan is silent, so the first outage looks like the product failing.

7. **Photos will fill the disk.** `storage.service.ts` writes to local disk, no quota, no S3 in Release 1, and before/after photography is the headline feature. Six months of tablet-resolution pairs on one VM is a foreseeable outage with clinical data in it. **Add: image downscaling on upload + a disk alert. ~1 day.** S3 can stay deferred.

8. **No backup/restore that anyone has watched work.** Not in the plan at all. The owner's second question after "can it do X" is "what if it breaks". A verified restore drill before go-live: ~2 days.

9. **Expectation gap against the 108 mockups.** The proposal artefacts in `docs/` (`admin-dashboard-mockup.html`, the deck PNGs, `frontend/screens/`) are richer than what 158 frontend-days will produce. The owner has seen them. Show him the real increment-6 screens beside the mockup early and reset the expectation deliberately, rather than at acceptance.

10. **Doctors get no earnings screen at go-live.** The clinic opens at week 28; commission ships at week 31.5. The plan is honest about this, but the *doctors* have not been told, and a doctor on a 30% split who cannot see his number in the system will keep his own notebook — and then the two will disagree.

---

## Summary of recommended additions

| # | Addition | Days | Why |
|---|---|---|---|
| 1 | Session materialisation on plan acceptance (+ reschedule affordance) | 2.5 | Golden thread dead-end |
| 2 | Performer reconciliation: session performer ⇄ invoice line | 2 | Wrong doctor gets paid |
| 3 | `RefundLine` + stated discount/refund allocation rule | 2 | Refund clawback is undefined |
| 4 | After-consumable accrual ordering (adjusting earning) | 3 | Basis is arithmetically undefined |
| 5 | `Appointment.serviceCatalogItemId` + `Invoice.appointmentId` | 2 | "Which visits weren't billed" |
| 6 | `ProviderSchedule` + `ProviderTimeOff` + calendar greyout | 5 | Partner's "doctor/staff setup"; booking into absence |
| 7 | Per-tenant WhatsApp credential, fail-closed | 3 | Cross-tenant identity leak on first real credential |
| 8 | Attendance: device↔employee binding, offline backfill, per-device secret | 4 | Makes C74 a swap, not a rewrite |
| 9 | Patient + catalogue CSV import with dry-run | 4 | Highest day-one rejection risk |
| 10 | Cash drawer session | 2.5 | Cash business, shift change |
| 11 | Thermal receipt stylesheet | 1 | The desk's most frequent action |
| 12 | Timezone-correct reporting boundaries | 1.5 | Every evening's takings land on the wrong day |
| 13 | Employee create/edit dialog moved into increment 9 | 2 | Otherwise psql between weeks 17–36 |
| 14 | Image downscale + disk alert; verified restore drill | 3 | Foreseeable outage with clinical data |
| **Total** | | **~37.5 raw days (~56 loaded at ×1.5)** | **≈ +1.5 weeks on Option C** |

Twelve decisions cost nothing but must be written down before the code is: tax-inclusive vs exclusive; session↔appointment cardinality; whether an unpaid invoice blocks a session; package abandonment; no-show burns a session; who converts a plan to an invoice; credit refundability; tax rounding; discount cap ownership; `inventory.core` vs `pharmacy.core`; the day-boundary timezone; and whether the doctors know their earnings screen arrives 3.5 weeks after the doors open.

The plan is strong — the traps section, the unrecoverable/additive asymmetry, and the refusal to accept a service-layer overlap check are all correct and unusually well-argued. The gaps above are concentrated in exactly one place: **the seam between the sold thing (plan/invoice) and the performed thing (session)**, which is also the seam where the money is attributed. That is the part to harden before increment 9 locks the columns.