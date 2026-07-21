// The EPI card and the fridge behind it.
//
// Two failure modes are asserted here, and they are the same failure mode.
//
// 1. A vial that cannot be used must never appear as stock. This is the
//    pharmacy counter's defect — expired boxes counted as on-hand — with a
//    worse ending, because a dud vaccine produces a child who is immunised on
//    paper and susceptible in fact, and nobody finds out until an outbreak. The
//    cold chain adds a second way to be unusable that has nothing to do with the
//    date: a VVM square at stage 3 is a vial that is in date, full, cold to the
//    touch, and dead.
//
// 2. A dose that did not count must never read as "given". The card is what
//    stops anyone looking again.
//
// Vaccine codes, dose numbers, the 28-day minimum interval and the usability
// sentences are the engine's own (epi-schedule.ts, cold-chain.engine.ts); this
// file invents no clinical values and asks the page to derive none — usability
// arrives from the server already decided.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImmunizationPage from './ImmunizationPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const EXPIRED_REASON = 'Lot PEN-2024-09 expired on 2025-08-31.';
const VVM_REASON =
  'Lot MR-2027-04 is at VVM stage 3 — the vial has had too much cumulative heat and must be ' +
  'discarded. Check the fridge and the rest of this shipment.';
const STAGE_2_PRIORITY =
  'Lot BCG-2026-11 is at VVM stage 2 — still usable, but use it before stage-1 stock.';

const FRIDGE = [
  {
    id: 'b-1', vaccineCode: 'PENTA', lotNumber: 'PEN-2027-06', expiry: '2027-06-30T00:00:00.000Z',
    vvmStage: 'STAGE_1', dosesRemaining: 40, discardedAt: null,
    usability: { usable: true, code: 'usable' },
  },
  {
    id: 'b-2', vaccineCode: 'PENTA', lotNumber: 'PEN-2024-09', expiry: '2025-08-31T00:00:00.000Z',
    vvmStage: 'STAGE_1', dosesRemaining: 20, discardedAt: null,
    usability: { usable: false, code: 'expired', reason: EXPIRED_REASON },
  },
  {
    // In date, 50 doses left, and unusable. Only the VVM says so.
    id: 'b-3', vaccineCode: 'MR', lotNumber: 'MR-2027-04', expiry: '2027-04-30T00:00:00.000Z',
    vvmStage: 'STAGE_3', dosesRemaining: 50, discardedAt: null,
    usability: { usable: false, code: 'vvm_discard', reason: VVM_REASON },
  },
  {
    id: 'b-4', vaccineCode: 'BCG', lotNumber: 'BCG-2026-11', expiry: '2026-11-30T00:00:00.000Z',
    vvmStage: 'STAGE_2', dosesRemaining: 10, discardedAt: null,
    usability: { usable: true, code: 'usable', usePriority: STAGE_2_PRIORITY },
  },
];

const PULL = [
  { id: 'b-2', lotNumber: 'PEN-2024-09', vaccineCode: 'PENTA', dosesRemaining: 20, code: 'expired', reason: EXPIRED_REASON },
  { id: 'b-3', lotNumber: 'MR-2027-04', vaccineCode: 'MR', dosesRemaining: 50, code: 'vvm_discard', reason: VVM_REASON },
];

const INVALID_REASON =
  'Given 12 days after the previous PENTA dose; the minimum interval is 28 days. ' +
  'This dose does not count and must be repeated.';
const BLOCKED_REASON = 'PENTA dose 2 did not count and must be repeated first.';

const ROWS = [
  { vaccineCode: 'BCG', vaccineName: 'BCG', dose: '1', ageLabel: 'Birth', dueDate: '2025-01-04', status: 'given', givenAt: '2025-01-04', lotNumber: 'BCG-2024-11' },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '1', ageLabel: '6 weeks', dueDate: '2025-02-15', status: 'given', givenAt: '2025-02-17', lotNumber: 'PEN-2024-09' },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '2', ageLabel: '10 weeks', dueDate: '2025-03-15', status: 'given_invalid', givenAt: '2025-03-01', lotNumber: 'PEN-2024-09', intervalDays: 12, reason: INVALID_REASON },
  { vaccineCode: 'PENTA', vaccineName: 'Pentavalent (DTP-HepB-Hib)', dose: '3', ageLabel: '14 weeks', dueDate: '2025-04-12', status: 'blocked', reason: BLOCKED_REASON },
  { vaccineCode: 'MR', vaccineName: 'Measles-Rubella', dose: '1', ageLabel: '9 months', dueDate: '2025-10-01', status: 'overdue' },
];

