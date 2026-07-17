// Boot-guard test — asserts the app REFUSES to start when a security
// precondition is unmet.
//
// Both guards exist because the failure they prevent is silent. A weak JWT
// secret means forgeable tokens, and the tenant context that drives RLS is
// built from the JWT — so a forged token makes RLS faithfully enforce the
// ATTACKER's chosen tenant. A bypassing DB role makes RLS inert entirely.
// Neither produces an error at runtime; both just quietly work "fine".
//
// A guard that is never exercised is a guard that has already rotted, so this
// runs the real built binary and asserts it dies.
//
// Run:  npm run build && npx ts-node scripts/check-boot-guards.ts

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// The app loads .env itself; this script must too, or DIRECT_DATABASE_URL is
// absent and the bypass guard silently SKIPs — a check that skips is a check
// that is not protecting anything.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// The happy-path boot must not collide with a dev server already on :3000, or
// it fails with EADDRINUSE and looks like a broken guard.
const TEST_PORT = '31314';

const ROOT = path.join(__dirname, '..');
const MAIN = path.join(ROOT, 'dist', 'main.js');

if (!fs.existsSync(MAIN)) {
  console.error(`FATAL: ${MAIN} not found — run "npm run build" first.`);
  process.exit(2);
}

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -> ${detail}` : ''}`);
  if (!ok) failures++;
}

/**
 * Boot with the given env overrides and return what happened.
 *
 * Runs from a temp cwd so dotenv cannot silently re-supply a deleted var — the
 * .env file is found regardless of cwd via Prisma, so `delete process.env.X`
 * alone does not prove the unset path.
 */
function boot(env: Record<string, string | undefined>, timeoutMs = 20_000) {
  const clean = { ...process.env, PORT: TEST_PORT, ...env };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete (clean as Record<string, unknown>)[k];
  const r = spawnSync(process.execPath, [MAIN], {
    env: clean as NodeJS.ProcessEnv,
    cwd: ROOT,
    timeout: timeoutMs,
    encoding: 'utf8',
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { out, started: /listening on/i.test(out), code: r.status };
}

console.log('Boot guards');

// --- JWT secret ------------------------------------------------------------

for (const [label, secret, expect] of [
  ['a known placeholder secret', 'dev-secret-change-me', 'well-known placeholder'],
  ['the other known placeholder', 'change-me-in-production', 'well-known placeholder'],
  ['a too-short secret', 'tooshort', 'only 8 characters'],
] as const) {
  const r = boot({ JWT_SECRET: secret });
  check(
    `refuses to boot with ${label}`,
    !r.started && r.out.includes(expect),
    r.started ? 'IT STARTED — the guard is not firing' : `exit ${r.code}`,
  );
}

// --- Bypassing DB role -----------------------------------------------------

const ownerUrl = process.env.DIRECT_DATABASE_URL;
if (ownerUrl) {
  const r = boot({ DATABASE_URL: ownerUrl });
  check(
    'refuses to boot as the RLS-bypassing owner role',
    !r.started && /RLS preflight FAILED/i.test(r.out),
    r.started ? 'IT STARTED — tenant isolation would be inert' : `exit ${r.code}`,
  );
} else {
  console.log('  SKIP  RLS-bypass guard (DIRECT_DATABASE_URL not set)');
}

// --- The happy path must still boot ---------------------------------------
// Without this, a guard that rejects EVERYTHING would pass the checks above.

const good = boot({});
check('still boots with a correct configuration', good.started, good.started ? '' : `exit ${good.code}`);
check(
  'and logs that RLS is actually enforceable',
  /RLS enforceable/i.test(good.out),
  /RLS enforceable/i.test(good.out) ? '' : 'preflight log line missing',
);

if (failures) {
  console.error(`\nFAIL — ${failures} boot guard(s) not working.`);
  process.exit(1);
}
console.log('\nPASS — the app refuses to start on a weak secret or a bypassing DB role.');
