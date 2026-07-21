// The odontogram, the DMFT index, and the periodontal summary.
//
// Everything numeric on this page is computed on the SERVER and merely printed
// here. DMFT is not "how many teeth say caries" — the D/M/F category of each
// condition lives in the reference (a crown and a root canal are both F, an
// implant is M), and the sound count is against all 32 teeth, of which the page
// only ever holds the charted few. So a page that recounts is a page that lies.
//
// The other half is the write path. Setting a tooth's condition used to have no
// catch at all: a refused write closed the menu, said nothing, and left the
// tooth showing its old condition — so a clinician charted caries, saw nothing
// change, and had no way to tell a stubborn UI from a chart that never took it.
//
// Fixtures use the server's real condition codes and colours from
// app/backend/src/dental/tooth-reference.ts and the real perio stage strings
// from perio.engine.ts. Nothing clinical is invented here.
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DentalPage from './DentalPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

// 32 tooth boxes plus a portalled menu re-render on every interaction. The
// default 5s budget passes alone and times out when the suite runs in parallel.
vi.setConfig({ testTimeout: 30000 });

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111', dob: '1990-01-01', gender: 'female', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p-2', mrn: 'P-00002', name: 'Bilal Ahmed', phone: '+92 300 2222222', dob: '1988-05-04', gender: 'male', createdAt: '2026-01-02T00:00:00.000Z' },
];

const REFERENCE = {
  teeth: [],
  conditions: [
    { code: 'healthy', label: 'Healthy', dmft: null, color: '#e7eaeb' },
    { code: 'caries', label: 'Caries (decayed)', dmft: 'D', color: '#D92D20' },
    { code: 'filled', label: 'Filled', dmft: 'F', color: '#2F6FEB' },
    { code: 'crown', label: 'Crown', dmft: 'F', color: '#C79A3A' },
    { code: 'root_canal', label: 'Root canal treated', dmft: 'F', color: '#6E2C57' },
    { code: 'missing', label: 'Missing', dmft: 'M', color: '#8a979c' },
    { code: 'implant', label: 'Implant', dmft: 'M', color: '#0E7C74' },
    { code: 'extraction_indicated', label: 'For extraction', dmft: null, color: '#E8590C' },
  ],
  surfaces: ['M', 'O', 'D', 'B', 'L'],
};

const tooth = (fdi: string, condition: string) => ({
  fdi, quadrant: Number(fdi[0]), type: 'molar', condition, surfaces: null, note: null,
});

// One decayed (caries), one missing (an IMPLANT, which the reference maps to M),
// two filled (a CROWN and a ROOT CANAL, both mapped to F), and one flagged for
// extraction, which counts towards nothing. 32 - 4 = 28 sound.
const CHART = {
  patientId: 'p-1',
  teeth: [
    tooth('16', 'caries'),
    tooth('26', 'root_canal'),
    tooth('36', 'crown'),
    tooth('46', 'implant'),
    tooth('11', 'extraction_indicated'),
  ],
  dmft: { decayed: 1, missing: 1, filled: 2, dmft: 4, soundTeeth: 28 },
};

const PERIO_EXAMS = [
  { id: 'pe-2', examType: 'FULL_MOUTH', createdAt: '2026-07-14T09:00:00.000Z' },
  { id: 'pe-1', examType: 'FULL_MOUTH', createdAt: '2026-01-10T09:00:00.000Z' },
];
const PERIO_DETAIL = {
  summary: { stage: 'Stage III', bopPercent: 42.5, maxPocketMm: 7, maxCalMm: 5, worstFurcation: 'II' },
};

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /teeth': { body: REFERENCE },
    'GET /patients/p-1/odontogram': { body: CHART },
    'GET /patients/p-1/perio-exams': { body: [] },
    ...extra,
  } as never;
}

const getsTo = (url: string) => apiCalls.filter((c) => c.method === 'GET' && c.url === url);

/** Click a tooth and pick a condition from the portalled menu. */
async function chartTooth(title: string, conditionLabel: string) {
  const user = userEvent.setup();
  await user.click(screen.getByTitle(title));
  const menu = await screen.findByRole('menu');
  // Scoped: the legend below the chart carries the same condition labels.
  await user.click(within(menu).getByText(conditionLabel));
}

