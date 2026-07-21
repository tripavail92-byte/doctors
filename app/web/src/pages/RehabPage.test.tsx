// Physiotherapy: an episode of care, its range-of-motion banding, and the
// modality safety interlock.
//
// Two things on this page can hurt someone. A range-of-motion deficit is banded
// by the SERVER against a reference normal (and, when only a passive measure was
// taken, against a number that never reaches the screen at all) — so the page
// must print what came back, not arithmetic of its own. And a modality checked
// against the safety intake — electrotherapy over a pacemaker, heat over a
// malignancy — comes back as a 400 the page has to show, along with the
// senior-override path, rather than swallowing it and leaving a dead button.
//
// Fixtures use the server's own numbers: normals and ceilings are copied from
// app/backend/src/rehab/rom-reference.ts, refusal sentences from
// app/backend/src/rehab/engines/modality-safety.ts and rom.engine.ts. Nothing
// clinical is invented here.
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RehabPage from './RehabPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

// Driving MUI Selects and text fields through userEvent under jsdom costs
// hundreds of milliseconds a keystroke, and this page needs several per test.
// The default 5s budget passes alone and times out when the suite runs in
// parallel — a timeout nobody can reproduce is the fastest way to get a real
// failure ignored.
vi.setConfig({ testTimeout: 30000 });

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan' },
  { id: 'p-2', mrn: 'P-00002', name: 'Bilal Ahmed' },
];

// KNEE/FLEXION 135° normal, 150° ceiling; ANKLE/DORSIFLEXION 20°/30°.
const ROM_REFS = [
  { joint: 'KNEE', movement: 'FLEXION', normalDegrees: 135, maxDegrees: 150 },
  { joint: 'ANKLE', movement: 'DORSIFLEXION', normalDegrees: 20, maxDegrees: 30 },
];

const ROM = [
  { id: 'r-1', joint: 'KNEE', movement: 'FLEXION', laterality: 'LEFT', activeDegrees: 90, normalDegrees: 135, deficitPct: 33, deficitBand: 'red' },
  // The right knee was measured PASSIVELY only. The server bands on
  // `activeDegrees ?? passiveDegrees`, and the passive figure is not in this
  // payload — so 15% amber is a number the page cannot possibly derive.
  { id: 'r-2', joint: 'KNEE', movement: 'FLEXION', laterality: 'RIGHT', activeDegrees: null, normalDegrees: 135, deficitPct: 15, deficitBand: 'amber' },
  { id: 'r-3', joint: 'ANKLE', movement: 'DORSIFLEXION', laterality: 'LEFT', activeDegrees: 19, normalDegrees: 20, deficitPct: 5, deficitBand: 'none' },
];

const EPISODE_ROW = { id: 'e-1', diagnosis: 'Left knee OA', bodyRegion: 'knee', status: 'ACTIVE' };

function episode(over: Record<string, unknown> = {}) {
  return {
    ...EPISODE_ROW,
    safetyIntake: { pacemaker: true, pregnant: false },
    assessments: [{ id: 'a-1', rom: ROM }],
    sessions: [],
    ...over,
  };
}

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /rehab/rom-reference': { body: ROM_REFS },
    'GET /rehab/patients/p-1/episodes': { body: [EPISODE_ROW] },
    'GET /rehab/episodes/e-1': { body: episode() },
    ...extra,
  } as never;
}

const postsTo = (url: string) => apiCalls.filter((c) => c.method === 'POST' && c.url === url);

/** Open the picker by ROLE — getByLabelText walks past a MUI Select. */
async function pickFromSelect(name: RegExp, optionText: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(optionText));
}

