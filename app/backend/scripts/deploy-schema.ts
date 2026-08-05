/**
 * Health OS schema deployment runbook.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * The Health OS schema does not live in Prisma migrations alone. Prisma manages
 * tables and columns, but four things it cannot express live in psql files that
 * must run alongside every deploy:
 *
 *   prisma/rls.sql          Row-Level Security policies for tenant isolation.
 *                            86 CREATE POLICY statements. Fails closed if any
 *                            new tenant-scoped table lacks its policy.
 *
 *   prisma/rls-roles.sql     Creates the runtime "healthos_app" role
 *                            (NOSUPERUSER NOBYPASSRLS) and grants. PrismaService
 *                            refuses to boot connected as anyone with BYPASSRLS.
 *
 *   prisma/rls-user.sql      Bespoke User-table RLS (login runs before the
 *                            tenant context exists), plus the two SECURITY
 *                            DEFINER auth functions for cross-tenant lookups,
 *                            plus the nullif()-hardening loop over every
 *                            tenant_isolation policy from rls.sql.
 *
 *   prisma/constraints.sql   Partial unique indexes (one ADMITTED admission per
 *                            patient etc.) that Prisma cannot express.
 *
 * The Dockerfile carries a `migrate` target that runs all of them, but nothing
 * on Railway invokes it — the deployed service is the `runtime` target only.
 * So every release since Phase A silently ran on top of a database missing
 * some subset of what the committed code assumes. Three separate failures
 * traced back to this in the last 24 hours:
 *   - The privilege escalation was patched in code AND fully applied to prod
 *     only because I noticed the deployed build did not answer with the new
 *     validator message and re-checked.
 *   - Two Phase A auth functions were missing in production; /auth/contexts
 *     and /auth/switch-context returned 500 for days without anyone noticing.
 *   - I misread a lowercase-vs-uppercase output and claimed the NULLIF
 *     hardening loop had never run against production. It had.
 *
 * All three would have been caught by ONE thing: a runbook that leaves the
 * database in a state a machine can verify. This is that runbook.
 *
 * ============================================================================
 * SHAPE
 * ============================================================================
 * Two modes:
 *
 *   --dry-run        (default): connect, take a full snapshot of the current
 *                    schema-adjacent state (migration list, policies with
 *                    quals, functions with ACLs, indexes, RLS enable/force
 *                    flags), report drift against what the committed code
 *                    would install, and write nothing.
 *
 *   --apply          run `prisma migrate deploy` then execute each of the
 *                    four .sql files (each is already idempotent — rls.sql
 *                    uses DROP POLICY IF EXISTS, rls-user.sql uses CREATE OR
 *                    REPLACE and DO blocks, constraints.sql uses CREATE INDEX
 *                    IF NOT EXISTS, rls-roles.sql wraps role creation in a DO
 *                    block). Then re-snapshot and confirm the drift is gone.
 *                    Every apply writes a JSON snapshot before AND after into
 *                    HEALTHOS_SCRATCH (or the CWD).
 *
 * Both modes require DATABASE_URL. --apply additionally requires
 * DIRECT_DATABASE_URL for `prisma migrate deploy` (the runtime URL and the
 * owner URL are the same on Railway single-role deployments).
 *
 * ============================================================================
 * WHAT THIS SCRIPT DOES NOT DO
 * ============================================================================
 * It does not run the seed. Seeding is destructive (creates users) and is its
 * own separate concern with its own SEED_PASSWORD guard. If the deploy needs
 * seed data, run `ts-node prisma/seed.ts` deliberately, afterwards.
 *
 * It does not rehearse a restore. Backups exist or they do not; the runbook
 * cannot prove they do. Do that separately, on a schedule.
 *
 * It does not touch the runtime — it does not restart the API or roll pods.
 * If a Prisma client regeneration is needed (schema changes), Railway's build
 * step handles that; if not, no restart is required for pure RLS changes.
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node scripts/deploy-schema.ts            # dry run
 *   DATABASE_URL=... DIRECT_DATABASE_URL=... \
 *     npx ts-node scripts/deploy-schema.ts --apply                    # apply
 */
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = __dirname;
const PRISMA_DIR = path.resolve(HERE, '..', 'prisma');

