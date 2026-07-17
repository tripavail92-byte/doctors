# Health OS — Wave 0 Engineering Backlog

**Goal of Wave 0:** stand up the platform foundation — a secure, multi-tenant
modular monolith with identity, RBAC, edition-based entitlements, a billing
engine, tenant onboarding, one working clinical-to-cash vertical slice, the
flagship clinic migrated as tenant-one, and the CI/CD + observability needed to
operate it. When Wave 0 is done, Summit can onboard a new clinic tenant and that
clinic can run patient → appointment → consult → plan → invoice → payment.

**Team assumption:** a small team of ~4 — 2 backend, 1 full-stack/frontend, 1
part-time platform/DevOps (plus a PM/lead who also codes). Sizes are
**S** (≤1 day), **M** (2–4 days), **L** (~1 week).

**Legend:** `AC` = acceptance criteria. `Dep` = depends on.

---

## E1 — Multi-tenancy & Row-Level Security

Foundation everything else sits on. Tenant isolation must be enforced in the
database, not just application code.

### E1-1 Provision Postgres 16 + Prisma baseline (S)
- **AC:** `docker compose up postgres` starts Postgres 16; `prisma migrate dev`
  creates the full Wave 0 schema (all models from the spec); `prisma generate`
  produces a typed client; `.env.example` documents `DATABASE_URL`.
- **Dep:** none.

### E1-2 Tenant context via AsyncLocalStorage (M)
- **AC:** `tenant-context.ts` exposes `runWithTenant(ctx, fn)` and `getTenant()`
  returning `{ tenantId, userId, role, isPlatformAdmin }`; calling `getTenant()`
  outside a tenant scope throws a clear error; unit test proves context does not
  leak across two concurrent async requests.
- **Dep:** E1-1.

### E1-3 PrismaService.forTenant() transaction helper (M)
- **AC:** `forTenant(tenantId, fn)` opens a transaction, runs
  `set_config('app.tenant_id', $tenantId, true)`, then runs `fn(tx)`; a test
  shows two tenants querying the same table see only their own rows once RLS is
  on; helper is the single sanctioned path for tenant-scoped queries.
- **Dep:** E1-1, E1-2.

### E1-4 RLS policies (`rls.sql`) for all tenant-scoped tables (L)
- **AC:** every tenant-scoped table (Facility, User[tenant], Patient,
  Appointment, Invoice, Payment, Subscription, TenantEntitlement, AuditLog) has
  `ENABLE ROW LEVEL SECURITY` + a `USING`/`WITH CHECK` policy keyed on
  `current_setting('app.tenant_id')`; the app connects as a **non-superuser,
  non-BYPASSRLS** role; an integration test confirms cross-tenant reads AND
  writes are blocked; script is idempotent (safe to re-run).
- **Dep:** E1-1, E1-3.

### E1-5 TenantMiddleware wiring (S)
- **AC:** middleware reads the validated JWT user, resolves tenant context, and
  wraps the request in `runWithTenant`; platform-admin requests (tenantId null)
  are handled without setting a tenant; requests without a valid user never
  reach tenant-scoped handlers.
- **Dep:** E1-2, E2-2.

### E1-6 Tenant-isolation test harness (M)
- **AC:** reusable test utility seeds 2 tenants and asserts isolation across a
  representative set of tables; runs in CI; a deliberately-missing RLS policy
  makes the suite fail (proves the harness has teeth).
- **Dep:** E1-4.

---

## E2 — Identity & Authentication

### E2-1 User model + password hashing (S)
- **AC:** `User` persisted with `passwordHash` (argon2 or bcrypt, cost tuned);
  passwords never logged; seed users hash correctly and verify.
- **Dep:** E1-1.

### E2-2 JWT login + strategy (M)
- **AC:** `POST /auth/login` validates email+password and returns
  `{ accessToken }`; `JwtStrategy.validate()` returns
  `{ userId, tenantId, role, isPlatformAdmin }`; token carries tenant + role;
  invalid credentials return 401 with no user enumeration leak; token TTL and
  `JWT_SECRET` come from env.
