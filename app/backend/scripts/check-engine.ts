// Standalone sanity check for the scoring engine (no DB needed).
import { scoreInstrument } from '../src/instruments/instrument.engine';
import { BUILTIN_INSTRUMENTS } from '../src/instruments/builtin-instruments';

const byKey = (k: string) => {
  const d = BUILTIN_INSTRUMENTS.find((i) => i.key === k);
  if (!d) throw new Error(`missing ${k}`);
  return d;
};

const cases: { key: string; answers: Record<string, number>; score: number; band: string }[] = [
  // GAGS weighted: 3*2 + 2*2 + 2*2 + 1*1 + 0 + 1*3 = 18 -> Mild
  { key: 'gags', answers: { forehead: 3, right_cheek: 2, left_cheek: 2, nose: 1, chin: 0, chest_back: 1 }, score: 18, band: 'Mild' },
  // GAGS heavy: 4*2 + 4*2 + 4*2 ... push into Very severe
  { key: 'gags', answers: { forehead: 4, right_cheek: 4, left_cheek: 4, nose: 4, chin: 4, chest_back: 4 }, score: 44, band: 'Very severe' },
  // PHQ-9 sum: nine 2s = 18 -> Moderately severe
  { key: 'phq9', answers: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`q${i + 1}`, 2])), score: 18, band: 'Moderately severe' },
  // GAD-7 sum: seven 1s = 7 -> Mild
  { key: 'gad7', answers: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`q${i + 1}`, 1])), score: 7, band: 'Mild' },
  // Oswestry percent: ten 2s / 50 * 100 = 40 -> Moderate disability
  { key: 'oswestry', answers: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s${i + 1}`, 2])), score: 40, band: 'Moderate disability' },
];

let ok = 0;
for (const c of cases) {
  const r = scoreInstrument(byKey(c.key), c.answers);
  const pass = r.score === c.score && r.band === c.band;
  ok += pass ? 1 : 0;
  // eslint-disable-next-line no-console
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.key.padEnd(9)} score=${r.score} (exp ${c.score})  band="${r.band}" (exp "${c.band}")  max=${r.maxScore}`);
}
// eslint-disable-next-line no-console
console.log(`\n${ok}/${cases.length} passed`);
process.exit(ok === cases.length ? 0 : 1);
