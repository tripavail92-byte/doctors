# GET /pharmacy/stock/alerts

Low-stock and expiring items — the alert list on the ops dashboard.

## Request

- `severity` — `all` | `critical` | `low`. Default `all`.
- `limit` — 1–20, default 6.

## Response `200 OK`

```json
{
  "rows": [
    {
      "id":         "st-1",
      "name":       "Botox 100U",
      "unit":       "vial",
      "onHand":     1,
      "reorderAt":  3,
      "severity":   "critical",
      "note":       "1 vial left"
    },
    {
      "id":         "st-2",
      "name":       "Juvederm Ultra 4",
      "unit":       "box",
      "onHand":     2,
      "reorderAt":  5,
      "severity":   "low",
      "note":       "2 boxes left"
    }
  ]
}
```

- `severity` = `critical` when `onHand <= reorderAt * 0.5`, else `low`
  when `onHand <= reorderAt`.
- Sorted by severity (critical first) then ascending `onHand`.
- Items above reorderAt are OMITTED.

## Errors

Standard 401 / 403 (entitlement `pharmacy.core`).

## UI states

- **loading** — skeleton rows.
- **empty** — "Nothing under the reorder threshold. Stock is healthy."
  Not an error.
- **populated** — list with severity pill.
- **error** — banner.

## Notes

- StockItem carries `quantityOnHand` today; `reorderAt` does not exist
  yet. Until it does, the stub returns fixture data and the backend
  reads a hardcoded per-formulary default (or 5, whichever is lower).
  The frontend widget doesn't care — it just shows what the endpoint
  says.
