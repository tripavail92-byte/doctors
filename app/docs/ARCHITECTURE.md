# Health OS — Architecture

This document describes how the platform is put together and how to extend it.
It is intentionally short; read it before adding code.

## 1. Shape: a modular monolith

Health OS is a **single deployable NestJS application** organized into
well-bounded feature modules. We are deliberately *not* starting with
microservices — a modular monolith gives us fast iteration, one database, easy
transactions, and simple local dev, while keeping clean module boundaries so we
can extract services later if a domain needs independent scaling.

```
                ┌──────────────────────────────────────────┐
   Web (Vite) → │  NestJS API                               │
   axios + JWT  │  ┌─────────────┐  ┌────────────────────┐  │
                │  │ auth        │  │ modules/*          │  │
                │  │ entitlements│  │ patients           │  │
                │  │ common/*    │  │ appointments       │  │ → PostgreSQL 16
                │  │  ├ tenant   │  │ billing …          │  │   (RLS enforced)
                │  │  └ prisma   │  └────────────────────┘  │
                │  └─────────────┘                          │
                └──────────────────────────────────────────┘
```

Cross-cutting concerns live in `src/common` (tenant context) and top-level
`src/auth`, `src/prisma`, `src/entitlements`. Business capabilities live in
`src/modules/<name>`.

## 2. Multi-tenancy: shared DB + tenantId + RLS

We run **one Postgres database shared by all tenants**. Every tenant-scoped
table carries a `tenantId` column. Isolation is enforced at three layers:

1. **Tenant context (per request).** `common/tenant/tenant-context.ts` uses
   Node's `AsyncLocalStorage` to hold the current `{ tenantId, userId, role,
   isPlatformAdmin }`. `TenantMiddleware` reads the validated JWT payload (set
   by the auth layer) and wraps the request with `runWithTenant(ctx, next)`.
   Anywhere downstream, `getTenant()` returns that context — no prop drilling.

2. **RLS in Postgres (`rls.sql`).** Each tenant-scoped table has a policy like
   `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. This is the
   real security boundary: even a buggy query cannot read another tenant's rows.

3. **`PrismaService.forTenant()` (the bridge).** RLS reads a session variable,
   so before running tenant queries we must set it. `PrismaService` (extends
   `PrismaClient`) exposes:

   ```ts
   forTenant<T>(tenantId: string, fn: (tx) => Promise<T>): Promise<T>
   ```

   It opens a transaction, runs
   `SELECT set_config('app.tenant_id', $tenantId, true)` (transaction-scoped),
   then invokes the callback. **Every tenant-scoped service call must go through
   it**, typically:

   ```ts
   return this.prisma.forTenant(getTenant().tenantId, (tx) =>
     tx.patient.findMany(),
   );
   ```

Platform admins (`isPlatformAdmin = true`, `tenantId = null`) operate on the
Summit control plane and use a distinct code path that does not set a tenant.

## 3. Identity, RBAC, and entitlements

- **Auth.** `POST /auth/login` verifies credentials and returns
  `{ accessToken }`. `JwtStrategy.validate()` returns
  `{ userId, tenantId, role, isPlatformAdmin }`, which becomes the request user
  and feeds `TenantMiddleware`.

- **Guards** compose on controllers as
  `@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)`:
  - `JwtAuthGuard` — authenticates the bearer token.
  - `RolesGuard` + `@Roles(...UserRole[])` — coarse role check (OWNER, DOCTOR…).
  - `EntitlementGuard` + `@RequiresEntitlement("module.key")` — checks whether
    the tenant's **edition/plan** enables the feature.

- **Entitlements & editions.** A tenant subscribes to a `Plan` tied to an
  `Edition` (SOLO → ENTERPRISE). Plans grant `Feature`s via `PlanFeature`;
  per-tenant overrides live in `TenantEntitlement`.
  `EntitlementsService.check(tenantId, featureKey)` reads `TenantEntitlement`
  and returns a boolean. This lets us sell tiered editions and toggle modules
  per tenant without redeploying.

## 4. Billing (Wave 0 scope)

Subscriptions and their status live in `Subscription`; the collection side
(invoices/payments for clinical services) lives in `Invoice` and `Payment`,
with Pakistani gateways (`SAFEPAY`, `PAYFAST`, `PAYPRO`) plus `CASH`/`CARD`/`POS`.
The recurring subscription engine (Kill Bill) is integrated during Wave 0 — see
the backlog epic **E5**.

## 5. Auditing

`AuditLog` records `{ action, entity, entityId, userId, tenantId }`. Sensitive
mutations should append an audit entry within the same `forTenant` transaction
so the log is tenant-scoped and consistent with the change.

---

## How to add a new module

Follow the `modules/<name>` convention. Example: a `services` (treatment
catalog) module.

1. **Model.** Add the Prisma model(s) with a `tenantId` column to
   `prisma/schema.prisma`, then:

   ```bash
   npx prisma migrate dev --name add_service_catalog
   ```

2. **RLS.** Add matching policies for the new table(s) to `rls.sql` and re-run
   `psql "$DATABASE_URL" -f rls.sql`. (No policy = no access under RLS.)

3. **Scaffold the module folder:**

   ```
   src/modules/services/
     services.module.ts
     services.controller.ts
     services.service.ts
     dto/create-service.dto.ts
   ```

4. **Service** — inject `PrismaService`; run every query through
   `this.prisma.forTenant(getTenant().tenantId, (tx) => …)`.

5. **DTOs** — validate input with `class-validator` decorators.

6. **Controller** — protect it:

   ```ts
   @UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
   @RequiresEntitlement("services.manage")
   @Roles(UserRole.OWNER, UserRole.ADMIN)
   @Controller("services")
   export class ServicesController { … }
   ```

7. **Register** the module in `AppModule`'s `imports`.

8. **Entitlement key.** Add the `"services.manage"` feature to the seed
   (`Feature` + relevant `PlanFeature`s) so editions that should have it do.

9. **Frontend.** Add a typed method to the axios client, a page under
   `web/src/pages`, and a nav entry in `AppShell`.

That's the whole loop: model → RLS → module (guarded) → seed feature → UI.