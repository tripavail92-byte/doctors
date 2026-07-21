// The partogram — the WHO Labour Care Guide chart, driven the way a labour-room
// midwife drives it.
//
// Everything that makes this screen worth having is computed on the server: the
// LCG alert flags per entry. The page's whole job is to put them in front of
// someone and to keep the columns honest. Two failure modes are what these
// tests exist for:
//
//   - a flag raised at 08:00 that stops being visible once 12:00 is charted,
//   - an entry the server refused that looks like it went in.
//
// The numeric fields do NOT go through `numericInput`, the shared guard, so what
// reaches the request body is asserted field by field. Eight near-identical
// number boxes wired by hand is exactly where a copy-paste sends the maternal
// pulse in as the fetal heart rate.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartogramPage from './PartogramPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';
import type { Partogram, PartogramEntry, PregnancyEpisode } from '../api/types';

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111', gender: 'female', dob: '1994-03-02' },
];

function entry(over: Partial<PartogramEntry> & { id: string }): PartogramEntry {
  return {
    recordedAt: '2026-07-06T08:00:00.000Z',
    cervicalDilationCm: null,
    descentFifths: null,
    contractionsPer10Min: null,
    contractionDurationSec: null,
    fhrBpm: null,
    fhrDeceleration: null,
    amnioticFluid: null,
    caput: null,
    moulding: null,
    maternalPulse: null,
    bpSystolic: null,
    bpDiastolic: null,
    temperatureC: null,
    alertFlags: [],
    ...over,
  };
}

// 08:00 — meconium-stained liquor and a temperature of 38.2.
const EARLY = entry({
  id: 'en-1', recordedAt: '2026-07-06T08:00:00.000Z',
  cervicalDilationCm: 5, descentFifths: 3, fhrBpm: 140, contractionsPer10Min: 3,
  contractionDurationSec: 40, amnioticFluid: 'MECONIUM', maternalPulse: 88,
  bpSystolic: 118, bpDiastolic: 76, temperatureC: 38.2,
  alertFlags: ['LIQUOR_ABNORMAL', 'FEVER'],
});

// 12:00 — the fetal heart is down and the fever is still there.
const LATE = entry({
  id: 'en-2', recordedAt: '2026-07-06T12:00:00.000Z',
  cervicalDilationCm: 6, descentFifths: 3, fhrBpm: 95, contractionsPer10Min: 2,
  contractionDurationSec: null, amnioticFluid: 'CLEAR', maternalPulse: 124,
  bpSystolic: 90, bpDiastolic: 60, temperatureC: 38.6,
  alertFlags: ['FHR_ABNORMAL', 'FEVER'],
});

function partogram(over: Partial<Partogram> = {}): Partogram {
  return {
    id: 'pg-1',
    startedAt: '2026-07-06T08:00:00.000Z',
    parity: 2,
    membraneStatus: 'RUPTURED',
    status: 'ACTIVE',
    closedAt: null,
    companionPresent: true,
    entries: [EARLY, LATE],
    ...over,
  };
}

function episode(over: Partial<PregnancyEpisode> = {}): PregnancyEpisode {
  return {
    id: 'e-1',
    gravida: 3,
    para: 2,
    abortus: 0,
    eddFinal: '2026-07-10',
    eddMethod: 'LMP',
    rhFactor: 'POSITIVE',
    riskFlags: [],
    fetusCount: 1,
    status: 'ACTIVE',
    gaNow: { weeks: 39, days: 4, label: '39+4' },
    ancVisits: [],
    tdSchedule: [],
    partograms: [{ id: 'pg-1', status: 'ACTIVE', startedAt: '2026-07-06T08:00:00.000Z' }],
    ...over,
  };
}

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /obgyn/patients/p-1/episodes': { body: [{ id: 'e-1', status: 'ACTIVE', eddFinal: '2026-07-10', gaNow: null }] },
    'GET /obgyn/episodes/e-1': { body: episode() },
    'GET /obgyn/partograms/pg-1': { body: partogram() },
    ...extra,
  } as never;
}

