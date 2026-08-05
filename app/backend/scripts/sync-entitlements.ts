/**
 * Backfill missing TenantEntitlement rows against the current edition catalog.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every tenant is seeded with the entitlement keys from its edition at
 * creation time (see PlatformTenantsService.provision → seedEntitlements).
 * When EDITION_FEATURES in src/entitlements/editions.ts grows a new key —
 * `hr.core` added to CLINIC_ADDONS, a brand-new `multibranch.core` key —
 * existing tenants keep their frozen bundle and the new feature is invisible
 * to them. The UI hides the module, the guard 403s the API, and the customer
 * cannot see what they paid for.
 *
 * That is real drift. It happened at Sprint 0 (the Lahore derma clinic could
 * not see payroll despite being a multi-staff clinic) and it will happen
 * every time the catalog is extended.
 *
 * WHAT THIS DOES, AND WHAT IT DOES NOT
 * ------------------------------------
 * For each tenant, compute the expected feature set from its edition and
 * ADD any missing rows as `enabled = true`. It NEVER touches existing rows
 * (a tenant with an explicitly-disabled entitlement stays disabled — that
 * is a legitimate override) and NEVER removes rows (an edition-downgrade
 * concern that must be a deliberate act, not a side effect of a script).
 *
 * Idempotent. Dry-run by default. --apply to write.
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node scripts/sync-entitlements.ts            # dry run
 *   DATABASE_URL=... npx ts-node scripts/sync-entitlements.ts --apply
 */
import { Client } from 'pg';
import { EDITION_FEATURES } from '../src/entitlements/editions';
import type { Edition } from '@prisma/client';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const redacted = url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  console.log(`Entitlement sync`);
  console.log(`  target:  ${redacted}`);
  console.log(`  mode:    ${apply ? 'APPLY' : 'dry-run'}`);
  console.log('');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const tenants = (
      await client.query<{ id: string; slug: string; edition: Edition }>(
        `SELECT id, slug, edition FROM "Tenant" ORDER BY "createdAt"`,
      )
    ).rows;
    console.log(`Found ${tenants.length} tenant(s).`);

    let totalMissing = 0;
    let totalAdded = 0;

    for (const t of tenants) {
      const expected = new Set(EDITION_FEATURES[t.edition] ?? []);
      if (expected.size === 0) {
        console.log(`  ${t.slug} (${t.edition}): UNKNOWN edition — no bundle defined, skipping`);
        continue;
      }
      const current = new Set(
        (
          await client.query<{ featureKey: string }>(
            `SELECT "featureKey" FROM "TenantEntitlement" WHERE "tenantId" = $1`,
            [t.id],
          )
        ).rows.map((r) => r.featureKey),
      );
      const missing = [...expected].filter((k) => !current.has(k));

      if (missing.length === 0) {
        console.log(`  ${t.slug.padEnd(24)} ${String(t.edition).padEnd(14)} OK`);
        continue;
      }

      totalMissing += missing.length;
      console.log(
        `  ${t.slug.padEnd(24)} ${String(t.edition).padEnd(14)} ` +
          `missing ${missing.length}: ${missing.join(', ')}`,
      );

      if (apply) {
        // Use ON CONFLICT DO NOTHING as a belt over the "missing" list — a
        // concurrent run of the same script must not double-write.
        for (const key of missing) {
          const res = await client.query(
            `INSERT INTO "TenantEntitlement" ("id", "tenantId", "featureKey", "enabled")
             VALUES (gen_random_uuid(), $1, $2, true)
             ON CONFLICT ("tenantId", "featureKey") DO NOTHING`,
            [t.id, key],
          );
          if ((res.rowCount ?? 0) > 0) totalAdded += 1;
        }
      }
    }

    console.log('');
    if (apply) {
      console.log(`Wrote ${totalAdded} row(s).`);
      if (totalAdded !== totalMissing) {
        console.log(
          `  (${totalMissing - totalAdded} row(s) were already present via race; that is fine.)`,
        );
      }
    } else {
      if (totalMissing === 0) {
        console.log(`Every tenant matches its edition's current feature bundle.`);
      } else {
        console.log(
          `${totalMissing} missing entitlement row(s) across ${tenants.length} tenant(s). ` +
            `Re-run with --apply.`,
        );
        process.exit(2);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
