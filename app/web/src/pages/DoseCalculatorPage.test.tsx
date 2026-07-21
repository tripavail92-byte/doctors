// Paediatric dosing, driven the way a prescriber drives it.
//
// The defect this file is anchored to: the commit had NO catch. A refused
// commit left the screen exactly as it was — the calculated dose still on
// display, no error, no confirmation — so the only way to learn that a
// paediatric dose had NOT been entered in the medico-legal log was to go and
// look somewhere else. Nobody looks somewhere else.
//
// The other two things asserted here are the ones that make a number on this
// screen mean something: a figure computed from an old weight must not survive
// the weight being corrected (nor may the clinician's confirmation of that old
// weight), and a dose the engine blocked must not be committable at all.
//
// Every clinical number below comes from the seeded rule the backend actually
// ships (app/backend/src/dosing/dose-rule.seed.ts): paracetamol 60 mg/kg/day
// divided into 4 doses, syrup at 24 mg/mL or 50 mg/mL, not valid below 3
// months. Nothing here is invented.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DoseCalculatorPage from './DoseCalculatorPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const PARACETAMOL = {
  key: 'paracetamol',
  name: 'Paracetamol',
  mgPerKgPerDay: 60,
  dosesPerDay: 4,
  maxSingleMg: 1000,
  maxDailyMg: 4000,
  form: 'syrup 120 mg/5 mL',
  concentrations: [
    { label: '120 mg/5 mL', mgPerMl: 24 },
    { label: '250 mg/5 mL', mgPerMl: 50 },
  ],
  roundingStepMl: 0.5,
  minAgeMonths: 3,
  cautions: ['Hepatic impairment: reduce dose'],
};

const RULES = [PARACETAMOL];

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111', gender: 'female', dob: '2024-01-01' },
];

/**
 * Stand in for the server-authoritative engine.
 *
 * Deliberately only the parts the page reacts to: mg from weight, mL from the
 * chosen concentration, and the age gate. Caps and rounding are not modelled —
 * no test weight here approaches 4000 mg/day — because the page computes
 * nothing itself; it displays what the server returned, and that is the thing
 * under test.
 */
function engine(body: unknown) {
  const b = body as { weightKg: number; ageMonths?: number; concentrationMgPerMl?: number };
  const perDayMg = b.weightKg * PARACETAMOL.mgPerKgPerDay;
  const perDoseMg = perDayMg / PARACETAMOL.dosesPerDay;
  const mgPerMl = b.concentrationMgPerMl;
  const blocked = b.ageMonths != null && b.ageMonths < PARACETAMOL.minAgeMonths;
  return {
    status: 200,
    body: {
      drug: PARACETAMOL.name,
      form: PARACETAMOL.form,
      highRisk: false,
      weightKg: b.weightKg,
      mgPerKgPerDay: PARACETAMOL.mgPerKgPerDay,
      dosesPerDay: PARACETAMOL.dosesPerDay,
      perDayMg,
      perDoseMg,
      cappedDaily: false,
      cappedSingle: false,
      volumePerDoseMl: mgPerMl ? Math.round((perDoseMg / mgPerMl) * 100) / 100 : null,
      volumePerDayMl: mgPerMl ? Math.round((perDayMg / mgPerMl) * 100) / 100 : null,
      rounded: false,
      blocked,
      blockReason: blocked
        ? `Rule not valid below ${PARACETAMOL.minAgeMonths} months (age ${b.ageMonths} mo)`
        : null,
      notes: PARACETAMOL.cautions,
    },
  };
}

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /dose/rules': { body: RULES },
    'GET /patients': { body: PATIENTS },
    'POST /dose/calculate': engine,
    ...extra,
  } as never;
}

/**
 * Pick an option from a MUI Select — by ROLE, not by label. MUI ties the
 * <InputLabel> to the hidden native input, so getByLabelText walks straight
 * past the combobox that opens the menu, and the menu itself is portalled to
 * document.body so it has to be looked up from `screen`.
 */
async function pickFromSelect(name: RegExp, optionText: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(optionText));
}

/** Render, and wait until the rules have loaded and defaulted the drug. */
async function openCalculator() {
  renderPage(<DoseCalculatorPage />);
  await waitFor(
    () => expect(screen.getByRole('combobox', { name: /Drug/ })).toHaveTextContent('Paracetamol'),
    { timeout: 4000 },
  );
}

/** A number input is a spinbutton, not a textbox. */
function weightField() {
  return screen.getByRole('spinbutton', { name: /Weight/ });
}

async function enterWeight(kg: string) {
  const user = userEvent.setup();
  const field = weightField();
  await user.clear(field);
  await user.type(field, kg);
  // 60 mg/kg/day ÷ 4 doses. Generous timeouts throughout: several suites run
  // against this checkout at once and a loaded machine misses the 1 s default.
  await screen.findByText(`${Number(kg) * 15} mg`, undefined, { timeout: 4000 });
}

