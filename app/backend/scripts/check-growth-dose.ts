// Unit checks for the growth (LMS) and dose engines — no DB needed.
import { lmsZScore, zToPercentile, classify } from '../src/growth/growth-engine';
import { computeDose } from '../src/dosing/dose-engine';

let pass = 0;
let total = 0;
function check(name: string, cond: boolean, got: unknown) {
  total++;
  if (cond) pass++;
  // eslint-disable-next-line no-console
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  -> ${JSON.stringify(got)}`);
}
const approx = (a: number, b: number, eps = 0.05) => Math.abs(a - b) <= eps;

// --- Growth / LMS ---
// value == median M -> z == 0
const zMed = lmsZScore(0.3487, 3.3464, 0.14602, 3.3464);
check('LMS z at median = 0', approx(zMed, 0), zMed);
check('percentile(0) = 50', approx(zToPercentile(0), 50, 0.1), zToPercentile(0));
// 2.5 kg newborn boy -> ~ -1.9 SD
const zLow = lmsZScore(0.3487, 3.3464, 0.14602, 2.5);
check('2.5kg newborn boy z ~ -1.9', approx(zLow, -1.9, 0.05), Math.round(zLow * 100) / 100);
check('percentile ~2.9 at z=-1.9', approx(zToPercentile(zLow), 2.9, 0.6), zToPercentile(zLow));
check('classify wfa -2.5 = Underweight', classify('wfa', -2.5) === 'Underweight', classify('wfa', -2.5));
check('classify lhfa -2.5 = Stunted', classify('lhfa', -2.5) === 'Stunted', classify('lhfa', -2.5));

// --- Dose ---
const d1 = computeDose({ weightKg: 12, mgPerKgPerDay: 40, dosesPerDay: 3, maxDailyMg: 1500 });
check('amox 12kg perDay=480', d1.perDayMg === 480, d1.perDayMg);
check('amox 12kg perDose=160', d1.perDoseMg === 160, d1.perDoseMg);
check('amox 12kg not capped', !d1.cappedDaily && !d1.cappedSingle, d1.notes);

const d2 = computeDose({ weightKg: 50, mgPerKgPerDay: 40, dosesPerDay: 3, maxDailyMg: 1500 });
check('amox 50kg daily capped to 1500', d2.perDayMg === 1500 && d2.cappedDaily, d2.perDayMg);

const d3 = computeDose({ weightKg: 10, mgPerKgPerDay: 60, dosesPerDay: 4, maxSingleMg: 1000 });
check('paracetamol 10kg perDose=150', d3.perDoseMg === 150, d3.perDoseMg);

// eslint-disable-next-line no-console
console.log(`\n${pass}/${total} passed`);
process.exit(pass === total ? 0 : 1);