/** The Modalities select is `multiple`, so its menu stays open after a pick. */
async function pickModality(m: RegExp) {
  const user = userEvent.setup();
  await pickFromSelect(/Modalities/, m);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

async function openEpisode(diagnosis = 'Left knee OA') {
  const user = userEvent.setup();
  await user.click(await screen.findByText(diagnosis));
  await screen.findByText('Range of motion');
}

/**
 * The joint/movement option is identified by its normal, not its name: `cap()`
 * explodes the reference's SCREAMING_CASE values into "K N E E F L E X I O N"
 * (reported separately). "(nl 135°)" is the stable part of the label.
 */
async function addRom(normalDegrees: string, degrees: string) {
  const user = userEvent.setup();
  await pickFromSelect(/Joint/, new RegExp(`nl ${normalDegrees}°`));
  await user.type(screen.getByRole('textbox', { name: /Active/ }), degrees);
  await user.click(screen.getByRole('button', { name: 'Add ROM' }));
}

describe('range of motion shows the loss the server measured it against', () => {
  it('prints the server’s percent and band, including one it could not have computed', async () => {
    mockApi(stubs());
    renderPage(<RehabPage />);
    await openEpisode();

    // 90° of a normal 135°. Both numbers stay on screen so the band can be
    // checked against the measurement rather than taken on trust.
    expect(screen.getByText('90° / 135°')).toBeInTheDocument();
    expect(screen.getByText('33% red')).toBeInTheDocument();

    // No active degrees were recorded for this row at all. A page doing its own
    // arithmetic would read the blank as 0 and shout 100% red — a total loss of
    // knee flexion, which is a referral, not a physio session.
    expect(screen.getByText('15% amber')).toBeInTheDocument();

    // 19 of 20 is a normal ankle. Banded as anything else it becomes a
    // treatment target that does not exist.
    expect(screen.getByText('5% none')).toBeInTheDocument();
  });

  it('colours the band so a red deficit cannot be read as a green one', async () => {
    mockApi(stubs());
    renderPage(<RehabPage />);
    await openEpisode();

    // The band word and the colour have to agree. A red loss rendered in the
    // success colour is the one mistake nobody double-checks.
    expect(screen.getByText('33% red').closest('.MuiChip-root')!.className).toMatch(/Error/);
    expect(screen.getByText('15% amber').closest('.MuiChip-root')!.className).toMatch(/Warning/);
    expect(screen.getByText('5% none').closest('.MuiChip-root')!.className).toMatch(/Success/);
  });

  it('shows the server’s refusal when a measurement is past the reference ceiling', async () => {
    mockApi(stubs({
      'POST /rehab/assessments/a-1/rom': {
        status: 400,
        body: nestError(400, 'Active ROM must be 0–150° (normal-referenced ceiling)'),
      },
    }));
    renderPage(<RehabPage />);
    await openEpisode();
    await addRom('135', '250');

    // A rejected ROM that looks accepted is worse than no ROM: the next
    // clinician reads the table, sees nothing new, and assumes it was not
    // measured — instead of that it was measured and thrown away.
    expect(await screen.findByText(/Active ROM must be 0–150°/)).toBeInTheDocument();
  });
});

describe('a ROM measurement lands in the episode’s assessment', () => {
  it('reuses the assessment the episode already has', async () => {
    mockApi(stubs({ 'POST /rehab/assessments/a-1/rom': { status: 201, body: { rom: { id: 'r-9' } } } }));
    renderPage(<RehabPage />);
    await openEpisode();
    await addRom('135', '115');

    await waitFor(() => {
      const post = postsTo('/rehab/assessments/a-1/rom')[0];
      expect(post).toBeTruthy();
      // Joint and movement come from the reference the picker was built from —
      // a mismatch here charts knee flexion under the ankle.
      expect(post.body).toMatchObject({ joint: 'KNEE', movement: 'FLEXION', activeDegrees: 115 });
    });
    // A second assessment would split one episode's ROM across two records, and
    // the deficit trend a physio discharges on is read off a single one.
    expect(postsTo('/rehab/episodes/e-1/assessments')).toHaveLength(0);
  });

  it('opens an assessment first when the episode has none', async () => {
    mockApi(stubs({
      'GET /rehab/episodes/e-1': { body: episode({ assessments: [] }) },
      'POST /rehab/episodes/e-1/assessments': { status: 201, body: { id: 'a-9' } },
      'POST /rehab/assessments/a-9/rom': { status: 201, body: { rom: { id: 'r-9' } } },
    }));
    renderPage(<RehabPage />);
    await openEpisode();
    await addRom('135', '115');

    // Without this the very first measurement of an episode — the baseline
    // every later comparison is made against — has nowhere to go.
    await waitFor(() => expect(postsTo('/rehab/assessments/a-9/rom')).toHaveLength(1));
    expect(postsTo('/rehab/episodes/e-1/assessments')).toHaveLength(1);
  });
});

describe('a contraindicated modality', () => {
  const BLOCK =
    'Modality contraindicated: Pacemaker contraindicates TENS/IFT/NMES — senior override required';

  it('shows the server’s sentence and records nothing', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /rehab/episodes/e-1/sessions': { status: 400, body: nestError(400, BLOCK) } }));
    renderPage(<RehabPage />);
    await openEpisode();
    await pickModality(/TENS/);
    await user.click(screen.getByRole('button', { name: 'Record session' }));

    // The physio has to be told WHICH intake answer blocked WHICH modality.
    // "Request failed" gets the electrode pads put on anyway.
    expect(await screen.findByText(BLOCK)).toBeInTheDocument();
    expect(screen.getByText('Contraindicated')).toBeInTheDocument();
    expect(postsTo('/rehab/episodes/e-1/sessions')).toHaveLength(1);
  });

  it('will not override without a reason, and sends the reason with the same modalities', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /rehab/episodes/e-1/sessions': (body: unknown) =>
        (body as { overrideBlock?: boolean }).overrideBlock
          ? { status: 201, body: { id: 's-1' } }
          : { status: 400, body: nestError(400, BLOCK) },
    }));
    renderPage(<RehabPage />);
    await openEpisode();
    await pickModality(/TENS/);
    await user.click(screen.getByRole('button', { name: 'Record session' }));
    await screen.findByText('Contraindicated');

    const override = screen.getByRole('button', { name: 'Override' });
    expect(override).toBeDisabled();
    // An override is the whole audit trail for treating over a hard stop. A
    // blank or whitespace reason leaves the record saying only that someone
    // clicked through it.
    await user.type(screen.getByRole('textbox', { name: /override reason/i }), '   ');
    expect(override).toBeDisabled();

    await user.clear(screen.getByRole('textbox', { name: /override reason/i }));
    await user.type(screen.getByRole('textbox', { name: /override reason/i }), 'Senior reviewed');
    await waitFor(() => expect(override).toBeEnabled());
    await user.click(override);

    await waitFor(() => {
      const posts = postsTo('/rehab/episodes/e-1/sessions');
      expect(posts).toHaveLength(2);
      // The overriding write must carry the SAME modalities the block was
      // raised against. If the selection were dropped, the override would
      // authorise a session that no longer contains what was overridden.
      expect(posts[1].body).toMatchObject({
        modalities: ['TENS'],
        overrideBlock: true,
        overrideReason: 'Senior reviewed',
      });
    });
  });

  it('does not dress an ordinary validation refusal up as a contraindication', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /rehab/episodes/e-1/sessions': { status: 400, body: nestError(400, 'painPre must not be greater than 10') },
    }));
    renderPage(<RehabPage />);
    await openEpisode();
    await pickModality(/TENS/);
    await user.click(screen.getByRole('button', { name: 'Record session' }));

    expect(await screen.findByText('painPre must not be greater than 10')).toBeInTheDocument();
    // If every refusal opened the override box, a physio would type a reason,
    // click Override, and believe they had authorised something. The override
    // path must appear only where a safety stop actually was.
    expect(screen.queryByRole('button', { name: 'Override' })).toBeNull();
    expect(screen.queryByText('Contraindicated')).toBeNull();
  });

  it('shows the intake answers that were ticked, and only those', async () => {
    mockApi(stubs());
    renderPage(<RehabPage />);
    await openEpisode();

    // Chips on the open episode, not the always-present checkboxes of the new-
    // episode form — so read the chip labels.
    const chips = Array.from(document.querySelectorAll('.MuiChip-label')).map((e) => e.textContent);
    // The physio picks modalities from this line. A pacemaker that is not shown
    // is a pacemaker nobody thinks about until the server refuses.
    expect(chips).toContain('Pacemaker');
    // Answered "no". Rendering it as a warning chip trains people to ignore the
    // row that also carries the real ones.
    expect(chips).not.toContain('Pregnant');
  });
});