async function confirmWeightAndPatient() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('checkbox', { name: /confirm the measured weight/i }));
  await pickFromSelect(/Patient/, /Ayesha Khan/);
}

const addToPrescription = () => screen.getByRole('button', { name: /Add to prescription/i });

describe('a dose that was not recorded says so on the screen that ordered it', () => {
  it('shows the server’s refusal as NOT recorded, and does not look like a success', async () => {
    const user = userEvent.setup();
    // The real refusal from DosingService.commit when the patient row is gone
    // (merged, or deleted between selecting and committing).
    const refusal = 'Patient p-1 not found';
    mockApi(stubs({ 'POST /dose/commit': { status: 404, body: nestError(404, refusal) } }));
    await openCalculator();
    await enterWeight('14');
    await confirmWeightAndPatient();
    await user.click(addToPrescription());

    // Without this the parent leaves with a syrup nobody wrote down, and the
    // next prescriber sees no paracetamol in the log and doses again.
    expect(await screen.findByText(/NOT recorded/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(refusal, 'i'))).toBeInTheDocument();
    expect(screen.queryByText(/^Recorded/)).toBeNull();
  }, 20000);

  it('says the server was never reached, rather than inventing a reason', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /dose/commit': { networkError: true } }));
    await openCalculator();
    await enterWeight('14');
    await confirmWeightAndPatient();
    await user.click(addToPrescription());

    // An unreachable API is the worst version of the original bug: nothing at
    // all arrived, and the old screen was indistinguishable from a success.
    // "Cannot reach the server" tells the clinician to write it on paper
    // instead of clicking again.
    expect(await screen.findByText(/NOT recorded — Cannot reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Recorded/)).toBeNull();
  }, 20000);

  it('confirms a successful commit with the log id, and posts what was on screen', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /dose/commit': {
        status: 201,
        body: { log: { id: 'dcl-1234-abcd-efgh', volumeMl: 8.75 } },
      },
    }));
    await openCalculator();
    await enterWeight('14');
    await confirmWeightAndPatient();
    await user.click(addToPrescription());

    // The id is what makes the entry findable afterwards; "done" would not be.
    expect(await screen.findByText(/log dcl-1234/)).toBeInTheDocument();
    const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/dose/commit');
    expect(post!.body).toMatchObject({ patientId: 'p-1', drug: 'paracetamol', weightKg: 14 });
  }, 20000);
});

describe('correcting the weight invalidates everything computed from the old one', () => {
  it('withdraws the success chip and demands the new weight be confirmed again', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /dose/commit': { status: 201, body: { log: { id: 'dcl-1234-abcd', volumeMl: 8.75 } } },
    }));
    await openCalculator();
    await enterWeight('14');
    await confirmWeightAndPatient();
    await user.click(addToPrescription());
    await screen.findByText(/log dcl-1234/);

    await enterWeight('28');

    // A "Recorded" chip sitting next to a freshly recalculated 28 kg dose
    // reads as "this dose is in the log". It is not — the log holds 14 kg.
    await waitFor(() => expect(screen.queryByText(/log dcl-1234/)).toBeNull());
    // And the tick that said "I confirm the measured weight" confirmed the
    // OLD weight. Carrying it over is how a mistyped weight gets prescribed
    // without anyone re-reading the scale.
    expect(addToPrescription()).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /confirm the measured weight/i })).not.toBeChecked();
  }, 20000);

  it('never shows a dose belonging to a weight that is no longer in the box', async () => {
    const user = userEvent.setup();
    mockApi(stubs());
    await openCalculator();
    await enterWeight('14');
    expect(screen.getByText('210 mg')).toBeInTheDocument();
    expect(screen.getByText('8.75 mL')).toBeInTheDocument();
    const calcsAfter14 = apiCalls.filter((c) => c.url === '/dose/calculate').length;

    // Emptying the box is the moment the figures lose the weight they were
    // computed from, and it is a state a prescriber passes through every time
    // they correct a weight. The dose must not outlive its input: "Per dose
    // 210 mg · 8.75 mL" sitting under a blank Weight field is a number that
    // can be read off, written on a chart and given, with nothing on screen
    // left to say which child's weight produced it.
    await user.clear(weightField());
    expect(weightField()).toHaveValue(null);
    await waitFor(() => expect(screen.queryByText('210 mg')).toBeNull(), { timeout: 4000 });
    expect(screen.queryByText('8.75 mL')).toBeNull();
    expect(screen.queryByText('Per dose')).toBeNull();
    expect(screen.queryByText('Volume / dose')).toBeNull();
    expect(screen.queryByText('840 mg')).toBeNull(); // the per-DAY figure goes too
    // What is left is the prompt for an input, not a leftover result.
    expect(screen.getByText(/Select a drug and enter a weight/i)).toBeInTheDocument();
    // And there is nothing to commit: a weightless dose must not be one click
    // from the medico-legal log.
    expect(screen.queryByRole('button', { name: /Add to prescription/i })).toBeNull();
    // A blank weight is refused here, not sent to the engine as NaN.
    expect(apiCalls.filter((c) => c.url === '/dose/calculate')).toHaveLength(calcsAfter14);

    await user.type(weightField(), '28');

    // 210 mg under a weight of 28 kg is half the dose — the exact stale-data
    // failure this app has already had once, on this page.
    expect(await screen.findByText('420 mg', undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('210 mg')).toBeNull();
    const calcs = apiCalls.filter((c) => c.url === '/dose/calculate');
    const last = calcs[calcs.length - 1];
    expect((last.body as { weightKg: number }).weightKg).toBe(28);
  }, 20000);

  // NOT COVERED, because it is currently broken: this only holds while the
  // recalculation SUCCEEDS. If the new weight's /dose/calculate fails, the page
  // shows the error but leaves the previous weight's figures on display — see
  // the defect reported alongside this file. No test here asserts the wrong
  // behaviour; when it is fixed, the case belongs in this describe.
});

