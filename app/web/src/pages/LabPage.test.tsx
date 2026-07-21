// The lab bench, driven the way a technologist drives it.
//
// Two things are being defended here.
//
// The first is the numeric-result guard. A mistyped haemoglobin — "7,5" with a
// decimal comma, or "9.5 g/dL" with the unit typed in — used to be downgraded to
// a TEXT result. Text results carry no number, so flagResult() short-circuits and
// the reference range is never applied: a haemoglobin of 7.5 against a 12–16
// range sat in the column with a calm neutral chip and the order could still be
// reported. The entry has to be REFUSED, not reclassified.
//
// The second is that the flag the server computed is the flag on the screen. The
// range-flag exists for exactly one reason — so an abnormal number is not read as
// just another number in a column — and a page that drops it, or paints every
// result the same, has removed the only thing that makes the result safe to skim.
import { describe, expect, it, vi } from 'vitest';
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LabPage from './LabPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

// Every keystroke in the result column re-renders the whole order table, and a
// MUI Select opens through a portal with a transition. On a loaded machine the
// heavier tests here run past the 5s default and fail for a reason that has
// nothing to do with the page. Raised file-locally rather than in the shared
// vitest config. Testing Library's own findBy/waitFor budget is a separate
// 1000ms and does not move with it — under load a click→state→re-render round
// trip has overrun that here, which reds a test for machine reasons rather than
// page reasons. Both are raised; neither hides a real failure, they only stop a
// slow one being reported as a wrong one.
vi.setConfig({ testTimeout: 20000 });
configure({ asyncUtilTimeout: 5000 });

const PATIENTS = [
  { id: 'p-1', name: 'Ayesha Khan', mrn: 'P-00001' },
  { id: 'p-2', name: 'Bilal Ahmed', mrn: 'P-00002' },
];

// Straight from the backend catalog (app/backend/src/lab/lab-catalog.ts). The
// ranges are the server's; nothing clinical is invented in this file.
const TESTS = [
  { code: 'HB', name: 'Hemoglobin', department: 'Hematology', unit: 'g/dL', refLow: 12, refHigh: 16, pricePkr: 400, valueType: 'numeric' },
  { code: 'GLU_F', name: 'Fasting glucose', department: 'Chemistry', unit: 'mg/dL', refLow: 70, refHigh: 100, pricePkr: 300, valueType: 'numeric' },
  { code: 'URINE_CS', name: 'Urine culture & sensitivity', department: 'Microbiology', unit: '', pricePkr: 900, valueType: 'text' },
];

const HB_ITEM = { id: 'i-1', testCode: 'HB', testName: 'Hemoglobin', pricePkr: 400 };
const CULTURE_ITEM = { id: 'i-2', testCode: 'URINE_CS', testName: 'Urine culture & sensitivity', pricePkr: 900 };

type OrderStub = Record<string, unknown>;

function order(over: OrderStub = {}): OrderStub {
  return {
    id: 'o-1',
    orderNumber: 'LAB-2026-0001',
    accessionNumber: null,
    status: 'ORDERED',
    orderedAt: '2026-07-20T09:00:00.000Z',
    items: [HB_ITEM],
    results: [],
    ...over,
  };
}

// A haemoglobin of 7.5 g/dL, flagged `low` by the server against its own 12–16.
const LOW_HB = {
  id: 'r-1', testCode: 'HB', value: 7.5, valueText: null,
  unit: 'g/dL', refLow: 12, refHigh: 16, flag: 'low',
};

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /lab/tests': { body: TESTS },
    'GET /lab/patients/p-1/orders': { body: [order()] },
    ...extra,
  } as never;
}

/** Open the order in the left-hand list and wait for its detail card. */
async function openOrder(orderNumber = 'LAB-2026-0001') {
  const user = userEvent.setup();
  await user.click(await screen.findByText(orderNumber));
  // The detail card repeats the order number as its heading.
  await screen.findByRole('heading', { name: orderNumber });
}

