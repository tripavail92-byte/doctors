// The failure registry and the sentence it puts on screen.
//
// The snapshot test here is the one that matters. A version of `getFetchErrors`
// that returned `Array.from(map.values())` fresh on every call made
// useSyncExternalStore see a change on every render, React threw "Maximum update
// depth exceeded", and EVERY ROUTE IN THE APPLICATION rendered blank. `tsc
// --noEmit` was green throughout — the bug is a reference-identity contract, and
// types have nothing to say about it. It was found by loading a page by hand.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFetchError,
  describeError,
  getFetchErrors,
  reportFetchError,
  resetFetchErrors,
  subscribeFetchErrors,
} from './fetchErrors';

beforeEach(() => resetFetchErrors());

describe('the snapshot contract useSyncExternalStore depends on', () => {
  it('returns the SAME array reference when nothing has changed', () => {
    reportFetchError({ key: 'a', message: 'boom', status: 500 });
    expect(getFetchErrors()).toBe(getFetchErrors());
  });

  it('still returns the same reference across an unchanged re-report', () => {
    reportFetchError({ key: 'a', message: 'boom', status: 500 });
    const before = getFetchErrors();
    reportFetchError({ key: 'a', message: 'boom', status: 500 });
    // Identical repeat: no new snapshot, so no render, so no loop.
    expect(getFetchErrors()).toBe(before);
  });

  it('returns a NEW reference once the contents actually change', () => {
    reportFetchError({ key: 'a', message: 'boom', status: 500 });
    const before = getFetchErrors();
    reportFetchError({ key: 'b', message: 'other', status: 500 });
    expect(getFetchErrors()).not.toBe(before);
    expect(getFetchErrors()).toHaveLength(2);
  });

  it('notifies subscribers only when something changed', () => {
    let calls = 0;
    const unsub = subscribeFetchErrors(() => {
      calls++;
    });
    reportFetchError({ key: 'a', message: 'boom', status: 500 });
    reportFetchError({ key: 'a', message: 'boom', status: 500 });
    expect(calls).toBe(1);
    clearFetchError('a');
    expect(calls).toBe(2);
    // Clearing something already gone is not a change.
    clearFetchError('a');
    expect(calls).toBe(2);
    unsub();
  });
});

describe('describeError tells the reader what to DO', () => {
  it('an unreachable API is not "request failed"', () => {
    // No `response` at all. Saying "request failed" invites a retry that
    // cannot possibly work.
    const d = describeError(new Error('Network Error'));
    expect(d.status).toBeUndefined();
    expect(d.message).toMatch(/cannot reach the server/i);
  });

  it('a gated feature reads as a plan boundary, not a fault', () => {
    const d = describeError({
      response: { status: 403, data: { message: 'Feature not enabled: billing.core' } },
    });
    expect(d.status).toBe(403);
    expect(d.message).toMatch(/not part of your current plan/i);
  });

  it('a 409 is relayed in the server’s own words', () => {
    // The duplicate-MRN refusal names the MRN and says where the first chart
    // is. Replacing it with "Request failed" is what leads someone to invent a
    // new MRN and open a second chart for the same person.
    const server = 'MRN P-00042 already belongs to another patient in this clinic.';
    const d = describeError({ response: { status: 409, data: { message: server } } });
    expect(d.message).toBe(server);
  });

  it('joins a class-validator message array instead of printing [object Object]', () => {
    const d = describeError({
      response: { status: 400, data: { message: ['quantity must be an integer', 'code should not be empty'] } },
    });
    expect(d.message).toContain('quantity must be an integer');
    expect(d.message).toContain('code should not be empty');
  });
});
