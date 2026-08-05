# GET /platform/tenants (extended)

The dashboard's Clinic Clients table. Already exists as a flat
`Tenant[]`; this extends it with pagination, module counts, and the
branch count each row needs.

## Request

Query parameters, all optional:

- `limit` — 1–50, default 10.
- `offset` — non-negative, default 0.
- `q` — free-text substring on name or slug. Untrimmed match rejected.
- `status` — `ACTIVE` | `SUSPENDED` | `DEACTIVATED`.

## Response `200 OK`

```json
{
  "total": 128,
  "limit": 10,
  "offset": 0,
  "rows": [
    {
      "id":         "43c3986f-17da-41d6-99c8-39190a244000",
      "name":       "Skinfinity Clinics",
      "slug":       "skinfinity",
      "edition":    "DERMATOLOGY",
      "status":     "ACTIVE",
      "patients":   337,
      "users":        5,
      "branches":     8,
      "modules": [
        { "key": "appointments.core", "label": "Appointments" },
        { "key": "emr.core",          "label": "EMR" },
        { "key": "billing.core",      "label": "Billing" },
        { "key": "reporting.core",    "label": "Reports" }
      ],
      "createdAt":  "2025-11-14T09:00:00.000Z"
    }
  ]
}
```

- `patients` / `users` / `branches` are per-tenant counts, computed
  inside forTenant(). This is the RLS-safe path — see the audit's
  "counts always zero" bug for what the naked-groupBy alternative did.
- `modules` is a stable, ordered subset of TenantEntitlement rows
  intended for the ICON ROW in the table cell. It is capped at 6 items
  server-side; the full list is on the tenant detail page. Order is
  category-then-key so the row is consistent from render to render.

## Errors

Standard 401 / 403. `422` on a malformed `limit` / `offset`.

## UI states

- **loading** — grey table skeleton, 10 rows tall.
- **empty** — no rows: one-cell message "No clinics on the platform yet."
  Pagination controls hidden.
- **populated** — table plus `1–10 of 128` counter and prev/next.
- **error** — no rows; banner.

## Notes

- The existing endpoint returns `[]` at the top level with no pagination.
  This is a REPLACEMENT shape. Contract-first means the frontend types the
  new shape today; the backend rewrites next batch. Until then the stub
  returns the shape below.