describe('a dose the engine blocked cannot be committed', () => {
  it('refuses the commit even with the weight confirmed and a patient named', async () => {
    const user = userEvent.setup();
    // No commit stub: reaching the server at all would fail the test, which is
    // the point — a blocked dose must never leave the browser.
    mockApi(stubs());
    await openCalculator();
    await enterWeight('14');
    await user.type(screen.getByRole('spinbutton', { name: /Age/ }), '2');

    // Paracetamol's rule is not valid below 3 months; the reason must be on
    // screen, not just an inert disabled button.
    expect(await screen.findByText(/Rule not valid below 3 months \(age 2 mo\)/)).toBeInTheDocument();
    // And the figures must be gone. A blocked calculation that still shows
    // "Per dose 210 mg" invites someone to give 210 mg to a 2-month-old.
    expect(screen.queryByText('210 mg')).toBeNull();
    expect(screen.queryByText('Per dose')).toBeNull();

    await confirmWeightAndPatient();
    expect(addToPrescription()).toBeDisabled();
  }, 20000);
});

describe('what the log will contain has to be complete before it can be written', () => {
  it('will not record a dose against nobody', async () => {
    const user = userEvent.setup();
    mockApi(stubs());
    await openCalculator();
    await enterWeight('14');
    await user.click(screen.getByRole('checkbox', { name: /confirm the measured weight/i }));

    // A dose calculation log with no patient is not a medico-legal record of
    // anything, and a recall could not find the child it was given to.
    expect(addToPrescription()).toBeDisabled();
    await pickFromSelect(/Patient/, /Ayesha Khan/);
    await waitFor(() => expect(addToPrescription()).toBeEnabled());
  }, 20000);

  it('will not record a dose whose weight nobody confirmed', async () => {
    mockApi(stubs());
    await openCalculator();
    await enterWeight('14');
    await pickFromSelect(/Patient/, /Ayesha Khan/);

    // Weight is the only input to the whole calculation. An unconfirmed one is
    // a guess, and the page has to say why the button is dead rather than look
    // broken.
    expect(addToPrescription()).toBeDisabled();
    expect(screen.getByText(/Confirm the weight to enable/i)).toBeInTheDocument();
  }, 20000);

  it('records the concentration the volume on screen was computed from', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /dose/commit': { status: 201, body: { log: { id: 'dcl-9999-zzzz', volumeMl: 4.2 } } },
    }));
    await openCalculator();
    await enterWeight('14');
    // 210 mg out of the 24 mg/mL bottle is 8.75 mL; out of the 50 mg/mL bottle
    // it is 4.2 mL. Same dose, different spoonful.
    expect(await screen.findByText('8.75 mL')).toBeInTheDocument();
    await pickFromSelect(/Concentration/, /250 mg\/5 mL/);
    expect(await screen.findByText('4.2 mL')).toBeInTheDocument();

    await confirmWeightAndPatient();
    await user.click(addToPrescription());
    await screen.findByText(/log dcl-9999/);

    const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/dose/commit');
    // The server recomputes the volume from what it is sent. If the strength
    // is dropped on the way, the log and the prescription say 8.75 mL of a
    // bottle the parent was handed 4.2 mL of.
    expect((post!.body as { concentrationMgPerMl?: number }).concentrationMgPerMl).toBe(50);
  }, 20000);
});