- **Dep:** E2-1.

### E2-3 JwtAuthGuard + current-user decorator (S)
- **AC:** `JwtAuthGuard` rejects missing/expired/invalid tokens with 401;
  a `@CurrentUser()` decorator exposes the validated payload to controllers;
  `/auth/me` returns the current user.
- **Dep:** E2-2.

### E2-4 Refresh + logout strategy (M)
- **AC:** short-lived access token + refresh flow (rotating refresh token or
  documented decision to defer); logout invalidates refresh; documented in
  ARCHITECTURE. *2FA is explicitly out of scope for Wave 0 — leave a seam
  (nullable `totpSecret`, `mfaEnabled`) and a ticket for Wave 1.*
- **Dep:** E2-2.

### E2-5 Password lifecycle (M)
- **AC:** forced password set on first login for onboarded users; change-password
  endpoint; reset-token flow stubbed with clear TODO for email delivery (E6);
  lockout/backoff after N failed attempts.
- **Dep:** E2-2.

---

## E3 — Role-Based Access Control

### E3-1 RolesGuard + @Roles decorator (S)
- **AC:** `@Roles(...UserRole[])` + `RolesGuard` allow only listed roles;
  no `@Roles` = authenticated-any; PLATFORM_ADMIN handling is explicit
  (either bypasses tenant roles or is checked separately, documented).
- **Dep:** E2-3.

### E3-2 Role → capability matrix (M)
- **AC:** documented matrix mapping each `UserRole`
  (OWNER, ADMIN, RECEPTION, DOCTOR, SALES, TREATMENT, INVENTORY, FINANCE,
  PLATFORM_ADMIN) to the modules/actions it may perform; controllers annotated
  to match; reviewed with product.
- **Dep:** E3-1.

### E3-3 Negative-path RBAC tests (M)
- **AC:** e2e tests assert forbidden roles get 403 on representative endpoints
  (e.g. RECEPTION cannot void an invoice; DOCTOR cannot manage users); runs in CI.
- **Dep:** E3-1, E7 slice endpoints.

### E3-4 Platform-admin scope guard (S)
- **AC:** control-plane endpoints require `isPlatformAdmin`; a tenant user
  (even OWNER) cannot reach control-plane routes; covered by a test.
- **Dep:** E3-1.

---

## E4 — Entitlements & Editions

### E4-1 Plans, Features, PlanFeature seed (M)
- **AC:** `Plan` rows for each `Edition` (SOLO, CLINIC, SPECIALTY, LAB,
  PHARMACY, HOSPITAL, ENTERPRISE) with `pricePkr`/`priceUsd`; `Feature`
  catalog with stable `key`s (e.g. `patients.manage`, `appointments.manage`,
  `billing.invoice`, `services.manage`); `PlanFeature` links define which
  edition gets what; seed is deterministic/re-runnable.
- **Dep:** E1-1.

### E4-2 EntitlementsService.check() (M)
- **AC:** `check(tenantId, featureKey): boolean` reads `TenantEntitlement`
  (per-tenant override), enabled result cached briefly; unknown key → false;
  documented precedence (tenant override vs plan default) and how entitlements
  are materialized for a tenant.
- **Dep:** E4-1.

### E4-3 EntitlementGuard + @RequiresEntitlement (S)
- **AC:** `@RequiresEntitlement("module.key")` + `EntitlementGuard` return 402/403
  when the tenant lacks the feature; guard composes after JwtAuthGuard/RolesGuard;
  tested for allow and deny.
- **Dep:** E4-2.

### E4-4 Entitlement materialization on subscribe/change (M)
- **AC:** creating/changing a `Subscription` (re)writes `TenantEntitlement`
  rows from the plan's features; downgrades disable removed features; a test
  proves a tenant loses access to a feature after downgrade.
