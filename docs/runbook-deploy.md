# Deploy Runbook

The Health OS schema is not what Prisma migrations alone install. Four psql
files must run alongside every deploy, and until this runbook existed nobody
was doing it — three separate defects in 24 hours traced back to that gap.

This runbook exists so a deploy is a checklist, not a memory.

---

## When to run it

Before **every** production deploy that touches:

- `app/backend/prisma/schema.prisma`
- `app/backend/prisma/migrations/`
- Any of `prisma/rls.sql`, `prisma/rls-user.sql`, `prisma/rls-roles.sql`,
  `prisma/constraints.sql`

For a runtime-only change (no schema, no SQL), a dry-run is still cheap and
worth doing to confirm production is in the state you expect.

---

## What it does

`scripts/deploy-schema.ts` connects to the target database, takes a snapshot,
compares it against what the committed code expects, and either reports the
drift (`--dry-run`, the default) or fixes it (`--apply`).

Fixing means, in order:

1. `prisma migrate deploy` — apply any pending migrations
2. `rls.sql` — 86 tenant_isolation policies, `DROP POLICY IF EXISTS ... CREATE`
3. `rls-roles.sql` — the `healthos_app` runtime role (NOSUPERUSER NOBYPASSRLS)
4. `rls-user.sql` — bespoke User RLS, three SECURITY DEFINER auth functions,
   and the NULL-safe hardening loop over every policy from rls.sql
5. `constraints.sql` — partial unique indexes Prisma cannot express

Each of the four SQL files is idempotent by construction. Re-running the
runbook against an already-correct database is a no-op.

## What it does NOT do

- Seed data. The seed creates users and is destructive; run it separately with
  `ts-node prisma/seed.ts` when you deliberately want that.
- Restart the API. Railway's build step handles Prisma client regeneration for
  schema changes. Pure policy or index changes need no restart.
- Rehearse a restore. Backups need their own schedule and their own test.

---

## Prerequisites

```
DATABASE_URL=postgresql://postgres:...@sakura.proxy.rlwy.net:38797/railway
```

`DATABASE_URL` alone is enough for a dry-run. `--apply` additionally needs
`DIRECT_DATABASE_URL` (used by `prisma migrate deploy`). On Railway's
single-role deploy today the two are the same.

To get the public URL of the Railway Postgres:

```bash
railway service Postgres
railway variables
# copy DATABASE_PUBLIC_URL
```

---

## The dry-run

Always first. Never skip.

```bash
cd app/backend
export DATABASE_URL="postgresql://postgres:...@sakura.proxy.rlwy.net:38797/railway"
npx ts-node scripts/deploy-schema.ts
```

Exit codes:

| Exit | Meaning |
|:---:|---|
| 0 | Database matches committed code. Nothing to apply. |
| 2 | Blocker drift found. Re-run with `--apply` to fix. |
| 1 | The script itself failed — read the error. |

A "no drift" dry-run on a routine deploy means: apply your migration locally,
run this dry-run, and it should tell you exactly the drift your migration will
close.

Snapshots are written to `HEALTHOS_SCRATCH` if set, otherwise the current
working directory. The snapshot is a full inventory: applied migrations,
tenant-scoped tables, every policy with its `USING`/`WITH CHECK` expressions,
the three required SECURITY DEFINER functions with their ACLs, partial unique
indexes, and the runtime role's `BYPASSRLS`/`SUPERUSER` state. Keep the
"before" snapshot; it is your rollback reference.

---

## The apply

Only after a dry-run and only after you have read what it plans to change.

```bash
cd app/backend
export DATABASE_URL="postgresql://postgres:...@sakura.proxy.rlwy.net:38797/railway"
export DIRECT_DATABASE_URL="$DATABASE_URL"    # same on Railway today
npx ts-node scripts/deploy-schema.ts --apply
```

The apply writes both a `before` and an `after` snapshot, then prints a diff
of what actually changed. It re-runs the analysis on the `after` snapshot and
exits non-zero if any blocker survived.

