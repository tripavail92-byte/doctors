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
-- Run as the OWNER, after schema creation:
--   psql -v ON_ERROR_STOP=1 "$DIRECT_DATABASE_URL" -f prisma/rls-roles.sql
--
-- NOTHING HERE NAMES THE DATABASE OR THE OWNER. Both used to be hardcoded to the
-- docker-compose setup ("healthos"), which made this file silently wrong on any
-- other host. A managed Postgres — Railway, Neon, RDS — hands you a database
-- called something else and an owner called `postgres`:
--
--   GRANT CONNECT ON DATABASE healthos    -> hard error, database does not exist
--   ALTER DEFAULT PRIVILEGES FOR ROLE healthos
--        -> hard error if no such role; and if a role of that name DOES happen to
--           exist without owning anything, it attaches to a role that creates no
--           tables. Every table added by a LATER migration is then unreadable to
--           the runtime role, and nothing says so until that feature is used.
--
-- current_database() and current_user are read at run time instead. GRANT and
-- ALTER DEFAULT PRIVILEGES do not accept expressions, so those statements are
-- built with format() and executed with \gexec.

-- Password. Pass it in on anything reachable:
--   psql -v app_password="$APP_DB_PASSWORD" ...
-- The fallback is the local development literal, and is only safe on localhost.
\if :{?app_password}
\else
\set app_password 'healthos_app_pw'
\endif

-- Create the role if absent. Built with format() rather than a DO block because
-- psql does not substitute :variables inside dollar-quoted strings — a DO block
-- would send the literal text ":'app_password'" as the password.
SELECT format(
         'CREATE ROLE healthos_app LOGIN PASSWORD %L '
         'NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
         :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthos_app')
\gexec

-- And set the password every run, so rotating it is re-running this file with a
-- new -v rather than remembering a separate ALTER.
SELECT format('ALTER ROLE healthos_app PASSWORD %L', :'app_password')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthos_app')
\gexec

-- Whatever this database is actually called.
SELECT format('GRANT CONNECT ON DATABASE %I TO healthos_app', current_database())
\gexec

GRANT USAGE ON SCHEMA public TO healthos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO healthos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO healthos_app;

-- Tables created by future migrations are reachable without re-granting.
--
-- FOR ROLE must name the role that CREATES those tables — i.e. whoever runs the
-- migrations, which is whoever is running this script right now. That is what
-- current_user is.
SELECT format(
         'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
         'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO healthos_app',
         current_user)
\gexec
SELECT format(
         'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
         'GRANT USAGE, SELECT ON SEQUENCES TO healthos_app',
         current_user)
\gexec

-- Guard: the runtime role must never be able to bypass RLS.
DO $$
DECLARE bad boolean;
BEGIN
  SELECT rolsuper OR rolbypassrls INTO bad FROM pg_roles WHERE rolname = 'healthos_app';
  IF bad THEN
    RAISE EXCEPTION 'healthos_app can bypass RLS — tenant isolation would be inert';
  END IF;
END $$;

-- Guard: the default privileges above must have attached to the role that owns
-- the tables. If they attached to anything else, a migration added tomorrow
-- produces tables the app cannot read, and the failure appears later, in a
-- feature, as a permission error nobody connects to this file.
DO $$
DECLARE owner_of_tables name;
BEGIN
  SELECT tableowner INTO owner_of_tables
    FROM pg_tables WHERE schemaname = 'public' LIMIT 1;

  IF owner_of_tables IS NULL THEN
    RAISE NOTICE 'no tables in public yet — run this again after the schema is applied';
  ELSIF owner_of_tables <> current_user THEN
    RAISE EXCEPTION
      'this script is running as % but the tables are owned by % — default privileges '
      'would attach to the wrong role and future migrations would be unreadable to '
      'healthos_app. Run it as the owner (DIRECT_DATABASE_URL).',
      current_user, owner_of_tables;
  END IF;
END $$;
