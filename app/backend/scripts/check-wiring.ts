// Asserts that every check actually RUNS in CI.
//
// WHY THIS EXISTS
// ---------------
// scripts/check-growth-dose.ts and scripts/check-engine.ts were correct, passing,
// and wired to nothing: no npm script, no mention in the workflow. They had been
// run by hand once when the features were built, so they were remembered as
// coverage. They had not executed since.
//
// check-growth-dose.ts covers computeDose's maxDailyMg cap. A regression there is
// a paediatric overdose, and nothing else in the tree covers it.
//
// This is the far end of the same failure as a check that cannot fail: a check
// that never runs. Both are counted as coverage and neither can go red. An audit
// that walks the check:* chain will never find it, because the gap is in the
// other direction — a FILE with no npm entry.
//
// Two invariants, because either alone leaves a hole:
//   1. every scripts/check-*.ts is referenced by some npm script
//   2. every check:* npm script is reachable from check:security or check:clinical
//      (defining a script and never chaining it is the same hole, one step later)
//
// Run: npx ts-node scripts/check-wiring.ts
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const scripts: Record<string, string> = pkg.scripts ?? {};

let pass = 0;
let fail = 0;
const ck = (label: string, ok: boolean, detail: unknown = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? '  -> ' + detail : ''}`);
};

// --- 1. no orphaned check script on disk -----------------------------------
const onDisk = fs
  .readdirSync(path.join(ROOT, 'scripts'))
  .filter((f) => f.startsWith('check-') && f.endsWith('.ts'));

// This file is the auditor; it is wired below like any other.
for (const file of onDisk) {
  const referenced = Object.values(scripts).some((cmd) => cmd.includes(file));
  ck(`scripts/${file} is referenced by an npm script`, referenced,
     referenced ? '' : 'ORPHAN — it has never run in CI');
}

// --- 2. no check:* script left out of the chains ----------------------------
// Resolve `npm run X` references transitively, so a script chained via an
// intermediate still counts as reachable.
const reachable = new Set<string>();
const walk = (name: string) => {
  if (reachable.has(name)) return;
  reachable.add(name);
  const cmd = scripts[name];
  if (!cmd) return;
  for (const m of cmd.matchAll(/npm run ([\w:-]+)/g)) walk(m[1]);
};
walk('check:security');
walk('check:clinical');

for (const name of Object.keys(scripts).filter((n) => n.startsWith('check:'))) {
  if (name === 'check:security' || name === 'check:clinical') continue;
  const ok = reachable.has(name);
  ck(`${name} is reachable from check:security or check:clinical`, ok,
     ok ? '' : 'DEFINED BUT NEVER CHAINED — it has never run in CI');
}

console.log(`\n===== ${pass}/${pass + fail} passed =====`);

if (pass + fail === 0) {
  console.log('  NO CHECKS RAN - the script reached the end without asserting anything');
  process.exit(1);
}
if (fail) console.log(`  ${fail} CHECK(S) FAILED`);
process.exit(fail ? 1 : 0);