/** The grid row whose first cell carries `label`. */
function gridRow(label: string): HTMLElement {
  return screen.getByText(label, { selector: 'td' }).closest('tr') as HTMLElement;
}

const cellText = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent);

async function openForm() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /Add entry/ }));
}

async function fill(fields: Record<string, string>) {
  const user = userEvent.setup();
  for (const [label, value] of Object.entries(fields)) {
    await user.type(screen.getByRole('spinbutton', { name: new RegExp(label) }), value);
  }
}

describe('the chart on screen is the labour happening now', () => {
  it('opens the ACTIVE labour record, not an earlier closed one', async () => {
    mockApi(stubs({
      'GET /obgyn/episodes/e-1': {
        body: episode({
          partograms: [
            { id: 'pg-old', status: 'CLOSED', startedAt: '2026-07-05T02:00:00.000Z' },
            { id: 'pg-1', status: 'ACTIVE', startedAt: '2026-07-06T08:00:00.000Z' },
          ],
        }),
      },
      'GET /obgyn/partograms/pg-old': { body: partogram({ id: 'pg-old', status: 'CLOSED', entries: [] }) },
    }));
    renderPage(<PartogramPage />);

    // Charting this labour onto yesterday's closed record loses the
    // observations and leaves the live labour looking unattended.
    await screen.findByText('Labour record');
    await waitFor(() => expect(apiCalls.some((c) => c.url === '/obgyn/partograms/pg-1')).toBe(true));
    expect(apiCalls.some((c) => c.url === '/obgyn/partograms/pg-old')).toBe(false);
  });

  it('keeps every entry’s observations under its own time column', async () => {
    mockApi(stubs());
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    // 08:00 first, 12:00 second. Columns that slide turn a falling fetal heart
    // into a normal one recorded four hours ago.
    expect(cellText(gridRow('Cervical dilation (cm)'))).toEqual(['Cervical dilation (cm)', '5', '6']);
    expect(cellText(gridRow('FHR (bpm)'))).toEqual(['FHR (bpm)', '140', '95']);
    expect(cellText(gridRow('Maternal pulse'))).toEqual(['Maternal pulse', '88', '124']);
    expect(cellText(gridRow('BP (mmHg)'))).toEqual(['BP (mmHg)', '118/76', '90/60']);
    expect(cellText(gridRow('Amniotic fluid'))).toEqual(['Amniotic fluid', 'MECONIUM', 'CLEAR']);
    // Contraction duration was not timed at 12:00. Not-timed must read as
    // not-timed, never as a blank that looks like a normal observation.
    expect(cellText(gridRow('Duration (s)'))).toEqual(['Duration (s)', '40', '—']);
  });

  it('offers no entry form on a labour record that has been closed', async () => {
    mockApi(stubs({ 'GET /obgyn/partograms/pg-1': { body: partogram({ status: 'DELIVERED', closedAt: '2026-07-06T15:00:00.000Z' }) } }));
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    // The record is append-only and closed. An observation added after the
    // baby is out belongs to no labour anyone is managing.
    expect(screen.queryByRole('button', { name: /Add entry/ })).toBeNull();
  });
});

