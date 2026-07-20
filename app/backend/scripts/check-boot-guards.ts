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

  // A spawnSync timeout KILLS the child, so status is null and stdout is empty.
  // The guard assertions read the refusal message out of stdout, so a machine
  // slow enough to blow the budget reports "the guard is broken" — observed
  // locally as three simultaneous `exit null` failures under load, passing
  // cleanly on re-run. Fails closed, which is the right direction, but a guard
  // that cries wolf gets ignored, and on a shared CI runner load is normal.
  //
  // So: a timeout is treated as "no answer", not as "wrong answer", and retried
  // once with a larger budget. If it times out twice that is reported as its own
  // distinct outcome rather than being silently blamed on the app.
  const attempt = (ms: number) => {
    const r = spawnSync(process.execPath, [MAIN], {
      env: clean as NodeJS.ProcessEnv,
      cwd: ROOT,
      timeout: ms,
      encoding: 'utf8',
    });
    return { r, timedOut: r.error !== undefined && /ETIMEDOUT/i.test(String(r.error)) || (r.status === null && r.signal !== null) };
  };

  let { r, timedOut } = attempt(timeoutMs);
  if (timedOut) {
    ({ r, timedOut } = attempt(timeoutMs * 3));
  }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { out, started: /listening on/i.test(out), code: r.status, timedOut };
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
    r.started
      ? 'IT STARTED — the guard is not firing'
      : r.timedOut
        ? 'NO ANSWER — timed out twice; this is a slow machine, not a verdict'
        : `exit ${r.code}`,
  );
}

// --- Bypassing DB role -----------------------------------------------------

const ownerUrl = process.env.DIRECT_DATABASE_URL;
if (ownerUrl) {
  const r = boot({ DATABASE_URL: ownerUrl });
  check(
    'refuses to boot as the RLS-bypassing owner role',
    !r.started && /RLS preflight FAILED/i.test(r.out),
    r.started
      ? 'IT STARTED — tenant isolation would be inert'
      : r.timedOut
        ? 'NO ANSWER — timed out twice; this is a slow machine, not a verdict'
        : `exit ${r.code}`,
  );
} else {
  console.log('  SKIP  RLS-bypass guard (DIRECT_DATABASE_URL not set)');
}

// --- Non-UTC database session ----------------------------------------------
//
// Prisma reads/writes `timestamp(3) WITHOUT TIME ZONE` as UTC; raw SQL now()
// uses the session zone. Demonstrated on this database: the same statement wrote
// 14:27 under UTC and 19:27 under Asia/Karachi. The phototherapy engine bands
// dose reductions by whole days between treatments, so a five-hour shift across
// a day boundary picks a different dose — and every number in the ledger would
// still look right.
//
// This ships to Pakistan, where setting the database to Asia/Karachi is the
// obvious thing for an operator to do. So it is exercised here, against a real
// database, rather than trusted to a code comment.
// Driven through the database connection, NOT `docker exec`. The first version
// shelled into a hardcoded `healthos-db` container and printed
//   SKIP  non-UTC guard (could not reach the db container ...)
// whenever that container was absent — which is exactly the situation in CI,
// where Postgres is a service container with no such name. So the guard passed
// locally, skipped in CI, and CI went green having verified nothing. That is the
// same defect this repo has now hit several times, written by me hours after
// putting "a check that skips is a check that is not protecting anything" in the
// workflow comments.
//
// There is also no SKIP branch any more. If the timezone cannot be flipped, the
// guard cannot be exercised, and an unexercisable guard is a FAILURE to report —
// not a line of output to scroll past.
if (ownerUrl) {
  const { PrismaClient } = require('@prisma/client');
  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
  const dbName = (() => {
    try {
      return new URL(ownerUrl).pathname.replace(/^\//, '') || 'healthos';
    } catch {
      return 'healthos';
    }
  })();

  const setTz = async (sql: string) => owner.$executeRawUnsafe(sql);

  (async () => {
    let flipped = false;
    try {
      // ALTER DATABASE affects NEW sessions, which is precisely what the spawned
      // app process opens.
      await setTz(`ALTER DATABASE "${dbName}" SET timezone TO 'Asia/Karachi'`);
      flipped = true;
      const r = boot({});
      check(
        'refuses to boot against a non-UTC database session',
        !r.started && /UTC preflight FAILED/i.test(r.out),
        r.started
          ? 'IT STARTED — raw now() and Prisma would disagree by the server offset'
          : r.timedOut
            ? 'NO ANSWER — timed out twice; this is a slow machine, not a verdict'
            : `exit ${r.code}`,
      );
    } catch (e) {
      check('refuses to boot against a non-UTC database session', false,
            `could not exercise the guard: ${(e as Error).message.slice(0, 120)}`);
    } finally {
      // Always restore, even on failure — leaving the database on Asia/Karachi
      // would break every subsequent boot on this machine.
      if (flipped) await setTz(`ALTER DATABASE "${dbName}" RESET timezone`).catch(() => undefined);
      await owner.$disconnect().catch(() => undefined);
      finish();
    }
  })();
} else {
  check('refuses to boot against a non-UTC database session', false,
        'DIRECT_DATABASE_URL not set — the guard could not be exercised');
  finish();
}

// --- The happy path must still boot ---------------------------------------
// Without this, a guard that rejects EVERYTHING would pass the checks above.
//
// Runs from finish() rather than at the top level, because the non-UTC guard
// above is async: at the top level these would execute — and the process would
// exit — while the database was still flipped to Asia/Karachi, so the happy path
// would boot against a non-UTC session and fail for the wrong reason.
function finish(): void {
  const good = boot({});
  check('still boots with a correct configuration', good.started, good.started ? '' : `exit ${good.code}`);
  check(
    'and logs that RLS is actually enforceable',
    /RLS enforceable/i.test(good.out),
    /RLS enforceable/i.test(good.out) ? '' : 'preflight log line missing',
  );
  check(
    'and logs that timestamps are consistent',
    /Timestamps consistent/i.test(good.out),
    /Timestamps consistent/i.test(good.out) ? '' : 'UTC preflight log line missing',
  );

  if (failures) {
    console.error(`\nFAIL — ${failures} boot guard(s) not working.`);
    process.exit(1);
  }
  console.log('\nPASS — the app refuses to start on a weak secret, a bypassing DB role, or a non-UTC database.');
  process.exit(0);
}
