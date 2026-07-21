// The bed board — who is admitted, into which bed, and what happens when there
// is nowhere to put them.
//
// The invariants the ward runs on are the server's: one patient per bed, one
// active admission per patient, discharge frees the bed. This page's job is not
// to restate them but to never contradict them on screen. Two ways it can:
//
//   - offering a bed that is occupied or under maintenance, so the admission is
//     attempted against a bed somebody is already lying in;
//   - showing an empty bed picker on a full ward as though a bed just had not
//     been chosen yet, instead of saying there is no bed.
//
// The second is the one that costs time at 2am: the clerk clicks the dropdown,
// sees nothing, assumes the list is loading, and waits. What they need to read
// is "no beds available — discharge a patient or add a ward".
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IpdPage from './IpdPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const PATIENTS = [
  { id: 'p-1', name: 'Ayesha Khan', mrn: 'P-00001' },
  { id: 'p-2', name: 'Bilal Ahmed', mrn: 'P-00002' },
];

const BEDS = [
  { id: 'bed-1', code: 'A-01', status: 'AVAILABLE', ward: { name: 'General Ward' } },
  { id: 'bed-2', code: 'A-02', status: 'OCCUPIED', ward: { name: 'General Ward' } },
  { id: 'bed-3', code: 'ICU-1', status: 'MAINTENANCE', ward: { name: 'ICU' } },
];

const OCCUPANCY = { totalBeds: 3, available: 1, occupied: 1, maintenance: 1, occupancyRatePct: 33 };

const ADMISSIONS = [
  {
    id: 'adm-1',
    status: 'ADMITTED',
    diagnosis: 'Dengue fever',
    admittedAt: '2026-07-18T09:00:00.000Z',
    dischargedAt: null,
    patient: { name: 'Bilal Ahmed', mrn: 'P-00002' },
    bed: { code: 'A-02', ward: { name: 'General Ward', floor: '1' } },
  },
];

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /ipd/occupancy': { body: OCCUPANCY },
    'GET /ipd/beds': { body: BEDS },
    'GET /ipd/admissions?status=ADMITTED': { body: ADMISSIONS },
    ...extra,
  } as never;
}

/**
 * Open a MUI Select and take an option.
 *
 * By ROLE — the InputLabel is tied to the hidden native input, so
 * getByLabelText walks straight past the thing that opens the menu. The menu is
 * portalled to document.body, and while it is open MUI marks the rest of the
 * page aria-hidden, so nothing else is reachable by role until it closes.
 */
async function pick(name: RegExp, option: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(option));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

/** Open a Select and hand back its (portalled) listbox without choosing. */
async function openSelect(name: RegExp) {
  await userEvent.setup().click(screen.getByRole('combobox', { name }));
  return screen.findByRole('listbox');
}

const BED_SELECT = /Bed \(available only\)/;

/**
 * What a Select actually shows the clerk.
 *
 * A MUI Select with no value still renders a zero-width space to hold its
 * height, so the raw textContent of a cleared one is "​", not "". Stripping
 * it is what lets an emptied field be asserted POSITIVELY (`toBe('')`) instead
 * of settling for "does not contain the name that was there before".
 */
const shown = (el: HTMLElement) => (el.textContent ?? '').replace(/​/g, '').trim();

