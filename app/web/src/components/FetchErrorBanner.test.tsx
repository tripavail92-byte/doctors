// The banner that stops an empty table from reading as "there is nothing here".
//
// The first version of the store behind this component returned a fresh array
// from its useSyncExternalStore snapshot. React saw a change on every render,
// threw "Maximum update depth exceeded", and EVERY ROUTE rendered blank —
// because this component is mounted in the app shell, above the outlet. It got
// through typecheck and was found only by loading a page. The render test below
// is the cheap thing that would have caught it.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FetchErrorBanner from './FetchErrorBanner';
import { reportFetchError, resetFetchErrors } from '../api/fetchErrors';

beforeEach(() => resetFetchErrors());

describe('FetchErrorBanner', () => {
  it('renders without looping when there are errors to show', () => {
    reportFetchError({ key: 'a', message: 'Server error', status: 500 });
    // If the snapshot identity regresses, this render throws "Maximum update
    // depth exceeded" rather than returning.
    expect(() => render(<FetchErrorBanner />)).not.toThrow();
  });

  it('shows nothing at all when there is nothing wrong', () => {
    const { container } = render(<FetchErrorBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('separates a plan boundary from a fault, because they need different actions', () => {
    reportFetchError({ key: 'gated', message: 'Feature not enabled: billing.core', status: 403 });
    reportFetchError({ key: 'broken', message: 'Server error', status: 500 });
    render(<FetchErrorBanner />);

    // A 403 is not a fault. Telling the user to retry sends them round a loop
    // that cannot succeed; they need to talk to whoever owns the subscription.
    expect(screen.getByText('Not included in your plan')).toBeInTheDocument();
    expect(screen.getByText('Some data on this page could not be loaded')).toBeInTheDocument();
  });

  it('warns explicitly that an empty list below may not mean empty', () => {
    reportFetchError({ key: 'broken', message: 'Server error', status: 500 });
    render(<FetchErrorBanner />);
    // The exact sentence matters: it is the one that stops a receptionist
    // reading "Rs 0 outstanding · 0 invoices" as a financial fact.
    expect(screen.getByText(/do not treat an empty list as/i)).toBeInTheDocument();
  });

  it('shows a plan boundary alone without the fault wording', () => {
    reportFetchError({ key: 'gated', message: 'Feature not enabled: imaging.core', status: 403 });
    render(<FetchErrorBanner />);
    expect(screen.getByText('Not included in your plan')).toBeInTheDocument();
    expect(screen.queryByText('Some data on this page could not be loaded')).toBeNull();
  });
});
