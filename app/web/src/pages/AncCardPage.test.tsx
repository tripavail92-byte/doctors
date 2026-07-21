// The antenatal card, driven the way a midwife drives it.
//
// The card is the only place a pregnancy's history is assembled, and almost
// everything on it is computed by the server: the risk flags, the per-visit
// alert flags, the severity of the latest visit. The page's job is to show all
// of that without editing it, and to be honest about what happened when a visit
// is refused. Those are the two ways this screen hurts someone: a flag the
// server raised and the page swallowed, and a visit the server rejected that
// looks recorded.
//
// The numeric fields here are raw `type="number"` inputs — they do NOT go
// through `numericInput`, the shared guard the rest of the app uses. So the
// magnitude assertions below are load-bearing: nothing else in the codebase is
// standing between a typed "62.5" and the request body.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AncCardPage from './AncCardPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';
import type { AncVisit, PregnancyEpisode } from '../api/types';

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111', gender: 'female', dob: '1994-03-02' },
  { id: 'p-2', mrn: 'P-00002', name: 'Sana Riaz', phone: '+92 300 2222222', gender: 'female', dob: '1996-07-11' },
];

function visit(over: Partial<AncVisit> & { id: string }): AncVisit {
  return {
    visitDate: '2026-05-04',
    contactNumber: 1,
    gaWeeks: 26,
    gaDays: 0,
    weightKg: null,
    bpSystolic: null,
    bpDiastolic: null,
    fundalHeightCm: null,
    fhrBpm: null,
    presentation: null,
    urineAlbumin: null,
    hbGdl: null,
    oedema: null,
    dangerSigns: [],
    alertFlags: [],
    nextVisitDate: null,
    ...over,
  };
}

const BOOKING = visit({
  id: 'v-1', visitDate: '2026-05-04', contactNumber: 1, gaWeeks: 26,
  weightKg: 58, bpSystolic: 118, bpDiastolic: 76, hbGdl: 11.2, fhrBpm: 142,
  presentation: 'CEPHALIC', urineAlbumin: 'NIL', fundalHeightCm: 26,
});

// The visit that matters: the server flagged it severe.
const SEVERE_VISIT = visit({
  id: 'v-2', visitDate: '2026-07-06', contactNumber: 4, gaWeeks: 35,
  weightKg: 64, bpSystolic: 170, bpDiastolic: 110, hbGdl: 6.8, fhrBpm: null,
  presentation: 'CEPHALIC', urineAlbumin: 'PLUS_3', fundalHeightCm: 33,
  alertFlags: ['SEVERE_HTN', 'PRE_ECLAMPSIA_SUSPECT', 'SEVERE_ANEMIA'],
});

function episode(over: Partial<PregnancyEpisode> = {}): PregnancyEpisode {
  return {
    id: 'e-1',
    gravida: 3,
    para: 1,
    abortus: 1,
    eddFinal: '2026-08-14',
    eddMethod: 'LMP',
    rhFactor: 'NEGATIVE',
    riskFlags: ['RH_NEGATIVE', 'GDM'],
    fetusCount: 1,
    status: 'ACTIVE',
    gaNow: { weeks: 35, days: 2, label: '35+2' },
    ancVisits: [BOOKING, SEVERE_VISIT],
    tdSchedule: [
      { dose: 1, status: 'GIVEN', dueDate: null },
      { dose: 2, status: 'DUE', dueDate: '2026-07-20' },
    ],
    partograms: [],
    ...over,
  };
}

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /obgyn/patients/p-1/episodes': { body: [{ id: 'e-1', status: 'ACTIVE', eddFinal: '2026-08-14', gaNow: null }] },
    'GET /obgyn/episodes/e-1': { body: episode() },
    ...extra,
  } as never;
}

/** The row of the visit grid whose first cell carries `label`. */
function gridRow(label: string): HTMLElement {
  return screen.getByText(label, { selector: 'td' }).closest('tr') as HTMLElement;
}

const cellText = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent);

async function openForm() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /Record visit/ }));
}

async function fill(fields: Record<string, string>) {
  const user = userEvent.setup();
  for (const [label, value] of Object.entries(fields)) {
    await user.type(screen.getByRole('spinbutton', { name: new RegExp(label) }), value);
  }
}