describe('the DMFT index is the server’s, not a recount of what is on screen', () => {
  it('shows the counts the page could not have derived from the chart it holds', async () => {
    mockApi(stubs());
    renderPage(<DentalPage />);
    await screen.findByText('DMFT 4');

    expect(screen.getByText('Decayed 1')).toBeInTheDocument();
    // An implant. Counting teeth whose condition literally reads "missing"
    // gives 0 here, and DMFT is what a caries-burden decision is made on.
    expect(screen.getByText('Missing 1')).toBeInTheDocument();
    // A crown and a root canal. Same trap: neither says "filled".
    expect(screen.getByText('Filled 2')).toBeInTheDocument();
    // 32 teeth minus the 4 that count. The page only ever received 5 records,
    // so it has no denominator of its own to compute this from.
    expect(screen.getByText('Sound 28')).toBeInTheDocument();
  });

  it('reloads the chart after a write, so the tooth and the index both move', async () => {
    let n = 0;
    const after = {
      ...CHART,
      teeth: [...CHART.teeth.filter((t) => t.fdi !== '36'), tooth('36', 'caries')],
      dmft: { decayed: 2, missing: 1, filled: 1, dmft: 4, soundTeeth: 28 },
    };
    mockApi(stubs({
      'GET /patients/p-1/odontogram': () => ({ body: n++ === 0 ? CHART : after }),
      'POST /odontogram/teeth': { status: 201, body: { id: 't-1' } },
    }));
    renderPage(<DentalPage />);
    await screen.findByText('Decayed 1');

    await chartTooth('36 · crown', 'Caries (decayed)');

    // A chart that keeps showing the old condition invites the same click
    // again, and the second click is what puts a duplicate finding on a tooth.
    expect(await screen.findByTitle('36 · caries')).toBeInTheDocument();
    expect(await screen.findByText('Decayed 2')).toBeInTheDocument();
    expect(screen.queryByText('Decayed 1')).toBeNull();
  });

  it('shows a refused write and leaves the tooth as the server still has it', async () => {
    mockApi(stubs({
      'POST /odontogram/teeth': {
        status: 403,
        body: nestError(403, 'Feature not enabled: dental.core'),
      },
    }));
    renderPage(<DentalPage />);
    await screen.findByText('DMFT 4');

    await chartTooth('36 · crown', 'Caries (decayed)');

    // The refusal has to be on screen and the tooth has to still read `crown`.
    // Silently keeping the old condition is indistinguishable from a chart that
    // took the change — and the note in the record says crown either way.
    expect(await screen.findByText(/not part of your current plan/)).toBeInTheDocument();
    expect(screen.getByTitle('36 · crown')).toBeInTheDocument();
    expect(screen.queryByTitle('36 · caries')).toBeNull();
    // Nothing was refetched, because nothing was written.
    expect(getsTo('/patients/p-1/odontogram')).toHaveLength(1);
  });
});

describe('charting a tooth', () => {
  it('posts the tooth that was clicked and the condition that was picked', async () => {
    mockApi(stubs({ 'POST /odontogram/teeth': { status: 201, body: { id: 't-1' } } }));
    renderPage(<DentalPage />);
    await screen.findByText('DMFT 4');

    await chartTooth('26 · root_canal', 'Caries (decayed)');

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/odontogram/teeth');
      expect(post).toBeTruthy();
      // Wrong FDI here is a filling drilled into the wrong tooth on the wrong
      // side of the mouth. 26 is upper left; 16 is upper right.
      expect(post!.body).toEqual({ patientId: 'p-1', toothFdi: '26', condition: 'caries' });
    });
  });

  it('lays both arches out in FDI order so left and right are not mirrored', async () => {
    mockApi(stubs());
    renderPage(<DentalPage />);
    await screen.findByText('DMFT 4');

    const fdis = screen.getAllByTitle(/ · /).map((el) => el.textContent);
    // Upper arch as the clinician faces the patient: the patient's upper RIGHT
    // (quadrant 1) on the viewer's left, descending to the midline, then upper
    // left (quadrant 2) ascending away from it. A reversed row is how the wrong
    // side gets charted, and the chart is what the next appointment works from.
    expect(fdis.slice(0, 16)).toEqual([
      '18', '17', '16', '15', '14', '13', '12', '11',
      '21', '22', '23', '24', '25', '26', '27', '28',
    ]);
    expect(fdis.slice(16)).toEqual([
      '48', '47', '46', '45', '44', '43', '42', '41',
      '31', '32', '33', '34', '35', '36', '37', '38',
    ]);
    // The hover text a clinician checks a tooth against must match the record.
    expect(screen.getByTitle('16 · caries')).toBeInTheDocument();
    expect(screen.getByTitle('46 · implant')).toBeInTheDocument();
    // Teeth with no record are healthy, not blank.
    expect(screen.getByTitle('17 · healthy')).toBeInTheDocument();
  });
});

