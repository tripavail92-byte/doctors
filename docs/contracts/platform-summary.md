# GET /platform/summary

Platform-admin dashboard's four stat cards: Total Organizations, Total
Clinics, Active Subscriptions, Monthly Recurring Revenue. Each card shows
a current value and a period-over-period delta.

## Request

Query parameters, all optional:

- `period` — one of `this-month`, `last-30d`, `last-90d`, `ytd`, `custom`.
  Defaults to `this-month`.
- `from`, `to` — ISO dates. Required when `period=custom`.

## Response `200 OK`

```json
{
  "period":         { "from": "2026-08-01", "to": "2026-08-31" },
  "comparedTo":     { "from": "2026-07-01", "to": "2026-07-31" },
  "organizations":  { "count": 128, "deltaPct": 12.5 },
  "clinics":        { "count": 356, "deltaPct": 15.3 },
  "activeSubs":     { "count": 295, "deltaPct":  9.8 },
  "mrr":            { "pkr": 24854000, "deltaPct": 18.7 }
}
```

- `count` is a whole number.
- `pkr` is integer paisa... actually **integer PKR** here for consistency
  with every other billing surface (`Invoice.total`, `Payment.amount`);
  the UI formats to `Rs 24,854,000`. The reference screenshot's `$248,540`
  is USD — we display PKR.
- `deltaPct` is a signed number, one decimal place. Positive is up. The UI
  colours green up, red down; direction only, no per-metric "up is good"
  logic here.

## Errors

- **401** — no token or expired.
- **403** — `Invalid principal` if the token is not a platform admin.
  (No plan-boundary case: platform endpoints are not tenant-gated.)
- **500** — one of the underlying counts failed; the UI renders the error
  banner and shows nothing.

## UI states

- **loading** — four grey skeleton cards.
- **empty** — zero counts render as `0` and delta as `—`; not an error.
- **populated** — numeric values with delta chips.
- **error** — no cards drawn; the FetchErrorBanner explains.

## Notes

- The current PlatformTenantsService.list() reads counts per-tenant inside
  forTenant(); this endpoint aggregates across tenants and must NEVER read
  raw across the base client (the failure mode that gave every tenant a
  zero patient count for weeks). Use a SUM over per-tenant counts, or a
  SECURITY DEFINER aggregate — never a naked groupBy on the runtime role.
