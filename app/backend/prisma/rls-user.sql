-- ---------------------------------------------------------------------------
-- RLS for "User", plus a NULL-safe hardening pass over every other policy.
--
-- WHY "User" IS NOT A COPY-PASTE OF tenant_isolation
--
-- "User" was the ONE tenant-scoped table with no RLS at all. Verified as
-- healthos_app under a bogus tenant id: "Patient" -> 0 rows, but "User" ->
-- every row across every tenant, including passwordHash and the platform
-- admin. It has not leaked yet only because auth.service.ts:21 is the single
-- User query in the codebase. But the house style is to omit `tenantId` from
-- WHERE clauses and rely on RLS, so the first `tx.user.findMany()` in a staff
-- directory would hand tenant A the roster of tenant B — in a PR that looks
-- exactly like 70 correct precedents.
--
-- Two things make it special:
--   1. Login runs BEFORE any tenant context exists (you cannot know the tenant
--      until you have found the user). Under a plain tenant policy the qual is
--      NULL and every login breaks.
--   2. "User".tenantId is nullable by design — platform admins have no tenant —
--      and `NULL = anything` is never true, so platform rows would be invisible
--      even under correct context.
--
-- The login problem is solved with a narrow SECURITY DEFINER function rather
-- than a second DB role/connection pool: it is one statement, it returns only
-- the columns login needs, and it is the only sanctioned way past the policy.
--
-- What is deliberately NOT done: `current_setting(...) IS NULL OR "tenantId" =
-- ...`. That re-opens the whole table whenever context is unset — precisely the
-- leak being closed here, made permanent by design.
--
-- Run as the OWNER (healthos), after schema creation:
--   docker exec -i healthos-db psql -U healthos -d healthos -f - < prisma/rls-user.sql
-- ---------------------------------------------------------------------------

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

-- Tenant staff see only their own tenant's users. nullif() so that a stray
-- empty-string GUC degrades to zero rows instead of raising on ''::uuid.
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- The ONLY sanctioned way to read a user without tenant context: login.
-- SECURITY DEFINER runs as the owner, so it is not subject to the policy above.
-- It is deliberately narrow — lookup by unique email, returning just what
-- AuthService needs to verify a password and mint a JWT. It must never grow a
-- filter-free list variant.
CREATE OR REPLACE FUNCTION auth_find_user_by_email(p_email text)
RETURNS TABLE (
  id                uuid,
  "tenantId"        uuid,
  email             text,
  "passwordHash"    text,
  name              text,
  role              "UserRole",
  "isPlatformAdmin" boolean,
  status            text,
  "createdAt"       timestamp(3)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- Pin search_path: a SECURITY DEFINER function without this can be hijacked by
-- a caller-controlled search_path resolving `"User"` to their own table.
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u."tenantId", u.email, u."passwordHash", u.name, u.role,
         u."isPlatformAdmin", u.status, u."createdAt"
  FROM "User" u
  WHERE u.email = p_email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_find_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_user_by_email(text) TO healthos_app;

-- ---------------------------------------------------------------------------
-- Cross-tenant membership enumeration for context switching.
--
-- WHY THIS IS SECURITY DEFINER:
-- UserMembership is RLS-scoped to a single tenantId. An organization owner
-- with memberships in clinic A (tenant A) and clinic B (tenant B) can only
-- see one tenant's rows from within a single forTenant() call. Enumerating
-- ALL memberships for a context-switch dropdown requires crossing that
-- boundary. This function is the single sanctioned path: it returns ONLY the
-- authenticated user's own memberships, identified by a validated UUID from
-- the verified JWT. No list-all or filter-free variant is possible.
-- Pinned search_path prevents hijacking.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_find_memberships_for_user(p_user_id uuid)
RETURNS TABLE (
  membership_id      uuid,
  "organizationId"   uuid,
  organization_name  text,
  "tenantId"         uuid,
  clinic_name        text,
  "clinicId"         uuid,
  "branchId"         uuid,
  branch_name        text,
  "departmentId"     uuid,
  department_name    text,
  role               "UserRole",
  "isDefaultContext" boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.id,
    m."organizationId",
    o.name,
    m."tenantId",
    COALESCE(oc."displayName", t.name),
    m."clinicId",
    m."branchId",
    b.name,
    m."departmentId",
    d.name,
    m.role,
    m."isDefaultContext"
  FROM "UserMembership" m
  JOIN "Organization"        o  ON o.id  = m."organizationId"
  JOIN "OrganizationClinic"  oc ON oc.id = m."clinicId"
  JOIN "Tenant"              t  ON t.id  = m."tenantId"
  LEFT JOIN "Branch"         b  ON b.id  = m."branchId"
  LEFT JOIN "Department"     d  ON d.id  = m."departmentId"
  WHERE m."userId"   = p_user_id
    AND m."isActive" = true
  ORDER BY m."isDefaultContext" DESC, m."createdAt" ASC;
$$;

REVOKE ALL ON FUNCTION auth_find_memberships_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_memberships_for_user(uuid) TO healthos_app;

-- ---------------------------------------------------------------------------
-- Cross-tenant context preference write.
--
-- UserContextPreference is scoped via User.tenantId (bespoke RLS). For a
-- user who has switched to a different tenant, forCurrentTenant writes are
-- blocked by that policy. This function is the single sanctioned write path:
-- it updates (or creates) the preference row keyed by userId regardless of
-- which tenant context the caller is currently in.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_set_context_preference(
  p_user_id         uuid,
  p_organization_id uuid,
  p_clinic_id       uuid,
  p_branch_id       uuid,
  p_department_id   uuid
) RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO "UserContextPreference"
    ("id", "userId", "lastOrganizationId", "lastClinicId",
     "lastBranchId", "lastDepartmentId", "updatedAt")
  VALUES
    (gen_random_uuid(), p_user_id, p_organization_id, p_clinic_id,
     p_branch_id, p_department_id, now())
  ON CONFLICT ("userId") DO UPDATE SET
    "lastOrganizationId" = EXCLUDED."lastOrganizationId",
    "lastClinicId"       = EXCLUDED."lastClinicId",
    "lastBranchId"       = EXCLUDED."lastBranchId",
    "lastDepartmentId"   = EXCLUDED."lastDepartmentId",
    "updatedAt"          = now();
$$;

REVOKE ALL ON FUNCTION auth_set_context_preference(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_set_context_preference(uuid, uuid, uuid, uuid, uuid) TO healthos_app;

-- ---------------------------------------------------------------------------
-- NULL-safe hardening for every other tenant_isolation policy.
--
-- `current_setting('app.tenant_id', true)` returns NULL only when the GUC was
-- NEVER set on that connection. After the first set_config(..., is_local=true)
-- transaction, it resets to the EMPTY STRING at commit — and ''::uuid RAISES.
-- On a pooled connection, that turns the documented "unset context yields zero
-- rows" guarantee into a 500. nullif(..., '') makes both states fail closed.
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_policy p ON p.polrelid = c.oid AND p.polname = 'tenant_isolation'
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> 'User'
      AND a.attname = 'tenantId'
      AND a.attnum > 0
      AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'ALTER POLICY tenant_isolation ON %I USING ("tenantId" = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END $$;
