// The growth chart's verdict chip — and who is allowed to decide what it says.
//
// The number on this card is a z-score; the thing a clinician acts on is the WHO
// band printed beside it. That band belongs to the server (growth-engine
// `classify`), which knows that the cut-offs differ per indicator: BMI-for-age
// turns amber above z 1, height-for-age stays "Normal stature" all the way to
// z 3. The page once coloured the chip from a client-side |z| <= 2 rule, so the
// loudest element on the card contradicted the verdict printed next to it, in
// both directions. These tests exist to keep the decision on the server.
//
// The reference-curve numbers below are arbitrary plot geometry, not WHO data.
// Nothing here asserts a reference value; they exist only so the SVG has
// something to draw.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GrowthChartPage from './GrowthChartPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111', gender: 'female', dob: '2024-01-01' },
  { id: 'p-2', mrn: 'P-00002', name: 'Bilal Ahmed', phone: '+92 300 2222222', gender: 'male', dob: '2023-06-01' },
];

const CURVE_X = [0, 6, 12, 18, 24];
const refLine = (base: number) => CURVE_X.map((x) => ({ x, value: base + x / 6 }));

function curves(indicator: string, sex = 'female') {
  return {
    sex,
    indicator,
    xUnit: 'months',
    zLines: [-3, -2, 0, 2, 3],
    curves: {
      'z-3': refLine(1),
      'z-2': refLine(2),
      z0: refLine(3),
      'z+2': refLine(4),
      'z+3': refLine(5),
    },
  };
}

/** One plotted measurement, exactly as /patients/:id/growth returns it. */
function point(
  x: number,
  value: number,
  z: number | null,
  percentile: number | null,
  classification: string,
) {
  return { recordedAt: '2026-01-01T00:00:00.000Z', ageMonths: x, x, value, z, percentile, classification };
}

function series(indicator: string, points: ReturnType<typeof point>[], patientId = 'p-1') {
  return { patientId, sex: 'female', indicator, xUnit: 'months', count: points.length, points };
}

// Two points, the second of which is the one the chip describes.
const WFA = [point(6, 6.8, -0.2, 42, 'Normal weight'), point(12, 8.4, 0.4, 66, 'Normal weight')];

/**
 * Every request the page makes on mount.
 *
 * The curves call fires once before /patients has answered — at that moment the
 * page has no patient and therefore no sex — and again once the child is known.
 * Both are stubbed so an unstubbed-request failure can never be mistaken for the
 * behaviour under test.
 */
function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /growth/curves?indicator=wfa&sex=male': { body: curves('wfa', 'male') },
    'GET /growth/curves?indicator=wfa&sex=female': { body: curves('wfa') },
    'GET /patients/p-1/growth?indicator=wfa': { body: series('wfa', WFA) },
    ...extra,
  } as never;
}

/**
 * The tone MUI actually painted a chip. MUI stamps `MuiChip-color<Tone>` on the
 * root, so this reads back the colour a person in the room would see rather than
 * re-running the page's own colour function.
 */
function chipTone(label: string | RegExp): string {
  const root = screen.getByText(label).closest('.MuiChip-root');
  if (!root) throw new Error(`no chip around ${String(label)}`);
  const cls = [...root.classList].find((c) => c.startsWith('MuiChip-color'));
  return (cls ?? 'MuiChip-colorNONE').replace('MuiChip-color', '').toLowerCase();
}

async function pickPatient(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: /Patient/ }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(name));
}

