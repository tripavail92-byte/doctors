# Health OS — Specialty Pack Build Specs (Wave A, Heavy Packs)

_Build-ready specifications proving the pack pattern end-to-end: the pack manifest system, the shared clinical component layer, and every Wave A heavy pack — plus the specialty-widget UI screens added to the prototype. Companion to `specialty-packs-plan.md`._



---



# Part I — Synthesis

## Implementation Synthesis — Build Order & Effort

*Health OS · VP Engineering · 13 July 2026 · Scope: Shared Clinical Component Layer (SCCL) + Pack Wave A on the shared core. Team: 2–3 devs + 1 clinical content author (non-engineer). Aesthetic pack (flagship) is live and is the reference implementation for the manifest pattern; the before/after photo + consent module it produced is a finished SCCL component.*

---

### 1. Dependency graph

Two layers of dependency: **platform → SCCL → packs**. Nothing in a pack may begin integration until its SCCL dependencies are merged and the Pack Manifest system can activate/seed it. Config authoring (templates, catalogs, order sets, instrument JSON) can proceed in parallel at any time — that is the whole point of the pack architecture.

```
PLATFORM PREREQUISITE (blocks everything)
└─ Pack Manifest & Authoring System
   (registry, activation/seeding at onboarding, entitlement gating,
    tenant-safe versioning/upgrade, draft authoring UI)
        │
SCCL COMPONENTS                         PACKS THAT CONSUME THEM
        │
├─ Laterality (first-class enum,        ──► Ophthalmology (OD/OS/OU — hardest renderer,
│   FHIR bodySite qualifiers)                acceptance driver), ENT (Wave B),
│                                            Physio/Ortho (left/right), Nephro (Wave B).
│                                            Dental does NOT consume it directly
│                                            (FDI quadrant → generated arch_side column).
│
├─ Scored-Instrument engine             ──► Dermatology (GAGS/PASI/SCORAD/EASI/MASI/VASI),
│   (JSON items/options/scoring/             Physio (ODI, DASH, WOMAC),
│    severity bands)                         Psychiatry (Wave B: PHQ-9/GAD-7),
│                                            Peds (milestone checklists, light use).
│
├─ Longitudinal Trends engine           ──► Ophthalmology (IOP trends), Derm (PASI over
│   (TrendSeries over Observations)          time, cumulative NB-UVB), Peds (growth values
│                                            feed it), Physio (NPRS/ROM), ObGyn (SFH, BP).
│                                            Soft dependency for most Wave A packs —
│                                            packs demo without it, but it must land
│                                            before Wave A GA.
│
├─ Weight-based Dose Calculator         ──► Peds (primary consumer), ObGyn, ED (Wave B).
│
├─ Growth-Percentile / WHO LMS engine   ──► Peds (first heavy consumer — the growth
│                                            widget IS this engine's UI), and Peds
│                                            patient fields (birthDateTime, gestational
│                                            age) are in turn consumed by →
│                                            Vaccination/EPI (DOB-driven due-date engine,
│                                            shared Patient extensions, shared clinic base).
│
├─ Before/After Photo + Consent         ──► DONE (aesthetic). Reused as-is by Derm,
│   (EXISTING)                               Physio (posture), Dental/Ortho timeline, ObGyn.
│
└─ (no SCCL dependency)                 ──► Dental Odontogram — standalone specialty
                                             widget; depends only on core (TreatmentPlan,
                                             InvoiceLine, ServiceCatalogItem) and the
                                             manifest system. Can be built by a dedicated
                                             dev in parallel with everything above.
```

**Critical-path chains:**

