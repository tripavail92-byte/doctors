// Severity grading — the region x sign grid a dermatologist fills in at the
// chair, and what leaves the page afterwards.
//
// Two separate hazards live on this screen.
//
// The first is that the grid is 16 to 24 dropdowns whose only visible content
// is the digits 0-4. The body region is in the row header and the sign is in a
// column header truncated to five characters for width ("Eryth"), and neither
// is attached to the control. Every one of them announced itself as an unnamed
// combobox full of bare numbers, so a grade could be entered against the wrong
// region or the wrong sign with nothing on screen or in the accessibility tree
// to say so. The aria-label restating "<region> - <sign>" is what these tests
// hold in place.
//
// The second is the payload. The score and the band are the SERVER's — the
// engine refuses a client-supplied band and derives EASI's child weights from
// the patient's DOB. So the only thing this page is responsible for is sending
// the raw signs, under the engine's own region keys, as numbers. A region key
// that drifts to a label, or a "3" that travels as a string, produces either a
// 400 or — worse — a score computed from a region the clinician did not grade.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DermatologyGradingPage from './DermatologyGradingPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const PATIENTS = [
  { id: 'p-1', name: 'Ayesha Khan', mrn: 'P-00001' },
  { id: 'p-2', name: 'Bilal Ahmed', mrn: 'P-00002' },
];

// Shape and values copied from DermatologyService.instrumentCatalog() and
// grading.engine.ts. The page renders itself from this, so a stub that invents
// its own regions would test a form the clinic never sees.
const CATALOG = {
  instruments: ['pasi', 'easi', 'masi', 'mmasi', 'gags'],
  gags: {
    regions: [
      { key: 'forehead', label: 'Forehead', factor: 2 },
      { key: 'cheek_r', label: 'Right cheek', factor: 2 },
      { key: 'cheek_l', label: 'Left cheek', factor: 2 },
      { key: 'nose', label: 'Nose', factor: 1 },
      { key: 'chin', label: 'Chin', factor: 1 },
      { key: 'chest_back', label: 'Chest and back', factor: 3 },
    ],
    max: 44,
  },
  pasi: {
    regions: [
      { key: 'head', label: 'Head and neck', weight: 0.1 },
      { key: 'upper_limbs', label: 'Upper limbs', weight: 0.2 },
      { key: 'trunk', label: 'Trunk', weight: 0.3 },
      { key: 'lower_limbs', label: 'Lower limbs', weight: 0.4 },
    ],
    signs: ['erythema', 'induration', 'desquamation'],
    signRange: [0, 4],
    max: 72,
  },
  easi: {
    regionsAdult: [
      { key: 'head', label: 'Head and neck', weight: 0.1 },
      { key: 'upper_limbs', label: 'Upper limbs', weight: 0.2 },
      { key: 'trunk', label: 'Trunk', weight: 0.3 },
      { key: 'lower_limbs', label: 'Lower limbs', weight: 0.4 },
    ],
    regionsChild: [
      { key: 'head', label: 'Head and neck', weight: 0.2 },
      { key: 'upper_limbs', label: 'Upper limbs', weight: 0.2 },
      { key: 'trunk', label: 'Trunk', weight: 0.3 },
      { key: 'lower_limbs', label: 'Lower limbs', weight: 0.3 },
    ],
    signs: ['erythema', 'induration', 'excoriation', 'lichenification'],
    signRange: [0, 3],
    max: 72,
  },
  masi: {
    regions: [
      { key: 'forehead', label: 'Forehead', weight: 0.3 },
      { key: 'malar_r', label: 'Right malar', weight: 0.3 },
      { key: 'malar_l', label: 'Left malar', weight: 0.3 },
      { key: 'chin', label: 'Chin', weight: 0.1 },
    ],
    signs: ['darkness', 'homogeneity'],
    modifiedSigns: ['darkness'],
    signRange: [0, 4],
    max: 48,
    modifiedMax: 24,
  },
};

/** History is fetched per patient AND per instrument, and again after a score. */
function historyStubs(rows: unknown[] = []) {
  const out: Record<string, unknown> = {};
  for (const p of PATIENTS) {
    for (const k of ['pasi', 'easi', 'masi', 'mmasi', 'gags']) {
      out[`GET /dermatology/patients/${p.id}/grades?instrument=${k}`] = { body: rows };
    }
  }
  return out;
}

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /dermatology/instruments': { body: CATALOG },
    ...historyStubs(),
    ...extra,
  } as never;
}

