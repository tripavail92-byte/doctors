# GET /platform/popular-modules

The "Popular Modules" tile grid on the platform dashboard.

## Request

No parameters. Always returns modules ranked by how many active tenants
have the corresponding entitlement enabled.

## Response `200 OK`

```json
{
  "modules": [
    { "key": "appointments.core", "label": "Appointments",       "activeClinics": 356 },
    { "key": "patients.core",     "label": "Patient Management", "activeClinics": 349 },
    { "key": "billing.core",      "label": "Billing & Invoicing","activeClinics": 321 },
    { "key": "emr.core",          "label": "EMR",                "activeClinics": 297 },
    { "key": "pharmacy.core",     "label": "Inventory",          "activeClinics": 223 },
    { "key": "reporting.core",    "label": "Reports & Analytics","activeClinics": 210 },
    { "key": "integrations.core", "label": "Telehealth",         "activeClinics": 156 },
    { "key": "crm.core",          "label": "CRM",                "activeClinics": 134 }
  ]
}
```

- Returns AT MOST 8 modules; the dashboard tile grid is 4×2.
- Sorted by `activeClinics` descending.
- `activeClinics` counts tenants with `status = ACTIVE` and a
  `TenantEntitlement` row `enabled = true` for `key`.

## Errors

Standard 401 / 403 / 500.

## UI states

- **loading** — 8 grey skeleton tiles.
- **empty** — no active tenants at all: the grid renders zeros for the
  four core keys and one line "No active tenants yet."
- **populated** — grid of tiles with icon, label, count.
- **error** — no tiles; banner.

## Notes

- Icons are chosen client-side by `key`. This keeps icon changes off the
  wire. The icon map lives in `app/web/src/components/dashboard/moduleIcons.ts`.
