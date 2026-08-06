# GET /sessions/in-progress

Treatment sessions currently in progress, one row per Room.

## Request

No parameters. Scoped to the calling clinic.

## Response `200 OK`

```json
{
  "asOf": "2026-08-06T15:00:00.000Z",
  "rooms": [
    {
      "roomId":   "r-1",
      "roomLabel":"Room 1",
      "session":  {
        "id":               "s-1",
        "patient":          { "id": "p-1", "name": "Sarah Johnson", "mrn": "GD-0044" },
        "service":          "HydraFacial MD",
        "startedAt":        "2026-08-06T14:45:00.000Z",
        "expectedDurationMin": 30,
        "elapsedMin":       15,
        "remainingMin":     15,
        "progressPct":      50.0,
        "status":           "IN_PROGRESS"
      }
    },
    {
      "roomId":   "r-2",
      "roomLabel":"Room 2",
      "session":  null
    }
  ]
}
```

- One row per Room the clinic has configured. `session` is `null` when a
  room is free.
- `progressPct` = `elapsedMin / expectedDurationMin * 100`, capped at 100.
- `elapsedMin` and `remainingMin` are pre-computed server-side so every
  client renders the same number (no clock skew).

## Errors

Standard 401 / 403 (entitlement `appointments.core`).

## UI states

- **loading** — skeleton row per known room.
- **empty** — no rooms configured yet: one-line "No treatment rooms
  configured. Add rooms in Setup." with a link to the setup screen.
- **populated** — one row per room, each showing an in-progress session
  or "Available".
- **error** — banner.

## Notes

- **Room and TreatmentSession models do not exist yet.** The contract
  documents them because they are Release 1 Phase 1 spine work (see
  release-plan-v2 §4.1). The frontend widget renders against stubs
  today; the backend responds `{ "asOf": ..., "rooms": [] }` (empty
  list) until the models land, and the widget shows the empty state.