1. `Manifest system → Scored-Instrument → Dermatology & Physio` (unblocks two packs at once — highest leverage)
2. `Manifest system → LMS engine → Pediatrics → Vaccination/EPI` (the only pack-to-pack dependency in Wave A: EPI reuses Peds' Patient extensions, dose/lot inventory linkage, and is sold into the same clinics)
3. `Manifest system → Laterality → Ophthalmology` (laterality is small; the Eye Exam Panel widget is the long pole)
4. `Manifest system → Odontogram → Dental` (independent lane; Q4 2026 target per pack spec)
5. ObGyn is **Wave B**: its partogram is explicitly Wave-later, and its ANC/ultrasound widgets are the largest remaining code item. It consumes Immunization (TT/Td) from the EPI engine — another reason it follows Wave A.

---

### 2. Recommended build order — Pack Wave A

**Wave A = Dermatology, Physiotherapy, Pediatrics, Vaccination/EPI, Ophthalmology**, with **Dental** starting inside the wave on its independent lane to hit the v2.4 Q4 2026 date. Rationale for this ordering:

- Derm and Physio first because they are the **cheapest proof of the manifest pattern** (~80% config) and both ride the single Scored-Instrument build — two sellable packs for one engine.
- Peds → EPI as a chain because EPI is the strongest standalone commercial wedge in Pakistan (vaccination centers, GP clinics) but needs Peds' patient-model groundwork.
- Ophthalmology last of the config-heavy packs because the Eye Exam Panel is the biggest non-dental widget and benefits from a matured widget-embedding contract (learned from Derm's scoring shells and Peds' growth widget).
- Odontogram parallel-tracked: it touches no SCCL, so Dev C owns it end-to-end without contention.

#### Week-by-week plan (2–3 devs; Dev A = platform/backend, Dev B = frontend/widgets, Dev C = joins Week 3, owns Dental lane; Author = clinical content, non-engineer)

| Week (2026) | Dev A (platform/backend) | Dev B (frontend/widget) | Dev C (Dental lane) | Author (config/content) |
|---|---|---|---|---|
| **W1** Jul 13 | Pack registry tables (global `Pack`/`PackVersion`, tenant `PackActivation`, overrides), signing & entitlement gating | Onboarding flow: clinic-type pick → pack multi-select → activation | — | Derm instrument JSON drafts (GAGS, PASI, Fitzpatrick) against schema |
| **W2** | Activation **seeding pipeline** (catalog, templates, order sets, instrument defs → tenant rows); versioning/upgrade diff-merge for tenant overrides | Authoring UI: draft → validate → submit-for-review | — | Derm catalog + PKR pricing; derma note templates |
| **W3** | Scored-Instrument engine: definition schema, scoring evaluator, severity bands, `ScoredInstrumentResponse` persistence | Generic instrument renderer (items/options → form → score) | Odontogram data model (FDI tooth/surface, `arch_side` generated column), perio-chart schema | SCORAD/EASI/MASI/VASI JSON; Physio ODI/DASH/WOMAC JSON |
| **W4** | Laterality: core enum + FHIR bodySite qualifiers, migration across Observation/Order/Condition; Trends engine backend (`TrendSeries` projection) | **Derm region-scoring UI shells** (body-region grid the generic renderer can't express) | Odontogram SVG chart v1 (permanent dentition, finding overlays) | Physio catalog, HEP exercise library, note templates |
| **W5** | Phototherapy dose engine (NB-UVB ledger, cumulative-dose + burn guardrails); derm lesion/dx layer | Phototherapy ledger widget; Trends chart component (first consumers: PASI, cumulative dose) | Odontogram: surface-level findings, primary dentition (51–85) | Derm order sets (biopsy/path); **Derm pack manifest assembled** |
| **W6** | **🔒 Gate G1 (Derm) + G2 (Physio)** — Physio backend: ROM/MMT reference data, goal tracking on TreatmentPlanSession | Physio assessment grids (ROM/MMT/special tests); HEP builder + print/WhatsApp PDF | Tooth-level treatment planning → `TreatmentPlanItem` → `InvoiceLine` linkage | Physio manifest assembled; Peds milestone checklists, EPI-adjacent content |
| **W7** | **WHO LMS engine**: reference tables (wt/ht/HC/BMI, 0–5y), z-score/percentile compute, unit tests vs WHO published values; Patient peds fields (`birthDateTime`, `gestationalAgeWks`, prematurity correction) | Growth-chart widget v1 (plot on LMS curves) | Perio charting UI (six-site) | Peds catalog + PKR, newborn intake fields, well-baby templates |
| **W8** | Weight-based Dose Calculator engine (mg/kg, max-dose caps, rounding rules) | Growth widget v2: percentile bands, trend overlay, MUAC laterality | Ortho add-on: appliance map, case timeline on photo engine | Peds dose-catalog content (clinically reviewed); Peds manifest assembled |
| **W9** | **🔒 Gate G3 (Peds)** — Vaccination **schedule-rule engine**: schedule-as-data, per-patient due/overdue/done **computed projection** from DOB | Immunization recording UI (dose, site, given-by, `InventoryLot` linkage) | Odontogram integration test: chart → plan → invoice round-trip | Pakistan EPI 2025–26 schedule definition (data, not code); AEFI form |
| **W10** | Defaulter-list query + WhatsApp recall journey wiring; AEFI capture; certificate PDF | Status-pill patient banner; vaccination worklist; certificate print | Dental catalog seeding + manifest dry-run activation | Vaccination manifest; catch-up & travel schedules as second/third schedule defs |
| **W11** | **🔒 Gate G4 (EPI)** — Ophthalmology backend: `EyeExam` model, refraction/IOP/VA observations (per-eye via laterality), sign/amend workflow | **Eye Exam Panel** widget: VA + refraction grid (OD/OS render of core laterality) | Dental note templates + order sets wired; bug bash | Ophtho catalog (consults, procedures, optical), lens catalog, Rx templates |
| **W12** | Glasses/CL prescription document generation → print + WhatsApp; optical dispensing → inventory | Eye Exam Panel: slit-lamp/fundus structured findings, IOP trend chart | **🔒 Gate G5 (Dental)** clinical review of odontogram semantics | Ophtho order sets; optometry-mode manifest (entitlement sub-flag) |
| **W13** | Optometry reuse mode (entitlement-gated feature subset); RLS/tenant-isolation audit across all Wave A tables | Eye Exam Panel polish; cross-pack polyclinic UX (pack switcher in consultation) | Dental fixes from gate; v2.4 hardening | Ophtho manifest assembled |
| **W14** | **🔒 Gate G6 (Ophtho)** — pack **upgrade path** rehearsal: publish v1.1 of Derm manifest, migrate a tenant with overrides | End-to-end demo scripts (Section 3) executed as automated Playwright flows | Dental demo script + acceptance | Content freeze; Urdu/print QA on all patient-facing PDFs |
| **W15** | Wave A release candidate: load test (pooled RLS), backup/restore drill, entitlement matrix test (single/polyclinic/hospital) | Bug burn-down | Bug burn-down | Author handbook: "how to write a Light pack" using Derm as worked example |
| **W16** | **Wave A GA.** Begin ObGyn (Wave B) groundwork: `PregnancyEpisode`, EDD engine | — | Dental GA track continues to v2.4 (Q4) | ObGyn ANC content drafting |

**Slack built in:** Gates G1–G6 (Section 4) are hard stops; each has a nominal half-week absorbed in the plan. If a gate fails, the affected pack slips one week and the parallel lane continues — no gate blocks more than its own chain.

#### Effort roll-up

| Item | New-code (dev-weeks) | Config/content (author-days) | Notes |
|---|---|---|---|
| Pack Manifest & Authoring System | 4.0 | — | One-time platform cost; amortized over 31-pack roadmap |
| SCCL: Scored-Instrument engine | 2.0 | — | Unblocks Derm + Physio + Psych (Wave B) |
| SCCL: Laterality | 1.0 | — | Migration-heavy, code-light |
| SCCL: Longitudinal Trends | 1.5 | — | Backend + one chart component |
| SCCL: WHO LMS engine | 1.5 | — | Includes WHO-reference test suite |
| SCCL: Dose Calculator | 1.0 | — | Engine only; content is per-pack |
| SCCL: Photo + Consent | 0 | — | **Done** (aesthetic) |
| **Dermatology** | 2.0 | 8 | Region-scoring shells + phototherapy ledger/engine; rest is JSON |
| **Physiotherapy** | 1.5 | 8 | Assessment grids + HEP builder; instruments are pure config |
| **Pediatrics** | 2.0 | 6 | Growth widget; dose content is author work with clinical sign-off |
| **Vaccination / EPI** | 2.5 | 4 | Schedule-rule engine + certificate; schedule itself is data |
| **Ophthalmology** | 3.0 | 8 | Eye Exam Panel is the largest non-dental widget; optometry mode is entitlement config |
| **Dental (parallel lane)** | 4.0 | 6 | Odontogram + perio chart; only pack needing a dedicated dev |
| **Wave A total** | **26.0 dev-weeks** | **40 author-days** | ≈ 16 weeks at 2 devs ramping to 3 — matches the plan |
| (Wave B ref: ObGyn) | (3.0 + partogram later) | (8) | Sequenced after EPI (TT/Td reuse) |

The strategic number in that table: **five packs cost ~11 dev-weeks of pack-specific code**; the other 11 weeks are platform/SCCL that the next 25 packs get for free. Wave B packs that are pure-Light (ENT, GP, Nephro clinic mode) should land at **0 code weeks / 5–8 author-days each**.

---

### 3. Demo & acceptance path — end-to-end per pack

Every pack is accepted by the **same four-act script**, run on a fresh tenant in staging by someone who did not build it. The script is the acceptance test; if any act needs a manual DB touch, the pack fails.

**The invariant path:** *Onboarding pick → seeded catalog visible → widget/template live in a consultation → invoice with PKR line-items → (recall/document leaves the building via WhatsApp/print).*

| Act | Dermatology | Physio | Pediatrics | Vaccination/EPI | Ophthalmology | Dental |
|---|---|---|---|---|---|---|
| **1. Onboard** | New tenant "Skin & Care Clinic, Gulberg Lahore" → single-specialty → tick *Dermatology* → entitlement `pack.dermatology` active | "Rehab Hub, Islamabad" → single → *Physiotherapy* | "Aap ka Shifa Children's Clinic, Karachi" → single → *Pediatrics* (auto-suggests EPI add-on) | Polyclinic → multi-select *GP + Vaccination* → EPI 2025–26 schedule seeds | "Al-Noor Eye Centre, Faisalabad" → single → *Ophthalmology*; second tenant with only `optometry_mode` to prove gating | "Smile Dental, DHA Karachi" → single → *Dental & Ortho* |
| **2. Seeded content** | Catalog shows consult + PASI assessment + NB-UVB session (PKR); GAGS/PASI/SCORAD instruments listed; biopsy order set present | ODI/DASH/WOMAC live; 12-session package template (e.g. PKR 36,000); HEP exercise library seeded | Well-baby catalog, EPI-compatible patient fields, dose catalog (paracetamol 15 mg/kg etc.) | Vaccine product catalog (BCG, Penta, PCV10, IPV, Rota, MR, TCV) with lots in inventory; schedule visible as editable data | Consult, refraction, YAG/phaco procedures; frame/lens inventory with batches | Full FDI service catalog: filling per surface, RCT per canal, scaling; ortho packages |
| **3. Consultation** | Register *Ayesha Khan, 24* → encounter → PASI via scoring shell → severity band auto-computed → phototherapy session logged, **cumulative dose visible, over-dose blocked** → before/after photo with consent | *Muhammad Bilal, 45, post-CVA* → ROM/MMT grid (left/right via core laterality) → NPRS 7 → ODI 42% → goals set → session 3-of-12 documented → HEP PDF | *Baby Fatima, DOB 12-Mar-2026* → weight 5.8 kg → **LMS widget plots z-score on WHO curve** → milestone checklist → amoxicillin dose auto-computed from weight, max-dose capped | Same Baby Fatima → status pills show Penta-2 **due**, computed from DOB, not stored → record dose with **lot pick decrementing inventory** → AEFI form reachable → certificate prints | *Abdul Rehman, 61* → Eye Exam Panel → VA/refraction per-eye (OD/OS labels over core LEFT/RIGHT) → IOP 24/18 → **IOP trend chart** → glasses Rx signed | *Sana Tariq, 33* → odontogram → tap tooth 36, mark MOD caries → perio chart → plan: RCT 36 + crown → plan items priced per tooth |
| **4. Billing + loop-out** | Invoice: consult PKR 3,000 + NB-UVB PKR 2,500; FBR fields present; WhatsApp follow-up journey enrolls | Package session decremented; invoice reflects package accounting; HEP delivered via WhatsApp | Invoice for well-baby visit; growth summary printable | Vaccine + admin fee invoiced; **defaulter list shows a seeded overdue patient; recall WhatsApp fires in sandbox** | Rx → optical dispensing → lens stock decrements → single invoice spanning consult + optical | Each plan item → invoice line as work completes (bill-by-tooth); ortho photo timeline |
| **Pack-specific acceptance twist** | Score a published PASI worked example; result must match to the decimal | Re-score ODI at session 8; Trends shows improvement curve | Enter WHO's own LMS reference child; z-score must equal published value | Change schedule data (shift MR-1 age); recomputed due-dates update **without deploy** | Toggle tenant to optometry mode; clinical panels disappear, refraction+dispense remain | Delete a planned item; invoice must not orphan; primary-teeth chart for a 6-year-old |

**Cross-cutting acceptance (once, on the polyclinic tenant):** activate *Derm + Physio + Peds* together; verify catalogs don't collide, the consultation UI switches pack context cleanly, one invoice can carry lines from two packs, and a tenant with **no** pack entitlement sees nothing leak (negative test). Finally, run the **upgrade rehearsal**: publish manifest v1.1 with a changed price and a new template, upgrade a tenant that has local overrides, verify overrides survive and the diff is auditable.

---

### 4. Risks & clinical-safety review gates

#### Top engineering risks

| # | Risk | Likelihood/Impact | Mitigation |
|---|---|---|---|
| R1 | **Manifest system under-designed** — discovered mid-wave that a pack needs a config shape the schema can't express, forcing schema churn across already-activated tenants | Med / High | Weeks 1–2 include a paper-fit of **all six Wave A manifests + ObGyn** against the schema before freeze; versioned schema with additive-only changes after W2 |
| R2 | **Widget-embedding contract drift** — Derm shells, growth widget, Eye Panel, odontogram each invent their own way to sit in the encounter | Med / Med | First widget (Derm shells, W4) sets the contract: props in (patient/encounter/entitlements), events out (observations/orders/invoice-lines); Eye Panel and odontogram must consume it unchanged |
| R3 | **RLS/tenant isolation regression** as ~30 new tables land quickly | Low / Critical | RLS policy is templated in migration scaffold; W13 dedicated isolation audit + automated cross-tenant probe tests in CI on every new table |
| R4 | **Pack upgrades clobber tenant overrides** (clinic edited a seeded price/template, platform ships v1.1) | Med / High | Three-way merge (base vN, tenant override, base vN+1) with audit trail; W14 rehearsal is a release blocker |
| R5 | **Dev C single-point-of-failure on Dental** | Med / Med | Odontogram design reviewed by Dev B at W4/W8; Dental slipping does not block Wave A GA (independent lane, own v2.4 date) |
| R6 | **Content bottleneck** — one author, 40 days of content with clinical review cycles | Med / Med | Authoring UI (W2) enables the clinical lead to work self-serve; content freeze W14; borrow the aesthetic pack's reviewed content patterns |
| R7 | **WhatsApp (Meta Cloud API) template approvals** lag recall features | Med / Low | Submit EPI-recall and follow-up templates for Meta approval in W1, not when the feature lands |

#### Clinical-safety review gates (hard release blockers)

Each gate = sign-off by the designated clinical reviewer (PMDC-registered, specialty-relevant) + engineering evidence pack. **No pack GAs without its gate minute recorded.**

- **G-SCCL / computation gates (deepest scrutiny — these can hurt patients):**
  - **Dose Calculator (W8):** golden-file test suite of ≥50 pediatric dosing scenarios (including neonate, obese-child cap, renal flag) verified line-by-line by a pediatrician against BNF-C/local formulary; hard max-dose caps are engine-enforced, not content-optional; rounding rules explicit and displayed to the clinician with the working shown.
  - **LMS engine (W7):** outputs bit-matched to WHO published z-score tables across the full 0–5y grid, both sexes, all four measures; prematurity age-correction reviewed; disagreement > 0.01 z is a failed gate.
  - **EPI schedule engine (W9–10):** computed due-dates for a battery of synthetic DOBs (including catch-up, delayed starts, minimum-interval violations) reviewed against the Pakistan EPI 2025–26 schedule by an EPI-experienced pediatrician; **status is a projection, never stored truth** — verified by mutating DOB and confirming recomputation; lot/expiry: expired lot cannot be recorded without an explicit override + audit entry.
  - **Phototherapy engine (W5):** cumulative-dose ledger cannot be edited destructively; burn-guardrail (max increment %, skin-type ceiling) is engine-enforced; dermatologist signs the escalation table.
- **G1 Dermatology (W6):** every scored instrument validated against a published worked example; severity bands quoted to source; templates reviewed by dermatologist.
- **G2 Physio (W6):** instrument scoring validated (ODI %, WOMAC normalization); HEP content reviewed; laterality rendering spot-checked (a LEFT knee never prints as right).
- **G3 Pediatrics (W9):** growth-widget plotting reviewed against paper charts by pediatrician; dose catalog content sign-off (distinct from engine gate); milestone red-flags reviewed.
- **G4 EPI (W11):** certificate format reviewed for official acceptability; AEFI form maps to national reporting fields; defaulter logic reviewed (no false "overdue" that triggers wrong recalls to parents).
- **G5 Dental (W12):** odontogram semantics (FDI numbering, surface codes, primary vs permanent) reviewed by dentist; billing-by-tooth reviewed for over/under-billing edge cases.
- **G6 Ophthalmology (W14):** the **highest-risk rendering gate** — OD/OS mapping (OD=RIGHT, OS=LEFT) verified at every surface: entry UI, stored value, trend chart, printed Rx, dispensing order. A single transposed eye on a glasses prescription is patient harm; this gets an adversarial test where a reviewer deliberately hunts for one transposition end-to-end. Sign/amend workflow: signed exams immutable, amendments audit-trailed.
- **Cross-cutting standing rules:** (a) any change to a safety-gated engine's compute path re-triggers its gate; (b) safety guardrails (dose caps, burn limits, expiry blocks, sign-immutability) live in **engine code**, never in overridable pack content; (c) all patient-facing generated documents (Rx, certificate, HEP) carry the prescriber's name/PMDC number and are reviewed in print form, since paper is still the interoperability layer in Pakistani practice.

**Bottom line:** ~16 weeks, 26 dev-weeks of code and 40 author-days delivers five GA packs plus Dental on track for Q4 — and, more importantly, proves that pack N+1 is an authoring exercise. The gates are non-negotiable; everything else in this plan is allowed to flex around them.



---



# Part II — The Pack System & Shared Components

## Pack Manifest & Authoring System

The meta-layer that lets Health OS ship every specialty as **configuration + content on the one shared clinical core**, with zero code forks per specialty. This section defines the manifest schema, its DB storage, the onboarding activation/seeding flow, tenant-safe versioning/upgrades, and the non-engineer authoring workflow — then proves the pattern with the **complete Aesthetic & Cosmetic pack manifest** (the flagship reference).

---

### Purpose & scope

The Pack System is a platform-internal capability (not a clinical module) used by **every tenant type**: a **single** clinic activates one pack, a **polyclinic** multi-selects several, a **hospital** maps packs to departments. A pack is a signed, versioned JSON manifest that declares intake fields, note templates, a service/procedure catalog with PKR pricing, order sets, seed data, entitlement gating, and *optional* references to already-built **shared components** (laterality, Trends charting, Scored-Instrument engine, dose calculator, growth-percentile engine, before/after+consent). "Light" packs are pure config authored by a clinical lead; "Heavy" packs additionally reference one prebuilt widget. This section is the contract the platform team implements once so the 31-pack roadmap becomes an authoring exercise, not an engineering one.

---

### Data model — Prisma-style

Everything carries `tenant_id` (RLS-enforced, pooled Postgres) and, for clinical rows, `clinic_id` (branch beneath tenant). Pack **definitions** are global (platform-owned, not tenant-scoped); pack **activations, config overrides, and authored drafts** are tenant-scoped.

```prisma
// ===== NEW — platform-global registry (no tenant_id; RLS bypass via platform role) =====
model Pack {                       // one row per pack family
  id            String   @id      // "aesthetic", "dental", "peds-vax" (== packId)
  name          String
  category      String            // "aesthetic" | "dental" | "obgyn" ...
  isLight       Boolean           // true = config-only, no widget
  latestVersion String            // semver pointer, e.g. "1.4.0"
  status        PackStatus        // DRAFT | PUBLISHED | DEPRECATED
  createdAt     DateTime @default(now())
  versions      PackVersion[]
}

model PackVersion {               // immutable published artifact
  id            String   @id @default(cuid())
  packId        String
  version       String            // semver "1.4.0"
  manifest      Json              // the FULL manifest document (schema below)
  manifestHash  String            // sha256 of canonicalized manifest — integrity + dedupe
  changelog     String
  migration     Json?             // upgrade ops from previous version (see Upgrades)
  minCoreVersion String           // guards against activating on too-old a core
  signedBy      String            // platform author/approver id
  publishedAt   DateTime @default(now())
  @@unique([packId, version])
  @@index([packId])
  pack          Pack     @relation(fields:[packId], references:[id])
}

model PackDependency {            // shared-component & inter-pack deps, resolved at activation
  id           String @id @default(cuid())
  packVersionId String
  kind         PackDepKind        // SHARED_COMPONENT | ENTITLEMENT | PACK | CORE_MODEL
  ref          String             // "component.beforeAfterConsent" | "ent.aesthetic.core" | "pack.derma>=1.0"
  optional     Boolean @default(false)
  @@index([packVersionId])
}

// ===== NEW — tenant-scoped activation & overrides =====
model TenantPack {                // a pack switched on for a tenant (+ optionally a specific clinic/dept)
  id            String   @id @default(cuid())
  tenant_id     String            // RLS
  clinic_id     String?           // null = tenant-wide; set = one branch/department
  packId        String
  version       String            // pinned running version (may lag latestVersion)
  status        TenantPackStatus  // ACTIVE | SUSPENDED | PENDING_UPGRADE
  activatedAt   DateTime @default(now())
  activatedBy   String
  seededAt      DateTime?
  configOverride Json?            // tenant edits: price deltas, hidden catalog items, renamed templates
  @@unique([tenant_id, clinic_id, packId])
  @@index([tenant_id])
}

model PackSeedRecord {            // idempotency ledger — what this activation actually created
  id            String @id @default(cuid())
  tenant_id     String
  tenantPackId  String
  entity        String            // "ServiceCatalogItem" | "NoteTemplate" | "IntakeFieldDef" ...
  sourceKey     String            // stable key from manifest, e.g. catalog item "aes.botox.upperface"
  targetId      String            // id of the row created in the shared core
  version       String            // pack version that seeded it
  @@unique([tenant_id, tenantPackId, entity, sourceKey])
  @@index([tenant_id, tenantPackId])
}

model PackAuthoringDraft {        // the non-engineer authoring surface
  id            String @id @default(cuid())
  tenant_id     String?           // null = platform-authored global pack; set = tenant's private pack
  packId        String
  manifest      Json              // work-in-progress manifest
  validation    Json?             // last lint/validation result
  state         DraftState        // EDITING | VALIDATED | SUBMITTED | APPROVED | REJECTED
  authorId      String
  updatedAt     DateTime @updatedAt
}

enum PackStatus       { DRAFT PUBLISHED DEPRECATED }
enum TenantPackStatus { ACTIVE SUSPENDED PENDING_UPGRADE }
enum PackDepKind      { SHARED_COMPONENT ENTITLEMENT PACK CORE_MODEL }
enum DraftState       { EDITING VALIDATED SUBMITTED APPROVED REJECTED }
```

**How pack content ties to the core.** Packs never create parallel clinical tables. They *seed rows* into and *drive config on* existing canonical models, recorded in `PackSeedRecord` for clean upgrade/rollback:

- **Intake fields** → seed `IntakeFieldDef` (EXISTING; a typed custom-field registry keyed to `Patient`/`Encounter`); values land on the FHIR-aligned `Observation`/`QuestionnaireResponse` core, not on bespoke columns.
- **Note templates** → seed `NoteTemplate` (EXISTING) rows referenced by `ClinicalNote.templateId` on each `Encounter`.
- **Service catalog** → seed `ServiceCatalogItem` (EXISTING; `code`, `name`, `priceMinorPKR`, `taxClass`, `consumesInventory[]`) — the same table Billing prices from and Treatment Plans compose packages from.
- **Order sets** → seed `OrderSet` (EXISTING) → expands to `ServiceRequest`/`MedicationRequest` on the encounter.
- **Scored instruments** (GAGS, Fitzpatrick, satisfaction) → seed `InstrumentDefinition` (EXISTING shared Scored-Instrument engine) consumed by the widget and by Trends.
- **Widget** references only prebuilt shared components via `PackDependency(kind=SHARED_COMPONENT)`; no per-pack React fork.

`tenant_id` on every seeded row; `clinic_id` where the activation is department/branch-scoped. **Laterality**: aesthetic uses the core's first-class laterality enum (`left|right|midline`, plus OD/OS/AD/AS available) on injectable/treatment-site rows so per-side dose and per-side before/after are native, not free text.

---

### Widget UI spec — Pack Console + the Aesthetic widget it embeds

Two surfaces: (1) a **platform Pack Console** (admin) for activation/versioning; (2) the **in-consultation widget** the flagship pack embeds. Both are desktop + tablet (MUI, ≥768px two-pane; below, stacked single column).

**Pack Console (Owner/Admin, web).** Layout: left rail = installed packs with version chip + "Upgrade available" badge; main = tabbed pack detail (Overview / Catalog / Templates / Intake / Order sets / Widgets / Seeded records / Version history). Activation is a 3-step wizard (Select scope → Preview diff of what will be seeded → Confirm & seed) with a live count ("will create 14 catalog items, 4 templates, 6 intake fields"). States: **not-installed** (Activate CTA, entitlement lock icon if not entitled), **seeding** (progress + cancel), **active**, **pending-upgrade** (Review changes), **suspended**. Empty state: "No packs active — choose your clinic's specialty." Error state: seeding failure shows which `sourceKey` failed and a **Retry** that resumes idempotently from `PackSeedRecord` (never double-seeds).

**Aesthetic consultation widget (Heavy pack's one custom component).** Embeds in the consultation screen as a right-hand **"Aesthetic"** tab beside Notes/Orders/Billing, bound to the open `Encounter`. Three stacked panels:

1. **Before/After + Consent** (reuses the built component): side-by-side capture slots with laterality/region tag, consent status pill (Signed ✓ / Required ✗), procedure-linked. Blocks injectable logging until consent = Signed for consent-required services. Empty: "No baseline photos — capture to enable comparison." Error: upload retry, offline queue.
2. **Injectable / Lot Ledger**: a repeating line editor — Product (Botox/Dysport/filler, typeahead from inventory), **Lot** (dropdown of in-stock, non-expired batches only — expired/low batches greyed with reason), Units/mL, **Site** (face-map picker with laterality: L/R/midline glabella, forehead, etc.), depth. Running totals per product + remaining-in-vial. Validation: units > available batch qty blocked; reconstituted-vial "use within 24h" flag surfaced from batch metadata; total units sanity band per area with soft warning. Each committed line decrements `InventoryBatch` and writes an `Administration` row with lot + laterality.
3. **Assessment strip**: Fitzpatrick type (I–VI), Glogau photoaging (I–IV), optional GAGS if acne indication — all rendered by the shared Scored-Instrument engine; results feed the Longitudinal Trends chart (e.g., GAGS over sessions). Interactions autosave (debounced); optimistic UI with per-line commit; full keyboard nav; all numeric fields validated inline. Loading = skeleton rows; error = inline banner + safe retry, never silent data loss.

---

### Pack manifest contents — the JSON schema (spec) + worked Aesthetic example

**Manifest top-level schema** (stored in `PackVersion.manifest`):

```jsonc
{
  "packId": "string",              // stable slug
  "version": "semver",
  "name": "string",
  "category": "string",
  "editions": ["Specialty","Clinic"],   // which product editions may activate it
  "entitlementKey": "string",      // feature-flag gate, e.g. "pack.aesthetic"
  "minCoreVersion": "semver",
  "dependencies": [ {"kind":"SHARED_COMPONENT","ref":"...","optional":false} ],
  "intakeFields": [ {"key","label","type","options?","fhir?","required","showIf?"} ],
  "instruments": [ {"key","engineRef","displayIn"} ],   // Scored-Instrument defs (by ref or inline JSON)
  "noteTemplates": [ {"key","name","sections":[...] } ],
  "serviceCatalog": [ {"key","code","name","priceMinorPKR","taxClass","consumesInventory?","consentRequired?"} ],
  "orderSets": [ {"key","name","items":[{"type","ref","qty?"}]} ],
  "widgets": [ {"key","slot","component","props?","requiredEntitlement?"} ],
  "seedData": { "membershipPlans":[...], "batchProductTypes":[...] },
  "config": { "lateralityEnabled":true, "photoConsentPolicy":"..." }
}
```

**WORKED EXAMPLE — `aesthetic` pack v1.0.0 (abridged to key content, prices in PKR).**

```jsonc
{
  "packId":"aesthetic","version":"1.0.0","name":"Aesthetic & Cosmetic",
  "category":"aesthetic","editions":["Specialty","Clinic"],
  "entitlementKey":"pack.aesthetic","minCoreVersion":"1.0.0",
  "dependencies":[
    {"kind":"SHARED_COMPONENT","ref":"component.beforeAfterConsent"},
    {"kind":"SHARED_COMPONENT","ref":"component.scoredInstrument"},
    {"kind":"SHARED_COMPONENT","ref":"component.trendsChart"},
    {"kind":"CORE_MODEL","ref":"model.inventoryBatch"},
    {"kind":"CORE_MODEL","ref":"model.laterality"}
  ],

  "intakeFields":[
    {"key":"aes.skintype","label":"Fitzpatrick skin type","type":"enum",
      "options":["I","II","III","IV","V","VI"],"required":true,"fhir":"Observation"},
    {"key":"aes.glogau","label":"Glogau photoaging","type":"enum","options":["I","II","III","IV"]},
    {"key":"aes.concern","label":"Primary concern","type":"multiselect",
      "options":["Fine lines","Volume loss","Acne","Pigmentation","Hair removal","Skin laxity"]},
    {"key":"aes.priorTx","label":"Prior aesthetic treatments","type":"text"},
    {"key":"aes.pregLact","label":"Pregnant / breastfeeding","type":"boolean","required":true},
    {"key":"aes.anticoag","label":"On blood thinners / NSAIDs","type":"boolean"},
    {"key":"aes.allergyLido","label":"Lidocaine allergy","type":"boolean","required":true},
    {"key":"aes.keloid","label":"Keloid / hypertrophic scarring history","type":"boolean"},
    {"key":"aes.coldsore","label":"Herpes/cold-sore history (perioral)","type":"boolean"},
    {"key":"aes.expectations","label":"Goals / expectations","type":"text"}
  ],

  "instruments":[
    {"key":"aes.fitzpatrick","engineRef":"instrument.fitzpatrick.v1","displayIn":"widget.assessment"},
    {"key":"aes.gags","engineRef":"instrument.gags.v1","displayIn":"widget.assessment"},
    {"key":"aes.satisfaction","engineRef":"instrument.aes.satisfaction.v1","displayIn":"recall"}
  ],

  "noteTemplates":[
    {"key":"aes.consult","name":"Aesthetic Consultation",
      "sections":["Concerns & goals","Skin assessment (Fitzpatrick/Glogau)","Exam & photos",
                  "Contraindication screen","Plan & quote","Consent captured"]},
    {"key":"aes.injectable","name":"Injectable Treatment Note",
      "sections":["Indication","Product & lot","Sites & units (per side)","Technique/depth",
                  "Adverse events","Post-care given","Review date"]},
    {"key":"aes.laser","name":"Energy/Laser Session Note",
      "sections":["Device & settings","Fitzpatrick check","Test spot","Areas treated",
                  "Endpoint","Cooling/post-care","Next session interval"]},
    {"key":"aes.followup","name":"Aesthetic Follow-up / Review",
      "sections":["Result vs baseline","Satisfaction","Touch-up needed","Rebook"]}
  ],

  "serviceCatalog":[
    {"key":"aes.consult","code":"AES-CONSULT","name":"Aesthetic Consultation","priceMinorPKR":300000,"taxClass":"service"},
    {"key":"aes.botox.upper","code":"AES-BTX-UF","name":"Botulinum Toxin – Upper Face (3 areas)","priceMinorPKR":4500000,"taxClass":"service","consumesInventory":["neurotoxin"],"consentRequired":true},
    {"key":"aes.botox.perarea","code":"AES-BTX-AREA","name":"Botulinum Toxin – per additional area","priceMinorPKR":1800000,"consumesInventory":["neurotoxin"],"consentRequired":true},
    {"key":"aes.filler.1ml","code":"AES-HAF-1ML","name":"Dermal Filler (HA) – 1 mL","priceMinorPKR":6500000,"consumesInventory":["ha_filler"],"consentRequired":true},
    {"key":"aes.lipfiller","code":"AES-LIP","name":"Lip Filler – 1 mL","priceMinorPKR":6000000,"consumesInventory":["ha_filler"],"consentRequired":true},
    {"key":"aes.prp.face","code":"AES-PRP","name":"PRP – Face","priceMinorPKR":2500000,"consentRequired":true},
    {"key":"aes.microneedling","code":"AES-MN","name":"Microneedling (RF optional)","priceMinorPKR":2000000,"consentRequired":true},
    {"key":"aes.hydrafacial","code":"AES-HF","name":"HydraFacial / Signature Facial","priceMinorPKR":1500000},
    {"key":"aes.chempeel","code":"AES-PEEL","name":"Chemical Peel (medium)","priceMinorPKR":1200000,"consentRequired":true},
    {"key":"aes.laserhair.sm","code":"AES-LHR-S","name":"Laser Hair Removal – small area/session","priceMinorPKR":800000},
    {"key":"aes.laserhair.full","code":"AES-LHR-FB","name":"Laser Hair Removal – full body/session","priceMinorPKR":3500000},
    {"key":"aes.pigment.laser","code":"AES-PIG","name":"Pigmentation/Q-switch Laser – session","priceMinorPKR":1500000,"consentRequired":true},
    {"key":"aes.skinboost","code":"AES-SB","name":"Skin Booster (mesotherapy)","priceMinorPKR":3000000,"consumesInventory":["ha_filler"],"consentRequired":true},
    {"key":"aes.threadlift","code":"AES-THR","name":"PDO Thread Lift – per thread","priceMinorPKR":1500000,"consumesInventory":["pdo_thread"],"consentRequired":true},
    {"key":"aes.consult.review","code":"AES-REVIEW","name":"Follow-up Review (within 2 wks)","priceMinorPKR":0,"taxClass":"service"}
  ],

  "orderSets":[
    {"key":"aes.acne.starter","name":"Acne Program – Starter",
      "items":[{"type":"service","ref":"aes.consult"},{"type":"instrument","ref":"aes.gags"},
               {"type":"service","ref":"aes.chempeel","qty":3}]},
    {"key":"aes.antiaging.injectable","name":"Anti-aging Injectable Combo",
      "items":[{"type":"service","ref":"aes.botox.upper"},{"type":"service","ref":"aes.filler.1ml"}]}
  ],

  "widgets":[
    {"key":"aes.widget","slot":"consultation.rightTab","component":"AestheticWidget",
      "props":{"panels":["beforeAfterConsent","injectableLedger","assessment"]},
      "requiredEntitlement":"pack.aesthetic"}
  ],

  "seedData":{
    "membershipPlans":[
      {"key":"aes.mem.gold","name":"Gold Membership (annual)","priceMinorPKR":15000000,
       "benefits":["10% off services","1 free HydraFacial/qtr","priority booking"],"autoRenew":true},
      {"key":"aes.pkg.btx3","name":"Botox 3-Session Package","priceMinorPKR":12000000,"sessions":3}
    ],
    "batchProductTypes":[
      {"code":"neurotoxin","name":"Botulinum toxin","unit":"units","reconHours":24,"coldChain":"2-8C"},
      {"code":"ha_filler","name":"HA dermal filler","unit":"mL","coldChain":"room"},
      {"code":"pdo_thread","name":"PDO thread","unit":"pcs"}
    ]
  },

  "config":{"lateralityEnabled":true,"photoConsentPolicy":"required_before_injectable"}
}
```

**Entitlement key:** `pack.aesthetic` (bundled into the Specialty edition; individually grantable to a Clinic-edition tenant as an add-on line on the subscription).

---

### Integrations

- **Billing:** seeded `ServiceCatalogItem`s are the single pricing source; packages/memberships from `seedData` become `TreatmentPlan`/subscription lines. Product-sale items flow to **FBR e-invoicing** where applicable (goods/pharmacy); clinical services route to provincial PRA tax class (`taxClass:"service"`). Membership `autoRenew:true` drives the recurring engine.
- **Inventory/consumables:** catalog `consumesInventory[]` + `batchProductTypes` wire the injectable ledger to `InventoryBatch` (batch/expiry, cold-chain 2–8°C, reconstituted 24h window). Committing a ledger line decrements the exact lot and blocks expired/insufficient batches.
- **WhatsApp journeys/recall (Meta Cloud API):** pack declares clinical triggers → recall at session-interval (e.g., filler review at 2 weeks, laser next-session), satisfaction instrument push, membership renewal nudge, no-show deposit reminders. Journeys reference instrument keys and catalog keys so content stays pack-driven.
- **Treatment plans:** multi-session packages (Botox 3-session, acne program order set) become plan templates; each session consumes one plan slot and logs consumables.
- **Reports:** Longitudinal Trends renders GAGS/satisfaction over sessions; per-injector units-by-lot, consumable margin, package burn-down, before/after audit trail.

---

### Clinical safety & edge cases

- **Consent gate:** `consentRequired:true` services block injectable/photo logging until a signed consent is attached (`photoConsentPolicy:required_before_injectable`).
- **Contraindication screen:** pregnancy/lactation, lidocaine allergy, anticoagulants, keloid history, active perioral herpes surfaced as hard/soft stops on the consult template before booking injectables.
- **Lot integrity:** expired or reconstituted-past-24h neurotoxin lots are non-selectable; cold-chain excursion flag from inventory disables the batch. Units administered can never exceed batch balance.
- **Laterality correctness:** per-side site logging prevents "both sides" ambiguity in dose totals and before/after comparison.
- **Fitzpatrick safety for lasers:** high-phototype (IV–VI) triggers a test-spot reminder on the laser template (burn/PIH risk).
- **Upgrade safety:** tenant `configOverride` (renamed templates, custom prices, hidden items) is preserved across upgrades; seeding is idempotent via `PackSeedRecord` (retry never duplicates); never overwrites tenant-edited rows without a flagged diff.
- **Entitlement loss:** if `pack.aesthetic` lapses, existing clinical data stays readable (never deleted); widget + new-order authoring go read-only.

---

### Effort — S/M/L + dev-weeks (config vs new code)

| Piece | Size | Weeks | Config / New code |
|---|---|---|---|
| Manifest JSON schema + validator/linter | M | 1.5 | New code |
| Pack registry tables + migrations (Pack/PackVersion/deps) | S | 1 | New code |
| Tenant activation + idempotent seeding engine (`PackSeedRecord`) | L | 3 | New code |
| Versioning/upgrade + migration-op runner (config-preserving) | L | 2.5 | New code |
| Pack Console UI (activation wizard, version/diff, seeded-records) | M | 2 | New code |
| Authoring workspace (draft/validate/submit/approve) + Light-pack editor | M | 2 | New code |
| Entitlement wiring into feature-flag engine | S | 0.5 | Config + glue |
| **Aesthetic widget** (3 panels; reuses built shared components) | M | 2 | New code (thin) |
| **Aesthetic manifest authoring** (fields/templates/catalog/order sets/seed) | S | 1 | **Config only** |
| Instrument defs (Fitzpatrick/GAGS/satisfaction) via shared engine | S | 0.5 | **Config only** |
| **Total** | | **~16 dev-weeks** | Platform once; each later Light pack ≈ 1–1.5 wk config |

The platform build is one-time (~14 wk); the Aesthetic pack itself is ~2 wk (mostly config + a thin widget over already-built components). Subsequent Light packs are pure config.

---

### Acceptance criteria — end-to-end demo script

1. **Onboarding/activation:** Create a Specialty-edition tenant "Aesthetics Clinic, Faisalabad"; onboarding asks specialty → select Aesthetic. Pack Console shows the activation wizard previewing "will create 15 catalog items, 4 templates, 10 intake fields, 2 order sets, 2 membership plans." Confirm → seeding completes; `PackSeedRecord` shows every row. Re-run activation → **no duplicates** (idempotent).
2. **Entitlement gate:** Temporarily revoke `pack.aesthetic` → widget locks read-only, catalog authoring disabled; restore → back to active.
3. **Clinical flow:** New patient "Ayesha Khan"; consult uses **Aesthetic Consultation** template; intake captures Fitzpatrick IV + contraindication screen (pregnancy = No). Widget captures baseline photos, consent signed → injectable panel unlocks.
4. **Injectable + lot:** Log Botox upper face — select in-stock lot; attempt an expired lot → blocked; log 20 units L/10 R glabella with laterality; inventory batch decrements exactly; administration row written with lot.
5. **Billing/package:** Sell "Botox 3-Session Package" (PKR 120,000) → treatment plan with 3 slots; this session burns slot 1; service invoice generated with correct tax class.
6. **Recall:** 2-week review WhatsApp journey queued via Meta Cloud API against the review catalog key; satisfaction instrument scheduled.
7. **Trends:** Second visit logs GAGS; Longitudinal Trends renders GAGS across the two sessions.
8. **Versioning:** Publish `aesthetic` v1.1.0 (adds "Exosome Therapy" catalog item, renames a template). Tenant had a `configOverride` price on filler + a hidden item. Run upgrade → new item appears, tenant's price override and hidden state preserved, template rename flagged for review, no data loss; version chip shows 1.1.0.
9. **Authoring:** A non-engineer clinical lead opens the authoring workspace, drafts a **Light** "Skin Booster Add-on" mini-pack (2 catalog items + 1 template + 1 intake field) entirely in the config editor, validator passes, submits for approval — **no code deployed**.

---

### Sources

- Fitzpatrick I–VI & Glogau photoaging scales: [MDPI Cosmetics — skin-type rating scales](https://www.mdpi.com/2079-9284/10/1/14); [Dermapenworld — Glogau scale](https://www.dermapenworld.com/en-us/blog/skin-ageing-glogau-scale)
- GAGS (locations, factors, 0–4 lesion grade, severity bands 1–18/19–30/31–38/≥39): [PMC — Acne Grading Scale review 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10995619/); [K B Lim Skin Clinic — GAGS](https://kblimskinclinic.com/global-acne-grading-system-gags/)
- Botulinum toxin reconstitution, 2–8°C cold chain, 24h post-reconstitution use, lot/expiry traceability: [BOTOX Cosmetic HCP reconstitution guide (Allergan)](https://www.botoxcosmetichcp.com/content/dam/hcp-botox-cosmetic/documents/BTXC%20Reconstitution%20Guide.pdf); [Pipeline Medical — safe BOTOX storage](https://pipelinemedical.com/blog/essential-tips-for-safe-botox-storage/); [Drugs.com — Botox dosage guide](https://www.drugs.com/dosage/botox.html)



---



## Shared Clinical Component Layer (SCCL)

The reusable, once-built engines every specialty pack composes over the Health OS canonical clinical core. Nothing here is specialty-specific: it is the horizontal substrate that lets Ophthalmology, ENT, Nephro/Urology, Peds, Psych, Ortho/Physio, Derm and others ship as **config + content**, never code forks. This spec covers five components: (1) first-class **Laterality**, (2) **Longitudinal Trends** engine, (3) **Scored-Instrument** engine, (4) **Weight-based Dose Calculator**, (5) **Growth-Percentile (WHO LMS)** engine.

---

### Purpose & scope

The SCCL is a platform-tier capability set consumed by **every clinic type** — single-specialty clinics, polyclinics (multi-select packs), and hospital departments. These components are not activated per-clinic as products; they ship with the core and are *drawn upon* by whichever specialty packs a tenant enables. Each component is entitlement-aware so a pack can declare its dependency (e.g. Peds pack requires `sccl.growth`), but the code and tables exist once in the shared platform and carry `tenant_id` + RLS like all core data.

---

### Component 1 — First-class Laterality

#### Purpose & scope
Laterality (which side of a paired anatomical structure a finding/order/observation refers to) must be a **structured, queryable, first-class attribute** on the canonical model, not free text in a note. Used heavily by Ophthalmology (OD/OS/OU), ENT (AD/AS/AU), Ortho/Physio/Podiatry/Derm (left/right/bilateral), Dental (per-tooth, FDI notation) and Nephro (native left/right kidney, plus AV-fistula side). One representation, rendered per-specialty.

#### Data model
FHIR-R4 aligns laterality via `bodySite` + SNOMED laterality qualifiers (`7771000` left, `24028007` right, `51440002` bilateral). We store a compact enum plus optional bodySite for precision.

```prisma
// NEW enum — canonical internal representation (specialty labels are a render concern)
enum Laterality {
  LEFT          // OS / AS / left
  RIGHT         // OD / AD / right
  BILATERAL     // OU / AU / both
  MIDLINE       // e.g. nose, midline lesion
  UNSPECIFIED
}

// EXISTING core models get a nullable laterality column (add via migration, non-breaking)
model Observation {           // EXISTING — extended
  id            String   @id @default(cuid())
  tenantId      String                              // EXISTING, RLS
  patientId     String
  encounterId   String?
  laterality    Laterality?                         // NEW
  bodySiteCode  String?                             // NEW — SNOMED/FDI code for precision
  bodySiteText  String?                             // NEW — human label ("upper lateral incisor")
  // ...existing observation fields (code, value, unit, effectiveDateTime)
  @@index([tenantId, patientId, code, laterality])  // NEW composite for laterality-scoped trends
}

model ServiceRequest {        // EXISTING (order sets) — extended
  laterality    Laterality?                         // NEW — "X-ray LEFT knee"
  bodySiteCode  String?
}
model Condition   { laterality Laterality?  bodySiteCode String? }  // NEW cols
model Procedure   { laterality Laterality?  bodySiteCode String? }  // NEW cols
model MediaAsset  { laterality Laterality?  }                        // NEW — before/after photo per side

// NEW — pack-scoped label map so each specialty renders the enum in its own vocabulary
model LateralityDisplayProfile {
  id        String @id @default(cuid())
  tenantId  String
  packKey   String              // "ophthalmology" -> {RIGHT:"OD", LEFT:"OS", BILATERAL:"OU"}
  labels    Json                // { "RIGHT":"OD", "LEFT":"OS", "BILATERAL":"OU", "MIDLINE":"—" }
  @@unique([tenantId, packKey])
}
```

**Ties:** `Observation.laterality` lets a single patient carry two independent series (e.g. IOP-OD and IOP-OS) that the Trends engine plots as distinct lines. Orders/procedures carry laterality into billing line items (a bilateral procedure can price ×2 or as a bundled bilateral code). Dental uses `bodySiteCode` = FDI two-digit tooth number (11–48) with `laterality` derived from quadrant.

#### Widget UI spec
Not a standalone widget — a **reusable form control** (`<LateralityPicker>`) embedded wherever a finding/order/photo is captured. Segmented control: `L | Both | R` (or `OS | OU | OD` when a display profile is bound). Keyboard: L/R/B hotkeys. For dental, a clickable odontogram supplies the bodySite. States: default UNSPECIFIED (amber hint "select side"), selected (filled), disabled (readonly view). Validation: packs may mark laterality **required** for specific observation codes (e.g. IOP requires a side) — save blocked with inline error "Side is required for IOP".

#### Pack manifest contents
Laterality is manifest-configured, not a pack itself. Each pack manifest declares:
```json
"laterality": {
  "displayProfile": { "RIGHT":"OD","LEFT":"OS","BILATERAL":"OU" },
  "requiredForCodes": ["IOP","VA","REFRACTION"],
  "defaultForCatalog": { "svc.iop": "BILATERAL" }
}
```
No dedicated service catalog; laterality *modifies* catalog items (bilateral multiplier).

#### Integrations
- **Billing:** laterality on `ServiceRequest`/`Procedure` drives a bilateral pricing rule (config: `bilateralMultiplier` or explicit bilateral SKU).
- **Reports:** every observation query can group/filter by side; report headers render side via the display profile.
- **Photos:** before/after consent module tags each image with side for side-by-side compare.

#### Clinical safety & edge cases
Wrong-side errors are a never-event class — require explicit side on surgical/laser order sets (no silent default). BILATERAL must expand to two billable/consumable events where clinically two things happen (two IOLs, two injections). Guard against mixing MIDLINE with paired-only codes.

#### Effort
**S** (2 dev-weeks). Mostly config: enum + nullable columns + one reusable picker + display-profile lookup. New code is small; the odontogram bodySite picker is the only non-trivial UI (part of Dental pack, not core).

---

### Component 2 — Longitudinal Trends engine

#### Purpose & scope
A generic **observation-series → chart** engine: any repeated numeric (or scored-instrument) value over time becomes a plotted, threshold-annotated trend. Consumed by nearly every pack: IOP over visits (Ophtho), eGFR/creatinine/BP (Nephro), HbA1c/weight (Endo/Chronic), PHQ-9/GAD-7 trajectory (Psych), IPSS (Urology), peak-flow (Pulmo), pain/NPRS (Ortho/Physio). Growth charts are a *specialized* renderer of this engine (Component 5).

#### Data model
Reuses canonical `Observation` (no new storage for the series itself). Adds config + optional annotations.

```prisma
model Observation {           // EXISTING — the time series is just observations sharing a code
  // code, valueQuantity, unit, effectiveDateTime, laterality, patientId, encounterId
}

// NEW — declarative chart definition, shipped by packs, tenant-overridable
model TrendChartDefinition {
  id            String  @id @default(cuid())
  tenantId      String
  key           String                 // "iop_trend", "egfr_trend"
  title         String                 // "Intraocular Pressure"
  observationCodes String[]            // one or more codes to plot as series
  unit          String                 // display unit
  splitByLaterality Boolean @default(false)  // true -> one line per side
  yMin          Float?
  yMax          Float?
  referenceBands Json?                 // [{label:"Normal",low:10,high:21,color:"green"}]
  targetLines   Json?                  // [{label:"Target",value:18}]
  aggregation   String  @default("raw")// raw | dailyMean | lastPerVisit
  @@unique([tenantId, key])
}

// NEW — optional clinician annotation pinned to a point/date (e.g. "started latanoprost")
model TrendAnnotation {
  id            String  @id @default(cuid())
  tenantId      String
  patientId     String
  chartKey      String
  atDateTime    DateTime
  label         String
  linkedResourceId String?             // MedicationRequest / Procedure that explains the change
}
```

#### API surface
```
GET  /api/trends/definitions?packKey=ophthalmology         -> TrendChartDefinition[]
GET  /api/trends/{chartKey}/patient/{patientId}
       ?from=&to=&laterality=OD                             -> { series:[{laterality, points:[{t,value,encounterId}]}],
                                                                  referenceBands, targetLines, annotations }
POST /api/trends/annotations                                -> create TrendAnnotation
GET  /api/trends/{chartKey}/patient/{patientId}/summary     -> { latest, delta, minMax, slope, nPoints }
```
Server computes aggregation, joins annotations, resolves reference bands (may be age/sex-parameterized). All queries RLS-scoped by `tenantId`.

#### Widget UI spec
`<TrendChart>` card embeddable in the consultation screen's "Trends" tab and in the patient summary rail. Layout: title + unit, line chart with reference bands as shaded horizontal zones, target line dashed, points clickable → popover (value, date, encounter link, side). Multi-series legend when `splitByLaterality` (OD solid, OS dashed). Controls: date-range chips (3m/6m/1y/all), toggle per series. Empty state: "No {title} recorded yet — values captured in this encounter will appear here." Error state: retry banner. Desktop: full card; tablet: same, horizontal scroll under `overflow-x:auto`; long series virtualized. Reads latest-value delta badge (▲/▼ vs previous).

#### Pack manifest contents
Packs ship `TrendChartDefinition` rows (intake/observation codes must exist in the pack's catalog). No separate service catalog. Entitlement key: **`sccl.trends`** (bundled into core; individual packs list it as dependency).

#### Integrations
- **Treatment plans:** a plan milestone can require "IOP < 18 for 2 visits" — engine's `/summary` slope/latest feeds plan progress.
- **WhatsApp recall:** an out-of-range latest value can trigger a recall journey ("your reading needs review").
- **Reports:** trend PNG/SVG export embeds in visit summary and referral letters.
- **Scored-Instrument:** instrument total scores are written back as `Observation` rows so PHQ-9 etc. trend for free.

#### Clinical safety & edge cases
Never interpolate across large gaps as if continuous — render gaps. Reference bands must be unit-locked (reject mmHg vs kPa mismatch). Age/sex-dependent bands (eGFR, BP-for-age) resolve at query time. Show n and last-updated so a single stale point isn't over-read.

#### Effort
**M** (3–4 dev-weeks). Config-driven definitions; new code is the aggregation service, banded chart renderer, and annotation CRUD. Chart renderer reused by Growth engine.

---

### Component 3 — Scored-Instrument engine

#### Purpose & scope
A JSON-defined engine that turns **any questionnaire/calculator** into a renderable, auto-scored, severity-banded instrument with zero code per instrument. Powers PHQ-9, GAD-7 (Psych), IPSS (Urology), Oswestry/ODI + NPRS (Ortho/Physio), GAGS + PASI (Derm), Apgar, and clinic-built custom forms. One definition schema, one scoring service, one render component. Used by every pack that screens/scores.

#### Data model
```prisma
// NEW — versioned instrument definition (platform-seeded + tenant custom)
model InstrumentDefinition {
  id          String  @id @default(cuid())
  tenantId    String                 // platform seeds use a shared/system tenant, cloned on customize
  key         String                 // "phq9", "gad7", "ipss", "odi", "gags", "pasi"
  version     Int     @default(1)
  title       String
  definition  Json                   // see schema below
  scoringType String                 // "sum" | "weighted" | "mapped" | "areaWeighted"(PASI/GAGS) | "custom"
  active      Boolean @default(true)
  @@unique([tenantId, key, version])
}

// NEW — a completed administration tied to patient/encounter
model InstrumentResponse {
  id            String   @id @default(cuid())
  tenantId      String
  patientId     String
  encounterId   String?
  instrumentKey String
  instrumentVersion Int
  answers       Json                 // { "q1":2, "q2":3, ... } or area grids for GAGS/PASI
  rawScore      Float
  subscores     Json?                // { "region_forehead": 6 } etc.
  severityBand  String               // "Moderate"
  flags         Json?                // { "suicidalIdeation": true }  (PHQ-9 Q9>0)
  completedAt   DateTime @default(now())
  administeredBy String?             // clinician | self (patient-reported)
  @@index([tenantId, patientId, instrumentKey])
}
```

**Instrument-definition JSON schema** (the heart of the engine):
```json
{
  "key": "phq9", "version": 1, "title": "PHQ-9 Depression",
  "scoringType": "sum",
  "items": [
    { "id":"q1","text":"Little interest or pleasure in doing things",
      "options":[{"label":"Not at all","value":0},{"label":"Several days","value":1},
                 {"label":"More than half the days","value":2},{"label":"Nearly every day","value":3}] }
    /* q2..q9 identical option set */
  ],
  "sharedOptionSet": true,
  "severityBands": [
    {"label":"Minimal","min":0,"max":4},{"label":"Mild","min":5,"max":9},
    {"label":"Moderate","min":10,"max":14},{"label":"Moderately severe","min":15,"max":19},
    {"label":"Severe","min":20,"max":27}
  ],
  "flagRules": [{"id":"suicidalIdeation","when":"q9 > 0","message":"Positive self-harm item — assess risk"}],
  "writeBackObservationCode":"PHQ9_TOTAL"
}
```
Advanced scoring modes (all data-driven, values grounded to published rules):
- **IPSS** — `sum`, 7 items 0–5 (range 0–35), bands 0–7 mild / 8–19 moderate / 20–35 severe, plus a separate QoL item 0–6 stored as subscore.
- **Oswestry/ODI** — `sum` of 10 items 0–5 then `percent = raw/maxAnswered*100`; bands 0–20 minimal / 20–40 moderate / 40–60 severe / 60–80 crippling / 80–100 bedbound. Engine supports `divideByAnswered` for skipped sections.
- **GAGS** — `areaWeighted`: 6 regions each graded 0–4, multiplied by region factor (forehead 2, R-cheek 2, L-cheek 2, nose 1, chin 1, chest/back 3), summed 0–44; bands 1–18 mild / 19–30 moderate / 31–38 severe / ≥39 very severe.
- **PASI** — `areaWeighted` across 4 body regions with erythema+induration+desquamation (0–4 each) × area score (0–6) × region weight (head 0.1, upper limbs 0.2, trunk 0.3, lower limbs 0.4), range 0–72.

#### API surface
```
GET  /api/instruments?packKey=psych                  -> InstrumentDefinition[] (active)
GET  /api/instruments/{key}                           -> full definition (for render)
POST /api/instruments/{key}/score                     -> { rawScore, subscores, severityBand, flags }  (stateless preview)
POST /api/instruments/{key}/responses                 -> persist InstrumentResponse (+ writeBack Observation, +flags)
GET  /api/patients/{id}/instruments/{key}/history     -> InstrumentResponse[] (feeds Trends)
```
Scoring runs **server-side** (source of truth); client may mirror for instant feedback. Write-back posts an `Observation` with `writeBackObservationCode` so scores trend automatically via Component 2.

#### Widget UI spec
`<InstrumentForm>` — renders items from JSON. Layout: progress header (answered/total + live running score), one row per item with option control (radio group for shared option sets; grid for GAGS/PASI region×severity matrix; NPRS 0–10 slider). Live severity badge updates as answered. On submit: shows band, subscores, and any **flag alert** (red banner for PHQ-9 Q9 positive → "Assess suicide risk now" with protocol link). States: self-report mode (patient-facing, larger targets, plain-language, optional Urdu label field in definition), clinician mode (dense). Empty: pick-instrument list. Validation: block submit on unanswered required items (or allow ODI skip with `divideByAnswered`). Error: preserve answers on failed save. Tablet: single-column, sticky submit. Embeds as a tab/panel in the consultation screen and as a pre-visit link (patient self-completes via WhatsApp, lands pre-populated).

#### Pack manifest contents
- **Intake fields:** instrument responses are captured in-encounter or pre-visit; manifest lists which instruments are default per visit type.
- **Note templates:** e.g. "Depression review" with sections {PHQ-9 result, risk assessment, plan}; "BPH review" {IPSS + QoL, uroflow, plan}.
- **Service catalog (~10, PKR):** `Psychological assessment (initial) 6,000` · `Follow-up 3,500` · `PHQ-9/GAD-7 screening (bundled) 1,000` · `Structured psychometric battery 8,000` · `Uroflowmetry 2,500` · `IPSS review consult 3,000` · `Physiotherapy assessment (ODI) 3,500` · `Physio session 2,000` · `Dermatology consult + GAGS grading 4,000` · `PASI assessment 3,500`.
- **Order sets:** "Positive PHQ-9 Q9" → risk-assessment task + urgent psychiatry referral.
- **Entitlement key:** **`sccl.instruments`**.

#### Integrations
- **Trends:** write-back Observation → automatic score trajectory.
- **WhatsApp journeys:** send self-report link pre-visit; recall on worsening band.
- **Treatment plans:** target band as a plan goal ("PHQ-9 < 10 by session 6").
- **Billing:** administering a scored assessment maps to a catalog service line.
- **Reports:** printable instrument result with band + item breakdown for referrals.

#### Clinical safety & edge cases
**Flag rules are safety-critical** — PHQ-9 Q9 > 0 must always fire regardless of total; never let a "Minimal" total suppress a self-harm flag. Version instruments immutably (a stored response keeps the version it was scored under; re-scoring under a new version is explicit). Screening ≠ diagnosis — UI wording. Handle partial completion transparently (ODI denominator). Localized option text must not alter numeric values.

#### Effort
**M** (4 dev-weeks). The definition schema, scoring service (with the 4 scoring modes), and render component are new code (built once); every subsequent instrument is pure config/JSON. GAGS/PASI grid renderer is the only extra UI.

---

### Component 4 — Weight-based Dose Calculator

#### Purpose & scope
Deterministic mg/kg (and mg/kg/day ÷ frequency) dose computation with **max caps, rounding, and concentration→volume conversion**. Primarily Pediatrics, but reused by any pack prescribing weight-based drugs (Onco, Anesthesia, Nephro dose-adjust, Emergency). It computes a *recommendation*; a clinician always confirms.

#### Data model
```prisma
// NEW — drug dosing rules (platform-seeded, tenant can extend, PMDC/formulary aligned)
model DoseRule {
  id            String  @id @default(cuid())
  tenantId      String
  drugKey       String                 // "paracetamol_oral"
  displayName   String                 // "Paracetamol (oral suspension)"
  route         String
  mgPerKg       Float?                  // per-dose
  mgPerKgPerDay Float?                  // daily, split by frequency
  frequencyPerDay Int?                  // e.g. 4 (QID)
  maxSingleDoseMg Float?                // absolute cap per dose
  maxDailyDoseMg  Float?                // absolute cap per day
  minAgeMonths  Int?
  maxWeightKgForRule Float?             // switch to adult dosing above this
  roundingStep  Float   @default(0)     // round dose to nearest e.g. 2.5 mL / 50 mg
  concentrations Json                   // [{label:"120mg/5mL", mgPerMl:24}]
  cautions      String[]                // ["Hepatic impairment: reduce"]
  linkedInventoryItemId String?         // ties to stock/consumable
  @@unique([tenantId, drugKey, route])
}

// NEW — audit of each calculation actually used in an order (medico-legal trail)
model DoseCalculationLog {
  id           String  @id @default(cuid())
  tenantId     String
  patientId    String
  encounterId  String?
  drugKey      String
  weightKg     Float
  ageMonths    Int?
  computedMgPerDose Float
  cappedByMax  Boolean
  chosenConcentration Json?
  volumeMl     Float?
  medicationRequestId String?           // the order it produced
  clinicianId  String
  createdAt    DateTime @default(now())
}
```

#### API surface
```
GET  /api/dose/rules?drugKey=paracetamol_oral        -> DoseRule[]
POST /api/dose/calculate                              -> { perDoseMg, perDayMg, wasCapped,
       body:{ drugKey, route, weightKg, ageMonths,        cappedReason, volumePerDoseMl, warnings[] }
              concentrationMgPerMl }
POST /api/dose/commit                                 -> persist DoseCalculationLog + create MedicationRequest
```
Calculation is server-authoritative and pure/testable. Weight pulled from latest `Observation` (weight code) but **must be re-confirmed** in UI.

#### Widget UI spec
`<DoseCalculator>` opened from the prescribing panel. Layout: drug select → shows rule (mg/kg, caps) → weight field (pre-filled from latest recorded weight with date + "confirm" checkbox; editable) → live result: per-dose mg, per-day mg, and **volume in mL** for the chosen concentration. Cap indicator: if computed > max, result shows capped value with amber "Capped at max single dose 1000 mg". Rounding shown ("→ rounded to 5 mL"). Cautions listed. States: no-weight (prompt to record weight), over-max (amber), out-of-age-range (red block "Rule not valid < 3 months"), success (green, "Add to prescription" enabled only after weight confirmed). Tablet-friendly large numeric display. Embeds in consultation prescribing flow.

#### Pack manifest contents
- **Service catalog (illustrative, Peds):** `Well-child consult 2,500` · `Sick-child consult 2,000` · `Nebulization 1,500` · `IV cannulation + fluids 3,000`.
- **Order sets:** "Febrile child" → paracetamol weight-dose + advice; "Acute asthma" → salbutamol weight-dose neb.
- **Entitlement key:** **`sccl.dose`**.

#### Integrations
- **Inventory/consumables:** chosen concentration maps to an inventory item (batch/expiry) — volume decrements stock; dispensing checks expiry.
- **Billing:** dispensed drug/consumable → billing line (PKR).
- **Treatment plans / reports:** dose appears in the prescription and visit summary; WhatsApp can send dosing instructions to caregiver in plain language.

#### Clinical safety & edge cases
**Caps are hard limits** — never recommend above `maxSingleDose`/`maxDaily` even if mg/kg says so; show why. Block or warn outside age/weight validity (neonatal, adult crossover). Always require explicit weight confirmation with the measurement date (stale weight is dangerous in fast-growing infants). Rounding must never round *up* past a cap. Log every committed calculation (medico-legal). Never auto-commit — clinician confirms. Flag known high-risk drugs for double-check.

#### Effort
**S–M** (2–3 dev-weeks). Pure calc service + rule table + one panel. New code is the calculator and cap/rounding logic; drug rules are config/seed data. Inventory link reuses existing consumables.

---

### Component 5 — Growth-Percentile engine (WHO LMS)

#### Purpose & scope
Computes anthropometric **z-scores and percentiles** from WHO Child Growth Standards using the LMS method, and renders standard growth charts (weight-for-age, height/length-for-age, weight-for-height, BMI-for-age, head-circumference-for-age). Core to Pediatrics/neonatology; a specialized renderer built on the Trends engine. Pakistan-first: WHO standards (the national reference) with EPI-visit alignment.

#### Data model
```prisma
// NEW — WHO LMS reference tables (seed data; not tenant-scoped, platform reference)
model GrowthLmsReference {
  id         String @id @default(cuid())
  indicator  String            // "wfa" | "lfa"/"hfa" | "wfh"/"wfl" | "bmifa" | "hcfa"
  sex        String            // "M" | "F"
  xUnit      String            // "days" | "months" | "cm"(for wfh)
  x          Float             // age in days/months, or length/height in cm
  L          Float
  M          Float
  S          Float
  @@index([indicator, sex, xUnit, x])
}

// Measurements reuse EXISTING Observation (weight, height, HC codes) with effectiveDateTime.
// NEW — cached computed points for fast chart render / re-plot
model GrowthComputedPoint {
  id          String @id @default(cuid())
  tenantId    String
  patientId   String
  observationId String
  indicator   String
  ageDays     Int
  measurement Float
  zScore      Float
  percentile  Float
  @@index([tenantId, patientId, indicator])
}
```

#### API surface
```
POST /api/growth/zscore                               -> { zScore, percentile, interpretation }
      body:{ indicator, sex, ageDays, measurement }        (interpretation e.g. "Underweight (z=-2.4)")
GET  /api/growth/{indicator}/patient/{patientId}      -> { points:[{ageDays, measurement, z, pct}],
                                                            referenceCurves:[ z-3,z-2,z0,z+2,z+3 lines ] }
GET  /api/growth/curves?indicator=wfa&sex=M           -> reference percentile/z curves for plotting
```
**Z-score math (grounded, WHO LMS / Box-Cox):** `Z = ((measurement/M)^L − 1) / (L × S)` when `L ≠ 0`, else `Z = ln(measurement/M) / S`. Percentile = `Φ(Z)` (standard-normal CDF). Extreme z (|z|>3) uses WHO's constrained-tail correction so implausible values don't explode. L/M/S looked up by interpolation on exact age in days.

#### Widget UI spec
`<GrowthChart>` (extends `<TrendChart>`): patient's plotted measurements over the WHO reference curves (z-lines −3/−2/0/+2/+3 shaded — green normal band, amber/red tails). Indicator tabs (WFA / LFA / WFH / BMI / HCFA). Each point popover: value, age, exact z + percentile, EPI-visit label if aligned. Header shows latest z and interpretation chip ("Normal" / "Underweight" / "Stunted" / "Wasted" / "Overweight"). Empty: "Record weight/length to start the growth chart." Error/out-of-range: value outside plausible physiological bounds flagged before plotting. Desktop: full curve; tablet: pinch/scroll x-axis. Embeds in the Peds consultation "Growth" tab and the child's health-record summary.

#### Pack manifest contents
- **Intake fields:** weight (kg), length/height (cm), head circumference (cm), sex, DOB (age auto).
- **Note templates:** "Well-child / growth-monitoring visit" {measurements, z-scores/interpretation, feeding, development, immunization due}.
- **Service catalog:** covered under Peds catalog (well-child consult, growth-monitoring visit).
- **Order sets:** "Faltering growth (z < −2 WFA)" → feeding assessment + review in 2 weeks + nutrition referral.
- **Entitlement key:** **`sccl.growth`**.

#### Integrations
- **EPI immunization schedule:** growth visits align to Pakistan EPI touchpoints (birth: BCG+OPV0; 6/10/14 weeks: OPV+Pentavalent+PCV; 9 months: measles-1; 15 months: measles-2) so a growth visit can surface "immunization due" and vice-versa.
- **WhatsApp recall:** faltering z or missed measurement → caregiver recall; EPI-due reminders.
- **Trends:** shares the chart renderer and annotation model.
- **Reports:** printable growth chart for parents/referral.

#### Clinical safety & edge cases
Use **age in days** (not rounded months) for accuracy in infancy. Switch length↔height correctly (recumbent < 2y vs standing) — WHO adds a height/length adjustment; don't mix tables. Flag implausible values (data-entry: 60 kg infant) before z-plot. |z| > 3 handling per WHO. Preterm correction: use corrected age until ~2y (config flag) or a preterm reference. Interpretation is screening, not diagnosis.

#### Effort
**M** (3–4 dev-weeks). Reference tables are seed data; z-score service is small pure code (well-specified); chart extends the Trends renderer (reuse). Main new work: LMS lookup/interpolation, tail correction, indicator tabs, EPI alignment.

---

### Consuming packs — cross-component matrix

| Component | Ophtho | ENT | Nephro/Uro | Peds | Psych | Ortho/Physio | Derm | Dental |
|---|---|---|---|---|---|---|---|---|
| Laterality | OD/OS/OU | AD/AS/AU | kidney/fistula side | limb | — | L/R limb | L/R lesion | per-tooth (FDI) |
| Trends | IOP, VA | audiometry | eGFR, BP, IPSS | growth, weight | PHQ-9/GAD-7 traj. | NPRS, ODI | GAGS/PASI traj. | — |
| Scored-Instrument | — | tinnitus THI | IPSS | Apgar, dev-screen | PHQ-9, GAD-7 | ODI, NPRS | GAGS, PASI | — |
| Dose calc | — | — | dose-adjust | primary user | (psychotropics) | — | isotretinoin mg/kg | — |
| Growth (LMS) | — | — | — | primary user | — | — | — | — |

---

### Overall effort

| Component | Size | Dev-weeks | Config vs new code |
|---|---|---|---|
| 1 Laterality | S | 2 | mostly config (enum + cols + picker) |
| 2 Longitudinal Trends | M | 3–4 | config defs; new: aggregation svc + banded renderer |
| 3 Scored-Instrument | M | 4 | new: schema + scoring svc + render; instruments are config |
| 4 Dose calculator | S–M | 2–3 | new: calc/cap logic; drug rules are config |
| 5 Growth (LMS) | M | 3–4 | new: z-score svc + interpolation; curves seed; renderer reused |
| **Total** | | **~14–17 dev-weeks** (one squad ~3.5–4 months, renderer reuse compresses 2↔5) | build-once; every future pack is config |

The compounding payoff: after this layer ships, a new specialty pack (e.g. Rheumatology adding DAS-28, or Pulmonology adding peak-flow trends) is **JSON + catalog + templates** — days, not a code fork.

---

### Acceptance criteria — end-to-end demo script

1. **Laterality:** In an Ophthalmology encounter, record IOP = 24 mmHg **OD** and 18 mmHg **OS**; the picker enforces a required side; billing shows a bilateral tonometry line. Confirm two independent observations stored with `laterality` RIGHT/LEFT.
2. **Trends:** Open the IOP TrendChart — two series (OD solid, OS dashed) plot over 3 prior visits with the 10–21 mmHg normal band shaded; the 24 OD point sits in the amber zone; add an annotation "started latanoprost OD" pinned to today.
3. **Scored-Instrument:** Send a PHQ-9 self-report link via WhatsApp pre-visit; patient completes it; it lands scored = 16 "Moderately severe"; Q9 = 1 fires the **red self-harm flag** and an order-set task for risk assessment; the total writes back as an Observation and appears on the PHQ-9 trend.
4. **Dose calculator:** For a 14 kg, 30-month child, calculate paracetamol 15 mg/kg → 210 mg per dose; change weight to 90 kg (adult) and confirm the per-dose is **capped at 1000 mg** with the amber cap notice; commit → creates a MedicationRequest, logs the calculation, and decrements the 120mg/5mL suspension from batch inventory.
5. **Growth:** Enter a 4-month-old boy, weight 5.2 kg → engine returns z ≈ −2.3, percentile ≈ 1st, interpretation "Underweight"; the point plots below the −2 z-line on WFA; the faltering-growth order set fires (review in 2 weeks) and the visit shows "EPI: Pentavalent-3/PCV-3 due at 14 weeks."
6. **Entitlements:** Disable `sccl.growth` for the tenant → the Growth tab and its order set disappear while Trends/Instruments remain, proving clean per-component gating with no code change.

---

### Sources
- WHO Child Growth Standards / LMS z-score method: [zscorer anthropometry vignette](https://nutriverse.io/zscorer/articles/anthropometry.html) · [WHO computation of centiles and z-scores (PDF)](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf?sfvrsn=c2ff6a95_4)
- PHQ-9 severity bands: [PHQ-9 validity (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC1495268/) · [PHQ-9 scoring interpretation](https://www.scienceworkshealth.com/post/phq-9-depression-screening-phq-9-scoring-and-how-to-interpret-it-safely)
- GAD-7 severity bands: [CORC GAD-7](https://www.corc.uk.net/outcome-measures-guidance/directory-of-outcome-measures/generalised-anxiety-disorder-assessment-gad-7/)
- IPSS structure and bands: [IPSS — Wikipedia](https://en.wikipedia.org/wiki/International_Prostate_Symptom_Score) · [Medscape IPSS calculator](https://reference.medscape.com/calculator/338/international-prostate-symptom-score-ipss)
- GAGS scoring (regions, factors, bands): [GAGS — Medical Algorithm](https://www.medicalalgorithms.com/global-acne-grading-system-gags) · [Acne grading review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10995619/)
- Oswestry Disability Index scoring/bands: [ODI — Physiopedia](https://www.physio-pedia.com/Oswestry_Disability_Index)
- Laterality abbreviations (OD/OS/OU, AD/AS/AU): [Warby Parker OD vs OS](https://www.warbyparker.com/learn/od-vs-os) · [Eye & Ear approved abbreviations (PDF)](https://eyeandear.org.au/wp-content/uploads/2021/10/Eye-and-Ear-Approved-Abbreviations-List-1.pdf)
- Pakistan EPI immunization schedule: [Federal Directorate of Immunization — Immunization Schedule](https://www.epi.gov.pk/immunization-schedule/) · [WHO EMRO Pakistan EPI](https://www.emro.who.int/pak/programmes/expanded-programme-immunization.html)
- FHIR R4 bodySite/laterality alignment: [HL7 FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html)



---



# Part III — Pack Specifications

## Dental & Orthodontics Pack (HEAVY)

**Pack key:** `pack.dental` · **Tier:** Heavy (ships the platform's first specialty widget: the Odontogram) · **Target release:** Health OS v2.4, Q4 2026

### Purpose & scope

Turns the shared clinical core into a full dental EMR: FDI-notated tooth charting (permanent 11–48, primary 51–85), surface-level findings, six-site periodontal charting, tooth-level treatment planning that feeds billing line-by-line, and an orthodontics add-on (appliance map + case timeline reusing the before/after photo engine). Used by: standalone dental clinics (single-pack activation), polyclinics with a dental chair (multi-select), and hospital dental/OMFS departments. The odontogram is the one genuinely required specialty widget; everything else is manifest configuration on the shared core.

---

### Data model

Conventions: every model carries `tenant_id String @db.Uuid` with Postgres RLS (`tenant_id = current_setting('app.tenant_id')::uuid`) — omitted below for brevity but mandatory. All IDs `String @id @default(uuid())`. All models get `created_at`, `updated_at`, `created_by_user_id`. Laterality: dentistry encodes side via the FDI quadrant digit, so tooth records do **not** duplicate the core `laterality` enum; a generated column `arch_side` (`LEFT`/`RIGHT` derived from quadrant 1,4=RIGHT / 2,3=LEFT) is exposed so the shared Longitudinal Trends engine and reports can group by the core laterality dimension.

**EXISTING (core, referenced):** `Patient`, `Encounter`, `TreatmentPlan`, `TreatmentPlanItem`, `Invoice` / `InvoiceLine`, `ServiceCatalogItem`, `OrderSet` / `Order`, `MediaAsset` + photo-timeline (`PhotoSession`, consent flags), `InventoryItem` / `StockBatch`, `ScoredInstrumentResponse`, `WhatsAppJourneyEnrollment`.

```prisma
// ── NEW: enums ────────────────────────────────────────────
enum ToothType   { PERMANENT PRIMARY SUPERNUMERARY }
enum ToothSurface { M O D B L }        // Mesial, Occlusal/Incisal, Distal, Buccal/Labial, Lingual/Palatal
                                       // Anterior teeth: O stored, rendered as "I" (incisal) in UI/prints.
enum ToothCondition {
  SOUND CARIES FILLED FRACTURED ABRASION_EROSION SEALANT
  RCT_TREATED PULPOTOMY CROWN VENEER BRIDGE_ABUTMENT BRIDGE_PONTIC
  IMPLANT MISSING EXTRACTED ROOT_REMNANT IMPACTED PARTIALLY_ERUPTED
  MOBILE PERIAPICAL_LESION EXTRACTION_INDICATED UNERUPTED
}
enum FindingStatus { EXISTING PLANNED IN_PROGRESS COMPLETED HISTORICAL }
enum PerioSite     { DB B MB DL L ML }          // 3 buccal + 3 lingual sites
enum FurcationGrade { NONE I II III }
enum OrthoEventType { RECORDS BONDING ADJUSTMENT WIRE_CHANGE ELASTICS_CHANGE
                      REPAIR DEBOND RETAINER_FIT RETAINER_REVIEW }
enum ApplianceType  { METAL_FIXED CERAMIC_FIXED SELF_LIGATING LINGUAL
                      CLEAR_ALIGNER REMOVABLE FUNCTIONAL RETAINER_HAWLEY
                      RETAINER_ESSIX RETAINER_FIXED }

// ── NEW: dental chart ─────────────────────────────────────
model ToothFinding {
  id            String   @id @default(uuid())
  tenant_id     String   @db.Uuid
  patient_id    String                       // -> Patient (chart is longitudinal, patient-owned)
  encounter_id  String                       // -> Encounter where recorded
  tooth_fdi     Int                          // 11..18,21..28,31..38,41..48, 51..55,61..65,71..75,81..85 (CHECK constraint)
  tooth_type    ToothType @default(PERMANENT)
  supernumerary_ref String?                  // e.g. "mesiodens near 11" when tooth_type=SUPERNUMERARY
  surfaces      ToothSurface[]               // empty = whole-tooth condition (MISSING, IMPACTED, MOBILE...)
  condition     ToothCondition
  status        FindingStatus @default(EXISTING)
  mobility_grade Int?                        // Miller 0–3, only with condition=MOBILE
  note          String?
  superseded_by_id String?                   // append-only chain; never hard-delete (audit)
  arch_side     String?  // generated: quadrant in (1,4)->'RIGHT', (2,3)->'LEFT'
  @@index([tenant_id, patient_id, tooth_fdi])
  @@index([tenant_id, encounter_id])
}

// ── NEW: periodontal charting ─────────────────────────────
model PerioExam {
  id           String  @id @default(uuid())
  tenant_id    String  @db.Uuid
  patient_id   String
  encounter_id String
  exam_type    String   @default("FULL")     // FULL | BPE_SCREEN
  bpe_sextants Int[]                         // optional 6-value BPE screen (0-4), empty for FULL
  teeth        PerioToothRecord[]
  @@index([tenant_id, patient_id])
}
model PerioToothRecord {
  id            String @id @default(uuid())
  tenant_id     String @db.Uuid
  perio_exam_id String
  tooth_fdi     Int
  pocket_mm     Int[]      // exactly 6, order = PerioSite enum [DB,B,MB,DL,L,ML], 0–15mm
  recession_mm  Int[]      // exactly 6, mm from CEJ; CAL derived = pocket + recession
  bleeding      Boolean[]  // exactly 6
  suppuration   Boolean[]  // exactly 6
  plaque        Boolean[]  // exactly 6
  furcation     FurcationGrade @default(NONE)
  mobility      Int?           // Miller 0–3
  @@unique([perio_exam_id, tooth_fdi])
}

// ── NEW: tooth-level treatment plan (extends core item) ───
model ToothPlanItem {
  id                     String @id @default(uuid())
  tenant_id              String @db.Uuid
  treatment_plan_item_id String        // -> core TreatmentPlanItem (carries catalog item, package/session logic)
  tooth_fdi              Int?          // null for whole-mouth procedures (scaling, braces)
  surfaces               ToothSurface[]
  price_override_pkr     Decimal?      // per-tooth price (e.g. molar RCT > anterior RCT)
  status                 FindingStatus @default(PLANNED)
  completed_encounter_id String?
  completed_at           DateTime?
  linked_finding_id      String?       // ToothFinding that motivated this item
  @@index([tenant_id, treatment_plan_item_id])
}

// ── NEW: ortho add-on ─────────────────────────────────────
model OrthoCase {
  id              String @id @default(uuid())
  tenant_id       String @db.Uuid
  patient_id      String
  treatment_plan_id String            // -> core TreatmentPlan (braces package = multi-session package)
  appliance       ApplianceType
  angle_class     String?             // "I" | "II div 1" | "II div 2" | "III"
  start_date      DateTime?
  planned_months  Int?
  debond_date     DateTime?
  status          String  @default("ACTIVE")  // PLANNED|ACTIVE|RETENTION|COMPLETED|DISCONTINUED
  appliance_map   Json                // per-tooth: {"16":"band","11":"bracket","36":"bond_tube",...}
  photo_timeline_tag String           // tag consumed by EXISTING photo-timeline engine
  events          OrthoEvent[]
}
model OrthoEvent {
  id            String @id @default(uuid())
  tenant_id     String @db.Uuid
  ortho_case_id String
  encounter_id  String
  event_type    OrthoEventType
  wire_upper    String?             // e.g. "0.016 NiTi"
  wire_lower    String?
  elastics      String?
  note          String?
  occurred_at   DateTime
}
```

**How it ties together:** `ToothFinding(PLANNED)` → user promotes to plan → creates core `TreatmentPlanItem` (catalog item, price) + `ToothPlanItem` (tooth/surface, per-tooth price). Marking a `ToothPlanItem` COMPLETED inside an encounter (a) writes the completion `ToothFinding` (e.g. CARIES→FILLED), (b) pushes an `InvoiceLine` to the encounter's draft invoice with description `"Composite Filling — 36 (MO)"`, (c) decrements mapped consumables. Ortho cases hang off a core multi-session `TreatmentPlan`, so package billing/installments (monthly braces payment) is existing core behavior.

---

### Widget UI spec — Odontogram (`dental.odontogram`)

**Embedding:** the pack manifest registers the widget into the consultation screen's specialty slot: `{"slot":"encounter.tabs","widget":"dental.odontogram","label":"Dental Chart","entitlement":"pack.dental"}`. It renders as a full-width tab beside Notes / Orders / Rx; a compact read-only mini-chart (32 dots, colored) renders in the patient summary sidebar.

**Layout (desktop ≥1200px):**
- Two arches, patient-perspective (patient's right on screen-left): row 1 `18…11 | 21…28`, row 2 `48…41 | 31…38`. Quadrant separators + labels (UR/UL/LL/LR).
- Each tooth cell (~56px): FDI number above (upper arch) / below (lower arch); a 5-zone surface glyph — classic diagram of 4 trapezoids (M, D, B, L) around a center square (O; rendered "I" for teeth x1–x3); whole-tooth overlays (X = missing, ↓ = impacted, screw icon = implant, bridge bar spanning abutment–pontic–abutment).
- **Primary toggle:** segmented control `Permanent / Primary / Mixed`. Primary shows 55–51|61–65 / 85–81|71–75 (5 per quadrant). Mixed renders the primary row inset between the arches; a primary tooth marked EXTRACTED/exfoliated auto-collapses to show the successor.
- Right panel (320px): context panel for the selected tooth — finding history (newest first), active plan items, perio summary, "Add finding" form.
- Toolbar: mode switch **View / Chart / Perio / Plan**, condition palette (color chips), undo/redo (session-scoped), "New perio exam", print/PDF.

**Color code (WCAG AA on white, also shown as legend):** CARIES `#D32F2F` red, FILLED `#1565C0` blue, RCT_TREATED `#6A1B9A` purple root stripe, CROWN `#F9A825` amber outline, SEALANT `#2E7D32` green, MISSING grey X, EXTRACTION_INDICATED red X-dashed, IMPLANT teal screw, FRACTURED zig-zag icon. **Status texture:** PLANNED = diagonal hatch, IN_PROGRESS = half fill, COMPLETED = solid, HISTORICAL = 40% opacity. Never color-only: each state also has an icon/texture (color-blind safe).

**Interactions:**
- Chart mode: pick condition chip → click surfaces (multi-surface drag paints M+O+D in one gesture) → click "✓" or press Enter to commit. Whole-tooth conditions skip surface selection. Shift-click selects multiple teeth for bulk (e.g. MISSING 18, 28, 38, 48).
- Hover: tooltip = tooth name ("Upper Right First Molar — 16"), current findings, last change date/user.
- Plan mode: clicking a PLANNED finding opens "Add to treatment plan" → pre-filtered catalog picker (surface count auto-suggests filling size), price editable within role permission, target visit number for phased plans.
- **Perio mode:** chart flips to a spreadsheet-style grid: teeth as columns, rows = PD×6, REC×6, BOP, furcation, mobility. Keyboard-first: type digits, auto-advance site→site→tooth (configurable buccal-first path); `b` toggles bleeding at current site; skipped/missing teeth auto-jumped. Live line overlay draws PD and CAL profiles over the arch; sites ≥4mm auto-shade amber, ≥6mm red. Previous exam ghost-line toggle for comparison (feeds the shared Longitudinal Trends engine: mean PD, %BOP, # sites ≥5mm over time).

**Validation:** FDI whitelist enforced (reject 19, 29, 46 in primary layer, etc.); surface list required for CARIES/FILLED/SEALANT; conditions on MISSING teeth blocked except IMPLANT/BRIDGE_PONTIC; primary numbers only in Primary/Mixed layer with age warning if patient >14y; perio PD 0–15mm hard cap, ≥10mm requires confirm; duplicate identical finding same tooth/surface same encounter → warn-merge.

**States:** Empty = greyscale arches + "No findings charted — start with Chart mode or import last visit"; Loading = skeleton arches; Error = retry banner, chart entry queued locally (optimistic write, replay on reconnect — chairside Wi-Fi is unreliable); Read-only when encounter is signed/locked (amendments create new encounter-linked findings, never edits).

**Tablet (768–1199px, chairside primary device):** arches stack vertically, tooth cells ≥44px touch targets, surface selection via a magnified 5-zone popover on tooth tap (finger-accurate), condition palette as bottom sheet, perio grid horizontally scrollable with frozen tooth-number header; stylus supported. Flutter build mirrors the React component contract (same JSON finding payloads).

**Ortho sub-view (`dental.ortho`, entitlement-gated):** appliance map = same arch grid, per-tooth chips (bracket/band/tube/none) painted like conditions; case timeline = vertical timeline of `OrthoEvent`s interleaved with photo sessions from the EXISTING photo-timeline engine (filtered by `photo_timeline_tag`), side-by-side compare slider already built for aesthetic reused as-is.

---

### Pack manifest contents

**Entitlement keys:** `pack.dental` (base), `pack.dental.ortho` (add-on), `pack.dental.perio` (included in base, flag allows hiding for GP-dental micro-clinics).

**Intake fields (append to core intake, all optional-configurable):** chief dental complaint (coded list: pain/sensitivity/bleeding gums/broken tooth/esthetics/orthodontic); pain scale 0–10 + duration; last dental visit; brushing frequency; miswak/fluoride toothpaste use; **paan/gutka/naswar/chhaliya use** (frequency — Pakistan oral-cancer risk factors, drives mucosal screening prompt); smoking; bruxism/clenching; previous extractions/RCT; diabetes (with last HbA1c); bleeding disorder / anticoagulant use (flag surfaces on extraction planning); rheumatic heart disease / prosthetic valve (antibiotic-prophylaxis prompt); LA allergy; pregnancy status (imaging gate); for ortho intake: habit history (thumb sucking, mouth breathing), family malocclusion.

**Note templates (structured, sections pre-wired to data):**
1. **Dental Examination Note** — C/C, HPI, extra-oral (TMJ, lymph nodes, mucosal screen incl. paan-related lesions), intra-oral soft tissue, odontogram snapshot (auto-embedded image), perio summary (auto: %BOP, worst PD), diagnosis (ICD-10 K02–K08), plan.
2. **Restorative / Filling Op Note** — tooth+surfaces (auto from completed ToothPlanItem), LA type & cartridges, isolation, material/shade, occlusion check.
3. **RCT Visit Note** — tooth, visit # of plan, working lengths per canal (table), irrigation, master cone, obturation, RVG references, inter-appointment medicament.
4. **Extraction / Minor Oral Surgery Note** — tooth (mandatory double-confirm), indication, LA, technique (forceps/surgical), sutures, hemostasis, post-op instructions given (auto-triggers WhatsApp).
5. **Scaling & Perio Therapy Note** — BPE/full chart reference, quadrants treated, OHI given, recall interval.
6. **Ortho Records/Bonding Note** and **Ortho Adjustment Note** — appliance, wires (upper/lower), elastics, oral hygiene score, next activation interval.

**Service catalog (PKR, mid-market Lahore/Karachi/Islamabad 2025-26; tenant-editable at onboarding):**

| Code | Service | PKR | Unit |
|---|---|---|---|
| DEN-CON | Dental consultation | 2,000 | visit |
| DEN-SCA | Scaling & polishing (full mouth) | 8,000 | mouth |
| DEN-FIL | Composite filling | 7,000 | tooth (surface count may uplift) |
| DEN-RCT-A | RCT — anterior | 18,000 | tooth |
| DEN-RCT-M | RCT — molar | 28,000 | tooth |
| DEN-CRN-P | Crown — PFM | 25,000 | unit |
| DEN-CRN-Z | Crown — zirconia | 45,000 | unit |
| DEN-EXT | Extraction — simple | 5,000 | tooth |
| DEN-EXT-S | Extraction — surgical / impacted 3rd molar | 22,000 | tooth |
| DEN-IMP | Implant (fixture + crown, staged package) | 160,000 | tooth |
| DEN-ORT-M | Braces — metal, full case (multi-session package, installments) | 190,000 | case |
| DEN-ORT-C | Braces — ceramic, full case | 230,000 | case |
| DEN-RET | Retainer (Essix/Hawley, per arch) | 15,000 | arch |
| DEN-FLU | Fluoride application (pedo) | 4,000 | mouth |
| IMG-OPG | OPG (panoramic) | 3,000 | study |
| IMG-RVG | RVG (periapical, digital) | 1,000 | exposure |

**Order sets:**
- **OPG/RVG Imaging set:** New-patient OPG; RCT series (pre-op RVG → working-length RVG → obturation RVG, one order per visit stage); pre-implant OPG (+external CBCT referral order — CBCT not assumed in-house); ortho records set (OPG + lateral cephalogram referral + photo session).
- **Post-extraction Rx set:** amoxicillin 500mg TDS ×5d (weight-based pedo dose via shared calculator), ibuprofen 400mg TDS PRN, chlorhexidine 0.2% rinse from day 2 (contents tenant-editable; defaults conservative).
- **Perio therapy set:** full perio exam + scaling + OHI + 3-month recall enrollment.

**Scored instruments (JSON on the shared engine, no code):** Plaque Index (Silness–Löe), simplified OHI-S, ortho hygiene score; BPE screen (0–4 per sextant) as a 6-item instrument when full charting is skipped.

---

### Integrations

- **Billing:** completing a `ToothPlanItem` emits `InvoiceLine {catalog_code, qty:1, price: price_override_pkr ?? catalog price, meta:{tooth_fdi, surfaces}}`; tooth appears on the printed/FBR-fiscalized invoice line description. Braces = core package billing (down payment + monthly installments tied to ADJUSTMENT encounters); implant = staged package (fixture stage / crown stage milestones).
- **Inventory:** catalog items map to consumable BOMs — filling → composite capsule + bond + etchant; RCT visit → gutta-percha, files (wear-count), irrigant; extraction → LA cartridges (qty from note), sutures; implant → **fixture is a batch/expiry + serial-tracked item; consuming it records batch + lot on the ToothPlanItem** (recall traceability). Stock decremented on completion event, reversible if line voided same day.
- **WhatsApp journeys (Meta Cloud API, Urdu/English templates):** post-extraction instructions (immediate + 24h check-in); RCT incomplete-treatment chaser (booked next visit reminder; escalation if no show — abandoned RCT is a clinical risk); 6-month scaling recall (enrolled on scaling completion); ortho monthly adjustment reminder (auto-advance from OrthoEvent cadence); retainer review at 3/6/12 months post-debond; implant review at 1 week/3 months.
- **Treatment plans:** odontogram Plan mode is the authoring surface; core plan screen shows tooth-tagged items with per-visit phasing; plan acceptance capture (signature) is core.
- **Photo timeline:** ortho case tag reuses aesthetic-built photo+consent engine (intraoral/extraoral standard views preset added via manifest).
- **Reports (core reporting engine + pack queries):** production by procedure/provider, planned-vs-completed conversion (case acceptance %), ortho case aging & overdue adjustments, perio risk register (%BOP>30 or any PD≥6), incomplete RCT list, implant registry (batch/serial).

---

### Clinical safety & edge cases

1. **Wrong-tooth prevention:** completing EXTRACTION or RCT requires a confirm modal showing full tooth name + FDI + mini-chart highlight ("Extract **Lower Left First Molar (36)** — confirm"); mismatch between planned tooth and finding tooth hard-blocks.
2. **Append-only chart:** findings are never edited/deleted post-encounter-sign; corrections supersede (`superseded_by_id`) with reason — full audit chain per PMDC record-keeping expectations.
3. **Mixed dentition:** primary and successor can coexist (over-retained primary); exfoliation charted as HISTORICAL, not EXTRACTED; age-vs-dentition warnings only (never hard blocks — eruption varies).
4. **Supernumerary/anomalies:** `SUPERNUMERARY` tooth_type with free-text locator; missing-tooth agenesis vs extracted distinguished by condition.
5. **Anticoagulant/bleeding-disorder intake flag** banner on extraction plan items; RHD/prosthetic-valve flag prompts antibiotic prophylaxis consideration. Prompts, not auto-orders — clinician decides.
6. **Pregnancy + imaging:** OPG/RVG order on flagged-pregnant patient requires justification note (ALARA); no silent block.
7. **Pediatric LA dosing:** lidocaine max-dose check via shared weight-based dose calculator (mg/kg vs cartridges recorded) — warning at 80%, block-with-override at 100%.
8. **Perio data integrity:** arrays validated length-6 server-side; missing teeth excluded from %BOP denominators; BPE and full chart never mixed in one exam.
9. **Bridges/implants spanning teeth:** pontic sites can't receive perio pockets or caries; implant sites get peri-implant probing flagged distinctly in trends.
10. **Offline chairside:** optimistic local queue with conflict rule = last-write-wins per finding + both preserved in audit; encounter can't be signed with unsynced entries.
11. **RLS/tenancy:** all pack tables covered by the standard tenant policy; widget only mounts when entitlement present — no dormant dental UI for other specialties.

---

### Effort (1 dev-week = 1 engineer-week; team of 2–3)

| Piece | Size | Weeks | Config vs code |
|---|---|---|---|
| Data model + migrations + RLS + services/APIs | M | 1.5 | New code (schema + NestJS module) |
| Odontogram widget — React (chart/plan modes, surfaces, primary/mixed, states) | **L** | 4.0 | New code (the pack's one custom widget) |
| Perio mode (grid entry, overlays, trends wiring) | M | 2.0 | New code UI; trends = existing engine config |
| Flutter tablet odontogram (shared contract) | M | 2.0 | New code (reuses API + design tokens) |
| Tooth plan → billing/inventory glue | M | 1.0 | New code (event handlers on existing pipelines) |
| Ortho add-on (case, appliance map, timeline) | S–M | 1.5 | ~60% reuse (photo timeline, packages); thin new models/UI |
| Manifest: intake, templates, catalog, order sets, instruments, WhatsApp templates | S | 0.75 | **Pure config/content** |
| Reports pack | S | 0.5 | Config (query defs) + 2 custom queries |
| QA, demo dataset (Pakistani patient fixtures), docs | S | 0.75 | — |
| **Total** | | **~14 dev-weeks** (≈5–6 calendar weeks with 3 devs) | ≈70% new code (front-loaded in the widget), 30% config — every subsequent dental tenant is config-only |

---

### Acceptance criteria — end-to-end demo script

*Fixture: Tenant "Shifa Dental Care, Gulberg Lahore", Dr. Ayesha Tariq (dentist), patient Hamza Iqbal (M, 24) and pediatric patient Zainab Ali (F, 8).*

1. **Activation:** enable `pack.dental` + `pack.dental.ortho` at onboarding → Dental Chart tab, dental intake fields, catalog, order sets, and WhatsApp templates all appear; disabling entitlement hides all of it (verify with a second, aesthetic-only tenant on the same DB — RLS + entitlements).
2. **Charting:** in Hamza's encounter, chart CARIES 36 (MO), CARIES 16 (O), MISSING 28, FILLED 11 (existing). Verify colors/textures, hover tooltip, patient-perspective layout, and that charting a surface condition without surfaces is rejected.
3. **Perio:** run full perio exam; enter PDs keyboard-only for one quadrant incl. a 6mm bleeding site at 46-DB; verify auto-advance, red shading, %BOP computed excluding 28; open Trends and see the exam plotted.
4. **Plan → billing:** promote both caries to plan (filling ×2, molar priced 7,000; add RCT-M + PFM crown for 36 after "pulpal involvement" note, price override 28,000). Patient accepts plan. Complete filling on 16 in today's visit → invoice shows "Composite Filling — 16 (O) … PKR 7,000", FBR-ready; composite capsule stock decremented by 1.
5. **Imaging order set:** order RCT series for 36 → pre-op RVG order created, IMG-RVG billed at 1,000; OPG order for new-patient exam at 3,000.
6. **Safety:** attempt to complete extraction on 26 when plan says 36 → hard block; confirm-modal shows "Lower Left First Molar (36)". Flag Hamza as on warfarin → extraction plan item shows anticoagulant banner.
7. **Pediatric:** open Zainab (8y) → Mixed layer; chart CARIES 75 and PULPOTOMY plan; permanent-only numbers rejected in primary row; amoxicillin from post-extraction set computes weight-based dose (20kg).
8. **Ortho:** create OrthoCase for Hamza (metal fixed, Class II div 1, 20 months, PKR 190,000 package with 10 installments). Bond event with appliance map (bands 16/26/36/46), wire 0.014 NiTi; take records photo session → appears on case timeline; complete one ADJUSTMENT a month later → installment invoice raised, WhatsApp adjustment reminder scheduled for next month.
9. **Recall:** complete scaling → patient auto-enrolled in 6-month WhatsApp recall (verify scheduled template in Urdu); post-extraction instruction message fires on extraction note sign.
10. **Reports:** perio risk register lists Hamza (PD 6mm); production report shows today's PKR total; ortho aging shows the active case. Encounter signed → chart read-only; a correction creates a superseding finding with audit trail.

Pass = all 10 steps succeed on web + steps 2–4 repeated on tablet (Flutter) with touch surface-picker.

---

### Sources

- FDI two-digit notation / ISO 3950 (quadrants 1–4 permanent, 5–8 primary): [Wikipedia — FDI World Dental Federation notation](https://en.wikipedia.org/wiki/FDI_World_Dental_Federation_notation), [Wikipedia — Dental notation](https://en.wikipedia.org/wiki/Dental_notation)
- Six-site perio charting parameters (PD, BOP, recession, furcation, mobility): [SDCEP — Periodontal parameters](https://www.periodontalcare.sdcep.org.uk/guidance/assessment/special-tests/full-periodontal-examination/what-should-be-recorded/periodontal-parameters/), [Periodontal Charting Guide](https://patientnotes.ai/resources/periodontal-charting)
- Pakistan dental pricing 2025-26 (scaling, RCT, crowns, extractions, implants, braces): [The Urban Dentist Islamabad — price list](https://theurbandentist.pk/pricing/), [Dr Shahzad Mirza — RCT price in Pakistan](https://drshahzadmirza.com/root-canal-treatment-price-in-pakistan/), [Dental Experts — RCT cost 2026](https://dentalexperts.pk/root-canal-treatment-cost-in-pakistan-2026-complete-price-guide/), [Marham — scaling price](https://www.marham.pk/all-services/scaling), [Dr Shahzad Mirza — implant costs](https://drshahzadmirza.com/guide-to-dental-implant-costs-in-pakistan/)
- OPG/dental X-ray pricing Pakistan: [oladoc — Dental OPG Karachi](https://oladoc.com/pakistan/karachi/treatment/dental-opg), [AlNoor Diagnostic Lahore — OPG](https://alnoordiagnostic.com/best-opg-x-ray-best-dental-x-ray-services-in-lahore/)

## Obstetrics & Gynaecology Pack (`pack.obgyn`) — HEAVY

### Purpose & scope

Runs a complete pregnancy episode from booking to postnatal discharge — ANC card with WHO 8-contact schedule, structured obstetric ultrasound, TT/Td tracking, delivery billing, and a WHO Labour Care Guide partogram (Wave-later) — plus a gynae mode (menstrual/cycle, PCOS, infertility) for non-pregnant visits. Target clinic types: standalone gynae/obs clinics (the largest single specialty in Pakistani private practice), polyclinics with a lady-doctor chair, and hospital Obs/Gyn departments with labour rooms. Built entirely as configuration + two widgets on the shared core; the partogram is the only genuinely novel clinical component and ships in a later wave.

---

### Data model

All models carry `tenantId` with RLS; all timestamps `createdAt/updatedAt`; all clinical writes audited via the core audit log. FHIR alignment noted per model.

**EXISTING (core, reused as-is):** `Patient`, `Encounter`, `TreatmentPlan` / `TreatmentPlanSession` (multi-session packages), `Invoice`/`InvoiceLine` (PKR, FBR), `Order`/`OrderSet`, `InventoryItem`/`StockBatch` (batch/expiry), `Immunization` (FHIR Immunization — already used by Paeds EPI), `ScoredInstrumentResult`, `MediaAsset` + `PhotoConsent`, `TrendSeries` (Longitudinal Trends engine), `JourneyEnrollment` (WhatsApp).

**NEW models:**

```prisma
model PregnancyEpisode {            // FHIR: EpisodeOfCare + Condition(pregnancy)
  id            String   @id @default(uuid())
  tenantId      String
  patientId     String              // -> Patient (must be female; DOB check, see safety)
  // Dating
  lmp           DateTime?           // nullable — unknown dates are common
  lmpReliable   Boolean  @default(false)
  eddByLmp      DateTime?           // server-computed Naegele: LMP + 280 days
  eddByUsg      DateTime?           // from linked dating scan
  eddFinal      DateTime?           // the working EDD; every GA in the app derives from this
  eddMethod     EddMethod           // LMP | USG | CLINICAL
  eddLockedAt   DateTime?           // once confirmed, changes require reason + audit entry
  // Obstetric history (booking snapshot)
  gravida       Int
  para          Int
  abortus       Int
  livingChildren Int
  bloodGroup    String?             // A/B/AB/O
  rhFactor      RhFactor?           // POSITIVE | NEGATIVE | UNKNOWN
  heightCm      Decimal?
  prePregnancyWeightKg Decimal?
  // Risk
  riskFlags     RiskFlag[]          // enum[]: PREV_CS, GRAND_MULTIPARA, AGE_UNDER_18, AGE_OVER_35,
                                    // ANEMIA, GDM, CHRONIC_HTN, PIH_PREECLAMPSIA, PREV_STILLBIRTH,
                                    // PREV_PPH, RH_NEGATIVE, MULTIPLE_PREGNANCY, PLACENTA_PREVIA,
                                    // PREV_PRETERM, BAD_OBSTETRIC_HISTORY, CARDIAC_DISEASE, OTHER
  riskNotes     String?
  fetusCount    Int      @default(1)
  status        PregnancyStatus     // ACTIVE | DELIVERED | MISCARRIED | TERMINATED |
                                    // ECTOPIC | TRANSFERRED_OUT | LOST_TO_FOLLOWUP
  treatmentPlanId String?           // -> TreatmentPlan (ANC package; sessions = ANC contacts)
  // Outcome (filled at closure)
  deliveryDate  DateTime?
  deliveryMode  DeliveryMode?       // SVD | ASSISTED_VACUUM | ASSISTED_FORCEPS | ELECTIVE_CS | EMERGENCY_CS
  deliveryEncounterId String?
  babyRecords   Json?               // [{sex, weightGrams, apgar1, apgar5, outcome, nicu, linkedPatientId?}]
  complications String[]            // PPH, PERINEAL_TEAR_3_4, ECLAMPSIA, ...
  @@index([tenantId, patientId, status])
  // Enforced in service layer: max ONE ACTIVE episode per patient per tenant
}

model AncVisit {                     // FHIR: Observation bundle attached to Encounter
  id            String   @id @default(uuid())
  tenantId      String
  pregnancyEpisodeId String
  encounterId   String   @unique    // 1:1 — every ANC visit IS an encounter (billable)
  visitDate     DateTime
  contactNumber Int?                // WHO contact 1..8+ (auto-suggested from GA, editable)
  gaWeeks       Int?                // auto from eddFinal at visitDate; editable w/ audit
  gaDays        Int?
  weightKg      Decimal?
  bpSystolic    Int?
  bpDiastolic   Int?
  fundalHeightCm Decimal?           // SFH; from ~24 wk
  fhrBpm        Int?                // per-fetus values live in fhrPerFetus when fetusCount > 1
  fhrPerFetus   Json?               // [{fetus: 1, bpm: 142}, ...]
  fhrMethod     FhrMethod?          // DOPPLER | PINARD | CTG | USG
  presentation  Presentation?       // CEPHALIC | BREECH | TRANSVERSE | OBLIQUE | UNSTABLE | NOT_ASSESSED
  engagementFifths Int?             // 0..5 fifths palpable
  urineAlbumin  DipstickResult?     // NIL | TRACE | PLUS_1 | PLUS_2 | PLUS_3 | PLUS_4
  urineSugar    DipstickResult?
  hbGdl         Decimal?
  oedema        OedemaGrade?        // NONE | ANKLE | PITTING_KNEE | GENERALIZED
  fetalMovements FmStatus?          // NORMAL | REDUCED | ABSENT | NA_TOO_EARLY
  dangerSigns   String[]            // BLEEDING, SEVERE_HEADACHE, BLURRED_VISION, REDUCED_FM, ...
  ironFolateGiven Boolean @default(false)   // dispenses hit inventory
  calciumGiven    Boolean @default(false)
  ttImmunizationId String?          // -> Immunization if a Td dose given this visit
  planNotes     String?
  nextVisitDate DateTime?
  alertFlags    String[]            // server-computed (see safety): HTN, SEVERE_HTN, PROTEINURIA,
                                    // ANEMIA, SEVERE_ANEMIA, FHR_ABNORMAL, MALPRESENTATION_LATE, SFH_LAG
  @@index([tenantId, pregnancyEpisodeId, visitDate])
}

model ObstetricUltrasound {          // FHIR: DiagnosticReport + Observations
  id            String   @id @default(uuid())
  tenantId      String
  pregnancyEpisodeId String
  encounterId   String?
  orderId       String?             // -> Order (so the scan bills)
  scanDate      DateTime
  scanType      ScanType            // DATING | NT | ANOMALY | GROWTH | BPP | DOPPLER | CERVICAL_LENGTH
  fetusNumber   Int      @default(1)   // one row PER FETUS per study
  studyId       String              // groups fetus rows of one study
  // Early biometry
  crlMm         Decimal?
  gsMm          Decimal?
  // Standard biometry
  bpdMm         Decimal?
  hcMm          Decimal?
  acMm          Decimal?
  flMm          Decimal?
  efwGrams      Int?                // auto: Hadlock-3 (HC/AC/FL):
                                    // log10(EFW) = 1.326 − 0.00326·AC·FL + 0.0107·HC + 0.0438·AC + 0.158·FL (cm)
                                    // fallback Hadlock-2 (BPD/AC/FL) when HC missing
  efwFormula    String?             // "HADLOCK3" | "HADLOCK2" | "MANUAL"
  efwPercentile Decimal?            // vs GA reference (Trends engine reference-band table)
  gaByUsgWeeks  Int?
  gaByUsgDays   Int?
  fetalHeartActivity Boolean?
  fhrBpm        Int?
  presentation  Presentation?
  placentaSite  PlacentaSite?       // ANTERIOR | POSTERIOR | FUNDAL | LATERAL_LEFT | LATERAL_RIGHT |
                                    // LOW_LYING | PREVIA_MARGINAL | PREVIA_COMPLETE
  liquorAfiCm   Decimal?            // AFI; normal band 5–24 cm shown in UI
  liquorDvpCm   Decimal?            // deepest vertical pocket
  liquorAssessment LiquorAssessment? // NORMAL | OLIGOHYDRAMNIOS | POLYHYDRAMNIOS | ANHYDRAMNIOS
  cervicalLengthMm Decimal?
  anomalyChecklist Json?            // structured normal/abnormal/not-seen per system (anomaly scan)
  adnexaFindings Json?              // gynae reuse: [{laterality: LEFT|RIGHT (core laterality enum), finding, sizeMm}]
  impression    String
  performedById String
  mediaAssetIds String[]            // scan images via existing MediaAsset
  @@index([tenantId, pregnancyEpisodeId, scanDate])
}

model Partogram {                    // WAVE-LATER. FHIR: custom profile on Observation bundle
  id            String   @id @default(uuid())
  tenantId      String
  pregnancyEpisodeId String
  encounterId   String              // the labour/delivery encounter
  startedAt     DateTime            // active labour confirmed (≥5 cm per WHO LCG)
  parity        Int
  membraneStatus MembraneStatus     // INTACT | RUPTURED_SPONT | RUPTURED_ARM
  membranesRupturedAt DateTime?
  companionPresent Boolean?         // LCG supportive-care section
  painReliefOffered Boolean?
  oralFluidsAllowed Boolean?
  status        PartogramStatus     // ACTIVE | DELIVERED | REFERRED | CS_DECIDED | CLOSED
  closedAt      DateTime?
  closureNote   String?
}

model PartogramEntry {               // APPEND-ONLY: no update/delete API; corrections = new entry
  id            String   @id @default(uuid())
  tenantId      String
  partogramId   String
  recordedAt    DateTime
  recordedById  String
  correctsEntryId String?           // strike-through display of the corrected entry
  cervicalDilationCm Int?           // 0..10
  descentFifths Int?                // 5..0 palpable
  contractionsPer10Min Int?
  contractionDurationSec Int?
  fhrBpm        Int?
  fhrDeceleration Decel?            // NONE | EARLY | LATE | VARIABLE | UNKNOWN
  amnioticFluid AmnioticFluid?      // INTACT | CLEAR | MECONIUM | BLOOD_STAINED | ABSENT
  caput         Grade0to3?
  moulding      Grade0to3?
  maternalPulse Int?
  bpSystolic    Int?
  bpDiastolic   Int?
  temperatureC  Decimal?
  urineOutput   String?
  urineProtein  DipstickResult?
  oxytocinUnitsPerL Decimal?
  oxytocinDropsPerMin Int?
  medicines     String?
  ivFluids      String?
  assessment    String?
  plan          String?
  alertFlags    String[]            // server-computed vs WHO LCG thresholds (see safety)
  @@index([tenantId, partogramId, recordedAt])
}

model GynaeProfile {                 // one per patient per tenant; FHIR: Observations on Patient
  id            String   @id @default(uuid())
  tenantId      String
  patientId     String
  menarcheAgeYears Int?
  cycleLengthDays Int?
  cycleRegularity CycleRegularity?  // REGULAR | IRREGULAR | AMENORRHEA | OLIGOMENORRHEA
  flowDurationDays Int?
  flowAmount    FlowAmount?         // LIGHT | NORMAL | HEAVY | HEAVY_WITH_CLOTS
  dysmenorrhea  Severity?           // NONE | MILD | MODERATE | SEVERE
  lmpRecorded   DateTime?
  contraceptionMethod Contraception? // NONE | OCP | IUCD | INJECTABLE | IMPLANT | CONDOM | TL | OTHER
  papSmearLastDate DateTime?
  // PCOS intake — Rotterdam checklist + Ferriman–Gallwey via Scored-Instrument engine (config, no code)
  pcosRotterdam Json?               // {oligoAnovulation: bool, hyperandrogenismClinical: bool,
                                    //  hyperandrogenismBiochem: bool, polycysticOvariesUsg: bool}
  // Infertility intake
  infertilityType InfertilityType?  // PRIMARY | SECONDARY
  infertilityDurationMonths Int?
  partnerSemenAnalysisDone Boolean?
  tubalPatencyTest TubalTest?       // NONE | HSG | LAPAROSCOPY
  priorTreatments String?
  @@unique([tenantId, patientId])
}
```

**TT/Td tracking = EXISTING `Immunization` + NEW config.** No new model. Pack ships an immunization schedule config `td_maternal_pk` mirroring the Pakistan EPI / WHO 5-dose women-of-childbearing-age schedule: TT1 at first ANC contact, TT2 ≥4 weeks after TT1 (protects current pregnancy), TT3 ≥6 months after TT2 (~5 yr protection), TT4 ≥1 year after TT3 (~10 yr), TT5 ≥1 year after TT4 (lifelong for childbearing years). The core schedule engine (already built for Paeds EPI) computes due/overdue and drives recall. `AncVisit.ttImmunizationId` links a dose to the visit; the vaccine dispense decrements a `StockBatch`.

**How records tie together:** `PregnancyEpisode` hangs off `Patient` and owns its `TreatmentPlan` (the ANC package — each completed `AncVisit`'s encounter consumes one plan session). Every `AncVisit`, ultrasound and partogram belongs to an `Encounter`, so billing, notes and audit come free from the core. Scans are fulfilments of `Order`s from the pack's order sets → auto-invoice lines. Delivery packages are one-off catalog items billed on the delivery encounter; the outcome block closes the episode and triggers the postnatal WhatsApp journey. Laterality: obstetrics itself doesn't need it, but gynae ultrasound `adnexaFindings` uses the core laterality enum (left/right ovary/tube) — no pack-specific laterality code.

---

### Widget UI spec

Two widgets, both registered in the pack manifest and rendered inside the consultation screen's specialty-widget slot (right of the note editor on desktop ≥1280 px; full-width tab on tablet 768–1279 px).

**Widget 1 — Pregnancy / ANC Card (Wave 1).** Visible when pack entitled AND patient is female. Three top-level states:

- **Empty (no active episode):** card shows gynae summary strip (LMP, cycle, contraception from `GynaeProfile`) + primary button "Start pregnancy episode". Clicking opens the booking dialog: LMP (with "unreliable/unknown" checkbox), G/P/A steppers, height/weight, blood group + Rh, risk-flag chips (multi-select with auto-suggestions: age computed from DOB, para ≥5 → GRAND_MULTIPARA), optional "attach ANC package" (creates TreatmentPlan from catalog). Validation: gravida ≥ para + abortus; LMP not in future and not >44 weeks ago (else block with "check dates — consider USG dating"). On save, header shows computed EDD (Naegele) with method badge.
- **Active episode — the main view.** Layout, top to bottom:
  - **Header strip (sticky):** "G3 P2 A0 • GA 28+3 wk • EDD 24 Sep 2026 (USG)" + risk chips (red = severe) + TT status chip ("TT2 given, TT3 due Jan 2027") + fetus count badge if >1.
  - **Tabs:** *ANC Grid* | *Trends* | *Scans* | *History & Risk* | *Outcome*.
  - **ANC Grid (default):** the classic ANC-card visit grid — **columns = visits** (header: date + GA + contact №), **rows = parameters** (Weight, BP, SFH, FHR, Presentation, Urine alb, Hb, Oedema, Fe/folate, TT, Danger signs, Next visit). First column sticky; horizontal scroll for >6 visits; newest visit column highlighted. Cell rendering: values with unit; out-of-range values get amber/red background per the safety rules; empty = "—". A ghost column "＋ New visit" opens the visit entry form pre-filled with today's GA and the suggested WHO contact number (1st contact ≤12 wk, then 20, 26, 30, 34, 36, 38, 40 wk — the scheduler suggests the next slot from `eddFinal`). Row header hover shows the normal range. Tablet: grid flips to one-visit-per-card vertical list with the same fields.
  - **Visit entry form (drawer, desktop; full screen, tablet):** grouped inputs with inline validation — BP as paired numeric (sys 60–260, dia 30–160), weight (30–160 kg, warn if >3 kg gain since last visit or any loss), SFH (10–45 cm; ghost hint "expected ≈ GA ± 2 cm after 24 wk"), FHR numeric with method select (range gate 60–220, alert band outside 110–160), per-fetus FHR inputs when `fetusCount > 1`, presentation select (warn if non-cephalic ≥36 wk), dipsticks as segmented NIL→++++ controls, Hb (3–18 g/dL), danger-signs checklist. Saving computes `alertFlags` server-side and re-renders the grid; any red flag also raises a dismissible banner at the top of the consultation screen ("BP 165/112 — severe hypertension. Open PIH order set?") with a one-click order-set launch.
  - **Trends tab:** Longitudinal Trends engine (config only): weight-vs-GA, BP (both lines, 140/90 reference line), SFH-vs-GA with the GA±2 cm expected band, Hb with 11 and 7 g/dL reference lines, EFW percentile points from scans.
  - **Scans tab:** table of `ObstetricUltrasound` studies (date, type, GA by scan, EFW + percentile, placenta, liquor, impression) + "New scan" structured form. EFW auto-computes on blur of the last biometry field, formula badge shown; manual override allowed with reason. Multi-fetal studies render one sub-row per fetus. Placenta PREVIA_* or liquor OLIGO/POLY selections add the corresponding risk flag to the episode (with toast, undoable).
  - **Outcome tab:** closure form (status, mode, date, per-baby rows with weight/sex/Apgar, complications, "register baby as patient" button that creates a linked Paeds patient). Closing sets episode read-only (banner: "Episode closed — Delivered 12 Mar 2026") and enrolls the postnatal journey.
- **Error states:** failed save keeps the drawer open with field-level errors; network failure shows retry toast and preserves the draft locally (visit forms are the highest-loss-risk input in the app); permission-denied (entitlement lapsed) renders the card with a lock overlay, data still readable.

**Widget 2 — Partogram (WHO Labour Care Guide) — WAVE-LATER sub-widget.** Opens from the episode header ("Start labour record") on a delivery encounter; also full-screen route for labour-room tablets.

- **Layout (mirrors the printed LCG):** X axis = time, one column per hour from `startedAt` (columns subdivide to 30 min in second stage). Stacked swimlane sections: **Supportive care** (companion / pain relief / oral fluids / posture — tap-to-cycle ✓/✗ cells), **Baby** (FHR plotted line + deceleration code, amniotic fluid, caput, moulding), **Woman** (pulse plotted, BP as ↕ whisker, temp, urine), **Labour progress** (contractions as filled bars — height = frequency/10 min, fill pattern = duration; cervical dilation as ✗ plot and descent as ○ plot on a 0–10 grid), **Medication** (oxytocin rate rows, drugs, IV fluids), **Assessment & plan** free-text row.
- **Alert model (replaces alert/action lines, per LCG 2020):** each parameter row has a printed alert boundary; entries breaching it turn the cell red and push a non-blocking alert chip into the header. Thresholds: FHR <110 or ≥160 bpm; contractions ≤2 or >5 per 10 min, duration <20 s or >60 s; and dilation-time limits — labour is flagged if the woman remains at 5 cm ≥6 h, 6 cm ≥5 h, 7 cm ≥3 h, 8 cm ≥2.5 h, or 9 cm ≥2 h without progressing. The dilation grid renders these per-centimetre time-limit boundaries as a stepped shaded region (visually replacing the old 1 cm/h alert line). Second stage: flags at ≥3 h (nulliparous) / ≥2 h (parous) from full dilation.
- **Interactions:** "＋ Entry" button per section or a combined hourly-obs form; entries are append-only — a long-press offers "Correct", which creates a new entry referencing the old (old renders struck-through). Dilation can never decrease; attempting it demands the correction flow. Closing requires an outcome (delivered / CS decided / referred) and freezes the record permanently.
- **States:** empty (pre-start checklist: confirm ≥5 cm — LCG starts the active-phase record at 5 cm — parity, membranes); active (auto-scrolls to current hour, 60-min "observation due" pulse on the current column); closed (read-only, printable A4 landscape matching the WHO layout for medico-legal filing).

---

### Pack manifest contents

**Entitlement key:** `pack.obgyn` (sub-flag `pack.obgyn.partogram` so the labour module can be sold/enabled separately for hospitals). Activation: selectable for `clinic_type in (single_specialty, polyclinic, hospital_department)`.

**Intake fields (booking/registration extension):** marital status; husband/next-of-kin name & phone (WhatsApp consent number often the husband's — capture "who owns this number"); G/P/A + living children; LMP + reliability; blood group/Rh; consanguinity (y/n); previous deliveries summary (year, mode, place, outcome, birth weight); previous CS count; medical history checklist (HTN, DM, thyroid, TB, hepatitis B/C status, cardiac); allergy list (core); smoking/naswar exposure; folic-acid use; for gynae mode: menarche, cycle pattern, contraception, pap-smear date.

**Note templates (core note engine, config only):**
1. **ANC Booking Visit** — history, obstetric history table, examination, dating, risk assessment, booking-labs order block, plan & schedule.
2. **ANC Follow-up** — interval history, danger-sign review, examination (auto-pulls the AncVisit vitals block), plan.
3. **Obstetric Ultrasound Report** — indication, biometry table (auto from `ObstetricUltrasound`), placenta/liquor, impression, recommendation.
4. **Gynae Consultation** — menstrual history block, complaint, examination (incl. per-speculum/bimanual), assessment, plan.
5. **PCOS Review** — Rotterdam checklist, Ferriman–Gallwey score (Scored-Instrument), metabolic screen results, plan.
6. **Infertility Workup** — couple history, prior treatments, baseline investigations grid, plan.
7. **Delivery Note** — labour summary (pulls partogram closure), mode, baby details, blood loss, perineum, immediate PNC.
8. **Postnatal Check** — bleeding/lochia, BP, breastfeeding, mood screen (Edinburgh EPDS via Scored-Instrument engine — config), family-planning counselling, baby feeding/weight.

**Service catalog (PKR, mid-tier private clinic, editable per tenant):**

| Code | Item | PKR |
|---|---|---|
| OBG-001 | Gynae/Obs consultation | 2,500 |
| OBG-002 | ANC follow-up visit | 2,000 |
| OBG-003 | ANC package — 8 contacts (consults + urine dip + Hb each visit) | 16,000 |
| OBG-004 | Dating ultrasound (TVS/TAS) | 2,500 |
| OBG-005 | Anomaly scan (18–22 wk) | 5,000 |
| OBG-006 | Growth scan + AFI | 3,500 |
| OBG-007 | Biophysical profile / Doppler study | 4,500 |
| OBG-008 | CTG | 1,500 |
| OBG-009 | Td (tetanus) injection incl. vaccine | 500 |
| OBG-010 | Normal delivery package (24–48 h stay, consumables) | 85,000 |
| OBG-011 | C-section package (surgeon + OT + 48–72 h stay) | 185,000 |
| OBG-012 | Postnatal check (mother + newborn) | 2,500 |
| OBG-013 | IUCD insertion (device incl.) | 6,000 |
| OBG-014 | Pap smear collection | 3,000 |
| OBG-015 | Infertility baseline workup (couple, excl. lab fees) | 8,000 |

**Order sets:**
- **ANC Booking Labs:** CBC/Hb, blood group & Rh, RBS, HBsAg, anti-HCV, HIV (opt-in), urine C/E, TSH (optional toggle).
- **GDM Screen (24–28 wk):** 75 g OGTT.
- **PIH/Pre-eclampsia Workup:** urine protein:creatinine, CBC/platelets, LFT, RFT/uric acid, growth scan + Doppler.
- **Anemia Protocol:** ferritin, oral iron + folic acid Rx lines, Hb recheck at +4 wk (auto follow-up task).
- **Rh-negative Protocol:** ICT, anti-D 300 µg at 28 wk + postnatal dose task.
- **PCOS Workup:** LH/FSH, TSH, prolactin, free testosterone, fasting insulin/glucose, lipid profile, pelvic USG.
- **Infertility Baseline:** day-2/3 FSH/LH, TSH, prolactin, AMH (optional), husband semen analysis, mid-luteal progesterone, HSG referral.

---

### Integrations

- **Billing:** every AncVisit encounter either consumes a `TreatmentPlanSession` from the ANC package or bills OBG-002 à la carte (core plan logic — zero new code). Scans bill via order fulfilment. Delivery packages are single invoice lines with configurable component breakdown for FBR-compliant invoices; deposits/partial payments use the core payment ledger (deliveries are the highest-value invoices in a gynae clinic).
- **Inventory / consumables:** Td vaccine (batch + expiry — reuses EPI cold-chain fields), anti-D immunoglobulin, iron/folate & calcium (dispensed from AncVisit checkboxes), oxytocin/misoprostol, IUCD devices, delivery-kit consumable bundle (auto-decrement on OBG-010/011 billing via the core BOM-per-service mapping), dipsticks.
- **WhatsApp journeys (Meta Cloud API, journey-engine config):**
  - *ANC journey* — enrolled at episode creation, keyed to `eddFinal`: visit reminders T-2 days for each WHO contact (≤12, 20, 26, 30, 34, 36, 38, 40 wk), missed-visit nudge at T+3 days, trimester-appropriate danger-sign education messages (Urdu/English templates), GDM-screen reminder at 24 wk, TT-due reminders from the immunization schedule engine.
  - *Postnatal journey* — enrolled at episode closure with status DELIVERED: check-in messages aligned to WHO PNC contacts (within 24 h handled in-facility; day 3, day 7–14, week 6), maternal danger signs (bleeding, fever, severe headache), breastfeeding support, week-6 visit + family-planning reminder, and a cross-pack handoff prompt to start the baby's EPI schedule (Paeds pack, if entitled).
  - *Recall:* miscarriage/loss closure **immediately unenrolls all pregnancy journeys** (see safety) and offers an optional single follow-up-visit reminder.
- **Treatment plans:** ANC package as above; infertility treatment cycles (e.g., 3× ovulation-induction cycles) model naturally as multi-session plans — config only.
- **Reports (core report engine + pack queries):** ANC register (govt-format export), EDD list by month (bed/OT planning), high-risk pregnancy registry, TT coverage, delivery statistics (mode split, CS rate), ANC-package utilisation, defaulter list (missed contacts).

---

### Clinical safety & edge cases

1. **EDD governance:** all GA displays derive from `eddFinal` only. If USG dating differs from LMP dating beyond threshold (>5 d before 9 wk, >7 d at 9–15 wk), the UI prompts re-dating to USG; changing a locked EDD requires a typed reason and writes an audit entry; historical AncVisit GA values are stored as-entered (never silently recomputed).
2. **Server-side alert rules (never client-only):** BP ≥140/90 → HTN flag; ≥160/110 → SEVERE_HTN red banner; HTN + urine albumin ≥+1 → PRE_ECLAMPSIA_SUSPECT with one-click PIH order set; Hb <11 g/dL → ANEMIA, <7 → SEVERE_ANEMIA red banner (WHO pregnancy thresholds); FHR outside 110–160 → FHR_ABNORMAL; non-cephalic presentation at ≥36 wk → MALPRESENTATION_LATE; SFH deviating >3 cm from GA → SFH_LAG (suggest growth scan). Alerts are non-blocking (clinician judgment) but dismissal is audited.
3. **One ACTIVE episode per patient** (service-layer + partial unique index). Starting a new episode requires closing the previous with an outcome — prevents orphaned journeys and double recalls.
4. **Fetal demise / loss pathway:** recording "fetal heart activity: absent" on a scan ≥12 wk triggers a confirm dialog, does NOT auto-close the episode (clinician confirms), but **immediately pauses all WhatsApp pregnancy messaging** pending closure. Loss closures (MISCARRIED/TERMINATED/stillbirth outcome) hard-unenroll journeys — sending a "your baby is due soon" message after a loss is the single worst failure mode of this pack; covered by an explicit regression test.
5. **Partogram integrity:** append-only entries, corrections by reference, record frozen at closure, server timestamps authoritative (client clock ignored) — the partogram is a medico-legal document in Pakistani litigation.
6. **Rh-negative:** RH_NEGATIVE flag auto-set from booking bloods; 28-wk anti-D task and postnatal anti-D task auto-created; inventory-checked before the visit.
7. **Multiple pregnancy:** `fetusCount` drives per-fetus FHR inputs and per-fetus scan rows; EFW percentile flagged as singleton-reference (display caveat).
8. **Unknown LMP** (common): episode can be created with LMP null + eddMethod USG/CLINICAL; grid shows "GA by scan".
9. **Privacy:** pregnancy status is sensitive — episode data excluded from general receptionist list views (role-scoped); WhatsApp templates never state pregnancy explicitly in the first message when the registered number is shared/family-owned ("You have an appointment at <clinic>").
10. **Minor/teen pregnancy (age <18):** AGE_UNDER_18 flag auto-set; configurable tenant policy note (PMDC ethical/medico-legal context), no blocking.
11. **Unit hygiene:** biometry stored in mm, Hadlock computed in cm — conversion in one server-side function with unit tests against published reference values; EFW never computed client-side.
12. **Dose calculator reuse:** weight-based dose calculator available on labour meds (e.g., MgSO₄ loading regimen surfaced as a checklist, not auto-ordered).

---

### Effort (dev-weeks; team = 1 BE + 1 FE + shared QA)

| Piece | Type | Size | Est. |
|---|---|---|---|
| PregnancyEpisode + AncVisit models, APIs, alert-rule service, episode lifecycle | new code | M | 2.0 |
| ANC Card widget (grid, drawer, header, states, tablet) | new code | L | 3.0 |
| Trends configs (weight/BP/SFH/Hb/EFW bands) | config on Trends engine | S | 0.5 |
| ObstetricUltrasound model + structured form + Hadlock EFW service | new code | M | 2.0 |
| TT/Td schedule config + AncVisit linkage | config on immunization engine | S | 0.5 |
| GynaeProfile + gynae mode UI + PCOS/infertility intakes (FG score, EPDS = Scored-Instrument JSON) | new code (thin) + config | M | 1.5 |
| Catalog, note templates, order sets, intake fields, manifest | pure config | S | 0.5 |
| WhatsApp ANC + postnatal journeys, unenroll safety hooks | config + small code (hooks) | S | 1.0 |
| Reports (ANC register, EDD list, high-risk, TT coverage) | config + queries | S | 1.0 |
| **Wave 1 total** | | | **≈ 12 dev-weeks** |
| Partogram widget (LCG grid, append-only entries, alert engine, print) | new code | L | 4.0 |
| **Wave-later total** | | | **≈ 4 dev-weeks** |

Roughly 55% new code (two widgets + episode/alert services), 45% configuration on existing shared engines — consistent with the no-fork pack doctrine.

---

### Acceptance criteria — end-to-end demo script

1. **Onboard** "Rahima Maternity Clinic, Lahore" as single-specialty gynae; entitlement `pack.obgyn` on, `pack.obgyn.partogram` off → ANC widget appears in consultation screen; partogram button absent. Toggle partogram flag on → button appears (entitlement gating proven).
2. **Register** patient *Ayesha Khalid*, 27 F, husband's WhatsApp number, intake shows OBG fields.
3. **Start episode:** LMP 5 Jan 2026, G3 P2 A0, Rh-negative → EDD auto-computes 12 Oct 2026 (Naegele), RH_NEGATIVE flag auto-set, anti-D 28-wk task created. Attach ANC package OBG-003 → TreatmentPlan with 8 sessions and invoice created.
4. **Booking visit (contact 1):** ANC Booking template opens; fire ANC Booking Labs order set; record visit — BP 110/70, weight 58 kg, Hb 10.2 → ANEMIA amber flag appears in grid and Anemia Protocol suggested; give TT1 → Immunization row created, Td stock batch decremented; visit consumes plan session 1/8; encounter closes with zero balance due (package).
5. **Dating scan:** CRL-based GA differs from LMP by 9 days → re-dating prompt; accept USG → eddFinal updates with audit entry; header GA changes everywhere.
6. **WhatsApp:** journey enrolled; demo T-2 reminder for contact 2 (20 wk) fires in sandbox; skip the visit → T+3 defaulter nudge fires and patient appears on defaulter report.
7. **28-wk visit:** BP 162/112, urine albumin ++ → SEVERE_HTN + PRE_ECLAMPSIA_SUSPECT red banner; one click launches PIH order set; growth scan entered (HC 268, AC 235, FL 52 mm) → EFW auto-computes via Hadlock-3 with formula badge and percentile plotted on Trends tab.
8. **TT2** given ≥4 wk after TT1 → TT chip flips to "TT2 ✓, TT3 due +6 mo"; TT coverage report reflects it.
9. **Partogram (flag on):** start labour record at 5 cm; enter hourly obs; hold at 6 cm for 5+ h (simulated timestamps) → dilation cell breaches the 6 cm ≥5 h LCG limit and flags red; enter FHR 168 → FHR alert chip; attempt to edit an old entry → blocked, correction flow creates strike-through pair; close as SVD → record frozen, A4 print renders LCG layout.
10. **Delivery & closure:** bill OBG-010 (PKR 85,000, FBR invoice, delivery-kit consumables auto-decrement); Outcome tab — girl, 3.1 kg, Apgar 8/9; "register baby" creates linked patient; episode closes read-only.
11. **Postnatal:** journey enrolls; day-3 check-in message fires; week-6 visit uses Postnatal Check template incl. EPDS score via Scored-Instrument engine; baby handoff prompt offers Paeds EPI enrolment.
12. **Negative test (must pass):** open a second patient, start episode, close as MISCARRIED → assert zero further pregnancy-journey messages queue for that patient.
13. **Gynae mode:** patient with no active episode → widget shows gynae profile; complete PCOS Review with Ferriman–Gallwey score entered as JSON-defined instrument (no code); PCOS Workup order set bills correctly.

Pass = all 13 steps execute without code changes beyond the pack manifest + the two widgets described.

---

**Sources**

- WHO Labour Care Guide chart (alert thresholds: FHR <110/≥160; contractions ≤2 or >5 per 10 min, <20 s or >60 s; per-cm dilation time limits 5 cm ≥6 h → 9 cm ≥2 h): https://www.who.int/docs/default-source/reproductive-health/maternal-health/who-labour-care-guide.pdf
- WHO Labour Care Guide — User's Manual (active phase from 5 cm; replacement of alert/action lines with evidence-based time limits): https://iris.who.int/server/api/core/bitstreams/94326918-1f91-49a2-a857-12831cd51b91/content
- Comparative study, WHO LCG vs modified partograph (2020 design changes summary): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12924672/
- WHO Recommendations on Antenatal Care for a Positive Pregnancy Experience (8-contact schedule: ≤12, 20, 26, 30, 34, 36, 38, 40 wk): https://www.who.int/docs/default-source/reproductive-health/maternal-health/anc.pdf and https://www.ncbi.nlm.nih.gov/books/NBK409109/
- Hadlock EFW formulas (Hadlock-3 HC/AC/FL coefficients; accuracy review): https://obgyn.onlinelibrary.wiley.com/doi/full/10.1002/uog.22000 and https://pmc.ncbi.nlm.nih.gov/articles/PMC5025123/ and https://perinatology.com/calculators/hadlock%204.htm
- Federal Directorate of Immunization Pakistan — tetanus (maternal TT/Td program context): https://www.epi.gov.pk/vaccine-preventable-diseases/tetanus/
- WHO/SAGE maternal tetanus 5-dose schedule review (TT1–TT5 intervals and protection durations): https://terrance.who.int/mediacentre/data/sage/SAGE_Docs_Ppt_Oct2016/7_session_tetanus/Oct2016_session7_vax_sch_for_tetanus.pdf
- MSF Medical Guidelines — Td vaccine dosing intervals: https://medicalguidelines.msf.org/en/viewport/EssDr/english/tetanus-diphtheria-vaccine-td-39849242.html

## Pediatrics Pack (HEAVY)

*Health OS specialty pack — configuration + content + growth widget on the shared clinical core. No code fork. July 2026, Pakistan-first.*

---

### Purpose & scope

The Pediatrics Pack turns the shared Health OS core into a well-baby / child-health workflow: WHO growth monitoring with LMS z-score/percentile computation and growth-chart plotting, weight-based drug dosing, developmental-milestone surveillance, EPI immunization tracking, and newborn intake. It is activated for **single-specialty pediatric clinics**, as a selectable module in **polyclinics** (GP + peds), and as a **Pediatrics / Neonatology department** in hospitals. Every well-child encounter (0–5y core, extensible to 0–18y) runs through the Growth & Development widget; general peds sick visits reuse the core EMR plus this pack's dose calculator and catalog.

---

### Data model — Prisma-style (extends canonical core)

Convention: `tenant_id` (FK, RLS-enforced) on **every** model; `id` cuid; `createdAt/updatedAt/createdBy`. Laterality reused from core `Laterality` enum where relevant (MUAC arm, hip exam, undescended testis). Growth is bilaterally symmetric so most measures need no laterality.

**EXISTING (core, reused as-is):** `Patient` (add fields below), `Encounter`, `TreatmentPlan`, `Invoice`/`InvoiceLine`, `InventoryItem`/`Batch`, `WhatsAppJourney`, `ScoredInstrument` engine, `TrendSeries` (Longitudinal Trends), `DoseCalculator` engine, `GrowthPercentileEngine` (LMS z-score — shared component, this pack is its first heavy consumer), `ConsentForm`.

```prisma
// EXISTING Patient — NEW pediatric fields
model Patient {
  // ...core...
  birthDateTime      DateTime?   // NEW: time needed for neonatal age-in-hours/days
  gestationalAgeWks  Float?      // NEW: for prematurity correction
  gestationalAgeDays Int?        // NEW
  isPreterm          Boolean  @default(false) // NEW
  birthWeightG       Int?        // NEW
  birthLengthCm      Float?      // NEW
  birthHeadCircCm    Float?      // NEW
  motherPatientId    String?     // NEW: link to mother record (ANC/postnatal continuity)
  guardianName       String?     // NEW
  guardianRelation   String?     // NEW (father/mother/other)
  guardianPhone      String?     // NEW (WhatsApp target; child has no phone)
}

// NEW — one row per measurement session (usually per encounter)
model GrowthMeasurement {
  id             String   @id @default(cuid())
  tenantId       String
  patientId      String
  encounterId    String?              // ties to visit; null for backfilled home data
  measuredAt     DateTime             // used with birthDateTime -> ageDays
  ageDays        Int                  // computed & stored (chart x-axis, LMS lookup key)
  correctedAgeDays Int?               // preterm-corrected until 24mo
  weightKg       Float?
  weightMethod   String?              // "naked-infant-scale" | "standing" | "tared-mother"
  lengthCm       Float?               // recumbent (<24mo)
  heightCm       Float?               // standing (>=24mo)
  statureMethod  String?              // "length" | "height"
  headCircCm     Float?
  muacMm         Float?
  muacArm        Laterality?          // EXISTING enum (left/right)
  bmi            Float?               // derived, stored
  edemaBilateral Boolean @default(false) // kwashiorkor flag -> auto SAM
  source         String  @default("clinic") // "clinic" | "parent-reported" | "referral"
  enteredById    String?
  @@index([tenantId, patientId, ageDays])
}

// NEW — computed z-scores/percentiles, one row per measurement per indicator
model GrowthZScore {
  id            String @id @default(cuid())
  tenantId      String
  measurementId String
  patientId     String
  indicator     GrowthIndicator      // WFA|HFA|LFA|WFL|WFH|BMIFA|HCFA|MUACFA
  standard      String  @default("WHO-2006") // "WHO-2006"(0-5) | "WHO-2007"(5-19)
  L Float
  M Float
  S Float
  zScore        Float
  percentile    Float
  flag          GrowthFlag           // NORMAL|WATCH|MODERATE|SEVERE
  usedCorrectedAge Boolean @default(false)
  @@index([tenantId, patientId, indicator])
}

enum GrowthIndicator { WFA HFA LFA WFL WFH BMIFA HCFA MUACFA }
enum GrowthFlag { NORMAL WATCH MODERATE SEVERE }

// NEW — WHO reference tables (tenant-agnostic seed; NOT tenant-scoped, read-only shared ref)
model WhoLmsReference {
  id        String @id @default(cuid())
  indicator GrowthIndicator
  sex       Sex
  ageDays   Int?     // for -for-age indicators
  lengthCm  Float?   // for WFL/WFH
  L Float
  M Float
  S Float
  @@unique([indicator, sex, ageDays, lengthCm])
}

// NEW — immunization records (EPI). Vaccine defs are pack content; doses are per-patient.
model VaccineDose {
  id           String @id @default(cuid())
  tenantId     String
  patientId    String
  encounterId  String?
  vaccineCode  String              // "BCG","PENTA","PCV13","OPV","IPV","ROTA","MR","TCV","HEPB0"
  doseNumber   Int
  scheduledFor DateTime?           // from EPI schedule vs birthDate
  administeredAt DateTime?
  status       VaccineStatus       // DUE|GIVEN|OVERDUE|DECLINED|CONTRAINDICATED|GIVEN_ELSEWHERE
  batchId      String?             // FK InventoryItem.Batch (cold-chain lot/expiry)
  siteBodyPart String?
  laterality   Laterality?         // EXISTING (L/R thigh, deltoid)
  aefiNote     String?             // adverse event following immunization
  @@index([tenantId, patientId, status])
}
enum VaccineStatus { DUE GIVEN OVERDUE DECLINED CONTRAINDICATED GIVEN_ELSEWHERE }

// NEW — developmental milestone surveillance (backed by ScoredInstrument JSON per age band)
model MilestoneAssessment {
  id            String @id @default(cuid())
  tenantId      String
  patientId     String
  encounterId   String?
  ageBandMonths Int                 // 2,4,6,9,12,15,18,24,30 (CDC bands)
  responses     Json                // {domain:{itemId: "yes"|"no"|"not-sure"}}
  domainsFlagged Json               // ["gross-motor","language"] domains with any "no"
  actEarlyReferral Boolean @default(false)
  @@index([tenantId, patientId, ageBandMonths])
}
```

**How records tie together:** `GrowthMeasurement.encounterId` and `VaccineDose.encounterId` bind clinical events to the visit and its `Invoice`. `VaccineDose.batchId` decrements `InventoryItem` and enforces cold-chain expiry. Well-baby series is modeled as a core `TreatmentPlan` (type `WELL_CHILD_0_2Y`) whose sessions = scheduled EPI/growth visits, giving the pack recall + progress tracking for free. Growth points feed the shared `TrendSeries` for charting. Milestone checklists are `ScoredInstrument` definitions (JSON), so no bespoke scoring code.

---

### Widget UI spec — "Growth & Development" console

Embeds as a **tab in the consultation screen** (Core EMR → tabs: Note | Growth & Development | Immunization | Orders | Billing). Also available standalone from the patient chart.

**Layout (desktop ≥1280px, 3-zone):**
- **Left rail (280px) — Capture panel.** Numeric steppers for Weight (kg, 3 dp), Length/Height (cm — auto-labels "Length (recumbent)" if age <24mo, "Height (standing)" if ≥24mo, with manual override toggle), Head circumference (cm), MUAC (mm) + arm L/R selector. Age auto-displayed (chronological + corrected if preterm). "Use corrected age" toggle (default ON <24mo for preterm). Big **Compute** button.
- **Center (fluid) — Growth charts.** Tabbed indicator chart set: WFA, HFA/LFA, WFL/WFH, HCFA, BMI-FA, MUAC. Each renders WHO percentile curves (3/15/50/85/97 + optional ±2/±3 SD lines) via the shared Longitudinal Trends engine, sex- and age-range-aware (auto-picks 0–24m vs 2–5y panel, boys/girls colorway). Child's plotted points connected as a growth trajectory; hover = value + z-score + percentile + date. Crossing-percentile-lines (≥2 bands down) highlighted.
- **Right rail (320px) — Interpretation panel.** Per-indicator z-score, percentile, and colour-coded flag chip (green NORMAL / amber MODERATE / red SEVERE). Nutrition summary card: classification (Normal / Underweight / Stunted / Wasted / SAM / MAM / Overweight), driven by thresholds. Below: **Dose calculator** mini-widget (pre-filled with today's weight) and **Milestone checklist** launcher for the current age band.

**States:**
- *Empty* (first visit): charts show WHO curves only, "No measurements yet — enter today's values to start the trajectory." Interpretation panel greyed.
- *Single point*: plots point, shows z/percentile, but trajectory/velocity flags suppressed ("need ≥2 points for velocity").
- *Loading*: skeleton on chart area while LMS compute + curve fetch resolve.
- *Error*: LMS lookup miss (age out of 0–1856d WHO range) → inline "Outside WHO 0–5y standard; switch to WHO 5–19y reference" with one-click switch; compute failure → non-blocking toast, values still saved raw.
- *Out-of-range guard*: implausible entries (weight >5 SD from median, height decreasing >0.5cm vs prior, HC jump) → amber confirm modal "Value looks unusual — re-measure or confirm."

**Interactions/validation:** all numeric inputs masked to sane ranges (weight 0.3–150 kg, MUAC 50–300 mm); unit locked (metric); required = at least one measure to compute. Length↔height method auto-adds/subtracts 0.7 cm per WHO when method conflicts with age (documented adjustment, flagged in UI). Save writes `GrowthMeasurement` + N `GrowthZScore` rows atomically to the encounter.

**Tablet (768–1024px):** rail collapses; Capture panel becomes a top drawer, charts full-width with indicator as a horizontal chip scroller, Interpretation as a bottom sheet. Touch-friendly steppers, ≥44px targets. Nurse-in-room ergonomics (measurement often taken bedside on tablet).

---

### Pack manifest contents

**Entitlement key:** `pack.pediatrics` (sub-flags: `pack.pediatrics.growth`, `pack.pediatrics.immunization`, `pack.pediatrics.milestones`, `pack.pediatrics.dosing`).

**Intake fields (newborn / peds registration):** birth date+time, sex, gestational age (wks+days), preterm flag, birth weight/length/head circ, mode of delivery, APGAR (1/5 min), NICU stay (y/n + days), feeding type (exclusive breast / mixed / formula), birth order, consanguinity (parents related y/n — relevant in PK), guardian name/relation/phone, mother's record link, known allergies, newborn screening done (y/n), Vitamin K given (y/n).

**Note templates (name → key sections):**
1. *Well-Baby / Well-Child Visit* — Age & corrected age · Interval history/feeding · Growth (auto-embedded z-scores) · Development (milestone summary) · Immunization due/given · Exam by system · Anticipatory guidance · Plan & next visit.
2. *Newborn / First Visit (0–28d)* — Birth history · Feeding & output · Jaundice screen · Weight vs birth weight (% loss) · Cord/umbilicus · Exam · EPI birth doses · Red-flag safety-net.
3. *Sick Child Visit (IMCI-style)* — Presenting complaint · Danger signs (unable to feed, convulsions, lethargy) · Fever/cough/diarrhoea assessment · Hydration status · Weight + dose calc · Dx · Rx & follow-up.
4. *Malnutrition / Nutrition Review* — Anthropometry + classification · MUAC · Appetite test · Edema · Feeding plan (RUTF/counselling) · Referral decision.
5. *Developmental Surveillance* — Age band checklist results · Domains flagged · Act-Early referral.

**Service catalog (~PKR, illustrative Pakistan private-clinic pricing):**
| Code | Service | PKR |
|---|---|---|
| PED-CONS-NEW | New patient pediatric consultation | 2,500 |
| PED-CONS-FUP | Follow-up consultation | 1,500 |
| PED-WBV | Well-baby visit (growth + dev + counselling) | 2,000 |
| PED-GROWTH | Growth assessment & charting only | 800 |
| PED-DEV-SCR | Developmental screening (milestone/ASQ) | 1,800 |
| PED-NUTR | Nutrition/malnutrition assessment | 1,500 |
| IMM-PENTA | Pentavalent dose (admin fee, EPI free-vaccine) | 500 |
| IMM-PCV | PCV13 administration | 600 |
| IMM-PRIV-6IN1 | Private hexavalent dose (vaccine + admin) | 6,500 |
| IMM-ROTA | Rotavirus dose | 500 |
| IMM-MR-TCV | MR / Typhoid conjugate admin | 500 |
| IMM-FLU | Influenza (pediatric) | 2,800 |
| PED-NEB | Nebulization session | 700 |
| PED-PROC-CIRC | Neonatal circumcision | 12,000 |
| PED-PHOTO | Neonatal jaundice phototherapy (per day) | 4,500 |

**Order sets:** (a) *Febrile child work-up* — CBC, CRP, blood C/S, urine R/E + C/S, malaria ICT, dengue NS1 (seasonal). (b) *Diarrhoea/dehydration* — stool R/E, serum electrolytes, ORS + zinc Rx. (c) *Failure-to-thrive / malnutrition* — CBC, TSH, celiac screen, urine C/S, RUTF dispense. (d) *Neonatal jaundice* — total/direct bilirubin, blood group + Coombs, G6PD, ± phototherapy order. (e) *EPI catch-up* — auto-generates due `VaccineDose` set from age.

---

### Integrations

- **Billing:** each catalog service + vaccine admin posts `InvoiceLine`s to the encounter `Invoice` (PKR, FBR-compliant receipt). EPI government-supplied vaccines bill admin-fee only; private vaccines bill vaccine + admin. Dose calculator never bills.
- **Inventory/consumables:** `VaccineDose.batchId` and nebulization/RUTF dispense decrement `InventoryItem` with batch/expiry; cold-chain expiry check blocks administering an expired lot; low-stock alerts on EPI antigens.
- **WhatsApp journeys/recall (Meta Cloud API):** well-child `TreatmentPlan` sessions drive recall to `guardianPhone` — next-vaccine-due reminders (T-3d, day-of, +overdue at +7d), well-baby visit reminders keyed to EPI ages (6/10/14 wk, 9/15 mo), growth-follow-up for flagged children, milestone-check nudges. Templates in Urdu + English. Auto-cancels on `status=GIVEN`.
- **Treatment plans:** `WELL_CHILD_0_2Y` / `0_5Y` plan = the immunization+growth roadmap; progress bar in chart; supports catch-up re-sequencing.
- **Reports:** per-clinic EPI coverage & dropout (Penta1→Penta3), overdue-vaccine worklist, malnutrition caseload (SAM/MAM counts), growth-flag registry, milestone-referral list. Feeds tenant dashboard; exportable for DHIS2/district EPI reporting.

---

### Clinical safety & edge cases

- **Preterm correction:** apply corrected age for LMS lookup until 24 months (extremely preterm until 36 mo, configurable); UI must always show which age was used. Never correct beyond cutoff.
- **Length vs height:** enforce recumbent <24mo / standing ≥24mo; auto ±0.7 cm adjustment when method mismatches, and label it — a silent 0.7cm error shifts z-scores.
- **Dose calculator safety:** every drug carries mg/kg range **and an absolute max cap** — e.g. paracetamol 10–15 mg/kg/dose, cap 75 mg/kg/day (never exceed ~1g/dose adult ceiling); ibuprofen 5–10 mg/kg q6–8h, max 40 mg/kg/day; amoxicillin 25–45 mg/kg/dose. Calculator must hard-stop if computed dose > adult max, flag if weight is stale (>14 days old / >5% change), and require a current weight for any dose. Show concentration-to-volume (mL) conversion to prevent 10× errors.
- **Malnutrition auto-escalation:** WHZ/WFL < −3 **or** MUAC < 115 mm **or** bilateral edema → auto SAM banner + referral order regardless of other indicators (edema alone = SAM). MUAC 115–124 mm or WHZ −3 to −2 = MAM. Underweight WAZ < −2 (severe < −3), stunting HAZ < −2 (severe < −3).
- **Implausible-value & transcription guard** (see widget error states); weight-loss in neonate flagged if >10% of birth weight.
- **Immunization safety:** contraindication/AEFI capture; do not auto-mark GIVEN without administrator confirmation; expired-batch block; live-vaccine caution flags (immunocompromised).
- **Data provenance:** parent-reported vs clinic-measured tagged; parent-reported points excluded from velocity flags by default.
- **Age boundary:** at 5y (1856 days) auto-offer switch to WHO 2007 5–19y reference (BMI-for-age, HFA); block WFL/WFH beyond its valid length range.
- **Not a diagnosis engine:** flags are decision-support; all show "clinical correlation required," clinician confirms.

---

### Effort (S/M/L; config vs new code)

| Piece | Size | Config / New code |
|---|---|---|
| WHO LMS reference seed (all indicators, both sexes, daily) | S | Config/data seed |
| GrowthPercentileEngine (LMS z→percentile) — *shared component* | M | New code (reused across packs) |
| GrowthMeasurement/GrowthZScore models + APIs | M | New code |
| Growth-chart UI on Longitudinal Trends engine | L | New code (WHO curve overlays, dual age panels, method logic) |
| Capture panel + interpretation + validation/guards | M | New code |
| Dose calculator content (peds drug table + caps) | S | Config on existing engine |
| Milestone checklists (CDC bands as ScoredInstrument JSON) | S | Config |
| Milestone UI launcher + MilestoneAssessment | S | New code (thin) |
| EPI schedule + VaccineDose model/APIs/UI | M | New code + config (schedule) |
| Immunization inventory/cold-chain wiring | S | Config on existing inventory |
| Manifest: intake, note templates, catalog, order sets | S | Config |
| WhatsApp EPI/well-baby recall journeys | S | Config on existing journeys |
| Reports (EPI coverage, malnutrition, growth flags) | M | New code (some reuse) |
| Preterm-correction + safety/edge logic | M | New code |

**Total ≈ 9–11 dev-weeks** (2-dev team ~5 calendar weeks). The heaviest genuinely-new build is the growth-chart UI and the LMS engine — but the LMS/percentile engine, dose calculator, milestone (Scored-Instrument) engine, and Longitudinal Trends are **shared components** amortized across future packs (obstetrics, endocrinology). Roughly 55% new code / 45% configuration.

---

### Acceptance criteria — end-to-end demo script

1. **Onboard:** activate `pack.pediatrics` for "Naya Sitara Children's Clinic" (single-specialty). Pediatric intake, templates, catalog, and EPI schedule appear; entitlement gates confirmed.
2. **Register newborn:** create patient *Ayaan Khan*, DOB 2026-05-01 08:30, GA 34+0 (preterm), birth weight 2.1 kg. System stores preterm flag + corrected age.
3. **First visit (age 6 wk):** open consultation → Growth & Development tab. Enter weight 3.4 kg, length 51 cm, HC 36 cm, MUAC. Corrected-age toggle ON. Compute → WFA/LFA/WFL/HCFA z-scores + percentiles render; WFA point plotted on **boys 0–24m** chart; interpretation shows flags. Save writes measurement + z-score rows to the encounter.
4. **Immunization:** Immunization tab shows Penta1/OPV1/PCV1/Rota1 **DUE**. Administer, pick in-date batch → inventory decrements, doses = GIVEN, admin fees post to invoice; expired-batch attempt is blocked.
5. **Dose calc:** in sick-child flow, calculator pre-fills 3.4 kg, computes paracetamol 34–51 mg/dose with mL volume and daily cap; entering an over-cap manual dose hard-stops.
6. **Milestones:** launch 2-month checklist (Scored-Instrument), answer items; a "no" in gross-motor flags the domain and offers Act-Early referral, saved to `MilestoneAssessment`.
7. **Malnutrition path:** second child with MUAC 112 mm + WHZ −3.2 → auto **SAM** banner, referral order, malnutrition template opens.
8. **Recall:** confirm WhatsApp reminder scheduled to guardian for the 10-week visit (Urdu/English), auto-cancelling once given.
9. **Trajectory:** enter a 10-week point; chart draws the connected trajectory; a ≥2-band downward cross triggers a growth-faltering flag; velocity now computed.
10. **Reports:** EPI coverage report shows Ayaan under Penta1-given; malnutrition report lists the SAM case; billing reflects all posted lines in PKR. **Pass = every step works with no per-specialty code fork.**

---

### Sources

- WHO Child Growth Standards — LMS method & z-score formula `Z = [(value/M)^L − 1]/(S·L)`: https://nutriverse.io/zscorer/articles/anthropometry.html and https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf
- WHO growth chart / weight-for-age percentile & LMS lookup (daily 0–1856d): https://www.infantchart.com/who-0-5-weight-for-age/
- CDC LMS data files & WHO chart SAS program: https://www.cdc.gov/growthcharts/cdc-data-files.htm and https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas-who.html
- Malnutrition thresholds (WHZ/WFH < −2 wasting, < −3 severe; MUAC < 115 mm SAM, 115–125 mm MAM; edema): https://www.ennonline.net/fex/26/en/muac-versus-weight-height-assessing-severe-malnutrition
- Pakistan EPI routine schedule (BCG/OPV0/HepB0 at birth; Penta/OPV/PCV/Rota at 6/10/14 wk; IPV; MR & TCV at 9 mo; MR2 at 15 mo): https://www.epi.gov.pk/immunization-schedule/ and https://www.emro.who.int/pak/programmes/expanded-programme-immunization.html
- CDC revised developmental milestone checklists (2022; bands 2,4,6,9,12,15,18,24,30 mo; ~75th percentile): https://www.cdc.gov/act-early/resources/milestones-checklist-by-age.html and https://www.aafp.org/pubs/afp/issues/2022/1000/editorial-cdc-developmental-milestone-checklist.html
- Pediatric weight-based dosing with max caps (paracetamol 10–15 mg/kg, ≤75 mg/kg/day; ibuprofen 5–10 mg/kg, ≤40 mg/kg/day; amoxicillin 25–45 mg/kg/dose): https://emedicine.medscape.com/article/2172407-overview and https://www.med.unc.edu/pediatrics/cccp/wp-content/uploads/sites/1156/2025/06/Pediatric-Medication-Dosing-Guildelines.pdf

## Vaccination / EPI Pack (HEAVY)

A schedule-rule engine + immunization registry that turns the Pakistan EPI schedule into computed due-dates, status pills, defaulter lists, WhatsApp recall, AEFI capture, and a printable certificate — built as config + a few new engines on the shared clinical core. **No specialty code fork.**

---

### Purpose & scope

Runs childhood/adolescent immunization end-to-end: define a schedule as data, compute per-patient due/overdue/done status from DOB, record doses (with inventory lot linkage, site, given-by), capture AEFIs, drive WhatsApp recall, and print a certificate. **Used by:** pediatric clinics, GP/family-medicine clinics, polyclinics with a peds/vaccination room, hospital pediatric + EPI departments, and standalone vaccination centers. Ships with the **Pakistan EPI 2025–26 national schedule** pre-loaded; the same engine serves private/ACIP-style catch-up and travel vaccines as additional schedule definitions.

---

### Data model — Prisma-style (NEW vs EXISTING; `tenant_id` + RLS on every row)

Reuses canonical `Patient`, `Encounter`, `Practitioner`, `InventoryLot`, `Invoice`, `WhatsappJourneyEnrollment`. Immunization records are FHIR-R4 `Immunization`-aligned; schedule status is a computed projection, not stored truth.

```prisma
// ---------- SCHEDULE DEFINITION (config; seeded once per tenant, editable) ----------
model VaccineProduct {                       // NEW — catalog of antigens/products
  id            String   @id @default(cuid())
  tenant_id     String
  code          String   // "BCG","OPV","PENTA","PCV10","IPV","ROTA","MR","TCV","HEPB_BIRTH"
  displayName   String   // "Pentavalent (DTwP-HepB-Hib)"
  antigens      String[] // ["diphtheria","tetanus","pertussis","hepB","hib"]
  route         VaccineRoute  // ID | IM | SC | ORAL | INTRADERMAL
  defaultSite   String?  // "left deltoid","right anterolateral thigh","oral"
  cvxLike       String?  // optional external code
  inventorySku  String?  // links to InventoryItem for lot pull
  @@unique([tenant_id, code])
  @@index([tenant_id])
}

model ImmunizationSchedule {                 // NEW — a named schedule (versioned)
  id          String   @id @default(cuid())
  tenant_id   String
  key         String   // "PK_EPI_2025_26"
  name        String   // "Pakistan EPI (National) 2025-26"
  version     Int      @default(1)
  isDefault   Boolean  @default(false)
  active      Boolean  @default(true)
  doses       ScheduleDose[]
  @@unique([tenant_id, key, version])
}

model ScheduleDose {                          // NEW — one row = one recommended dose
  id                String  @id @default(cuid())
  tenant_id         String
  scheduleId        String
  schedule          ImmunizationSchedule @relation(fields:[scheduleId], references:[id])
  vaccineCode       String   // -> VaccineProduct.code
  doseNumber        Int      // 0,1,2,3
  seriesLabel       String   // "OPV-0","Penta-1","MR-2","IPV-2"
  // timing rules (all offsets from DOB unless dependsOnDoseId set)
  recommendedOffsetDays Int   // e.g. 0, 42, 70, 98, 270, 450
  minOffsetDays     Int       // earliest valid (min interval / min age)
  overdueAfterDays  Int?      // grace window -> becomes OVERDUE
  maxOffsetDays     Int?      // catch-up ceiling (age-out)
  dependsOnDoseId   String?   // interval-from-previous-dose chaining
  minIntervalDays   Int?      // min gap from the dependency dose
  catchUpEligible   Boolean  @default(true)
  displayOrder      Int
  notes             String?  // "give with MR-1 at 9m"
  @@index([tenant_id, scheduleId])
}

// ---------- IMMUNIZATION RECORD (FHIR Immunization-aligned) ----------
model ImmunizationRecord {                    // NEW
  id            String   @id @default(cuid())
  tenant_id     String
  patientId     String                        // EXISTING Patient
  encounterId   String?                        // EXISTING Encounter (walk-in vaccine visit)
  scheduleDoseId String?                       // which planned dose this fulfils (null=extra/travel)
  vaccineCode   String
  seriesLabel   String   // denormalized "Penta-2" for fast render
  doseNumber    Int
  status        ImmStatus // COMPLETED | NOT_GIVEN | ENTERED_IN_ERROR
  notGivenReason String?  // "contraindicated","refused","stock-out","already-immune"
  occurrenceDate DateTime
  lotId         String?                        // EXISTING InventoryLot (batch/expiry)
  lotNumberSnapshot String?                    // frozen at admin time
  expirySnapshot DateTime?
  site          String?  // "left deltoid"
  laterality    Laterality?                    // EXISTING enum (LEFT/RIGHT/N_A) — injection side
  route         VaccineRoute
  doseVolumeMl  Float?
  givenById     String                         // EXISTING Practitioner/vaccinator
  sourceType    ImmSource // ADMINISTERED_HERE | HISTORICAL | EXTERNAL_CARD
  invoiceLineId String?                         // EXISTING billing linkage
  createdAt     DateTime @default(now())
  @@index([tenant_id, patientId])
  @@index([tenant_id, lotId])
}

model Aefi {                                    // NEW — adverse event following immunization
  id            String   @id @default(cuid())
  tenant_id     String
  patientId     String
  immunizationRecordId String                   // the implicated dose(s)
  onsetDate     DateTime
  reportedDate  DateTime @default(now())
  category      AefiSeverity // NON_SERIOUS | SERIOUS
  seriousCriteria String[]  // ["hospitalization","life-threatening","death","disability","congenital-anomaly"]
  reactionTerms String[]    // ["fever>39","abscess-at-site","anaphylaxis","seizure","HHE"]
  narrative     String
  outcome       AefiOutcome // RECOVERED | RECOVERING | NOT_RECOVERED | FATAL | UNKNOWN
  causality     String?     // WHO tier (filled on later assessment)
  reportedToEpi Boolean  @default(false)
  reportedById  String
  @@index([tenant_id, patientId])
  @@index([tenant_id, lotIdRef])
  lotIdRef      String?     // for lot-level safety signal queries
}
enum VaccineRoute { ID IM SC ORAL INTRADERMAL }
enum ImmStatus { COMPLETED NOT_GIVEN ENTERED_IN_ERROR }
enum ImmSource { ADMINISTERED_HERE HISTORICAL EXTERNAL_CARD }
enum AefiSeverity { NON_SERIOUS SERIOUS }
enum AefiOutcome { RECOVERED RECOVERING NOT_RECOVERED FATAL UNKNOWN }
```

**Status is computed, not stored.** A `ScheduleStatusService.forPatient(patientId, scheduleKey)` joins `ScheduleDose` × `ImmunizationRecord` and, for each planned dose, returns one of: `GIVEN` (matched record), `DUE` (today ≥ minOffset and ≤ overdueAfter, no record), `DUE_SOON` (today < minOffset within 7d), `UPCOMING`, `OVERDUE` (today > overdueAfter), `AGED_OUT`/`CATCH_UP` (past maxOffset but catchUpEligible), `NOT_GIVEN` (explicit skip). Due date = `DOB + recommendedOffsetDays`, or `dependencyDose.occurrenceDate + minIntervalDays` when chained (enforces minimum inter-dose intervals for catch-up).

**Ties to core:** each dose record optionally hangs off an `Encounter` (the vaccination visit) and a billing `invoiceLineId`; `lotId` decrements the shared `InventoryLot`; AEFI links back to the exact record and lot. Vaccination is modeled as a lightweight walk-in encounter, not a multi-session `TreatmentPlan` (the *schedule* is the longitudinal plan). Growth-pack integration reads the same `Patient`/`Encounter`.

**Seeded Pakistan EPI 2025–26 schedule** (verify against FDI at go-live — schedule is now 2-dose IPV):

| Visit | Age (offset from DOB) | Doses |
|---|---|---|
| Birth | 0 d | BCG (ID, left deltoid), OPV-0 (oral), Hep-B birth dose |
| 6 wk | 42 d | OPV-1, Penta-1, PCV10-1, Rota-1 |
| 10 wk | 70 d | OPV-2, Penta-2, PCV10-2, Rota-2 |
| 14 wk | 98 d | OPV-3, Penta-3, PCV10-3, **IPV-1** |
| 9 mo | ~270 d | MR-1, **IPV-2**, Typhoid **TCV** |
| 15 mo | ~450 d | MR-2 |

(Rotavirus = 2 oral doses; IPV = 2 injectable doses at 14 wk & 9 mo per current national schedule; TCV single dose at 9 mo. Confirm live figures before seeding — do not ship unverified.)

---

### Widget UI spec — "Immunization Schedule" widget

Embeds as a tab/panel inside the pediatric **consultation screen** (and as a standalone vaccination-room view). Desktop 3-column; tablet single-column stacked.

**Header band:** patient name, DOB + **computed age** (e.g. "4 mo 12 d"), active schedule selector (`PK_EPI_2025-26 ▾`), and a coverage ring ("11/14 doses up to age"). Buttons: **Record dose**, **Add historical**, **Print certificate**.

**Main — schedule table** (one row per planned dose, grouped by visit):

- Columns: Visit/Age · Vaccine (series label) · **Status pill** · Due date · Given date · Lot · Given-by.
- **Status pills (color + text):** 🟢 Given · 🔵 Due soon · 🟡 Due · 🔴 Overdue · ⚪ Upcoming · 🟠 Catch-up · ⚫ Not given. Overdue rows float to top of their group.
- Row actions: **[Record]** on due/overdue; click a given row → detail drawer (lot, site, vaccinator, AEFI link).

**Record-dose flow (drawer/modal):**
1. Pre-filled vaccine + series; editable occurrence date (default today; block future).
2. **Lot picker** — pulls only in-stock, non-expired lots of the matching SKU from inventory; shows lot #, expiry, qty; **hard-block expired**, warn if expiry < 30 d. Selecting decrements stock on save.
3. Site + laterality (auto-suggest per product: BCG→left deltoid ID; Penta/PCV→right/left anterolateral thigh IM; OPV/Rota→oral) · route (locked to product) · dose volume · **given-by** (defaults to logged-in vaccinator).
4. Optional "Report AEFI" toggle → inline AEFI sub-form.
5. Save → creates `ImmunizationRecord`, decrements lot, generates billing line (if payable), advances status pills, offers next-visit date + "enroll in WhatsApp recall".

**States:**
- **Empty** (new patient, no DOB): prompt "Enter date of birth to compute the schedule" — table hidden until DOB present.
- **No inventory match:** lot picker shows "No in-stock lots for [vaccine] — record without lot? (flagged)" (allowed for historical/external only).
- **Error:** save failure keeps drawer open, preserves input, shows retriable toast; concurrent stock-out surfaces "lot just depleted, pick another."
- **Historical/external:** greys lot requirement, marks `sourceType`, no stock decrement, no billing.

**Validation:** occurrence date ≥ DOB and ≤ today; min-age/min-interval warnings ("MR-1 given before 9 mo — below recommended min age; confirm?") are soft-blocking (require override reason), expired-lot is hard-block. Duplicate-dose guard: warn if same series already `COMPLETED`.

---

### Pack manifest contents

**Entitlement key:** `pack.vaccination_epi`

**Intake fields** (added to peds intake, all `tenant_id`-scoped): DOB (required, drives engine), birth weight, gestational age (preterm flag → adjusts BCG/timing notes), place of birth (facility/home — affects birth-dose likelihood), prior immunization card present (y/n + upload), known vaccine allergy/egg allergy, immunocompromise flag (contraindication surface), guardian name + WhatsApp number (recall channel), NADRA B-form/CNIC (for certificate), consent-to-vaccinate captured.

**Note templates** (names + key sections):
- *Immunization Visit Note* — Age/schedule status · Vaccines given today (auto from records) · Site/lot/route · Pre-vaccination screening (fever, prior AEFI, contraindication) · Observation period · Next due · Guardian counselling.
- *AEFI Report* — Implicated vaccine/lot · Onset · Reaction terms · Seriousness criteria · Management · Outcome · Reported-to-EPI.
- *Catch-up Plan Note* — Gaps identified · Proposed accelerated schedule with min-interval dates.

**Service catalog (~PKR; edit per clinic):**

| Service | PKR |
|---|---|
| BCG administration | 300 |
| OPV dose (oral) | 200 |
| Pentavalent dose | 1,500 |
| PCV10 dose | 2,000 |
| IPV dose | 1,800 |
| Rotavirus dose | 1,600 |
| MR (measles-rubella) dose | 800 |
| Typhoid TCV dose | 2,500 |
| Hepatitis B birth dose | 500 |
| Vaccination consultation / screening | 1,000 |
| Immunization certificate (print) | 500 |
| Catch-up schedule planning (private) | 1,500 |
| Influenza (seasonal, private) | 2,200 |
| Full EPI completion package (0–15 mo) | 12,000 |

(EPI antigens are government-free in public settings; private clinics price administration/service — config toggle "government-supplied = zero-price antigen, charge service only".)

**Order sets:** "6-week visit" (OPV-1 + Penta-1 + PCV10-1 + Rota-1), "10-week", "14-week (+IPV-1)", "9-month (MR-1 + IPV-2 + TCV)", "15-month (MR-2)", "Birth dose" — one click stages all doses in the record flow.

---

### Integrations

- **Billing:** each administered dose emits an `invoiceLineId` from the service catalog; government-supplied antigens post at zero with a service-fee line; PKR + FBR invoice via shared billing. Certificate print is a billable line.
- **Inventory/consumables:** lot picker reads shared `InventoryLot` (batch/expiry), decrements on save, snapshots lot#/expiry onto the record; expiry hard-block; cold-chain/low-stock and lot-recall alerts reuse inventory. AEFI lot-level rollup enables safety-signal queries per batch.
- **WhatsApp journeys/recall:** on record save, the engine schedules the **next due date**; a recall journey sends templated nudges — *due-soon* (T-3 d), *due* (T-0), *overdue* (T+7, T+14) — over Meta Cloud API in Urdu/English with clinic address + book link; enrollment auto-created from guardian number; opt-out honored; stops when the dose is recorded.
- **Treatment plans:** the schedule itself acts as the longitudinal plan; no separate multi-session package — but defaulter follow-up tasks can spawn as care-team to-dos.
- **Reports:** **coverage** (% fully immunized-for-age by antigen, by age cohort), **defaulter/dropout** list (overdue doses, Penta1→Penta3 dropout), **stock-vs-doses reconciliation**, **AEFI register** (by vaccine/lot/severity), all tenant-scoped and exportable for EPI/DHIS reporting.
- **Peds growth pack:** shares `Patient`/`Encounter`; visit screen shows growth-percentile (LMS z-score) alongside immunization status so a well-baby visit does both; longitudinal-trends engine can overlay weight-for-age at each vaccine visit.

---

### Clinical safety & edge cases

- **Preterm / low birth weight:** vaccinate by **chronological** age (no correction) — engine uses DOB as-is; surface a note for BCG in very LBW.
- **Min-age / min-interval enforcement:** doses given too early are soft-blocked with override + reason (invalid-dose flag for coverage stats); catch-up chaining enforces minimum intervals from prior dose, not just age.
- **Expired/wrong lot:** hard-block expired; warn near-expiry; block route/site mismatch (e.g., OPV must be oral).
- **Contraindications:** immunocompromise flag → warn on live vaccines (BCG, OPV, MR, Rota); egg/anaphylaxis history surfaced pre-record; document `notGivenReason`.
- **Duplicate / double entry:** guard against two `COMPLETED` records for the same series; historical import must not double-decrement stock (no stock pull on `HISTORICAL`/`EXTERNAL_CARD`).
- **AEFI:** serious AEFI (hospitalization/anaphylaxis/death) triggers mandatory narrative + "report to EPI" flag; observation-period reminder after live/injectable doses.
- **Rotavirus age ceiling:** enforce max-age cut-off (aged-out → not catch-up eligible) to avoid unsafe late dosing.
- **DOB correction:** editing DOB recomputes all statuses — warn that already-given records keep their occurrence dates but planned due-dates shift.
- **Multi-tenant leakage:** RLS on every table; lot/AEFI queries always tenant-filtered.

---

### Effort (S/M/L; config vs new code)

| Piece | Size | Config vs Code |
|---|---|---|
| Schedule definition + Pakistan EPI seed | **S** | Config/data seed |
| Schedule-status/due-date engine (chaining, catch-up, min-interval) | **L** | **New code** (reusable engine) |
| `ImmunizationRecord` model + record-dose flow + inventory lot pull | **M** | New code |
| AEFI capture model + form | **S–M** | New code |
| Schedule-table widget (pills, states, record drawer) | **L** | New code (UI) |
| Coverage / defaulter / AEFI reports | **M** | New code + config |
| WhatsApp recall journey (due/overdue templates) | **M** | Mostly config on existing journey engine |
| Certificate print template | **S** | Config/template |
| Billing + inventory wiring | **S** | Config on existing integrations |
| Manifest (intake, notes, catalog, order sets, entitlement) | **S** | Config |

**Total ≈ 7–9 dev-weeks.** The schedule-rule engine and the widget are the heavy new code; everything else is configuration or thin wiring on shared core. The engine is reusable for private/ACIP/travel schedules with no further code.

---

### Acceptance criteria — end-to-end demo script

1. **Onboard:** activate `pack.vaccination_epi` for a peds clinic; Pakistan EPI 2025–26 schedule appears as default.
2. **New patient:** register "Ayesha Bibi", DOB = 6 weeks ago. Open consultation → Immunization widget shows Birth-dose rows and the **6-week visit as 🟡 Due**, 10/14-wk as ⚪ Upcoming.
3. **Record birth doses as historical:** add BCG + OPV-0 + Hep-B (source = external card, no stock decrement) → rows turn 🟢.
4. **Record 6-week order set:** click "6-week visit" → drawer stages OPV-1, Penta-1, PCV10-1, Rota-1. Pick in-stock lots (expired lot is blocked), confirm sites/laterality, given-by = logged-in nurse. Save → 4 rows 🟢, **inventory lots decrement**, **4 billing lines** post in PKR, next due (10 wk) computed.
5. **Recall:** verify a WhatsApp **due-soon** message is scheduled for the 10-week date to the guardian number.
6. **AEFI:** on Penta-1, log a non-serious AEFI (fever) → appears in AEFI register tied to that lot.
7. **Defaulter:** fast-forward clock past 10-week grace → row flips 🔴 Overdue, patient appears in **defaulter report**, overdue WhatsApp nudge fires.
8. **Catch-up:** confirm min-interval date for Penta-2 is computed from Penta-1 occurrence + min interval (not just age).
9. **Certificate:** print immunization certificate → lists given doses, dates, lots, vaccinator, clinic; billed as a line.
10. **Cross-pack:** open growth pack for same patient in same encounter → weight-for-age percentile renders beside immunization status; no data duplication.

---

### Sources (verify schedule figures at go-live)

- Federal Directorate of Immunization (FDI), Pakistan — Immunization Schedule: https://www.epi.gov.pk/immunization-schedule/
- WHO EMRO — Expanded Programme on Immunization, Pakistan: https://www.emro.who.int/pak/programmes/expanded-programme-on-immunization.html
- Pakistan EPI routine schedule table (birth / 6-10-14 wk / 9 mo / 15 mo, 2-dose IPV, TCV at 9 mo): https://educated.pk/immunization-program-in-pakistan/
- WHO — Reporting form for AEFI: https://www.who.int/publications/m/item/reporting-form-aefi
- WHO — AEFI reporting form (PDF, fields/seriousness criteria): https://cdn.who.int/media/docs/default-source/pvg/global-vaccine-safety/aefi-reporting-form-en-jan2016.pdf
- NADRA National Immunization Management System (certificate issuance): https://nims.nadra.gov.pk/nims/Process
- National Electronic Immunization Registry (NEIR), Pakistan: https://neir.epimis.pk/

## Ophthalmology & Optometry Pack (HEAVY)

Entitlement key: `pack.ophthalmology` (sub-flag `pack.ophthalmology.optometry_mode`). Pack type: HEAVY — includes one specialty widget (Eye Exam Panel). Everything else is manifest config on the shared core.

### Purpose & scope

Gives eye clinics, optical outlets, polyclinic eye rooms, and hospital ophthalmology departments a complete per-eye clinical workflow on the shared core: visual acuity, refraction, IOP with trends, structured slit-lamp/fundus findings, diagnosis, and a printable/WhatsApp-able glasses or contact-lens prescription that flows straight into optical dispensing and inventory. Optometry reuse mode exposes only refraction + dispensing + lens catalog for standalone optical shops, gated by the same entitlement engine — no separate build.

---

### Data model

All models carry `tenantId String` + RLS policy, `createdAt/updatedAt/createdById`, soft-delete `deletedAt`. Laterality uses the EXISTING shared enum (`Laterality { LEFT RIGHT BILATERAL }` with display mapping OD=RIGHT, OS=LEFT, OU=BILATERAL configured by the pack). EXISTING core models referenced: `Patient`, `Encounter`, `Condition` (ICD-10), `TreatmentPlan`/`TreatmentSession`, `Invoice`/`InvoiceLine`, `ServiceCatalogItem`, `InventoryItem`/`StockBatch`, `Order`/`OrderSet`, `WhatsAppJourney`, `Document` (print/PDF), `Observation` (feeds Trends engine).

```prisma
// NEW — panel root; one per encounter (or standalone optometry visit)
model EyeExam {
  id            String   @id @default(cuid())
  tenantId      String
  patientId     String   // -> Patient
  encounterId   String?  // -> Encounter (nullable for optometry walk-in mode, still invoiced)
  status        EyeExamStatus @default(IN_PROGRESS) // IN_PROGRESS | SIGNED | AMENDED
  signedById    String?
  signedAt      DateTime?
  visualAcuities   VisualAcuityMeasure[]
  refractions      Refraction[]
  iopMeasurements  IopMeasurement[]
  segmentFindings  EyeSegmentFinding[]
  prescriptions    OpticalPrescription[]
  @@index([tenantId, patientId])
}

// NEW — one row per eye per condition; low-vision values supported
model VisualAcuityMeasure {
  id          String     @id @default(cuid())
  tenantId    String
  eyeExamId   String
  laterality  Laterality           // RIGHT=OD, LEFT=OS (no BILATERAL here)
  condition   VaCondition          // UNAIDED | PINHOLE | WITH_GLASSES | BEST_CORRECTED
  notation    VaNotation           // SNELLEN_6 | SNELLEN_20 | LOGMAR
  displayValue String              // "6/12", "20/40", "0.30", "CF@1m", "HM", "PL", "NPL"
  logmarValue  Decimal? @db.Decimal(3,2) // canonical for Trends: 6/6=0.0 … 6/60=1.0; CF=2.0, HM=3.0 (per Bach/Lange convention)
  chartDistanceM Decimal? @db.Decimal(3,1) // 6.0, 4.0, 3.0
  measuredAt   DateTime @default(now())
}

// NEW
model Refraction {
  id          String   @id @default(cuid())
  tenantId    String
  eyeExamId   String
  laterality  Laterality
  method      RefractionMethod // AUTOREFRACTOR | RETINOSCOPY | SUBJECTIVE | CYCLOPLEGIC
  sphere      Decimal @db.Decimal(4,2)  // -30.00..+30.00, 0.25 steps (DB CHECK: mod(sphere*4,1)=0)
  cylinder    Decimal? @db.Decimal(4,2) // -10.00..+10.00, 0.25 steps; sign convention per tenant setting (minus-cyl default)
  axis        Int?      // 1..180 whole degrees; REQUIRED iff cylinder != 0 (service-layer + DB CHECK)
  add         Decimal? @db.Decimal(3,2) // +0.25..+4.00 (presbyopia add)
  vaAchieved  String?   // e.g. "6/6"
  pdBinocularMm Decimal? @db.Decimal(4,1) // 50.0–80.0
  pdMonoRightMm Decimal? @db.Decimal(4,1)
  pdMonoLeftMm  Decimal? @db.Decimal(4,1)
  vertexDistanceMm Decimal? @db.Decimal(3,1)
  isFinal     Boolean @default(false)   // the pair used for the prescription
}

// NEW — every reading is also mirrored into core Observation (LOINC-style code
// per eye) so the shared Trends engine charts it with zero pack-specific code
model IopMeasurement {
  id         String   @id @default(cuid())
  tenantId   String
  eyeExamId  String
  laterality Laterality
  valueMmHg  Decimal @db.Decimal(3,1)   // accept 1.0–80.0; see safety rules
  method     IopMethod  // GAT | NCT | ICARE | PERKINS | TONOPEN | SCHIOTZ
  measuredAt DateTime   // time-of-day is clinically required (diurnal variation, morning peak)
  cctMicrons Int?       // pachymetry, optional
  postDilation Boolean @default(false)
  observationId String? // -> core Observation (Trends)
}

// NEW — one structured row per anatomic structure per eye; anterior + posterior unified
model EyeSegmentFinding {
  id         String  @id @default(cuid())
  tenantId   String
  eyeExamId  String
  laterality Laterality
  segment    EyeSegment  // ANTERIOR | POSTERIOR
  structure  EyeStructure // LIDS | CONJUNCTIVA | CORNEA | ANTERIOR_CHAMBER | IRIS | PUPIL | LENS
                          // | VITREOUS | DISC | CUP_DISC_RATIO | MACULA | VESSELS | PERIPHERY
  status     FindingStatus // NORMAL | ABNORMAL | NOT_EXAMINED
  findingCode String?      // pack-supplied pick-list code, e.g. LENS_NS2 "Nuclear sclerosis gr 2", AC_CELLS_2PLUS
  gradeValue  String?      // e.g. CDR "0.6", Van Herick "2", NS grade "3"
  freeText    String?
}

// NEW — glasses AND contact lens output; snapshot of final refraction (immutable after finalize)
model OpticalPrescription {
  id          String  @id @default(cuid())
  tenantId    String
  eyeExamId   String?
  patientId   String
  type        RxType   // GLASSES | CONTACT_LENS
  status      RxStatus // DRAFT | FINAL | SENT_TO_OPTICAL | DISPENSED | EXPIRED | CANCELLED
  // per-eye snapshot (denormalized on finalize — Rx must not drift if exam amended)
  odSphere Decimal? @db.Decimal(4,2)  odCylinder Decimal? @db.Decimal(4,2)  odAxis Int?  odAdd Decimal? @db.Decimal(3,2)
  osSphere Decimal? @db.Decimal(4,2)  osCylinder Decimal? @db.Decimal(4,2)  osAxis Int?  osAdd Decimal? @db.Decimal(3,2)
  pdBinocularMm Decimal? @db.Decimal(4,1)
  lensRecommendation Json? // { type: SV|BIFOCAL|PROGRESSIVE, index, coatings[], tint }
  // contact-lens-only fields
  clBaseCurve Decimal? @db.Decimal(3,2)  clDiameter Decimal? @db.Decimal(3,1)
  clBrandId String?  clWearSchedule String?  clReplacement String? // daily/monthly
  validUntil  DateTime  // default +12 months glasses, +6 months CL (tenant-configurable)
  prescribedById String
  documentId  String?   // -> core Document (rendered PDF)
  dispenseOrders OpticalDispenseOrder[]
}

// NEW — the "send-to-optical" object; drives inventory + billing
model OpticalDispenseOrder {
  id             String @id @default(cuid())
  tenantId       String
  prescriptionId String
  status         DispenseStatus // RECEIVED | LENSES_ORDERED | READY | COLLECTED | CANCELLED
  frameItemId    String?  // -> InventoryItem (serialized frame)
  lensItemId     String?  // -> InventoryItem (LensCatalog profile)
  labNotes       String?
  promisedDate   DateTime?
  invoiceId      String?  // -> core Invoice
  readyNotifiedAt DateTime? // set when WhatsApp "glasses ready" fires
}

// NEW — thin profile on EXISTING InventoryItem (itemType=OPTICAL_LENS / FRAME / CONTACT_LENS)
model LensCatalogProfile {
  id          String @id @default(cuid())
  tenantId    String
  inventoryItemId String @unique
  lensType    LensType // SV | BIFOCAL | PROGRESSIVE | CONTACT
  refractiveIndex Decimal? @db.Decimal(3,2) // 1.50, 1.56, 1.61, 1.67, 1.74
  coatings    String[]  // HC, HMC, BLUE_CUT, PHOTOCHROMIC
  sphereMin Decimal @db.Decimal(4,2)  sphereMax Decimal @db.Decimal(4,2) // stockable power range
  cylMax    Decimal? @db.Decimal(4,2)
}
```

Ties to the core: `EyeExam.encounterId` anchors the panel to the consultation; diagnoses are plain core `Condition` rows (ICD-10: H25.* cataract, H40.* glaucoma, H52.* refractive errors, E11.3* diabetic retinopathy) with `laterality` (existing field); cataract surgery scheduling uses core `TreatmentPlan` (2 sessions: eye 1 / eye 2); every chargeable act (exam, OCT, FFA, dispense) creates core `InvoiceLine`s from `ServiceCatalogItem`; IOP and logMAR VA mirror into `Observation` so the shared Trends engine plots them per eye with no new charting code.

---

### Widget UI spec — Eye Exam Panel

Embedding: registered as `widget.eye_exam_panel` in the pack manifest; the consultation screen's widget slot renders it as a full-width tab ("Eye Exam") next to Notes/Orders when the pack is active. It receives `{ patientId, encounterId, mode }` and owns its own save lifecycle (autosave draft every 10 s + explicit Sign).

**Desktop layout (≥1200 px):** persistent two-column grid — header row "OD (Right)" | "OS (Left)" — with stacked sections, each collapsible with a completeness chip (✓ / — / "not examined"):

1. **Visual acuity.** Per eye, a 3-row mini-table (Unaided / Pinhole / Best-corrected). Value entry is a combo field: type `6/12` or pick from Snellen dropdown (6/6…6/60) or toggle notation to LogMAR; below-chart buttons `CF` `HM` `PL` `NPL` (CF prompts for distance). Converted logMAR shown as grey subtext. Pinhole row auto-flags "improves ≥2 lines → refractive" or "no improvement → suspect pathology" as an inline hint.
2. **Refraction.** Per eye: Sph / Cyl / Axis / Add / VA-with-Rx fields. Sph & Cyl are stepper inputs (click or ↑/↓ = ±0.25; typing `-2.75` accepted; sign toggle button). Axis is a 1–180 integer with a small dial affordance. Row of method chips (Auto / Retinoscopy / Subjective / Cycloplegic) — multiple rows allowed, one marked **Final** (radio). Toolbar: **Copy OD→OS**, **Transpose** (plus↔minus cyl form, recomputes sph/cyl/axis), **Import autorefractor** (paste/parse, phase 2 device bridge). PD field (binocular + optional monocular split) sits under the grid, shared across eyes.
3. **IOP.** Per eye: value (mmHg), shared method select (GAT default), time picker defaulting to *now* (editable — diurnal timing matters clinically), optional CCT. Inline **Trend** sparkline per eye (shared Trends engine, last 10 readings); click expands full chart with method annotations.
4. **Anterior segment.** Per eye, structure checklist (lids → lens). Each structure defaults **Normal** (single click marks all normal — "All normal OD/OS/OU" quick action). Clicking a structure opens a popover: status, pick-list findings (pack content, e.g. cornea: clear/KPs/edema/opacity; lens: NS gr 1–4, PSC, cortical, pseudophakia, aphakia), grade, free text.
5. **Fundus.** Same pattern: disc (with CDR numeric 0.1–0.9), macula, vessels, periphery, vitreous; "No fundal view" flag on either eye auto-suggests B-scan order (safety hook).
6. **Diagnosis & plan.** ICD-10 typeahead scoped to an ophthalmology shortlist, laterality picker per diagnosis; quick-order buttons (OCT, FFA, VF, Biometry) that drop into the core Orders rail.
7. **Prescription bar (sticky footer).** "Generate glasses Rx" pulls the Final refraction pair → modal preview (classic Rx grid OD/OS × Sph/Cyl/Axis/Add + PD + lens recommendation) → actions: **Print PDF**, **Send to optical** (creates DispenseOrder), **WhatsApp to patient**. Contact-lens toggle switches to CL fields.

**Tablet (768–1199 px):** columns collapse to an OD/OS segmented switch at top; sections become an accordion; steppers get 44 px touch targets; numeric keypad input mode. Refraction grid stays two-column even on tablet (it is the core task).

**States.** *Empty:* each section shows a ghost row + "Not examined" until touched; signing with empty sections asks "Mark remaining as Not examined?". *Draft/dirty:* amber autosave indicator. *Signed:* read-only with **Amend** (creates amendment audit event). *Error:* field-level inline messages (see validation); network failure keeps local draft (IndexedDB) with retry banner. *Conflict:* if another user signed the exam, show non-destructive merge dialog.

**Validation (client + service layer, identical rules):** sphere/cylinder within range and on 0.25 grid; **axis required if cylinder ≠ 0, integer 1–180** (axis with zero cylinder → warn and clear); add only positive, +0.25…+4.00; PD 40–85 mm (warn outside 50–75); IOP hard range 1–80, **soft alert ≥ 22 mmHg (above statistical normal 10–21), red alert ≥ 30, blocking "urgent review" banner ≥ 40**; CDR 0.0–1.0, asymmetry > 0.2 between eyes flagged; VA string must parse to a known notation; refraction marked Final required before Rx generation; time-of-measurement required on IOP.

---

### Pack manifest contents

**Intake fields (added to core intake form):** chief eye complaint (coded list: blurred vision, red eye, pain, floaters/flashes, headache, watering, itching); wears glasses (y/n + years); wears contact lenses (y/n + type); last eye exam date; diabetes (duration); hypertension; family history glaucoma; family history of blindness; previous eye surgery/trauma (which eye — laterality field); current eye drops; occupation/driving requirement; (peds) squint noticed by parents.

**Note templates:** 1) *Comprehensive Eye Exam* — complaint, VA table, refraction, IOP, anterior segment, fundus, diagnosis, plan; 2) *Refraction / Optometry Visit* — VA, refraction, Rx issued, dispensing advice; 3) *Glaucoma Follow-up* — IOP + time, drops compliance, CDR, VF/OCT review, target IOP; 4) *Cataract Counselling* — lens status, biometry result, IOL options (monofocal/toric/multifocal) with PKR, consent discussion, second-eye plan; 5) *Post-op Day 1 (Cataract)* — VA, IOP, wound/AC, drop regimen; 6) *Diabetic Retinopathy Screening* — fundus grading per eye, referral threshold; 7) *Red Eye / Emergency* — VA, IOP, fluorescein staining, discharge triage.

**Service catalog (PKR, editable per tenant; anchored to 2025-26 Pakistan market rates):**

| Code | Service | PKR |
|---|---|---|
| OPH-CONS | Comprehensive eye consultation | 2,500 |
| OPH-REF | Refraction (optometrist) | 1,000 |
| OPH-REF-CYC | Cycloplegic refraction (paeds) | 1,800 |
| OPH-IOP | IOP check (walk-in) | 500 |
| OPH-OCT | OCT macula or disc (per eye) | 6,000 |
| OPH-VF | Visual field (Humphrey, both eyes) | 5,000 |
| OPH-FFA | Fundus fluorescein angiography | 12,000 |
| OPH-FPHOTO | Fundus photography (both eyes) | 2,500 |
| OPH-BIO | Optical biometry + IOL power calc | 5,000 |
| OPH-BSCAN | B-scan ultrasound (per eye) | 3,000 |
| OPH-PACHY | Pachymetry (both eyes) | 1,500 |
| OPH-CAT-COUNS | Cataract surgery counselling session | 2,000 |
| OPH-CAT-PHACO | Phaco + monofocal IOL (per eye, package) | 95,000 |
| OPH-CAT-TORIC | Toric IOL upgrade | +45,000 |
| OPH-YAG | YAG capsulotomy | 15,000 |

(Market anchors: standard phaco+monofocal ≈ PKR 40k–100k, toric 80k–150k, premium/trifocal up to ~290k per eye — see sources.)

**Order sets:** 1) **Pre-op Cataract** — optical biometry + keratometry + IOL power calculation (Barrett/SRK-T per device), B-scan *conditional: no fundal view*, pachymetry (optional), random blood sugar (diabetics per guideline; not routine otherwise), BP check, INR *conditional: on anticoagulants*, lacrimal syringing/sac patency, informed consent document, pre-op topical antibiotic ×3 days, counselling service line, theatre booking task. 2) **Glaucoma Workup** — IOP (GAT) both eyes with time, gonioscopy, VF, OCT RNFL, pachymetry, CDR photo. 3) **Diabetic Retinopathy Screen** — dilated fundus exam, fundus photo, OCT macula if CSME suspected, HbA1c order. 4) **Red Eye** — fluorescein stain, IOP, swab *conditional*.

**Widget:** `widget.eye_exam_panel` (the one custom component). **Entitlements:** `pack.ophthalmology` unlocks all above; `pack.ophthalmology.optometry_mode` alone unlocks only VA + Refraction sections of the widget, OpticalPrescription, DispenseOrder, LensCatalog, and catalog items OPH-REF/OPH-IOP — this is how an optical shop tenant runs the same code.

---

### Integrations

- **Billing:** signing an exam or completing an order emits core billing events → InvoiceLines in PKR; DispenseOrder totals frame (serialized inventory price) + lens (LensCatalogProfile price) + fitting fee; FBR-compliant invoice via existing core module. Cataract package posts as a package price on the TreatmentPlan session.
- **Inventory/consumables:** frames are serialized InventoryItems; stock lenses and contact lenses use existing batch/expiry (CL solutions and trial lenses expire); dispense COLLECTED decrements stock; order-set consumables (fluorescein strips, tropicamide/cyclopentolate drops, tonometer probes for iCare) mapped as consumable burns on the relevant services.
- **WhatsApp journeys (Meta Cloud API, existing engine):** *Glasses ready* (DispenseOrder → READY triggers template with pickup details, sets `readyNotifiedAt`); *Annual refraction recall* (12 months after Rx finalize; 6 months for CL); *Glaucoma drop adherence + IOP review recall* (configurable 3-month cycle); *Cataract pre-op instructions* (T-2 days: fasting/drops/attendant) and *post-op day-1 / week-1 reminders*; *Diabetic retinopathy annual screen recall*. All are journey definitions in the manifest — zero new code.
- **Treatment plans:** cataract = 2-session plan (eye 1, eye 2) with per-session package billing; anti-VEGF intravitreal series reuses multi-session package logic (future retina add-on); counselling → plan conversion tracked as funnel metric.
- **Reports (core report builder + pack-supplied definitions):** daily refraction register, optical sales & lens-type mix, glaucoma registry (patients with H40.* + last IOP + next recall), cataract conversion funnel (counselled → booked → operated), dispense turnaround time.
- **Photos:** existing before/after photo+consent module reused for external eye photos and fundus photo attachments (attach to EyeSegmentFinding).

### Clinical safety & edge cases

- **Laterality is never inferred.** Every measure requires explicit OD/OS; UI shows "OD (Right)" both ways; print output shows both OD/OS and Right/Left (Urdu label optional) to prevent dispensing swaps — a transposed-eye Rx is the classic optical error.
- **Axis/cylinder integrity:** axis mandatory with non-zero cylinder; axis stored 1–180 only (0 normalized to 180); transposition tool must round-trip losslessly; tenant-level cylinder sign convention (minus-cyl default in Pakistan) enforced at print time so the lab never receives mixed conventions.
- **IOP escalation:** ≥30 mmHg red alert; ≥40 mmHg blocking banner "acute angle closure? — urgent ophthalmologist review" and auto-suggests same-day task. Time-of-day always captured (diurnal variation, morning peak) so trends compare like-for-like; method stored because NCT/GAT/iCare readings differ.
- **VA edge values:** CF/HM/PL/NPL are first-class (mapped to logMAR 2.0/3.0/3.9/4.0 for trend continuity, rendered as text, never as fake fractions); NPL on both eyes triggers a "confirm — legal blindness documentation" prompt; prosthetic eye flag on Patient suppresses per-eye validation for that eye.
- **Pinhole logic:** pinhole no-improvement + normal refraction → banner "consider pathology, not refractive"; prevents dispensing glasses that won't help.
- **Paeds:** age < 8 → cycloplegic refraction suggested before finalizing Rx; atropine/cyclopentolate contraindication check against allergy list; VA method note (Kay pictures/Lea) free-text allowed.
- **Dilation safety:** shallow AC (Van Herick 1–2) or angle-closure history → warning before mydriatic order.
- **Rx lifecycle:** prescriptions are immutable snapshots; expiry enforced (dispense from expired Rx blocked, "re-refraction required"); amending a signed exam never mutates an issued Rx.
- **No fundal view → B-scan** auto-suggestion (pre-op cataract safety); biometry values outside plausible range (AL < 20 or > 30 mm, K < 40 or > 48 D) flagged for re-measure before IOL calc is accepted.
- **One-eyed patient:** only-eye flag escalates all surgical counselling templates with an extra consent paragraph.

### Effort (dev-weeks; config = manifest content, no code)

| Piece | Size | Weeks | Config vs code |
|---|---|---|---|
| Prisma models + migrations + RLS + Observation mirroring | M | 2.0 | New code |
| Eye Exam Panel widget (all 7 sections, states, validation) | **L** | 5.0 | New code (the HEAVY part) |
| Rx generation: PDF template, print, WhatsApp send, expiry | M | 1.5 | Code + template config |
| Optical dispensing + LensCatalogProfile + inventory hooks | M | 2.0 | Mostly code, thin on core inventory |
| Optometry reuse mode (entitlement-gated widget slice) | S | 1.0 | Config + small code |
| Manifest content: intake, 7 templates, catalog, 4 order sets, 6 journeys, reports | S | 1.0 | Pure config/content |
| Integrations glue (billing events, trends wiring, plan hooks) | M | 1.5 | Code on existing events |
| Safety rules engine entries + QA + clinical review | M | 1.5 | Config + tests |
| **Total** | | **≈ 15.5 dev-weeks** (~2 devs × 8 weeks incl. hardening) | ~70% new code, 30% config |

Explicitly out of scope v1: device integrations (autorefractor/OCT DICOM bridge), gonioscopy diagrams, VF progression analysis — stubs and file-attachment paths only.

### Acceptance criteria — demo script

1. **Onboard:** create tenant "Al-Shifa Eye Care, Rawalpindi", clinic type *single-specialty: ophthalmology* → `pack.ophthalmology` activates; intake form shows eye fields; catalog shows 15 PKR items.
2. **Register & intake:** patient *Ayesha Khalid, 58, diabetic*; intake captures "blurred vision 6 months, wears glasses, no family glaucoma".
3. **Exam:** in the encounter, open Eye Exam tab. Enter VA OD 6/36 unaided, pinhole 6/24; OS 6/12. Refraction OD −2.75 / −1.25 × 90, OS −2.50 DS, Add +2.25, PD 62. Attempt cylinder without axis → inline block. IOP OD 24 (GAT, 09:15) → amber ≥22 alert fires; OS 16. Anterior segment: OD lens NS grade 3; all else "all normal". Fundus: CDR OD 0.5 / OS 0.4. Diagnose H25.11 (age-related nuclear cataract, right) + H52.4 presbyopia.
4. **Trend:** enter a second backdated IOP; Trends chart shows both readings per eye with method + time.
5. **Rx & optical:** generate glasses Rx from Final refraction → PDF prints OD/OS grid correctly; "Send to optical" creates DispenseOrder; pick serialized frame + 1.56 HMC lens from catalog → invoice PKR (frame + lens + OPH-REF 1,000) posts; mark READY → patient receives WhatsApp "glasses ready"; COLLECTED decrements stock.
6. **Cataract pathway:** fire **Pre-op Cataract order set** for OD → biometry, RBS (auto-included, diabetic), syringing, consent, counselling lines appear as orders + PKR 5,000 biometry invoice line; create TreatmentPlan "Cataract — right eye then left", session 1 billed as OPH-CAT-PHACO 95,000; T-2 pre-op WhatsApp fires (test mode).
7. **Optometry mode:** second tenant "Islamabad Optics" with only `pack.ophthalmology.optometry_mode` → widget shows only VA + Refraction; no IOP/fundus/order sets; dispense flow works end-to-end.
8. **Safety proof:** enter IOP 42 → blocking urgent banner; mark "no fundal view" → B-scan suggestion appears; attempt dispense from an Rx backdated 13 months → blocked as expired.
9. **Audit:** sign exam, amend it, verify Rx snapshot unchanged and amendment trail visible.

Pass = all 9 steps complete with no code changes beyond pack activation.

---

**Sources**

- LogMAR/Snellen equivalence and CF/HM/PL/NPL logMAR mappings: [Michael Bach — Visual Acuity Cheat Sheet](https://michaelbach.de/sci/acuity.html); [Moussa et al., Acta Ophthalmologica 2021 — Snellen-to-LogMAR conversion incl. CF/HM/PL/NPL](https://onlinelibrary.wiley.com/doi/10.1111/aos.14659); [NHS Scotland LogMAR–Snellen conversion table](https://www.nn.nhs.scot/vincyp//wp-content/uploads/sites/24/2022/11/Logmar-to-Snellen-conversion-table.pdf); [StatPearls — Evaluation of Visual Acuity](https://www.ncbi.nlm.nih.gov/books/NBK564307/)
- Refraction notation (0.25 D steps, axis 1–180, plus/minus cylinder conventions): [Wikipedia — Eyeglass prescription](https://en.wikipedia.org/wiki/Eyeglass_prescription); [Laramy-K — Sphere, Cylinder and Axis](https://www.laramyk.com/resources/education/lens-form-and-theory/lens-form-sphere-cylinder-and-axis/)
- IOP normal range 10–21 mmHg, diurnal variation and morning peak, tonometry methods: [Glaucoma Research Foundation — normal eye pressure](https://glaucoma.org/articles/what-is-considered-normal-eye-pressure); [Diurnal variation of CCT and GAT IOP (PubMed)](https://pubmed.ncbi.nlm.nih.gov/17224746/)
- Pre-op cataract workup (biometry, keratometry, IOL formula, conditional B-scan, diabetic glucose/INR): [NICE NG77 — Cataracts in adults: preoperative assessment and biometry](https://www.ncbi.nlm.nih.gov/books/NBK536589/); [Preoperative evaluation of the cataract/IOL patient (PubMed)](https://pubmed.ncbi.nlm.nih.gov/8158670/); [Precision Vision London — essential pre-op tests](https://precisionvisionlondon.com/essential-preoperative-tests-required-for-cataract-surgery-expert-guide/)
- Pakistan cataract/eye pricing anchors (phaco 40k–100k PKR, toric 80k–150k, premium up to ~290k): [Lions Medical Complex — Cataract surgery cost in Pakistan](https://lionsmedicalcomplex.org/cataract-surgery-cost-pakistan/); [Marham — Cataract surgery in Pakistan](https://www.marham.pk/surgeries/cataract-surgery); [oladoc — Cataract surgery price Lahore](https://oladoc.com/pakistan/lahore/treatment/cataract-eye-surgery)

## Physiotherapy & Rehab Pack (HEAVY)

### Purpose & scope
Gives physiotherapy/rehab clinics a structured MSK assessment suite (ROM, MMT, special tests, NPRS, posture/gait), standardized outcome instruments (ODI, DASH/QuickDASH, WOMAC) on the Scored-Instrument engine, goal tracking, and session-course documentation on the existing multi-session treatment-plan engine — plus a home-exercise plan (HEP) with print/WhatsApp delivery. Target clinic types: standalone physio/rehab centres, polyclinics with a physio room, hospital rehab departments; a slim "fracture clinic" configuration of the same pack is reused by orthopaedics (post-cast rehab, post-op protocols) with zero new code.

---

### Data model
Everything carries `tenantId` (RLS), `createdAt/updatedAt`, `createdById`. Laterality uses the EXISTING core enum `Laterality { LEFT RIGHT BILATERAL NA }` (same first-class field used for OD/OS in ophthalmology). All clinical rows link `patientId` + `encounterId`; session-level rows link `treatmentPlanSessionId`; billing flows through the EXISTING invoice line ↔ service-catalog linkage — nothing here invents a parallel billing path.

**EXISTING (reused, no schema change):** `Patient`, `Encounter`, `Observation` (NPRS stored here, code `nprs`, value 0–10), `TreatmentPlan` / `TreatmentPlanSession` (multi-session package engine), `Invoice`/`InvoiceLine`, `ServiceCatalogItem`, `InventoryItem`/`StockMovement`, `ScoredInstrumentDefinition`/`ScoredInstrumentResponse`, `MediaAsset` + `ConsentRecord` (posture photos reuse the aesthetic before/after module), `WhatsAppJourney`, `Document` (generated PDFs).

**NEW models (Prisma-style, abbreviated):**

```prisma
// Reference data: global seed rows (tenantId NULL) + optional tenant overrides
model JointMovementRef {            // NEW — AAOS-normed movement catalog
  id            String   @id @default(uuid())
  tenantId      String?                    // null = global seed
  joint         Joint                      // enum: SHOULDER ELBOW WRIST HIP KNEE ANKLE CERVICAL LUMBAR ...
  movement      String                     // "flexion", "abduction", "external_rotation" ...
  normalDegrees Int                        // AAOS reference, e.g. shoulder flexion 180, knee flexion 135
  maxDegrees    Int                        // hard validation ceiling (normal + physiologic margin)
  sortOrder     Int
  @@unique([tenantId, joint, movement])
}

model SpecialTestRef {              // NEW — seeded: Lachman, McMurray, SLR, Neer, Hawkins-Kennedy,
  id String @id @default(uuid())    //   Empty Can, Phalen, Tinel, Thomas, FABER, Ottawa rules note...
  tenantId String?
  code String; name String; region Joint; description String?
}

model RehabAssessment {             // NEW — one per assessment encounter
  id String @id @default(uuid()); tenantId String
  patientId String; encounterId String @unique
  chiefComplaint String; onsetDate DateTime?; mechanism String?
  postureNotes String?; gaitNotes String?
  postureMediaIds String[]          // -> MediaAsset (consent gate reused)
  redFlagsChecked Boolean @default(false); redFlagNotes String?
  romMeasurements RomMeasurement[]; mmtMeasurements MmtMeasurement[]; specialTests SpecialTestResult[]
}

model RomMeasurement {              // NEW
  id String @id @default(uuid()); tenantId String
  assessmentId String; patientId String        // patientId denormalized for Trends engine queries
  jointMovementRefId String
  laterality Laterality                        // LEFT / RIGHT / NA (spine)
  activeDegrees Int?; passiveDegrees Int?
  normalSnapshot Int                            // copied from ref at save time (audit-stable)
  endFeel EndFeel?                              // enum: SOFT FIRM HARD EMPTY SPASM
  painOnMovement Boolean @default(false)
  method RomMethod @default(GONIOMETER)         // GONIOMETER INCLINOMETER VISUAL APP
}

model MmtMeasurement {              // NEW — MRC/Oxford 0–5
  id String @id @default(uuid()); tenantId String
  assessmentId String; patientId String
  muscleGroup String                            // seeded list per region
  laterality Laterality
  grade Int                                     // 0..5 (MRC)
  gradeModifier GradeMod?                       // PLUS MINUS (e.g. 4+, 4-)
  painLimited Boolean @default(false)
}

model SpecialTestResult {           // NEW
  id String @id @default(uuid()); tenantId String
  assessmentId String; specialTestRefId String
  laterality Laterality; result TestResult      // POSITIVE NEGATIVE INCONCLUSIVE NOT_TESTED
  notes String?
}

model RehabGoal {                   // NEW — SMART goals with measurable anchor
  id String @id @default(uuid()); tenantId String
  patientId String; treatmentPlanId String
  description String
  metricType GoalMetric                         // ROM | MMT | NPRS | INSTRUMENT | FUNCTIONAL_TEXT
  metricRefId String?                           // jointMovementRefId or scoredInstrumentDefinitionId
  laterality Laterality?
  baselineValue Float?; targetValue Float?; targetDate DateTime?
  status GoalStatus @default(ACTIVE)            // ACTIVE ACHIEVED PARTIALLY_ACHIEVED DISCONTINUED
  progress RehabGoalProgress[]                  // (date, value, note, sessionId)
}

model RehabSessionDetail {          // NEW — 1:1 extension of EXISTING TreatmentPlanSession
  id String @id @default(uuid()); tenantId String
  treatmentPlanSessionId String @unique
  subjective String?; objective String?; assessment String?; plan String?   // SOAP
  nprsPre Int?; nprsPost Int?                   // 0–10, also mirrored to Observation for Trends
  modalities ModalityApplication[]
  hepReviewed Boolean @default(false); attendance Attendance @default(ATTENDED)
}

model ModalityApplication {         // NEW
  id String @id @default(uuid()); tenantId String
  sessionDetailId String
  modalityCode String                           // TENS, US, IFT, HOT_PACK, CRYO, TRACTION, LASER, DRY_NEEDLING, MANUAL_THERAPY, EX_THERAPY
  region String; laterality Laterality
  params Json                                   // {intensity, frequencyHz, durationMin, ...} schema per modalityCode
  consumables Json?                             // [{inventoryItemId, qty}] -> posts StockMovement
}

model ExerciseLibraryItem {         // NEW — global seed (~120 exercises) + tenant-custom
  id String @id @default(uuid()); tenantId String?
  nameEn String; nameUr String?                 // Urdu label for patient-facing output
  region Joint; instructionsEn String; instructionsUr String?
  mediaAssetId String?                          // illustration
  defaultSets Int?; defaultReps Int?; defaultHoldSec Int?
}

model HomeExercisePlan {            // NEW
  id String @id @default(uuid()); tenantId String
  patientId String; treatmentPlanId String; status HepStatus  // DRAFT ACTIVE SUPERSEDED
  items HepItem[]                               // exerciseId, sets, reps, holdSec, frequencyPerDay, laterality, notes
  pdfDocumentId String?                         // generated printable
}
```

**Scored-Instrument engine configs (JSON content, NOT code):** `phx.odi` — 10 items, 0–5 each, score = sum/50 × 100%, bands 0–20 minimal / 21–40 moderate / 41–60 severe / 61–80 crippling / 81–100 bed-bound, MCID 10 pts; `phx.quickdash` — 11 items 1–5, score = (sum/n − 1) × 25, ≥10 of 11 items required (full DASH ≥27/30 rule if full version enabled); `phx.womac` — 24 items Likert 0–4 (pain 0–20, stiffness 0–8, function 0–68, total 0–96), higher = worse; `phx.nprs` — single 0–10 item, severity bands mild 1–3 / moderate 4–6 / severe 7–10, MCID ~2. All responses land in existing `ScoredInstrumentResponse` and are automatically chartable by the Longitudinal Trends engine.

---

### Widget UI spec — "MSK Assessment" widget
This is the pack's one genuine specialty widget. It mounts as a tab in the consultation screen's clinical-panel slot (same slot contract the aesthetic photo widget uses), receives `{patientId, encounterId, packConfig}`, and writes through the pack's REST module (`/api/rehab/*`).

**Layout (desktop ≥1200px):** left rail (200px) = body-region navigator (Cervical, Shoulder, Elbow, Wrist/Hand, Lumbar, Hip, Knee, Ankle/Foot) with completion dots; main area = four stacked accordion sections per selected region: **ROM**, **MMT**, **Special tests**, **Notes (posture/gait/NPRS)**; right rail (280px, collapsible) = Trends mini-charts (last 5 values of any measure captured ≥2 times) + active instrument scores with severity-band chips.

- **ROM table:** rows = movements from `JointMovementRef` for the region; columns = Movement | Normal° (grey, read-only) | Left A / Left P | Right A / Right P | End-feel | Pain (toggle). Numeric cells are stepper inputs (±5 coarse, ±1 fine); deficit vs normal renders as a red/amber badge (`>25%` deficit red, `10–25%` amber). Spine regions collapse laterality to a single A/P pair (`Laterality.NA`). A "bilateral quick-fill" copies Left→Right.
- **MMT grid:** rows = seeded muscle groups for region; per side a segmented control `0 1 2 3 4 5` with long-press (tablet) / dropdown (desktop) for `+/−` modifiers; "pain-limited" flag per cell.
- **Special tests:** searchable chip list filtered by region; tapping a chip opens Left/Right/NA + Positive/Negative/Inconclusive + one-line note. Untested tests are simply absent (no forced N/A noise).
- **Instruments launcher:** buttons for the instruments enabled in pack config (ODI shown for lumbar, DASH for upper limb, WOMAC for hip/knee — region-aware suggestions, all always available from overflow menu). Opens the shared Scored-Instrument runner (patient-hand-over tablet mode supported); on submit the score + band chip appears in the right rail.
- **NPRS:** horizontal 0–10 tap scale with faces + Urdu anchor labels ("koi dard nahin" / "shadeed tareen dard"); stored as `Observation`.

**Tablet (768–1199px):** rails collapse into a top region-picker and a bottom-sheet Trends drawer; all touch targets ≥44px; numeric steppers replace free typing as the default.

**States & validation:** autosave (debounced 2s) with dirty-dot indicator; optimistic UI with retry toast on 5xx and a red "unsaved" banner if 3 retries fail (data held in local draft keyed by encounterId). Validation: degrees integer 0–`maxDegrees` from ref (hard block above ceiling with the norm shown in the error); warn (non-blocking, amber) if active > passive; MMT grade 5 cannot carry a `+`; NPRS post > pre in a session note triggers a "pain increased" confirm. Empty state per section: illustration + "No ROM recorded for Shoulder — tap a cell to begin"; encounter-level empty state offers "Copy forward last assessment" (pre-fills prior values greyed until touched — touched cells become today's measurement). Read-only mode when the encounter is signed/locked. Error state if reference data fails to load: section renders disabled with retry, never a blank crash.

**Session-note view (inside treatment-plan screen, config not a new widget):** SOAP fields + NPRS pre/post + modality picker (each modality opens its param mini-form from a JSON schema per code) + HEP panel (add from exercise library with thumbnails, adjust sets/reps/hold/frequency, per-item laterality) + attendance selector. "Print HEP" renders the Urdu/English PDF; "Send on WhatsApp" requires recorded patient channel consent.

---

### Pack manifest contents
**Entitlement key:** `pack.physio_rehab` (fracture-clinic variant = same key + config flag `variant: "ortho_fracture"`; gated features: MSK widget, rehab instruments, HEP module, rehab report templates).

**Intake fields (added to shared intake form):** referring doctor + referral note upload; injury/onset date & mechanism; dominant hand; occupation & work demands (sedentary/manual); prior physiotherapy (Y/N + where); imaging available (X-ray/MRI/CT + upload); red-flag screen (night pain, unexplained weight loss, bladder/bowel change, fever, history of malignancy — any "yes" banners the chart); comorbidities relevant to modality safety (pacemaker, metal implants, pregnancy, impaired sensation, DVT history); assistive device in use.

**Note templates:** 1) *Initial MSK Assessment* — Subjective/History, Red-flag screen, Observation (posture/gait), ROM/MMT/Special tests (auto-pulled from widget), NPRS, Provisional PT diagnosis, Goals, Proposed plan (sessions/week × weeks). 2) *Follow-up Session Note (SOAP)* — S, O (incl. modalities delivered), A (progress vs goals), P (next session + HEP changes). 3) *Re-assessment / Mid-course Review* — repeat instruments, ROM/MMT delta table (auto), goal status update. 4) *Discharge Summary* — outcome instrument baseline→final, goals achieved, HEP continuation, referral-back letter. 5) *Post-fracture Rehab Protocol Note* (ortho variant) — fracture site/fixation, weight-bearing status, precautions, protocol phase.

**Service catalog (PKR, editable per tenant):**
| Code | Item | Price (PKR) |
|---|---|---|
| PHX-001 | Initial physiotherapy assessment (45 min) | 3,000 |
| PHX-002 | Follow-up physiotherapy session (30 min) | 1,800 |
| PHX-003 | Package: 6 sessions | 9,500 |
| PHX-004 | Package: 12 sessions | 18,000 |
| PHX-005 | TENS (add-on) | 700 |
| PHX-006 | Therapeutic ultrasound (add-on) | 700 |
| PHX-007 | Interferential therapy (IFT) | 800 |
| PHX-008 | Cervical/lumbar traction | 1,000 |
| PHX-009 | Manual therapy / mobilization session | 2,200 |
| PHX-010 | Dry needling session | 2,500 |
| PHX-011 | Post-op rehab session (specialised) | 2,500 |
| PHX-012 | Home-visit physiotherapy session | 4,500 |
| PHX-013 | Kinesio-taping application | 1,200 |
| PHX-014 | Re-assessment / outcome review | 1,500 |

**Order sets:** *Low back pain — conservative* (initial assessment, ODI, 12-session package, hot pack + TENS + exercise therapy, HEP "lumbar core" bundle, review at session 6); *Frozen shoulder* (assessment, QuickDASH, 12 sessions, US + mobilization, pulley HEP bundle); *Knee OA* (assessment, WOMAC, 6 sessions, IFT + quads strengthening HEP, weight-management advice note); *Post-fracture rehab — ortho reuse* (post-cast assessment, ROM restoration protocol, 6 sessions, X-ray-review reminder task); *Post-op ACL phase 1* (assessment, NPRS, 12 sessions, protocol note).

---

### Integrations
- **Billing (EXISTING):** assessment/session/add-on items are normal `ServiceCatalogItem`s; multi-session packages use the existing package pricing + session-decrement logic of the treatment-plan engine; modality add-ons attach as invoice lines from the session note; FBR-compliant PKR invoicing untouched.
- **Inventory (EXISTING):** `ModalityApplication.consumables` posts `StockMovement`s (ultrasound gel, TENS electrodes, kinesio tape, needles for dry needling — needles tracked with batch/expiry). Low-stock alerts reuse core thresholds.
- **Treatment plans (EXISTING):** the pack adds `RehabSessionDetail` as a 1:1 satellite of `TreatmentPlanSession`; scheduling, package balance, no-show handling all inherited.
- **WhatsApp (EXISTING journeys, new journey configs):** HEP delivery (PDF + summary text, Urdu/English per patient preference); session reminder T-24h; missed-session recall after 2 consecutive no-shows; mid-course instrument nudge ("Please fill your progress questionnaire before Friday's visit" with tokenized instrument link); discharge follow-up at +30 days.
- **Reports (EXISTING report engine + 3 pack configs):** outcome dashboard (mean ODI/DASH/WOMAC change, % reaching MCID), package utilization (sold vs consumed sessions, breakage), therapist productivity (sessions/day, modality mix).
- **Trends engine (EXISTING):** ROM per joint-movement-laterality, MMT per muscle-side, NPRS, and instrument scores all register as trendable series; the widget's right rail and the re-assessment delta table are just Trends queries.

### Clinical safety & edge cases
- Red-flag screen answers of "yes" render a persistent chart banner and require an acknowledging note before a treatment plan can be created (soft gate, override with reason logged).
- Modality contraindication checks: pacemaker blocks TENS/IFT (hard block with override-by-senior role), pregnancy warns on lumbar/abdominal electro/US and traction, metal implant warns on ultrasound over site, impaired sensation warns on thermal modalities. Rules live in modality JSON config, evaluated against intake comorbidity fields.
- Active > passive ROM is physiologically suspect → warn, don't block (measurement-order artifacts exist). Values above `maxDegrees` are blocked.
- Hypermobile patients: `maxDegrees` ceiling is normal + margin (e.g. elbow to −10°/+150°); document hyperextension as movement "extension" with positive degrees per ref config — no negative-number entry.
- Instrument partial completion: engine enforces per-instrument minimum-item rules (DASH ≥27/30, QuickDASH ≥10/11) and stores incomplete responses as DRAFT, never scored.
- Ortho variant: weight-bearing status (NWB/PWB/FWB) is a mandatory field on post-fracture notes and prints on the HEP header.
- Locked encounters are immutable; corrections create amendment versions (core audit rules).
- Pediatric guard: MMT and adult instruments hidden below configurable age (default 14); NPRS swaps to Faces scale variant.
- WhatsApp HEP requires explicit channel consent on file; PDFs carry patient name + MR# + clinic PMDC-registered practitioner name.

### Effort (1 dev-week = 1 engineer-week; config = content/JSON, code = new build)
| Piece | Type | Size | Est. |
|---|---|---|---|
| Prisma models + migrations + RLS policies | code | M | 1.5 wk |
| Reference seeds (AAOS ROM norms, muscle groups, special tests, ~120-exercise library w/ Urdu) | config+content | M | 1.5 wk |
| MSK Assessment widget (React/MUI, desktop+tablet, autosave/validation/copy-forward) | code | **L** | 4 wk |
| Rehab REST module (assessment, goals, session detail, HEP) | code | M | 2 wk |
| Instrument JSONs (ODI, QuickDASH/DASH, WOMAC, NPRS) on existing engine | config | S | 0.5 wk |
| Session-note extension UI + modality forms + contraindication rules | code | M | 2 wk |
| HEP builder + PDF (Urdu/English) + WhatsApp send | code | M | 1.5 wk |
| Goals + progress UI (Trends-backed) | code | S/M | 1 wk |
| Catalog, order sets, note templates, journeys, reports, intake fields | config | S | 1 wk |
| Ortho fracture-clinic variant config | config | S | 0.5 wk |
| QA + demo dataset (Pakistani names, realistic course) | — | M | 1.5 wk |
| **Total** | | | **~17 dev-weeks** (~8–9 calendar weeks with 2 engineers) |

### Acceptance criteria — end-to-end demo script
1. Onboard tenant "Rehman Physio & Rehab Centre, Lahore" as clinic type *Physiotherapy* → `pack.physio_rehab` activates; catalog, templates, instruments, journeys visible; a second tenant without the entitlement sees none of it (RLS + entitlement check).
2. Register patient **Muhammad Bilal Aslam, 42, Lahore**; intake shows physio fields; mark "metal implant: no, pacemaker: yes".
3. Create encounter → MSK widget: Lumbar region → record ROM (flexion A 40° vs normal, NPRS 7), Cervical untouched (completion dots reflect this); Knee region → Right knee flexion A 95 / P 110 vs 135 norm shows red deficit badge; MMT right quads 3+; SLR positive right. Entering knee flexion 200° is blocked with the norm shown.
4. Run ODI from the widget → score 46% → "severe disability" band chip appears.
5. Create treatment plan from order set *Low back pain — conservative* → 12-session package invoiced at PKR 18,000 (FBR-format invoice); goals auto-suggested: "NPRS 7→≤3", "ODI −20 pts", "knee flexion +30°".
6. Session 1: SOAP note, NPRS pre 7 / post 5, apply TENS → **hard-blocked by pacemaker contraindication**, senior override declined, switch to hot pack + exercise therapy; ultrasound gel consumable decrements inventory; package balance shows 11 remaining.
7. Build HEP (3 exercises, Urdu instructions, right-leg laterality) → print PDF and send via WhatsApp (consent on file); patient receives PDF + T-24h reminder for session 2.
8. After session 6, re-assessment note: repeat ODI (28%) and knee ROM (120°) → delta table auto-renders baseline vs current; Trends chart shows NPRS and ODI curves; goal "ODI −20" not yet met, progress bar reflects 18/20.
9. Skip two sessions → WhatsApp recall journey fires.
10. Discharge: summary shows ODI 46→18 (≥10-pt MCID met), goals ACHIEVED, HEP continuation; outcome report counts this patient in "% reaching MCID"; locked encounter rejects edits.
11. Ortho reuse: activate variant for a hospital ortho department → post-fracture note with mandatory weight-bearing status and the fracture order set work with **zero new code**.

### Sources
- ODI scoring & bands, MCID: [Physiopedia — Oswestry Disability Index](https://www.physio-pedia.com/Oswestry_Disability_Index); [Medbridge ODI guide](https://www.medbridge.com/blog/oswestry-disability-index)
- DASH/QuickDASH formula & missing-item rules: [DASH official scoring (IWH)](https://dash.iwh.on.ca/scoring); [QuickDASH scoring PDF (IWH)](https://dash.iwh.on.ca/sites/dash/files/downloads/QuickDASH_scoring_2010.pdf); [Physiopedia — DASH](https://www.physio-pedia.com/DASH_Outcome_Measure)
- WOMAC structure & scoring: [clinicaltoolslibrary — WOMAC](https://clinicaltoolslibrary.com/womac-osteoarthritis-index/); [CODE Technology — WOMAC](https://www.codetechnology.com/blog/womac-score-tool/)
- NPRS & MCID ~2: [Physiopedia — NPRS](https://www.physio-pedia.com/Numeric_Pain_Rating_Scale); [Shirley Ryan AbilityLab RehabMeasures — NPRS](https://www.sralab.org/rehabilitation-measures/numeric-pain-rating-scale)
- MMT MRC/Oxford 0–5 grading: [MRC Muscle Scale (UKRI)](https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-muscle-scale/); [Physiopedia — Oxford Scale](https://www.physio-pedia.com/Oxford_Scale)
- AAOS normal ROM values (shoulder flexion 180°, knee flexion 135°, etc.): [Medical Calculator Hub — ROM norms](https://medicalcalculatorhub.com/physical-therapy/rom-joint-measurements); [MystPhysio — normal joint ROM](https://www.mystphysio.com/normal-joint-range-of-motion-variations/)

## Dermatology Pack (HEAVY-bounded)

*Health OS specialty pack — build-ready spec. Sits on the shared clinical core; zero code forks. All new tables carry `tenant_id` + RLS; `clinic_id` beneath for branches. Instruments run on the existing **Scored-Instrument engine**; charts on the **Longitudinal Trends engine**; photos on the already-built **before/after + consent** module.*

---

### Purpose & scope
A configuration+content pack that turns the shared clinical core into a full dermatology workstation: a suite of validated grading calculators (GAGS, PASI, SCORAD, EASI, MASI, VASI, Fitzpatrick), a phototherapy (NB-UVB) dosing ledger with cumulative-dose and burn safeguards, derma note templates, a biopsy/path order set, and native cross-sell into the aesthetic before/after + package workflow. **Used by:** single-specialty dermatology clinics; polyclinics that multi-select "Dermatology"; and hospital Dermatology departments. Gated by entitlement `pack.dermatology`.

The pack is **~80% config** (instrument JSON, templates, catalog, order sets, manifest) and **~20% new code** — the region-based scoring UI shells that the generic Scored-Instrument renderer cannot express, and the phototherapy ledger widget + dose engine.

---

### Data model — Prisma-style (NEW vs EXISTING)

The grading instruments **do not need bespoke tables** — they persist through the existing scored-instrument results tables. Only phototherapy and a thin derma-lesion/diagnosis layer are genuinely new.

#### Reused EXISTING core (no change)
```
model ScoredInstrumentDefinition {   // EXISTING — JSON-defined questionnaires/calculators
  id            String  @id @default(cuid())
  tenantId      String                       // RLS
  key           String                       // "GAGS","PASI","SCORAD","EASI","MASI","VASI","FITZPATRICK"
  version       Int
  schemaJson    Json                         // items, options, regions, scoring expr, severity bands
  isSystem      Boolean @default(true)       // shipped by pack; tenant may clone/override
  @@unique([tenantId, key, version])
}
model ScoredInstrumentResult {        // EXISTING — one filled instance
  id            String  @id @default(cuid())
  tenantId      String                       // RLS
  definitionId  String
  patientId     String
  encounterId   String?                      // ties to visit
  treatmentPlanId String?                    // optional link to a package
  responsesJson Json                         // per-item + per-region raw entries
  totalScore    Float
  subscores     Json                         // e.g. {A:.., B:.., C:..} for SCORAD; per-region for PASI
  severityBand  String                       // "mild|moderate|severe|very_severe"
  scoredAt      DateTime @default(now())
  scoredById    String
  @@index([tenantId, patientId, definitionId, scoredAt])
}
model Encounter { … }                 // EXISTING — dermatology notes attach here
model TreatmentPlan { … }             // EXISTING — multi-session packages (phototherapy course = a plan)
model MediaAsset / ConsentForm { … }  // EXISTING — before/after photo + consent (aesthetic)
model Invoice / InvoiceLine { … }     // EXISTING — PKR billing, FBR
model InventoryItem / Batch { … }     // EXISTING — batch/expiry for injectables/topicals
```

#### NEW — phototherapy
```
model PhototherapyCourse {           // NEW  — a prescribed NB-UVB course (1 per treatment plan)
  id              String  @id @default(cuid())
  tenantId        String                     // RLS
  clinicId        String
  patientId       String
  treatmentPlanId String                     // course == a multi-session package
  modality        String  @default("NB_UVB") // NB_UVB | BB_UVB | PUVA | EXCIMER (future)
  bodySite        String  @default("WHOLE_BODY") // WHOLE_BODY|HANDS_FEET|SCALP|LOCALIZED
  laterality      String?                    // EXISTING laterality enum: NA|LEFT|RIGHT|BILATERAL for localized
  fitzpatrickType Int                        // 1..6 — drives start/increment protocol
  indication      String                     // "psoriasis|vitiligo|eczema|CTCL|other"
  protocolKey     String                     // FK to PhototherapyProtocol
  startDoseMj     Int                        // mJ/cm2 seeded from protocol × skin type
  incrementPct    Int                        // default % step per session
  maxDoseMj       Int                        // ceiling by skin type
  medMj           Int?                       // optional Minimal Erythema Dose if tested
  status          String  @default("active") // active|paused|completed|abandoned
  startedAt       DateTime @default(now())
  createdById     String
  @@index([tenantId, patientId, status])
}

model PhototherapySession {          // NEW — one exposure (the ledger row)
  id              String  @id @default(cuid())
  tenantId        String                     // RLS
  courseId        String
  sessionNo       Int                        // 1..n within course
  scheduledFor    DateTime?
  deliveredAt     DateTime?
  doseMj          Int                        // actual delivered dose mJ/cm2
  cumulativeMj    Int                        // running total incl. this session (denormalized)
  lampHours       Float?                     // machine calibration input
  gapDays         Int?                       // days since last delivered session (missed-dose logic)
  erythemaGrade   Int      @default(0)       // 0 none |1 <24h pink |2 24-48h |3 >48h/blistering
  burnFlag        Boolean  @default(false)   // grade>=3 → hold
  doseDecisionJson Json                      // {suggested, applied, ruleFired, override, overrideReason}
  skipped         Boolean  @default(false)   // no-show / held
  skipReason      String?
  notes           String?
  deliveredById   String?
  @@unique([tenantId, courseId, sessionNo])
  @@index([tenantId, courseId, deliveredAt])
}

model PhototherapyProtocol {         // NEW — reference protocol table (system-seeded, tenant-cloneable)
  id            String  @id @default(cuid())
  tenantId      String                       // RLS (system rows on tenant 0 / cloned)
  key           String                       // "NBUVB_STANDARD_SKINTYPE"
  modality      String
  startBySkinType Json                        // {1:300,2:300,3:500,4:500,5:800,6:800} mJ/cm2
  maxBySkinType   Json                        // {1:2000,2:2000,3:3000,4:3000,5:5000,6:5000}
  incrementPct    Int   @default(15)
  missedRulesJson Json                        // {"<7d":"+step","7-14d":"hold","2-3w":"-25%","3-4w":"-50%",">4w":"restart"}
  erythemaRules   Json                        // {"1":"+step","2":"hold","3":"hold+50%_reduce_next"}
  @@unique([tenantId, key])
}
```

#### NEW — thin lesion / diagnosis layer (keeps derma dx discrete + laterality-aware)
```
model SkinLesion {                   // NEW — a tracked lesion/plaque/mole
  id            String  @id @default(cuid())
  tenantId      String                       // RLS
  patientId     String
  encounterId   String?
  bodyRegion    String                       // FDI-style body map key e.g. "cheek_R","forearm_L"
  laterality    String                       // EXISTING enum: LEFT|RIGHT|BILATERAL|NA
  morphology    String                       // macule|papule|plaque|nodule|pustule|patch
  diagnosisCode String?                      // ICD-10 (L70.0 acne, L40.x psoriasis, L80 vitiligo…)
  abcdeJson     Json?                        // mole surveillance: asymmetry,border,color,diameter,evolving
  photoAssetIds String[]                      // FK → MediaAsset (before/after module)
  status        String  @default("active")
  @@index([tenantId, patientId, bodyRegion])
}
```

**How records tie together:** every `ScoredInstrumentResult`, `PhototherapyCourse`, and `SkinLesion` carries `patientId` and (where clinical) `encounterId`, so they surface on the timeline. A phototherapy **course = a TreatmentPlan** (reuses session scheduling, package pricing, and recall). Each delivered `PhototherapySession` optionally auto-generates an `InvoiceLine` (per-session billing). Consumables (topicals, biopsy kits) decrement `InventoryItem/Batch`. Scores feed the **Longitudinal Trends engine** (score-vs-time per instrument) and drive clinically-triggered WhatsApp journeys.

---

### Widget UI spec

Two custom React/MUI widgets embed as tabs in the existing **Consultation screen** (which already hosts note editor, photos, orders). Everything else is rendered by the generic Scored-Instrument renderer.

#### A. Region-Based Grading widget (`<DermaGradingPanel>`)
Launched from consultation → "Add assessment" → picks instrument. Generic questionnaires (Fitzpatrick 7-item) fall through to the standard renderer; the four **region/area instruments** (GAGS, PASI, EASI+SCORAD, MASI, VASI) use this custom shell because they need a body/face map + live weighted math.

- **Layout (desktop ≥1024px):** two-pane. Left = interactive **SVG body/face map** with tappable regions highlighted per instrument (GAGS: forehead, R cheek, L cheek, nose, chin, chest/back; PASI/EASI: head, upper limbs, trunk, lower limbs; MASI: forehead, R malar, L malar, chin; VASI: 5 regions by hand-unit). Selected region glows in the pack accent. Right = the **scoring form** for the active region (severity/sign selectors) + a sticky **live score card** (running total, severity band chip, per-region contribution bars).
- **Tablet (768px):** single column — map collapses to a compact selectable grid of region chips above the form; score card docks to bottom as a sticky bar.
- **Per-instrument controls:**
  - **GAGS:** each region → single-select most-severe lesion (None 0 / Comedones 1 / Papules 2 / Pustules 3 / Nodules 4). Local = region factor × grade (factors forehead 2, each cheek 2, nose 1, chin 1, chest+back 3). Global 0–44.
  - **PASI:** per region → Area (0–6 band picker with % legend) + three sliders Erythema/Induration/Desquamation (0–4). Weighted 0.1/0.2/0.3/0.4. Total 0–72.
  - **EASI:** per region → Area (0–6) + four signs Erythema/Induration-papulation/Excoriation/Lichenification (0–4). **Adult vs child toggle** swaps region weights (child ≤7: head 0.2, upper 0.2, trunk 0.3, lower 0.3). Total 0–72.
  - **SCORAD:** Extent A via rule-of-nines body paint (0–100); Intensity B six signs 0–3 (erythema, oedema/papulation, oozing/crust, excoriation, lichenification, dryness); Subjective C two VAS 0–10 (pruritus, sleeplessness). Score = A/5 + 7B/2 + C (0–103).
  - **MASI:** per facial region → Area (0–6) + Darkness (0–4) + Homogeneity (0–4). Weights 0.3/0.3/0.3/0.1. Total 0–48. Toggle **mMASI** (drops homogeneity).
  - **VASI:** per region enter Hand-Units of involvement × Depigmentation grade (0/10/25/50/75/90/100%). T-VASI 0–100; optional F-VASI.
- **States:** *empty* — map neutral, "Select a region to begin," score card shows "—". *In-progress* — completed regions get a check badge; incomplete-but-touched regions amber. *Complete* — Save enabled. *Error* — out-of-range or partial region flagged inline; Save blocked with toast. *Read-only* — historical results render locked with a "clone to re-score" action.
- **Validation:** area bands 0–6, sign scores 0–4 enforced by control (no free entry); VASI hand-units ≥0; severity band computed, never entered. Saving writes one `ScoredInstrumentResult` (`totalScore`, `subscores` per region, `severityBand`).
- **Interactions:** live recompute on every change; "Compare to last" opens Trends sparkline inline; "Attach photo" jumps to before/after capture pre-tagged with the diagnosis and region laterality.

#### B. Phototherapy Ledger widget (`<PhototherapyLedger>`)
Opens from a patient's active phototherapy TreatmentPlan or consultation.

- **Header card:** modality, indication, Fitzpatrick type, protocol, **cumulative dose (mJ/cm²)** big number + a cumulative-dose line chart (Trends engine), sessions delivered/planned, current dose.
- **Ledger table:** rows = sessions (No, Date, Dose mJ/cm², Cumulative, Gap days, Erythema grade, Notes). Newest at top.
- **"Record session" flow:** dose field is **pre-filled by the dose engine** (see Safety). Below it a rationale line: e.g. *"Suggested 575 mJ/cm² (+15% from 500; last erythema grade 0)."* Clinician enters last-session erythema grade first → engine may override the suggestion (hold / reduce / restart). Manual override requires a typed reason (stored in `doseDecisionJson`).
- **States:** *empty* — "No sessions yet; first dose seeded from skin type IV = 500 mJ/cm²." *burn hold* — if erythema grade ≥3, dose field locks, red banner "Persistent erythema/blistering — hold session, notify prescriber," records `skipped`+`burnFlag`. *missed-dose* — gap-based reduction auto-applied with a visible note. *ceiling reached* — dose capped at `maxDoseMj` with a chip "Max dose for skin type." *paused/completed* — record disabled.
- **Validation:** dose ≤ maxDoseMj; cannot record a future date; sessionNo auto-increments; cumulative recomputed server-side (never trusted from client).
- **Tablet:** header card stacks; table becomes card rows; record flow is a full-screen sheet.

---

### Pack manifest contents

**Entitlement key:** `pack.dermatology` (bundles sub-flags `derma.grading`, `derma.phototherapy`, `derma.pathology_orders`).

**Intake fields (added to patient/encounter intake for derma clinic type):**
- Fitzpatrick skin type (I–VI) — one-time, patient-level.
- Chief dermatologic complaint (free text).
- Symptom duration; itch severity (VAS 0–10).
- Personal/family history: atopy, psoriasis, skin cancer, melasma triggers (sun/OCP/pregnancy).
- Current topicals/systemics; prior phototherapy (Y/N + rough cumulative).
- Photosensitizing meds flag; pregnancy/lactation flag (gates systemics/phototherapy counseling).
- Sun exposure/occupation; cosmetic-procedure interest (cross-sell opt-in).

**Note templates (name → key sections):**
1. **Acne consultation** — HPI, lesion inventory, **GAGS score**, treatment (topical/systemic/isotretinoin counseling), follow-up.
2. **Psoriasis review** — plaque distribution/body map, **PASI**, prior therapy, phototherapy/biologic plan.
3. **Eczema/Atopic dermatitis** — trigger review, **SCORAD/EASI**, emollient + TCS ladder, itch/sleep.
4. **Pigmentary (melasma/vitiligo)** — Wood's-lamp findings, **MASI or VASI**, sun-protection, depigmentation vs repigmentation plan.
5. **General derma / lesion check** — morphology, body-map lesions, **ABCDE mole surveillance**, biopsy decision.
6. **Phototherapy start note** — indication, skin type, protocol, consent, start dose.
7. **Procedure note (biopsy/excision/cryo)** — site + laterality, technique, specimen, closure, path sent.

**Service / procedure catalog (~PKR; tenant-editable):**

| # | Service | PKR |
|---|---------|-----|
| 1 | Dermatology consultation (new) | 3,500 |
| 2 | Dermatology follow-up | 2,000 |
| 3 | Teledermatology consult | 2,500 |
| 4 | NB-UVB phototherapy — single session | 2,500 |
| 5 | NB-UVB course — 12 sessions (package) | 26,000 |
| 6 | Excimer/targeted phototherapy — session | 4,000 |
| 7 | Punch/shave skin biopsy (incl. local) | 6,500 |
| 8 | Histopathology processing + report | 8,000 |
| 9 | Cryotherapy — per lesion | 2,500 |
| 10 | Electrocautery/RF wart removal (up to 5) | 5,000 |
| 11 | Intralesional steroid injection (keloid/AA) | 3,000 |
| 12 | Dermoscopy / mole mapping | 4,500 |
| 13 | Patch testing (allergy series) | 15,000 |
| 14 | Chemical peel — glycolic/salicylic (cross-sell) | 8,000 |
| 15 | Wood's lamp examination | 1,500 |

**Order sets:**
- **Biopsy/Pathology order set:** punch/shave biopsy → histopathology request (site+laterality auto-filled from lesion) → optional DIF/special stains → fixative/consumable pick from inventory → result placeholder + WhatsApp "results ready" journey.
- **Acne systemic work-up (isotretinoin):** baseline LFTs, lipid profile, **βhCG (females)**, pregnancy counseling task, monthly review recall.
- **Psoriasis pre-biologic/phototherapy panel:** CBC, LFT/RFT, HBsAg/HCV, TB screen (context PMDC/PHC).

---

### Integrations
- **Billing (PKR/FBR):** each delivered phototherapy session and each catalog procedure emits an `InvoiceLine`; 12-session NB-UVB package sells as a prepaid TreatmentPlan with per-session redemption. Biopsy triggers a two-line charge (procedure + histopath). FBR/PRA tax rules applied per existing billing engine (clinical services = provincial PRA).
- **Inventory/consumables (batch/expiry):** biopsy kits, LA vials, cryogen, intralesional steroid (triamcinolone), topicals, peel solutions decrement from `Batch` on procedure completion; expiry-aware picking; low-stock alerts. Phototherapy lamp-hours logged per session feed a **lamp-replacement maintenance alert** (calibration drift).
- **WhatsApp journeys/recall (Meta Cloud API):** phototherapy course auto-schedules next-session reminders + a **missed-session re-engagement** if gap > protocol threshold; isotretinoin monthly-review recall; biopsy "results ready" nudge; acne/eczema **re-score reminder** at follow-up interval; clinically-triggered aesthetic cross-sell (e.g. post-melasma MASI improvement → offer peel/photo package) — opt-in only.
- **Treatment plans:** phototherapy courses and multi-session peel/laser packages are TreatmentPlans (reuse scheduling, package pricing, progress %). Grading scores can be attached to a plan to show objective response over the course.
- **Reports:** per-instrument score-over-time (Trends engine), phototherapy cumulative-dose & response report, biopsy turnaround, catalog revenue mix, phototherapy no-show rate. Before/after photo galleries link from each score timeline for cross-sell decks.
- **Before/after + consent:** grading widget's "Attach photo" reuses the aesthetic capture+consent module; photos tag to lesion/region + instrument result.

---

### Clinical safety & edge cases
- **Dose engine authority:** suggested dose is computed **server-side** from `PhototherapyProtocol` (start-by-skin-type, `incrementPct`, erythema rules, missed-dose rules) and `maxBySkinType` ceiling. Client never sets cumulative or bypasses the cap.
- **Erythema/burn interlock:** grade 1 (<24h) → step up; grade 2 (24–48h) → **hold at previous dose**; grade 3 (>48h/blistering) → **skip + burnFlag + prescriber notification**, next dose reduced (e.g. −50%) and re-escalated cautiously.
- **Missed sessions:** gap-based reduction (e.g. <1wk continue; 1–2wk hold; 2–3wk −25%; 3–4wk −50%; >4wk restart protocol) auto-applied and shown; never silently continue escalating after a long gap.
- **Cumulative-dose & lifetime UV load:** running total surfaced prominently; optional soft warning at high cumulative exposure (skin-cancer risk counseling), especially skin types I–II.
- **Pregnancy/photosensitizer flags:** intake flags block/warn on systemic retinoids (teratogenicity — mandatory βhCG + counseling task before isotretinoin) and photosensitizing meds before phototherapy.
- **Skin-type edge:** unknown Fitzpatrick blocks phototherapy start until typed; MED test optional but overrides skin-type default start when present.
- **Scoring integrity:** severity bands are computed, not entered (GAGS mild 1–18 / moderate 19–30 / severe 31–38 / very severe ≥39; PASI/EASI 0–72; SCORAD 0–103; MASI 0–48; VASI 0–100). Partial region entry cannot be saved as a total. Child-vs-adult EASI weighting must be explicit.
- **Laterality/site correctness:** biopsy and lesion records require body region + laterality; path requisition inherits them to prevent wrong-site labeling.
- **Not diagnostic AI:** all scores are clinician-entered decision support; no auto-diagnosis.

---

### Effort (S/M/L; config vs new code)

| Piece | Type | Size |
|-------|------|------|
| 7 instrument JSON definitions (GAGS/PASI/EASI/SCORAD/MASI/VASI/Fitzpatrick) + severity bands | **Config** | M |
| Region/face-map SVG assets + `<DermaGradingPanel>` shell (weighted live math, per-instrument modes) | **New code** | L |
| Phototherapy data model + migrations (Course/Session/Protocol/Lesion) | **New code** | S–M |
| Dose engine (start/increment/erythema/missed/ceiling rules, server-side) | **New code** | M |
| `<PhototherapyLedger>` widget + cumulative chart | **New code** | M |
| Note templates ×7 | **Config** | S |
| Service catalog (15 items, PKR) | **Config** | S |
| Order sets ×3 (biopsy, isotretinoin, pre-biologic) | **Config** | S |
| WhatsApp journeys (phototherapy reminders, results-ready, re-score, cross-sell) | **Config** | M |
| Reports (score-trend, cumulative-dose/response, catalog revenue) | **Config→light code** | S–M |
| Manifest + entitlement wiring + onboarding activation | **Config** | S |
| QA/clinical validation of formulas + safety interlocks | — | M |

**Total: ~6–7 dev-weeks** (≈1 FE-heavy dev + 1 BE dev + clinical reviewer). Grading UI shell and the phototherapy engine/ledger are the only substantial new code (~2.5 of those weeks); the rest is config on shared engines.

---

### Acceptance criteria — end-to-end demo script
1. **Onboard** a "Dermatology" clinic type; confirm `pack.dermatology` activates and derma intake/templates/catalog appear (polyclinic multi-select also works).
2. **New acne patient** Ayesha Khan: intake captures Fitzpatrick IV; open consultation → Acne template → **GAGS** widget; tap regions, pick lesions; live score updates; save shows e.g. **28 → "moderate."**
3. **Trends:** re-score at follow-up (score 14); Trends chart shows GAGS falling over two visits; before/after photos attached and consented.
4. **Psoriasis patient:** score **PASI** across 4 regions with area+E/I/D → total in 0–72; start a **12-session NB-UVB course** (skin type IV → start dose seeded **500 mJ/cm²**), billed as a prepaid package.
5. **Phototherapy ledger:** record session 1 (500), session 2 auto-suggests **+15% ≈ 575**; enter erythema grade 2 → engine **holds** at 575 with visible rationale; cumulative dose and chart update.
6. **Safety:** simulate erythema grade 3 → dose locks, session marked skipped+burnFlag, prescriber-notify banner; simulate a 3-week gap → next suggested dose auto-reduced 25% with a note; dose caps at skin-type max.
7. **Biopsy order set:** on a lesion (cheek, right) run biopsy→histopath order; LA + kit decrement inventory with batch/expiry; two invoice lines (biopsy 6,500 + histopath 8,000, PKR/FBR); "results ready" WhatsApp queued.
8. **Missed-session recall:** a phototherapy no-show past threshold fires a WhatsApp re-engagement journey.
9. **Reports:** open score-over-time and cumulative-dose/response reports; verify catalog revenue mix reflects the day's charges.
10. **Cross-sell:** MASI improvement on a melasma patient triggers an opt-in aesthetic peel/package offer linked to the before/after gallery.

---

### Sources (clinical grounding)
- GAGS regions/factors/bands: [Comprehensive Review of Acne Grading Scales, Ann Dermatol 2023 (PMC10995619)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10995619/); [Severity of Acne Vulgaris comparison (PMC7532287)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7532287/)
- PASI formula/weights: [Psoriasis Area and Severity Index — Physiopedia](https://www.physio-pedia.com/Psoriasis_Area_and_Severity_Index_(PASI)); [PASI expert guide, ResRef](https://resref.com/psoriasis-area-and-severity-index-pasi-a-full-guide-for-researchers-and-clinicians/)
- EASI & SCORAD formulas: [Legit.Health SCORAD/EASI methodology](https://legit.health/for-research/atopic-dermatitis/scoring-methodology); [EASI↔SCORAD relationship (PMC5723207)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5723207/)
- MASI formula/weights: [MASI for professionals, Globale Dermatologie](https://www.globale-dermatologie.com/en/masi-melasma-area-and-severity-index-echelle-de-masi-pour-les-professionnels.html); [Scoring Aid: MASI and Modified MASI](https://plasticsurgerykey.com/the-scoring-aid-masi-and-modified-masi/)
- VASI hand-units/depigmentation grades: [VASI, US Dermatology Partners](https://www.usdermed.com/clinical-tools/vasi); [VASI calculator, CMSD](https://cmsderm.ca/calculators/vasi)
- NB-UVB dosing by skin type / erythema / missed sessions: [NB-UVB dosing calculator, CMSD](https://cmsderm.ca/calculators/nb-uvb); [DermNet NZ — UVB phototherapy](https://dermnetnz.org/cme/phototherapy/uvb-phototherapy); [AAD–NPF joint phototherapy guidelines (JAAD)](https://www.jaad.org/article/S0190-9622(19)30637-1/pdf); [UMass vitiligo NB-UVB protocol](https://www.umassmed.edu/globalassets/vitiligo/umass-uvb-phototherapy-guidelines.pdf)