/** The detail-table row for one ordered test. */
function testRow(name: RegExp) {
  return screen.getByRole('row', { name });
}

/**
 * Pick from a MUI Select by ROLE. getByLabelText walks past it — MUI ties the
 * <InputLabel> to the hidden native input — and the menu is portalled to
 * document.body, so the listbox is looked up from `screen`.
 */
async function pickFromSelect(name: RegExp, optionText: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(optionText));
}

describe('a numeric result is refused, never downgraded to text', () => {
  it('does not save "7,5" as a haemoglobin, and leaves it on screen to be corrected', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [order({ status: 'COLLECTED', accessionNumber: 'A-0001' })] },
      'GET /lab/orders/o-1': { body: order({ status: 'COLLECTED', accessionNumber: 'A-0001' }) },
      'POST /lab/orders/o-1/results': { status: 201, body: {} },
    }));
    renderPage(<LabPage />);
    await openOrder();

    const row = testRow(/Hemoglobin/);
    const input = within(row).getByRole('textbox');
    await user.type(input, '7,5');
    await user.click(within(row).getByRole('button', { name: 'Save' }));

    // The user is told something happened rather than left staring at a row
    // that quietly did nothing.
    //
    // The WORDING is deliberately not asserted. The page composes a specific
    // sentence for this case ("enter the number only — no units, and use a
    // decimal point (7.5, not 7,5). Nothing was saved.") but `call` only ever
    // reads `e.response.data.message`, which a locally thrown Error does not
    // have, so the banner actually reads "Request failed". Reported separately;
    // pinning the current text here would freeze the wrong behaviour in.
    await screen.findByRole('alert');

    // The whole defect: this used to POST {valueText: "7,5"}. A text result has
    // no number, so the 12–16 range is never applied and a haemoglobin that
    // needs a transfusion decision renders as an uncoloured string.
    expect(apiCalls.filter((c) => c.url === '/lab/orders/o-1/results')).toHaveLength(0);
    // And the typed value survives, so the correction is a keystroke rather
    // than a re-read of the analyser printout.
    expect(input).toHaveValue('7,5');
  });

  it('does not save a number with its unit typed alongside it', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [order({ status: 'COLLECTED' })] },
      'GET /lab/orders/o-1': { body: order({ status: 'COLLECTED' }) },
      'POST /lab/orders/o-1/results': { status: 201, body: {} },
    }));
    renderPage(<LabPage />);
    await openOrder();

    const row = testRow(/Hemoglobin/);
    await user.type(within(row).getByRole('textbox'), '9.5 g/dL');
    await user.click(within(row).getByRole('button', { name: 'Save' }));

    await screen.findByRole('alert');
    // "9.5 g/dL" is not a number to Number(). Stored as text it reads correctly
    // to a human and is invisible to the range check — the worst combination.
    expect(apiCalls.filter((c) => c.url === '/lab/orders/o-1/results')).toHaveLength(0);
  });

  it('sends a clean value as a number, with no text field to fall back on', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [order({ status: 'COLLECTED' })] },
      'GET /lab/orders/o-1': { body: order({ status: 'COLLECTED' }) },
      'POST /lab/orders/o-1/results': { status: 201, body: {} },
    }));
    renderPage(<LabPage />);
    await openOrder();

    const row = testRow(/Hemoglobin/);
    await user.type(within(row).getByRole('textbox'), '7.5');
    await user.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.url === '/lab/orders/o-1/results');
      expect(post).toBeTruthy();
      const body = post!.body as { value?: unknown; valueText?: unknown; testCode?: string };
      expect(body.testCode).toBe('HB');
      // A number, not the string "7.5". The server flags with `value < refLow`;
      // a string that arrives through a looser DTO compares by coercion and the
      // flag stops being trustworthy.
      expect(typeof body.value).toBe('number');
      expect(body.value).toBe(7.5);
      expect(body).not.toHaveProperty('valueText');
    });
  });

  it('still takes free text for a test that has no number to give', async () => {
    const user = userEvent.setup();
    const collected = order({ status: 'COLLECTED', items: [CULTURE_ITEM] });
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [collected] },
      'GET /lab/orders/o-1': { body: collected },
      'POST /lab/orders/o-1/results': { status: 201, body: {} },
    }));
    renderPage(<LabPage />);
    await openOrder();

    const row = testRow(/Urine culture/);
    await user.type(within(row).getByRole('textbox'), 'E. coli, sensitive to nitrofurantoin');
    await user.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.url === '/lab/orders/o-1/results');
      expect(post).toBeTruthy();
      const body = post!.body as { value?: unknown; valueText?: unknown };
      // Refusing everything unparseable would make a culture unreportable. The
      // guard is about NUMERIC tests only.
      expect(body.valueText).toBe('E. coli, sensitive to nitrofurantoin');
      expect(body).not.toHaveProperty('value');
    });
  });
});

