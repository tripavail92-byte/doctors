# GET /dashboard/recent-encounters

Recent patient consultations across the calling clinic.

## Request

- `limit` — 1–20, default 5.

## Response `200 OK`

```json
{
  "rows": [
    {
      "id":             "e-1",
      "patient":        { "id": "p-1", "name": "Neha Reddy", "mrn": "GD-0087" },
      "provider":       { "id": "u-1", "name": "Dr. Emily Carter" },
      "occurredAt":     "2026-08-06T05:15:00.000Z",
      "concern":        "Acne scars",
      "recommendation": "Microneedling + PRP"
    }
  ]
}
```

- Rows sorted `occurredAt` descending.
- `concern` reads from the encounter's chief-complaint note; `null` when
  no note has been captured.
- `recommendation` reads from the encounter's treatment-plan note;
  `null` similarly.

## Errors

Standard 401 / 403 (entitlement `emr.core`).

## UI states

- **loading** — skeleton list.
- **empty** — "No recent consultations."
- **populated** — feed rows.
- **error** — banner.

## Notes

- Backed by the existing Encounter model. `provider` is
  `Encounter.providerId` (already present). `concern` and
  `recommendation` are extracted from `NoteInstance` rows by role in the
  service — no schema change needed.
