import { useCallback, useEffect, useId, useState } from 'react';
import { clearFetchError, describeError, reportFetchError } from './fetchErrors';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /**
   * HTTP status behind `error`, where there was one; undefined for an
   * unreachable server. A caller needs this to tell a plan boundary (403) from
   * a fault, because those ask the reader to do different things.
   */
  status?: number;
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
  const [status, setStatus] = useState<number | undefined>(undefined);
  const [tick, setTick] = useState(0);
  // Stable per-hook-instance key, so a call that keeps failing shows once rather
  // than stacking, and clears the moment it succeeds.
  const key = useId();

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setStatus(undefined);
    // CLEAR THE PREVIOUS ANSWER before fetching the next one.
    //
    // Without this, `data` held the OLD subject's result while the new request
    // was in flight — and forever if it failed. Reproduced in the browser:
    // switching patient on Billing showed "Bilal Ahmed" as the header over Sana
    // Riaz's Rs 16,000 balance; the dose calculator showed 14 kg's answer
    // (186.7 mg / 7.5 mL) under a weight of 28 kg, which is half the correct
    // dose, and kept showing it permanently when the recalculation failed.
    //
    // Every page renders `data ?? []`, so stale data is indistinguishable from
    // current data. A blank panel is recoverable; a confident wrong number that
    // belongs to a different patient is not. Pages should gate on `loading` —
    // BillingPage's invoice detail already does — but correctness must not
    // depend on each page remembering to.
    setData(null);
    fetcher()
      .then((res) => {
        if (!active) return;
        setData(res);
        clearFetchError(key);
      })
      .catch((err) => {
        if (!active) return;
        const { message, status: httpStatus } = describeError(err);
        setError(message);
        setStatus(httpStatus);
        reportFetchError({ key, message, status: httpStatus });
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

  return { data, loading, error, status, reload };
}

/** Format an integer PKR amount as e.g. "PKR 118,840". */
export function pkr(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`;
}

/**
 * Sanitise a numeric text input WITHOUT changing its magnitude.
 *
 * The previous idiom was `value.replace(/[^0-9]/g, '')`, which deletes the
 * offending characters and concatenates the survivors — so it silently changes
 * the NUMBER rather than rejecting the input. Reproduced in the browser:
 *
 *   IOP  "1.5"      -> "15"      1.5 mmHg is profound hypotony, a same-day
 *                                emergency; 15 mmHg renders as a green "normal".
 *   Price "12500.50" -> "1250050"  a 100x overcharge, no warning.
 *
 * The server's own plausibility guard cannot save this: IOP 1..80 accepts 15.
 *
 * Keeping the decimal point means a mistyped value stays wrong-looking instead
 * of becoming plausibly wrong. At most one dot, so "1.2.3" cannot form a value
 * that Number() turns into NaN behind the caller's back. The minus sign is
 * deliberately still excluded — none of these fields accept a negative.
 */
export function numericInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}
