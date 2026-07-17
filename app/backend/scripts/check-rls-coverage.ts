// RLS coverage guard — runs in CI, no database required.
//
// WHY THIS EXISTS
//
// Tenant isolation in Health OS rests on Postgres RLS, not on WHERE clauses:
// services deliberately issue `tx.patient.findMany()` with no tenantId filter
// and let the tenant_isolation policy scope it. That makes prisma/rls.sql
// load-bearing security code — and it is hand-maintained, so it drifts. It has:
//
//   * missed a model entirely ("User" shipped with NO policy at all, exposing
//     every tenant's staff and passwordHash to any tenant that queried it), and
//   * lagged behind schema.prisma (the three dermatology tables were live in the
//     schema before rls.sql caught up).
//
// Neither was caught by any test, because a missing policy is invisible until a
// second tenant exists. This script makes both failure modes fail the build.
//
// Run:  npx ts-node scripts/check-rls-coverage.ts
//
// See docs/security-rls-bypass-finding.md for the incident this guards against.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma');
const RLS_FILES = [
  path.join(ROOT, 'prisma', 'rls.sql'),
  path.join(ROOT, 'prisma', 'rls-user.sql'),
];
const SRC = path.join(ROOT, 'src');

// The canonical policy shape. nullif() is not cosmetic: current_setting returns
// NULL only when the GUC was NEVER set, but after the first set_config(...,
// is_local=true) transaction it resets to the EMPTY STRING at commit — and
// ''::uuid RAISES instead of matching zero rows. nullif() makes both states
// fail closed.
const CANONICAL_QUAL =
  `"tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid`;

// Models allowed to deviate. Each MUST still carry some policy — an allowlist
// that means "no RLS" is exactly how the User gap happened, so membership here
// only waives the *shape* check, never the *existence* check.
const BESPOKE_POLICY_MODELS = new Set<string>([
  // Login runs before tenant context exists, and tenantId is nullable for
  // platform admins, so User has tenant_isolation + a SECURITY DEFINER lookup.
  'User',
]);

// Platform-level models with no tenantId column: catalog/reference data shared
// across tenants. Listed explicitly so a NEW model without tenantId is a
// conscious decision rather than an oversight.
const PLATFORM_MODELS = new Set<string>([
  'Tenant',
  'Plan',
  'Feature',
  'PlanFeature',
  'Pack',
  'PackVersion',
  'InstrumentDefinition',
]);

interface Failure {
  check: string;
  detail: string;
}
const failures: Failure[] = [];
const notes: string[] = [];

function readOrDie(p: string): string {
  if (!fs.existsSync(p)) {
    console.error(`FATAL: ${p} not found`);
    process.exit(2);
  }
  return fs.readFileSync(p, 'utf8');
}

// --- 1. Parse schema.prisma for models and their tenantId field -------------

const schema = readOrDie(SCHEMA);
const modelBlocks = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
if (modelBlocks.length === 0) {
  failures.push({ check: 'parse', detail: 'No models parsed from schema.prisma' });
}

const tenantScoped: string[] = [];
const platformFound: string[] = [];
for (const m of modelBlocks) {
  const name = m[1];
  const body = m[2];
  // A tenantId FIELD, not a relation mentioning it.
  if (/^\s*tenantId\s+String/m.test(body)) tenantScoped.push(name);
  else platformFound.push(name);
}

// --- 2. Parse the RLS SQL for policies + ENABLE/FORCE ----------------------

const sql = RLS_FILES.map(readOrDie).join('\n');

