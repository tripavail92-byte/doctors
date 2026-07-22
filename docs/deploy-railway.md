# Deploying Health OS on Railway

> **Demo and staging only.** Eight blocking clinical sign-off items are open — see
> [clinical-sign-off-register.md](clinical-sign-off-register.md). Nothing here makes the
> clinical engines safe for patients; it makes the platform reachable.

Repo: `github.com/tripavail92-byte/doctors`, branch `main`.

**What has and has not been tested.** The images, the migrate job, the two-role split and
the full request path were verified end to end locally against `docker-compose.prod.yml`,
including a rotated `healthos_app` password. The Railway-specific parts below — service
wiring, private DNS, the injected `PORT` — are written from Railway's documented
behaviour and have **not** been run against a live Railway project. Expect the private
networking step to be the one that needs adjusting.

## The shape

Three services in one Railway project:

| Service | Root directory | What it is |
|---|---|---|
| **Postgres** | — | Railway's managed plugin. |
| **api** | `app/backend` | Nest. Private only — no public domain. |
| **web** | `app/web` | nginx: the SPA + `/api` proxied to `api`. **This one gets the domain.** |

`railway.json` in each directory sets the Dockerfile path and the health check, so both
services build from the repo without dashboard build configuration.

## The part that is not optional

Railway's Postgres gives you **one role, and it is a superuser**. Postgres skips *every*
row-level security policy for a superuser, and this application deliberately omits
`tenantId` from its WHERE clauses and relies on those policies. Pointing `DATABASE_URL`
at Railway's `postgres` user therefore returns **every tenant's** patient records, with no
error and no log line — see [security-rls-bypass-finding.md](security-rls-bypass-finding.md).

The app refuses to boot in that configuration, so it fails closed rather than leaking. But
that means the deploy does not work until you create the second role.

`prisma/rls-roles.sql` creates it. It no longer hardcodes the database name or the owner —
it reads `current_database()` and `current_user` — so it works against a database called
`railway` owned by `postgres`.

## Sequence

**1. Create the project and add Postgres.** Note the connection string it gives you; that
is your `DIRECT_DATABASE_URL` (the owner).

**2. Choose a password for the runtime role.**

```bash
openssl rand -base64 24
```

**3. Run the migrate job once.** It is a one-shot, not a startup step — schema changes
should be a decision, not something that happens because a container restarted.

From a machine with the repo and the Railway CLI:

```bash
railway link                        # select the project
railway run --service api -- sh -c '
  npx prisma migrate deploy &&
  psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" "$DIRECT_DATABASE_URL" -f prisma/rls.sql &&
  psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" "$DIRECT_DATABASE_URL" -f prisma/rls-roles.sql &&
  psql -v ON_ERROR_STOP=1 "$DIRECT_DATABASE_URL" -f prisma/rls-user.sql &&
  psql -v ON_ERROR_STOP=1 "$DIRECT_DATABASE_URL" -f prisma/constraints.sql &&
  npx ts-node prisma/seed.ts &&
  npx ts-node scripts/check-rls-live.ts'
```

The last line is the gate. It must end `PASS — every tenant-scoped table in this database
enforces tenant isolation.` **Do not route traffic to a database it fails on.**

If the connection string carries `?schema=public`, strip it before handing it to `psql` —
libpq rejects `schema` as an unknown parameter. See [[prisma-url-not-libpq]].

**4. Variables.**

On **api**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Railway's string with the user swapped to `healthos_app` and the password from step 2 |
| `JWT_SECRET` | `openssl rand -base64 48` — min 32 chars, app refuses to boot otherwise |
| `TZ` | `UTC` |
| `STORAGE_DIR` | `/data/uploads`, with a volume mounted there — see the warning below |

Do **not** give `api` the `DIRECT_DATABASE_URL`. The serving process has no business
holding credentials that can alter a schema.

On **web**:

| Variable | Value |
|---|---|
| `API_ORIGIN` | `http://api.railway.internal:3000` |
| `TZ` | `UTC` |

`PORT` is injected by Railway on both; nginx binds it via the template.

**5. Attach a volume to `api` at `/data/uploads` on the FIRST deploy.** Clinical
photographs land there. Without it they go to the container's writable layer and die on
every redeploy while the `PhotoAsset` rows in Postgres survive — charts referencing bytes
that no longer exist. **This cannot be retrofitted after photos exist.**

**6. Give `web` the public domain. Leave `api` private.**

## Verifying

```bash
curl -fsS https://<domain>/                     # SPA
curl -fsS https://<domain>/api/health/ready     # proxy + database
curl -fsS https://<domain>/patients/whatever    # client route, must be 200 not 404
```

Then log in and open a patient. A 404 on the third means `try_files` is not in effect; a
404 on the second usually means the `/api` prefix is not being stripped — that is the
trailing slash in `proxy_pass ${API_ORIGIN}/`.

## Known rough edges

- **Private DNS.** `API_ORIGIN` is substituted into a *literal* `proxy_pass`, so nginx
  resolves it once at startup through `/etc/resolv.conf`. That is what makes
  `*.railway.internal` work without an explicit `resolver` directive — but nginx then
  keeps that address. **If `api` is redeployed and moves, redeploy `web` too.** If the
  name does not resolve at all, the fallback is to give `api` a public domain and point
  `API_ORIGIN` at it, which costs a public hop.
- **Backups.** Railway's Postgres backups do not include the uploads volume. A `pg_dump`
  does not capture photographs. Both, and a restore you have actually performed.
- **The seed creates a demo tenant** with a known password. Remove it before anything real.
