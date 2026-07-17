# Security finding: RLS was inert (runtime role could bypass it)

**Status:** Fixed and verified — 2026-07-16
**Severity:** Critical (cross-tenant data disclosure)
**Found by:** Live isolation test while verifying the Physiotherapy pack's RLS.

## What was wrong

The application connected to Postgres as `healthos`, which is `SUPERUSER` with
`rolbypassrls = true`. **Postgres skips every row-level security policy for such
a role.** So all 76 tenant tables had correct `tenant_isolation` policies, `ENABLE
ROW LEVEL SECURITY`, and `FORCE ROW LEVEL SECURITY` — and none of them ever ran.

This was not merely a missing safety net. Tenant-scoped services deliberately
omit `tenantId` from their WHERE clauses and delegate isolation to RLS:

```ts
// src/modules/patients/patients.service.ts
tx.patient.findMany({ orderBy: { createdAt: 'desc' } })   // no tenantId filter
```

With RLS bypassed, that query returned **every tenant's patients**. It was a real,
API-reachable cross-tenant leak. It stayed invisible only because the dev database
contained exactly one tenant — there was nothing to leak from.

## Why our verification missed it

Prior RLS checks ran `psql -U healthos` — the same superuser. They asserted that
policies *existed* (`relforcerowsecurity = t`), which was true, and concluded
isolation *worked*, which did not follow. The check was tautological: a bypassing
role cannot observe its own bypass. **Verifying RLS as a superuser proves nothing.**

## Proof (same query, same tenant scope, only the role differs)

A probe tenant + patient (`RIVAL-001`) was inserted, queried under each role, then removed.

| Runtime role | Patients visible | Sees other tenant's patient? |
| --- | --- | --- |
| `healthos` (superuser, BYPASSRLS) | 9 | **yes — leak** |
| `healthos_app` (NOSUPERUSER, NOBYPASSRLS) | 8 | no |

Via the live API as the Glow Derma owner: `GET /patients` returned 8 (rival absent),
and fetching the rival patient by direct id returned **404** (no IDOR).

## The fix

1. **`prisma/rls-roles.sql`** — creates `healthos_app`: `NOSUPERUSER NOBYPASSRLS`,
   granted DML on all tables plus `ALTER DEFAULT PRIVILEGES` so future migrations
   need no re-grant. Ends with a guard that raises if the role can bypass RLS.
2. **Split credentials** — `DATABASE_URL` → `healthos_app` (runtime);
   `DIRECT_DATABASE_URL` → `healthos` (owner; migrations/seed only). The datasource
   block in `schema.prisma` wires `directUrl` for Prisma Migrate.
3. **Boot-time preflight** — `PrismaService.assertRlsIsEnforceable()` queries
   `pg_roles` for the connected role and **throws on startup** if it is a superuser
   or has BYPASSRLS. Verified both ways: boots clean as `healthos_app`
   (`RLS enforceable: connected as non-bypassing role "healthos_app"`), and refuses
   to start under the old URL with an explanatory error.

RLS is now fail-closed: with no `app.tenant_id` set, tenant tables return **0 rows**.

## Regression check

28/28 Physiotherapy checks and 10 module demo suites (trends, dental, peds, emr,
laterality, breadth, pharmacy, reports, void/refund, obgyn) pass with RLS enforced.
No module depended on the bypass.

## Follow-up audit (task #62) — 6 more confirmed findings, all now fixed

Turning RLS on made it the *only* control for those unfiltered reads, so a 16-agent
audit cross-checked every model and query path. It found six real defects:

### G1 — `User` had no RLS at all (critical)

The one tenant-scoped table with no policy. Verified as `healthos_app` under a bogus
tenant: `Patient` → 0 rows, but `User` → **every row across every tenant**, including
`passwordHash` and the platform admin. Not yet leaking only because `auth.service.ts:21`
was the single `User` query in the codebase — but the house style is to omit `tenantId`
and rely on RLS, so the first `tx.user.findMany()` in a staff directory would have
shipped a breach in a PR that looked like 71 correct precedents.

Not a copy-paste fix, for two reasons: login runs *before* tenant context exists (you
can't know the tenant until you've found the user), and `User.tenantId` is nullable by
design for platform admins, so plain equality never matches them.

Fixed in `prisma/rls-user.sql`: tenant policy in `nullif()` form, plus
`auth_find_user_by_email()` — a `SECURITY DEFINER` function with a pinned `search_path`,
`EXECUTE` granted only to `healthos_app`, deliberately narrow (lookup by unique email,
no list variant). `AuthService.validateUser` now goes through it.

Explicitly **not** done: `current_setting(...) IS NULL OR "tenantId" = ...` — that
re-opens the whole table whenever context is unset, i.e. the same leak, made permanent.

