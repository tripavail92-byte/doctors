// The fetch hook, and the input sanitiser that sits next to it.
//
// Both of these were shipped wrong, and both were wrong in the same direction:
// they produced something plausible instead of producing nothing. That is the
// worse failure — a blank panel is recoverable, a confident wrong number
// belonging to a different patient is not.
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { numericInput, useApi } from './useApi';
import { getFetchErrors, resetFetchErrors } from './fetchErrors';

describe('numericInput keeps the magnitude of what was typed', () => {
  it('does not turn 1.5 into 15', () => {
    // The old idiom stripped non-digits and concatenated the survivors. An
    // intraocular pressure of 1.5 mmHg is profound hypotony — a same-day
    // emergency — and 15 mmHg renders as a green "normal".
    expect(numericInput('1.5')).toBe('1.5');
  });

  it('does not turn a price of 12500.50 into 1250050', () => {
    expect(numericInput('12500.50')).toBe('12500.50');
  });

  it('drops letters and stray symbols without moving the decimal point', () => {
    expect(numericInput('12a.5b0')).toBe('12.50');
  });

  it('keeps only the first decimal point, so Number() cannot silently produce NaN', () => {
    expect(numericInput('1.2.3')).toBe('1.23');
  });

  it('refuses a negative rather than accepting one', () => {
    // None of the fields using this accept a negative — a minus sign that
    // survived would make "-5" a plausible-looking dose.
    expect(numericInput('-5')).toBe('5');
  });

  it('leaves an empty string empty, so the caller can tell "nothing typed" from "zero"', () => {
    expect(numericInput('')).toBe('');
    expect(numericInput('abc')).toBe('');
  });
});

/** Renders whatever useApi currently holds, so a test can read it. */
function Probe({ fetcher, deps }: { fetcher: () => Promise<string>; deps: unknown[] }) {
  const { data, loading } = useApi<string>(fetcher, deps);
  return (
    <div>
      <span data-testid="data">{data ?? '(null)'}</span>
      <span data-testid="loading">{String(loading)}</span>
    </div>
  );
}

describe('useApi does not show one subject’s answer under another’s name', () => {
  it('clears the previous result before fetching the next', async () => {
    resetFetchErrors();
    let resolve!: (v: string) => void;
    let which = 'first';
    const fetcher = () =>
      which === 'first'
        ? Promise.resolve('FIRST')
        : new Promise<string>((r) => {
            resolve = r;
          });

    const { rerender } = render(<Probe fetcher={fetcher} deps={['a']} />);
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('FIRST'));

    // Switch subject; the new request has not answered yet.
    which = 'second';
    rerender(<Probe fetcher={fetcher} deps={['b']} />);

    // THIS is the bug that showed "Bilal Ahmed" as the header over Sana Riaz's
    // Rs 16,000 balance, and 14 kg's dose (half the correct one) under a weight
    // of 28 kg. Every page renders `data ?? []`, so stale data is
    // indistinguishable from current data.
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('(null)'));

    resolve('SECOND');
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('SECOND'));
  });

  it('registers a failure centrally, so a page that ignores `error` cannot hide it', async () => {
    resetFetchErrors();
    const err = { response: { status: 403, data: { message: 'Feature not enabled: billing.core' } } };
    render(<Probe fetcher={() => Promise.reject(err)} deps={['x']} />);

    await waitFor(() => expect(getFetchErrors()).toHaveLength(1));
    expect(getFetchErrors()[0].status).toBe(403);
  });

  it('clears the registered failure when the same call later succeeds', async () => {
    resetFetchErrors();
    let fail = true;
    const fetcher = () =>
      fail ? Promise.reject({ response: { status: 500, data: {} } }) : Promise.resolve('OK');

    const { rerender } = render(<Probe fetcher={fetcher} deps={['1']} />);
    await waitFor(() => expect(getFetchErrors()).toHaveLength(1));

    fail = false;
    rerender(<Probe fetcher={fetcher} deps={['2']} />);
    await waitFor(() => expect(getFetchErrors()).toHaveLength(0));
  });

  it('removes the failure when the page unmounts', async () => {
    // Otherwise a banner about data you are no longer looking at follows you
    // to the next route.
    resetFetchErrors();
    const { unmount } = render(
      <Probe fetcher={() => Promise.reject({ response: { status: 500, data: {} } })} deps={['z']} />,
    );
    await waitFor(() => expect(getFetchErrors()).toHaveLength(1));
    unmount();
    await waitFor(() => expect(getFetchErrors()).toHaveLength(0));
  });
});
