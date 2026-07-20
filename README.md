# Health OS

A modular, multi-tenant clinic platform, built Pakistan-first (PKR, FBR e-invoicing,
Safepay/PayFast, WhatsApp via the Meta Cloud API). One shared clinical core, sold in
editions; a specialty is **configuration over shared engines**, not a fork.

> **Status: pre-production.** The platform runs end-to-end and is heavily tested, but the
> clinical engines carry open sign-off items and are **not cleared for patient use**. See
> [Safety](#safety) below — that section is the point of this README, not a footnote.

## What's here

```
app/backend    NestJS + Prisma + PostgreSQL. 80 models, RLS on every tenant table.
app/web        React + Vite SPA.
docs/          The engineering record — architecture, build specs, and the two
               write-ups every contributor should read before touching a clinical engine.
```

### The architecture in one paragraph

A **pack manifest** (JSON) expands into ordinary tenant rows — service catalog, note
templates, intake groups, order sets — via `seedPackForTenant`. **Editions** are entitlement
bundles: an edition grants feature keys, feature keys become `TenantEntitlement` rows, and
`@RequiresEntitlement` gates the routes. Specialty packs (aesthetic, dermatology, dental,
OB/GYN, ophthalmology, physiotherapy, pediatrics) ride shared engines: scored instruments,
longitudinal trends, laterality, WHO-LMS growth, weight-based dosing. Adding a specialty is
mostly a manifest.

## Running it

```bash
cd app/backend
cp .env.example .env          # then set a real JWT_SECRET — the app refuses to boot without one
docker compose up -d          # Postgres 16
npx prisma db push
psql "$DIRECT_DATABASE_URL" -f prisma/rls.sql        # policies
psql "$DIRECT_DATABASE_URL" -f prisma/rls-roles.sql  # the non-bypassing runtime role
psql "$DIRECT_DATABASE_URL" -f prisma/rls-user.sql   # User policy + the login function
psql "$DIRECT_DATABASE_URL" -f prisma/constraints.sql # partial unique indexes Prisma can't express
npm run db:seed
npm run build && npm start
```

Two database roles, deliberately: migrations and the seed run as the **owner**
(`DIRECT_DATABASE_URL`); the app runs as `healthos_app` (`DATABASE_URL`), which is
`NOSUPERUSER NOBYPASSRLS`. This is not cosmetic — see below.

## Showing it to someone

```bash
npm run demo:reset -- --yes    # rebuild the database, land on clean demo data
npm run build && npm start
```

The safety suites create their own patients — deliberately, so no check depends on what
ran before it — and they leave them behind. That is ~66 rows per full `check:clinical` run,
so a working database drifts into a test harness: this one had reached **2,026 patients,
about 2,022 of them probes** (`Lab Probe 95854`, `VoidAudit spoof 41883`, `PROBE-*`) with
the four real demo patients buried among them, and `GD-BABY1` present five times over.

`demo:reset` is therefore a step before any demo, not a one-time cleanup. It rebuilds from
schema and reruns the documented sequence, so it also proves that sequence still works.
It refuses to run without `--yes`, against a non-local database, or under
`NODE_ENV=production`. `npm run demo:seed` alone refreshes the demo rows in place and warns
if test artifacts are still present.

Two things the demo data does **not** do. It does not invent clinical values: the
phototherapy start dose and ceiling are read from the engine's own protocol table via
`startDoseFor`/`ceilingFor`, so a demo screen can never show a threshold that exists
nowhere else. And it does not fake money: an invoice with `paid > 0` gets a matching
`Payment` row, because `Collected PKR 35,000 / Payments PKR 0` is the shape of a
reconciliation bug.

> **Known gap:** `Patient` has no unique constraint on `(tenantId, mrn)`, which is how one
> MRN came to have five charts. Adding it is the right fix, but the dermatology suites reuse
> `PROBE-00001` across runs, so the constraint needs their fixtures made run-unique first.

## Checks

```bash
npm run check:security   # wiring + RLS coverage (static) + tenant isolation (live) + boot guards
npm run check:clinical   # 18 suites, 449 checks — needs the API running
```

Both run on every push and pull request via [`.github/workflows/ci.yml`](.github/workflows/ci.yml),
against a Postgres built from scratch: schema, the four SQL files, seed, then the suites
over HTTP as a logged-in user — with the app connecting as `healthos_app`, so RLS is
actually enforced rather than merely present.

Two things about the suites are load-bearing, and both were found by running them somewhere
other than the machine they were written on:

- **A failed check fails the build.** The suites print `PASS`/`FAIL` and used to exit `0`
  regardless, so `check:clinical` would chain straight past a failing suite and finish green.
  Every suite now exits non-zero on any failed check — and on *zero* checks, since a suite
  that asserted nothing has not passed.
- **Every check is wired in.** `check-growth-dose.ts` and `check-engine.ts` were correct and
  passing but referenced by nothing — run by hand once when the features were built, so
  remembered as coverage, and not executed since. The first covers `computeDose`'s daily
  cap, where a regression is a paediatric overdose. `scripts/check-wiring.ts` now fails the
  build if a `check-*.ts` has no npm script, or a `check:*` script is never chained. A check
  that never runs and a check that cannot fail are the same defect seen from two ends, and
  walking the `check:*` chain only ever finds one of them.
- **The two dermatology suites reach past the API** to age a delivered session, because there
  is no endpoint for "pretend three weeks passed" and the gap rules are the engine's most
  safety-critical branch. That SQL goes through `test/safety/_db.py`, which resolves the
  connection from `DIRECT_DATABASE_URL` and **raises** if the statement did not run. It
  previously shelled into a hardcoded `healthos-db` container and swallowed the error — so
  anywhere that container was absent, the ageing silently no-opped and the gap table passed
  by describing the on-schedule branch instead.

`check:security` fails the build on a `tenantId` model with no RLS policy, a policy in a
non-canonical or dangerous form, or a Prisma call outside `forTenant()`. It caught real
drift the first time it ran.

## Safety

Two findings shaped this codebase more than any feature. Both are written up in full, and
both are worth reading before trusting anything here:

- **[RLS was inert](docs/security-rls-bypass-finding.md)** — the app connected as a
  superuser with `rolbypassrls`, so every row-level security policy on all 76 tenant tables
  silently never executed. Services deliberately omit `tenantId` and rely on RLS, so this
  was a live cross-tenant read, invisible because the dev database had one tenant. The
  earlier "verification" ran as that same superuser: a bypassing role cannot observe its own
  bypass.

- **[The dermatology dose engine](docs/dermatology-safety-review.md)** — four adversarial
  review rounds (14, 15, 15, 4 confirmed defects). It would escalate UV onto a patient it had
  just blistered. Every defect lived at an *intersection* of rules, while a 60/60 suite tested
  each rule in isolation and passed throughout.

The lessons are generalisable, and they are the house rules now:

1. **Verify a control as the principal that actually exercises it**, with an adversarial
   fixture present, asserting the negative. Not as the owner; not by reading catalog flags.
2. **Test intersections, not rules.** A suite that sweeps one axis at a time will bless a
   broken engine. A test whose setup makes two branches tie cannot fail.
3. **A rejection must never discard a clinical fact.** If a throw and a write share a
   transaction, the throw wins and the fact is lost.
4. **Ask which entity safety state belongs to.** A burn hold keyed on the course was
   escapable by opening a new course; skin belongs to the patient.

### Not cleared for clinical use

Reference data here is **starter data**, not a formulary or a national schedule:

- Dosing regimens (`dose-rule.seed.ts`) need validation against a maintained PMDC/DRAP
  formulary.
- The EPI schedule is missing IPV-2 and needs sign-off against the official FDI schedule.
- The VASI region table is rule-of-nines–derived, **not** checked against Hamzavi (2004).
- The phototherapy restart semantics, dose floor and MED ceiling multiple are reasoned, not
  sourced.

Every one of these is flagged in the code at the point it matters, not just here.

## Licence

Proprietary — Summit Systems.
