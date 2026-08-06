# GET /dashboard/appointments-today

Today's appointment schedule for the calling clinic.

## Request

Query parameters, all optional:

- `providerId` — filter to one provider.
- `limit` — 1–100, default 20.

## Response `200 OK`

```json
{
  "todayLocal": "2026-08-06",
  "rows": [
    {
      "id":          "a-1",
      "start":       "2026-08-06T04:30:00.000Z",
      "end":         "2026-08-06T05:00:00.000Z",
      "durationMin": 30,
      "status":      "BOOKED",
      "patient":     { "id": "p-1", "name": "Sarah Johnson", "mrn": "GD-0044" },
      "provider":    { "id": "u-1", "name": "Dr. Emily Carter" },
      "service":     { "id": "sc-1", "label": "HydraFacial MD" },
      "roomLabel":   "Room 1"
    }
  ]
}
```

- Rows sorted ascending by `start`.
- `start`/`end` are UTC ISO — the UI formats to `HH:mm` in the clinic's
  timezone.
- `status` follows the AppointmentStatus enum.
- `service.id` may be null for legacy appointments (before the
  attribution columns landed — see the 20260806133031 migration). Legacy
  rows still show their free-text `service` label under `service.label`.
- `roomLabel` is deliberately a string, not a `roomId`. The Room model
  does not exist yet (Release 1 Phase 1 spine work — see
  release-plan-v2 §3). Today this reads from an `Appointment.roomLabel`
  string field once that ships; for now the stub returns a fixture and
  the backend will return `null`.

## Errors

Standard 401. Any authenticated role in the clinic may read this — no
role gate. Entitlement gate: `appointments.core`.

## UI states

- **loading** — skeleton list of 5 rows.
- **empty** — a friendly "No appointments scheduled today" line.
- **populated** — schedule list.
- **error** — banner.

## Notes

- The audit's completeness critic named the appointment calendar as the
  single biggest missing screen. This endpoint is the read-only slice
  that feeds the ops dashboard's day-view widget. The full booking UI is
  its own screen; this exists so the dashboard is coherent while the
  calendar is being built.
