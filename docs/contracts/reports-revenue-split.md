# GET /reports/revenue-split

The Revenue vs Doctor Share donut on the ops dashboard.

## Request

- `period` — one of `today`, `this-week`, `this-month`, `last-30d`.
  Defaults to `this-month`.

## Response `200 OK`

```json
{
  "period":     { "from": "2026-08-01", "to": "2026-08-31" },
  "totalPkr":   84320,
  "clinicPkr":  50592,
  "clinicPct":  60.0,
  "doctorPkr":  33728,
  "doctorPct":  40.0
}
```

- `totalPkr` = sum of `Payment.amount` in the period, minus refunds
  (net collections). Not gross invoicing.
- `doctorPkr` = sum of `CommissionEarning.amountPkr` for the same period
  where the beneficiary is a DOCTOR/TREATMENT.
- `clinicPkr` = `totalPkr - doctorPkr` (residual to the clinic).
- Percentages sum to exactly 100 (server-computed).

## Errors

Standard 401. Role gate: `OWNER` / `ADMIN` / `FINANCE`. Entitlement
gate: `reporting.core`. Same envelope as the existing
`/reports/revenue` endpoint.

## UI states

- **loading** — skeleton donut.
- **empty** — `totalPkr === 0`: donut hidden, single line "No revenue
  in this period yet."
- **populated** — donut + two-line summary.
- **error** — banner.

## Notes

- **CommissionEarning does not exist yet.** Release 1 Phase 2 work
  (release-plan-v2 §4.4). Until then the endpoint returns `doctorPkr:
  0` and `clinicPkr: totalPkr`, and the donut shows a single 100%
  clinic slice. That is HONEST — no commission has been paid because
  no commission engine has been built — not a bug to hide.