describe('alert flags the server raised stay on screen', () => {
  it('lists the flags from every entry, not just the most recent one', async () => {
    mockApi(stubs());
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    // Meconium seen at 08:00 does not stop mattering because the 12:00 liquor
    // ran clear. This strip is the summary of the whole labour so far.
    expect(screen.getByText('LIQUOR ABNORMAL')).toBeInTheDocument();
    expect(screen.getByText('FHR ABNORMAL')).toBeInTheDocument();
    // Flagged at both times, listed once — a strip that repeats itself every
    // half hour becomes a strip nobody reads.
    expect(screen.getAllByText('FEVER')).toHaveLength(1);
  });

  it('shows the flags the server computed for the entry just saved, and re-reads the chart', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /obgyn/partograms/pg-1/entries': { status: 201, body: { alertFlags: ['FHR_ABNORMAL', 'PROLONGED_LABOUR'] } },
    }));
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    await openForm();
    await fill({ 'Dilation \\(cm\\)': '6', FHR: '95' });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    // The midwife who took the observation is the one who has to act on it. The
    // grading is done server-side; if the answer never comes back to the form
    // she has no way to know the entry she just made crossed a threshold.
    expect(await screen.findByText('Flags: FHR_ABNORMAL, PROLONGED_LABOUR')).toBeInTheDocument();
    // Cleared, or the same observation gets charted twice at two times.
    expect(screen.getByRole('spinbutton', { name: /FHR/ })).toHaveValue(null);
    await waitFor(() =>
      expect(apiCalls.filter((c) => c.method === 'GET' && c.url === '/obgyn/partograms/pg-1')).toHaveLength(2),
    );
  });
});

describe('adding an entry', () => {
  it('sends each observation under its own field, as a number', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /obgyn/partograms/pg-1/entries': { status: 201, body: { alertFlags: [] } } }));
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    await openForm();
    await fill({
      'Dilation \\(cm\\)': '6',
      Descent: '2',
      FHR: '95',
      'Contractions/10': '5',
      Duration: '45',
      'Maternal pulse': '124',
      'BP sys': '90',
      'BP dia': '60',
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/obgyn/partograms/pg-1/entries');
      expect(post).toBeTruthy();
      // Deliberately exact. Eight number boxes wired by hand is where a pulse of
      // 124 gets posted as the fetal heart rate — which reads as a normal FHR
      // and hides both the maternal tachycardia and the fetal bradycardia.
      expect(post!.body).toEqual({
        cervicalDilationCm: 6,
        descentFifths: 2,
        fhrBpm: 95,
        contractionsPer10Min: 5,
        contractionDurationSec: 45,
        maternalPulse: 124,
        bpSystolic: 90,
        bpDiastolic: 60,
      });
    });
  });

  it('omits observations nobody took rather than sending them as zero', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /obgyn/partograms/pg-1/entries': { status: 201, body: { alertFlags: [] } } }));
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    await openForm();
    await fill({ 'Dilation \\(cm\\)': '6' });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/obgyn/partograms/pg-1/entries');
      expect(post).toBeTruthy();
      // The backend's validation pipe coerces before it validates, so a blank
      // that travels as "" arrives as 0. fhrBpm 0 is a dead baby on the chart;
      // maternalPulse 0 is a dead mother. Not-taken must be absent.
      const body = post!.body as Record<string, unknown>;
      expect(body).toEqual({ cervicalDilationCm: 6 });
    });
  });

  it('sends the amniotic fluid that was picked, and nothing when none was', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /obgyn/partograms/pg-1/entries': { status: 201, body: { alertFlags: ['LIQUOR_ABNORMAL'] } } }));
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    await openForm();
    await user.click(screen.getByRole('combobox', { name: /Amniotic fluid/ }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('MECONIUM'));
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/obgyn/partograms/pg-1/entries');
      // Meconium is one of the two liquor findings the server turns into
      // LIQUOR_ABNORMAL. A picker that does not send its value silently
      // downgrades the chart.
      expect(post!.body).toEqual({ amnioticFluid: 'MECONIUM' });
    });
  });

  it('shows the server’s refusal and keeps the observations that were typed', async () => {
    const user = userEvent.setup();
    const refusal = 'fhrBpm must not be less than 60';
    mockApi(stubs({ 'POST /obgyn/partograms/pg-1/entries': { status: 400, body: nestError(400, refusal) } }));
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    await openForm();
    await fill({ 'Dilation \\(cm\\)': '6', FHR: '50' });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(await screen.findByText(/fhrBpm must not be less than 60/)).toBeInTheDocument();
    // Nothing was appended, so nothing may look appended: no flags chip, and
    // the typed values stay put. Retyping an FHR from memory is how the second
    // attempt carries a different number from the one that was counted.
    expect(screen.queryByText(/^Flags:/)).toBeNull();
    expect(screen.queryByText('No alerts')).toBeNull();
    expect(screen.getByRole('spinbutton', { name: /FHR/ })).toHaveValue(50);
    expect(screen.getByRole('spinbutton', { name: /Dilation/ })).toHaveValue(6);
  });

  it('clears a previous refusal once an entry does go in', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    mockApi(stubs({
      'POST /obgyn/partograms/pg-1/entries': () =>
        ++attempt === 1
          ? { status: 400, body: nestError(400, 'fhrBpm must not be less than 60') }
          : { status: 201, body: { alertFlags: [] } },
    }));
    renderPage(<PartogramPage />);
    await screen.findByText('Labour record');

    await openForm();
    await fill({ FHR: '50' });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    await screen.findByText(/must not be less than 60/);

    await user.clear(screen.getByRole('spinbutton', { name: /FHR/ }));
    await fill({ FHR: '140' });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    // A stale refusal sitting above a chart that did accept the entry is worse
    // than no message: it makes someone chart the same observation again.
    expect(await screen.findByText('No alerts')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/must not be less than 60/)).toBeNull());
  });
});

