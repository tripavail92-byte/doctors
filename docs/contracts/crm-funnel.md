# GET /crm/funnel

The Lead Funnel widget on the ops dashboard.

**Already implemented** in `src/crm/crm.service.ts`. Documented here so the
frontend and future contract additions stay aligned.

## Request

No parameters.

## Response `200 OK`

```json
{
  "total": 676,
  "byStatus": {
    "NEW": 245,
    "CONTACTED": 189,
    "QUALIFIED": 156,
    "CONVERTED": 86,
    "LOST": 0
  },
  "conversionRatePct": 13
}
```

- `byStatus` keys are the `LeadStatus` enum values. Any status with a
  count of 0 may be OMITTED (current implementation returns only the
  statuses that appear in the DB).
- `conversionRatePct` = `100 * byStatus.CONVERTED / total`, rounded to
  the nearest whole percent.

## Errors

Standard 401 / 403 (entitlement `crm.core`).

## UI states

- **loading** — skeleton bars.
- **empty** — `total === 0`: "No leads yet. Capture the first from
  WhatsApp or the website intake form."
- **populated** — stacked-bar funnel + conversion-rate footer.
- **error** — banner.

## Notes

- The reference dashboard groups by lead **source** (Facebook, WhatsApp,
  Website, Consultations Booked) not by **status**. The current
  endpoint groups by STATUS. Two different funnels — the source funnel
  is a separate contract (`crm-lead-sources.md`, not yet written)
  that will need `Lead.source` grouping and a real campaign model
  (release-plan-v2 §4.11 flagged the CRM `source` normalization as a
  low-priority follow-up). For the ops dashboard's first render we
  show the STATUS funnel because it exists today.
