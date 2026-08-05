# GET /platform/tenants/paged

The dashboard's Clinic Clients table. Deliberately a NEW path — the
legacy `GET /platform/tenants` returns a flat `Tenant[]` and serves
TenantsPage.tsx (a live production page whose shape must not change
under it). This endpoint adds pagination, module counts, and the
branch count each dashboard row needs.

Long-term the two consumers converge on one endpoint; short-term this
split keeps the deploy safe.

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

- The existing `/platform/tenants` returns `Tenant[]` at the top level.
  This new `/paged` endpoint returns the object above. The dashboard reads
  `/paged`; TenantsPage reads the legacy endpoint. Both live at once.
- adaptTenantList() on the frontend still tolerates a bare-array response
  as belt-and-braces (see the crash-fix commit); when the backend for this
  path is stable, that adapter branch can be deleted.
