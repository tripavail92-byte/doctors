// A registry of load failures that are currently on screen.
//
// WHY THIS EXISTS
// ---------------
// `useApi` has always captured an error, and 19 of 21 pages never read it. So a
// failed fetch left `data` null, the page rendered `data ?? []`, and the user saw
// an EMPTY TABLE — indistinguishable from "there is genuinely nothing here".
//
// Reproduced with billing: disabling the billing.core entitlement made
// /patients/:id/invoices return 403, and the Billing page rendered
// "Rs 0 outstanding · 0 invoices · No invoices for this patient yet" for a
// patient who has a paid PKR 15,000 invoice. An error was rendered as a
// financial fact.
//
// That is the same shape as every backend defect found on this project: a
// control reporting success while doing nothing. It matters more here, because
// the screen is what a person acts on.
//
// FIXING 19 PAGES WOULD NOT FIX THE CLASS. The next page written would have the
// same hole. So failures are registered centrally and the app shell renders them
// — a page CANNOT silently swallow one, whether or not its author remembered to
// check `error`.
//
// This does not replace per-page error states; it is the floor beneath them.

export interface FetchError {
  /** Stable key so a repeated failure of the same call does not stack up. */
  key: string;
  message: string;
  /** HTTP status, where there was one. 403 gets its own wording. */
  status?: number;
}

const active = new Map<string, FetchError>();
const listeners = new Set<() => void>();

// A CACHED snapshot. useSyncExternalStore compares snapshots by reference, so
// returning `Array.from(map.values())` fresh each call makes every render look
// like a change and loops until React throws "Maximum update depth exceeded".
// Caught by loading the page — the first version of this file did exactly that.
// The array identity therefore changes only when the contents actually change.
let snapshot: FetchError[] = [];

function emit(): void {
  snapshot = Array.from(active.values());
  listeners.forEach((l) => l());
}

export function reportFetchError(e: FetchError): void {
  const prev = active.get(e.key);
  if (prev && prev.message === e.message && prev.status === e.status) return;
  active.set(e.key, e);
  emit();
}

export function clearFetchError(key: string): void {
  if (active.delete(key)) emit();
}

export function getFetchErrors(): FetchError[] {
  return snapshot;
}

/**
 * Drop every registered failure. Module state outlives a test file's renders,
 * so without this one test's 403 shows up in the next test's banner and the
 * suite passes or fails depending on file order.
 */
export function resetFetchErrors(): void {
  active.clear();
  emit();
}

export function subscribeFetchErrors(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Turn an axios failure into something a clinic receptionist can act on.
 *
 * A 403 now means "your plan does not include this", which is a different
 * instruction from "something broke" — the user should stop trying and talk to
 * whoever owns the subscription, not refresh.
 */
export function describeError(err: unknown): { message: string; status?: number } {
  const e = err as { response?: { status?: number; data?: { message?: unknown } }; message?: string };
  const status = e?.response?.status;
  const server = e?.response?.data?.message;
  const serverText = Array.isArray(server) ? server.join(', ') : typeof server === 'string' ? server : undefined;

  if (status === 403) {
    return {
      status,
      message: serverText?.startsWith('Feature not enabled')
        ? `${serverText} — this feature is not part of your current plan.`
        : serverText ?? 'You do not have access to this.',
    };
  }
  if (status === undefined) {
    // No response at all: the API is unreachable. Saying "request failed" here
    // invites a retry that cannot work.
    return { message: 'Cannot reach the server. Check that the API is running.' };
  }
  return { status, message: serverText ?? e?.message ?? 'Request failed' };
}
