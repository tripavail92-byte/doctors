# GET /dashboard/today

Clinic ops dashboard's four stat cards: Today's Appointments, Active
Patients, Revenue This Month, Outstanding Balance.

Scoped to the caller's clinic (tenant). Every count reads through
`forTenant()` — the "structurally-always-zero" trap is well documented in
this codebase (five instances found and fixed on the platform side).

## Request

No parameters. "Today" is defined relative to the clinic's timezone,
which for Release 1 is Asia/Karachi (see release-plan-v2 §4.10).

## Response `200 OK`

```json
{
  "generatedAt": "2026-08-06T15:00:00.000Z",
  "todayLocal":  "2026-08-06",
  "appointmentsToday":  { "count": 28,   "deltaPct":  12.0 },
  "activePatients":     { "count": 1245, "deltaPct":   8.6 },
  "revenueThisMonth":   { "pkr":   84320, "deltaPct": 16.4 },
  "outstandingBalance": { "pkr":   18750, "deltaPct":  6.3 }
}
```

- `appointmentsToday.count` = appointments whose `start` falls within the
  local day, of any status other than `CANCELLED`. Delta compares to
  yesterday.
- `activePatients.count` = patients seen in the last 30 days. Delta vs the
  30 days before that.
- `revenueThisMonth.pkr` = sum of `Payment.amount` this calendar month,
  minus refunds. Delta vs last month same-day-to-date.
- `outstandingBalance.pkr` = sum of `Invoice.total - Invoice.paid` across
  all non-void invoices. Delta compares to end-of-yesterday.
- All `pkr` are whole PKR (matching the rest of billing).
- `deltaPct` is null when the comparison period is 0 — the UI renders
  null as an em-dash (never NaN, never Infinity).

## Errors

Standard 401 / 403. Note that a DOCTOR or RECEPTION may not see
`revenueThisMonth` / `outstandingBalance`; the endpoint can either
(a) omit those two fields for those roles, or (b) always return them
and let the guard on the specific card decide. The frontend currently
plans (a) with the same `FINANCIAL_ROLES` set the DashboardPage uses.

## UI states

- **loading** — four grey skeleton cards.
- **empty** — every count is 0; delta is `—`. Not an error.
- **populated** — numeric values with signed delta chips.
- **error** — no cards drawn; the FetchErrorBanner explains.

## Notes

- Deliberately a separate endpoint from `/reports/summary` (which is
  richer, gated on `reporting.core`, and slower). This endpoint answers
  in one round-trip for the four tiles a clinic OWNER sees at a glance.
- Route this through `forCurrentTenant()`. Do NOT read Patient/Payment
  via a base-client `count()` — that is the always-zero trap.