describe('starting the labour record', () => {
  it('starts it on the active episode with that woman’s parity', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /obgyn/episodes/e-1': { body: episode({ partograms: [] }) },
      'POST /obgyn/episodes/e-1/partograms': { status: 201, body: { id: 'pg-1' } },
    }));
    renderPage(<PartogramPage />);

    const dil = await screen.findByRole('spinbutton', { name: /Dilation at start/ });
    await user.clear(dil);
    await user.type(dil, '8');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/obgyn/episodes/e-1/partograms');
      expect(post).toBeTruthy();
      // Parity comes from the episode, not from a box someone retypes. The LCG
      // thresholds this chart is scored against differ for a first labour and a
      // later one, so a para-2 charted as para-0 is scored wrongly for the
      // whole labour.
      expect(post!.body).toEqual({ parity: 2, startDilationCm: 8, membraneStatus: 'INTACT' });
    });
    // The episode is re-read so the new record is picked up.
    await waitFor(() =>
      expect(apiCalls.filter((c) => c.method === 'GET' && c.url === '/obgyn/episodes/e-1')).toHaveLength(2),
    );
  });

  it('relays the server’s refusal to start rather than a generic failure', async () => {
    const user = userEvent.setup();
    const refusal = 'WHO LCG active-phase partogram starts at ≥5 cm dilation';
    mockApi(stubs({
      'GET /obgyn/episodes/e-1': { body: episode({ partograms: [] }) },
      'POST /obgyn/episodes/e-1/partograms': { status: 400, body: nestError(400, refusal) },
    }));
    renderPage(<PartogramPage />);

    const dil = await screen.findByRole('spinbutton', { name: /Dilation at start/ });
    await user.clear(dil);
    await user.type(dil, '3');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // "Failed to start" leaves someone clicking. The server's sentence says
    // what to do instead: this is not an active-phase labour yet.
    expect(await screen.findByText(/starts at ≥5 cm dilation/)).toBeInTheDocument();
  });

  it('does not offer to start a labour record on a pregnancy that is over', async () => {
    mockApi(stubs({
      'GET /obgyn/patients/p-1/episodes': { body: [{ id: 'e-1', status: 'COMPLETED', eddFinal: '2026-07-10', gaNow: null }] },
      'GET /obgyn/episodes/e-1': { body: episode({ status: 'COMPLETED', partograms: [] }) },
    }));
    renderPage(<PartogramPage />);

    expect(await screen.findByText(/No active partogram/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });
});