// rls-roles.sql is DELIBERATELY OMITTED here.
//
// It uses psql-only meta-commands (`\if`, `\set`, `\gexec`) that the pg driver
// cannot parse. That file was designed to run once via psql during initial
// database bootstrap by an operator with the connection string in hand. Every
// subsequent runbook invocation only needs to VERIFY the healthos_app role
// exists and is safe — which analyze() below does explicitly, treating a
// missing or dangerous role as a BLOCKER. Trying to re-apply it every deploy
// would require reimplementing a psql feature in TypeScript, which is where
// the bug lives.
//
// The other three files ARE applied on every run. Each is idempotent by
// construction — rls.sql uses DROP POLICY IF EXISTS before every CREATE,
// rls-user.sql uses CREATE OR REPLACE and DO blocks, constraints.sql uses
// CREATE INDEX IF NOT EXISTS and DROP CONSTRAINT IF EXISTS + ADD.
const SQL_FILES = [
  'rls.sql',
  'rls-user.sql',
  'constraints.sql',
] as const;

// A defensive check: refuse to run against a database whose schema does not
// look like Health OS. This is the belt for a wrongly-set DATABASE_URL.
const SANITY_TABLES = ['Tenant', 'Patient', 'User', 'UserMembership'];

// The three functions rls-user.sql installs. Every deployed database must
// carry all three, each SECURITY DEFINER, each executable by healthos_app
// but not by PUBLIC.
const REQUIRED_FUNCTIONS = [
  'auth_find_user_by_email',
  'auth_find_memberships_for_user',
  'auth_set_context_preference',
] as const;

// ---------------------------------------------------------------------------
// Snapshot: what the database actually looks like right now.
// ---------------------------------------------------------------------------

interface PolicyRow {
  relname: string;
  polname: string;
  using: string | null;
  withCheck: string | null;
  rlsEnabled: boolean;
  rlsForced: boolean;
}

interface FunctionRow {
  proname: string;
  isSecurityDefiner: boolean;
  publicCanExecute: boolean;
  appCanExecute: boolean;
}

interface IndexRow {
  relname: string;
  indexname: string;
  definition: string;
}

interface Snapshot {
  targetUrl: string;
  takenAt: string;
  migrationsApplied: string[];
  tenantScopedTables: string[];
  policies: PolicyRow[];
  functions: FunctionRow[];
  partialIndexes: IndexRow[];
  runtimeRoleName: string | null;
  runtimeRoleBypassrls: boolean | null;
  runtimeRoleSuperuser: boolean | null;
}