const policied = new Map<string, string[]>(); // table -> quals
for (const m of sql.matchAll(
  /CREATE\s+POLICY\s+(\w+)\s+ON\s+"(\w+)"(?:\s+FOR\s+\w+)?(?:\s+TO\s+\w+)?\s*\n?\s*USING\s*\(([\s\S]*?)\);/gi,
)) {
  const table = m[2];
  const qual = m[3].replace(/\s+/g, ' ').trim();
  policied.set(table, [...(policied.get(table) ?? []), qual]);
}
const enabled = new Set(
  [...sql.matchAll(/ALTER\s+TABLE\s+"(\w+)"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map((m) => m[1]),
);
const forced = new Set(
  [...sql.matchAll(/ALTER\s+TABLE\s+"(\w+)"\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi)].map((m) => m[1]),
);

// --- 3. Coverage: every tenant-scoped model needs ENABLE + FORCE + policy ---

for (const model of tenantScoped) {
  if (!policied.has(model)) {
    failures.push({
      check: 'missing-policy',
      detail:
        `Model "${model}" has a tenantId column but NO tenant_isolation policy in prisma/rls.sql.\n` +
        `      Services here omit tenantId from WHERE clauses and rely on RLS, so this model is\n` +
        `      readable across tenants. Add:\n` +
        `        ALTER TABLE "${model}" ENABLE ROW LEVEL SECURITY;\n` +
        `        ALTER TABLE "${model}" FORCE ROW LEVEL SECURITY;\n` +
        `        CREATE POLICY tenant_isolation ON "${model}"\n` +
        `          USING (${CANONICAL_QUAL});`,
    });
    continue;
  }
  if (!enabled.has(model)) {
    failures.push({
      check: 'missing-enable',
      detail: `Model "${model}" has a policy but no ENABLE ROW LEVEL SECURITY — the policy never runs.`,
    });
  }
  if (!forced.has(model)) {
    failures.push({
      check: 'missing-force',
      detail:
        `Model "${model}" has ENABLE but no FORCE ROW LEVEL SECURITY — the table owner would bypass it.`,
    });
  }
}

// --- 4. Policy shape -------------------------------------------------------

for (const [table, quals] of policied) {
  for (const qual of quals) {
    // The two "fixes" that silently grant cross-tenant reads.
    if (/current_setting\s*\([^)]*\)\s*IS\s+NULL/i.test(qual)) {
      failures.push({
        check: 'dangerous-qual',
        detail:
          `Policy on "${table}" tests \`current_setting(...) IS NULL\`. That grants access whenever\n` +
          `      the tenant context is unset — i.e. the whole table, to anyone, on any query issued\n` +
          `      outside forTenant(). Qual: ${qual}`,
      });
    }
    if (/current_setting\s*\([^)]*\)\s*=\s*''/.test(qual)) {
      failures.push({
        check: 'dangerous-qual',
        detail:
          `Policy on "${table}" treats an empty tenant GUC as a match. Same breach as above.\n` +
          `      Qual: ${qual}`,
      });
    }
    if (BESPOKE_POLICY_MODELS.has(table)) continue;
    if (!/nullif\s*\(\s*current_setting\s*\(\s*'app\.tenant_id'\s*,\s*true\s*\)\s*,\s*''\s*\)\s*::\s*uuid/i.test(qual)) {
      failures.push({
        check: 'non-canonical-qual',
        detail:
          `Policy on "${table}" is not in the canonical nullif() form, so it RAISES instead of\n` +
          `      returning zero rows when the GUC is the empty string (which is what it resets to\n` +
          `      after the first transaction on a pooled connection).\n` +
          `      Expected: ${CANONICAL_QUAL}\n` +
          `      Found:    ${qual}`,
      });
    }
  }
}

// --- 5. Allowlisted models must still carry a policy -----------------------

for (const model of BESPOKE_POLICY_MODELS) {
  if (!policied.has(model)) {
    failures.push({
      check: 'allowlist-without-policy',
      detail:
        `"${model}" is allowlisted for a bespoke policy shape but has NO policy at all. The\n` +
        `      allowlist waives the shape check, never the existence check.`,
    });
  }
}

// --- 6. Unrouted Prisma calls on tenant-scoped models ----------------------
//
// A query issued on the PrismaService itself never sets app.tenant_id, so it is
// now fail-closed (returns nothing) rather than leaky — but it is still a bug,
// and it is the specific shape that would turn the User model into a breach.

const tenantModelIdents = new Set(
  tenantScoped.map((m) => m.charAt(0).toLowerCase() + m.slice(1)),
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/this\.prisma\.(\w+)\.(findMany|findFirst|findUnique|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate)/);
    if (!m) return;
    const ident = m[1];
    if (!tenantModelIdents.has(ident)) return; // platform table — legitimate
    failures.push({
      check: 'unrouted-query',
      detail:
        `${path.relative(ROOT, file)}:${i + 1} calls this.prisma.${ident}.${m[2]}() directly.\n` +
        `      "${ident}" is tenant-scoped, so this runs with no app.tenant_id and RLS returns\n` +
        `      ZERO ROWS (fail-closed). Route it through prisma.forTenant()/forCurrentTenant().`,
    });
  });
}

// --- 7. Report -------------------------------------------------------------

const newPlatform = platformFound.filter((m) => !PLATFORM_MODELS.has(m));
if (newPlatform.length) {
  notes.push(
    `${newPlatform.length} model(s) have no tenantId and are treated as platform-level: ` +
      `${newPlatform.join(', ')}. If any of these should be tenant-scoped, they are currently ` +
      `readable by every tenant.`,
  );
}

console.log('RLS coverage check');
console.log(`  models:            ${modelBlocks.length}`);
console.log(`  tenant-scoped:     ${tenantScoped.length}`);
console.log(`  policies found:    ${policied.size}`);
console.log(`  bespoke allowlist: ${[...BESPOKE_POLICY_MODELS].join(', ') || '(none)'}`);
for (const n of notes) console.log(`  NOTE: ${n}`);

if (failures.length === 0) {
  console.log('\nPASS — every tenant-scoped model has an enforced, canonical policy, and every');
  console.log('       tenant-scoped query is routed through forTenant().');
  process.exit(0);
}

console.error(`\nFAIL — ${failures.length} problem(s):\n`);
for (const f of failures) console.error(`  [${f.check}] ${f.detail}\n`);
process.exit(1);