// The server's own shape: {patientId, dob, summary, schedule}.
const CARD = {
  patientId: 'pt-1',
  dob: '2025-01-04',
  summary: {
    total: 5, given: 2, givenInvalid: 1, due: 0, overdue: 1, upcoming: 0, blocked: 1, agedOut: 0,
    mustRepeat: [{ vaccineCode: 'PENTA', dose: '2', reason: INVALID_REASON }],
  },
  schedule: ROWS,
};

const CARD_URL = '/patients/pt-1/immunization-schedule';

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /vaccine-batches': { body: FRIDGE },
    'GET /vaccine-batches/alerts': { body: { pull: PULL } },
    ...extra,
  } as never;
}

/** Open a child's card the way the page asks for it: paste an id. */
async function openCard(id: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(/Patient ID/));
  await user.paste(id);
}

/** The fridge row for one lot. Lot numbers are unique in a fridge. */
function fridgeRow(lotNumber: string): HTMLElement {
  const row = screen.getByText(lotNumber).closest('tr');
  if (!row) throw new Error(`no fridge row for lot ${lotNumber}`);
  return row;
}

/** A card row, identified by vaccine AND dose — a vaccine appears many times. */
function cardRow(vaccineName: string, dose: string): HTMLElement {
  const row = screen.getAllByRole('row').find((r) => {
    const cells = within(r).queryAllByRole('cell');
    return cells[0]?.textContent === vaccineName && cells[1]?.textContent === dose;
  });
  if (!row) throw new Error(`no card row for ${vaccineName} dose ${dose}`);
  return row;
}

/**
 * A summary tile. The captions ("given", "overdue", …) are also chip labels in
 * the table below, so the tile is the one whose block starts with its count.
 */
function tile(label: string): HTMLElement {
  const hit = screen
    .getAllByText(label)
    .map((el) => el.parentElement as HTMLElement)
    .find((el) => /^\d/.test(el.textContent ?? ''));
  if (!hit) throw new Error(`no summary tile for "${label}"`);
  return hit;
}

