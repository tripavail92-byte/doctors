# Deploying Health OS

> **Demo and staging only.** Clinical sign-off items are still open — see
> [clinical-sign-off-register.md](clinical-sign-off-register.md). Nothing in this document
> makes the clinical engines safe for patients; it makes the platform runnable.

## The sequence

```bash
cp .env.prod.example .env.prod        # then fill it in — see "Decisions" below
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

`migrate` is a **separate one-shot job**, not a startup step. Schema changes should be
something a person decides, not something that happens because a container restarted. It
runs: `prisma migrate deploy` → the four SQL files → seed → `check-rls-live`.

That last step is the gate. Do not route traffic to a database it fails on.

Verified end to end on 2026-07-22 against an empty volume: images build, `migrate`
reports `81/81 clean`, `api` and `web` both reach healthy, and the SPA serves, logs in,
and resolves a pasted deep link through nginx.

## The three services

| | |
|---|---|
| `db` | Postgres 16. **No published port** — reachable only on the compose network. |
| `api` | Nest. **No published port** either; `web` reaches it internally. Publishing it puts an unauthenticated-by-network route to patient data on the host. |
| `web` | nginx: the built SPA, plus `/api` proxied to `api` with the prefix stripped. |

`web` is the only thing you point a TLS terminator at, and it binds `127.0.0.1:8080`
by default.

The prefix strip is the trailing slash in `proxy_pass ${API_ORIGIN}/`. The backend mounts
its routes at the root, so removing that slash turns every call into `/api/patients`
against a server that has no such route — and the SPA reports it as a plain failure.
This is the same rewrite `vite.config.ts` performs in development; until 2026-07-22
nothing performed it in production and the frontend had no deployment path at all.

## Why two database roles

`migrate` connects as the **owner**; `api` connects as **`healthos_app`**, which is
`NOSUPERUSER NOBYPASSRLS`.

This is the whole isolation boundary, not a hygiene preference. Postgres skips *every*
row-level security policy for a role holding `SUPERUSER` or `BYPASSRLS`. Services here
deliberately omit `tenantId` from their WHERE clauses and rely on the policies, so an API
connected as the owner returns **every tenant's** patient records — with no error, no log
line, and a green health check. It only becomes visible once a second clinic exists. See
[security-rls-bypass-finding.md](security-rls-bypass-finding.md).

The app refuses to boot as a bypassing role, so this fails closed. The runtime image also
cannot alter a schema even if asked: `prisma` and `ts-node` are devDependencies.

## Verifying a deployment

Run all three. Each answers a question the others do not.

```bash
npm run check:rls-live    # do the policies EXIST in this database, on all 79 tables?
npm run check:isolation   # do they ISOLATE, as the runtime role, with a second tenant?
npm run check:boot        # do the refusals still refuse?
curl -fsS https://host/health/ready   # can this instance actually serve?
```

`check:rls` (static) reads `schema.prisma` and `rls.sql` as text. It passes on a database
where those files were **never applied**, because the files are unchanged. It is a
source-drift check, not a deployment check.

## What must be true

| Requirement | Why, and what happens if it is not |
|---|---|
| `DATABASE_URL` → `healthos_app` | An owner connection makes RLS silently inert. App refuses to boot. |
| `DIRECT_DATABASE_URL` only in `migrate` | The serving process should not hold schema-altering credentials. |
| Database session on **UTC** | Prisma reads/writes `timestamp WITHOUT TIME ZONE` as UTC; raw SQL `now()` uses the session zone. Measured five hours apart under `Asia/Karachi` — and the dose engine bands reductions by whole days. App refuses to boot. |
| `JWT_SECRET` ≥ 32 chars, not a placeholder | A forged token defeats isolation entirely: RLS then faithfully enforces the tenant the *attacker* chose. App refuses to boot. |
| `STORAGE_DIR` on a mounted volume | Clinical photographs otherwise land on the container's writable layer and die on redeploy, while the `PhotoAsset` rows survive — charts pointing at bytes that no longer exist. **Cannot be retrofitted after photos exist.** |
| `/api` proxied to the API, prefix stripped | The SPA calls a relative `/api`. The `web` service does this; a different front end must too. |
| No `.env` inside any image | `.dockerignore` patterns are relative to the **context root**, so a bare `.env` never excluded `app/backend/.env`. It was baked into every image at `/app/.env` — a live `JWT_SECRET` and both DSNs — and the documented check looked for `app/backend/.env` *inside* the image, a path the `COPY` makes impossible, so it passed every time. Patterns are now `**/.env`. Verify with `docker run --rm --entrypoint sh IMAGE -c 'ls -la /app/.env'`, which must fail. |
| OpenSSL in the backend image | Prisma's engines are dynamically linked against it and `node:20-alpine` omits it. The failure surfaces as `Could not parse schema engine response` — Prisma reading the loader's plain-text error as JSON — which names neither OpenSSL nor Alpine. |
| Backups cover the database **and** `STORAGE_DIR` | A `pg_dump` does not capture the photographs. |

## Re-applying the SQL

`prisma/rls.sql` is re-runnable — each `CREATE POLICY` is preceded by
`DROP POLICY IF EXISTS`, so it is safe under `-v ON_ERROR_STOP=1`.

Re-apply it after **every** schema application, not only after changes you believe were
additive. RLS state is a property of the table object: a model rename or `@@map` change
makes a migration drop and recreate the table, taking `ENABLE`/`FORCE`/the policy with it —
while `ALTER DEFAULT PRIVILEGES` silently restores the runtime role's read access. Then
verify with `check:rls-live`, which is the only check that would notice.

## Decisions this document cannot make

1. **Host, domain, TLS.** The API binds loopback by default; put a terminator in front.
2. **Secret storage.** `.env.prod` on the host is the floor, not the goal.
3. **The `healthos_app` password** is a literal in `prisma/rls-roles.sql`. Fine for
   localhost; change it on anything reachable, in both the SQL and `DATABASE_URL`.
4. **Backup destination and restore drill.** An untested backup is a belief, not a backup.
5. **Nothing here, but read "Changing the schema" below** — migrations are now in place,
   and how you *author* them is the part that still needs care.

## Changing the schema

The database is under **migration control**. `prisma/migrations/0_init` is the baseline,
generated from the schema as it stood on 2026-07-21 and marked applied on the existing
development database rather than re-run against it.

```bash
npx prisma migrate dev --name what_changed   # authoring, on a dev database
npx prisma migrate deploy                    # applying, everywhere else
```

**Never `prisma db push` against a database you care about.** It diffs the schema and
reshapes the database to match, which resolves a column rename as drop-then-create — the
column is gone and so is what was in it. It is fine against a disposable database and it is
how this project ran until migrations landed.

**Review the generated SQL before committing it.** Prisma cannot tell a rename from a drop
plus an add; you can. That review is the whole safety margin on a database holding charts.

**Then re-apply the RLS files.** They are deliberately *not* part of the migration history,
because they are not a one-time change — RLS state belongs to the table object, so any
migration that recreates a table silently takes `ENABLE`/`FORCE`/the policy with it, while
`ALTER DEFAULT PRIVILEGES` quietly restores the runtime role's read access. All four files
are idempotent and safe under `-v ON_ERROR_STOP=1`. Verify with `check:rls-live`, which is
the only check that would notice.