describe('the card shown is this pregnancy’s card', () => {
  it('opens the ACTIVE episode, not whichever one the API listed first', async () => {
    mockApi(stubs({
      'GET /obgyn/patients/p-1/episodes': {
        body: [
          { id: 'e-old', status: 'COMPLETED', eddFinal: '2023-02-01', gaNow: null },
          { id: 'e-1', status: 'ACTIVE', eddFinal: '2026-08-14', gaNow: null },
        ],
      },
      'GET /obgyn/episodes/e-old': { body: episode({ id: 'e-old', gravida: 1, para: 0, abortus: 0, status: 'COMPLETED', ancVisits: [], riskFlags: [] }) },
    }));
    renderPage(<AncCardPage />);

    // Charting the current pregnancy onto a finished one loses the visit and
    // hides the current risk. The episode list is not ordered by the API.
    expect(await screen.findByText('G3 P1 A1')).toBeInTheDocument();
    await waitFor(() => expect(apiCalls.some((c) => c.url === '/obgyn/episodes/e-1')).toBe(true));
    expect(apiCalls.some((c) => c.url === '/obgyn/episodes/e-old')).toBe(false);
  });

  it('follows the patient picker to the selected woman’s episode', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /obgyn/patients/p-2/episodes': { body: [{ id: 'e-2', status: 'ACTIVE', eddFinal: '2026-12-01', gaNow: null }] },
      'GET /obgyn/episodes/e-2': { body: episode({ id: 'e-2', gravida: 1, para: 0, abortus: 0, riskFlags: [], ancVisits: [] }) },
    }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    await user.click(screen.getByRole('combobox', { name: /Patient/ }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText(/Sana Riaz/));

    // Ayesha's severe pre-eclampsia banner must not still be on screen over
    // Sana's card. `useApi` clears data between subjects; this is the page-level
    // proof that the clearing actually reaches the render.
    expect(await screen.findByText('G1 P0 A0')).toBeInTheDocument();
    expect(screen.queryByText(/PRE ECLAMPSIA SUSPECT/)).toBeNull();
  });
});