describe('the fridge worklist leads', () => {
  it('names every lot that must come out, with the reason for the discard log', async () => {
    mockApi(stubs());
    renderPage(<ImmunizationPage />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('2 lot(s) must come out of the fridge')).toBeInTheDocument();
    // Lot number and reason together: "pull something" is not a worklist. The
    // VVM reason is the one that implicates the fridge itself, so the rest of
    // the shipment gets checked rather than injected.
    expect(within(alert).getByText('PENTA PEN-2024-09').parentElement).toHaveTextContent(EXPIRED_REASON);
    expect(within(alert).getByText('MR MR-2027-04').parentElement).toHaveTextContent(VVM_REASON);

    // Above the fridge table, not under it. A discard list you have to scroll a
    // 25-row stock table to reach is a list nobody works through.
    const coldChain = screen.getByText('Cold chain');
    expect(alert.compareDocumentPosition(coldChain) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('an unusable vial is never offered as stock', () => {
  it('shows an expired lot as expired, not as 20 doses of usable stock', async () => {
    mockApi(stubs());
    renderPage(<ImmunizationPage />);
    await screen.findByText('PEN-2024-09');

    const row = fridgeRow('PEN-2024-09');
    expect(row).toHaveTextContent(EXPIRED_REASON);
    // The 20 doses are real and none of them may go into an arm. The pharmacy
    // counter made exactly this mistake with expired boxes; here the dose is
    // silently useless, so the shelf state has to carry the whole warning.
    expect(within(row).queryByText('usable')).toBeNull();
    expect(within(row).queryByText(STAGE_2_PRIORITY)).toBeNull();
  });

  it('refuses a heat-damaged lot that is still in date and still full', async () => {
    mockApi(stubs());
    renderPage(<ImmunizationPage />);
    await screen.findByText('MR-2027-04');

    const row = fridgeRow('MR-2027-04');
    // Expiry is not the criterion. This vial is in date to 2027 with 50 doses
    // left; the VVM square is the only evidence it is dead, and if the page
    // reads the date instead of the verdict it hands over a dud.
    expect(row).toHaveTextContent('2027-04-30');
    expect(row).toHaveTextContent(VVM_REASON);
    expect(within(row).queryByText('usable')).toBeNull();
  });

  it('still marks a good lot usable, and says which one to open first', async () => {
    mockApi(stubs());
    renderPage(<ImmunizationPage />);
    await screen.findByText('PEN-2027-06');

    // Without this the previous two tests pass on a page that condemns
    // everything in the fridge — which is its own way of wasting vaccine.
    expect(within(fridgeRow('PEN-2027-06')).getByText('usable')).toBeInTheDocument();
    // Stage 2 is usable but on its way out: use it before stage-1 stock or it
    // becomes waste.
    expect(fridgeRow('BCG-2026-11')).toHaveTextContent(STAGE_2_PRIORITY);
  });
});

describe('a dose that did not count is not shown as given', () => {
  it('leads with the repeat list and marks the row invalid', async () => {
    mockApi(stubs({ [`GET ${CARD_URL}`]: { body: CARD } }));
    renderPage(<ImmunizationPage />);
    await openCard('pt-1');
    await screen.findByText('EPI card');

    // The headline, not a footnote in row 3 of a seven-column table.
    const repeatAlert = screen
      .getByText('1 dose(s) do not count and must be repeated')
      .closest<HTMLElement>('[role="alert"]');
    if (!repeatAlert) throw new Error('the repeat headline is not inside an alert');

    // A count with no list is the fridge worklist's defect again: "one dose must
    // be repeated" sends nobody anywhere. The alert has to name the dose and give
    // the reason, or the nurse has to go hunting through the table for a row
    // whose only marking is a chip.
    expect(within(repeatAlert).getByText('PENTA dose 2').parentElement).toHaveTextContent(
      INVALID_REASON,
    );

    // And it leads: above the card, not below seven columns of schedule.
    const epiCard = screen.getByText('EPI card');
    expect(repeatAlert.compareDocumentPosition(epiCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const row = cardRow('Pentavalent (DTP-HepB-Hib)', '2');
    expect(within(row).getByText('INVALID — repeat')).toBeInTheDocument();
    // A card reading "given" for this dose is worse than a blank one: it stops
    // anyone looking, and the child is walked through the rest of the series on
    // top of a dose that did nothing.
    expect(within(row).queryByText('given')).toBeNull();
    expect(row).toHaveTextContent(INVALID_REASON);
  });

  it('does not fold the invalid dose into the "given" count', async () => {
    mockApi(stubs({ [`GET ${CARD_URL}`]: { body: CARD } }));
    renderPage(<ImmunizationPage />);
    await openCard('pt-1');
    await screen.findByText('EPI card');

    // Two doses counted; the third did not. A tile reading 3 is the same lie as
    // a green tick on the row.
    expect(tile('given')).toHaveTextContent(/^2given$/);
    expect(tile('invalid')).toHaveTextContent(/^1invalid$/);
  });

  it('says why the next dose is blocked, so the repeat happens first', async () => {
    mockApi(stubs({ [`GET ${CARD_URL}`]: { body: CARD } }));
    renderPage(<ImmunizationPage />);
    await openCard('pt-1');
    await screen.findByText('EPI card');

    const row = cardRow('Pentavalent (DTP-HepB-Hib)', '3');
    const cells = within(row).getAllByRole('cell');

    // "blocked" with no sentence gets overridden by whoever is holding the
    // syringe. The reason is the whole value of the engine.
    expect(row).toHaveTextContent(BLOCKED_REASON);

    // And the status has to agree with the sentence. This dose was never
    // administered, so the chip is the one thing a nurse scanning the column
    // actually reads, and the note two cells over does not rescue it: a row
    // marked "given" is a row nobody opens. That is the same defect the dose-2
    // test guards, one row further down — and the guard there is scoped to
    // dose 2, so without this the blocked row can read green unpunished.
    expect(cells[4]).toHaveTextContent('blocked');
    expect(within(row).queryByText('given')).toBeNull();

    // Nothing went into the child, so nothing may be recorded as if it had.
    // A blocked row carrying a date or a lot number reads as an administration
    // and gets counted as one at the next visit.
    expect(cells[5]).toHaveTextContent('—');
    expect(cells[5]).not.toHaveTextContent('PEN-');
  });
});

describe('opening a card', () => {
  it('asks for exactly the id that was pasted, spaces and all', async () => {
    mockApi(stubs({ [`GET ${CARD_URL}`]: { body: CARD } }));
    renderPage(<ImmunizationPage />);
    await screen.findByText('PEN-2027-06');

    // Nothing is fetched for a patient nobody named.
    expect(apiCalls.some((c) => c.url.includes('immunization-schedule'))).toBe(false);

    await openCard('  pt-1  ');

    // A pasted id carries whitespace far more often than not. Untrimmed it 404s,
    // and a 404 on this screen reads as "this child has no card".
    await waitFor(() =>
      expect(apiCalls.some((c) => c.method === 'GET' && c.url === CARD_URL)).toBe(true),
    );
    expect(await screen.findByText('EPI card')).toBeInTheDocument();
  });

  it('shows why the card could not be built instead of an empty one', async () => {
    const refusal = 'Patient has no date of birth — cannot build a schedule';
    mockApi(stubs({ [`GET ${CARD_URL}`]: { status: 400, body: nestError(400, refusal) } }));
    renderPage(<ImmunizationPage />);
    await openCard('pt-1');

    // Without the sentence this is a child with no doses due, which is what an
    // empty card says. With it, someone enters the date of birth.
    expect(await screen.findByText(refusal)).toBeInTheDocument();
    expect(screen.queryByText('EPI card')).toBeNull();
  });
});
