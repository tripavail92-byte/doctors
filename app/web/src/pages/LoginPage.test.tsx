// The login screen, and the credentials it must not hand out.
//
// The deployed page displayed "Demo: owner@glowderma.pk · Password123!" under
// the form and prefilled both fields with it. That published a working login for
// a clinic system to anyone who loaded the page — and it kept displaying the old
// password after the seed's had been changed, so it was wrong as well as unsafe.
//
// Seen in a screenshot of the live deployment, not by any check. LoginPage was
// one of six pages with no tests at all.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import LoginPage from './LoginPage';
import { AuthProvider } from '../auth/AuthContext';
import { mockApi, renderPage } from '../test/api-harness';

const show = () =>
  renderPage(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );

const DEMO_EMAIL = 'owner@glowderma.pk';
const OLD_PASSWORD = 'Password123!';

// `import.meta.env.DEV` gates the hint. Under vitest that object is backed by
// process.env, which rejects defineProperty — so use vitest's own stub, which
// special-cases DEV/PROD/MODE.
function withDev(dev: boolean, fn: () => void) {
  vi.stubEnv('DEV', dev);
  try {
    fn();
  } finally {
    vi.unstubAllEnvs();
  }
}

beforeEach(() => mockApi({} as never));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('the deployed login screen gives nothing away', () => {
  it('does not print a password anywhere on the page', () => {
    withDev(false, () => {
      show();
      expect(screen.queryByText(new RegExp(OLD_PASSWORD.replace(/[!]/g, '\\!')))).toBeNull();
      expect(document.body.textContent).not.toContain(OLD_PASSWORD);
    });
  });

  it('does not prefill the email or the password', () => {
    withDev(false, () => {
      show();
      // A form that fills itself in is a form that tells everyone what to type.
      expect(screen.getByLabelText(/Email/i)).toHaveValue('');
      expect(screen.getByLabelText(/Password/i)).toHaveValue('');
    });
  });

  it('does not name the demo account either', () => {
    withDev(false, () => {
      show();
      // Half the credential is still half the credential, and it names the
      // tenant owner of whatever clinic this instance belongs to.
      expect(document.body.textContent).not.toContain(DEMO_EMAIL);
    });
  });
});

describe('local development keeps its convenience', () => {
  it('prefills and shows the hint when DEV', () => {
    withDev(true, () => {
      show();
      expect(screen.getByLabelText(/Email/i)).toHaveValue(DEMO_EMAIL);
      expect(document.body.textContent).toContain(OLD_PASSWORD);
    });
  });
});
