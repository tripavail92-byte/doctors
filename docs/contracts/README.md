# API Contracts

Small, human-readable specs for endpoints the SPA needs before the backend
implements them.

## Why these exist

The Universal Clinic SaaS audit found that six built-and-guarded backends had
**zero UI consumers**, and the specialty pack config engine was orphaned — the
React app read it zero times. The failure shape was always the same: backend
gets ahead of UI, UI does not know the shape, both ship independently and
never converge.

This directory reverses the flow. Every new endpoint the UI needs starts here:
a Markdown page defining method, path, request body, response shape, error
cases, and the four states the UI must render (loading / empty / populated /
error). The UI is built against a stub that implements this exactly. The
backend implements the same contract later — often reading it as its own spec.

## How to write one

Each file is one endpoint. Filename mirrors the path: `platform-summary.md`
for `GET /platform/summary`, `platform-clinic-distribution.md`, etc.

Keep it short. Cover:

1. **Method + path** in the heading.
2. **Purpose** in one sentence: who calls it, what it feeds on screen.
3. **Request** — query params or body, with example values.
4. **Response** — the full JSON shape, with example values and units.
   Prefer explicit `pkr` / `pct` suffixes on numbers so the unit is not
   guessable-wrong.
5. **Errors** — the shape of the error body for the cases the UI must
   render distinctly (401 auth, 403 role vs plan, 404 not found, etc.).
6. **UI states** — the four screens the UI renders against this endpoint:
   loading, empty (0 rows or all zeros), populated, and error.
7. **Notes** — invariants that matter (idempotency, ordering, tenant
   scoping expectations, whether counts include soft-deleted rows).

## Consumers

- **Frontend stub** (`app/web/src/dev/stubs/*.ts`): a per-endpoint function
  returning a plausible response body matching this shape. Runs when the
  Vite dev server is started with `VITE_STUB_API=1`.
- **Frontend types** (`app/web/src/api/contracts/*.ts`): the TypeScript
  interface for the response, imported by both the stub and the real UI.
- **Backend implementation** (later): the endpoint is written against this
  document. Divergence is caught at contract-refresh time.
