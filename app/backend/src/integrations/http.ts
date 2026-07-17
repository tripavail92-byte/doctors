/**
 * Tiny JSON-over-HTTP helper for the "live" integration drivers.
 *
 * Uses the Node global `fetch` (Node 18+). Kept dependency-free and cast
 * loosely so the module type-checks regardless of the configured TS `lib`.
 */
export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; data: T }> {
  const f: any = (globalThis as any).fetch;
  if (!f) throw new Error('global fetch unavailable — Node 18+ required for live integration drivers');
  const res = await f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data: data as T };
}