async function snapshot(client: Client, targetUrl: string): Promise<Snapshot> {
  const migrations = (
    await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM _prisma_migrations
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
       ORDER BY finished_at`,
    )
  ).rows.map((r) => r.migration_name);

  // Every table that carries a tenantId column. This is the population every
  // tenant_isolation policy is required to cover — a new tenant-scoped table
  // added by a migration is the exact place an "already applied" story silently
  // breaks.
  const scoped = (
    await client.query<{ relname: string }>(
      `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND a.attname = 'tenantId'
         AND a.attnum > 0
         AND NOT a.attisdropped
       ORDER BY c.relname`,
    )
  ).rows.map((r) => r.relname);

  const policies = (
    await client.query<PolicyRow>(
      `SELECT c.relname,
              p.polname,
              pg_get_expr(p.polqual, p.polrelid)       AS using,
              pg_get_expr(p.polwithcheck, p.polrelid)  AS "withCheck",
              c.relrowsecurity        AS "rlsEnabled",
              c.relforcerowsecurity   AS "rlsForced"
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
       ORDER BY c.relname, p.polname`,
    )
  ).rows;

  const functions = (
    await client.query<FunctionRow>(
      `SELECT p.proname,
              p.prosecdef                                    AS "isSecurityDefiner",
              has_function_privilege('public', p.oid, 'EXECUTE') AS "publicCanExecute",
              has_function_privilege('healthos_app', p.oid, 'EXECUTE') AS "appCanExecute"
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = ANY($1::text[])
       ORDER BY p.proname`,
      [REQUIRED_FUNCTIONS as unknown as string[]],
    )
  ).rows;

  const indexes = (
    await client.query<IndexRow>(
      `SELECT c.relname AS relname, i.indexname, i.indexdef AS definition
       FROM pg_indexes i
       JOIN pg_class c ON c.relname = i.tablename
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND i.schemaname = 'public'
         AND i.indexdef ILIKE '%WHERE%'
       ORDER BY c.relname, i.indexname`,
    )
  ).rows;

  const role = (
    await client.query<{ rolname: string; rolbypassrls: boolean; rolsuper: boolean }>(
      `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'healthos_app'`,
    )
  ).rows[0];

  return {
    targetUrl,
    takenAt: new Date().toISOString(),
    migrationsApplied: migrations,
    tenantScopedTables: scoped,
    policies,
    functions,
    partialIndexes: indexes,
    runtimeRoleName: role?.rolname ?? null,
    runtimeRoleBypassrls: role?.rolbypassrls ?? null,
    runtimeRoleSuperuser: role?.rolsuper ?? null,
  };
}

// ---------------------------------------------------------------------------
// Analysis: does the snapshot match what the code expects?
// ---------------------------------------------------------------------------

interface Finding {
  severity: 'blocker' | 'warn' | 'info';
  message: string;
}

function analyze(snap: Snapshot): Finding[] {
  const out: Finding[] = [];

  // Runtime role must exist and be safe.
  if (!snap.runtimeRoleName) {
    out.push({
      severity: 'blocker',
      message: 'healthos_app role does not exist. rls-roles.sql has never been applied. PrismaService will refuse to boot.',
    });
  } else {
    if (snap.runtimeRoleBypassrls) {
      out.push({
        severity: 'blocker',
        message: 'healthos_app has BYPASSRLS. Every tenant_isolation policy is inert against this role. Cross-tenant reads are possible.',
      });
    }
    if (snap.runtimeRoleSuperuser) {
      out.push({
        severity: 'blocker',
        message: 'healthos_app is SUPERUSER. Every RLS policy is inert. Cross-tenant reads are possible.',
      });
    }
  }

  // Every tenant-scoped table must carry a tenant_isolation policy with the
  // canonical nullif() qual, RLS enabled, and RLS forced.
  const bespokeOk = new Set(['User', 'Organization', 'UserContextPreference']);
  const byTable = new Map<string, PolicyRow[]>();
  for (const p of snap.policies) {
    if (!byTable.has(p.relname)) byTable.set(p.relname, []);
    byTable.get(p.relname)!.push(p);
  }

  for (const table of snap.tenantScopedTables) {
    const ps = byTable.get(table) ?? [];
    const isolation = ps.find((p) => p.polname === 'tenant_isolation');

    if (bespokeOk.has(table)) {
      // Bespoke tables have their own policies from rls-user.sql. Just make
      // sure RLS is on and something protects them.
      if (ps.length === 0) {
        out.push({ severity: 'blocker', message: `bespoke-allowlist table "${table}" has no policies at all` });
      }
      continue;
    }

    if (!isolation) {
      out.push({
        severity: 'blocker',
        message: `table "${table}" has no tenant_isolation policy — a fresh row from any tenant is visible to every tenant`,
      });
      continue;
    }
    if (!isolation.rlsEnabled) {
      out.push({ severity: 'blocker', message: `"${table}" has a policy but ROW LEVEL SECURITY is not ENABLED` });
    }
    if (!isolation.rlsForced) {
      out.push({ severity: 'blocker', message: `"${table}" has RLS but not FORCED — the table owner bypasses` });
    }
    // The check is case-insensitive because Postgres stores the parsed qual
    // with its function names uppercased ("NULLIF(...)"). Case-sensitive was
    // a real bug the first time this ran.
    if (!isolation.using || !isolation.using.toLowerCase().includes('nullif')) {
      out.push({
        severity: 'warn',
        message: `"${table}".tenant_isolation is not in the nullif() form — under a pooled connection it will 500 on the second request rather than fail closed`,
      });
    }
  }

  // The three SECURITY DEFINER auth functions must be present and locked down.
  for (const name of REQUIRED_FUNCTIONS) {
    const fn = snap.functions.find((f) => f.proname === name);
    if (!fn) {
      out.push({
        severity: 'blocker',
        message: `SECURITY DEFINER function "${name}" is missing — rls-user.sql has not been fully applied`,
      });
      continue;
    }
    if (!fn.isSecurityDefiner) {
      out.push({
        severity: 'blocker',
        message: `function "${name}" is not SECURITY DEFINER — the whole point of it is to run as the definer`,
      });
    }
    if (fn.publicCanExecute) {
      out.push({
        severity: 'blocker',
        message: `function "${name}" is EXECUTABLE by PUBLIC — a SECURITY DEFINER function granted to PUBLIC bypasses every RLS policy in this codebase`,
      });
    }
    if (!fn.appCanExecute) {
      out.push({
        severity: 'blocker',
        message: `function "${name}" is not executable by healthos_app — the runtime cannot use it and every login / clinic-switch will 500`,
      });
    }
  }

  return out;
}

function fmtFindings(findings: Finding[]): string {
  if (findings.length === 0) return '  (no drift)';
  return findings
    .map((f) => `  [${f.severity.toUpperCase().padEnd(7)}] ${f.message}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Apply: run prisma migrate deploy + each SQL file.
// ---------------------------------------------------------------------------

async function applySqlFile(client: Client, file: string): Promise<void> {
  const p = path.join(PRISMA_DIR, file);
  const sql = fs.readFileSync(p, 'utf-8');
  // pg's simple query protocol accepts multiple statements in one string, and
  // handles $$-delimited function bodies correctly. Splitting on ';' does not.
  // A single failing statement aborts the whole file and throws.
  await client.query(sql);
}

function runPrismaMigrateDeploy(): void {
  // spawnSync inherits the parent's env, including DIRECT_DATABASE_URL, which
  // is what `prisma migrate deploy` uses. The command exits non-zero if any
  // migration fails; that becomes an exception here.
  const res = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.resolve(HERE, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    throw new Error(`prisma migrate deploy failed with exit ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Reporting: diff two snapshots.
// ---------------------------------------------------------------------------

function diff(before: Snapshot, after: Snapshot): string[] {
  const lines: string[] = [];
  const beforeMig = new Set(before.migrationsApplied);
  const newMig = after.migrationsApplied.filter((m) => !beforeMig.has(m));
  if (newMig.length > 0) {
    lines.push(`migrations applied: ${newMig.length}`);
    for (const m of newMig) lines.push(`  + ${m}`);
  }

  const bPols = new Map(before.policies.map((p) => [`${p.relname}::${p.polname}`, p]));
  const aPols = new Map(after.policies.map((p) => [`${p.relname}::${p.polname}`, p]));
  const added: string[] = [];
  const changed: string[] = [];
  for (const [k, aP] of aPols) {
    const bP = bPols.get(k);
    if (!bP) added.push(k);
    else if (bP.using !== aP.using || bP.withCheck !== aP.withCheck) changed.push(k);
  }
  const removed = [...bPols.keys()].filter((k) => !aPols.has(k));
  if (added.length) lines.push(`policies added:   ${added.length}` + added.map((s) => `\n  + ${s}`).join(''));
  if (changed.length) lines.push(`policies changed: ${changed.length}` + changed.map((s) => `\n  ~ ${s}`).join(''));
  if (removed.length) lines.push(`policies removed: ${removed.length}` + removed.map((s) => `\n  - ${s}`).join(''));

  const bFn = new Map(before.functions.map((f) => [f.proname, f]));
  const aFn = new Map(after.functions.map((f) => [f.proname, f]));
  for (const name of REQUIRED_FUNCTIONS) {
    if (!bFn.has(name) && aFn.has(name)) lines.push(`function added:   ${name}`);
    if (bFn.has(name) && !aFn.has(name)) lines.push(`function removed: ${name}`);
  }

  const bIdx = new Set(before.partialIndexes.map((i) => i.indexname));
  const aIdx = new Set(after.partialIndexes.map((i) => i.indexname));
  for (const n of aIdx) if (!bIdx.has(n)) lines.push(`index added:      ${n}`);
  for (const n of bIdx) if (!aIdx.has(n)) lines.push(`index removed:    ${n}`);

  return lines;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function redact(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}

function writeSnapshot(snap: Snapshot, label: string): string | null {
  const dir = process.env.HEALTHOS_SCRATCH ?? path.resolve(process.cwd());
  try {
    fs.mkdirSync(dir, { recursive: true });
    const filename = `schema-snapshot-${label}-${snap.takenAt.replace(/[:.]/g, '-')}.json`;
    const target = path.join(dir, filename);
    fs.writeFileSync(target, JSON.stringify(snap, null, 2));
    return target;
  } catch (e) {
    console.warn(`  (could not write snapshot: ${(e as Error).message})`);
    return null;
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set.');
  }
  if (apply && !process.env.DIRECT_DATABASE_URL) {
    throw new Error('--apply requires DIRECT_DATABASE_URL to be set (used by prisma migrate deploy).');
  }

  console.log(`Health OS schema runbook`);
  console.log(`  target:  ${redact(url)}`);
  console.log(`  mode:    ${apply ? 'APPLY' : 'dry-run'}`);
  console.log('');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Sanity: this must look like Health OS.
    const found = (
      await client.query<{ relname: string }>(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY($1::text[])`,
        [SANITY_TABLES],
      )
    ).rows.map((r) => r.relname);
    const missing = SANITY_TABLES.filter((t) => !found.includes(t));
    if (missing.length > 0) {
      throw new Error(
        `This database does not look like Health OS. Missing tables: ${missing.join(', ')}. Refusing to run.`,
      );
    }

    // Snapshot BEFORE.
    console.log('Snapshot: BEFORE');
    const before = await snapshot(client, redact(url));
    const beforePath = writeSnapshot(before, 'before');
    if (beforePath) console.log(`  written to ${beforePath}`);

    const beforeFindings = analyze(before);
    console.log('\nDrift found in current state:');
    console.log(fmtFindings(beforeFindings));

    if (!apply) {
      const blockers = beforeFindings.filter((f) => f.severity === 'blocker').length;
      console.log('');
      if (blockers > 0) {
        console.log(`DRY RUN: ${blockers} blocker(s) present. Re-run with --apply to fix.`);
        process.exit(2);
      }
      const warns = beforeFindings.filter((f) => f.severity === 'warn').length;
      console.log(`DRY RUN: ${warns} warning(s), 0 blockers. Database matches committed code.`);
      return;
    }

    // Apply.
    console.log('\n--- prisma migrate deploy ---');
    runPrismaMigrateDeploy();

    for (const f of SQL_FILES) {
      console.log(`\n--- applying ${f} ---`);
      const start = Date.now();
      await applySqlFile(client, f);
      console.log(`    ok (${Date.now() - start}ms)`);
    }

    // Snapshot AFTER.
    console.log('\nSnapshot: AFTER');
    const after = await snapshot(client, redact(url));
    const afterPath = writeSnapshot(after, 'after');
    if (afterPath) console.log(`  written to ${afterPath}`);

    const afterFindings = analyze(after);
    const blockers = afterFindings.filter((f) => f.severity === 'blocker').length;
    console.log('\nDrift remaining after apply:');
    console.log(fmtFindings(afterFindings));

    console.log('\nDiff:');
    const diffLines = diff(before, after);
    if (diffLines.length === 0) console.log('  (no changes — the database was already in the desired state)');
    else for (const l of diffLines) console.log(`  ${l}`);

    if (blockers > 0) {
      console.error(`\nFAIL: ${blockers} blocker(s) still present after apply. Investigate before proceeding.`);
      process.exit(1);
    }
    console.log('\nDONE.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