/**
 * Pick a value from one of the grade dropdowns.
 *
 * By ROLE and by the control's own accessible name — that name is the whole
 * point of the file. The menu is portalled to document.body, and while it is
 * open MUI marks the rest of the page aria-hidden, so the next cell is
 * invisible to getByRole until the menu has actually gone. Hence the wait.
 */
async function pick(name: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(option));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

async function chooseInstrument(label: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: /Instrument/ }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(label));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

async function choosePatient(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: /Patient/ }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(name));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

/** Fill a whole region x sign grid from a table of `"<region> - <cell>": value`. */
async function fillGrid(cells: Record<string, string>) {
  for (const [name, value] of Object.entries(cells)) await pick(name, value);
}

const MMASI_ZEROS = {
  'Forehead — area': '0',
  'Forehead — Darkness': '0',
  'Right malar — area': '0',
  'Right malar — Darkness': '0',
  'Left malar — area': '0',
  'Left malar — Darkness': '0',
  'Chin — area': '0',
  'Chin — Darkness': '0',
};

describe('the grade grid says which region and which sign it is grading', () => {
  it('names every dropdown "<region> — <sign>", with the sign spelled out', async () => {
    mockApi(stubs());
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });

    // All 16 PASI cells. Without these names a clinician using a screen reader
    // hears "combobox, 0" sixteen times in a row and has no way to know which
    // body region or which sign the number they are about to enter belongs to
    // — and a PASI entered against the wrong region is a wrong severity that
    // then drives the treatment decision.
    for (const region of ['Head and neck', 'Upper limbs', 'Trunk', 'Lower limbs']) {
      for (const cell of ['area', 'Erythema', 'Induration', 'Desquamation']) {
        expect(screen.getByRole('combobox', { name: `${region} — ${cell}` })).toBeInTheDocument();
      }
    }

    // The visible column header is cut to five characters to fit the table.
    // Naming the control from that truncation would leave "Eryth" as the only
    // clue, which is not a sign anyone can act on.
    expect(screen.queryByRole('combobox', { name: 'Head and neck — Eryth' })).toBeNull();
  }, 60000);

  it('renames the grid when the instrument changes, instead of keeping PASI’s signs', async () => {
    mockApi(stubs());
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });

    await chooseInstrument(/mMASI/);
    await screen.findByRole('combobox', { name: 'Forehead — Darkness' });

    // mMASI is MASI without homogeneity. If the page rendered masi.signs here
    // the clinician would be asked for a sign the modified index does not use,
    // and would read the resulting /24 score as if it were a /48 MASI.
    expect(screen.queryByRole('combobox', { name: 'Forehead — Homogeneity' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Head and neck — Erythema' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Chin — area' })).toBeInTheDocument();
  }, 60000);
});

describe('a grade is only submitted once it is whole', () => {
  it('refuses to score a region that is missing one sign', async () => {
    mockApi(stubs());
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });
    await chooseInstrument(/mMASI/);
    await screen.findByRole('combobox', { name: 'Forehead — Darkness' });

    await fillGrid({
      'Forehead — area': '3',
      'Forehead — Darkness': '2',
      'Right malar — area': '3',
      'Right malar — Darkness': '2',
      'Left malar — area': '3',
      'Left malar — Darkness': '2',
      'Chin — area': '2',
    });

    // Chin darkness is still blank. The engine throws on a partial region and
    // saves nothing; scoring anyway would put a total on the chart that was
    // computed from three regions and presented as four.
    expect(screen.getByRole('button', { name: 'Score mMASI' })).toBeDisabled();
    expect(screen.getByText(/a partial grade cannot be scored/i)).toBeInTheDocument();

    await pick('Chin — Darkness', '1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Score mMASI' })).toBeEnabled());
  }, 60000);

  it('treats 0 as a grade, so clear skin is scoreable and posts as 0', async () => {
    mockApi(
      stubs({
        'POST /dermatology/grades': {
          status: 201,
          body: { key: 'mmasi', score: 0, band: 'clear', max: 24, subscores: {} },
        },
      }),
    );
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });
    await chooseInstrument(/mMASI/);
    await screen.findByRole('combobox', { name: 'Forehead — Darkness' });

    await fillGrid(MMASI_ZEROS);

    // A patient whose melasma has cleared grades 0 everywhere. If the form
    // treated 0 as "not answered" the one result worth recording — treatment
    // worked — could never be entered.
    //
    // First: the 0 the clinician picked has to be VISIBLE in the cell it was
    // picked into. 0 is the one grade that is falsy, so a `||` fallback on the
    // Select's value renders every one of them as an empty box — the grid of a
    // fully graded clear-skin patient then reads as completely unfilled while
    // the Score button enables for no reason the clinician can see, and the
    // obvious response is to re-enter all eight cells. A blank cell must mean
    // "not answered" and nothing else.
    for (const name of Object.keys(MMASI_ZEROS)) {
      expect(screen.getByRole('combobox', { name })).toHaveTextContent('0');
    }

    const score = screen.getByRole('button', { name: 'Score mMASI' });
    await waitFor(() => expect(score).toBeEnabled());
    await userEvent.setup().click(score);

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/dermatology/grades');
      expect(post!.body).toEqual({
        patientId: 'p-1',
        instrument: 'mmasi',
        answers: {
          forehead: { area: 0, darkness: 0 },
          malar_r: { area: 0, darkness: 0 },
          malar_l: { area: 0, darkness: 0 },
          chin: { area: 0, darkness: 0 },
        },
      });
    });
  }, 60000);
});

