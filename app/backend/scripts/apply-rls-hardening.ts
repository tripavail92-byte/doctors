/**
 * Apply the NULL-safe RLS hardening loop from rls-user.sql to the database
 * this script is pointed at.
 *
 * WHAT THIS IS
 * ------------
 * Every tenant_isolation policy in rls-user.sql exists in two forms:
 *   before:  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
 *   after:   USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
 *
 * The `nullif` form is the one committed at the bottom of rls-user.sql (the DO
 * loop). It exists because `current_setting('app.tenant_id', true)` returns
 * NULL only on a connection that has NEVER set the GUC, and resets to the
 * EMPTY STRING at commit of any set_config(..., is_local=true) transaction. On
 * a pooled connection every subsequent read hits ''::uuid, which RAISES.
 *
 * Failure mode is fail-CLOSED (a 500), not open (a cross-tenant read) — so this
 * is a reliability fix, not an isolation fix. Isolation was and remains intact.
 *
 * WHY A DEDICATED SCRIPT
 * ----------------------
 * The full rls-user.sql also re-CREATEs three SECURITY DEFINER functions and
 * re-RUNs their REVOKE/GRANT. Two of those are already correct in production
 * (I applied them separately). Running the whole file works, but touching more
 * than necessary on a live database is how mistakes leak in. This runs ONLY
 * the DO block.
 *
 * Point-in-time: takes a snapshot of every tenant_isolation policy first, so
 * the diff is inspectable and the operation is trivially reversible with the
 * committed rls-user.sql if anything looks wrong.
 *
 * Usage:
 *   railway run npx ts-node scripts/apply-rls-hardening.ts
 * or:
 *   DATABASE_URL=... npx ts-node scripts/apply-rls-hardening.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

// The exact loop from rls-user.sql. Kept as a literal string, not read from
// the file, so a future edit to that file cannot silently change what this
// script does to a live database.
const DO_BLOCK = `
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
`;

// A defensive check: refuse to run against a live database if the schema does
// not look like Health OS. This is the safety belt for a wrongly-set
// DATABASE_URL.
const SANITY_TABLES = ['Tenant', 'Patient', 'User', 'UserMembership'];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — refusing to run.');
  }

  // Redact the password when logging where we are pointed. Do this once, up
  // front, so nobody has to read logs to work out what got altered.
  const redacted = url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  console.log(`Target: ${redacted}`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. Sanity: prove we're pointed at a Health OS database.
    const foundNames = await prisma.$queryRawUnsafe<{ relname: string }[]>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY($1::text[])`,
      SANITY_TABLES,
    );
    const found = new Set(foundNames.map((r) => r.relname));
    const missing = SANITY_TABLES.filter((t) => !found.has(t));
    if (missing.length > 0) {
      throw new Error(
        `This does not look like a Health OS database. Missing: ${missing.join(', ')}. Refusing to run.`,
      );
    }

    // 2. Snapshot every tenant_isolation policy BEFORE.
    const before = await prisma.$queryRawUnsafe<
      { relname: string; using_expr: string; with_check: string | null }[]
    >(
      `SELECT c.relname,
              pg_get_expr(p.polqual, p.polrelid)      AS using_expr,
              pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND p.polname = 'tenant_isolation'
       ORDER BY c.relname`,
    );

    const beforeHardened = before.filter((r) => r.using_expr.toLowerCase().includes('nullif')).length;
    const beforeTotal = before.length;
    console.log(`\nBefore: ${beforeHardened}/${beforeTotal} tenant_isolation policies are hardened.`);
    if (beforeHardened === beforeTotal) {
      console.log('Nothing to do — every policy is already in the nullif() form.');
      return;
    }

    const scratch =
      process.env.HEALTHOS_SCRATCH ||
      path.join(process.cwd(), '..', '..', 'app', 'backend', 'prisma');
    const snapshotPath = path.join(
      scratch,
      `rls-policies-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    // Make it easy to write anywhere by trying HEALTHOS_SCRATCH first.
    const target = process.env.HEALTHOS_SCRATCH
      ? path.join(process.env.HEALTHOS_SCRATCH, path.basename(snapshotPath))
      : snapshotPath;
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(before, null, 2));
      console.log(`Snapshot written to ${target}`);
    } catch (e) {
      console.warn(`Could not write snapshot file (${(e as Error).message}) — continuing anyway.`);
    }

    // 3. Apply the DO block.
    console.log('\nApplying hardening loop...');
    await prisma.$executeRawUnsafe(DO_BLOCK);

    // 4. Snapshot AFTER and prove the count went up.
    const after = await prisma.$queryRawUnsafe<{ relname: string; using_expr: string }[]>(
      `SELECT c.relname, pg_get_expr(p.polqual, p.polrelid) AS using_expr
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND p.polname = 'tenant_isolation'
       ORDER BY c.relname`,
    );
    const afterHardened = after.filter((r) => r.using_expr.toLowerCase().includes('nullif')).length;
    const changed = after.filter((a) => {
      const b = before.find((x) => x.relname === a.relname);
      return b && b.using_expr !== a.using_expr;
    });

    console.log(`\nAfter:  ${afterHardened}/${after.length} tenant_isolation policies are hardened.`);
    console.log(`Rewrote ${changed.length} policies:`);
    for (const c of changed) console.log(`  - ${c.relname}`);

    // 5. Prove RLS is still ON on every affected table. The DO block only
    //    changes the USING expression; it does not touch ENABLE / FORCE. But
    //    checking is cheap and this is the whole point of the exercise.
    const rls = await prisma.$queryRawUnsafe<
      { relname: string; rowsecurity: boolean; forcerowsecurity: boolean }[]
    >(
      `SELECT c.relname, c.relrowsecurity AS rowsecurity, c.relforcerowsecurity AS forcerowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind='r'
         AND c.relname = ANY($1::text[])`,
      after.map((a) => a.relname),
    );
    const brokenRls = rls.filter((r) => !r.rowsecurity || !r.forcerowsecurity);
    if (brokenRls.length > 0) {
      throw new Error(
        `RLS is missing on: ${brokenRls.map((r) => r.relname).join(', ')}. This must not happen — investigate.`,
      );
    }
    console.log(
      `Verified: RLS is ENABLED and FORCED on all ${rls.length} affected tables.`,
    );

    if (afterHardened !== after.length) {
      throw new Error(
        `Only ${afterHardened} of ${after.length} policies are hardened. Investigate the ones still un-hardened.`,
      );
    }

    console.log('\nDONE.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