describe('the periodontal card', () => {
  it('summarises the most recent exam, not an older one', async () => {
    mockApi(stubs({
      'GET /patients/p-1/perio-exams': { body: PERIO_EXAMS },
      'GET /perio-exams/pe-2': { body: PERIO_DETAIL },
    }));
    renderPage(<DentalPage />);

    expect(await screen.findByText('Latest periodontal exam')).toBeInTheDocument();
    // The list comes back newest first. Reading from the wrong end labels a
    // six-month-old exam "latest" and hides a stage that has since progressed.
    expect(getsTo('/perio-exams/pe-2')).toHaveLength(1);
    expect(getsTo('/perio-exams/pe-1')).toHaveLength(0);
  });

  it('prints the server’s summary and does not colour a periodontitis stage as healthy', async () => {
    mockApi(stubs({
      'GET /patients/p-1/perio-exams': { body: PERIO_EXAMS },
      'GET /perio-exams/pe-2': { body: PERIO_DETAIL },
    }));
    renderPage(<DentalPage />);
    await screen.findByText('Latest periodontal exam');

    // Stage, BOP, worst pocket, worst CAL and worst furcation are all derived
    // server-side from the full six-point chart, which never reaches this page.
    expect(screen.getByText('BOP 42.5%')).toBeInTheDocument();
    expect(screen.getByText('Max pocket 7 mm')).toBeInTheDocument();
    expect(screen.getByText('Max CAL 5 mm')).toBeInTheDocument();
    expect(screen.getByText('Furcation II')).toBeInTheDocument();
    // Only "Health/Gingivitis" is the reassuring colour. A staged
    // periodontitis shown in green is a recall nobody books.
    expect(screen.getByText('Stage III').closest('.MuiChip-root')!.className).toMatch(/Warning/);
  });
});

describe('changing patient', () => {
  it('does not leave one patient’s chart or stage under another patient’s name', async () => {
    mockApi(stubs({
      'GET /patients/p-1/perio-exams': { body: PERIO_EXAMS },
      'GET /perio-exams/pe-2': { body: PERIO_DETAIL },
      'GET /patients/p-2/odontogram': {
        body: { patientId: 'p-2', teeth: [], dmft: { decayed: 0, missing: 0, filled: 0, dmft: 0, soundTeeth: 32 } },
      },
      'GET /patients/p-2/perio-exams': { body: [] },
    }));
    const user = userEvent.setup();
    renderPage(<DentalPage />);
    await screen.findByText('DMFT 4');
    await screen.findByText('Stage III');

    await user.click(screen.getByRole('combobox', { name: /Patient/ }));
    await user.click(within(await screen.findByRole('listbox')).getByText(/Bilal Ahmed/));

    // Bilal has never been charted. Ayesha's DMFT 4 and Stage III sitting under
    // his name is a treatment plan written for the wrong mouth.
    expect(await screen.findByText('DMFT 0')).toBeInTheDocument();
    expect(screen.queryByText('DMFT 4')).toBeNull();
    await waitFor(() => expect(screen.queryByText('Stage III')).toBeNull());
    expect(screen.queryByText('Latest periodontal exam')).toBeNull();
  });

  it('says the chart could not be loaded instead of showing an unblemished mouth', async () => {
    mockApi(stubs({
      'GET /patients/p-2/odontogram': { networkError: true },
      'GET /patients/p-2/perio-exams': { body: [] },
    }));
    const user = userEvent.setup();
    renderPage(<DentalPage />);
    await screen.findByText('DMFT 4');

    await user.click(screen.getByRole('combobox', { name: /Patient/ }));
    await user.click(within(await screen.findByRole('listbox')).getByText(/Bilal Ahmed/));

    // A failed load must not render as a finding. "DMFT 0 · Sound 32" is a
    // clean bill of dental health, and it is what an unreachable API used to
    // look like on every page in this app.
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
    expect(screen.queryByText('DMFT 4')).toBeNull();
    expect(screen.queryByText('DMFT 0')).toBeNull();
    expect(screen.queryByText('Sound 32')).toBeNull();
  });
});
