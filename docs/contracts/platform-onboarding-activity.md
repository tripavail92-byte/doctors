# GET /platform/onboarding-activity

The "Recent Onboarding Activity" feed on the platform dashboard.

## Request

Query parameters:

- `limit` — 1–20, default 5.

## Response `200 OK`

```json
{
  "rows": [
    {
      "tenantId":  "43c3986f-17da-41d6-99c8-39190a244000",
      "name":      "HealthFirst Clinic",
      "edition":   "GENERAL",
      "branches":  2,
      "createdAt": "2026-05-31T05:24:00.000Z",
      "kind":      "TENANT_CREATED"
    }
  ]
}
```

- `kind` is the event class. `TENANT_CREATED` is the only kind today; a
  future `BRANCH_ADDED` or `SUSPENDED` slots in without a UI break — the
  UI renders a pill from `kind`.
- Rows are ordered by `createdAt` descending.
- `createdAt` is UTC ISO. The UI formats to clinic-local (see
  ClinicProfile.timezone once it exists; falls back to Asia/Karachi).

## Errors

Standard 401 / 403 / 500.

## UI states

- **loading** — skeleton list, 5 items.
- **empty** — one line "No onboarding activity in this period."
- **populated** — feed rows.
- **error** — banner.

## Notes

- Sourced from `Tenant.createdAt` today. When `AuditLog` grows a
  first-class onboarding event, this endpoint reads from there instead
  and picks up `BRANCH_ADDED`/`SUSPENDED` for free.
