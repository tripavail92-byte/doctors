# Design — amending a finalized imaging report

**Status: proposed, not built.** This answers the question left open on 2026-07-21, when a
finalized radiology report was made immutable to stop it being silently overwritten. That
fix was correct but incomplete: **a genuine correction now has no route at all.**

The design below is grounded in sources that were independently verified. Where the
standards are silent, this document says so and puts the question to the clinician rather
than inventing an answer.

---

## What went wrong, and why immutability alone is not the answer

`addReport` admitted an already-REPORTED order and upserted, so the update branch rewrote
findings and impression **on the same row, keeping the original timestamp**. Reproduced
live: *"acute intracranial haemorrhage"* became *"No acute abnormality"* with nothing
recording that it had ever changed.

Refusing the overwrite closed that. But radiologists legitimately need to correct reports —
a missed finding, a wrong laterality, a report filed against the wrong patient. Leaving no
route means the correction happens outside the system, on paper or over the phone, which is
worse than either alternative.

---

## The convergence

Four standards families arrive at the same shape without referencing each other. That
agreement is the strongest signal found in this research:

| Source | What it establishes |
|---|---|
| **HL7 FHIR** `DiagnosticReport.status` | A status vocabulary distinguishing *appended*, *corrected*, *amended*, *entered-in-error* |
| **IHE** | An amended result must carry **complete** content, never a delta |
| **DICOM** | The predecessor document is retained as its own object |
| **RCR / AoMRC** (UK) | The alert belongs **in the report**, plus a three-state model based on whether it has been read |

---

## Recommendation

### 1. The original is preserved, always

After sign-off the only route is an addendum; the addendum and original are viewable
together. Health OS already preserves the original — but as a side effect of a lock, not as
a design. **Keep the preservation, remove the lock.**

### 2. An amendment is a NEW ROW, complete, pointing backwards

Replace the current `@@unique([tenantId, orderId, studyCode])` with a version chain:

```prisma
version            Int      @default(1)
supersedesReportId String?  @db.Uuid   // the row this replaces
isCurrent          Boolean  @default(true)
// at most one isCurrent = true per (tenantId, orderId, studyCode)
```

**The amended row carries complete findings and impression, not a delta.** IHE is explicit:
*"If an amended imaging result is sent with a status of 'C', the entire content of the
changed imaging result shall be sent. Differential content alone… shall not be sent."*
Build it as a delta and it will have to be rewritten before any interface ships.

### 3. Adopt the FHIR status vocabulary verbatim, on the report

Status currently lives only on the order. Add it to `ImagingReport` using FHIR's codes:

| Status | Meaning |
|---|---|
| `preliminary` | Not yet signed |
| `final` | Signed |
| `appended` | Original untouched, content **added** |
| `corrected` | An **error** was fixed |
| `amended` | General post-final modification |
| `entered-in-error` | Withdrawn |

This settles the addendum-versus-amendment argument by keeping the ideas separate, and
interoperates with any EHR later without translation.

**`entered-in-error` is worth putting to the clinician separately** — it is the state for a
report filed against the **wrong patient**, which is a different problem from a wrong
interpretation and probably needs a different workflow.

### 4. What a reader sees: a marker **in the report**, not only a database status

The RCR recommends the alert be carried in the report text itself. The reason is decisive
for this clinic: **an in-report banner survives printing, PDF export and WhatsApp; a
database status does not.**

So an amended report renders with a visible banner carrying version, date, amending
clinician and reason.

The RCR also gives a three-state model that maps cleanly onto data:

1. **Not yet released** — free editing.
2. **Released but not yet read** — a short window (they suggest ~2 minutes) for typo fixes.
3. **Read by someone** — version control, documented amendment, notification.

> **State 2 requires an access/read log, which Health OS does not have.** Decide whether you
> want one; without it that rule cannot be implemented and the middle state collapses into
> state 3. Collapsing is safe — it just means every post-release change is a full amendment.

### 5. Communication to the referrer must be recorded — as structured fields

This is the strongest design implication found, corroborated independently by the ACR and by
Patra. The ACR: *"Interpreting physicians should document all nonroutine communications"*,
with adequate documentation exemplified as **date and time, method, and the name of the
person to whom it was delivered**. Electronic communication is acceptable **only** where it
documents receipt and acknowledgement.

```prisma
model ImagingReportCommunication {
  recipientName  String
  communicatedAt DateTime
  method         String     // phone / in person / electronic
  acknowledgedAt DateTime?  // required for electronic routes
}
```

The RCR adds a fail-safe: a system identifying reports not read, acknowledged or acted upon,
with escalation suggested at ~48 hours.

### 6. The mirror case

The RCR's scope explicitly includes a correction that makes a report **less** alarming.
Whatever alerting is built must cover that direction too — it is easy to build only for
"we missed something".

---

## What the standards do NOT settle — for the clinician

1. **Is direct communication mandatory for every amendment, or only a clinically significant
   one?** The RCR distinguishes a *significant* addendum — differently-interpreted findings
   that may cause harm if not acted on — from one containing merely new findings, or a
   revision that does not affect management.
2. **Who decides which it is** — the reporting doctor, or a rule in the software?
3. **May the amendment be saved before the communication is recorded, or should the system
   block it?**

Two things deliberately **not** claimed: the ACR is **silent on report mechanics** — it never
says whether an amendment is a new document or an edit, so it cannot settle the data model;
and its verb throughout is **"should", not "must"**.

---

## The Pakistani regulator is on point, and outranks everything above

The **Punjab Healthcare Commission Minimum Service Delivery Standards for Radiological /
Imaging Diagnostic Centres** applies in Lahore:

| Indicator | Requirement |
|---|---|
| **59** | A named focal person and a **written SOP covering amendments** |
| **60** | Entries dated, timed and attributable |
| **61** | Signature and named authenticating radiologist on every report; digital signature/logging for PACS/DICOM teleradiology |
| **73** | Discrepancy reports and patient-recall records |

**This means whatever is built needs a matching clinic SOP, not just code.** And per Patra: a
reader's understanding of the word "addendum" varies, so **the SOP must define the term the
software uses.**

---

## Estimated work

| Piece | Size |
|---|---|
| Schema: version chain + status + communication model | 1 migration, ~3 new fields + 1 table |
| Service: amend route, supersede logic, current-row invariant | moderate |
| Rendering: in-report amendment banner | small |
| Read/access log (only if state 2 is wanted) | **new subsystem — decide first** |
| Regression suite asserting the original is never mutated | small |

The read log is the only piece that is genuinely large, and it is optional.
