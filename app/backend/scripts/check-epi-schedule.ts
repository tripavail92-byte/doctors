import { computeSchedule, scheduleSummary, ScheduleRow } from '../src/immunization/schedule.engine';
const D = (s: string) => new Date(s + 'T00:00:00Z');
const dob = D('2026-01-01');
let pass = 0, fail = 0;
const ck = (l: string, c: boolean, d: any = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${d !== '' ? '  -> ' + d : ''}`); };

console.log('\n== IPV-2 now exists (a child was never flagged for their 2nd polio dose) ==');
const all = computeSchedule(dob, D('2027-06-01'), []);
const ipv = all.filter((r: ScheduleRow) => r.vaccineCode === 'IPV');
ck('IPV has 2 doses', ipv.length === 2, ipv.map((r: ScheduleRow) => `${r.dose}@${r.ageLabel}`).join(' '));

console.log('\n== A dose given TOO SOON does not count ==');
// PENTA-1 at 6wk, then PENTA-2 only 14 days later (minimum is 28).
const tooSoon = computeSchedule(dob, D('2026-04-01'), [
  { vaccineCode: 'PENTA', dose: '1', givenAt: D('2026-02-12') },
  { vaccineCode: 'PENTA', dose: '2', givenAt: D('2026-02-26') },
]);
const p2 = tooSoon.find((r: ScheduleRow) => r.vaccineCode === 'PENTA' && r.dose === '2')!;
ck('PENTA-2 at a 14-day interval is given_invalid, not given', p2.status === 'given_invalid', `${p2.status} (${p2.intervalDays}d)`);
ck('and the reason says it must be repeated', /must be repeated/.test(p2.reason || ''), (p2.reason || '').slice(0, 72));
const sum = scheduleSummary(tooSoon);
ck('summary surfaces it in mustRepeat', sum.mustRepeat.length === 1, JSON.stringify(sum.mustRepeat[0]));

console.log('\n== An invalid dose does not anchor the NEXT interval ==');
const p3 = tooSoon.find((r: ScheduleRow) => r.vaccineCode === 'PENTA' && r.dose === '3')!;
// Presence is not validity: an invalid PENTA-2 must NOT unlock PENTA-3, or the
// child is walked through the rest of the series on top of a dose that did
// nothing — under-immunised, with a card that looks complete.
ck('PENTA-3 is BLOCKED by the invalid PENTA-2, not merely un-given', p3.status === 'blocked', `${p3.status}: ${p3.reason}`);
ck('and the reason says the prior dose must be repeated', /must be repeated/.test(p3.reason || ''), (p3.reason || '').slice(0, 70));

console.log('\n== Catch-up: a late start does not compress the series ==');
// Child starts PENTA-1 at 6 months. Every age-based date has passed.
const late = computeSchedule(dob, D('2026-07-05'), [
  { vaccineCode: 'PENTA', dose: '1', givenAt: D('2026-07-01') },
]);
const l2 = late.find((r: ScheduleRow) => r.vaccineCode === 'PENTA' && r.dose === '2')!;
ck('PENTA-2 is NOT due same-day despite its age-date passing', l2.status !== 'due' && l2.status !== 'overdue', `${l2.status} due ${l2.dueDate}`);
ck('its due date is 28 days after the dose actually given', l2.dueDate === '2026-07-29', l2.dueDate);
ck('and the reason explains the interval moved it', /interval/.test(l2.reason || ''), (l2.reason || '').slice(0, 70));

console.log('\n== Dose 3 cannot be due before dose 2 exists ==');
const skipped = computeSchedule(dob, D('2026-06-01'), [
  { vaccineCode: 'PCV', dose: '1', givenAt: D('2026-02-12') },
]);
const pcv3 = skipped.find((r: ScheduleRow) => r.vaccineCode === 'PCV' && r.dose === '3')!;
ck('PCV-3 is blocked while PCV-2 is missing', pcv3.status === 'blocked', `${pcv3.status}: ${pcv3.reason}`);

console.log('\n== Rotavirus ages out instead of nagging forever ==');
const old = computeSchedule(dob, D('2027-06-01'), []);
const rota = old.find((r: ScheduleRow) => r.vaccineCode === 'ROTA' && r.dose === '1')!;
const mr = old.find((r: ScheduleRow) => r.vaccineCode === 'MR' && r.dose === '1')!;
ck('ROTA-1 is aged_out at 17 months', rota.status === 'aged_out', `${rota.status}`);
ck('but MR-1 is still overdue (no ceiling — it must still be given)', mr.status === 'overdue', mr.status);

console.log('\n== A dose given too YOUNG does not count ==');
const young = computeSchedule(dob, D('2026-04-01'), [
  { vaccineCode: 'PENTA', dose: '1', givenAt: D('2026-01-15') },  // 14 days old
]);
const y1 = young.find((r: ScheduleRow) => r.vaccineCode === 'PENTA' && r.dose === '1')!;
ck('PENTA-1 at 14 days old is given_invalid', y1.status === 'given_invalid', (y1.reason || '').slice(0, 68));

console.log('\n== A correctly-run series is clean ==');
const good = computeSchedule(dob, D('2026-04-01'), [
  { vaccineCode: 'PENTA', dose: '1', givenAt: D('2026-02-12') },
  { vaccineCode: 'PENTA', dose: '2', givenAt: D('2026-03-12') },
]);
const g1 = good.find((r: ScheduleRow) => r.vaccineCode === 'PENTA' && r.dose === '1')!;
const g2 = good.find((r: ScheduleRow) => r.vaccineCode === 'PENTA' && r.dose === '2')!;
ck('both doses read given', g1.status === 'given' && g2.status === 'given', `${g1.status}/${g2.status} (interval ${g2.intervalDays}d)`);
ck('nothing flagged for repeat', scheduleSummary(good).mustRepeat.length === 0);

console.log(`\n===== ${pass}/${pass + fail} passed =====`);
