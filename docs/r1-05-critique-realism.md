# Release 1 — Realism Critique

_Release 1 replan — scoped to one aesthetic clinic, architecture kept universal._

# Realism attack on the Release 1 plan

I read the code the plan cites. **The judgement in this plan is largely sound and several of its central calls are verifiably correct. The arithmetic is not.** My headline: it is optimistic by roughly 1.6×, and the two biggest problems are (a) one item costed at 4 days that cannot be done as described at all, and (b) an entire category of go-live work — deployment, timezone, backup, data import, and supporting a live clinic for 13 weeks — that appears nowhere.

First, what I verified as true, so the rest is read in context:

- **The privilege escalation is live and exactly as described.** `app/backend/src/rbac/roles.guard.ts:38` is `if (!required.includes(user.role as UserRole))` — `isPlatformAdmin` is used only as a *bypass* at `:34`, never as corroboration. `platform/dto/hierarchy/create-membership.dto.ts:8` is a bare `@IsEnum(UserRole)`; `org-hierarchy.service.ts:157-166` writes `role: dto.role` verbatim; `auth.service.ts:196-206` signs it with `isPlatformAdmin: false`. `platform-tenants.controller.ts:22` is `@Roles(UserRole.PLATFORM_ADMIN)`. The four-call exploit works. (`auth/guards/roles.guard.ts` is a one-line re-export shim, so there is only one guard to fix — the plan's fix location is right.)
- **`appointments.service.ts` is 63 lines** and is precisely the three defects claimed: `list()` has no filter/pagination and `include: { patient: true }`; `updateStatus` writes any status after an existence check; `create` inserts blind with no `ensurePatient`/`ensureProvider`, no `start < end`, no overlap check.
- **`constraints.sql` contains 3 partial unique indexes and zero CHECKs**, while `billing.service.ts:33` docblock states "a CHECK (paid <= total) backstops overpayment." Confirmed: the documentation lies about safety.
- **`createFromPlan` at `billing.service.ts:502-504`** maps only `{code, name, unitPricePkr, quantity}` — `serviceCatalogItemId` is dropped. **`InvoiceLineItem` (`schema.prisma:597-617`) has neither `serviceCatalogItemId` nor `performedById`.** **`Employee` (`schema.prisma:859-882`) has no `userId`.**
- **`editions.ts:65`** — `CLINIC_ADDONS = ['reporting.core','crm.core','media.core','packs.core']`. No `hr.core`, no `pharmacy.core`. `media.core` is there. Confirmed.
- **`nav.ts:86-95`** — `filterNav(groups, entitlements)` filters on `item.requires` only. No role predicate. Confirmed.
- **`AuthContext.tsx:55-62`** — `fetchEntitlements` has `catch { return []; }`. Confirmed.
- **`prisma/rls.sql` is 653 lines / 86 policies, and the CI workflow at `.github/workflows/ci.yml` really does run all 26 safety suites against a real Postgres as the non-bypassing `healthos_app` role.** The RLS work is as good as claimed. So is the FEFO/deterministic-lock engine at `pharmacy.service.ts:134-176` — the lock-ordering comment documents 19-of-20 deadlocks reproduced. The plan is right to extract it rather than copy it.

Now the attack.

---

## 1. Indefensible day estimates

### BE8 — auto-stamp Prisma client extension, 4 days. This is the worst number in the plan, and it may not be buildable as described.

`PrismaService extends PrismaClient` (`common/prisma/prisma.service.ts:29-31`) and is injected **by class** into ~30 services. `$extends` returns a *new client object of a different type*; it does not mutate `this`. To use one you must restructure `PrismaService` to hold an extended client and delegate — which changes `TenantTransaction = Prisma.TransactionClient` (`:25`), and that type is threaded through free functions across the codebase (`ensurePatient(tx, …)`, `nextMrn(tx, …)`, `nextReceipt(tx, …)`).

Worse, a `query` extension **does not rewrite nested writes**. `pharmacy.service.ts:198-206` writes `batches: { create: drawn[i].map(...) }`. The extension receives `args` and would have to walk the nested `create`/`createMany`/`connectOrCreate` tree itself, per model, knowing which nested models carry branch columns. I counted the write surface: **74 `.create({`, 20 `.upsert({`, 9 `createMany`, and 13 `$executeRaw`/`$executeRawUnsafe` sites** — several of the last are writes (`fbr.service.ts:91,112`, `dermatology.service.ts:537`) that an extension can never see.

And the "CI guard" is a new static-analysis script in the shape of `check-rls-coverage.ts`, which is ~200 lines of Prisma-schema parsing.

**My number: 11 days**, plus the plan's 5-day spike, and I expect the spike to conclude "extension for top-level creates, hand-edit for nested and raw." The plan's stated fallback of "+8 days for hand-editing ~30 create sites" is also wrong — it is ~103 sites, many in free functions with no `getTenant()` in scope. Fallback is +18, not +8.

This also directly contradicts Table A1's "**`common/prisma` — do not touch**." BE8 requires touching exactly that file. The plan does not notice the contradiction.

### BE5 — Users module, 7 days.

Underscoped. `User` is the **one model with a bespoke RLS policy** (`rls.sql:31-32`: "`User` is NOT policied here — it needs a bespoke setup (login runs before tenant context exists). See `prisma/rls-user.sql`"). So user CRUD is not ordinary CRUD. Then `tokenVersion` enforcement means `JwtStrategy.validate` — which today does **zero DB reads** (`jwt.strategy.ts:53-67`) and has no `PrismaService` injected — gains a per-request lookup that must go through a SECURITY DEFINER path because platform admins carry `tenantId: null`. Add password policy, reset, `POST /auth/change-password`, membership update/revoke, and `staff_management_suite.py`. **11 days.**

### BE4 — `@Roles` sweep, 2 days.

I counted the actual gap with a script over all `*.controller.ts`: **207 handlers, 66 without `@Roles` at handler or class level** — not 39. Worst offenders: `obstetrics` (13), `imaging` (9), `observations` (7), `dermatology` (6), `packs` (5), `catalog` (4), `dosing` (4). And `modules/patients/patients.controller.ts:33-41` confirms `GET /patients` and `GET /patients/:id` are open to any authenticated role holding `patients.core`. The sweep is not mechanical — deciding which of 8 roles may read the PHI roster is a product decision per route — and `check-role-coverage.ts` has to be written from scratch. **3.5 days**, and `AppShell.test.tsx`'s 8-role matrix can't be written until BE5 lands, so part of it is re-done.

### BE21 — commission ledger, 13 days (of which 3 is the suite).

That leaves 10 days for pro-rata allocation across invoice lines, basis-point arithmetic with an explicit `CLINIC_RESIDUAL` row, effective-dated rule resolution, negative reversal on refund, an idempotency unique key, and integration **inside `applyPayment`'s existing row-locked transaction** (`billing.service.ts:402-441`) which already carries `billing_money_suite.py`. This is money code in a codebase whose own memory says green suites twice certified broken safety code. **18 days.**

### BE12 — appointments, 10.5 days.

The `EXCLUDE` constraint needs `CREATE EXTENSION btree_gist` (mixing uuid equality with a range) — **there is no `CREATE EXTENSION` anywhere in `prisma/`** today, so that's a new step in the deploy runbook and in CI. It must also key on `tenantId`, because **an EXCLUDE constraint is enforced globally, not per-RLS-policy** — get that wrong and Dr. Bilal in Lahore blocks a booking in another tenant. Plus 5 new endpoints, `AppointmentStatusEvent` (+RLS policy +coverage entry), reschedule, day-sheet, walk-in transaction, indexes, concurrency suite. **14 days.**

### BE11 — attribution columns, 2 days.

Nearly right, and I agree it is the best ratio in the project. But `Encounter.providerId` (`schema.prisma:1579`) is a **nullable uuid with no `@relation` and no FK** — so "default the performer from `Encounter.providerId`" accepts a cross-tenant uuid today. And the two new fields must forward through `expandLaterality`, where one input becomes two lines. **4 days.**

### The frontend convention itself: 124.5 days for 52 screens = 2.4 days/screen.

Calibrate against the repo. Existing pages: `BillingPage.tsx` 677 lines / test 474; `PharmacyPage.tsx` 553; `PayrollPage.tsx` 444; `PhototherapyPage.tsx` 432 / test 446. **The house standard is ~400 LOC page + ~400 LOC jsdom test**, and E6 requires vitest coverage for the new screens. At 2.4 days that is ~330 LOC/day including a real test, four states, and MUI form plumbing. **Screens: ~195 days, not 124.5.**

Specific offenders: **2.2 Clinic settings (4 tabs) at 4 days → 6.** **3.1 calendar 5 + U6 `<CalendarGrid>` 5 → 14-16 combined**, because `app/web/package.json` has **no date library at all** — no `date-fns`, no `dayjs`, no `@mui/x-date-pickers`, no `luxon`. Every date input across 52 screens is currently a raw `<TextField type="date">`, and a hand-rolled resource calendar with a now-line in Asia/Karachi has to do its own date math. Adopting `@mui/x-date-pickers` is a dependency decision the plan never makes.

**U1 `<PackFormRenderer>` 3 days → 5.** The plan says "port `aesthetic-workspace.html:140-166`, do not redesign it." That file is plain DOM. Porting seven field types into MUI `Select`/`Autocomplete` is a redesign, and this project's own memory records that MUI Select cannot be driven by browser automation — so all seven types need jsdom tests.

**U3 `useApi` v2, 2 days → 4**, and I'd push back on the architecture call. The hook's dep array is `[tick, ...deps]` (`useApi.ts:78`) — a variable-length dependency array. Adding mutations *and* cross-component cache invalidation to a hand-rolled hook with no store is exactly where hand-rolled costs 3×. TanStack Query for new screens only is a 2-day adoption that removes the invalidation problem entirely. This is the one architectural decision in the plan I'd reverse.

**U5 error taxonomy, 1.5 days** — includes a backend change (tagging both guards' `ForbiddenException` with codes) that appears nowhere in the BE table. Small, but it shows the FE/BE separation the estimating convention claims isn't clean.

---

## 2. What the plan omits entirely

These are not refinements. Several are go-live blockers.

**Timezone. Not mentioned once.** `prisma.service.ts:102-146` `assertUtcSession()` **refuses to boot** unless the DB session is UTC and stays UTC across a six-month probe, and `docs/deploy-railway.md` sets `TZ=UTC` on both services. The clinic is Asia/Karachi, UTC+5. Every day-boundary feature in Release 1 — day sheet, day book, `GET /dashboard/today`, `/reports?from&to`, `AttendanceDay` materialization, payroll period, "next session due" — needs an explicit clinic-timezone→UTC-instant conversion in one shared helper. `ClinicProfile.timezone` is listed in C3 and then never used. **5 days**, including a suite that sets the clock to 23:30 PKT and asserts the day book.

**Deployment and per-release migration. 8 days.** `docs/deploy-railway.md` states plainly that the Railway parts "have **not** been run against a live Railway project." There is no automated migration step: it is a hand-run one-shot doing `prisma migrate deploy` then **four psql files** (`rls.sql`, `rls-roles.sql`, `rls-user.sql`, `constraints.sql`) then seed then `check-rls-live`. Release 1 adds ~30 tables and ~30 columns across 24 increments; every one of those touches `rls.sql` and possibly `constraints.sql`. This needs a repeatable script, a staging environment, and one rehearsed rollback.

**Backup and restore. 3 days + recurring.** Zero mention anywhere. A clinic goes live in February with PKR in Railway Postgres and clinical photographs on a single mounted volume, with no documented backup, no restore rehearsal, no PITR.

**Photo storage on Railway. 4 days.** `media.service.ts:81` calls `this.storage.put(buffer)` **before and outside** the `forTenant` transaction that creates `PhotoAsset` — a failed insert orphans the bytes forever with no reaper. `storage.service.ts:22` is `process.env.STORAGE_DIR` on local disk, unaccounted, no size cap, no S3 adapter written. The deploy doc's own warning ("This cannot be retrofitted after photos exist") is correct and the plan doesn't carry it.

**RLS policies for ~30 new tables. +6 days.** Release 1 introduces roughly: ClinicProfile, WorkingHours, ClinicHoliday, Room, ClinicPaymentMethod, TenantCustomField, PatientAllergy, PatientMedication, NoteAmendment, AppointmentStatusEvent, TreatmentSession, PlanSessionRedemption, InventoryItem, StockIssue, StockIssueLine, StockIssueLineBatch, StockMovement, ServiceConsumable, PatientLedgerEntry, PatientAccount, PaymentAllocation, CommissionRule, CommissionEarning, Message, WebhookEvent, FormBinding, PayslipComponent, AttendanceDevice, AttendanceEvent, AttendanceDay. Each needs an `ENABLE`/`FORCE` + a policy in the canonical `nullif()` form (`rls.sql:20-21` — get the shape wrong and it 500s on a pooled connection), plus a `check-rls-coverage.ts` pass and a live probe. Folded into C50/BE18 today; it is real, unavoidable, and cannot be batched at the end because the coverage guard fails the build immediately.

**Seed and demo data as a maintained artifact. 5 days.** `prisma/seed.ts`, `prisma/demo-seed.ts` and `scripts/demo-reset.ts` all exist — good — but ~30 new tables must be taught to all three, and the demo script's opening line depends on a clean reset. C49 costs 1 day for the consumable list and nothing else. This is the thing that silently rots and then eats demo day.

**`SEED_PASSWORD` × the new Users module. 0.5 days.** `seed.ts:45-71` refuses to run under `NODE_ENV=production` without `SEED_PASSWORD` because it mints a PLATFORM_ADMIN. Once C1 ships `mustChangePassword`/`tokenVersion`, the seeded platform admin **and** the seeded owner must be flagged `mustChangePassword`, or the guard is decorative and go-live ships with a known-shaped credential.

**Hardening the first public route. 2 days.** `package.json` has no `@nestjs/throttler` and no `helmet`. C57's `POST /public/forms/:formKey` is the first unauthenticated endpoint in a product whose entire tenant model derives from a JWT. It needs throttling, a body cap distinct from `main.ts`'s 10 MB JSON limit, and signature-before-parse. Belongs in 1A, not 1C.

**Observability. 3 days.** No structured logging, no error tracking. Going live with money and PHI where the only diagnostic is `AuditLog` rows you read with psql.

**Data import from the clinic's existing records. 4 days.** A trading Lahore clinic has a patient spreadsheet. There is no importer. MRN is minted `MAX(P-nnnnn)` under an advisory lock (`patients.service.ts:41-59`) and C12's new CNIC partial unique index will reject exactly the duplicates a real spreadsheet contains. Without an importer with a dry-run and duplicate report, reception re-types 800 patients.

**Printing. +3 days.** U8 at 2 days is right for the `@media print` shell, but there are **five** documents (invoice/receipt, statement, quote, Rx, payslip), each with its own A4 layout — and print output is untestable in the jsdom harness, so it gets verified by eye or not at all. Say that out loud.

**Urdu. 1.5 days.** "English only" is a fine UI scope call, but the *data* won't be: patient names and addresses arrive in Urdu or Roman-Urdu. Concretely: the trigram patient search needs `CREATE EXTENSION pg_trgm` (none exists in `prisma/` today, same Railway consideration as `btree_gist`), and a printed invoice needs an Urdu-capable font, which a default MUI stack will not give you.

**Supporting a live customer for 13 weeks. ~20 days.** This is the largest omission in the timeline. Increment 15 opens the clinic; "2 weeks pilot hardening" sits at the *end*, three months later. In between, a real clinic trades on software being changed underneath it, with zero budgeted hours for hotfixes, support or on-call.

---

## 3. "Complete and reusable as-is" — where the code disagrees

**`media`.** The strongest of the claims and about 85% true, but not "complete":
- `media.service.ts:81-92` — bytes are written to storage *outside* the transaction that inserts `PhotoAsset`. Orphans on failure, no reaper, unbounded volume growth on Railway.
- `media.controller.ts` takes base64 in JSON; `main.ts:67` caps JSON at 10 MB and `MAX_IMAGE_BYTES` is 6 MB. A phone photo base64-encoded is +33%. It works, barely, with no client downscale. **There is no multer, no `FileInterceptor`, no multipart config anywhere in the backend** — so U12's "the component needs a multipart path alongside" is an uncosted backend task.
- `PhotoSession` carries `kind`/`label`/`area` but no pose enum, which 4.8's side-by-side compare wants to key on.

Reusable: yes. Complete: no. Add ~2 backend days to "4.8 is a screen-only build."

**`storage`.** Table A1 quotes the file's own comment — "production swaps in an S3 adapter … without any change to callers" (`storage.service.ts:12-16`) — as if it were a verified fact. It isn't: `GET /photos/:assetId/raw` streams a `Buffer` from `readBuffer`, and an S3 adapter returning presigned URLs changes that controller. Small rewrite, not a swap, and **no adapter exists.**

**`entitlements` mechanism.** Sound, agreed. But B10's "0.5 days, cheapest win" understates the *decision*: `CLINIC_ADDONS` (`editions.ts:65`) is spread into ten editions (`editions.ts:125-135` — CLINIC, SPECIALTY, DERMATOLOGY, DENTAL, OBGYN, PEDIATRICS, OPHTHALMOLOGY, PHYSIOTHERAPY, LAB, PHARMACY). Adding `hr.core` there ships payroll to every clinic-tier customer. That is a pricing change, not a bug fix.

**`observations` as the reference for `PackFormRenderer`.** `TrendsPage.tsx` renders *charts from definitions*, not *forms from field schemas*. The genuine reference is `public/aesthetic-workspace.html:140-166`, which is plain DOM. Different problem.

**`common/prisma` "do not touch."** Correct as advice and incompatible with BE8, as above.

---

## 4. Team size

**The plan diagnoses the critical path correctly and then puts the single point of failure on the wrong side of the stack.**

At my corrected frontend number (~195 screen days + ~42 primitive days = 237), one frontend engineer at 4.5 d/wk needs **~53 weeks of frontend alone** against a 41.5-week program. The plan itself admits Engineer C is 87% loaded with no slack; at my numbers C is over 100%. Meanwhile the plan also admits **15-20% idle backend capacity through all of 1A**. So the backend pair is unsaturated early while the frontend is oversubscribed throughout.

Recommendation: **2 backend + 2 frontend, with the second frontend engineer joining in week 5** (once 1A has enough screen work to absorb them). That is the plan's Option D, but the justification is not "5 weeks faster for 33% more cost" — it is that Option C has no survivable failure mode. Two weeks of C's absence slips the calendar, the consultation screen and the session board, all of which are on the critical path.

Two corrections to the capacity model:
- The multi-person discounts (2 ≈ 1.8×, 3 ≈ 2.6×, 4 ≈ 3.2×) are generous for a codebase this coupled — the money spine, the branch extension and `PackFormRenderer` are shared by every stream. Use 3 ≈ 2.4×, 4 ≈ 2.9×.
- **The "~30 week floor at any team size" is wrong.** The chain the plan draws, at my corrected numbers, is ~175 loaded days ≈ **39 weeks single-threaded.** No team beats that. This narrows Option D's calendar advantage over C — but widens its risk advantage, which is the real argument.

---

## 5. Corrected headline

| | Plan | Mine |
|---|---|---|
| Raw bottom-up | 302 | **467** |
| — backend underestimates | | +41 |
| — frontend underestimates | | +79 |
| — omitted work (§2) | | +45 |
| Multiplier | ×1.5 | **×1.55** |
| Loaded developer-days | 453 | **724** |
| + live-customer support Feb→Sep | 0 | +20 |
| **Total** | **453** | **~745** |

I accept the plan's multiplier reasoning almost entirely — the traces genuinely carry ~23 raw days of explicit adversarial test work, which most estimates omit, and I have moved what a larger multiplier would have covered into named line items instead. Going above 1.6 would double-count.

**Calendar, 2 BE + 2 FE (2.9× × 4.5 d/wk = 13.05 d/wk), start 3 Aug 2026:**

| Milestone | Plan | Mine |
|---|---|---|
| Clinic opens its doors | 15 Feb 2027 (wk 28) | **~late Apr 2027 (wk 38)** |
| Release 1 complete | 20 May 2027 (wk 41.5) | **~mid-Sep 2027 (wk 59, incl. 2 wks UAT)** |
| Floor at any team size | ~30 wks | **~39 wks** |

At the plan's recommended Option C (2 BE + 1 FE), it is ~69 weeks, with the frontend as a single point of failure for fifteen months. I would not run it that way.

**Confidence: moderate on effort (±20%), low-to-moderate on calendar (±25%), high on direction.** I am confident the plan is optimistic by ~1.6×; less confident where exactly it lands. The largest single swing is BE8: if the `$extends` spike succeeds cleanly it is worth ~8 days; if it fails it is ~25 spread across the release, and that alone moves the total by 4%. **Run that spike in week 1, not week 5** — it is the only item whose outcome changes the shape of every subsequent increment.

---

**Where the plan is right, and should not be re-litigated:** the asymmetry argument (branch columns, `serviceCatalogItemId`/`performedById`, sign-and-lock, `StockMovement`, the `Message` log are cheap now and unrecoverable later) is correct and well-evidenced. Refusing a read-then-write overlap check in favour of a Postgres `EXCLUDE` constraint is correct — `crm.service.ts:14-21` and `patients.service.ts:41-44` are the two prior scars. Extracting rather than copying the FEFO engine is correct. A manual WhatsApp button instead of a scheduler is correct — I confirmed `package.json` has no `@nestjs/schedule`, no BullMQ, nothing. Deferring the form builder and the rules engine is correct, and the clinical-safety argument for deferring the rules engine is the best paragraph in the document. Those calls are sound. The problem is arithmetic and omission, not judgement.