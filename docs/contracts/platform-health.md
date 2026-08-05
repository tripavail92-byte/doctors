# GET /platform/health

The "Your platform is running smoothly" card in the sidebar.

## Request

No parameters.

## Response `200 OK`

```json
{
  "status": "healthy",
  "checks": [
    { "key": "db",      "label": "Database",    "status": "healthy", "note": null },
    { "key": "storage", "label": "Object store","status": "healthy", "note": null },
    { "key": "queue",   "label": "Job queue",   "status": "healthy", "note": null }
  ],
  "lastCheckedAt": "2026-08-06T12:00:00.000Z"
}
```

- Top-level `status` is `healthy` | `degraded` | `down`.
  - `healthy` — every check `healthy`.
  - `degraded` — one or more checks `degraded`, none `down`.
  - `down` — at least one check `down`.
- Each check's `note` explains the state in one sentence when not
  `healthy` ("Storage disk 89% full"), null otherwise.

## Errors

- **200** is the only expected response for the healthy path. A **500**
  from this endpoint is itself a health signal and the sidebar card
  renders `down`.
- 401 → the sidebar card is not shown (unauthenticated shell).

## UI states

- **loading** — grey pulse dot, "Checking…" label.
- **healthy** — green dot, "Your platform is running smoothly / All
  systems operational" (matches the reference exactly).
- **degraded** — amber dot, "Some subsystems degraded" + a link that
  expands the per-check list.
- **down** — red dot, "Platform issue detected" + immediate list.

## Notes

- Polled every 60s from the shell. Cache-Control: `no-store`.
- MUST NOT trigger the fetch-error banner on a 500 — this endpoint IS
  the error indicator; a banner on top would be circular. Handled with
  a dedicated request path that opts out of the shared error registry.
