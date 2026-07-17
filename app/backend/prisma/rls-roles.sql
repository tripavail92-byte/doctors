-- Runtime DB role for Health OS.
--
-- WHY THIS EXISTS: Postgres skips ALL row-level security policies for any role
-- with SUPERUSER or BYPASSRLS. If the application connects as the table owner
-- (a superuser in the default docker-compose image), every tenant_isolation
-- policy in rls.sql is silently inert and tenants can read each other's rows —
-- with no error and no log line to reveal it. FORCE ROW LEVEL SECURITY does NOT
-- protect against this; it only subjects a *non-bypassing* owner to policies.
--
-- So: migrations run as the owner (DIRECT_DATABASE_URL); the app runs as
-- healthos_app (DATABASE_URL), which can touch data but cannot bypass RLS.
--
-- Run as the owner, after schema creation:
--   docker exec -i healthos-db psql -U healthos -d healthos -f - < prisma/rls-roles.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthos_app') THEN
    CREATE ROLE healthos_app LOGIN PASSWORD 'healthos_app_pw'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT CONNECT ON DATABASE healthos TO healthos_app;
GRANT USAGE ON SCHEMA public TO healthos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO healthos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO healthos_app;

-- Tables created by future migrations are reachable without re-granting.
ALTER DEFAULT PRIVILEGES FOR ROLE healthos IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO healthos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE healthos IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO healthos_app;

-- Guard: the runtime role must never be able to bypass RLS.
DO $$
DECLARE bad boolean;
BEGIN
  SELECT rolsuper OR rolbypassrls INTO bad FROM pg_roles WHERE rolname = 'healthos_app';
  IF bad THEN
    RAISE EXCEPTION 'healthos_app can bypass RLS — tenant isolation would be inert';
  END IF;
END $$;