describe('only a bed that is actually free can be admitted into', () => {
  it('leaves occupied and maintenance beds out of the picker while still showing them on the board', async () => {
    mockApi(stubs());
    renderPage(<IpdPage />);
    await screen.findByText('A-01');

    // The board shows all three, because the clerk needs to see why the ward
    // is full.
    expect(screen.getByText('A-02')).toBeInTheDocument();
    expect(screen.getByText('ICU-1')).toBeInTheDocument();

    const listbox = await openSelect(BED_SELECT);
    expect(within(listbox).getByText(/General Ward · A-01/)).toBeInTheDocument();
    // A-02 has a patient in it and ICU-1 is out of service. Offering either
    // sends the clerk to a bed that is already occupied, and the admission is
    // refused at the server after the porter has already moved the patient.
    expect(within(listbox).queryByText(/A-02/)).toBeNull();
    expect(within(listbox).queryByText(/ICU-1/)).toBeNull();
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
  }, 60000);

  it('admits the chosen patient into the chosen bed, with the diagnosis typed', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /ipd/admissions': { status: 201, body: { id: 'adm-2' } } }));
    renderPage(<IpdPage />);
    await screen.findByText('A-01');

    await pick(/Patient/, /Ayesha Khan/);
    await pick(BED_SELECT, /General Ward · A-01/);
    await user.type(screen.getByRole('textbox', { name: /Diagnosis/ }), 'Cellulitis right leg');
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/ipd/admissions');
      // Ids, not names. The bed id is the thing the unique constraint is on;
      // a code like "A-01" repeats across wards.
      expect(post!.body).toEqual({
        patientId: 'p-1',
        bedId: 'bed-1',
        diagnosis: 'Cellulitis right leg',
      });
    });
  }, 60000);

  it('omits an untouched diagnosis instead of filing an empty one', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /ipd/admissions': { status: 201, body: { id: 'adm-2' } } }));
    renderPage(<IpdPage />);
    await screen.findByText('A-01');

    await pick(/Patient/, /Ayesha Khan/);
    await pick(BED_SELECT, /General Ward · A-01/);
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/ipd/admissions');
      // An empty string is a diagnosis of "". It renders as a blank rather than
      // the "—" the board shows for "not recorded", so nobody can tell the
      // difference between not yet known and deliberately left out.
      expect(post!.body).not.toHaveProperty('diagnosis');
    });
  }, 60000);

  it('reloads the board and clears the form once the admission is accepted', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /ipd/admissions': { status: 201, body: { id: 'adm-2' } } }));
    renderPage(<IpdPage />);
    await screen.findByText('A-01');

    await pick(/Patient/, /Ayesha Khan/);
    await pick(BED_SELECT, /General Ward · A-01/);
    await user.type(screen.getByRole('textbox', { name: /Diagnosis/ }), 'Cellulitis right leg');
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    // The bed just filled must leave the picker, and the counts on the wall
    // must move. Without the refetch the next clerk is choosing from a bed list
    // that predates this admission — which is how two patients get sent to one
    // bed without the server ever being asked twice.
    await waitFor(() =>
      expect(apiCalls.filter((c) => c.url === '/ipd/beds')).toHaveLength(2),
    );
    expect(apiCalls.filter((c) => c.url === '/ipd/occupancy')).toHaveLength(2);
    expect(apiCalls.filter((c) => c.url === '/ipd/admissions?status=ADMITTED')).toHaveLength(2);

    // And every field must be empty afterwards — each one checked on its own,
    // against what the clerk can actually read on the control.
    //
    // NOT via the Admit button. `disabled={!patientId || !bedId || busy}` is a
    // disjunction: it goes grey the moment ANY ONE of the two ids is cleared
    // and stays grey while the other still carries the admission that was just
    // filed, and `diagnosis` never enters the expression at all. A greyed-out
    // button is therefore compatible with a form that is still two-thirds full.
    await waitFor(() => expect(shown(screen.getByRole('combobox', { name: /Patient/ }))).toBe(''));

    // Ayesha Khan is now an inpatient. Leaving her named in the picker puts a
    // second active admission for the same patient one click away — the case
    // the server's partial unique index exists to refuse, arriving here as a
    // refusal the clerk has to read and undo instead of never being sent.
    expect(screen.getByRole('combobox', { name: /Patient/ })).not.toHaveTextContent('Ayesha Khan');

    // A-01 has somebody in it now. Leaving it selected is the two-patients-in-
    // one-bed case above, reached from the other side: not a stale bed LIST,
    // but a stale bed CHOICE that survived the refetch that emptied the list.
    expect(shown(screen.getByRole('combobox', { name: BED_SELECT }))).toBe('');
    expect(screen.getByRole('combobox', { name: BED_SELECT })).not.toHaveTextContent('A-01');

    // And the diagnosis, which the button's disabled state can never speak for:
    // carried over, it is filed against the NEXT patient admitted, who does not
    // have it.
    expect(screen.getByRole('textbox', { name: /Diagnosis/ })).toHaveValue('');
  }, 60000);
});

