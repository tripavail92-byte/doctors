# GET /patients/queue

Patient queue tracker — the row at the bottom of the ops dashboard.

## Request

No parameters. Scoped to the calling clinic, current day.

## Response `200 OK`

```json
{
  "asOf": "2026-08-06T15:00:00.000Z",
  "rows": [
    {
      "patient":   { "id": "p-1", "name": "Riya Kapoor", "mrn": "GD-0044" },
      "arrivedAt": "2026-08-06T04:00:00.000Z",
      "waitedMin": 15,
      "status":    "CHECKED_IN",
      "appointmentId": "a-1",
      "roomLabel": null
    },
    {
      "patient":   { "id": "p-2", "name": "Arjun Nair", "mrn": "GD-0088" },
      "arrivedAt": "2026-08-06T04:30:00.000Z",
      "waitedMin": 12,
      "status":    "WAITING",
      "appointmentId": "a-2",
      "roomLabel": null
    }
  ]
}
```

Status values:

- `CHECKED_IN` — arrived, waiting for triage/vitals.
- `WAITING` — vitals done, waiting for the doctor.
- `IN_PROGRESS` — with the doctor (session started).
- `CONSULTATION` — pre-treatment consult.
- `DONE` — visit complete but not yet checked out.

Sort:
1. `IN_PROGRESS` / `CONSULTATION` first (currently being seen)
2. Then by `arrivedAt` ascending (longest waiter first)

## Errors

Standard 401 / 403 (entitlement `appointments.core`).

## UI states

- **loading** — skeleton rows.
- **empty** — "Nobody in the queue right now."
- **populated** — patient tiles with status pill and wait time.
- **error** — banner.

## Notes

- **AppointmentStatusEvent / queue state model does not exist yet.**
  Release 1 Phase 1 spine work — an appointment today has a `status`
  enum but no waiting-queue timeline. Until then the backend returns
  an empty list computed from `AppointmentStatus = ARRIVED` where
  `today = today` (a coarse approximation); the widget renders the
  empty state.