describe('what the page sends is what was graded', () => {
  it('posts every PASI cell under the engine’s region key, as a number', async () => {
    mockApi(
      stubs({
        'POST /dermatology/grades': {
          status: 201,
          body: { key: 'pasi', score: 8.4, band: 'moderate', max: 72, subscores: {} },
        },
      }),
    );
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });

    // Deliberately no repeated row and no repeated column: if region rows or
    // sign columns were transposed anywhere between the grid and the request,
    // the body below would not match.
    await fillGrid({
      'Head and neck — area': '1',
      'Head and neck — Erythema': '0',
      'Head and neck — Induration': '2',
      'Head and neck — Desquamation': '4',
      'Upper limbs — area': '2',
      'Upper limbs — Erythema': '1',
      'Upper limbs — Induration': '3',
      'Upper limbs — Desquamation': '0',
      'Trunk — area': '3',
      'Trunk — Erythema': '2',
      'Trunk — Induration': '4',
      'Trunk — Desquamation': '1',
      'Lower limbs — area': '4',
      'Lower limbs — Erythema': '3',
      'Lower limbs — Induration': '0',
      'Lower limbs — Desquamation': '2',
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Score PASI' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/dermatology/grades');
      expect(post!.body).toEqual({
        patientId: 'p-1',
        instrument: 'pasi',
        // Numbers, not the strings the Select hands back: the engine's
        // `typeof v !== 'number'` guard rejects "3" outright, and a page that
        // sent strings would 400 on every single grade.
        answers: {
          head: { area: 1, erythema: 0, induration: 2, desquamation: 4 },
          upper_limbs: { area: 2, erythema: 1, induration: 3, desquamation: 0 },
          trunk: { area: 3, erythema: 2, induration: 4, desquamation: 1 },
          lower_limbs: { area: 4, erythema: 3, induration: 0, desquamation: 2 },
        },
      });
    });
    // Sixteen portalled menus, each with a real MUI transition to wait out.
    // Generous on purpose: the suite runs page files in parallel workers and
    // this one must not fail for being queued behind three others.
  }, 120000);

  it('grades the patient chosen at the top, not whoever loaded first', async () => {
    mockApi(
      stubs({
        'POST /dermatology/grades': {
          status: 201,
          body: { key: 'gags', score: 20, band: 'moderate', max: 44, subscores: {} },
        },
      }),
    );
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });

    await chooseInstrument(/GAGS/);
    await screen.findByRole('combobox', { name: 'Forehead — grade' });
    await choosePatient(/Bilal Ahmed/);

    await fillGrid({
      'Forehead — grade': '1',
      'Right cheek — grade': '2',
      'Left cheek — grade': '3',
      'Nose — grade': '0',
      'Chin — grade': '4',
      'Chest and back — grade': '2',
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Score GAGS' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/dermatology/grades');
      // GAGS is a flat grade per region, not a region x sign row — and it must
      // land on Bilal. A grade filed against the patient the list happened to
      // open with is a severity in the wrong chart.
      expect(post!.body).toEqual({
        patientId: 'p-2',
        instrument: 'gags',
        answers: { forehead: 1, cheek_r: 2, cheek_l: 3, nose: 0, chin: 4, chest_back: 2 },
      });
    });
  }, 60000);
});

