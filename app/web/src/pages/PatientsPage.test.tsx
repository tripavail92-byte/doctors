// Registering a patient — the first thing anyone does, and the entry point to
// every other workflow. There was no route to do it in the SPA at all.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientsPage from './PatientsPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const EXISTING = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111', gender: 'female', dob: '1990-01-01' },
];

async function openAndFill(fields: Record<string, string>) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Register patient/i }));
  const dialog = await screen.findByRole('dialog');
  for (const [label, value] of Object.entries(fields)) {
    await user.type(within(dialog).getByRole('textbox', { name: new RegExp(label) }), value);
  }
  return dialog;
}

describe('registering a patient', () => {
  it('will not submit until the identifying fields are present', async () => {
    mockApi({ 'GET /patients': { body: EXISTING } } as never);
    renderPage(<PatientsPage />);
    await screen.findByText('Ayesha Khan');

    const dialog = await openAndFill({ MRN: 'P-00042' });
    // MRN alone is not a patient. A record with no name and no phone cannot be
    // matched to the person in front of you or called back afterwards.
    expect(within(dialog).getByRole('button', { name: 'Register' })).toBeDisabled();

    const user = userEvent.setup();
    await user.type(within(dialog).getByRole('textbox', { name: /Full name/ }), 'Bilal Ahmed');
    await user.type(within(dialog).getByRole('textbox', { name: /Phone/ }), '+92 300 2222222');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Register' })).toBeEnabled());
  });

  it('posts what was typed and reloads the list', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /patients': { body: EXISTING },
      'POST /patients': { status: 201, body: { id: 'p-2', mrn: 'P-00042' } },
    } as never);
    renderPage(<PatientsPage />);
    await screen.findByText('Ayesha Khan');

    const dialog = await openAndFill({
      MRN: 'P-00042',
      'Full name': 'Bilal Ahmed',
      Phone: '+92 300 2222222',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/patients');
      expect(post!.body).toMatchObject({ mrn: 'P-00042', name: 'Bilal Ahmed', phone: '+92 300 2222222' });
    });
    // Two GETs: the initial load, and the reload after a successful register.
    await waitFor(() =>
      expect(apiCalls.filter((c) => c.method === 'GET' && c.url === '/patients')).toHaveLength(2),
    );
  });

  it('omits optional fields entirely rather than sending empty strings', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /patients': { body: EXISTING },
      'POST /patients': { status: 201, body: { id: 'p-2' } },
    } as never);
    renderPage(<PatientsPage />);
    await screen.findByText('Ayesha Khan');

    const dialog = await openAndFill({
      MRN: 'P-00043', 'Full name': 'Sana Riaz', Phone: '+92 300 3333333',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/patients');
      // An empty date of birth must not travel as "". The backend's validation
      // pipe coerces before it validates, and a blank where a date belongs is
      // how a patient ends up with an age the growth chart will happily plot.
      expect(post!.body).not.toHaveProperty('dob');
      expect(post!.body).not.toHaveProperty('gender');
    });
  });

  it('shows the server’s duplicate-MRN refusal and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const refusal =
      'MRN P-00001 already belongs to another patient in this clinic. ' +
      'Open that record instead of creating a second one.';
    mockApi({
      'GET /patients': { body: EXISTING },
      'POST /patients': { status: 409, body: nestError(409, refusal) },
    } as never);
    renderPage(<PatientsPage />);
    await screen.findByText('Ayesha Khan');

    const dialog = await openAndFill({
      MRN: 'P-00001', 'Full name': 'Someone Else', Phone: '+92 300 4444444',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));

    // The refusal must say WHERE the existing chart is. "Request failed" leads
    // someone to invent a new MRN, and that is how one person ends up with two
    // charts — the failure mode this whole constraint exists to prevent.
    expect(await screen.findByText(/already belongs to another patient/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not claim the API is down when the API answered', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /patients': { body: EXISTING },
      'POST /patients': { status: 400, body: nestError(400, 'phone must be a string') },
    } as never);
    renderPage(<PatientsPage />);
    await screen.findByText('Ayesha Khan');

    const dialog = await openAndFill({ MRN: 'P-9', 'Full name': 'X', Phone: '1' });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(/phone must be a string/i)).toBeInTheDocument();
    expect(screen.queryByText(/cannot reach the server/i)).toBeNull();
  });
});