- **Dep:** E4-1, E5-2.

### E4-5 Edition-aware frontend gating (S)
- **AC:** web app hides/greys nav + actions the tenant is not entitled to,
  driven by an entitlements payload from the API (`/auth/me` or `/entitlements`);
  server remains the source of truth (UI gating is convenience only).
- **Dep:** E4-2, E7 UI.

---

## E5 — Billing Engine + Payment Collection

Recurring subscription billing via **Kill Bill**; one-off clinical collection via
Pakistani gateways.

### E5-1 Stand up Kill Bill (L)
- **AC:** Kill Bill + its DB running in docker-compose (dev) and documented for
  prod; catalog seeded to mirror our Plans/Editions; admin credentials in env;
  health check green; decision recorded on hosted vs self-managed.
- **Dep:** E4-1.

### E5-2 Subscription lifecycle integration (L)
- **AC:** creating a tenant subscription creates the Kill Bill account +
  subscription; local `Subscription.status` (`TRIALING`/`ACTIVE`/`PAST_DUE`/
  `CANCELED`) and `currentPeriodEnd` stay in sync via Kill Bill webhooks;
  trial → active → past_due transitions reflected; idempotent webhook handling.
- **Dep:** E5-1.

### E5-3 Payment gateway abstraction (M)
- **AC:** a `PaymentGateway` interface with adapters for **Safepay**, **PayFast**,
  **PayPro** (plus CASH/CARD/POS manual capture); config/keys per env; one
  adapter (Safepay) fully implemented, the others stubbed behind the interface
  with clear TODOs; sensitive keys never committed.
- **Dep:** E1-1.

### E5-4 Invoice + Payment collection flow (M)
- **AC:** create `Invoice` (DRAFT→UNPAID), record `Payment` (partial + full),
  invoice transitions UNPAID→PARTIAL→PAID; VOID path; totals in integer minor
  units; all tenant-scoped via `forTenant`; audit entry on each transition.
- **Dep:** E5-3, E7-4.

### E5-5 Gateway webhook + reconciliation (M)
- **AC:** webhook endpoint verifies signature, marks the matching Payment/Invoice
  paid, is idempotent (replays are safe), and writes an AuditLog; a reconciliation
  query surfaces mismatches between gateway and local state.
- **Dep:** E5-3, E5-4.

### E5-6 Dunning / past-due handling (M)
- **AC:** Kill Bill overdue state flips tenant to `PAST_DUE`/`SUSPENDED`; a
  suspended tenant's users are limited (read-only or blocked) via a guard;
  reactivation on payment; behavior documented.
- **Dep:** E5-2, E4-4.

---

## E6 — Tenant Onboarding + Summit Control Plane

### E6-1 Control-plane API skeleton (M)
- **AC:** platform-admin-only endpoints to list/create/inspect tenants; guarded
  by E3-4; no tenant context set on these routes; paginated tenant list with
  status + edition.
- **Dep:** E3-4.

### E6-2 Tenant provisioning workflow (L)
- **AC:** one operation creates `Tenant` (name/slug/edition/status=TRIAL),
  default `Facility`, the OWNER `User` (with forced password set), a `Subscription`
  (trial), and materialized `TenantEntitlement`s; runs in a single transaction /
  saga with rollback on failure; slug uniqueness enforced.
- **Dep:** E6-1, E4-4, E5-2, E2-5.

### E6-3 Onboarding UI wizard (M)
- **AC:** Summit admin screen to create a tenant end-to-end (edition picker,
  owner details, review); shows resulting entitlements; success + failure states.
- **Dep:** E6-2, E4-5.

### E6-4 Tenant suspend / resume / edition change (M)
- **AC:** control-plane actions to suspend, resume, and change a tenant's edition;
  edition change re-materializes entitlements (E4-4) and updates Kill Bill (E5-2);
  each action audited.
- **Dep:** E6-2.