describe('server-computed flags are shown, not swallowed', () => {
  it('states the latest visit’s severe flags and the BP that carried them', async () => {
    mockApi(stubs());
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    const banner = await screen.findByRole('alert');
    // A midwife scanning the card needs the reason and the number in one line.
    // If this banner is dropped, a BP of 170/110 with +3 protein is just three
    // more coloured cells in a grid of thirty.
    expect(banner).toHaveTextContent('SEVERE HTN');
    expect(banner).toHaveTextContent('PRE ECLAMPSIA SUSPECT');
    expect(banner).toHaveTextContent('BP 170/110');
  });

  it('does not raise the severe banner for a visit the server only flagged amber', async () => {
    mockApi(stubs({
      'GET /obgyn/episodes/e-1': {
        body: episode({ ancVisits: [BOOKING, visit({ id: 'v-3', bpSystolic: 138, bpDiastolic: 88, alertFlags: ['HTN', 'ANEMIA'] })] }),
      },
    }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    // Shouting on every visit is how the shouting stops being read.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the episode-level risk flags the server set', async () => {
    mockApi(stubs());
    renderPage(<AncCardPage />);

    // RH_NEGATIVE unshown is anti-D not given. These flags are the reason the
    // header strip exists; they are computed nowhere on the client.
    expect(await screen.findByText('RH NEGATIVE')).toBeInTheDocument();
    expect(screen.getByText('GDM')).toBeInTheDocument();
  });

  it('keeps every visit’s numbers under its own column, in visit order', async () => {
    mockApi(stubs());
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    // Booking first, latest last. If the columns ever slid, the booking Hb of
    // 11.2 would read as the current one and the 6.8 would disappear.
    expect(cellText(gridRow('BP (mmHg)'))).toEqual(['BP (mmHg)', '118/76', '170/110']);
    expect(cellText(gridRow('Hb (g/dL)'))).toEqual(['Hb (g/dL)', '11.2', '6.8']);
    expect(cellText(gridRow('Urine albumin'))).toEqual(['Urine albumin', 'NIL', 'PLUS_3']);
    // FHR was not taken at the latest visit. That must read as not-taken, never
    // as a number, and never as a blank cell that looks like a normal one.
    expect(cellText(gridRow('FHR (bpm)'))).toEqual(['FHR (bpm)', '142', '—']);
  });
});

describe('recording a visit', () => {
  it('sends the numbers that were typed, at the magnitude they were typed', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /obgyn/episodes/e-1/anc-visits': { status: 201, body: { alertFlags: [], severe: false } } }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    await openForm();
    await fill({ Weight: '62.5', 'BP sys': '170', 'BP dia': '110', Hb: '6.8' });
    await user.click(screen.getByRole('button', { name: 'Save visit' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/obgyn/episodes/e-1/anc-visits');
      expect(post).toBeTruthy();
      // These fields are not behind `numericInput`. A sanitiser that strips the
      // decimal point turns Hb 6.8 into 68 and weight 62.5 into 625 — both are
      // values the server's plausibility range would accept, and 68 g/dL does
      // not read as severe anaemia to anyone or anything downstream.
      expect(post!.body).toEqual({ weightKg: 62.5, bpSystolic: 170, bpDiastolic: 110, hbGdl: 6.8 });
    });
  });

  it('omits fields nobody filled in rather than sending them as zero', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /obgyn/episodes/e-1/anc-visits': { status: 201, body: { alertFlags: [], severe: false } } }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    await openForm();
    await fill({ 'BP sys': '120', 'BP dia': '80' });
    await user.click(screen.getByRole('button', { name: 'Save visit' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/obgyn/episodes/e-1/anc-visits');
      expect(post).toBeTruthy();
      // The backend's validation pipe coerces before it validates, so a blank
      // that travels as "" arrives as 0. hbGdl 0 is severe anaemia, fhrBpm 0 is
      // no fetal heart. A parameter that was not measured must be absent.
      const body = post!.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('hbGdl');
      expect(body).not.toHaveProperty('fhrBpm');
      expect(body).not.toHaveProperty('weightKg');
      expect(body).not.toHaveProperty('fundalHeightCm');
      expect(body).not.toHaveProperty('urineAlbumin');
      expect(body).not.toHaveProperty('presentation');
    });
  });

  it('shows the flags the server computed for the visit just saved, and reloads the card', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /obgyn/episodes/e-1/anc-visits': { status: 201, body: { alertFlags: ['SEVERE_HTN', 'PROTEINURIA'], severe: true } },
    }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    await openForm();
    await fill({ 'BP sys': '170', 'BP dia': '110' });
    await user.click(screen.getByRole('button', { name: 'Save visit' }));

    // The person who typed the BP is the person who has to act on it. Grading
    // happens on the server; if the answer never comes back to the form, the
    // midwife has to go and re-read the grid to find out what she just entered.
    expect(await screen.findByText('Flags: SEVERE_HTN, PROTEINURIA')).toBeInTheDocument();
    // Saved means gone from the form — a value left in the box gets saved twice.
    expect(screen.getByRole('spinbutton', { name: /BP sys/ })).toHaveValue(null);
    await waitFor(() =>
      expect(apiCalls.filter((c) => c.method === 'GET' && c.url === '/obgyn/episodes/e-1')).toHaveLength(2),
    );
  });

  it('says the visit was NOT saved when the server refuses, and keeps what was typed', async () => {
    const user = userEvent.setup();
    const refusal = 'bpSystolic must not be greater than 300';
    mockApi(stubs({ 'POST /obgyn/episodes/e-1/anc-visits': { status: 400, body: nestError(400, refusal) } }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    await openForm();
    await fill({ 'BP sys': '170', 'BP dia': '110', Hb: '6.8' });
    await user.click(screen.getByRole('button', { name: 'Save visit' }));

    expect(await screen.findByText(/bpSystolic must not be greater than 300/)).toBeInTheDocument();
    // The sentence has to contain the consequence. A refused visit that only
    // says "Bad Request" reads as noise, and a severe-hypertension BP that was
    // never written down is a woman nobody follows up.
    expect(screen.getByText(/the visit was NOT saved/i)).toBeInTheDocument();
    // And it must not clear the form: retyping a BP from memory is how the
    // second attempt ends up carrying a different number from the first.
    expect(screen.getByRole('spinbutton', { name: /BP sys/ })).toHaveValue(170);
    expect(screen.getByRole('spinbutton', { name: /Hb/ })).toHaveValue(6.8);
    expect(screen.queryByText(/^Flags:/)).toBeNull();
    expect(screen.queryByText('No alerts')).toBeNull();
  });

  it('distinguishes an unreachable API from a rejected visit', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /obgyn/episodes/e-1/anc-visits': { networkError: true } }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    await openForm();
    await fill({ 'BP sys': '170' });
    await user.click(screen.getByRole('button', { name: 'Save visit' }));

    // Different instruction: fix the value versus go and find whoever runs the
    // server. "Request failed" invites a retry loop that cannot work.
    expect(await screen.findByText(/Cannot reach the server/i)).toBeInTheDocument();
    expect(screen.getByText(/the visit was NOT saved/i)).toBeInTheDocument();
  });

  it('offers no way to add a visit to a pregnancy that is already over', async () => {
    mockApi(stubs({
      'GET /obgyn/patients/p-1/episodes': { body: [{ id: 'e-1', status: 'COMPLETED', eddFinal: '2026-08-14', gaNow: null }] },
      'GET /obgyn/episodes/e-1': { body: episode({ status: 'COMPLETED' }) },
    }));
    renderPage(<AncCardPage />);
    await screen.findByText('G3 P1 A1');

    // An antenatal visit appended after delivery belongs to no pregnancy at all.
    expect(screen.queryByRole('button', { name: /Record visit/ })).toBeNull();
  });
});

