/**
 * Rebuild the database and land on a clean demo dataset.
 *
 *   npm run demo:reset -- --yes
 *
 * DESTRUCTIVE. Drops every table and recreates from schema.prisma, then reapplies
 * the RLS policies, the runtime role, the partial unique indexes, the platform
 * seed, and finally the demo data. That is the same sequence as the README and
 * as CI, so if this works the documented path works.
 *
 * WHY A REBUILD RATHER THAN A DELETE SWEEP
 * ----------------------------------------
 * The dev database had 2,026 patients, ~2,022 of them probes from safety runs,
 * spread across 86 tables with foreign keys between them. Deleting by name
 * pattern would leave orphans wherever a pattern was missed, and "wherever a
 * pattern was missed" is not knowable in advance. Everything in this database is
 * derived from code, so recreating it is both cheaper and verifiable.
 *
 * THREE GUARDS, because a drop is not undoable:
 *   1. --yes must be passed explicitly.
 *   2. the database host must be local — this must never point at a clinic.
 *   3. NODE_ENV must not be production.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();

if (!process.argv.includes('--yes')) {
  console.error(
    'demo:reset DROPS EVERY TABLE in ' + (host || '(unparseable host)') + '.\n' +
      'Re-run with --yes if that is what you want:  npm run demo:reset -- --yes',
  );
  process.exit(1);
}
if (!['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(host)) {
  console.error(`refusing: database host is ${host || '(unknown)'}, not local. This script only ever runs against a dev database.`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('refusing: NODE_ENV=production.');
  process.exit(1);
}

const run = (cmd: string, args: string[]) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
};

// The SQL files need a psql client. Prefer a real one; fall back to the dev
// container, exactly as test/safety/_db.py does — and for the same reason: this
// box may not have psql, and CI may not have the container. Whichever path is
// taken, a failure must stop the rebuild rather than leave RLS half-applied.
const SQL = ['prisma/rls.sql', 'prisma/rls-roles.sql', 'prisma/rls-user.sql', 'prisma/constraints.sql'];
const hasPsql = (() => {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['psql'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

// `migrate reset`, not `db push --force-reset`: it drops everything and replays
// the migration history, so a local rebuild exercises the same path CI and
// production take. If a migration is broken, this is where it should surface —
// on a disposable database, not on a deploy.
run('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate']);

for (const f of SQL) {
  if (hasPsql) {
    // Strip Prisma-only query params; libpq errors on them. See _db.py.
    const u = new URL(url);
    u.searchParams.delete('schema');
    run('psql', ['-v', 'ON_ERROR_STOP=1', u.toString(), '-f', f]);
  } else {
    const container = process.env.HEALTHOS_DB_CONTAINER || 'healthos-db';
    const sql = fs.readFileSync(path.join(ROOT, f), 'utf8');
    console.log(`\n$ docker exec ${container} psql -f ${f}`);
    execFileSync('docker', ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'healthos', '-d', 'healthos'], {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  }
}

run('npx', ['ts-node', 'prisma/seed.ts']);
run('npx', ['ts-node', 'prisma/demo-seed.ts']);

console.log('\nDatabase rebuilt and demo data loaded. Restart the API to pick it up.');