### E6-5 Transactional email seam (S)
- **AC:** an `EmailService` interface (welcome, password reset, invoice receipt)
  with a dev/console adapter and a documented prod adapter (e.g. SES/Resend);
  onboarding + password flows call it; no hard dependency on a provider in Wave 0.
- **Dep:** E6-2.

---

## E7 — First Vertical Slice (patients → appointments → consult → plan → invoice → payment)

The proof the platform works end-to-end for a clinic.

### E7-1 Patients module (M)
- **AC:** CRUD for `Patient` (mrn, name, phone, dob, gender), tenant-scoped via
  `forTenant`; MRN unique per tenant; DTOs validated with class-validator;
  guarded with `@RequiresEntitlement("patients.manage")` + roles; list with
  search/pagination.
- **Dep:** E1-4, E3-1, E4-3.

### E7-2 Appointments module (M)
- **AC:** book/reschedule/cancel `Appointment` (patientId, providerId, start,
  end, service, status); status transitions BOOKED→…→COMPLETED/NO_SHOW enforced;
  overlap check per provider; tenant-scoped; guarded.
- **Dep:** E7-1.

### E7-3 Consult + treatment plan (M)
- **AC:** from a CHECKED_IN/IN_PROGRESS appointment, a doctor records a consult
  note and a treatment plan (line items/services); plan can be turned into an
  invoice; DOCTOR/TREATMENT roles only. *(Consult/plan entities added to schema
  as part of this ticket; keep minimal.)*
- **Dep:** E7-2.

### E7-4 Invoice from plan (M)
- **AC:** generate an `Invoice` from a treatment plan (line items → `total`,
  status DRAFT/UNPAID), number unique per tenant; tenant-scoped; FINANCE/OWNER
  roles; entitlement `billing.invoice`.
- **Dep:** E7-3, E5-4.

### E7-5 Payment capture (S)
- **AC:** record `Payment` against an invoice (CASH/CARD/POS now; gateway via
  E5-3); invoice status recomputed; receipt available; audited.
- **Dep:** E7-4, E5-4.

### E7-6 Clinic UI for the slice (L)
- **AC:** web screens for patient list/detail, appointment calendar/day view,
  consult/plan capture, and invoice+payment; uses AppShell + MUI + typed api
  client; happy path demoable end-to-end against the seeded tenant.
- **Dep:** E7-1..E7-5, E4-5.

---

## E8 — Migrate flagship clinic as tenant-one

### E8-1 Legacy data audit + mapping (M)
- **AC:** inventory of the flagship clinic's existing data (patients,
  appointments, invoices, users) with a field-by-field mapping to the new schema;
  gaps + cleanup decisions documented.
- **Dep:** E7 schema stable.

### E8-2 Idempotent import scripts (L)
- **AC:** scripts import legacy data into tenant-one under `forTenant`; re-running
  does not duplicate (natural-key upserts); row counts reconciled; MRNs/invoice
  numbers preserved or remapped with a documented rule.
- **Dep:** E8-1, E6-2.

### E8-3 Dry-run + validation in staging (M)
- **AC:** full import executed against staging; spot-check + automated counts
  match source; RLS verified (flagship sees only its data); sign-off checklist.
- **Dep:** E8-2, E9-2.

### E8-4 Cutover plan + rollback (M)
- **AC:** written cutover runbook (freeze window, final delta import, go/no-go,
  rollback to legacy); backups taken before cutover; owner-approved.
- **Dep:** E8-3, E9-4.

---

## E9 — CI/CD, IaC, Backups

### E9-1 CI pipeline (M)
- **AC:** on every PR: install, typecheck, lint, unit + e2e tests (incl.
  tenant-isolation + RBAC suites), Prisma migrate check, build backend + web;
  red build blocks merge; runs on GitHub Actions (or chosen CI).
- **Dep:** E1-6, E3-3.

### E9-2 Containerization + staging deploy (L)
- **AC:** backend and web Dockerfiles (multi-stage, non-root); images built in
  CI; auto-deploy to a staging environment on merge to main; migrations run as a
  gated deploy step; health checks.
