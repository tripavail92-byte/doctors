import { useCallback, useEffect, useId, useState } from 'react';
import { clearFetchError, describeError, reportFetchError } from './fetchErrors';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Minimal data-fetching hook: runs `fetcher` on mount (and when `deps` change),
 * exposing {data, loading, error, reload}.
 *
 * A failure is ALSO reported to the shared registry in ./fetchErrors, which the
 * app shell renders. That is deliberate: 19 of 21 pages never read the `error`
 * this hook returns, so they rendered `data ?? []` and a failed fetch became an
 * empty table. With billing gated, the page showed "Rs 0 outstanding · 0
 * invoices" for a patient holding a paid PKR 15,000 invoice.
 *
 * Registering centrally means a page cannot silently swallow a failure even if
 * its author never checks `error`. Pages should still handle `error` for good
 * in-context messaging — this is the floor, not the ceiling.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Stable per-hook-instance key, so a call that keeps failing shows once rather
  // than stacking, and clears the moment it succeeds.
  const key = useId();

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => {
        if (!active) return;
        setData(res);
        clearFetchError(key);
      })
      .catch((err) => {
        if (!active) return;
        const { message, status } = describeError(err);
        setError(message);
        reportFetchError({ key, message, status });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  // Leaving the page must not leave its failure on screen.
  useEffect(() => () => clearFetchError(key), [key]);

  return { data, loading, error, reload };
}

/** Format an integer PKR amount as e.g. "PKR 118,840". */
export function pkr(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`;
}