describe('the chip colour is the server’s verdict, not a client rule', () => {
  it('paints "Risk of overweight" amber at z 1.48, where a |z| ≤ 2 rule would paint it green', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /growth/curves?indicator=bmifa&sex=female': { body: curves('bmifa') },
      'GET /patients/p-1/growth?indicator=bmifa': {
        body: series('bmifa', [point(10, 16.1, 0.9, 82, 'Normal'), point(12, 17.4, 1.48, 93, 'Risk of overweight')]),
      },
    }));
    renderPage(<GrowthChartPage />);
    await screen.findByText('Normal weight');

    await user.click(screen.getByRole('button', { name: 'BMI-for-age' }));

    // The reproduced case. A solid green chip beside the words "Risk of
    // overweight" is the version a parent is sent home on: the colour is the
    // salient element and it says the opposite of the text.
    expect(await screen.findByText('Risk of overweight')).toBeInTheDocument();
    expect(chipTone('Risk of overweight')).toBe('warning');
  });

  it('leaves "Normal stature" green at z 2.93, where a |z| ≤ 2 rule would raise a false alarm', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'GET /growth/curves?indicator=lhfa&sex=female': { body: curves('lhfa') },
      'GET /patients/p-1/growth?indicator=lhfa': {
        body: series('lhfa', [point(12, 82.4, 2.93, 99, 'Normal stature')]),
      },
    }));
    renderPage(<GrowthChartPage />);
    await screen.findByText('Normal weight');

    await user.click(screen.getByRole('button', { name: 'Length/Height-for-age' }));

    // Height-for-age is normal to z 3. An amber chip here starts a referral for
    // a tall, healthy child — the false positive costs a family a hospital trip.
    expect(await screen.findByText('Normal stature')).toBeInTheDocument();
    expect(chipTone('Normal stature')).toBe('success');
  });

  it('warns on a band it has never been taught rather than reading as normal', async () => {
    mockApi(stubs({
      'GET /patients/p-1/growth?indicator=wfa': {
        // A real server band this page names nowhere. If a future engine adds
        // another one, the failure mode must be "look at this", not silence.
        body: series('wfa', [point(12, 12.9, 3.4, 99, 'Very tall (review)')]),
      },
    }));
    renderPage(<GrowthChartPage />);

    expect(await screen.findByText('Very tall (review)')).toBeInTheDocument();
    expect(chipTone('Very tall (review)')).toBe('warning');
  });

  it('reds a severe band instead of merging it with the ordinary amber ones', async () => {
    mockApi(stubs({
      'GET /patients/p-1/growth?indicator=wfa': {
        body: series('wfa', [point(12, 5.1, -3.6, 1, 'Severely underweight')]),
      },
    }));
    renderPage(<GrowthChartPage />);

    // Severe acute malnutrition is admit-today, not review-next-visit. It has to
    // look different from "Underweight" on the same card.
    expect(await screen.findByText('Severely underweight')).toBeInTheDocument();
    expect(chipTone('Severely underweight')).toBe('error');
  });

  it('shows the classification in the server’s own words', async () => {
    mockApi(stubs({
      'GET /patients/p-1/growth?indicator=wfa': {
        body: series('wfa', [point(12, 7.1, -2.4, 1, 'Underweight')]),
      },
    }));
    renderPage(<GrowthChartPage />);

    // Not a paraphrase and not a re-derivation from z: the words on the chip are
    // the words in the chart note and in the referral.
    expect(await screen.findByText('Underweight')).toBeInTheDocument();
    expect(screen.queryByText('Severely underweight')).toBeNull();
  });

  it('keeps the z-score chip colourless so only the classification raises alarm', async () => {
    mockApi(stubs({
      'GET /patients/p-1/growth?indicator=wfa': {
        body: series('wfa', [point(12, 12.9, 2.4, 99, 'Above normal (assess weight-for-length)')]),
      },
    }));
    renderPage(<GrowthChartPage />);
    // Anchored: the same z also appears in each plotted point's SVG tooltip.
    await screen.findByText(/^z 2\.4 /);

    // Two coloured chips side by side is how the contradiction happened. The
    // number is a number; the band carries the alarm.
    expect(chipTone(/^z 2\.4 /)).toBe('default');
  });

  it('shows no verdict at all when the server could not score any measurement', async () => {
    mockApi(stubs({
      'GET /patients/p-1/growth?indicator=wfa': {
        body: series('wfa', [
          // What /patients/:id/growth returns for a child outside the reference
          // tables (or with no date of birth): z null, and a placeholder band.
          point(300, 61, null, null, 'no-reference-data'),
        ]),
      },
    }));
    renderPage(<GrowthChartPage />);
    await screen.findByRole('img', { name: 'growth chart' });

    // "z null · nullᵗʰ pct" beside a coloured chip would be read as a real
    // result. There is no result; the page must say nothing rather than
    // something meaningless.
    expect(screen.queryByText(/ᵗʰ pct/)).toBeNull();
    expect(screen.queryByText(/^z null/)).toBeNull();
    expect(screen.queryByText('no-reference-data')).toBeNull();
  });
});

describe('the chart is drawn against the right child', () => {
  it('asks for the reference curves of the selected child’s own sex', async () => {
    mockApi(stubs({
      'GET /growth/curves?indicator=wfa&sex=male': { body: curves('wfa', 'male') },
      'GET /patients/p-2/growth?indicator=wfa': { body: series('wfa', WFA, 'p-2') },
    }));
    renderPage(<GrowthChartPage />);
    await screen.findByText('Normal weight');

    const lastCurves = () => apiCalls.filter((c) => c.url.startsWith('/growth/curves')).slice(-1)[0]?.url;

    // Boys' and girls' WHO curves differ. Plotting a girl on the boys' lines
    // moves the whole reference frame under her points, so the picture disagrees
    // with the z-score printed above it.
    await waitFor(() => expect(lastCurves()).toBe('/growth/curves?indicator=wfa&sex=female'));

    await pickPatient(/Bilal Ahmed/);
    await waitFor(() => expect(lastCurves()).toBe('/growth/curves?indicator=wfa&sex=male'));
    await waitFor(() =>
      expect(apiCalls.some((c) => c.url === '/patients/p-2/growth?indicator=wfa')).toBe(true),
    );
  });
});

describe('a failed load is not reported as an empty chart', () => {
  it('shows why the series could not be read instead of "No measurements to plot"', async () => {
    mockApi(stubs({
      'GET /patients/p-1/growth?indicator=wfa': {
        status: 403,
        body: nestError(403, 'Feature not enabled: pack.pediatrics'),
      },
    }));
    renderPage(<GrowthChartPage />);

    // "No measurements to plot" is a clinical statement — it says this child has
    // never been weighed. A 403 says the plan is wrong. Someone acting on the
    // first one re-measures a child who was measured last week.
    expect(await screen.findByText(/not part of your current plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/No measurements to plot/i)).toBeNull();
  });
});