- **Dep:** E9-1.

### E9-3 Infrastructure as Code (L)
- **AC:** environments (network, managed Postgres, app runtime, secrets) defined
  in IaC (Terraform or equivalent); staging + prod reproducible from code;
  secrets via a secret manager, never in the repo.
- **Dep:** E9-2.

### E9-4 Automated backups + restore drill (M)
- **AC:** automated daily Postgres backups with retention; PITR enabled or
  documented; a **restore is actually performed** into a scratch environment and
  verified (backups you can't restore don't count).
- **Dep:** E9-3.

### E9-5 Production deploy + migration safety (M)
- **AC:** promote-to-prod flow (manual approval); expand/contract migration
  guidelines documented; rollback procedure; zero-downtime path for the common
  case.
- **Dep:** E9-2, E9-3.

---

## E10 — Observability & Audit Log

### E10-1 Structured logging + request/tenant correlation (M)
- **AC:** JSON logs with request id + tenant id (from context) on every request;
  no secrets/PII in logs; log level configurable per env.
- **Dep:** E1-2, E2-3.

### E10-2 AuditLog service + wiring (M)
- **AC:** `AuditService.record({action, entity, entityId})` writes `AuditLog`
  with tenant + user from context, inside the same `forTenant` transaction as the
  change; wired into auth, billing, and slice mutations; tenant-scoped read API
  for admins.
- **Dep:** E1-3, E7 mutations.

### E10-3 Metrics + health/readiness (M)
- **AC:** `/health` (liveness) and `/ready` (DB reachable) endpoints; app +
  Postgres metrics exported (Prometheus-style) — request rate, latency, errors,
  DB pool; a dashboard exists.
- **Dep:** E9-2.

### E10-4 Error tracking + alerting (M)
- **AC:** unhandled errors reported to an error tracker (e.g. Sentry) with tenant
  context tag; alerts on error-rate spike, past-due-webhook failures, and failed
  backups route to the team.
- **Dep:** E10-1, E9-4.

### E10-5 Audit trail UI (S)
- **AC:** admin screen to view a tenant's audit log (filter by entity/action/
  user/date); platform admin can view across tenants via the control plane.
- **Dep:** E10-2, E6-1.

---

## Dependency-ordered sprint plan (~10–12 weeks, 2-week sprints)

The critical path runs **E1 → E2 → E3/E4 → E7 (slice)**, with E5/E6 layered in,
then E8 migration, and E9/E10 hardening running alongside from Sprint 2. Start
CI early — it protects the isolation guarantees.

### Sprint 1 (wk 1–2) — Foundations
- E1-1, E1-2, E1-3, E1-4 (RLS), E1-5, E1-6
- E2-1, E2-2, E2-3
- E9-1 (CI green with the isolation + auth tests)
- **Milestone:** two tenants, JWT login, RLS-enforced isolation proven in CI.

### Sprint 2 (wk 3–4) — Access control & entitlements
- E2-4, E2-5
- E3-1, E3-2, E3-4 (E3-3 once slice endpoints exist)
- E4-1, E4-2, E4-3
- E10-1 (structured logging)
- E9-2 started (containers + staging)
- **Milestone:** guarded endpoints; edition entitlements gate access.

### Sprint 3 (wk 5–6) — Vertical slice, part 1
- E7-1 (patients), E7-2 (appointments), E7-3 (consult/plan)
- E4-5 (frontend gating), start E7-6 UI (patients + appointments screens)
- E10-2 (audit service) wired into these mutations
- E9-2 finished (auto-deploy to staging)
- **Milestone:** book an appointment and record a consult in staging.

### Sprint 4 (wk 7–8) — Billing + slice completion
- E5-1 (Kill Bill), E5-3 (gateway abstraction + Safepay)
- E7-4 (invoice), E7-5 (payment), finish E7-6 UI
- E5-4 (collection flow), E3-3 (RBAC negative tests)
- E10-3 (health/metrics)
- **Milestone:** full patient→…→payment slice demoable end-to-end.

