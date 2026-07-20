/**
 * Does the DATABASE actually enforce tenant isolation, right now?
 *
 * WHY THIS IS NOT COVERED BY WHAT ALREADY EXISTS
 * ---------------------------------------------
 * Three things looked like they answered this question. None of them does:
 *
 *   check-rls-coverage.ts   reads schema.prisma and rls.sql as TEXT. It proves
 *                           the repo INTENDS a policy per tenant model. A
 *                           database where those files were never applied passes
 *                           it, because the files are unchanged.
 *
 *   PrismaService preflight the boot log says "RLS enforceable: connected as
 *                           non-bypassing role". Its only query asks pg_roles
 *                           whether the role has SUPERUSER/BYPASSRLS. It proves
 *                           the role WOULD OBEY a policy. It never asks whether
 *                           one exists.
 *
 *   check-tenant-isolation  plants a second tenant's row and asserts zero
 *                           cross-reads — as the runtime role, correctly. But it
 *                           probes four tables: patient, user, observation,
 *                           invoice. There are 79 tenant-scoped tables. Worse,
 *                           those four sit near the TOP of rls.sql, so a partial
 *                           apply that dies part-way leaves exactly the probed
 *                           set policed and prints PASS.
 *
 * So all three can be green while PhototherapyCourse, Prescription, LabOrder and
 * 60-odd others have no policy at all, and `tx.patient.findMany()` — which by
 * house style carries no tenantId in its WHERE clause — returns every tenant's
 * rows. No error, no log line, HTTP 200.
 *
 * This asks Postgres directly, about every table, and checks the policy's
 * EFFECT rather than its name: a policy called tenant_isolation with
 * `USING (true)` is worse than none, because it looks right in every catalog
 * listing that counts by name.
 *
 * Run:  npx ts-node scripts/check-rls-live.ts   (owner credentials)
 */
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Postgres does not store the policy text you wrote — it stores a parsed
// expression and prints it back normalized. The source line
//
//   USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)
//
// comes back as
//
//   ("tenantId" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
//
// — uppercased function names and explicit ::text casts. Matching the source
// spelling reported all 79 correct tables as non-canonical. So match on the
// SEMANTICS: the three parts that make the policy isolate, case-insensitively.
// Deliberately still strict — `USING (true)` or a policy keyed on a different
// column must fail, because that is the shape that looks right in any listing
// which only counts policies by name.
const REQUIRED = [
  /"tenantId"\s*=/i,                   // keyed on the tenant column
  /nullif\s*\(/i,                      // empty context -> NULL, never a match
  /current_setting\('app\.tenant_id'/i, // reads the GUC forTenant() sets
];

type Row = {
  table: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  policy_count: bigint;
  qual: string | null;
};

let pass = 0;
let fail = 0;
const bad: string[] = [];

function check(label: string, ok: boolean, detail: unknown = ''): void {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? '  -> ' + detail : ''}`);
}

async function main(): Promise<void> {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('FATAL: DIRECT_DATABASE_URL (or DATABASE_URL) must be set — this reads pg catalogs as the owner.');
    process.exit(2);
  }
  const db = new PrismaClient({ datasources: { db: { url } } });

  // Every base table carrying a tenantId column IS tenant-scoped, by definition.
  // Deriving the list from the live catalog rather than from schema.prisma is
  // the point: a table that exists only in the database still leaks.
  const rows = await db.$queryRawUnsafe<Row[]>(`
    SELECT c.relname                             AS table,
           c.relrowsecurity                      AS rls_enabled,
           c.relforcerowsecurity                 AS rls_forced,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
           (SELECT pg_get_expr(p.polqual, p.polrelid) FROM pg_policy p
             WHERE p.polrelid = c.oid AND p.polname = 'tenant_isolation' LIMIT 1) AS qual
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = c.oid AND a.attname = 'tenantId' AND a.attnum > 0 AND NOT a.attisdropped)
     ORDER BY c.relname`);

  console.log(`\nLive RLS audit — ${rows.length} tenant-scoped tables in this database\n`);
  check('there are tenant-scoped tables to audit', rows.length > 0, `${rows.length} found`);

  for (const r of rows) {
    const problems: string[] = [];
    if (!r.rls_enabled) problems.push('RLS not enabled');
    // FORCE matters because the table OWNER is otherwise exempt from its own
    // policies — and migrations, the seed and demo scripts all connect as owner.
    if (!r.rls_forced) problems.push('RLS not FORCED (owner exempt)');
    if (Number(r.policy_count) === 0) problems.push('no policies at all');
    else if (r.qual == null) problems.push('no tenant_isolation policy');
    else {
      const missing = REQUIRED.filter((re) => !re.test(r.qual as string));
      if (missing.length) problems.push(`non-canonical qual: ${r.qual.slice(0, 70)}`);
    }
    if (problems.length) bad.push(`${r.table}: ${problems.join('; ')}`);
  }

  check(
    'every tenant-scoped table has RLS enabled, FORCED, and a canonical tenant_isolation policy',
    bad.length === 0,
    bad.length === 0 ? `${rows.length}/${rows.length} clean` : `${bad.length} table(s) unprotected`,
  );
  for (const b of bad.slice(0, 25)) console.log(`         - ${b}`);
  if (bad.length > 25) console.log(`         ... and ${bad.length - 25} more`);

  // A count alone would be satisfied by a database with one table in it, which
  // is exactly what a half-applied schema looks like.
  check(
    'the table count is plausible for this schema (not a half-built database)',
    rows.length >= 70,
    `${rows.length} tenant-scoped tables`,
  );

  await db.$disconnect();

  console.log(`\n===== ${pass}/${pass + fail} passed =====`);
  if (pass + fail === 0) {
    console.log('  NO CHECKS RAN - the script asserted nothing');
    process.exit(1);
  }
  if (fail) {
    console.error(
      `\nFAIL — tenant isolation is NOT enforced on ${bad.length} table(s). ` +
        `Re-apply prisma/rls.sql as the owner and re-run. Do not route traffic to this database.`,
    );
    process.exit(1);
  }
  console.log('PASS — every tenant-scoped table in this database enforces tenant isolation.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