describe('the flag the server sent is the flag on the screen', () => {
  it('shows an out-of-range haemoglobin as LOW beside its number', async () => {
    const resulted = order({ status: 'RESULTED', accessionNumber: 'A-0001', results: [LOW_HB] });
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [resulted] },
      'GET /lab/orders/o-1': { body: resulted },
    }));
    renderPage(<LabPage />);
    await openOrder();

    const row = testRow(/Hemoglobin/);
    expect(within(row).getByText(/7\.5 g\/dL/)).toBeInTheDocument();
    // 7.5 against 12–16 is not a normal result. If the row paints every result
    // the same, the number has to be read and compared by eye on every line,
    // which is the failure the flag exists to prevent.
    expect(within(row).getByText('LOW')).toBeInTheDocument();
    expect(within(row).queryByText('normal')).toBeNull();
  });

  it('displays a flag it has no styling for rather than blanking the cell', async () => {
    // The server owns the flag vocabulary. If it ever grows one — 'critical',
    // say — an unrecognised value must still reach the technologist. A page
    // that renders only the flags it was written against turns the strongest
    // signal the system can send into an empty cell.
    const critical = { ...LOW_HB, value: 3.1, flag: 'critical' };
    const resulted = order({ status: 'RESULTED', results: [critical] });
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [resulted] },
      'GET /lab/orders/o-1': { body: resulted },
    }));
    renderPage(<LabPage />);
    await openOrder();

    expect(within(testRow(/Hemoglobin/)).getByText('critical')).toBeInTheDocument();
  });
});

describe('order → collect → result → report, one step at a time', () => {
  it('offers only collection on an ORDERED order, and opens result entry once collected', async () => {
    const user = userEvent.setup();
    let current = order({ status: 'ORDERED' });
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': () => ({ body: [current] }),
      'GET /lab/orders/o-1': () => ({ body: current }),
      'PATCH /lab/orders/o-1/collect': () => {
        current = order({ status: 'COLLECTED', accessionNumber: 'A-0001' });
        return { body: current };
      },
    }));
    renderPage(<LabPage />);
    await openOrder();

    // No specimen in the lab yet. A result typed against an uncollected order is
    // a result with no specimen behind it; the server refuses it, and offering
    // the box invites the attempt.
    expect(within(testRow(/Hemoglobin/)).queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Collect specimen' }));

    await waitFor(() =>
      expect(apiCalls.some((c) => c.method === 'PATCH' && c.url === '/lab/orders/o-1/collect')).toBe(true),
    );
    // The accession number is the specimen's identity in the lab; it appears
    // only once the specimen physically exists.
    expect(await screen.findByText(/accession A-0001/)).toBeInTheDocument();
    await waitFor(() => expect(within(testRow(/Hemoglobin/)).getByRole('textbox')).toBeInTheDocument());
  });

  it('reports a RESULTED order and locks it afterwards', async () => {
    const user = userEvent.setup();
    let current = order({ status: 'RESULTED', accessionNumber: 'A-0001', results: [LOW_HB] });
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': () => ({ body: [current] }),
      'GET /lab/orders/o-1': () => ({ body: current }),
      'PATCH /lab/orders/o-1/report': () => {
        current = order({ status: 'REPORTED', accessionNumber: 'A-0001', results: [LOW_HB] });
        return { body: current };
      },
    }));
    renderPage(<LabPage />);
    await openOrder();

    await user.click(screen.getByRole('button', { name: 'Report' }));
    await waitFor(() =>
      expect(apiCalls.some((c) => c.method === 'PATCH' && c.url === '/lab/orders/o-1/report')).toBe(true),
    );

    expect(await screen.findByText(/Report finalized/i)).toBeInTheDocument();
    // Released results are outside the clinic now — someone may already be
    // acting on the printout. Amending or cancelling behind that has to go
    // through a fresh order, not a button on this screen.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Amend' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull();
  });

  it('shows the server’s reason for refusing an incomplete report', async () => {
    const user = userEvent.setup();
    const refusal = 'All ordered tests must be resulted before reporting';
    const resulted = order({ status: 'RESULTED', items: [HB_ITEM, CULTURE_ITEM], results: [LOW_HB] });
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [resulted] },
      'GET /lab/orders/o-1': { body: resulted },
      'PATCH /lab/orders/o-1/report': { status: 400, body: nestError(400, refusal) },
    }));
    renderPage(<LabPage />);
    await openOrder();

    await user.click(screen.getByRole('button', { name: 'Report' }));

    // "Request failed" sends someone clicking again. Naming the missing step is
    // what gets the culture entered and the report out.
    expect(await screen.findByText(refusal)).toBeInTheDocument();
  });
});