describe('the pain score', () => {
  it('omits a blank score rather than recording it as 0', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /rehab/episodes/e-1/sessions': { status: 201, body: { id: 's-1' } } }));
    renderPage(<RehabPage />);
    await openEpisode();
    await pickModality(/EXERCISE/);
    await user.click(screen.getByRole('button', { name: 'Record session' }));

    await waitFor(() => expect(postsTo('/rehab/episodes/e-1/sessions')).toHaveLength(1));
    // "not asked" and "no pain" are different findings. A blank stored as 0
    // makes the pain trend start at the floor, and the session after it looks
    // like a deterioration that never happened.
    expect(postsTo('/rehab/episodes/e-1/sessions')[0].body).not.toHaveProperty('painPre');
  });

  it('records a score of 0 as 0', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /rehab/episodes/e-1/sessions': { status: 201, body: { id: 's-1' } } }));
    renderPage(<RehabPage />);
    await openEpisode();
    await pickModality(/EXERCISE/);
    await user.type(screen.getByRole('textbox', { name: /Pain/ }), '0');
    await user.click(screen.getByRole('button', { name: 'Record session' }));

    // The other half: a genuine 0 must survive. Dropping it as falsy loses the
    // pain-free session that the discharge decision rests on.
    await waitFor(() =>
      expect(postsTo('/rehab/episodes/e-1/sessions')[0].body).toHaveProperty('painPre', 0),
    );
  });
});

