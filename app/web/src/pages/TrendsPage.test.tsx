// Trends — the chart a clinician reads a treatment decision off.
//
// The failure this file is aimed at: a chart that could not be LOADED and an eye
// that has never been MEASURED look identical the moment a page renders
// `data ?? []`. "No data recorded for this chart yet" under a blank axis is a
// clinical statement — it says nobody has ever recorded a pressure for this
// patient — and it must never be what a 404, a gated entitlement or a dead API
// looks like. The same sentence is correct and necessary when it is true, so
// both halves are asserted here; either one alone is worthless.
//
// The definitions below (axis, bands, target) are copied from the packs that
// ship them — pack.ophthalmology's IOP chart and pack.physiotherapy's NPRS
// chart. Nothing clinical is invented in this file, and the page is never asked
// to derive a threshold: `latestFlag` arrives from the server already resolved.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrendsPage from './TrendsPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const PATIENTS = [
  { id: 'p-1', name: 'Ayesha Khan', mrn: 'P-00001' },
  { id: 'p-2', name: 'Bilal Ahmed', mrn: 'P-00002' },
];

const IOP_DEF = {
  key: 'pack.ophthalmology:iop',
  title: 'Intraocular Pressure',
  unit: 'mmHg',
  yMin: 0,
  yMax: 40,
  splitByLaterality: true,
};
const NPRS_DEF = {
  key: 'pack.physiotherapy:nprs',
  title: 'Pain (NPRS)',
  unit: 'score',
  yMin: 0,
  yMax: 10,
  splitByLaterality: false,
};

const IOP_CHART = {
  definition: IOP_DEF,
  series: [
    {
      side: 'RIGHT',
      points: [
        { t: '2026-01-05T09:00:00.000Z', value: 18 },
        { t: '2026-03-09T09:00:00.000Z', value: 30 },
      ],
    },
    {
      side: 'LEFT',
      points: [
        { t: '2026-01-05T09:00:00.000Z', value: 14 },
        { t: '2026-03-09T09:00:00.000Z', value: 15 },
      ],
    },
  ],
  referenceBands: [
    { label: 'Normal', low: 10, high: 21, color: 'green' },
    { label: 'High', low: 21, high: 40, color: 'amber' },
  ],
  targetLines: [{ label: 'Target', value: 18 }],
  annotations: [
    { id: 'a-1', atDateTime: '2026-02-02T00:00:00.000Z', label: 'Started latanoprost', side: 'RIGHT' },
  ],
};

// One row per plotted series, as the server returns it. `latestFlag` is the
// server's classification against the definition's own bands — the page renders
// it, it does not compute it, and neither does this file.
const IOP_SUMMARY = [
  { side: 'RIGHT', latest: 30, min: 18, max: 30, delta: 12, direction: 'up', latestFlag: 'high' },
  { side: 'LEFT', latest: 15, min: 14, max: 15, delta: 1, direction: 'up', latestFlag: 'normal' },
];

const NPRS_CHART = {
  definition: NPRS_DEF,
  series: [{ side: null, points: [{ t: '2026-03-09T09:00:00.000Z', value: 6 }] }],
  referenceBands: [
    { label: 'Mild', low: 0, high: 3, color: 'green' },
    { label: 'Moderate', low: 4, high: 6, color: 'amber' },
    { label: 'Severe', low: 7, high: 10, color: 'red' },
  ],
  targetLines: [],
  annotations: [],
};

const IOP_URL = `/trends/${IOP_DEF.key}/patient/p-1`;
const NPRS_URL = `/trends/${NPRS_DEF.key}/patient/p-1`;

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /trends/definitions': { body: [IOP_DEF, NPRS_DEF] },
    [`GET ${IOP_URL}`]: { body: IOP_CHART },
    [`GET ${IOP_URL}/summary`]: { body: IOP_SUMMARY },
    ...extra,
  } as never;
}

/**
 * The block of latest/min/max/change cards belonging to one side.
 *
 * The side caption is the ONLY thing tying a number to an eye, and the same
 * caption text also appears in the chart legend, so the block is identified by
 * the stat cards it contains rather than by document order.
 */
function summaryBlock(sideLabel: string): HTMLElement {
  const block = screen
    .getAllByText(sideLabel)
    .map((el) => el.parentElement as HTMLElement)
    .find((el) => el.textContent?.includes('latest ·'));
  if (!block) throw new Error(`no summary block for "${sideLabel}"`);
  return block;
}

/** Pick an option from a MUI Select: by ROLE, and the listbox is portalled. */
async function pickFromSelect(name: RegExp, optionText: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(optionText));
}