### G2 — `forTenant(null)` set `app.tenant_id = ''`, and `''::uuid` raises (critical)

Postgres doesn't treat `''` as NULL; `missing_ok` only rescues the *never-set* case. So
platform admins (tenantId null) hit `invalid input syntax for type uuid: ""` — verified:
`admin@summitsystems.pk` → `GET /patients` → **HTTP 500**. Worse was the docstring
claiming `''` meant "no tenant scope": a maintainer fixing those 500s by honouring `''`
in the policy would have converted a loud crash into a silent cross-tenant read across
all 71 tables. `forTenant` now rejects null outright → clean **403**.

### G3 — JWT secret silently fell back to `'dev-secret-change-me'` (critical)

RLS is only as trustworthy as the identity feeding it: the tenant context comes from the
verified JWT. With a known secret, anyone forges `{tenantId: <victim>, isPlatformAdmin:
true}` and RLS then faithfully enforces *the attacker's* tenant. Boot succeeded silently
with the default. Now `assertJwtSecret()` in `main.ts` refuses to start on unset,
known-placeholder, or <32-char secrets — all three branches verified to fire.

### G4 — `prisma/seed.ts` could not run against a correctly-configured DB (major)

The policies use `USING` with no `WITH CHECK`, so Postgres reuses the USING expression as
the INSERT check and *rejects* writes: the seed died at `Facility`. Bootstrapping the
first tenant is inherently pre-tenant, so the seed now connects via `DIRECT_DATABASE_URL`
(owner). The misleading contract in `pack-seeding.ts` — which blessed passing a raw
client, true only for a bypassing role — is corrected.

### G5 — the documented fail-closed premise was false (minor)

`rls.sql` claimed unset context yields NULL → no rows. True only on a connection where
the GUC was never set; after the first `set_config(..., is_local=true)` transaction it
resets to `''` at commit. All policies rewritten to the `nullif(..., '')` form, which is
fail-closed for both states. Verified: `SET app.tenant_id = ''` → **0 rows, no error**.

### Verification after the fixes

| Probe (as `healthos_app`) | Result |
| --- | --- |
| bogus tenant → `User` | 0 rows (was: all rows) |
| correct tenant → `User` | own staff only |
| `app.tenant_id = ''` → `User` / `Patient` | 0 rows, no error |
| login: tenant OWNER / PLATFORM_ADMIN | both HTTP 200 |
| platform admin → `/patients` | 403 (was 500) |
| wrong password / unknown email | 401, no user enumeration |
| `npx prisma db seed` | completes (was: RLS violation at Facility) |

Regression: 28/28 physiotherapy, 60/60 dermatology, and 20 module demo suites — zero
genuine 500s, no module depended on any of the broken behaviour.

## CI guards — built, and they immediately caught real drift

Three checks now run via `npm run check:security` (template CI job in
`app/backend/.github-workflows-security.yml.example`):

| Check | What it fails on |
| --- | --- |
| `check:rls` (static, no DB) | a `tenantId` model with no policy; a policy missing ENABLE/FORCE; a non-canonical qual; a `IS NULL` / `= ''` qual (the two breach-introducing "fixes"); a `this.prisma.<model>` call outside `forTenant` |
| `check:isolation` (live, runtime role) | plants a second tenant, asserts zero cross-reads on patients/users/observations/invoices, empty-GUC → 0 rows *without raising*, cross-tenant INSERT refused, and both logins still working |
| `check:boot` (spawns the real binary) | the app booting on a placeholder/short/absent JWT secret, or as the RLS-bypassing owner — plus that it *does* boot when correctly configured |

**On its first run, `check:rls` found drift I had already introduced.** The `nullif()`
rewrite had been applied to the live database via a DO-loop, but `prisma/rls.sql` — the
file a fresh deploy runs — still held all 71 policies in the raw form. A new environment
would have silently resurrected the empty-string bug. That is precisely the class of drift
these guards exist for, and it was invisible to every other check.

The guards were then mutation-tested by reintroducing each original defect: a new
`tenantId` model with no policy (the `User` gap), an `IS NULL OR ...` qual (the tempting
"fix"), and an unrouted `this.prisma.patient.findMany()` (the `tx.user.findMany()`
landmine). All three were caught; all mutations reverted.

## Still outstanding

- **`forTenant` signature** is still `string | null` (throws at runtime). Narrowing it to
  `string` would make the compiler enumerate all 77 call sites.
- **Platform-admin cross-tenant reads** have no legitimate path. If wanted, they need an
  explicit audited role + policy — never a null tenantId falling through tenant services.

## Rule going forward

Test isolation **as the runtime role, with a second tenant's row present, asserting
zero cross-reads.** Never as the owner, and never by inspecting catalog flags alone.
