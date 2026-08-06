# GET /reports/doctor-earnings

Per-doctor earnings for a period. Feeds the "Doctor Earnings Today" tile.

## Request

- `period` — `today` | `this-week` | `this-month`. Defaults to `today`.

## Response `200 OK`

```json
{
  "period": { "from": "2026-08-06", "to": "2026-08-07" },
  "rows": [
    {
      "userId":   "u-1",
      "name":     "Dr. Emily Carter",
      "pkr":      1850,
      "deltaPct": 15.4
    },
    {
      "userId":   "u-2",
      "name":     "Dr. James Wilson",
      "pkr":      1420,
      "deltaPct":  9.7
    }
  ]
}
```

- Rows sorted `pkr` descending.
- `pkr` = sum of `CommissionEarning.amountPkr` for this doctor in the
  period. Refund clawback reduces it.
- `deltaPct` compares to the equal-length previous period.

## Errors

Standard 401 / 403 (`OWNER`/`ADMIN`/`FINANCE`, `reporting.core`).

## UI states

- **loading** — skeleton rows.
- **empty** — "No doctor earnings yet. Commission is booked when a
  payment lands against an invoice line with a performer."
- **populated** — ranked list.
- **error** — banner.

## Notes

- **CommissionEarning does not exist yet.** Same Release 1 Phase 2 note
  as `/reports/revenue-split`. Backend returns an empty list until
  Phase 2. The frontend shows the empty state honestly.