describe('the score on screen is the one the server computed', () => {
  it('shows the server’s number and band, and reloads the history behind it', async () => {
    mockApi(
      stubs({
        'POST /dermatology/grades': {
          status: 201,
          // All zeros were entered. The engine, not this page, decides what the
          // score is — so the page must show 12.4 even though nothing on the
          // form could have produced it.
          body: { key: 'mmasi', score: 12.4, band: 'severe', max: 24, subscores: {} },
        },
      }),
    );
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });
    await chooseInstrument(/mMASI/);
    await screen.findByRole('combobox', { name: 'Forehead — Darkness' });
    await fillGrid(MMASI_ZEROS);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Score mMASI' }));

    expect(await screen.findByText('12.4')).toBeInTheDocument();
    expect(screen.getByText('/ 24')).toBeInTheDocument();
    expect(screen.getByText('severe')).toBeInTheDocument();

    // The history table under the score is the trend the treatment decision is
    // actually made on. If it is not refetched, the grade just recorded is
    // missing from it until someone reloads the page, and the last visit reads
    // as the current one.
    await waitFor(() =>
      expect(
        apiCalls.filter(
          (c) => c.method === 'GET' && c.url === '/dermatology/patients/p-1/grades?instrument=mmasi',
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
  }, 60000);

  it('says outright when a score has no validated band rather than leaving it blank', async () => {
    mockApi(
      stubs({
        'POST /dermatology/grades': {
          status: 201,
          body: { key: 'mmasi', score: 7.2, band: null, max: 24, subscores: {} },
        },
      }),
    );
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });
    await chooseInstrument(/mMASI/);
    await screen.findByRole('combobox', { name: 'Forehead — Darkness' });
    await fillGrid(MMASI_ZEROS);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Score mMASI' }));

    expect(await screen.findByText('7.2')).toBeInTheDocument();
    // mMASI has no published severity bands. An empty space next to the number
    // reads as "no severity", i.e. mild. Saying there is no validated band is
    // the difference between an unknown and a reassurance.
    expect(screen.getByText(/no validated band/i)).toBeInTheDocument();
  }, 60000);

  it('shows the server’s refusal and puts no score on screen', async () => {
    const refusal =
      'EASI requires the patient date of birth: region weights differ for children ' +
      'aged 7 and under. Record the DOB on the patient first.';
    mockApi(
      stubs({
        'POST /dermatology/grades': { status: 400, body: nestError(400, refusal) },
      }),
    );
    renderPage(<DermatologyGradingPage />);
    await screen.findByRole('combobox', { name: 'Head and neck — area' });
    await chooseInstrument(/mMASI/);
    await screen.findByRole('combobox', { name: 'Forehead — Darkness' });
    await fillGrid(MMASI_ZEROS);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Score mMASI' }));

    // The engine's sentence names the exact gap and what to do about it.
    // "Could not score this grade" sends the clinician back to re-enter the
    // same 24 numbers against a form that will refuse them again.
    expect(await screen.findByText(/Record the DOB on the patient first/i)).toBeInTheDocument();

    // The grade that was refused is the grade that was on the form — the
    // refusal is about THIS submission, not a stale one.
    const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/dermatology/grades');
    expect(post!.body).toEqual({
      patientId: 'p-1',
      instrument: 'mmasi',
      answers: {
        forehead: { area: 0, darkness: 0 },
        malar_r: { area: 0, darkness: 0 },
        malar_l: { area: 0, darkness: 0 },
        chin: { area: 0, darkness: 0 },
      },
    });

    // Nothing was saved, so nothing may be shown as a result — and "nothing on
    // screen" has to be checked against the parts of the result card that a
    // score ALWAYS brings with it: the number itself, the "/ max" denominator,
    // and the band chip (a real band, or the explicit "no validated band").
    // Keying on the card's caption instead would let any card whose caption
    // read differently sit under the refusal with a score in it.
    expect(screen.queryByText(/^\/\s*\d/)).toBeNull();
    // The grid cells legitimately render bare integers, so a score is pinned by
    // the decimal it is displayed with — no "12.4"-shaped number anywhere.
    expect(screen.queryByText(/^\d+\.\d+$/)).toBeNull();
    expect(screen.queryByText('severe')).toBeNull();
    expect(screen.queryByText(/no validated band/i)).toBeNull();

    // ...and nothing was written, so the history behind the form is not
    // reloaded and still reads as empty. A refused grade that bumps the
    // history is a grade the clinician will believe was recorded.
    expect(
      apiCalls.filter(
        (c) => c.method === 'GET' && c.url === '/dermatology/patients/p-1/grades?instrument=mmasi',
      ).length,
    ).toBe(1);
    expect(screen.getByText(/No mMASI grades recorded yet/i)).toBeInTheDocument();
  }, 60000);
});