describe('a chart that failed to load is not drawn as an empty one', () => {
  it('shows the server’s sentence and does not claim the patient has no readings', async () => {
    const refusal = 'Trend chart "pack.ophthalmology:iop" not found';
    mockApi(
      stubs({
        [`GET ${IOP_URL}`]: { status: 404, body: nestError(404, refusal) },
        [`GET ${IOP_URL}/summary`]: { status: 404, body: nestError(404, refusal) },
      }),
    );
    renderPage(<TrendsPage />);

    expect(await screen.findByText(/Trend chart .* not found/)).toBeInTheDocument();
    // These two sentences are assertions about the PATIENT. Printing either one
    // because a request failed tells a clinician this eye has never been
    // measured, and a pressure nobody looks for is a pressure nobody treats.
    expect(screen.queryByText(/No data recorded for this chart yet/i)).toBeNull();
    expect(screen.queryByText(/Nothing to plot/i)).toBeNull();
  });

  it('says the API is unreachable rather than showing a blank chart', async () => {
    mockApi(
      stubs({
        [`GET ${IOP_URL}`]: { networkError: true },
        [`GET ${IOP_URL}/summary`]: { networkError: true },
      }),
    );
    renderPage(<TrendsPage />);

    // A different instruction from "something broke": there is nothing to retry
    // until the API is up, and nothing on this screen can be trusted meanwhile.
    expect(await screen.findByText(/Cannot reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText(/No data recorded for this chart yet/i)).toBeNull();
  });

  it('does say so when the chart genuinely has no points, and raises no error', async () => {
    mockApi(
      stubs({
        [`GET ${IOP_URL}`]: { body: { ...IOP_CHART, series: [], annotations: [] } },
        [`GET ${IOP_URL}/summary`]: { body: [] },
      }),
    );
    renderPage(<TrendsPage />);
    await screen.findByText('Intraocular Pressure (mmHg)');

    // The counterpart to the two tests above. Without this one they could be
    // satisfied by a page that never says anything at all.
    expect(screen.getByText(/No data recorded for this chart yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing to plot/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('each eye is summarised on its own', () => {
  it('keeps the right eye’s numbers under the right eye', async () => {
    mockApi(stubs());
    renderPage(<TrendsPage />);
    await screen.findByText('Intraocular Pressure (mmHg)');

    const right = summaryBlock('Right (OD)');
    const left = summaryBlock('Left (OS)');
    expect(within(right).getByText('min · mmHg').parentElement).toHaveTextContent('18');
    expect(within(right).getByText('max · mmHg').parentElement).toHaveTextContent('30');
    expect(within(left).getByText('min · mmHg').parentElement).toHaveTextContent('14');
    // The reason the summary is one row per plotted series: a pooled figure, or
    // one eye's reading shown against the other, describes neither eye — and
    // 30 mmHg in the wrong column is either a laser nobody performs or a laser
    // performed on a healthy eye.
    expect(left).not.toHaveTextContent('30');
  });

  it('marks an out-of-band latest instead of captioning it like any other reading', async () => {
    mockApi(stubs());
    renderPage(<TrendsPage />);
    await screen.findByText('Intraocular Pressure (mmHg)');

    // The server flagged the right eye's 30 against the pack's own bands. If the
    // caption falls back to the unit, a reading outside the band reads exactly
    // like one inside it and the number has to be checked against a chart by eye.
    expect(within(summaryBlock('Right (OD)')).getByText('latest · high')).toBeInTheDocument();
    expect(within(summaryBlock('Left (OS)')).getByText('latest · mmHg')).toBeInTheDocument();
  });
});

describe('the chart on screen is the chart that was asked for', () => {
  it('loads the newly picked definition rather than leaving the first one up', async () => {
    mockApi(
      stubs({
        [`GET ${NPRS_URL}`]: { body: NPRS_CHART },
        [`GET ${NPRS_URL}/summary`]: { body: [{ side: null, latest: 6, min: 6, max: 6, delta: null, direction: 'na', latestFlag: 'normal' }] },
      }),
    );
    renderPage(<TrendsPage />);
    await screen.findByText('Intraocular Pressure (mmHg)');

    await pickFromSelect(/Chart/, /Pain \(NPRS\)/);

    // Two charts with different units and different bands. A title that does not
    // follow the request means a pain score is read as a pressure.
    expect(await screen.findByText('Pain (NPRS) (score)')).toBeInTheDocument();
    expect(screen.queryByText('Intraocular Pressure (mmHg)')).toBeNull();
    expect(apiCalls.some((c) => c.method === 'GET' && c.url === NPRS_URL)).toBe(true);
  });

  it('drops the previous patient’s numbers when the next patient’s chart fails', async () => {
    const gated = 'Feature not enabled: ophthalmology.core';
    mockApi(
      stubs({
        [`GET /trends/${IOP_DEF.key}/patient/p-2`]: { status: 403, body: nestError(403, gated) },
        [`GET /trends/${IOP_DEF.key}/patient/p-2/summary`]: { status: 403, body: nestError(403, gated) },
      }),
    );
    renderPage(<TrendsPage />);
    await screen.findByText('Intraocular Pressure (mmHg)');
    expect(within(summaryBlock('Right (OD)')).getByText('max · mmHg').parentElement).toHaveTextContent('30');

    await pickFromSelect(/Patient/, /Bilal Ahmed/);

    expect(await screen.findByText(/not part of your current plan/i)).toBeInTheDocument();
    // Ayesha's 30 mmHg must not still be on screen under Bilal's name. A number
    // belonging to another patient is worse than a blank panel: nothing about it
    // looks wrong, and it is acted on.
    await waitFor(() => expect(screen.queryByText('30')).toBeNull());
    expect(screen.queryByText('Right (OD)')).toBeNull();
  });
});

describe('annotations explain a change in the line', () => {
  it('shows the pinned note with its date and the side it applies to', async () => {
    mockApi(stubs());
    renderPage(<TrendsPage />);
    await screen.findByText('Intraocular Pressure (mmHg)');

    // Without the note, a fall between two visits looks spontaneous — the drug
    // that caused it is invisible, and so is the fact that it was one eye only.
    expect(screen.getByText('2026-02-02')).toBeInTheDocument();
    expect(screen.getByText(/Started latanoprost/, { selector: 'p' })).toHaveTextContent(
      'Started latanoprost (Right (OD))',
    );
  });
});