---

## What "drift" actually catches

The analysis in `analyze()` covers every failure this project has hit in the
last 24 hours:

- `healthos_app` role missing (rls-roles.sql never ran)
- `healthos_app` is SUPERUSER or has BYPASSRLS (RLS silently inert)
- A tenant-scoped table with no `tenant_isolation` policy
- A `tenant_isolation` policy with RLS not ENABLED or not FORCED
- A `tenant_isolation` policy whose `USING` is not in the `nullif()` form
  (case-insensitive check — Postgres stores parsed function names uppercased)
- A required SECURITY DEFINER function missing
- A required function that is not SECURITY DEFINER
- A required function that is `EXECUTABLE by PUBLIC` — a SECURITY DEFINER
  function granted to PUBLIC bypasses every RLS policy in the codebase
- A required function not executable by `healthos_app`

The last three are the classes of drift a schema-file mistake produces silently.
The runbook was verified end-to-end by injecting the "PUBLIC can execute a
SECURITY DEFINER function" case into production and confirming the dry-run
reported it as a `BLOCKER` and exited 2. The drift was reverted immediately.

---

## The deploy sequence, end to end

For a routine Phase 1 backend deploy that touches the schema:

```bash
# 1. LOCAL — make sure your changes work
cd app/backend
npm run check:security         # covers RLS coverage, escalation, entitlements, wiring
npm run build

# 2. DRY-RUN AGAINST PRODUCTION — this is the honest gate
export DATABASE_URL="postgresql://postgres:...@sakura.proxy.rlwy.net:38797/railway"
npx ts-node scripts/deploy-schema.ts
# read the drift. If unexpected, stop and understand it before proceeding.

# 3. APPLY THE SCHEMA
export DIRECT_DATABASE_URL="$DATABASE_URL"
npx ts-node scripts/deploy-schema.ts --apply
# note the diff. If any blocker survived, stop.

# 4. DEPLOY THE RUNTIME (schema is now ready for it)
cd ..
railway service api
railway up --detach

# 5. VERIFY IN PRODUCTION
# a non-destructive probe of a route only the new build responds to
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' \
  https://web-production-e7d18a.up.railway.app/api/auth/login
# and any HTTP safety suite you have that runs against a live host:
HEALTHOS_BASE=https://web-production-e7d18a.up.railway.app/api \
  python test/safety/privilege_escalation_suite.py
```

If step 4 fails, the schema in step 3 is already applied. That is deliberate
— the schema is idempotent and can be re-applied. A failing runtime deploy
does not need to be un-migrated.

---

## Recovery

If `--apply` fails partway through:

1. **Read the last successful step.** Each SQL file logs `ok (Nms)` on
   success. If `rls.sql` succeeded and `rls-user.sql` failed, the database
   carries `rls.sql`'s policies but not the hardening loop or the auth
   functions.
2. **Fix the underlying error.** Almost always this is a mistake in the SQL
   file itself; the runbook does not silently swallow errors.
3. **Re-run `--apply`.** Every file is idempotent. The successful ones re-run
   as no-ops; the fixed one runs to completion.

If a specific migration fails (`prisma migrate deploy` step), Prisma's own
recovery applies — `prisma migrate resolve --rolled-back <name>`.

---

## Why this is a runbook and not automation

Today it is a script a human runs before a deploy. That is deliberate for
Phase 1:

- Deploys happen through `railway up` from a developer's laptop today. Adding
  a "runs on push" hook adds coordination that is worse than a checklist for
  one developer.
- The dry-run is the checkpoint. A machine that applies without a human
  reading the drift report is a machine that will one day silently apply
  something nobody meant.

When Phase 1 stabilises and deploys become frequent (or when a second
developer starts contributing), the same script becomes a Railway one-off
service triggered from the CI pipeline. The script is deliberately shaped
that way: no interactive prompts, exits 0/1/2, writes snapshots to a
configurable directory.
