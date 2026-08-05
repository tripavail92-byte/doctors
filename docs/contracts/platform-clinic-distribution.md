# GET /platform/clinic-distribution

The donut on the platform dashboard: how many clinics per specialty.

## Request

No parameters. Distribution is over ACTIVE clinics only — a suspended or
deactivated tenant does not count.

## Response `200 OK`

```json
{
  "total": 356,
  "buckets": [
    { "key": "DERMATOLOGY",  "label": "Dermatology",     "count": 100, "pct": 28.1 },
    { "key": "DENTAL",       "label": "Dental",          "count":  86, "pct": 24.2 },
    { "key": "PEDIATRICS",   "label": "Pediatric",       "count":  64, "pct": 18.0 },
    { "key": "GENERAL",      "label": "General Practice","count":  57, "pct": 16.0 },
    { "key": "PHYSIOTHERAPY","label": "Physiotherapy",   "count":  49, "pct": 13.7 }
  ]
}
```

- `key` mirrors the `Edition` enum so a future colour lookup stays stable.
- `pct` is `count / total * 100`, one decimal. Percentages need not sum to
  exactly 100 after rounding — the UI shows what the API returns, does not
  recompute.
- Buckets are sorted by `count` descending. Buckets with `count === 0` are
  OMITTED — an empty slice in a donut is a lie.

## Errors

Same 401 / 403 / 500 as `/platform/summary`.

## UI states

- **loading** — grey circle placeholder.
- **empty** — `total === 0`: no donut drawn, one line "No active clinics
  on the platform." Legend hidden.
- **populated** — donut with `buckets.length` slices, legend row per bucket.
- **error** — no donut, banner explains.

## Notes

- `Edition` enum has 13 values; not every value gets a slice. Merging
  SPECIALTY into DERMATOLOGY (the audit's earlier "split SPECIALTY" work
  did the opposite — split it into per-specialty editions) is out of scope.
