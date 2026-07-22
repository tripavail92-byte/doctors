import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { mockApi, renderPage, nestError, apiCalls } from '../test/api-harness';
import TenantsPage from './TenantsPage';

const TWO_CLINICS = [
  { id: '1', name: 'Glow Derma', slug: 'glow-derma', edition: 'SPECIALTY', status: 'ACTIVE', patients: 337, users: 5, createdAt: '2026-01-01' },
  { id: '2', name: 'Derma Care', slug: 'derma-care', edition: 'CLINIC', status: 'ACTIVE', patients: 0, users: 1, createdAt: '2026-07-20' },
];

describe('TenantsPage', () => {
  beforeEach(() => {
    mockApi({ 'GET /platform/tenants': { body: TWO_CLINICS } });
  });

  it('shows every clinic with its edition and patient count', async () => {
    renderPage(<TenantsPage />);
    expect(await screen.findByText('Glow Derma')).toBeInTheDocument();
    expect(screen.getByText('Derma Care')).toBeInTheDocument();
    expect(screen.getByText('Specialty Clinic')).toBeInTheDocument();
    expect(screen.getAllByText('Clinic').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('337')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows a count summary', async () => {
    renderPage(<TenantsPage />);
    expect(await screen.findByText('2 clinics on the platform')).toBeInTheDocument();
  });

  it('shows an empty state when no clinics exist', async () => {
    mockApi({ 'GET /platform/tenants': { body: [] } });
    renderPage(<TenantsPage />);
    expect(await screen.findByText('No clinics on the platform yet.')).toBeInTheDocument();
  });

  it('opens the onboarding dialog', async () => {
    renderPage(<TenantsPage />);
    await screen.findByText('Glow Derma');
    await userEvent.click(screen.getByRole('button', { name: /onboard a clinic/i }));
    expect(screen.getByText('Onboard a new clinic')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /clinic name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /slug/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /owner email/i })).toBeInTheDocument();
  });

  it('disables Create until required fields are filled', async () => {
    renderPage(<TenantsPage />);
    await screen.findByText('Glow Derma');
    await userEvent.click(screen.getByRole('button', { name: /onboard a clinic/i }));
    const createBtn = screen.getByRole('button', { name: /create clinic/i });
    expect(createBtn).toBeDisabled();
  });

  it('posts the form and reloads on success', async () => {
    const created = {
      id: '3', name: 'New Clinic', slug: 'new-clinic', edition: 'CLINIC',
      status: 'ACTIVE', owner: { id: 'u1' }, facility: { id: 'f1', name: 'New Clinic' },
      entitlements: 11, packs: [],
    };
    mockApi({
      'GET /platform/tenants': { body: TWO_CLINICS },
      'POST /platform/tenants': { status: 201, body: created },
    });
    renderPage(<TenantsPage />);
    await screen.findByText('Glow Derma');
    await userEvent.click(screen.getByRole('button', { name: /onboard a clinic/i }));

    await userEvent.type(screen.getByRole('textbox', { name: /clinic name/i }), 'New Clinic');
    await userEvent.type(screen.getByRole('textbox', { name: /slug/i }), 'new-clinic');
    await userEvent.type(screen.getByRole('textbox', { name: /owner email/i }), 'doc@new.pk');
    await userEvent.type(screen.getByRole('textbox', { name: /owner name/i }), 'Dr New');
    // Password field is type="password", not a textbox role
    const pwField = screen.getByLabelText(/owner password/i);
    await userEvent.type(pwField, 'a-secure-long-pw');

    const createBtn = screen.getByRole('button', { name: /create clinic/i });
    expect(createBtn).toBeEnabled();
    await userEvent.click(createBtn);

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST');
      expect(post).toBeDefined();
      expect(post!.body).toMatchObject({
        name: 'New Clinic',
        slug: 'new-clinic',
        ownerEmail: 'doc@new.pk',
        ownerPassword: 'a-secure-long-pw',
      });
    });
  });

  it('shows the server error on duplicate slug', async () => {
    mockApi({
      'GET /platform/tenants': { body: TWO_CLINICS },
      'POST /platform/tenants': {
        status: 409,
        body: nestError(409, 'The slug "glow-derma" already belongs to another clinic.'),
      },
    });
    renderPage(<TenantsPage />);
    await screen.findByText('Glow Derma');
    await userEvent.click(screen.getByRole('button', { name: /onboard a clinic/i }));

    await userEvent.type(screen.getByRole('textbox', { name: /clinic name/i }), 'Duplicate');
    await userEvent.type(screen.getByRole('textbox', { name: /slug/i }), 'glow-derma');
    await userEvent.type(screen.getByRole('textbox', { name: /owner email/i }), 'x@x.pk');
    await userEvent.type(screen.getByRole('textbox', { name: /owner name/i }), 'Dr Dup');
    await userEvent.type(screen.getByLabelText(/owner password/i), 'a-long-password-here');

    await userEvent.click(screen.getByRole('button', { name: /create clinic/i }));

    expect(await screen.findByText(/already belongs to another clinic/i)).toBeInTheDocument();
  });

  it('shows an error when the list fetch fails', async () => {
    mockApi({
      'GET /platform/tenants': { status: 403, body: nestError(403, 'Forbidden') },
    });
    renderPage(<TenantsPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