### Sprint 5 (wk 9–10) — Subscriptions, onboarding, control plane
- E5-2 (subscription lifecycle), E5-5 (webhooks), E4-4 (materialization),
  E5-6 (dunning)
- E6-1, E6-2 (provisioning), E6-3 (wizard), E6-4, E6-5 (email seam)
- E9-3 (IaC), E9-4 (backups + restore drill)
- E10-4 (error tracking/alerts)
- **Milestone:** Summit can onboard a brand-new clinic tenant self-serve.

### Sprint 6 (wk 11–12) — Migration & hardening
- E8-1, E8-2, E8-3, E8-4 (flagship migration + cutover)
- E9-5 (prod deploy + migration safety), E10-5 (audit UI)
- Buffer: bug-fix, load-check the slice, docs, security pass.
- **Milestone:** flagship clinic live as tenant-one in production.

> If capacity is tight, the honest cut line for a 10-week variant is: defer
> E5-6 (dunning), E6-4 (edition change), and E10-5 (audit UI) into Wave 1, and
> keep PayFast/PayPro adapters stubbed. Do **not** cut E1-4/E1-6 (RLS + its
> tests) or E9-4 (restore drill) — they are the load-bearing safety items.

---

## Definition of Done (per ticket)

- Code merged to main via reviewed PR; CI green (typecheck, lint, unit + e2e).
- New tenant-scoped tables have RLS policies **and** an isolation test.
- Endpoints have role + entitlement guards and at least one allow **and** one
  deny test.
- Input validated with class-validator DTOs; errors return correct status codes.
- Sensitive mutations write an `AuditLog` entry.
- No secrets in the repo; new config documented in `.env.example`.
- User-facing changes reflected in the web UI and in `docs/` where relevant.
- Migrations are expand/contract-safe and run cleanly forward on staging.

---

## Top risks

1. **RLS gaps / misconfiguration.** A missing policy or an accidental
   superuser/BYPASSRLS connection silently breaks isolation. *Mitigation:* the
   E1-6 harness fails CI on any unpolicied tenant table; app connects as a
   restricted role; periodic review.
2. **Tenant context leakage across async boundaries.** Mishandled
   AsyncLocalStorage could bleed one tenant's context into another's request.
   *Mitigation:* concurrency test in E1-2; `getTenant()` throws outside scope;
   never cache tenant-scoped clients globally.
3. **Kill Bill integration drift.** Local subscription state diverging from Kill
   Bill (missed/duplicated webhooks) corrupts billing + entitlements.
   *Mitigation:* idempotent webhook handling (E5-5), reconciliation query,
   Kill Bill as source of truth for lifecycle.
4. **Payment gateway variability (Safepay/PayFast/PayPro).** Inconsistent APIs,
   sandbox flakiness, signature verification bugs. *Mitigation:* gateway
   abstraction (E5-3), implement one fully first, verify signatures, reconcile.
5. **Flagship migration surprises.** Dirty legacy data, duplicate MRNs/invoice
   numbers, mismatched counts at cutover. *Mitigation:* audit + mapping (E8-1),
   idempotent upserts (E8-2), staging dry-run (E8-3), backup + rollback runbook
   (E8-4).
6. **Entitlement/edition confusion.** Wrong feature-to-plan mapping sells or
   withholds the wrong capabilities; server/UI disagree. *Mitigation:* server is
   source of truth (E4-2), materialization tests on downgrade (E4-4), product
   review of the plan/feature matrix (E4-1).
7. **Backups that don't restore.** *Mitigation:* E9-4 requires an actual restore
   drill, not just a backup job.
8. **Scope creep on the slice.** Consult/plan can balloon into a full EMR.
   *Mitigation:* keep E7-3 deliberately minimal; richer clinical features are
   Wave 1+.