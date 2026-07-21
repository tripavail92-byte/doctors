// The patient record, and the one property that makes a chart different from
// every other screen: the reader draws conclusions from ABSENCE.
//
// "No medicines dispensed" is something a prescriber acts on. If a failed
// request can produce that sentence, the screen is not merely unhelpful, it is
// actively misleading — and this exact bug already shipped once, on Billing,
// where a 403 rendered as "Rs 0 outstanding · 0 invoices" for a patient holding
// a paid PKR 15,000 invoice.
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import PatientRecordPage from './PatientRecordPage';
import { mockApi, nestError } from '../test/api-harness';

const ID = 'p-1';
const PATIENT = {
  id: ID, mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111',
  gender: 'female', dob: '1990-01-01', createdAt: '2026-01-01T00:00:00.000Z',
};

/** Render at /patients/:id so useParams resolves. */
function renderRecord() {
  return render(
    <MemoryRouter initialEntries={[`/patients/${ID}`]}>
      <ThemeProvider theme={createTheme()}>
        <Routes>
          <Route path="/patients/:id" element={<PatientRecordPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function stubs(over: Record<string, unknown> = {}) {
  return {
    [`GET /patients/${ID}`]: { body: PATIENT },
    [`GET /patients/${ID}/encounters`]: { body: [] },
    [`GET /patients/${ID}/invoices`]: { body: [] },
    [`GET /pharmacy/patients/${ID}/dispenses`]: { body: [] },
    [`GET /lab/patients/${ID}/orders`]: { body: [] },
    [`GET /patients/${ID}/immunizations`]: { body: [] },
    ...over,
  } as never;
}

describe('a failed section is never mistaken for an empty one', () => {
  it('does not say "no medicines dispensed" when the pharmacy call failed', async () => {
    mockApi(stubs({
      [`GET /pharmacy/patients/${ID}/dispenses`]: { status: 500, body: nestError(500, 'Internal server error') },
    }));
    renderRecord();
    await screen.findByText('Ayesha Khan');

    // The sentence a prescriber would act on must NOT appear.
    await waitFor(() =>
      expect(screen.queryByText(/No medicines dispensed to this patient/i)).toBeNull(),
    );
    expect(await screen.findByText(/this is not the same as the patient having none/i)).toBeInTheDocument();
  });

  it('says a gated module may be hiding records rather than showing none', async () => {
    mockApi(stubs({
      [`GET /patients/${ID}/invoices`]: { status: 403, body: nestError(403, 'Feature not enabled: billing.core') },
    }));
    renderRecord();
    await screen.findByText('Ayesha Khan');

    // A 403 is not a fault and not an empty result. There may well be invoices;
    // this installation cannot see them.
    expect(await screen.findByText(/Not included in this clinic's plan/i)).toBeInTheDocument();
    expect(screen.queryByText('No invoices for this patient.')).toBeNull();
  });

  it('says "none recorded" only when the server actually answered with none', async () => {
    mockApi(stubs());
    renderRecord();
    await screen.findByText('Ayesha Khan');
    expect(await screen.findByText(/No medicines dispensed to this patient/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  // The loading-is-not-emptiness case is exercised exhaustively in
  // components/RecordSection.test.tsx, where all four states can be driven
  // directly. Asserting it here would depend on the order two unrelated
  // requests happen to settle in.
});

describe('the patient header', () => {
  it('refuses to render any section when the patient itself could not be loaded', async () => {
    mockApi(stubs({ [`GET /patients/${ID}`]: { status: 404, body: nestError(404, 'Patient not found') } }));
    renderRecord();

    // Sections under an unknown name is how a note ends up on the wrong chart.
    expect(await screen.findByText(/could not be confirmed which patient it would belong to/i)).toBeInTheDocument();
    expect(screen.queryByText('Medicines dispensed')).toBeNull();
    expect(screen.queryByText('Visits')).toBeNull();
  });

  it('flags a missing date of birth, because age-based rules read it', async () => {
    mockApi(stubs({ [`GET /patients/${ID}`]: { body: { ...PATIENT, dob: null } } }));
    renderRecord();
    // Paediatric dosing and growth z-scores are computed from this. A blank
    // one silently changes what they produce, so it is stated, not hidden.
    expect(await screen.findByText('No date of birth on file')).toBeInTheDocument();
  });
});

describe('dispensing history', () => {
  it('shows every batch a line drew from, not just the first', async () => {
    mockApi(stubs({
      [`GET /pharmacy/patients/${ID}/dispenses`]: {
        body: [{
          id: 'd1', receiptNumber: 'RX-2026-0001', createdAt: '2026-07-01T00:00:00.000Z', totalPkr: 400,
          items: [{
            id: 'i1', name: 'Paracetamol 500mg tab', quantity: 80, batchNo: 'B1',
            batches: [{ batchNo: 'B1', quantity: 30 }, { batchNo: 'B2', quantity: 50 }],
          }],
        }],
      },
    }));
    renderRecord();
    // A receipt reading "80 × B1" for 30 from B1 and 50 from a recalled B2 is
    // wrong in the direction that hides the risk.
    expect(await screen.findByText(/B1 ×30, B2 ×50/)).toBeInTheDocument();
  });
});