describe('placing a new order', () => {
  it('sends each picked test once and opens the order it created', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /lab/orders': { status: 201, body: { ...order({ id: 'o-9', orderNumber: 'LAB-2026-0009' }) } },
      'GET /lab/orders/o-9': { body: order({ id: 'o-9', orderNumber: 'LAB-2026-0009' }) },
    }));
    renderPage(<LabPage />);
    await screen.findByText('LAB-2026-0001');

    await pickFromSelect(/Test/, /Hemoglobin/);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    // Same test picked twice — a double-tap on a busy bench. The patient must
    // not be billed twice and phlebotomy must not draw a second tube.
    await pickFromSelect(/Test/, /Hemoglobin/);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await pickFromSelect(/Test/, /Fasting glucose/);
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await user.click(screen.getByRole('button', { name: /^Order 2 tests$/ }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/lab/orders');
      expect(post!.body).toEqual({ patientId: 'p-1', testCodes: ['HB', 'GLU_F'] });
    });
    // The new order opens straight away; otherwise the technologist hunts for
    // it in the list to collect against it.
    expect(await screen.findByRole('heading', { name: 'LAB-2026-0009' })).toBeInTheDocument();
  });
});

describe('changing patient', () => {
  it('drops the open order so one patient’s result is never read under another’s name', async () => {
    const resulted = order({ status: 'RESULTED', accessionNumber: 'A-0001', results: [LOW_HB] });
    mockApi(stubs({
      'GET /lab/patients/p-1/orders': { body: [resulted] },
      'GET /lab/orders/o-1': { body: resulted },
      'GET /lab/patients/p-2/orders': { body: [] },
    }));
    renderPage(<LabPage />);
    await openOrder();
    expect(screen.getByText(/7\.5 g\/dL/)).toBeInTheDocument();

    await pickFromSelect(/Patient/, /Bilal Ahmed/);

    // Ayesha's haemoglobin of 7.5 under Bilal's name is the exact shape of a
    // wrong-patient transfusion decision. The detail panel has to empty.
    await waitFor(() => expect(screen.queryByText(/7\.5 g\/dL/)).toBeNull());
    expect(screen.queryByRole('heading', { name: 'LAB-2026-0001' })).toBeNull();
    expect(screen.getByText(/No lab orders for this patient yet/i)).toBeInTheDocument();
    expect(apiCalls.some((c) => c.url === '/lab/patients/p-2/orders')).toBe(true);
  });
});