describe('changing patient', () => {
  it('closes the previous patient’s episode instead of leaving it open', async () => {
    mockApi(stubs({
      'GET /rehab/patients/p-2/episodes': {
        body: [{ id: 'e-2', diagnosis: 'Frozen shoulder', bodyRegion: 'shoulder', status: 'ACTIVE' }],
      },
    }));
    renderPage(<RehabPage />);
    await openEpisode();
    expect(screen.getByText('33% red')).toBeInTheDocument();

    await pickFromSelect(/Patient/, /Bilal Ahmed/);
    await screen.findByText('Frozen shoulder');

    // Ayesha's knee under Bilal's name, with a Record-session button wired to
    // her episode id. The banded deficit is the part that gets acted on.
    expect(screen.queryByText('33% red')).toBeNull();
    expect(screen.queryByText('Left knee OA')).toBeNull();
    expect(screen.getByText(/Start or select an episode/)).toBeInTheDocument();
  });

  it('files a new episode against the patient in the picker, carrying the ticked flags', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /rehab/patients/p-2/episodes': { body: [] },
      'POST /rehab/episodes': { status: 201, body: { id: 'e-9' } },
      'GET /rehab/episodes/e-9': { body: episode({ id: 'e-9', diagnosis: 'Frozen shoulder', assessments: [], safetyIntake: { pacemaker: true } }) },
    }));
    renderPage(<RehabPage />);
    await screen.findByText('Left knee OA');
    await pickFromSelect(/Patient/, /Bilal Ahmed/);
    await screen.findByText('No episodes yet.');

    await user.type(screen.getByRole('textbox', { name: /Diagnosis/ }), 'Frozen shoulder');
    await user.type(screen.getByRole('textbox', { name: /Body region/ }), 'shoulder');
    await user.click(screen.getByRole('checkbox', { name: 'Pacemaker' }));
    await user.click(screen.getByRole('checkbox', { name: 'Pregnant' }));
    await user.click(screen.getByRole('checkbox', { name: 'Pregnant' }));
    await user.click(screen.getByRole('button', { name: 'Start episode' }));

    await waitFor(() => {
      const post = postsTo('/rehab/episodes')[0];
      expect(post).toBeTruthy();
      // An episode of care filed on the wrong chart, and — worse — the intake
      // that gates every modality from then on attached to the wrong person.
      expect(post.body).toMatchObject({
        patientId: 'p-2',
        diagnosis: 'Frozen shoulder',
        bodyRegion: 'shoulder',
      });
      // Ticked then unticked is not an answer of "yes".
      expect((post.body as { safetyIntake: Record<string, boolean> }).safetyIntake).toEqual({ pacemaker: true });
    });
  });
});

describe('a discharged episode', () => {
  it('offers no way to add ROM or record a session, and still reads back', async () => {
    mockApi(stubs({ 'GET /rehab/episodes/e-1': { body: episode({ status: 'DISCHARGED' }) } }));
    renderPage(<RehabPage />);
    await openEpisode();

    // Treatment recorded against a closed episode is treatment nobody is
    // accountable for and nobody bills — and it re-opens a discharge that has
    // already been signed off.
    expect(screen.queryByRole('button', { name: 'Add ROM' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record session' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discharge' })).toBeNull();
    expect(screen.getByText(/no further records can be added/)).toBeInTheDocument();
    // Closed is not hidden: the measurements still have to be readable.
    expect(screen.getByText('33% red')).toBeInTheDocument();
  });
});
