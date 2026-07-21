/**
 * Every feature key that is SOLD must be enforced somewhere.
 *
 * WHY THIS EXISTS
 * ---------------
 * EntitlementGuard is opt-in: `if (!featureKey) return true`. A controller with
 * no @RequiresEntitlement is not "ungated by mistake" as far as the guard is
 * concerned — it is simply not participating. So a feature key can appear in the
 * edition catalog, be bundled into a paid tier, and be enforced by nothing at
 * all. Nothing errors. The route just works, for everyone.
 *
 * Six keys were in exactly that state: emr.core, billing.core, catalog.core,
 * observations.core, instruments.core and packs.core. Reproduced by disabling
 * every entitlement for the tenant and calling the routes — EMR, invoicing,
 * catalog, observations, instruments and packs all still answered 200/201, while
 * ipd/pharmacy/imaging correctly 403'd. The guard worked; the decorators were
 * missing. That is revenue given away, and on a downgrade it is a customer
 * keeping what they stopped paying for.
 *
 * This is the same shape as scripts/check-wiring.ts: a control that is opt-in
 * fails silently when someone forgets to opt in, so the build has to notice.
 *
 * Run: npx ts-node scripts/check-entitlement-coverage.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let pass = 0;
let fail = 0;
const ck = (label: string, ok: boolean, detail: unknown = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? '  -> ' + detail : ''}`);
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(SRC);

// The catalog of sellable keys.
const editions = fs.readFileSync(path.join(SRC, 'entitlements', 'editions.ts'), 'utf8');
const declared = [...new Set([...editions.matchAll(/key:\s*'([a-z0-9_.-]+)'/g)].map((m) => m[1]))];

// Comments must be stripped before scanning. The decorator's own JSDoc contains
// `@RequiresEntitlement('appointments.scheduling')` as a usage example and the
// guard's contains `('module.key')`; counting those as real enforcement made the
// first version of this check report two non-existent keys. A check that cries
// wolf gets switched off.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Enforcement has TWO paths, and a check that knew only about the first would
// wrongly flag every pack key:
//   1. @RequiresEntitlement on a controller, checked by EntitlementGuard
//   2. a pack manifest's `requiresEntitlements`, checked by packs.service via
//      hasAll() before activation
const enforced = new Set<string>();
for (const f of files) {
  const text = stripComments(fs.readFileSync(f, 'utf8'));
  for (const m of text.matchAll(/@RequiresEntitlement\(\s*'([^']+)'/g)) enforced.add(m[1]);
  for (const m of text.matchAll(/requiresEntitlements:\s*\[([^\]]*)\]/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) enforced.add(k[1]);
  }
}

console.log(`\nEntitlement coverage — ${declared.length} declared keys, ${enforced.size} enforced\n`);
ck('the edition catalog declares feature keys', declared.length > 0, `${declared.length} keys`);

// Known gaps: a key that is declared and BUNDLED INTO AN EDITION while the thing
// it gates does not exist yet. This is not the revenue leak the check is mainly
// for — nobody gets free access to a built feature — it is the opposite: a
// customer is sold something that cannot be delivered. Each entry must name why
// and what closes it, so this list stays a ledger and does not become a place to
// silence the check.
const KNOWN_UNBUILT: Record<string, string> = {
  // In ALL_PACKS (editions.ts) and therefore in every SPECIALTY edition, but
  // src/packs/manifests/ has no pediatrics manifest — it is the only one of the
  // seven pack keys without one. Tracked as "EPI + Pediatrics completion".
  // Closing it is a product decision: build the pack, or stop selling the key.
  'pack.pediatrics': 'no pediatrics manifest exists; sold in SPECIALTY editions',
};

const unenforced = declared.filter((k) => !enforced.has(k));
const leaking = unenforced.filter((k) => !(k in KNOWN_UNBUILT));
const unbuilt = unenforced.filter((k) => k in KNOWN_UNBUILT);

ck(
  'every declared feature key is enforced (no sold feature is given away)',
  leaking.length === 0,
  leaking.length === 0 ? `${declared.length - unbuilt.length}/${declared.length - unbuilt.length}` : `UNENFORCED: ${leaking.join(', ')}`,
);
for (const k of unbuilt) {
  console.log(`         NOTE  ${k} — ${KNOWN_UNBUILT[k]}`);
}
// The ledger must not outlive the gap: an entry for a key that IS now enforced,
// or is no longer declared, is stale and has to be removed.
const staleLedger = Object.keys(KNOWN_UNBUILT).filter((k) => enforced.has(k) || !declared.includes(k));
ck(
  'the known-unbuilt ledger has no stale entries',
  staleLedger.length === 0,
  staleLedger.length === 0 ? '' : `STALE: ${staleLedger.join(', ')} — now enforced or no longer sold; remove from KNOWN_UNBUILT`,
);

// The reverse direction: a decorator naming a key that no edition sells would
// lock customers out of something nobody can buy.
const unknown = [...enforced].filter((k) => !declared.includes(k));
ck(
  'every enforced key exists in the edition catalog',
  unknown.length === 0,
  unknown.length === 0 ? '' : `NOT SELLABLE: ${unknown.join(', ')}`,
);

// A controller carrying @RequiresEntitlement but not EntitlementGuard is
// decorated-but-unenforced — the decorator is inert metadata without the guard.
const decoratedWithoutGuard: string[] = [];
for (const f of files.filter((f) => f.endsWith('.controller.ts'))) {
  const text = fs.readFileSync(f, 'utf8');
  if (text.includes('@RequiresEntitlement(') && !text.includes('EntitlementGuard')) {
    decoratedWithoutGuard.push(path.relative(ROOT, f));
  }
}
ck(
  'every controller with @RequiresEntitlement also installs EntitlementGuard',
  decoratedWithoutGuard.length === 0,
  decoratedWithoutGuard.join(', '),
);

console.log(`\n===== ${pass}/${pass + fail} passed =====`);
if (pass + fail === 0) {
  console.log('  NO CHECKS RAN - the script asserted nothing');
  process.exit(1);
}
if (fail) {
  console.error(`\nFAIL — ${fail} entitlement coverage check(s) failed. A sold feature that nothing enforces is given away.`);
  process.exit(1);
}
console.log('PASS — every sellable feature key is enforced.');
process.exit(0);