describe('a ward with nowhere to put anyone says so', () => {
  const FULL = BEDS.map((b) => ({ ...b, status: b.id === 'bed-1' ? 'OCCUPIED' : b.status }));

  it('does not present an empty bed list as though admission were possible', async () => {
    mockApi(
      stubs({
        'GET /ipd/beds': { body: FULL },
        'GET /ipd/occupancy': {
          body: { totalBeds: 3, available: 0, occupied: 2, maintenance: 1, occupancyRatePct: 100 },
        },
      }),
    );
    renderPage(<IpdPage />);
    await screen.findByText('A-01');

    // Naming a patient is not enough — there is no bed to name.
    await pick(/Patient/, /Ayesha Khan/);
    expect(screen.getByRole('button', { name: 'Admit' })).toBeDisabled();

    const listbox = await openSelect(BED_SELECT);
    expect(within(listbox).queryAllByRole('option')).toHaveLength(0);
    await userEvent.setup().keyboard('{Escape}');

    // An empty dropdown alone reads as "still loading". The sentence is what
    // tells the clerk to go and find a discharge instead of clicking again.
    expect(await screen.findByText(/No beds available/i)).toBeInTheDocument();
    expect(screen.getByText(/discharge a patient or add a ward/i)).toBeInTheDocument();
  }, 60000);

  it('tells a clinic that has not set up a ward yet that there are no beds at all', async () => {
    mockApi(
      stubs({
        'GET /ipd/beds': { body: [] },
        'GET /ipd/occupancy': {
          body: { totalBeds: 0, available: 0, occupied: 0, maintenance: 0, occupancyRatePct: 0 },
        },
        'GET /ipd/admissions?status=ADMITTED': { body: [] },
      }),
    );
    renderPage(<IpdPage />);

    // A brand new tenant has no wards. "No beds yet" is a setup instruction;
    // a blank table is a bug report.
    expect(await screen.findByText('No beds yet.')).toBeInTheDocument();
    expect(screen.getByText(/No beds available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Admit' })).toBeDisabled();
  }, 60000);
});

describe('the server owns the invariants; the page repeats them word for word', () => {
  it('shows why the admission was refused and keeps the selection to correct', async () => {
    const user = userEvent.setup();
    mockApi(
      stubs({
        // ipd.service.ts: the partial unique index turns a concurrent second
        // admit into exactly this.
        'POST /ipd/admissions': { status: 400, body: nestError(400, 'Patient is already admitted') },
      }),
    );
    renderPage(<IpdPage />);
    await screen.findByText('A-01');

    await pick(/Patient/, /Bilal Ahmed/);
    await pick(BED_SELECT, /General Ward · A-01/);
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    expect(await screen.findByText('Patient is already admitted')).toBeInTheDocument();

    // Nothing was created, so the form must not behave as though it had been:
    // the clerk needs the choices still there to change the patient, not a
    // blank form and no idea what they just tried to do.
    expect(screen.getByRole('combobox', { name: /Patient/ })).toHaveTextContent('Bilal Ahmed');
    expect(screen.getByRole('combobox', { name: BED_SELECT })).toHaveTextContent('A-01');
    expect(screen.getByRole('button', { name: 'Admit' })).toBeEnabled();
  }, 60000);

  it('does not invent a message of its own when the server sent one', async () => {
    const user = userEvent.setup();
    mockApi(
      stubs({
        'POST /ipd/admissions': {
          status: 400,
          body: nestError(400, 'Bed is occupied — not available'),
        },
      }),
    );
    renderPage(<IpdPage />);
    await screen.findByText('A-01');

    await pick(/Patient/, /Ayesha Khan/);
    await pick(BED_SELECT, /General Ward · A-01/);
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    // "Bed is occupied" tells the clerk to pick another bed. "Request failed"
    // tells them to try the same bed again.
    expect(await screen.findByText(/Bed is occupied — not available/)).toBeInTheDocument();
    expect(screen.queryByText('Request failed')).toBeNull();
  }, 60000);
});

describe('discharge frees the bed', () => {
  it('puts the bed back in the picker and takes the patient off the ward list', async () => {
    const user = userEvent.setup();
    let discharged = false;
    const takenBed = [{ id: 'bed-1', code: 'A-01', status: 'OCCUPIED', ward: { name: 'General Ward' } }];
    const freeBed = [{ id: 'bed-1', code: 'A-01', status: 'AVAILABLE', ward: { name: 'General Ward' } }];
    const stay = [{ ...ADMISSIONS[0], bed: { code: 'A-01', ward: { name: 'General Ward', floor: '1' } } }];

    mockApi({
      'GET /patients': { body: PATIENTS },
      'GET /ipd/beds': () => ({ body: discharged ? freeBed : takenBed }),
      'GET /ipd/occupancy': () => ({
        body: discharged
          ? { totalBeds: 1, available: 1, occupied: 0, maintenance: 0, occupancyRatePct: 0 }
          : { totalBeds: 1, available: 0, occupied: 1, maintenance: 0, occupancyRatePct: 100 },
      }),
      'GET /ipd/admissions?status=ADMITTED': () => ({ body: discharged ? [] : stay }),
      'PATCH /ipd/admissions/adm-1/discharge': () => {
        discharged = true;
        return { body: { id: 'adm-1', status: 'DISCHARGED' } };
      },
    } as never);

    renderPage(<IpdPage />);
    await screen.findByText('Bilal Ahmed');
    // The ward is full before the discharge.
    expect(screen.getByText(/No beds available/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discharge' }));

    await waitFor(() =>
      expect(
        apiCalls.some(
          (c) => c.method === 'PATCH' && c.url === '/ipd/admissions/adm-1/discharge',
        ),
      ).toBe(true),
    );

    // The consequence, not the request: the bed a patient has just left has to
    // become admissible again without anyone reloading the page. A bed board
    // that still shows a discharged patient in A-01 is how a ward ends up
    // holding an empty bed out of service for a shift.
    expect(await screen.findByText('No current inpatients.')).toBeInTheDocument();
    const listbox = await openSelect(BED_SELECT);
    expect(within(listbox).getByText(/General Ward · A-01/)).toBeInTheDocument();
  }, 60000);

  it('leaves the patient on the ward when the server refuses the discharge', async () => {
    const user = userEvent.setup();
    mockApi(
      stubs({
        'PATCH /ipd/admissions/adm-1/discharge': {
          status: 400,
          body: nestError(400, 'Admission is already discharged'),
        },
      }),
    );
    renderPage(<IpdPage />);
    await screen.findByText('Bilal Ahmed');

    await user.click(screen.getByRole('button', { name: 'Discharge' }));

    expect(await screen.findByText('Admission is already discharged')).toBeInTheDocument();
    // The row must stay. Removing it optimistically would free a bed in the UI
    // that the server still has a patient in.
    expect(screen.getByText('Bilal Ahmed')).toBeInTheDocument();
    expect(screen.queryByText('No current inpatients.')).toBeNull();
  }, 60000);
});
