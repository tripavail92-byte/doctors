# GET /crm/lead-sources

The **source** Lead Funnel on the ops dashboard — grouping leads by the
channel they came in through (Facebook, WhatsApp, Website, …). This is the
funnel the reference dashboard (#4) shows.

Distinct from `GET /crm/funnel`, which groups by pipeline **status**
(NEW → CONVERTED). The ops widget offers both views via a toggle; this
contract is the "By source" side.

## Request

- `period` — `today` | `this-week` | `this-month` | `last-30d`.
  Defaults to `this-month`.

## Response `200 OK`

```json
{
  "period": { "from": "2026-08-01", "to": "2026-08-31" },
  "total": 676,
  "rows": [
    { "key": "FACEBOOK",            "label": "Facebook Leads",       "count": 245, "deltaPct": 18.0 },
    { "key": "WHATSAPP",            "label": "WhatsApp Leads",       "count": 189, "deltaPct": 12.5 },
    { "key": "WEBSITE",             "label": "Website Leads",        "count": 156, "deltaPct":  9.3 },
    { "key": "CONSULTATION_BOOKED", "label": "Consultations Booked", "count":  86, "deltaPct": 14.8 }
  ],
  "conversionRatePct": 18.5
}
```

- `rows` sorted by `count` descending.
- `key` is the normalized `LeadSource` enum; `label` is the display string.
- `deltaPct` compares each source's count to the equal-length previous
  period. `null` when there is no prior period to compare against.
- `conversionRatePct` = `100 * CONSULTATION_BOOKED.count / total`, one
  decimal. (Booking a consultation is the funnel's conversion event on the
  source view — a different denominator/numerator from the status view's
  `CONVERTED / total`.)

## Errors

Standard 401 / 403 (entitlement `crm.core`).

## UI states

- **loading** — skeleton bars.
- **empty** — `total === 0`: "No leads yet. Capture the first from
  WhatsApp or the website intake form."
- **populated** — horizontal bars per source + conversion-rate footer.
- **error** — banner.

## Notes

- **Implemented** in `src/dashboard/dashboard.service.ts` (`leadSources`).
  `Lead.source` is a free-text column populated inconsistently by several
  writers (WhatsApp webhook writes `"whatsapp"`, the intake form writes
  `"website-form"`, manual entry writes whatever staff typed). The service
  normalizes the common spellings into the channel buckets above
  (`normalizeSource`); anything unrecognized falls into `OTHER`. No schema
  change or historical backfill was needed — grouping happens at read time.
- `deltaPct` is currently `null` for every row (no per-source historical
  baseline is computed yet).
- `conversionRatePct` is `100 * CONVERTED-status leads / total` for the
  window. There is no "consultation booked" event model, so CONVERTED is
  the honest proxy for the funnel's conversion figure — not the literal
  "consultations booked / total" the reference implies.
- Source counts are never fabricated to fill the widget — an empty honest
  state beats a made-up funnel a clinic owner would trust for ad spend.
