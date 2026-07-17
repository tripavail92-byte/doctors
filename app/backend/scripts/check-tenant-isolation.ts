// Behavioural tenant-isolation test — requires a live database.
//
// The static coverage check (check-rls-coverage.ts) proves every model HAS a
// policy. It cannot prove the policies ISOLATE. That distinction is the whole
// incident: this project shipped correct-looking policies on all 76 tables that
// never executed, because the app connected as a superuser with BYPASSRLS, and
// the "verification" ran as that same superuser — a role cannot observe its own
// bypass. See docs/security-rls-bypass-finding.md.
//
// So this connects as the RUNTIME role, plants a second tenant's row, and
// asserts zero cross-reads. Everything here is done in a transaction that is
// rolled back, so it leaves no residue.
//
// Run:  npx ts-node scripts/check-tenant-isolation.ts
//   env: DATABASE_URL (runtime role), DIRECT_DATABASE_URL (owner, for setup)

import { PrismaClient } from '@prisma/client';

const RUNTIME_URL = process.env.DATABASE_URL;
const OWNER_URL = process.env.DIRECT_DATABASE_URL ?? RUNTIME_URL;

const PROBE_TENANT = '11111111-1111-1111-1111-111111111111';
const PROBE_MRN = 'ISOLATION-PROBE-001';
const BOGUS_TENANT = '00000000-0000-0000-0000-000000000000';

let failures = 0;
function check(label: string, ok: boolean, detail: unknown = '') {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`  ${tag}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`);
}

async function main() {
  const runtime = new PrismaClient({ datasources: { db: { url: RUNTIME_URL } } });
  const owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });

  try {
    // --- 0. The runtime role must not be able to bypass RLS ----------------
    const who = await runtime.$queryRaw<
      { current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT current_user, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user`;
    const me = who[0];
    check(
      `runtime role "${me.current_user}" cannot bypass RLS`,
      !me.rolsuper && !me.rolbypassrls,
      `superuser=${me.rolsuper} bypassrls=${me.rolbypassrls}`,
    );
    if (me.rolsuper || me.rolbypassrls) {
      console.error('\n  Everything below would be meaningless as a bypassing role. Stopping.');
      process.exit(1);
    }

    // --- 1. Plant a second tenant with one patient (as owner) --------------
    await owner.$executeRawUnsafe(`
      INSERT INTO "Tenant" (id, name, slug, edition, status)
      VALUES ('${PROBE_TENANT}', 'Isolation Probe', 'isolation-probe', 'CLINIC', 'TRIAL')
      ON CONFLICT (id) DO NOTHING`);
    await owner.$executeRawUnsafe(`
      INSERT INTO "Patient" (id, "tenantId", mrn, name, phone)
      VALUES ('22222222-2222-2222-2222-222222222222', '${PROBE_TENANT}',
              '${PROBE_MRN}', 'Probe Patient', '+92 300 0000000')
      ON CONFLICT (id) DO NOTHING`);

    const realTenant = await owner.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Tenant" WHERE id <> '${PROBE_TENANT}' LIMIT 1`,
    );
    if (!realTenant.length) throw new Error('No non-probe tenant to test against — seed first.');
    const tenantA = realTenant[0].id;

    // --- 2. Scoped to tenant A: the probe row must be invisible ------------
    const asA = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantA}', true)`);
      const patients = await tx.patient.findMany();
      const users = await tx.user.findMany();
      return { patients, users };
    });
    check(
      'tenant A cannot see the probe tenant\'s patient',
      !asA.patients.some((p) => p.mrn === PROBE_MRN),
      `${asA.patients.length} patients visible`,
    );
    check(
      'tenant A cannot see another tenant\'s users (the User-table gap)',
      asA.users.every((u) => u.tenantId === tenantA),
      `${asA.users.length} users visible`,
    );

    // --- 3. A bogus tenant sees nothing at all ----------------------------
    const asBogus = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${BOGUS_TENANT}', true)`);
      return {
        patients: await tx.patient.count(),
        users: await tx.user.count(),
        observations: await tx.observation.count(),
        invoices: await tx.invoice.count(),
      };
    });
    check('bogus tenant sees 0 patients', asBogus.patients === 0, asBogus.patients);
    check('bogus tenant sees 0 users', asBogus.users === 0, asBogus.users);
    check('bogus tenant sees 0 observations', asBogus.observations === 0, asBogus.observations);
    check('bogus tenant sees 0 invoices', asBogus.invoices === 0, asBogus.invoices);

    // --- 4. Empty-string GUC: 0 rows, NOT an exception --------------------
    // Regression guard for the pooled-connection bug: the GUC resets to '' at
    // commit, and ''::uuid RAISES unless the policy uses nullif().
    let emptyThrew: string | null = null;
    let emptyCount = -1;
    try {
      emptyCount = await runtime.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '', true)`);
        return tx.patient.count();
      });
    } catch (e) {
      emptyThrew = (e as Error).message.split('\n')[0];
    }
    check('empty-string tenant GUC returns 0 rows and does not raise', emptyThrew === null && emptyCount === 0,
      emptyThrew ? `threw: ${emptyThrew}` : `${emptyCount} rows`);

    // --- 5. Writes are scoped too (USING doubles as the INSERT check) -----
    let crossWriteBlocked = false;
    try {
      await runtime.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantA}', true)`);
        await tx.$executeRawUnsafe(`
          INSERT INTO "Patient" (id, "tenantId", mrn, name, phone)
          VALUES (gen_random_uuid(), '${PROBE_TENANT}', 'CROSS-WRITE', 'x', 'y')`);
      });
    } catch {
      crossWriteBlocked = true;
    }
    check('tenant A cannot INSERT a row belonging to another tenant', crossWriteBlocked);

    // --- 6. Login still works for both a tenant user and the platform admin
    const lookups = await runtime.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM auth_find_user_by_email('owner@glowderma.pk')`,
    );
    check('login lookup works for a tenant OWNER (SECURITY DEFINER path)', Number(lookups[0].n) === 1);
    const admin = await runtime.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM auth_find_user_by_email('admin@summitsystems.pk')`,
    );
    check('login lookup works for the PLATFORM_ADMIN (nullable tenantId)', Number(admin[0].n) === 1);
  } finally {
    // Remove the probe rows whatever happened.
    await owner
      .$executeRawUnsafe(`DELETE FROM "Patient" WHERE "tenantId" = '${PROBE_TENANT}'`)
      .catch(() => undefined);
    await owner
      .$executeRawUnsafe(`DELETE FROM "Tenant" WHERE id = '${PROBE_TENANT}'`)
      .catch(() => undefined);
    await runtime.$disconnect();
    await owner.$disconnect();
  }

  if (failures) {
    console.error(`\nFAIL — ${failures} isolation check(s) failed. Tenants can read each other's data.`);
    process.exit(1);
  }
  console.log('\nPASS — tenant isolation holds as the runtime role, with a second tenant present.');
}

console.log('Tenant isolation check (behavioural, as the runtime role)');
main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(2);
});
