# Health OS — Specialty Packs Plan

_Capture the clinic's specialty at onboarding, serve tailored workflows via configurable "packs" on one shared clinical core — no forks. Companion to `health-platform-master-plan.md`._



---



# Part I — Strategy

## Clinic-Type Taxonomy & Pack Roadmap

*Health OS (Summit Systems) — Specialty Packs on the shared clinical core. Pakistan-first. This document maps the full universe of outpatient clinic types to packs, tiers each Light or Heavy, and sequences the build into Waves A/B/C balancing PK demand × our fit × effort.*

---

### 1. Clinic-Type Taxonomy (grouped, with standalone-demand signal)

Demand signal = *how commonly this exists as a standalone clinic in Pakistan* (High / Med / Low). Tier = Light (config/templates/catalog only) or Heavy (needs a custom clinical component). "Component" names the genuinely new engineering; "config" means it rides existing widgets.

#### Group A — Aesthetic & Skin (our founding wedge)
| Clinic type | Standalone demand | Tier | New component / note |
|---|---|---|---|
| Aesthetic / Cosmetic | High | Heavy (~85% built) | Components already ship; remaining = config + consumable/injectable lot-ledger |
| Dermatology (medical) | High | Heavy | Grading-calculator suite (GAGS/EASI/SCORAD/PASI/MASI/VASI) + NB-UVB phototherapy dosing ledger |
| Plastic / Reconstructive & Mohs | Low | Heavy | Mohs stage-mapping widget; rest reuses aesthetic |

#### Group B — Dental
| Clinic type | Standalone demand | Tier | New component / note |
|---|---|---|---|
| General Dental | High | Heavy | Odontogram + perio chart + tooth-level treatment plan (`tooth_finding`/`perio_measurement`) — reused by all dental sub-specialties |
| Orthodontics | Med | Heavy (add-on) | Extends odontogram with appliance map + case timeline; reuses aesthetic photo timeline |
| *(Endo / Perio / Prostho)* | Med | Light-on-dental | Config on the shared odontogram; no new build |

#### Group C — Women's & Child Health
| Clinic type | Standalone demand | Tier | New component / note |
|---|---|---|---|
| Obstetrics & Antenatal | High | Heavy | ANC-card visit grid + WHO partogram + obstetric ultrasound field set |
| Gynaecology | High | **Light** | Menstrual/cycle field group + reused Episode timeline; bundles with Obstetrics |
| Fertility / IVF (ART) | Med | Heavy | IVF cycle state machine + follicle grid + embryology lab board |
| Pediatrics (Child Specialist) | High | Heavy | Growth-chart percentile/z-score engine + weight-based dose calculator |
| Vaccination / Immunization | High | Heavy | EPI schedule-rule engine + recall + per-dose lot/AEFI capture |

#### Group D — Eye & ENT (sensory)
| Clinic type | Standalone demand | Tier | New component / note |
|---|---|---|---|
| Ophthalmology | High | Heavy | Eye Exam Panel (per-eye refraction grid, IOP trend, slit-lamp/fundus); needs core **laterality (OD/OS)** |
| Optometry / Optical | High | Heavy→Light | Reuses Eye Exam Panel in refraction+dispensing mode; net-new = optical catalog/inventory |
| ENT / Otolaryngology | High | Heavy | ENT Exam Panel: audiogram capture/plot + structured otoscopy/rhinoscopy; needs **laterality (AD/AS)** |

#### Group E — Musculoskeletal
| Clinic type | Standalone demand | Tier | New component / note |
|---|---|---|---|
| Physiotherapy / Rehab | High | Heavy | MSK Assessment & Rehab widget suite (ROM, MMT, outcome scores, session course) |
| Orthopaedics | High | **Light-on-physio** | Reuses MSK suite + config; imaging/procedure order fields |
| Pain / Interventional | Low | **Light** | Reuses MSK suite; often enabled inside ortho/physio tenant |

#### Group F — Chronic / Internal Medicine
| Clinic type | Standalone demand | Tier | New component / note |
|---|---|---|---|
| GP / Family Medicine | High | **Light (base template)** | The canonical pack every other Light pack inherits |
| Diabetes & Endocrinology | High | Heavy (bounded) | Insulin-titration + diabetic-foot; composes shared Trends widget |
| Cardiology | Med | Heavy (bounded) | ECG/echo capture; composes shared Trends widget |
| Internal Medicine / General Physician | High | **Light** | Config on Trends + chronic-disease registry |

#### Group G — General & Medical Specialties ("Light Pack family")
All **Light** — config + templates + catalog + order sets on shared core; the few "widgets" (PHQ-9, anthropometry, diet plans) are shared components merely *invoked*.
| Clinic type | Standalone demand | Tier |
|---|---|---|
| Psychiatry / Mental health | Med | Light (scored-instrument engine: PHQ-9/GAD-7) |
| Gastroenterology | Med | Light |
| Pulmonology / Chest | Med | Light (mMRC/CAT via instrument engine) |
| Urology | Med | Light (IPSS) |
| Nephrology / Dialysis | Med | Light |
| Neurology | Med | Light |
| Nutrition / Dietetics | Med | Light (anthropometry trend + care-plan builder) |
| Endocrine (non-diabetes) | Low | Light |

**Shared-core components funded once, reused across many packs (not per-pack):** ToothChart/PerioChart (dental cluster); aesthetic before/after + consent + injectable map; grading-calculator/scored-instrument engine; Longitudinal Trends charting; growth-chart engine; weight-based dose calculator; MSK widget suite; Eye/ENT exam panels; **first-class laterality** on the canonical data model. Building these once is what keeps the long tail Light.

---

### 2. Prioritised Build Roadmap

Sequencing rule: **our fit × PK demand × leverage** (a Heavy build that unlocks multiple downstream Light packs earns its place early).

#### Wave A — Our strengths + highest PK demand (build now)
The founding wedge plus the highest-volume standalone specialties that map to net-new engines we can reuse widely.
1. **Aesthetic / Cosmetic** (Heavy, ~85% built) — finish packaging: manifest, PKR catalog, templates, consumable ledger. *Fastest revenue; already ours.*
2. **General Dental** (Heavy, P0) — the odontogram/tooth-model build; unlocks the entire dental cluster. *Highest-leverage second vertical.*
3. **Obstetrics & Antenatal** (Heavy, P0) — ANC card + partogram; ships bundled with Gynae.
4. **Gynaecology** (Light, P0-bundle) — near-free ride-along with Obstetrics; validates the "Light ships fast" thesis.
5. **Pediatrics** (Heavy, P0) — growth-chart + dose engine; cross-entitles Vaccination.
6. **Vaccination / Immunization** (Heavy, P0) — EPI rule engine + recall; pairs with Peds.
7. **Ophthalmology** (Heavy, P0) — Eye Exam Panel + core laterality; unlocks Optometry.

#### Wave B — High demand, dependent on Wave A engines or one tier down
8. **Optometry / Optical** (Heavy→Light) — reuses Eye Exam Panel; add optical inventory. *Cheap once Ophthalmology ships.*
9. **Dermatology (medical)** (Heavy, P1) — grading suite + phototherapy ledger; extends the skin cluster.
10. **ENT** (Heavy, P1) — audiogram panel; high consult volume.
11. **Physiotherapy / Rehab** (Heavy, P0-of-cluster) — MSK suite; unlocks Ortho + Pain.
12. **Orthopaedics** (Light-on-physio) — config once MSK suite exists.
13. **Fertility / IVF** (Heavy, P1) — most component-intensive; high value, fewer tenants.
14. **Orthodontics** (Heavy add-on, P1) — layers on dental.
15. **GP / Family Medicine** (Light, P0-template) — the base Light pack; also seed the Internal-Medicine Trends + registry core here.

#### Wave C — Long tail (mostly Light) + narrow niches
16. **Diabetes & Endocrinology** (Heavy-bounded) and **Cardiology** (Heavy-bounded) — build once Trends core is proven.
17. **Light Pack family** — Psychiatry, Gastro, Pulmo, Uro, Nephro, Neuro, Nutrition, Internal Medicine, Pain. Each = config + templates + catalog + order sets on already-built shared engines. Ship in rapid succession.
18. **Plastic / Reconstructive & Mohs** (Heavy, P2) — build only when an anchor tenant signs.
19. **Dental sub-specialties** (Endo/Perio/Prostho, Light-on-dental) — config as demand appears.

---

### 3. "Light ships fast, Heavy is deliberate"

The portfolio is intentionally lopsided in *effort*, not in *count*:

- **~8–9 Heavy packs, total.** Each is a deliberate, funded engineering investment because it introduces a genuinely new clinical component the core note engine cannot express: odontogram, ANC/partogram, growth-chart engine, EPI scheduler, Eye/ENT exam panels, MSK suite, IVF state machine, phototherapy/grading engines. We gate these behind an anchor-demand signal and build each component **once**, then reuse it (dental→ortho, ophthalmology→optometry, physio→ortho/pain, aesthetic→plastics).
- **~15+ Light packs.** Once the shared engines exist, a Light pack is *config + content*: an intake field-set, note templates, a PKR service catalog, and order sets behind an entitlement flag — **days, not sprints**, no code, no fork. The entire General/Medical Specialties family (GP, Psych, Gastro, Pulmo, Uro, Nephro, Neuro, Nutrition), plus Gynaecology, Optometry, and Orthopaedics, land this way.

Message to the org: **Heavy packs are our moat (they're why generic EMRs fail these specialties); Light packs are our velocity (they let us blanket the market from one codebase).** Every Heavy build should be justified partly by how many downstream Light/near-Light packs it unlocks.

---

### 4. Hospitals = multiple department packs

The same pack machinery serves both ends of the market on **one multi-tenant codebase, one canonical data model**:

- A **solo clinic** enables one pack (or a natural bundle, e.g. Obstetrics + Gynaecology = a "Gynae & Obs" profile; Peds cross-entitles Vaccination).
- A **hospital** is simply a tenant that enables **many department packs at once** — Dental + Ophthalmology + Peds + Obs/Gynae + Physio + medical Light packs — each lighting up its department's intake, templates, catalog, and any Heavy widget, while every department writes to the *same* patient record. Cross-department data flows without re-entry (menstrual data → pregnancy episode → IVF cycle; a growth measurement is one structured observation visible to Peds and GP alike).
- No forks, no per-hospital builds: a hospital is a **superset of entitlement flags**, not a different product. This is the core payoff of the pack architecture — sell the same system to a 2-chair BDS practice and a 300-bed hospital, differing only by which flags are on.



## Consolidated Specialty-Pack Matrix

| Specialty | Tier | Priority | Distinct tools / fields | Note |
|---|---|---|---|---|
| **Endocrinology & Diabetology** | Light | P1 | HbA1c/weight/BP flowsheet trends + insulin-titration plan builder (both shared core, config-invoked) | Very high PK prevalence (T2DM ~11-15%). Diabetes annual-review templates + order sets; no new component. |
| **Gastroenterology & Hepatology** | Light | P1 | Bristol stool scale + endoscopy/colonoscopy report template; endoscopy images reuse existing media module | Very high HBV/HCV burden in PK. Chronic-hepatitis and dyspepsia order sets. Config only. |
| **General Pediatrics** | Light | P1 | WHO growth-percentile charts (the ONE candidate custom component — recommend building in shared core); IMNCI-aligned sick-child + immunization templates | Kept Light by building growth-percentile curves as a shared core chart (reused by nutrition). If that component is deferred, peds ships with plain flowsheet and still stays Light. EPI immunization schedule as config. |
| **Gynaecology** | Light | P1 | none (templates + config only) — structured menstrual/cycle field group (LMP, cycle length/regularity, flow, GPAL) rendered on the reusable Episode timeline; PCOS/AUB/menopause note templates and order sets | Deliberately LIGHT: needs specialty intake fields, SOAP templates and a service catalog but NO bespoke clinical component. Menstrual tracking is served by a config field group + reuse of the generic Episode timeline. Default-bundled with Obstetrics for solo clinics; menstrual data flows into an OB pregnancy or IVF cycle on the shared model. |
| **Nutrition & Dietetics** | Light | P1 | anthropometry trend charts (flowsheet) + structured diet-plan builder (care-plan builder); ADIME note template | Both widgets are shared-core components invoked by the pack, not pack-specific code — so it stays Light. Anthropometry fields + 24-hr recall + PES statement. |
| **Orthopaedics** | Light | P1 | Fracture/trauma + joint-specific exam note templates (mechanism, neurovascular assessment, fracture site/pattern/displacement classification picklist), ROM-in-degrees with contralateral comparison, X-ray/imaging order + PACS link fields, casting/injection procedure logging; reuses Physio ROM & special-tests panels | High PK trauma/arthritis demand. Needs no new component -> LIGHT: templates + intake fields + imaging-order config + reuse of the shared MSK panels and core procedure/DME/inventory modules. Auto-referral into the Physio rehab protocol. |
| **Psychiatry & Mental Health** | Light | P1 | PHQ-9, GAD-7 and structured Mental State Exam as instrument definitions on the shared scored-instrument engine; therapy/session note template | Depression = top DALY contributor in PK. Mandatory suicide-risk field. Stays Light IF the scored-instrument engine exists in core — build that engine once (reused by many packs). |
| **Pulmonology / Chest** | Light | P1 | mMRC/CAT/ACT via scored-instrument engine; PEFR/spirometry into flowsheet; TB/DOTS + GeneXpert order set | High TB and asthma/COPD burden in PK. TB-initiation & follow-up template. Config only. |
| **Cardiology** | Heavy | P1 | ECG capture & structured-interpretation panel (rate/rhythm/axis/intervals/ST-T, stored discrete not scanned); ASE-standard echo report builder (EF/LV/valves -> PDF + discrete values); 10-yr CV risk calculator (ASCVD/Framingham/WHO-LMIC). BP+lipid trends reuse the shared Trends widget | Only cluster member needing genuinely new clinical components — ECG/echo don't fit the generic note+lab model. High PK burden (HTN ~25%, heavy dyslipidemia/IHD). Config: intake, templates, catalog, order sets. |
| **Dermatology (medical/clinical)** | Heavy | P1 | Severity-grading calculator suite (GAGS acne / EASI+SCORAD eczema / PASI psoriasis / MASI melasma / VASI vitiligo) writing scored Observations plotted longitudinally + NB-UVB phototherapy dosing ledger (starting dose by Fitzpatrick/%MED, per-visit increments, cumulative J/cm2 + lifetime-dose safety alerts) | Biggest net-new build and highest-volume PK specialty: derma OPD dominated by eczema ~31%, infections ~28%, acne ~11%, pigmentary/melasma/vitiligo ~3.8%. Distinct from aesthetic: needs validated grading calculators + phototherapy ledger as genuine reusable shared components (config-driven scales, one scoring engine). Intake/catalog/order-sets/dx templates are config+content. Priority P1: build after aesthetic pack packaging. |
| **Diabetes / Endocrinology** | Heavy | P1 | Glucose log / SMBG + CGM (time-in-range/GMI) capture with HbA1c trend; insulin-titration assistant (protocol-driven, human-in-loop, logs each dose step); diabetic-foot exam map (ulcer/monofilament/ABI + risk score + recall). HbA1c/lipid/BP trends reuse shared Trends widget | Huge, fast-growing PK segment (~33M diabetic adults). HEAVY: glycemic management, insulin titration, foot screening need purpose-built tools. Also carries thyroid/PCOS templates. Config: intake, templates, catalog, order sets. |
| **ENT / Otolaryngology** | Heavy | P1 | ENT Exam Panel: audiogram capture & plot (per-ear air/bone thresholds 250-8000Hz, masking, SRT/SDS, tympanogram type, degree/type classification + trending), structured otoscopy (TM/canal, per ear AD/AS), structured rhinoscopy/oropharynx (septum/turbinates/polyps, tonsil grade, neck), ear/nasal diagram annotation, endoscopy/otoscopy image attach | P1: ENT is ~25% of adult / ~40% of paediatric GP consults in Pakistan; top OPD presentations rhinosinusitis, impacted cerumen, pharyngitis, allergic rhinitis, CSOM; high otitis-media hearing-loss burden in South Asia. HEAVY because the audiogram chart is a genuinely bespoke component; the rest is config/reuse. |
| **Fertility / IVF (ART)** | Heavy | P1 | IVF Cycle Manager: (1) stimulation calendar/flowsheet with gonadotropin dosing + E2/P4/LH trend-driven alerts, (2) per-ovary follicle-tracking grid (size cohorts, lead/mature tally, endometrial thickness, trigger-readiness), (3) embryology lab board (oocyte->MII->2PN->blastocyst, Gardner grading day 0-7, cryo chain-of-custody, outcome) | Most component-intensive pack. HEAVY because an IVF cycle is a multi-day protocol state machine with follicle-cohort ultrasound data and an embryology lab dataset with witnessing/chain-of-custody — none expressible on core notes/orders. Links both partners to one subfertility episode. Higher build cost, fewer but high-value tenants (mature PK IVF market, ~22% infertility prevalence). P1 after Obstetrics. |
| **Optometry / Optical** | Heavy | P1 | Reuses Eye Exam Panel in 'refraction + dispensing' mode (refraction grid + auto-ref/lensometer import + Rx builder, IOP/slit-lamp/fundus hidden); net-new is optical dispensing catalog + frame/lens inventory config and referral red-flag governance | Tiered Heavy only because it depends on the Eye Exam Panel; operationally Light once Ophthalmology ships (config + inventory on top, no new clinical component). Very common standalone in Pakistan and the front line for uncorrected refractive error (only ~43% of dispensed spectacles optimal in quality studies). |
| **Orthodontics** | Heavy | P1 | Bracket/appliance map on the odontogram (bonded teeth, bracket Rx, current archwire, elastics), long-running case + appliance timeline (bond→wire changes→debond→retention), progress photo series (reuses aesthetic before/after timeline), stored cephalogram images + manual SNA/SNB/ANB measurement fields, installment/case-based billing with per-visit milestone release | Sub-specialty pack layered on Dental (enable pack.dental + pack.ortho), NOT a separate product. High case value (PKR 80k–600k) but smaller installed base than general dentistry → P1. Reuses odontogram, patients, imaging, consent, installment billing, and the aesthetic photo timeline; only adds malocclusion intake, ortho templates, and the appliance-map/timeline extension. Full Dolphin-style cephalometric tracing deferred — v1 stores ceph + key manual measurements to keep it HEAVY-but-bounded. |
| **ENT / Otolaryngology** | Light | P2 | none new — structured ENT exam template; audiometry note; hearing-loss/rhinosinusitis order sets | Config only. Ear syringing / nasal endoscopy / audiometry as catalog billing lines. |
| **Nephrology** | Light | P2 | eGFR/creatinine/K+ trends via flowsheet; CKD staging & follow-up template | Clinically significant CKD common (~74% with concomitant HTN). OPD-only stays Light; full dialysis-run charting would be a separate Heavy module (out of scope). |
| **Neurology** | Light | P2 | none new — structured neuro-exam template (cranial nerves/power/reflexes/gait); seizure & stroke order sets | Config only. Exam is a template, not a component. In-house EEG/EMG billing lines. |
| **Pain Management** | Light | P2 | Pain body-map + NPRS/BPI score-trend (thin layer over the shared outcome-measure engine), interventional procedure note (type/level/laterality/drug+dose/US-or-fluoroscopy guidance) on shared procedure log, opioid/controlled-substance tracking via medication module, injection catalog (ESI, facet/medial-branch block, RFA, trigger-point) | Smaller PK standalone niche, strong add-on inside ortho/neuro/physio tenants. Rides shared procedure-logging + medication + imaging modules; no new heavy component -> LIGHT. Often enabled as a sub-service rather than sold alone -> P2. |
| **Urology** | Light | P2 | IPSS score via shared scored-instrument engine; hematuria/stone/BPH order sets | Config only. Uroflow/cystoscopy/ESWL as catalog billing lines. |
| **Plastic / Reconstructive & Mohs surgery** | Heavy | P2 | Mohs stage-mapping tool (per-stage margins/sections/clear status -> staged operative record) — the only true net-new widget; reconstruction flap/graft = structured operative-note template + reused aesthetic body-map | Narrow, documentation-heavy niche; lowest priority for Pakistan-first outpatient reality (few standalone Mohs clinics). Much overlaps aesthetic pack (cosmetic-surgery consult, before/after, packages, deposit engine all reused). Distinct need = surgical/operative docs: Mohs staged notes + reconstruction op-notes (repair type, graft split/full-thickness, wound depth) matching coding/medical-necessity requirements. Build only when an anchor plastic/Mohs tenant signs. |
| **GP / Family Medicine** | Light | P0 | none (templates only) — the base SOAP + chronic-disease + febrile-illness templates every other pack inherits | Canonical outpatient base pack; pure config on shared EMR. All other packs override/extend it. Highest volume standalone clinic type in Pakistan. |
| **Internal / General Medicine** | Light | P0 | none (templates only) — problem-list note, multimorbidity review, med-reconciliation | GP base + chronic-disease depth for physician-led OPD (dominant PK clinic). Config only; heavy multimorbidity given DM ~15% / HTN ~38%. |
| **Internal Medicine / General Physician** | Light | P0 | none (templates only) — chronic-disease dashboard is a composition of the shared Longitudinal Trends widget + Chronic-Disease Registry + med-reconciliation template; NCD-coded problem list; PK-tuned fever/NCD order sets | Highest-volume, broadest, lowest-build pack; dominant PK private-OPD segment and the natural non-aesthetic wedge. Ships as pure config/templates over the existing core — proves 'specialty pack != code' and validates the pack framework. Should ship first. |
| **Aesthetic / Cosmetic** | Heavy | P0 | Before/after photo timeline + digital consent, injectable/treatment body-map, structured skin assessment, packages/memberships (ALL already built); remaining net-new = per-treatment consumable/injectable lot+expiry ledger tied to inventory | The flagship wedge, ~85% built. Heavy because it requires custom clinical components, but they already ship. Remaining work is mostly config: pack manifest, PKR catalog (Botox 20-65k, filler 25-80k/syringe, laser by zone, HydraFacial 8-40k), dx-light aesthetic note templates, and the small consumable ledger flagged in competitor intel. Fitzpatrick + photo-consent reused across the cluster. |
| **General Dental** | Heavy | P0 | Interactive odontogram (FDI/Universal/Palmer, adult+primary, per-surface MODBL), periodontal charting (6-point pockets, BOP, mobility, visit comparison), tooth-level phased treatment plan by tooth/quadrant that posts to billing, tooth↔RVG/OPG image binding; new tables tooth_finding / perio_measurement / dental_treatment_plan_item | Flagship second vertical after aesthetic/derma. Dentistry is among the most common standalone clinic types in PK (caries prevalence ~56.6%; thousands of solo/2-chair BDS practices). General EMRs fail because dentistry is per-tooth, not per-encounter. Everything is config on the shared core EXCEPT one reusable ToothChart/PerioChart component + tooth-level tables — that single build is reused by endo/perio/prostho/ortho so we never fork. |
| **Obstetrics & Antenatal Care** | Heavy | P0 | ANC Card visit-wise grid (LMP/EDD/GA, GPAL, serial SFH/BP/FHR with deviation sparklines) + WHO Labour Care Guide partogram + obstetric ultrasound field set (BPD/HC/AC/FL/EFW, presentation, AFI, Doppler) | Flagship pack, highest PK demand. HEAVY because an antenatal record is a longitudinal visit-wise grid + intrapartum time-series chart that the core note engine cannot represent. Reuses core vitals/observations, appointments, billing, document print. New: Pregnancy episode + ANC-card/partogram widgets. Ships bundled with Gynaecology as the standalone 'Gynae & Obs' clinic profile. |
| **Ophthalmology** | Heavy | P0 | Eye Exam Panel: per-eye (OD/OS) refraction grid (Sph/Cyl/Axis/Add/Prism/PD, VA sc/cc/pinhole), IOP field with method+time-of-day + per-eye trend, structured slit-lamp anterior segment, fundus/posterior segment with C:D ratio + DR grading, spectacle & contact-lens Rx builder, eye schematic annotation, fundus/OCT/FFA image attach | P0 for Pakistan: cataract is the #1 cause of blindness (~51.5%) and uncorrected refractive error the #1 cause of moderate visual impairment (~43%); ~904k adults need cataract surgery. Common standalone, closest to existing derma imaging strength. HEAVY because refraction grid + IOP/slit-lamp/fundus capture + per-eye trending cannot be expressed as plain SOAP. |
| **Pediatrics (Child Specialist Clinic)** | Heavy | P0 | GrowthChartWidget (WHO/CDC weight/height/head-circ percentile + z-score plotting), WeightBasedDoseCalculator (mg/kg with max-dose cap), age-banded well-child + IMNCI sick-child templates, developmental milestone/M-CHAT checklist, birth/neonatal intake block | Flagship child-health pack: well-child growth/development surveillance + acute sick-child OPD. High-volume standalone specialty in Pakistan and strong second vertical after aesthetic/derma. Heavy because percentile growth-chart engine and weight-based dosing can't be templates. Cross-entitles the Vaccination pack's scheduler since peds clinics almost always vaccinate. |
| **Physiotherapy / Rehab** | Heavy | P0 | MSK Assessment & Rehab Suite: ROM goniometry grid, MMT 0-5 grid, special-tests panel, outcome-measure engine (NPRS/Oswestry/NDI/DASH/LEFS/Berg/TUG), HEP exercise-prescription builder, per-session treatment log + STG/LTG goal tracker tied to a session-package counter | Largest standalone PK outpatient segment. The single NEW component in the cluster; its ROM/special-tests/outcome panels are reused by the Ortho and Pain packs. Longitudinal session-based care and validated functional scores are why generic SOAP is insufficient -> HEAVY. |
| **Vaccination / Immunization Clinic** | Heavy | P0 | ImmunizationScheduler (DOB-driven due/overdue engine on Pakistan EPI ruleset + catch-up logic), WhatsApp/SMS recall for dropouts, per-dose lot/expiry/site/route capture with inventory decrement, AEFI capture, printable EPI/digital vaccination card + coverage/dropout reporting | Standalone immunization/well-baby centers and the vaccination room in any peds/family clinic. Defining asset is the versioned EPI schedule-rule engine + recall — directly targets Pakistan's ~47% full-immunization gap. EPI vaccines recorded free/govt-supplied; service fee + private vaccines billable. Vaccine = inventory SKU (lot/expiry/temp), so most of the pack is shared-core reuse. |

_31 packs — 16 Light (config/templates), 15 Heavy (custom widget)._




---



# Part II — Pack System (Architecture & Onboarding)

## Specialty-Pack Architecture & Onboarding

A **pack** is data, not code. It is a versioned bundle of JSON manifests + seed rows + (optionally) a registered widget id. Activating a pack for a tenant flips entitlement flags and seeds/links config rows against the ONE canonical clinical model — never a schema fork, never a branch. Heavy packs differ from Light packs by exactly one thing: a Light pack references zero widgets; a Heavy pack references one or more `widgetId`s that resolve against a client-side **component registry**. Everything else (fields, templates, catalog, order sets, entitlements) is identical machinery.

---

### 1. Pack data model (on the shared canonical model)

Two layers: **catalog** (global, version-controlled pack definitions authored by Summit) and **tenant activation** (per-tenant rows that reference the catalog and hold overrides). Global catalog tables are tenant-agnostic; everything a tenant touches carries `tenant_id` + RLS.

```
── GLOBAL CATALOG (authored once, semver'd, no tenant_id) ──
Pack
  id            "pack.dental"            -- stable key = entitlement flag
  displayName   "General Dental"
  version       "1.4.0"                  -- semver; migrations keyed to this
  tier          LIGHT | HEAVY
  priority      P0..P3
  dependsOn     ["pack.dental"]          -- ortho depends on dental
  bundles       ["pack.obstetrics"]      -- gynae auto-bundles obs
  widgetIds     ["odontogram","perioChart"]   -- [] for Light packs
  entitlements  ["feat.toothChart","feat.perioChart"]  -- fine-grained flags this pack grants
  manifestRef   -> PackManifest (the rest below, as versioned JSON)

PackManifest (the JSON payload, one row per Pack version)
  ├── intakeSchemas   FormSchema[]       -- field-sets (JSON Schema + UI hints)
  ├── noteTemplates   NoteTemplate[]
  ├── catalogItems    ServiceCatalogItem[]  -- PKR pricing, tax class
  ├── orderSets       OrderSet[]
  ├── observationDefs ObservationDef[]   -- coded metrics the pack pins (LOINC/local)
  ├── consentForms    ConsentForm[]
  └── widgetConfig    { odontogram: {...} }  -- config passed to Heavy widgets

FormSchema         id, jsonSchema, uiSchema, target(patient|encounter|episode), version
NoteTemplate       id, specialtyTag, sections[], boundWidgets[], defaultOrderSetIds
ServiceCatalogItem sku, name, category, priceMinorPKR, taxClass(PRA|FBR|exempt), rvuOrDuration
OrderSet           id, name, items[{type: lab|imaging|drug|procedure, code, defaults}]
ObservationDef     code, unit(UCUM), site-aware(bool), scale/refRange, plotHint
ConsentForm        id, bodyMd, eSignRequired, mediaConsent(bool)

── TENANT ACTIVATION (tenant_id + RLS) ──
TenantPack
  tenant_id, packId, packVersion(pinned), status(active|trial|suspended),
  enabledAt, seededSnapshotId, overrides(jsonb)   -- tenant edits layer OVER catalog

TenantCatalogItem / TenantTemplate / TenantFormSchema
  tenant_id, sourcePackId, sourceItemId, overrides(jsonb), isCustom(bool)
  -- seeded as COPIES so a tenant can rename/reprice without mutating the global catalog
```

**Activation flow (transactional, idempotent):**
1. Resolve dependency + bundle closure (`pack.ortho` → pulls `pack.dental`; `pack.gynae` → `pack.obstetrics`). Refuse activation if a hard `dependsOn` isn't also being activated.
2. Write `TenantPack` rows (status, pinned version).
3. Grant `entitlements[]` into the tenant's entitlement set (the same feature-flag engine that gates every other module — packs are just flag-granters).
4. **Seed by copy-on-activate:** catalog items/templates/form-schemas are copied into `TenantCatalog*` tables so tenants can edit freely; observation defs + widget configs are referenced by pinned version (not copied — they're behavior, not content).
5. Emit `PackActivated` domain event → downstream (search index, nav builder, billing meter).

Seeding-by-copy is the key config-not-fork decision: the global catalog is immutable per version; tenant edits live in an overrides layer, so a catalog v1.4→v1.5 upgrade can 3-way-merge (base→base') without clobbering tenant customizations.

**Version pinning + migration:** each Pack version ships a forward migration (mostly data: "add field X to intake schema", "new SKU"). Tenants pin a version; upgrade is opt-in per tenant with a diff preview. Because widgets read `widgetConfig` from the pinned manifest, a widget and its config move together — no runtime schema drift.

---

### 2. Specialty widgets as plug-in components (registry / plugin pattern)

The shared EMR shell is widget-agnostic. Heavy packs contribute clinical UI through a **client-side component registry** keyed by the same `widgetId` the manifest references. The EMR never imports a pack directly; it asks the registry.

```ts
// Core, ships in the base app. Packs REGISTER into it; core never imports packs.
interface ClinicalWidget<TConfig, TData> {
  id: string;                       // "odontogram", "antenatalCard", "refractionGrid"
  requires: string[];               // entitlement flags gating render
  dataContracts: string[];          // canonical tables/observation codes it reads/writes
  Component: LazyExoticComponent;   // code-split; only fetched when entitled
  toObservations(state): Observation[];  // widget state -> canonical rows (the plug boundary)
  fromObservations(rows): TData;         // canonical rows -> widget state
}

WidgetRegistry.register(odontogramWidget);   // pack bootstrap
WidgetRegistry.render(widgetId, { config, patientId, encounterId });
```

**The plug boundary is the canonical data model, not a private table.** A widget may own *narrow* specialty tables (e.g. `tooth_finding`, `perio_measurement`, `follicle_measurement`) but it MUST also project its clinically meaningful outputs into canonical `Observation`/`Encounter`/`DocumentReference` so that billing, reporting, search, AI scribe, and cross-pack reuse see one model. `site`-aware observations (OD/OS/OU, AD/AS/AU, per-tooth FDI) are a **core data-model dimension**, funded once — that laterality/anatomy axis is what lets a widget round-trip through canonical storage instead of forking.

**Reuse map (why heavy count stays small):** one `ToothChart/PerioChart` serves dental+endo+perio+prostho+ortho (ortho only extends it with a bracket/appliance layer). One before/after photo timeline serves aesthetic+derma+ortho progress+plastics. One `EyeExamPanel` serves ophthalmology (full) + optometry (reduced "refraction+dispensing" mode via config, no new code). One scored-instrument engine renders GAGS/EASI/PASI/PHQ-9/GAD-7/IPSS from JSON instrument defs. One flowsheet/trends widget serves cardio/IM/diabetes/peds-growth-adjacent metrics. Widgets are **rendered in modes via `widgetConfig`**, so "new specialty" usually = new config, not new component.

**Loading:** widgets are lazy code-split chunks. A tenant only downloads odontogram JS if `feat.toothChart` is entitled. Registry lookup fails safe: an un-entitled or unregistered `widgetId` renders a graceful "not enabled" slot, never a crash — so a note template authored against a widget still opens on a tenant that lacks the pack.

**Server side:** each widget's `dataContracts` are enforced by API scopes. The backend has no per-pack code either — it validates writes against `ObservationDef`/`FormSchema` from the pinned manifest. Narrow specialty tables are migrations shipped with the base app (small, additive, nullable), gated at the API layer by entitlement, not by tenant schema.

---

### 3. Onboarding UX (specialty → seeded workspace)

Ask specialty **once**, at signup, and derive the whole workspace from it. Three archetypes, one engine:

| Archetype | Prompt | Selection | Result |
|---|---|---|---|
| **Solo / single clinic** | "What kind of clinic is this?" | single-select (Aesthetic, Dental, Peds, Eye, Gynae&Obs…) | activate that pack + its bundles (e.g. Gynae&Obs enables Obstetrics+Gynaecology) |
| **Polyclinic** | "Which services do you offer?" | multi-select chips | activate each chosen pack; shared patient registry, per-provider pack context |
| **Hospital** | "Set up departments" | department wizard → each dept picks packs | departments = org units; each enables a pack bundle; billing/reporting roll up |

Flow: **specialty picker → preview → seed → land in a working clinic.**
- The picker shows tier badges and a plain-language "what you get" (intake fields, N templates, N catalog items with PKR ranges, order sets, "+ live tooth chart" for Heavy).
- **Preview before commit:** render a sample chart with the pack's templates/widget and a sample invoice from the seeded PKR catalog — so the buyer sees the tailored workflow in the trial, not after paying.
- **Seed = the activation flow in §1**, run inside the tenant-provision transaction. Land the user on a dashboard already populated with their specialty nav, templates, and catalog — zero blank-state.
- Bundled defaults reduce choices: Peds auto-cross-entitles the Vaccination scheduler; Obstetrics auto-bundles Gynaecology; Optometry offers to also enable Ophthalmology mode.
- **Reversible & additive:** specialty isn't a lock-in. "Add a service" later re-runs the picker and seeds another pack onto the same canonical patient data — a growing clinic adds Ortho onto Dental without migration.

---

### 4. Packs ↔ editions, entitlements & pricing

Packs ride the **existing entitlement/feature-flag engine** ("roadmap = price sheet") — a pack is just a flag-bundle with content. Pricing mirrors the tier:

- **Light packs = bundled into the edition.** GP/Family-Med, Gynaecology, Ortho-clinic add-ons that only add fields/templates/catalog cost us near-zero to ship, so they're included free with the relevant edition to drive breadth and lock-in. Enabling them is a self-serve toggle.
- **Heavy packs = add-ons (or edition-defining).** Anything contributing a clinical widget (Dental odontogram, Obstetrics ANC/partogram, Ophthalmology EyeExamPanel, Peds growth chart, IVF cycle manager) carries a monthly add-on price because it's real engineering + support. Some heavy packs *define* a Specialty edition (Aesthetic/Dental/Derma) and are included there; the same pack is an add-on when a Clinic/Polyclinic edition wants it à la carte.
- **Per-provider metering, not per-user** (the platform's pricing wedge): a heavy pack's add-on price attaches per revenue-generating provider/chair/bed, consistent with "you only pay more when you earn more." A 2-chair dental clinic pays for 2, not for its receptionist logins.
- **Hospital = department bundles.** Each department pack is a metered line; enabling Cardiology + Obstetrics + Peds as departments composes at the org level, billed per active department/bed.

Entitlement granularity is **finer than the pack**: a pack grants specific `feat.*` flags (e.g. `pack.dental` → `feat.toothChart`, `feat.perioChart`). This lets us sell/limit at the widget level, gate trials, and enforce fair-use — Kill Bill (the recurring/entitlement brain) holds the subscription→entitlement mapping; the app reads flags, never prices.

**Trials & upgrades:** a pack can be `status=trial` (time-boxed entitlement) so the preview in onboarding runs on real data; conversion just flips status and starts the meter. Downgrade suspends the flag and hides the nav/widget but retains the canonical data (no destructive deletion), so re-enabling is instant.

---

### 5. Authoring a new pack cheaply

A pack is a PR of JSON, reviewed like content — not a release of the app.

**Light pack (hours to a day), zero code:**
1. Author `PackManifest` JSON: intake `FormSchema` (JSON Schema + UI hints), `NoteTemplate`s (sections + which shared observations to pin), `ServiceCatalogItem`s (PKR, tax class), `OrderSet`s, consent forms.
2. Declare `Pack` header: id/flag, tier=LIGHT, `widgetIds:[]`, deps/bundles, entitlements.
3. Validate against schema (CI lints: every SKU has a tax class, every template's pinned observation has an `ObservationDef`, no dangling widgetId).
4. Publish version → available in the picker. No app deploy needed if manifests are data-served.

**Heavy pack (adds a widget, but reuse-first):**
- If an existing widget covers it in a new mode → it's really a Light pack with `widgetConfig` (e.g. Optometry = EyeExamPanel reduced mode). No new component.
- If genuinely net-new → build one `ClinicalWidget` implementing the 4-method contract (`requires`, `dataContracts`, `toObservations`, `fromObservations`), register it, add its narrow tables as an additive nullable migration to the base app, and reference `widgetId` from the manifest. That single widget is then reusable by sibling packs via config.

**Tooling that keeps it cheap:**
- **Pack schema + CI validator** (the JSON is typed; bad packs fail the PR, not production).
- **Pack authoring/preview harness** — render a pack's chart + invoice against synthetic data before publish (also powers the onboarding preview).
- **Semver + data migrations** so pack edits ship independently of app releases and upgrade per-tenant with a diff view.
- **Reuse library** (shared widgets, shared scored-instrument engine, shared flowsheet, shared photo/consent, laterality/anatomy axis) — new specialties compose these, so the marginal pack is mostly content. The discipline "everything is config on the shared core EXCEPT one reusable component per cluster" is enforced structurally: to add a component you must justify it can't be a mode of an existing one.

**Net:** ~all specialties in the catalog land as JSON packs on one canonical model; the only code ever written is the small, deliberately-shared widget set (odontogram, antenatal card, refraction/audiogram panels, growth chart, IVF manager, MSK suite) — each funded once by its cluster and reused across every pack in it. No forks, no branches, one data model, one billing/entitlement engine.



---



# Part III — Pack Specifications by Specialty

## Dental / Orthodontics

> **Cluster: Dental / Orthodontics** — Health OS Specialty Pack design. Two packs: **General Dental** (flagship HEAVY, P0) and **Orthodontics** (HEAVY add-on that extends the dental pack, P1). Both ride the shared clinical core (EMR, appointments, billing, inventory, imaging, consent) — the only genuinely new engineering is the **tooth-level clinical data model + odontogram/perio component**, which both packs share. Pakistan-first (PKR, outpatient, FDI notation).

---

## Why dental is a P0 pack for Pakistan

Dentistry is one of the most common **standalone** clinic types in Pakistan — a single BDS graduate with a chair, autoclave, and an OPG/RVG referral is a complete business. Dental caries prevalence nationally is **~56.6%** (Sindh ~59%, Punjab ~55%), so demand is structural and outpatient-heavy. A fresh BDS earns PKR 40k–80k/mo employed; with 3–5 years and an own practice, PKR 100k–300k/mo — i.e. thousands of solo/2-chair private practices that are exactly our Solo/Specialty edition buyers. The catch: **general clinical EMRs are unusable for dentists** because dentistry is organised per-tooth, per-surface, per-quadrant, not per-encounter-diagnosis. That per-tooth model is the one thing we must build; everything else is config on the shared core. This makes Dental the highest-leverage second vertical after aesthetic/derma.

---

## Pack 1 — General Dental (HEAVY, P0)

### What is CONFIG vs NEW COMPONENT
| Layer | Source | Notes |
|---|---|---|
| Patients, appointments (with chair/operatory as a resource), billing, inventory, consent e-sign, imaging store, SOAP notes | **Shared core (config only)** | Add operatory/chair as a schedulable resource type; dental consumables (composite, GP points, burs, LA carpules) as inventory SKUs |
| Intake fields, note templates, procedure catalog, order sets, dental consent forms | **Pack content (JSON/seed data)** | Pure configuration + entitlement flag `pack.dental` |
| **Odontogram (tooth chart), periodontal chart, tooth-level treatment plan** | **NEW shared component** (`ToothChart` / `PerioChart`) | The only real engineering. Writes to a new `tooth_finding` / `perio_measurement` table keyed to the canonical patient. Shared by dental + ortho |

The tooth-level model is the wedge: one new component + one new table, reused by every dental sub-discipline (endo, perio, prostho, ortho, oral surgery) so we never fork.

### Intake / specialty fields (config on shared intake engine)
- **Chief dental complaint** (pain / swelling / bleeding gums / broken tooth / cosmetic / routine check-up), **pain scale (0–10)**, **onset & triggers** (hot/cold/sweet/spontaneous/on-biting)
- **Dental history**: last visit, prior extractions/RCT/ortho, denture/implant/crown history
- **Habits**: paan/gutka/naswar/betel-nut use (high-value in PK — oral-cancer & staining risk), smoking, bruxism, thumb-sucking (peds/ortho)
- **Medical red-flags for dentistry**: bleeding disorders/anticoagulants, diabetes (perio/healing), cardiac (endocarditis prophylaxis), pregnancy, drug allergy (esp. penicillin/LA), hepatitis B/C status (infection-control relevant in PK)
- **Oral hygiene**: brushing frequency, fluoride exposure, prior scaling date
- Notation preference default = **FDI two-digit (ISO 3950)** — Pakistan/Commonwealth standard; support Universal & Palmer as a display toggle

### Note / SOAP templates (config)
Seeded template library, each pre-wired to auto-pull the odontogram snapshot:
1. **New patient dental exam** (extra-oral, intra-oral soft tissue, full-mouth charting, perio screening/BPE, occlusion, radiographic findings)
2. **Emergency / pain visit** (localised — tooth #, diagnosis, tx done, Rx)
3. **Scaling & polishing / hygiene recall**
4. **Restoration / filling** (tooth #, surfaces MODBL, material, shade, LA used)
5. **Root canal (RCT)** — multi-visit: canal count, working length, files, obturation
6. **Extraction / minor oral surgery** (tooth #, forceps/surgical, sutures, post-op instructions)
7. **Crown & bridge / prostho** (abutments, shade, impression → lab, cementation)
8. **Denture** (complete/partial, jaw registration, try-in, delivery)
9. **Pediatric** (fissure sealant, fluoride varnish, pulpotomy, SS crown)
10. **Post-op review**

### Service / procedure catalog + pricing (config; PKR indicative private-clinic ranges)
Catalog is a seed dataset with **dental procedure codes** (map to ADA CDT where useful, but PK clinics bill by procedure name — codes optional). Every line is per-tooth or per-arch where relevant.

| Procedure | Typical PKR (private) | Billing unit |
|---|---|---|
| Consultation / check-up | 500–2,000 | visit |
| Scaling & polishing (full mouth) | 2,000–6,000 | arch/full-mouth |
| Composite filling | 2,000–6,000 | per tooth/surface |
| Amalgam filling | 1,500–3,500 | per tooth |
| Root canal (RCT) anterior | 8,000–15,000 | per tooth |
| RCT molar (3–4 canal) | 12,000–30,000 | per tooth |
| Post & core | 4,000–8,000 | per tooth |
| PFM crown | 8,000–20,000 | per unit |
| Zirconia crown | 20,000–45,000 | per unit |
| Simple extraction | 1,500–4,000 | per tooth |
| Surgical / wisdom-tooth extraction | 6,000–20,000 | per tooth |
| Complete denture (per arch) | 25,000–60,000 | per arch |
| Removable partial denture | 15,000–40,000 | per arch |
| Dental implant (fixture + crown) | 80,000–250,000 | per implant |
| Teeth whitening (in-office) | 15,000–40,000 | course |
| Fissure sealant / fluoride | 1,000–3,000 | per tooth/visit |
| **Braces / ortho (metal, full case)** | 80,000–200,000 | case (see Ortho pack) |

Supports **package/course pricing** (whitening, full-mouth rehab, ortho case) and **deposit-first booking** for high-value items (implants, ortho) — reuses the platform's deposit/No-Show-Protection SKU.

### Common order sets (config)
- **RCT order set**: RVG (pre-op → working-length → post-obturation), LA, NSAID + antibiotic Rx template (amoxicillin/metronidazole with penicillin-allergy alt), follow-up appt +7d
- **Extraction order set**: pre-op periapical/OPG, LA, post-op analgesia + antibiotic, gauze/suture note, review +5–7d
- **Implant order set**: OPG/CBCT referral, bone assessment, surgical stent note, staged appts (fixture → healing → crown), consent
- **New-exam order set**: OPG (if indicated) + BPE/perio screen + scaling recommendation
- **Prescription templates**: common dental Rx (amoxicillin, metronidazole, ibuprofen, chlorhexidine mouthwash, LA) — reuses shared e-Rx / drug dictionary (DRAP-mapped)

### Dental imaging (config on shared imaging module + one dental viewer nicety)
- **OPG (panoramic)** and **RVG / intra-oral periapical & bitewing** ingested via the shared imaging/PACS layer (dcm4chee-backed for DICOM; JPEG/PNG for RVG sensors that export flat images)
- **Per-tooth image linkage**: click a tooth on the odontogram → see its RVG/periapical history chronologically. This binding lives in the new tooth component (small addition), not a separate PACS build
- CBCT referral tracking for implants/ortho; most PK solo clinics **refer out** for OPG/CBCT, so support "external imaging received" attachments as first-class

### Consent forms (config — shared e-consent + e-sign)
Seeded, English-only (per house style), tablet-signable: **extraction, RCT, crown/prosthesis, implant surgery, LA/sedation, whitening, ortho treatment (incl. relapse/retention wear), pediatric treatment (guardian), radiograph consent, financial/treatment-plan acceptance**. Reuses the platform's consent engine + PDF archive.

### The specialty widget (why HEAVY) — `ToothChart` + `PerioChart`
A single reusable clinical component, the only bespoke build:
- **Odontogram**: adult (32) + primary (20) dentition, FDI/Universal/Palmer toggle, click-a-tooth / click-a-surface (M-O-D-B-L) to record **conditions** (caries, restoration by material, missing, RCT-treated, crown, implant, impacted, mobile) with color-coded status and **existing vs planned vs completed** states.
- **Charting → plan → bill in one gesture**: marking a tooth as needing a filling drops a line into the tooth-level **treatment plan** (phased, by tooth/quadrant, with per-tooth cost) which posts straight to the shared billing catalog on completion. This closes the loop general EMRs can't.
- **Periodontal chart**: 6-point pocket depths, recession, bleeding-on-probing, mobility, furcation; visual perio map + **visit-over-visit comparison** (hygienist charts → feeds dentist plan).
- **Tooth-image binding**: tooth ↔ RVG/OPG history.
- Persists to `tooth_finding` / `perio_measurement` / `dental_treatment_plan_item` tables on the canonical patient — so reports, revenue-share, and ortho all read the same source of truth.

---

## Pack 2 — Orthodontics (HEAVY add-on, P1)

Ortho is a **sub-specialty pack layered on Dental**, not a separate product. It reuses the odontogram, patients, billing, imaging, and consent, and adds a long-running **case + appliance timeline** that general dental notes don't model. Priority **P1** (smaller installed base than general dentistry, but high case value → strong revenue per tenant). Enable with `pack.dental` + `pack.ortho`.

### Additional intake (config)
- Malocclusion class (**Angle Class I/II div1&2/III**), overjet/overbite (mm), crossbite, crowding/spacing, midline shift, molar/canine relationship
- Growth/skeletal (esp. peds): **thumb-sucking, tongue-thrust, mouth-breathing** habits; hand-wrist / growth stage note
- Appliance preference (metal / ceramic / **clear aligner** / lingual), estimated treatment duration

### Note templates (config)
Ortho consult & records, **bonding (bracket placement)**, adjustment/wire-change visit, **debonding**, retention/retainer delivery & recall, aligner-tray issue visit, emergency (loose bracket/poking wire).

### Procedure / pricing catalog (config; PKR indicative)
| Item | Typical PKR | Unit |
|---|---|---|
| Ortho consult + records (photos, models, ceph) | 3,000–8,000 | one-off |
| Metal braces — full case | 80,000–200,000 | case (installments) |
| Ceramic braces — full case | 150,000–300,000 | case |
| Clear aligners (Invisalign-type) | 250,000–600,000+ | case |
| Monthly adjustment | 2,000–5,000 | per visit |
| Retainer (per arch) | 8,000–20,000 | per arch |
| Debonding | included/5,000 | case |

Ortho billing is **installment/case-based** — reuse the platform's plan/subscription + partial-payment ledger; each monthly adjustment auto-releases a milestone payment.

### Order sets (config)
- **Records order set**: OPG + **lateral cephalogram** + intra/extra-oral photo series (8-photo standard) + study models/scan
- **Case start**: separators → bands/bonding → wire sequence schedule (0.014 NiTi → … → SS) with auto-generated recurring monthly appts
- **Finishing/retention**: debond → retainer impression/scan → 6/12-month retention recalls

### Ortho-specific widget needs (extends the dental component)
- **Bracket / appliance map** on the odontogram: which teeth bonded/banded, bracket prescription, current archwire, elastics — updated each visit.
- **Treatment timeline**: bond date → wire changes → debond → retention, with progress **photo series** at each phase (reuses the aesthetic pack's before/after photo timeline — nice cross-pack reuse).
- **Cephalometric analysis**: full tracing (Dolphin-style) is out of scope for v1; support **storing ceph images + key manual measurements (SNA/SNB/ANB, etc.) as fields**, and integrate with a specialist ceph tool later if a tenant needs it. This keeps ortho HEAVY-but-bounded — the reused pieces (odontogram, photo timeline, installment billing) carry most of the weight.

---

## Shared-core tie-back (summary)
- **Pure config (no code):** all intake fields, SOAP templates, procedure catalog + PKR pricing, order sets, Rx templates, consent forms → seed data behind entitlement flags `pack.dental` / `pack.ortho`.
- **Reused platform modules:** patients, appointments (chair/operatory as resource), billing (per-tooth line items, packages, installments, deposit-first), inventory (dental consumables), e-consent/e-sign, imaging/PACS (OPG/RVG/CBCT), e-Rx + DRAP drug dictionary, revenue-share, reports.
- **The only NEW engineering (justifies HEAVY):** one reusable `ToothChart`/`PerioChart` clinical component + `tooth_finding` / `perio_measurement` / `dental_treatment_plan_item` tables on the canonical patient. Ortho adds fields + reuses the aesthetic photo-timeline; it does **not** need its own separate build.

## Dermatology + Aesthetic/Cosmetic + Plastic surgery

# Specialty Pack Cluster: Dermatology + Aesthetic/Cosmetic + Plastic Surgery

**Context.** This cluster is Health OS's founding wedge. The heavy aesthetic components already exist on the shared core: **before/after photo capture + digital consent, structured skin assessment, injectable/treatment body-maps, packages & memberships, deposit-first booking.** So this document does NOT re-spec those. It details **what remains** to turn the current aesthetic build into three cleanly separated, entitlement-gated packs — and where a genuinely new clinical component is required versus pure config/content on the canonical model.

**Shared-core recap (all three packs sit on this — never forked):** patient/encounter/observation model, appointment engine, billing + PKR catalog/pricing, inventory (feeds the injectable/consumable ledger), photo/document store with consent, note/template engine (SOAP + custom), order-set engine, membership/package engine. A "pack" = entitlement flag + intake field-set + note templates + service catalog + order sets + (only when Heavy) one specialty widget.

---

## 1. Aesthetic / Cosmetic Pack — HEAVY (components built), P0

**Status: the flagship, ~85% built.** Tiered Heavy because it *requires* custom clinical components (before/after+consent, injectable maps, skin assessment) — but those already ship. Remaining work is almost entirely **config + catalog + template content**, plus one small consumable-ledger tie-in.

**Intake fields (config on canonical model):** Fitzpatrick skin type (I–VI), skin concerns checklist (pigmentation, acne scarring, laxity, fine lines, hair reduction, hyperhidrosis), prior aesthetic history (fillers/toxin/laser + dates + brand/lot), keloid/scarring tendency, isotretinoin in last 6 months (laser/peel contraindication flag), pregnancy/lactation flag, cold-sore/HSV history (peri-oral filler flag), realistic-expectations/photo-consent captured. All are **field-set config**, no code.

**Note templates (content):**
- **Aesthetic consultation note** — concern → assessment → recommended plan → package quote.
- **Injectable treatment record** — toxin units per site + filler ml per site (**binds to the existing injectable body-map widget**), batch/lot + expiry (pulls from inventory).
- **Energy-device session note** — device, fluence/energy, spot size, passes, endpoint, cooling.
- **Chemical peel note** — agent + %, coats, frost grade, neutralisation, post-care.
- **Thread-lift / PRP / mesotherapy** short-form notes.

**Service / procedure catalog (PKR, config — grounds to live 2026 market pricing):** Botox/toxin per-area (PKR 20k–65k), dermal filler per syringe (25k–80k), laser hair removal by zone (upper lip/underarm ~2k–6k, half-leg ~6k–18k, full-leg/back ~15k–40k), HydraFacial classic→platinum (8k–40k), fat-dissolving injection (15k–30k), HIFU/RF skin-tightening, chemical peels (superficial→medium), PRP/microneedling/mesotherapy, threads, consultation fee (3k–5k). Sold both à-la-carte and as **packages/memberships** (existing engine) — e.g. 6-session laser course, monthly facial membership.

**Common order sets (config):** "New injectable patient" (consent + photo + baseline Fitzpatrick + lot capture), "Laser course start" (patch test + Fitzpatrick + isotretinoin check + photo series), "Peel prep" (priming regimen + sun-avoidance counselling).

**Specialty widgets (already built — reused, not rebuilt):** before/after paired photo timeline + consent, injectable/treatment body-map, structured skin assessment, package/membership manager.

**What remains (the actual deliverable):** (a) package the above as an entitlement-flagged pack manifest; (b) load the PKR catalog + templates as seed content; (c) **one small new tie-in — a per-treatment consumable/injectable ledger** decrementing inventory by lot/expiry and surfacing cost-of-goods per session (flagged P0 in competitor intel). Everything else is configuration.

---

## 2. Dermatology (Medical/Clinical) Pack — HEAVY, P1

**Status: the biggest net-new build in the cluster and the highest-volume specialty in Pakistan.** Medical derma is distinct from aesthetic: it needs **validated severity-grading calculators** and a **phototherapy dosing ledger** — genuine clinical components, not config. Pakistani derma OPD is dominated by eczema (~31% of new cases), infections (~28%), acne (~11%), and pigmentary disorders incl. melasma/vitiligo (~3.8%); population-level, fungal disease, scabies, acne (2.6%) and atopic dermatitis (1.8%) lead — so the grading set must center on **acne, eczema, psoriasis, melasma, vitiligo**.

**Intake fields (config):** Fitzpatrick type, lesion distribution/body-region checklist, itch severity (NRS 0–10), duration/onset, prior topical/systemic derma therapy, phototherapy history + cumulative prior dose, atopy history (asthma/rhinitis for eczema), family history (psoriasis/atopy), occupational/contact exposures, drug-reaction history.

**Note templates (content — dx-specific, the core ask):**
- **Acne dx + grading note** — lesion counts (comedones/papules/pustules/nodules) → **GAGS score** + severity band + regimen (topical retinoid ± BPO ± antibiotic ± isotretinoin pathway).
- **Eczema/atopic dermatitis note** — **EASI / SCORAD** grading, trigger review, emollient + TCS/TCI step plan.
- **Psoriasis note** — **PASI** (+ BSA + PGA), type (plaque/guttate/etc.), phototherapy/systemic eligibility.
- **Melasma note** — **MASI/mMASI**, Wood's-lamp epidermal vs dermal, triggers, treatment ladder.
- **Vitiligo note** — VASI/BSA, segmental vs non-segmental, phototherapy candidacy.
- **General derma SOAP** with morphology/distribution structured fields; **fungal/scabies** short-forms (top volume in PK).

**Service / procedure catalog (PKR, config):** dermatology consult + follow-up, cryotherapy (per lesion/wart), electrocautery/curettage, intralesional steroid/keloid injection, skin biopsy (punch/shave/excisional) + histopath send-out, patch testing panel, Wood's-lamp/dermoscopy exam, comedone extraction, **phototherapy per-session (NB-UVB)** + course packages, KOH/skin-scraping microscopy.

**Common order sets (config):** "Acne — moderate" (topical combo + labs before isotretinoin: LFTs/lipids/βhCG), "Suspected fungal" (KOH + topical/systemic antifungal), "Psoriasis — phototherapy start" (baseline photos + MED assessment + NB-UVB schedule), "Chronic urticaria workup", "Isotretinoin monitoring" (monthly βhCG + LFT/lipid recall).

**Specialty widget (HEAVY — genuinely new component):**
- **Severity-grading calculator suite** — GAGS / EASI / SCORAD / PASI / MASI / VASI, each writing a discrete scored **Observation** on the canonical model, plotted longitudinally so response-to-treatment is a trend line. This is a reusable scoring engine (one component, config-driven scale definitions), not six separate builds.
- **Phototherapy dosing ledger** — per-patient NB-UVB course: starting dose (by Fitzpatrick or %MED, ~150–400 mJ MED range), per-visit increment logic (e.g. vitiligo +50 mJ/cm²/visit), **cumulative J/cm² tracking**, missed-visit dose-adjustment rules, session counter, erythema/endpoint capture, lifetime-dose safety alerting. Ties to appointment + billing (per-session charge) and to inventory (lamp-hours if tracked). This has no equivalent in the aesthetic build and is the single strongest justification for the Heavy tier.

**Config vs new:** intake/catalog/order-sets/templates = config + content; **grading-calculator suite + phototherapy ledger = new shared components** (reusable by any tenant, gated by the derma entitlement).

---

## 3. Plastic / Reconstructive & Mohs Surgery Pack — HEAVY, P2

**Status: narrow, documentation-heavy niche; lowest priority for Pakistan-first outpatient reality.** Standalone plastic/Mohs clinics are uncommon vs. derma/aesthetic volume, and much overlaps the aesthetic pack (the cosmetic-surgery consult, before/after, packages all reuse existing components). The genuinely distinct, un-built need is **surgical/operative documentation** — Mohs stage mapping and reconstruction operative notes — which is why it is Heavy, but P2/anchor-customer-driven rather than a default seed pack.

**Intake fields (config):** lesion site + measured dimensions, biopsy-proven diagnosis (BCC/SCC/melanoma/DFSP), prior skin-cancer/recurrence history, anticoagulation status, smoking status (flap-viability flag), ASA class / anaesthesia-fitness, comorbidities affecting healing (diabetes), photographic border documentation captured.

**Note templates (content):**
- **Pre-op / surgical consult note** — indication, why standard excision insufficient, repair options discussed + consent (mirrors the documentation carriers require: rationale for Mohs and for flap/graft repair).
- **Mohs operative note** — per **stage**: map orientation, margins taken, sections read, residual-tumour status, until clear; total stages + final defect size.
- **Reconstruction operative note** — repair type (primary closure / adjacent tissue transfer / flap / **graft split- vs full-thickness**), wound depth (superficial/deep/subfascial), sutures, layered closure — these fields are exactly what drive correct coding and medical-necessity documentation.
- **Cosmetic-surgery consult** (rhinoplasty/blepharoplasty/lipo/breast) — reuses aesthetic consult + before/after + package quote.
- **Post-op / wound-review + complication note.**

**Service / procedure catalog (PKR, config):** consultation, excisional surgery by size/site, Mohs (per-stage pricing), reconstruction (flap/graft tiers), scar revision, cosmetic-surgery procedures (surgeon-quoted, package/deposit engine), dressing/suture-removal follow-ups, histopathology send-out.

**Common order sets (config):** "Skin-cancer excision" (pre-op photos + path form + consent + anticoag check), "Mohs day" (staged-tissue tracking + frozen-section log), "Post-op wound care" (dressing schedule + suture-removal recall + complication watch).

**Specialty widget (HEAVY — new, but narrow):**
- **Mohs stage-mapping tool** — a digital tissue map recording orientation, margins/sections per stage, and clear/positive status across stages, producing the staged operative record. Optional; only tenants running true Mohs need it.
- Reconstruction/flap fields are largely a **structured operative-note template** (config) rather than a bespoke widget; the surgical body-region annotation can **reuse the aesthetic body-map component** rather than build anew.

**Config vs new:** most of this pack is config + surgical-note templates riding on the existing consult/photo/consent/package infrastructure; the **only net-new component is the Mohs stage-mapping tool**, justified solely for anchor tenants — hence P2.

---

## Cross-pack summary

| Pack | Tier | Priority | Net-new build | Reuses (already built) |
|---|---|---|---|---|
| Aesthetic/Cosmetic | Heavy | P0 | Consumable/injectable lot ledger (small) | Before/after+consent, injectable map, skin assessment, packages/memberships |
| Dermatology (medical) | Heavy | P1 | Grading-calculator suite + phototherapy dosing ledger | Photo store, note engine, Fitzpatrick, order-sets |
| Plastic/Mohs | Heavy | P2 | Mohs stage-mapping tool | Aesthetic consult, before/after, body-map, packages, op-note templates |

**Sequencing:** finish P0 aesthetic pack packaging (catalog + consumable ledger) → build P1 derma grading/phototherapy components (highest PK patient volume, biggest clinical differentiator) → P2 Mohs only when an anchor plastic/Mohs tenant signs. Fitzpatrick, catalogs, intake, and order-sets are shared config assets reused across all three, so the incremental cost of each additional pack is mostly content, not code.

## Sources
- Springer / Archives of Dermatological Research — Burden of dermatologic diseases in Pakistan
- PMC — Pattern of skin diseases, tertiary care hospital, Lahore
- IJDVL — Scoring systems in dermatology (GAGS/PASI/EASI/MASI)
- oneSkin — PASI / EASI / MASI calculators
- DermNet NZ — UVB phototherapy protocols
- UMass — Vitiligo NB-UVB treatment protocol
- CMS — Billing & Coding: Mohs Micrographic Surgery (documentation reqs)
- Royal Cosmetic Surgery / Aesthedoc / SL Aesthetics — Pakistan 2026 aesthetic pricing

## Obstetrics & Gynaecology + Fertility/IVF

# Cluster: Obstetrics & Gynaecology + Fertility/IVF — Specialty Packs

This cluster is one of the highest-demand outpatient segments in Pakistan. Infertility prevalence is reported around **22%** (roughly one in seven couples) ([Awareness Regarding Causes of Infertility, Karachi tertiary care](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7233490/)), and IVF infrastructure is mature and expanding — Australian Concept alone runs **15+ branches** since 1998 ([acimc.org](https://acimc.org/)). The standalone "Gynae & Obs" clinic run by a single FCPS gynaecologist is one of the most common private clinic types nationwide, while ART/IVF centres are a distinct, higher-acuity vertical.

I decompose the cluster into **three packs** so a solo gynae clinic, a hospital OB/Gyn department, and a dedicated fertility centre each light up only what they need on the shared core:

1. **Obstetrics & Antenatal Care** — HEAVY (P0)
2. **Gynaecology** — LIGHT (P1)
3. **Fertility / IVF (ART)** — HEAVY (P1)

They compose: a typical Pakistani standalone clinic enables **Obstetrics + Gynaecology together**; an IVF centre enables all three; a hospital enables all three as one department bundle. Because they sit on ONE canonical data model, LMP/cycle data entered in Gynaecology flows into an Obstetrics pregnancy episode or an IVF cycle without re-entry.

---

## Shared-core mapping (applies to all three packs)

What is **pure config/content** (no code) vs what genuinely needs a **new clinical component**:

| Capability | Shared core reuse | Pack layer |
|---|---|---|
| Patient demographics, MRN, next-of-kin | Core patient registry | + `sex/gender`, `parity` summary badge (config field) |
| Encounters / visits | Core appointment + encounter engine | Visit **types** = config (ANC visit, follow-up, scan, OPU, ET) |
| Vitals (BP, wt, pulse, temp) | Core observations model | Reused verbatim; only display grouping differs |
| Notes | Core SOAP note engine | Templates = content (config) |
| Orders / results (labs, imaging) | Core order-set + results engine | Order sets = config; lab analytes = config |
| Billing / pricing (PKR) | Core service catalog + invoicing | Service/procedure catalog rows = config |
| Documents (consents, cards) | Core document/print engine | Print layouts = templates |
| **Longitudinal episode** (pregnancy, cycle) | **Needs new "episode" primitive** | Episode-of-care object grouping many encounters |
| **ANC card grid, partogram, IVF cycle board** | — | **New clinical widgets (HEAVY)** |

The one cross-cutting new primitive worth building once and reusing across all three packs is a generic **Episode-of-Care** object (a durable container that threads many encounters + a structured longitudinal dataset). "Pregnancy," "IVF cycle," and even a "menstrual/subfertility workup" are all instances. Widgets below render views over this primitive.

---

## Pack 1 — Obstetrics & Antenatal Care (HEAVY, P0)

The flagship. An antenatal record is inherently a **visit-wise longitudinal grid**, not a set of independent SOAP notes — the core note engine cannot represent it, which is what forces HEAVY.

### Intake / specialty fields (config on core patient + episode)
- **Booking/registration:** LMP (with "sure/unsure" + cycle regularity), EDD (auto by Naegele + editable if dated by scan), gestational age auto-calculated at every visit, gravida / para / abortions / living (GPAL), blood group & Rh, husband's blood group, consanguinity.
- **Risk flags:** prior C-section (count), prior PPH, prior stillbirth/IUD, GDM/PIH history, thyroid, cardiac, hepatitis B/C status, height, booking weight/BMI.
- **Obstetric ultrasound fields (per scan):** GA by scan, BPD, HC, AC, FL, EFW (auto), placental location & grade, liquor/AFI, presentation, fetal cardiac activity, number of fetuses, cervical length, Doppler (umbilical/MCA PI, if indicated), anomaly-scan checklist.
- **Every-visit dataset:** GA, weight, BP, pallor/oedema, **fundal height (SFH cm)**, presentation, lie, fetal heart rate, fetal movements, urine dipstick (protein/sugar), Hb,随访 next-visit date, TT/Tdap status, IFA/calcium compliance.

EDD/GA math follows Naegele's rule from LMP ([EDD & POG calculation, PSM](https://ihatepsm.com/blog/calculation-expected-date-delivery-edd-and-period-gestation-pog)); fundal height is the symphysis–fundus distance tracked serially ([Antenatal care, PSM](https://ihatepsm.com/blog/antenatal-care)).

### Note templates (content/config)
- ANC booking note; ANC follow-up (auto-fills GA/SFH/FHR from grid); anomaly-scan report; growth-scan report; admission-for-delivery note; labour/delivery summary (mode, EBL, Apgar, sex, weight, repair); postnatal day-1 & day-7; postnatal 6-week check; operative note template (LSCS).
- WHO ANC-8 contact schedule baked in as visit reminders.

### Service / procedure catalog examples (PKR — indicative private)
| Service | Typical PKR |
|---|---|
| ANC booking + card | 2,000–4,000 |
| ANC follow-up visit | 1,000–2,500 |
| Dating/viability scan | 2,500–4,500 |
| Anomaly scan (Level II) | 5,000–9,000 |
| Growth + Doppler scan | 4,000–7,000 |
| Normal vaginal delivery (SVD) | 40,000–120,000 |
| LSCS (package) | 120,000–350,000 |
| NST / CTG | 1,500–3,000 |

### Common order sets (config)
- **Booking panel:** CBC, blood group & Rh, HbA1c/OGTT, urine R/E + C/S, HBsAg, Anti-HCV, HIV, VDRL, rubella (optional), TSH, dating scan.
- **28-week panel:** CBC/Hb, OGTT (75g), Rh antibody if Rh-neg, anti-D schedule.
- **Third-trimester:** CBC, growth scan, GBS (optional), pre-op labs if elective LSCS.
- **PIH/pre-eclampsia work-up:** CBC, LFT, RFT, uric acid, urine protein/creatinine, LDH.

### Specialty widget (HEAVY): **ANC Card + Partogram**
Two linked components over the Pregnancy episode:

1. **Antenatal Card grid** — a spreadsheet-style visit-wise view: rows = visits, columns = GA / date / weight / BP / SFH / presentation / FHR / Hb / urine / next-visit. Sparklines for SFH-vs-GA (deviation flags), BP trend (pre-eclampsia alert), and weight gain. One-tap "new visit" pushes vitals to the core observations model; card is printable as a patient-held pregnancy passport — a form shown to improve record completeness ([ANC follow-up passport, Almanagil](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12718479/); [digital ANC in Nepal](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11911671/)).
2. **Partogram / Labour Care Guide** — intrapartum charting: cervical dilatation (active phase from 5 cm), fetal head descent, FHR, contractions (frequency/duration), amniotic fluid, moulding/caput, maternal vitals, oxytocin, with alert/action thresholds per the **WHO Labour Care Guide** ([WHO LCG User's Manual](https://iris.who.int/bitstream/handle/10665/337693/9789240017566-eng.pdf); [Advancement in Partograph, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9652267/)).

*Why not config:* both are time-series clinical charts with threshold-based visual alerting — impossible to express as a note template.

---

## Pack 2 — Gynaecology (LIGHT, P1)

Covers the general/outpatient gynae workload (menstrual disorders, PCOS, infections, contraception, menopause, screening). Deliberately LIGHT — it needs structured fields, templates, and a catalog, but **no bespoke clinical component**. The only "special" element, menstrual/cycle tracking, is served by a **config-driven structured field group + a reusable timeline** rather than a new widget (and if the tenant also runs Fertility, the IVF pack's cycle view subsumes it).

### Intake / specialty fields (config)
- Menstrual: LMP, cycle length/regularity, flow, dysmenorrhoea, IMB/PCB, menarche/menopause age.
- Obstetric summary (GPAL) — shared field group with Pack 1.
- Contraception history, Pap/HPV screening status, breast exam, sexual/marital history (culturally-sensitive fields, optional/permissioned).
- Structured exam: PV/PS findings, adnexal, cervix.

### Note templates (content)
- New gynae consult; PCOS/menstrual-disorder note; infertility initial screen (hands off to Pack 3); contraception counselling; menopause consult; colposcopy/Pap note; pre-op gynae; post-op follow-up.

### Service / procedure catalog examples (PKR)
| Service | Typical PKR |
|---|---|
| Gynae consultation | 1,500–3,500 |
| Pelvic/TVS ultrasound | 2,000–4,000 |
| Pap smear | 2,000–4,000 |
| IUCD insertion/removal | 3,000–8,000 |
| Endometrial biopsy | 5,000–12,000 |
| D&C / hysteroscopy | 25,000–80,000 |
| Colposcopy | 6,000–12,000 |

### Common order sets (config)
- **PCOS panel:** TVS, LH/FSH, testosterone, DHEAS, prolactin, TSH, fasting insulin/glucose, HbA1c, lipids.
- **AUB panel:** CBC, TSH, coagulation, TVS, endometrial biopsy.
- **Menopause/screening:** Pap/HPV, TVS, DEXA (if indicated), lipid/glucose.
- **Discharge/infection:** high vaginal swab C/S, urine R/E.

### "Widget" note
Menstrual/cycle tracking = a config field group + reuse of the generic **Episode timeline** primitive (dates on a horizontal axis). No custom component ⇒ stays LIGHT.

---

## Pack 3 — Fertility / IVF (ART) (HEAVY, P1)

The most component-intensive pack. An IVF cycle is a tightly choreographed multi-day protocol with follicle-by-follicle ultrasound tracking, hormone trend-driven dose titration, and an embryology lab dataset — none expressible on the core note/order engine. Commercial fertility EMRs converge on exactly these modules ([MedART 17-module feature list](https://meddilink.com/features); [EasyClinic IVF EMR](https://www.easyclinic.io/ivf-emr-software/); [Fertility EHR features 2026, Blaze](https://www.blaze.tech/post/fertility-ehr)).

### Intake / specialty fields (config on core + episode)
- **Couple record:** both partners linked (shared subfertility episode) — duration of infertility, primary/secondary, prior treatments/cycles & outcomes, coital/ejaculatory history.
- **Female workup:** cycle history (from Pack 2 fields), AMH, AFC, baseline FSH/LH/E2, TSH, prolactin, HSG/tubal status, ovarian reserve category.
- **Male workup:** semen analysis (count, motility, morphology, volume), hormonal profile, prior surgeries.
- **Cycle setup:** protocol (long agonist / antagonist / mild / natural), planned trigger, freeze-all vs fresh, ICSI vs conventional, PGT flag, donor flags.

### Note templates (content)
- Infertility initial assessment; ovarian-reserve counselling; cycle-plan/consent note; monitoring-visit note (auto-fills follicle counts + E2); OPU (egg-retrieval) operative note; embryo-transfer note; luteal-support plan; beta-hCG outcome; failed-cycle debrief; frozen-embryo-transfer (FET) note.

### Service / procedure catalog examples (PKR — indicative)
| Service | Typical PKR |
|---|---|
| Fertility consultation | 2,000–5,000 |
| Semen analysis | 1,500–3,500 |
| HSG | 8,000–15,000 |
| IUI cycle | 30,000–60,000 |
| **IVF/ICSI cycle (package)** | 350,000–700,000 |
| Frozen embryo transfer (FET) | 100,000–200,000 |
| Embryo/oocyte freezing (annual) | 40,000–90,000 |
| PGT-A (per embryo) | add-on, lab-dependent |

### Common order sets (config)
- **Baseline (day-2/3):** FSH, LH, E2, AMH, AFC scan, TSH, prolactin, viral screen (HBsAg/HCV/HIV — both partners), semen analysis.
- **Stimulation monitoring:** serial TVS follicle scan + E2 ± P4 ± LH (repeated per protocol day).
- **Trigger-day:** E2, P4, LH, endometrial thickness/pattern.
- **Post-transfer:** beta-hCG (day 12–14), repeat/doubling, luteal progesterone.

### Specialty widget (HEAVY): **IVF Cycle Manager**
A single board over the ART episode with three tabs:
1. **Stimulation calendar / flowsheet** — protocol timeline auto-generating scan/bloodwork days; per-day gonadotropin doses (agonist/antagonist), with E2/P4/LH **trend charts** driving dose-adjustment alerts ([EasyClinic](https://www.easyclinic.io/ivf-emr-software/); [Lifelinkr fertility EMR](https://www.lifelinkr.com/fertility-emr-integrated-tools-modern-ivf/)).
2. **Follicle tracking grid** — per-scan, per-ovary follicle-diameter cohorts (L/R rows, size-bin columns), lead-follicle & mature-count auto-tally, endometrial thickness, → trigger-readiness flag.
3. **Embryology lab board** — oocytes retrieved → MII → fertilized (2PN) → cleavage → blastocyst, with **day 0–7 grading** (Gardner grade, stage, location), fate (transfer/freeze/discard), cryo tank/cane/straw location, and outcome linkage ([MedART](https://meddilink.com/features); [Meditab fertility EHR](https://www.meditab.com/specialties/fertilityehr)).

*Why not config:* follicle cohorts and embryology pipelines are structured many-to-one datasets with lab-workflow state machines and witnessing/chain-of-custody — core orders/notes cannot model them.

---

## Bundling & rollout recommendation
- **P0 now:** Obstetrics & Antenatal Care — largest, clearest demand; ANC-card widget reuses core vitals/observations, so build cost concentrates in the grid + partogram renderer.
- **P1 next:** Gynaecology (nearly free — config only; ships alongside Obstetrics as the default "Gynae & Obs" bundle for standalone clinics) and Fertility/IVF (higher build cost, fewer but higher-value tenants).
- Build the **Episode-of-Care** primitive once; all three packs (and future specialties like oncology) reuse it.

## Pediatrics + Vaccination clinics

## Cluster: Pediatrics + Vaccination Clinics

Two closely related but distinct clinic archetypes in Pakistan. Standalone **child specialist (pediatric) clinics** are ubiquitous — pediatrics is one of the most common private outpatient specialties, and OPD child visits dominate primary care. Standalone **vaccination/immunization centers** (often EPI-linked private providers, hospital "well-baby" clinics, or pharmacy-adjacent shot centers) are also common because EPI coverage gaps mean parents pay privately for timely, complete schedules. In hospitals, both run as departments (Pediatrics + a Vaccination/Well-Baby room) enabled as packs on the shared core.

Both packs are **Heavy** — they need genuinely new clinical components (a percentile growth-chart engine and an immunization scheduler/recall engine) that cannot be expressed as templates alone. Everything else (intake, notes, catalog, order sets) is config on the shared clinical core.

Shared-core tie-back for the whole cluster:
- **Patient/EMR, appointments, billing, inventory** = shared core, unchanged. A vaccine is just an inventory SKU with lot/expiry; a growth measurement is a structured observation.
- **Config (no code):** intake field sets, SOAP/well-child templates, service/procedure catalog + PKR pricing, order sets, referral reasons, recall message templates.
- **New components (Heavy):** (1) `GrowthChartWidget` — plotting engine + percentile/z-score calculation against WHO/CDC reference tables; (2) `ImmunizationScheduler` — schedule-rule engine that computes due/overdue doses from DOB against the Pakistan EPI ruleset, drives recall, and prints the EPI card; (3) `WeightBasedDoseCalculator` — a smaller shared clinical utility usable by both packs (and later by any pack that doses by weight).

---

## Pack 1 — Pediatrics (Child Specialist Clinic)

**Tier: Heavy · Priority: P0**

The flagship child-health pack: well-child (growth/development surveillance) + sick-child (acute OPD) workflows. This is a high-volume, high-frequency specialty in Pakistan and a strong second vertical after aesthetic/derma.

### Intake fields (config — structured observation fields on the shared patient/encounter model)
- **Newborn/birth block:** birth date + **exact time of birth** (needed for neonatal age in days/hours), gestational age (weeks), birth weight, mode of delivery, APGAR (optional), NICU stay yes/no, birth order, consanguinity (parents related — clinically relevant in PK).
- **Anthropometry per visit:** weight (kg), length/height (cm), head circumference (cm, <2y), BMI (auto for ≥2y), MUAC (mid-upper-arm circumference) for malnutrition screening.
- **Feeding/nutrition:** exclusive breastfeeding / mixed / formula, weaning started (age), current diet notes.
- **Guardian/caregiver linkage:** mother & father as linked contacts, guardian phone for recall, who accompanied.
- **Newborn screening flags:** cord care, jaundice, congenital hypothyroidism/G6PD/hearing screen done (where available) — capture as yes/no/not-done with date.
- **Developmental screening:** milestone domain flags (gross motor, fine motor, language, social) captured via the milestone tool (see widget); autism screen (M-CHAT) trigger at 18–24m.
- **Allergies, past illnesses, family history** = shared-core fields, reused.

### Note templates (config — SOAP/structured templates)
- **Well-Child / Well-Baby visit** (age-banded variants: newborn, 6/10/14-week, 9-month, 15-month, 2y, 3–5y, school-age) — pre-populates expected milestones, growth plotting prompt, feeding guidance, next vaccine due, anticipatory guidance.
- **Sick-Child / Acute OPD** (fever, cough/ARI, diarrhea/dehydration assessment, ear pain) — includes danger-sign checklist (IMNCI-aligned), dehydration grading, red-flag referral prompt.
- **Follow-up / review** short template.
- **Growth faltering / malnutrition** template (SAM/MAM classification via WHZ + MUAC).
- **Newborn first visit / discharge check.**

### Service / procedure catalog + pricing (config — catalog SKUs, PKR)
Examples (typical private PK outpatient ranges; tenant edits):
- New patient pediatric consult — Rs 1,500–3,000
- Follow-up consult — Rs 800–1,500
- Well-baby / growth-and-development check — Rs 1,500–2,500
- Newborn first check-up — Rs 2,000–3,000
- Nebulization (per session) — Rs 500–1,000
- Growth-chart / development assessment (standalone) — Rs 1,000–2,000
- Developmental screening (M-CHAT/ASQ) — Rs 1,500–2,500
- Procedures: ear syringing, wound dressing, IM/IV injection administration, ORS supervision, phototherapy referral.
- Teleconsult (follow-up) — Rs 800–1,500.

### Common order sets (config — bundled orders/labs/meds)
- **Fever workup:** CBC, malaria ICT/CP, urine R/E, dengue NS1 (seasonal), typhoid (blood C/S or Widal), CRP.
- **Diarrhea/dehydration:** ORS plan A/B/C, stool R/E, zinc, oral rehydration counseling.
- **ARI/pneumonia:** weight-based amoxicillin, salbutamol, review in 48h.
- **Anemia/malnutrition:** CBC, ferritin, iron + folic acid, deworming (albendazole), dietary referral.
- **Neonatal jaundice:** total/direct bilirubin, blood group + Coombs, phototherapy referral threshold.
- Each order set is weight-aware — drug lines pull the child's latest weight through the dose calculator.

### Specialty widgets (Heavy — new components)
1. **`GrowthChartWidget`** — plots weight-for-age, length/height-for-age, weight-for-length, BMI-for-age, and head-circumference-for-age against **WHO Child Growth Standards (0–5y)** and **CDC/WHO reference (2–19y)**, sex-specific. Computes **percentile and z-score** per measurement, draws the child's trajectory across visits, flags crossing centiles / faltering / >+2 or <−2 SD. Data source = the shared observation store; the widget is a read/plot + calculation layer plus bundled reference LMS tables. Printable growth chart for parents.
2. **`WeightBasedDoseCalculator`** (shared clinical utility, first surfaced here) — takes latest weight + drug + mg/kg rule → suggested dose, formulation (syrup mg/5ml vs tab), frequency, and **max-dose cap**; integrates allergy/interaction check from the shared meds module. Reused by the vaccination pack (e.g., dose-by-weight where relevant) and any future weight-dosing specialty.
3. **Milestone tracker** (lighter — could be config-driven checklist rendered by a small component): age-banded milestone checklist (gross/fine motor, language, social) with "attained/delayed/not-assessed" and an early-intervention referral trigger; M-CHAT scoring at 18–24m.

Immunization for a pediatric clinic is delivered by **enabling the Vaccination pack's `ImmunizationScheduler` as a sub-module** — a peds clinic almost always also vaccinates, so the two packs are cross-entitled.

---

## Pack 2 — Vaccination / Immunization Clinic

**Tier: Heavy · Priority: P0**

Standalone immunization/well-baby centers and the vaccination room inside any peds or family clinic. The defining asset is the **EPI schedule engine + recall**, plus vaccine cold-chain/lot tracking.

### Intake fields (config)
- Child DOB (+ time), sex, guardian name + **phone(s) for recall/WhatsApp**, address/area.
- **EPI registration number / vaccination card number** (link to Govt EPI card / ZM eVaccs where relevant), CNIC of guardian.
- Vaccine history import: previously received doses (name, date, source) to seed the schedule when a child transfers in.
- Contraindication/precaution flags (egg allergy, immunocompromise, recent IVIG, ongoing febrile illness).
- Consent captured (guardian) per encounter.

### Note / encounter templates (config)
- **Vaccination encounter** — pre-visit screening checklist (well enough today? contraindications?), doses administered (auto-filled from due list), **site + route + lot no. + expiry** per dose, AEFI (adverse event following immunization) observation (15–30 min wait), next-due date, next appointment.
- **Catch-up / delayed schedule** template (computes catch-up plan for a late starter).
- **Travel / private-schedule vaccination** (e.g., influenza, HPV, hepatitis A, varicella, meningococcal — non-EPI paid vaccines).
- **AEFI report** template (for any adverse event, with severity + action).

### Service / procedure catalog + pricing (config)
- EPI vaccines are **free** per government program (record as Rs 0 / govt-supplied) but the **administration/service fee** and private-market vaccines are billable:
  - Vaccine administration/service fee — Rs 300–800 per visit.
  - Private/optional vaccines (cost varies by brand, tenant-priced): Influenza, Hepatitis A, HPV, Varicella, MMR (private), Meningococcal, Typhoid conjugate (private), Rabies (post-exposure course), Hepatitis B adult.
  - **Full private schedule package** (bundled multi-visit plan) — package SKU.
  - Cold-chain/home vaccination visit surcharge.
- Each vaccine is also an **inventory SKU with lot + expiry + storage temp**, so administration decrements stock and enforces lot/expiry — pure shared-inventory reuse.

### Common order sets (config — "schedule sets" rather than lab orders)
Modeled on the **Pakistan EPI schedule** (12 antigens, 6 visits, birth → 15 months):
- **At birth:** BCG (ID), OPV-0 (oral), Hep B birth dose.
- **6 weeks:** OPV-1, Pentavalent-1 (DTwP+HepB+Hib), PCV-1, Rota-1.
- **10 weeks:** OPV-2, Penta-2, PCV-2, Rota-2.
- **14 weeks:** OPV-3, IPV, Penta-3, PCV-3.
- **9 months:** Measles-1 (MCV-1); **Typhoid conjugate (TCV)** where provincially introduced.
- **15 months (2nd year):** Measles-2 (MCV-2).
- **Maternal:** Tetanus/Td for pregnant women (TT schedule) — captured on the mother's record.
- Non-EPI optional sets (private): MMR, Varicella, Hep A, HPV (adolescent girls), Influenza (annual), Meningococcal, Rabies PEP.
These sets are **configuration/content** — versioned rules the `ImmunizationScheduler` consumes, so provincial variants and schedule updates are data, not code.

### Specialty widget (Heavy — new component)
**`ImmunizationScheduler`** — the core of the pack:
- **Schedule-rule engine:** from DOB + doses-already-given, computes the child's personalized due/overdue list against the active EPI ruleset (with min-interval and catch-up logic for late starters).
- **Due / overdue dashboard & recall:** clinic-wide list of children due this week / overdue, feeding the shared notification module for **WhatsApp/SMS reminders** (ties into the platform's Meta WhatsApp Cloud API layer) — directly addresses Pakistan's biggest immunization problem (dropout / incomplete schedules; only ~47% of 12–23m children fully vaccinated).
- **Lot & cold-chain capture:** per administered dose records vaccine, lot, expiry, site, route; decrements inventory; supports AEFI linkage.
- **EPI card generator:** prints/ő shares a digital vaccination card and next-due slip for parents; optional map/export toward Govt EPI (eVaccs) formats.
- **Coverage/dropout reporting:** DTP1→DTP3 dropout, fully-immunized-child rate — reuses the shared reports module, fed by scheduler events.

Reuses `WeightBasedDoseCalculator` from the peds pack only where dose-by-weight applies (mostly fixed pediatric doses, so light use). Everything else — inventory, notifications, billing, appointments, reports — is shared core.

---

### Build/reuse summary
| Element | Config on shared core | New component (Heavy) |
|---|---|---|
| Intake field sets, templates, catalog, pricing, order/schedule sets, recall message copy | ✅ | |
| Vaccine as inventory SKU (lot/expiry/temp) | ✅ (inventory) | |
| WhatsApp/SMS recall | ✅ (notification layer) | |
| Growth percentile plotting + z-score | | `GrowthChartWidget` |
| EPI due/overdue engine + recall + EPI card | | `ImmunizationScheduler` |
| Weight-based dose calculation | | `WeightBasedDoseCalculator` (shared utility) |
| Milestone/M-CHAT checklist | mostly config | small render component |

Both packs are **P0** because pediatrics is a top-volume standalone specialty in Pakistan and the immunization scheduler/recall is a differentiated, high-value engine that also strengthens the hospital "Pediatrics + Well-Baby department" story — all on one canonical data model with no fork.

## Ophthalmology/Optometry + ENT

# Specialty Pack Cluster: Ophthalmology / Optometry + ENT

All three packs in this cluster are **HEAVY** in principle, because a plain SOAP note cannot represent per-eye refraction grids, IOP trends, slit-lamp/fundus structured findings, or an audiogram. But the heavy weight is concentrated in **two shared clinical widgets** — the *Eye Exam Panel* and the *ENT Exam Panel*. Once those two components exist on the shared core, Optometry becomes a near-Light pack that reuses the Eye Exam Panel in a reduced "refraction + dispensing" mode.

The single most important shared-core prerequisite for this cluster is **first-class laterality on the canonical clinical data model**. Standard EMRs store an observation as `(patient, type, value, time)`; eye and ear care require `(patient, type, value, time, site)` where `site ∈ {OD, OS, OU}` for eyes and `{AD, AS, AU}` for ears. This must be a core data-model dimension so IOP-OD, VA-OS, and hearing-threshold-AD can each be **trended independently** over time. This is config-adjacent core work that also benefits derma (per-lesion laterality) — not a per-pack fork.

---

## 1. Ophthalmology Pack — HEAVY, P0

**Why P0 for Pakistan.** Cataract is the leading cause of blindness (~51.5% of blindness) and uncorrected refractive error is the leading cause of moderate visual impairment (~43%); the National Blindness & Visual Impairment Survey estimated ~904,000 adults needing cataract surgery. Standalone eye clinics/hospitals are among the most common specialty clinic types in Pakistan, and this pack sits closest to our existing derma imaging strength (both are image-heavy, per-site, procedure-driven).

### Intake fields (config on shared intake engine)
- Chief complaint chips: blurred vision (near/distance), redness, watering, pain, itching, discharge, floaters/flashes, diplopia, headache, foreign-body sensation.
- Ocular history: spectacle/contact-lens wearer + duration, prior eye surgery (cataract/LASIK/squint), glaucoma, diabetic retinopathy screening status, amblyopia/squint in childhood, ocular trauma, ocular medications (drops).
- Systemic/relevant: diabetes (+ duration + last HbA1c), hypertension, thyroid, on steroids, family history of glaucoma/blindness.
- Occupational/functional: driver, computer/VDU hours, tailor/fine-work (near demand), Qur'an/reading needs — relevant to Rx and Pakistani outpatient reality.

### Note templates (template engine — config, no code)
- **Comprehensive eye exam SOAP** (8-point): VA (sc/cc, distance/near, pinhole), pupils (RAPD), motility/alignment, IOP, confrontation fields, external/adnexa, slit-lamp anterior segment, dilated fundus.
- **Refraction / spectacle prescription visit**.
- **Glaucoma follow-up** (IOP trend, C:D ratio, fields, drops).
- **Diabetic retinopathy screening** (grading + follow-up interval).
- **Red eye / conjunctivitis** short template.
- **Cataract pre-op assessment** (biometry, IOL power, systemic fitness) and **post-op day-1 / week-1** templates.

### Service / procedure catalog (catalog + PKR pricing — config)
Indicative outpatient PKR ranges (private clinic, edit per tenant):
- Consultation / eye check-up: PKR 1,000–3,000
- Refraction + spectacle prescription: PKR 500–1,500
- IOP / applanation tonometry: PKR 500–1,000
- Dilated fundus exam: PKR 800–1,500
- OCT (macula / optic nerve): PKR 3,500–7,000
- Fundus fluorescein angiography (FFA): PKR 6,000–12,000
- Visual field (perimetry, per eye): PKR 1,500–3,000
- A-scan biometry / IOL master: PKR 1,500–3,000
- Phacoemulsification + foldable IOL (per eye): PKR 35,000–120,000
- YAG laser capsulotomy: PKR 8,000–20,000
- Pterygium excision, chalazion incision, foreign-body removal, syringing (lacrimal): PKR 3,000–15,000
- Anti-VEGF intravitreal injection (procedure fee, drug separate): PKR 8,000–25,000

### Common order sets (order-set engine — config)
- **Diabetic patient screen:** dilated fundus + OCT macula (if DR) + HbA1c reminder + review interval.
- **Glaucoma workup:** IOP + gonioscopy + OCT-RNFL + 24-2 perimetry + pachymetry.
- **Cataract pre-op bundle:** biometry (A-scan/IOL master) + keratometry + B-scan (if dense) + systemic fitness (RBS, BP, ECG >40y) + IOL power selection.
- **Standard drop formulary quick-orders:** topical antibiotic, lubricants, anti-glaucoma (timolol/latanoprost), steroid taper.

### Specialty widget — **Eye Exam Panel** (the HEAVY component)
A single reusable clinical component, laterality-aware (OD | OS columns, OU where relevant):
- **Refraction grid:** per-eye Sph / Cyl / Axis / Add / Prism / Base, with VA (sc, cc, pinhole, near), auto-refraction import, and PD. Produces a structured **spectacle Rx** and a separate **contact-lens Rx** object (BC, diameter, brand/power).
- **IOP field:** value + method (GAT/NCT/Tonopen) + time-of-day (for diurnal trend) + CCT-adjusted flag; feeds a per-eye IOP trend chart.
- **Slit-lamp / anterior segment:** structured pick-lists per structure (lids, conjunctiva, cornea, AC, iris, lens/nucleus grade LOCS, IOL status) with normal/abnormal toggles + free text.
- **Posterior segment / fundus:** disc (C:D ratio, per eye), macula, vessels, periphery; DR grading scale (mild/moderate/severe NPDR, PDR) and DME flag.
- **Eye schematic annotation:** clickable OD/OS diagram to mark lesions/findings (reuses the derma body-map annotation engine — same component, eye SVG).
- **Imaging attach:** fundus photo / OCT / topography / FFA images into the shared document/DICOM-lite store, linked per eye.
- **Rx print:** generates spectacle & CL prescription PDF via shared print/PDF service.

**Config vs new component:** intake, templates, catalog, order sets, drop formulary, and the eye schematic (reuses derma annotation) are **config/reuse**. The **new build** is the refraction grid + structured IOP/slit-lamp/fundus capture + per-eye trending, plus the laterality dimension in the core data model (shared, not eye-only).

---

## 2. Optometry / Optical Pack — HEAVY (reuses Eye Exam Panel) → effectively Light on top of Ophthalmology, P1

**Why a separate pack.** Standalone optical shops and optometry-led refraction clinics are extremely common in Pakistan and are the front line for uncorrected refractive error (a leading, easily avoidable cause of vision loss; quality studies show only ~43% of dispensed spectacles are optimal, with prism/quality-control gaps). These sites do **refraction + dispensing**, not full medical eye care, and need a lighter, dispensing-oriented workflow — but they still need the refraction/Rx machinery, so the pack is Heavy only because it depends on the Eye Exam Panel already existing.

### Intake fields
Subset of ophthalmology intake focused on: reason for visit (new glasses / broken glasses / eye strain / headache), current spectacle Rx (read from lensometer or last Rx), CL wearer status, screen/near-work demand, driving, age (presbyopia flag ≥40).

### Note templates
- **Refraction & dispensing visit** (objective auto-ref → subjective → final Rx → dispensing).
- **Contact-lens fitting & trial** template.
- **Vision screening / camp** template (for outreach — high value in rural Pakistan).
- **Referral-to-ophthalmology** template with red-flag checklist (sudden loss, IOP high, media opacity, disc suspicious) — governance so optical sites escalate appropriately.

### Service / catalog + inventory (config + shared inventory)
- Eye test / refraction: PKR 300–1,000
- Contact-lens fitting: PKR 1,000–3,000
- **Optical dispensing inventory** on the shared inventory/stock module: frames (SKU, brand, size, price), lenses (single-vision / bifocal / progressive; index 1.5/1.56/1.6/1.67; coatings AR/blue-cut/photochromic), CL boxes and solutions. Sale = order → invoice → stock decrement through shared billing/inventory.

### Order sets
- **Presbyopia bundle** (≥40y): near-add measurement + progressive vs bifocal counselling.
- **Myopia in child:** cycloplegic refraction order + ophthalmology referral if high/rapidly progressing.

### Widget
Reuses the **Eye Exam Panel in "refraction + dispensing" mode** (refraction grid + Rx builder + lensometer/auto-ref import), hiding IOP/slit-lamp/fundus. No new clinical component — the only net-new pieces are the optical **dispensing catalog + frame/lens inventory config** and the referral red-flag governance. That is why, given ophthalmology ships first, this pack is operationally Light.

---

## 3. ENT / Otolaryngology Pack — HEAVY, P1

**Why P1 for Pakistan.** ENT complaints are enormous in primary/outpatient load — roughly 25% of adult and 40% of paediatric GP consultations involve ENT; OPD series show rhinosinusitis (~14%), impacted cerumen (~13%), pharyngitis (~12%), allergic rhinitis (~10%), and chronic suppurative otitis media (~6%) as the top presentations, with high otitis-media-induced hearing-loss rates in South Asia. Standalone ENT clinics are common. It is P1 (just behind ophthalmology P0) because the population volume is huge and the widget (audiogram + scope findings) is well-bounded.

### Intake fields (config)
- Complaint chips: ear pain/discharge/blocked, hearing loss (which ear, gradual/sudden), tinnitus, vertigo/imbalance, nasal block/discharge/bleeding, sneezing/itch (allergy), snoring/mouth-breathing, sore throat, hoarseness, neck lump, foreign body.
- ENT history: recurrent ear infections, prior ear/nose/throat surgery (grommets, tonsillectomy, FESS, septoplasty), noise exposure (occupational — relevant), hearing-aid user, allergy triggers/seasonality, smoking/naswar/paan (throat/oral cancer risk — Pakistan-relevant).
- Paediatric extras: speech delay, school performance, recurrent tonsillitis episodes/year (Paradise criteria).

### Note templates (config)
- **General ENT SOAP** with structured otoscopy/anterior-rhinoscopy/oropharynx.
- **Otitis media / CSOM** template (TM status, discharge, perforation, hearing).
- **Allergic rhinitis** template (ARIA severity, triggers, treatment ladder).
- **Vertigo/dizziness** template (Dix-Hallpike, nystagmus, HINTS).
- **Epistaxis** management template.
- **Nasal endoscopy** and **flexible laryngoscopy** procedure notes.
- **Pre-op** templates for tonsillectomy / adenoidectomy / FESS / myringotomy+grommet / septoplasty.

### Service / procedure catalog (config, PKR indicative)
- Consultation: PKR 1,000–3,000
- Pure-tone audiometry (PTA): PKR 800–2,500
- Tympanometry / impedance: PKR 500–1,500
- Diagnostic nasal endoscopy: PKR 2,000–5,000
- Flexible/rigid laryngoscopy: PKR 2,500–6,000
- Ear syringing / cerumen removal: PKR 500–2,000
- Nasal cautery (epistaxis): PKR 2,000–6,000
- Myringotomy + grommet (per ear): PKR 15,000–45,000
- Tonsillectomy ± adenoidectomy: PKR 40,000–120,000
- FESS (functional endoscopic sinus surgery): PKR 60,000–200,000
- Septoplasty: PKR 40,000–120,000
- Hearing-aid trial/fitting (device separate): PKR 2,000–5,000 fitting fee

### Common order sets (config)
- **Hearing-loss workup:** PTA + tympanometry + (speech discrimination) + otoscopy; refer for BERA/imaging if asymmetric/sensorineural.
- **CSOM bundle:** ear swab C/S + PTA + topical + review; CT temporal bone if cholesteatoma suspected.
- **Allergic rhinitis bundle:** ARIA classification + intranasal steroid + antihistamine + allergen-avoidance handout + (SPT referral).
- **Recurrent tonsillitis:** episode counter + Paradise-criteria check → surgery listing.
- **Vertigo bundle:** Dix-Hallpike + Epley + audiometry.

### Specialty widget — **ENT Exam Panel** (the HEAVY component)
Laterality-aware (AD | AS | AU for ears; L/R nose):
- **Audiogram capture & plot:** per-ear air/bone thresholds at 250–8000 Hz on a standard audiogram chart, masking, SRT, speech discrimination score, tympanogram type (A/As/Ad/B/C) + acoustic reflexes; classifies degree/type (conductive/SN/mixed) and trends over time. Manual entry + import from audiometer where available.
- **Ear structured findings:** external canal, TM (color, translucency, landmarks, perforation location/size, effusion), pneumatic mobility, per ear.
- **Nose/throat structured findings:** anterior rhinoscopy (septum, turbinates, polyps, discharge), oropharynx (tonsil grade 1–4, pharynx), neck (nodes, thyroid, masses); endoscopy findings free/structured.
- **Ear/nose diagram annotation:** clickable ear-canal/TM and nasal-septum schematics to mark perforation/polyp location (reuses derma annotation engine, ENT SVGs).
- **Endoscopy/otoscopy image attach:** into shared document store, linked per site.

**Config vs new component:** intake, templates, catalog, order sets, and diagram annotation are **config/reuse**. The **new build** is the **audiogram chart component** (data capture + plotting + degree/type classification + per-ear trending) and the structured otoscopy/rhinoscopy capture. The audiogram is the only genuinely bespoke visual not shared with any other pack.

---

## Shared-core summary — what is config vs. new code

| Capability | How it's delivered |
|---|---|
| Intake fields (all 3 packs) | **Config** on shared dynamic-intake engine |
| SOAP/note templates | **Config** in template engine |
| Service/procedure catalog + PKR pricing | **Config** in shared billing catalog |
| Order sets & drop/drug quick-orders | **Config** in order-set engine |
| Optical (frames/lenses) & hearing-aid stock | **Config** on shared inventory module |
| Fundus/OCT/endoscopy image storage | **Reuse** shared document/DICOM-lite store |
| Eye/ear schematic annotation | **Reuse** derma body-map annotation engine (new SVGs = config) |
| Rx / report PDF | **Reuse** shared print/PDF service |
| **Laterality (OD/OS/OU, AD/AS/AU) on observations** | **New core data-model dimension** (shared, benefits derma too) |
| **Eye Exam Panel** (refraction grid, IOP/slit-lamp/fundus, Rx builder) | **New component** (serves Ophthalmology + Optometry) |
| **ENT Exam Panel** (audiogram + structured otoscopy/rhinoscopy) | **New component** (serves ENT) |

**Build sequence recommendation:** (1) laterality core dimension → (2) Eye Exam Panel → ship Ophthalmology P0 → (3) Optometry pack as thin config on the same panel → (4) ENT Exam Panel / audiogram → ship ENT. Two new components plus one core-model enhancement unlock all three packs without forking.

## Orthopaedics + Physiotherapy/Rehab + Pain

# Specialty Pack Cluster: Orthopaedics + Physiotherapy/Rehab + Pain

**Cluster thesis.** These three specialties share one musculoskeletal (MSK) clinical spine — range of motion (ROM), joint/special-test exams, standardized functional outcome scores, and a course of care measured in *sessions/visits* rather than one-off encounters. Rather than three separate builds, the cluster is anchored by **one HEAVY pack (Physiotherapy/Rehab)** that owns a reusable **MSK Assessment & Rehab widget suite**; Orthopaedics and Pain are **LIGHT packs** that reuse that widget suite plus the shared clinical core (EMR, appointments, billing, inventory, imaging/PACS order fields, procedure logging) with their own intake fields, note templates, catalogs, and order sets. This keeps us on the single canonical data model with no fork — the packs differ by *configuration + content + entitlement flags*, and only Physio adds new components.

Pakistan context: physiotherapy/rehab is one of the largest standalone outpatient segments (DPT is a formally NQF-level-regulated degree, PPTA is the World Physiotherapy member body, and dedicated physio centres proliferate in every city — [World Physiotherapy: Pakistan](https://world.physio/membership/pakistan), [Marham physiotherapist directory](https://www.marham.pk/doctors/physiotherapist)). Orthopaedic + trauma clinics are ubiquitous given road-traffic and fall injury load. Interventional pain is a smaller but growing standalone niche (dedicated pain clinics in Karachi/Lahore offering epidural steroid and guided injections — [Karachi Pain Clinic](https://www.karachipainclinic.com/service/epidural-injection/), [PKLI guided injections](https://pkli.org.pk/infiltrations-and-guided-injections-for-chronic-acute-pain-management/)), so it ships as a light add-on more often enabled *inside* an ortho or physio tenant than sold alone.

---

## 1. Physiotherapy / Rehab Pack — HEAVY, P0

**Why HEAVY / P0.** Physio documentation is fundamentally structured and longitudinal in a way generic SOAP text cannot capture: goniometric ROM in degrees with contralateral comparison, MMT 0–5 grading per muscle group, validated outcome instruments (Oswestry/NDI/DASH/LEFS/Berg/TUG), and — critically — a **home exercise program (HEP) + per-session treatment log with short/long-term goal tracking** across a package of visits ([Physical Therapy EMR fields, OmniMD](https://omnimd.com/specialties/physiotherapy/); [physiotherapy assessment template best practices](https://www.notev.ai/blog/physiotherapy-assessment-template-free-examples-best-practices-2025)). Large PK segment → highest-value HEAVY pack in the cluster.

### Intake fields (config on shared intake engine)
- Referral source + referring physician; referral diagnosis / ICD-10 (e.g., low back pain, post-op TKR, stroke rehab).
- Chief complaint, symptom onset/mechanism, aggravating/easing factors, 24-hour pattern, prior episodes.
- Occupation / ergonomic + activity demands; dominant hand; assistive-device use.
- Baseline pain (NPRS 0–10) with body region; irritability/severity flags.
- Relevant surgical/precaution flags (weight-bearing status, ROM restrictions, red-flag screen).
- Baseline functional/quality-of-life goal statement (patient's own words).

### Note templates (content on shared note-template engine)
- **Initial Evaluation** (expanded SOAP): S (history, pain, function) → O (posture, gait, ROM grid, MMT grid, special tests, palpation, outcome-measure baseline) → A (PT diagnosis, problem list, rehab potential/prognosis) → P (frequency×duration, STGs/LTGs, planned interventions, HEP).
- **Daily/Progress Treatment Note** — pre-filled from prior visit so the therapist only updates changes in pain/ROM/function; auto-carries the session interventions performed and units.
- **Re-assessment / Progress Review** (e.g., every 6–8 visits) — outcome-measure re-score + goal status update.
- **Discharge Summary** — goals met, final scores, HEP handover.
- Region-specific evaluation variants: Spine (lumbar/cervical), Shoulder, Knee, Post-op ortho rehab, Neuro rehab (stroke/SCI), Vestibular/Balance, Sports.

### Service / procedure catalog examples (config on shared catalog + pricing, PKR)
- Initial Physiotherapy Assessment; Follow-up Session; **Session Package (e.g., 10/20 sessions prepaid)**.
- Modalities: TENS, Ultrasound therapy, IFT, Shortwave/Wax, Hot/Cold pack, Traction (cervical/lumbar).
- Manual therapy / Mobilization / Manipulation; Dry needling; Kinesio taping; Cupping.
- Exercise therapy: Therapeutic exercise, Gait/balance training, Post-op rehab protocol, Sports rehab.
- Specialty programs: Neuro rehab, Vestibular rehab, Pelvic-floor, Pediatric physio, Home-visit physio (add-on fee).

### Common order sets (config — pre-built bundles)
- **Post-op TKR/THA rehab protocol** (phased ROM + strengthening + gait over N sessions).
- **Mechanical low-back-pain set** (ROM, core, McKenzie/manual therapy, TENS/IFT, ergonomics HEP).
- **Frozen shoulder / rotator-cuff set.**
- **Stroke rehab set** (NDT/task-specific, gait, ADL, balance).
- **Cervical radiculopathy set** (traction, mobilization, nerve glides).

### Specialty widget (NEW component) — **MSK Assessment & Rehab Suite**
A single embeddable clinical component (rendered inside the shared EMR encounter, writing to canonical `Observation`/`CarePlan`/`Procedure`-shaped records) with these panels:
1. **ROM Goniometry grid** — joint × movement, active/passive, left/right with contralateral/normal reference, degrees captured numerically (trendable across visits).
2. **MMT grid** — muscle/group × 0–5 grade × laterality, with pain/compensation flags ([MMT 0–5 standard](https://www.soapnoteai.com/soap-note-guides-and-example/physical-therapy/)).
3. **Special-tests panel** — region-filtered test list with +/− and notes (shared with Ortho pack).
4. **Outcome-measure engine** — NPRS/VAS, Oswestry, NDI, DASH/QuickDASH, LEFS, Berg Balance, TUG, 6MWT; auto-scores + charts change over the episode ([outcome measures list](https://www.patientstudio.com/how-to-write-the-perfect-physical-therapy-soap-note-examples-and-templates)).
5. **HEP / Exercise-prescription builder** — exercise library with sets/reps/hold/frequency + instructional media attachment; prints/pushes to patient app.
6. **Per-session treatment log + Goal tracker** — records interventions/units per visit, **decrements the session-package counter** (ties to billing), and tracks STG/LTG status to discharge.

**Shared-core tie-back:** encounters, scheduling of recurring session series, the session-package/billing counter, inventory (consumables like electrodes/tape), and patient-app HEP delivery are all shared core. **New in the pack:** the six-panel MSK widget + its structured data schemas + outcome-measure scoring library.

---

## 2. Orthopaedics Pack — LIGHT, P1

**Why LIGHT / P1.** Ortho's distinctive needs — fracture/injury notes, X-ray/imaging workflow, ROM and joint special-test exams — are met by **templates + intake fields + imaging-order config + reuse of the Physio pack's ROM/special-tests panels**. No genuinely new component is required, so it stays LIGHT. High PK demand (trauma/RTA, arthritis) → P1.

### Intake fields (config)
- Injury mechanism (fall/RTA/sports/twist), time since injury, laterality, weight-bearing tolerance.
- Deformity/swelling/bruising screen, open-wound flag, neurovascular status (distal pulse, sensation, cap refill).
- Prior injury/surgery to the joint; implant/hardware presence; comorbidities (diabetes, osteoporosis).
- Pain (NPRS) + functional limitation; work/return-to-play context.

### Note templates (content)
- **Fracture / Trauma note** — inspection (deformity/swelling/bruising), palpation/tenderness, ROM, stability/special tests, **neurovascular assessment**, imaging findings, fracture description + classification (site/pattern/displacement), management (reduction/cast/splint/ORIF referral) ([fracture exam components](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10726729/)).
- **Joint-specific exam templates** — Knee, Shoulder, Hip, Spine, Ankle, Hand/Wrist — each embedding ROM (degrees, contralateral comparison) + relevant special tests documented +/− ([ortho exam structure: McMurray/Lachman/anterior-drawer etc.](https://heroemr.com/blog/orthopedics-emr-tools)).
- **Post-op / Fracture-clinic follow-up** (cast check, wound, X-ray review, physio referral).
- **Arthritis / degenerative joint** (OA) template.

### Service / procedure catalog examples (config, PKR)
- New Ortho Consultation; Follow-up; Fracture-clinic visit.
- **Plaster/casting** (POP application, slab, removal), Splint/brace fitting, Traction setup.
- Reduction of fracture/dislocation (closed); Aspiration; **Intra-articular / soft-tissue steroid injection**; PRP injection.
- Suture/wound care; Removal of hardware (clinic-level); DME dispensing (crutch/walker/brace) via inventory.

### Common order sets (config)
- **Suspected long-bone fracture** — X-ray (2 views, joint above+below) + immobilization + analgesia + neurovascular recheck.
- **Acute knee injury** — X-ray ± MRI order + RICE + brace + physio referral.
- **OA knee** — weight-bearing X-ray + NSAID + physio + optional intra-articular injection.
- **Post-op rehab handoff** — auto-generate physio referral into the Physio pack's rehab protocol.

### Widget
None new. **Reuses** the Physio pack's ROM Goniometry + Special-tests panels, and the shared **imaging order + PACS/DICOM link** fields (imaging is core, dcm4chee-backed per platform plan). Fracture classification is a structured picklist template, not a component.

**Shared-core tie-back:** imaging orders/PACS, procedure logging (casting/injection), inventory/DME dispensing, referrals→physio are all shared core. Pack adds only fracture/joint templates, intake fields, catalog, and order sets.

---

## 3. Pain Management Pack — LIGHT, P2

**Why LIGHT / P2.** Interventional pain is procedure-and-tracking heavy but rides the **shared procedure-logging + medication modules** plus a small **pain body-map / score-trend** view and reused MSK exam panels. Standalone pain clinics are a smaller PK niche (though a strong add-on inside ortho/neuro/physio tenants), so P2. No new heavy component → LIGHT.

### Intake fields (config)
- Pain location(s) via body-map, character (nociceptive/neuropathic/mixed), NPRS/VAS now/best/worst, duration/chronicity.
- Radiation/dermatomal pattern, red-flag screen, prior injections/surgery, imaging findings (MRI/X-ray).
- Current analgesic/opioid regimen + **controlled-substance/opioid tracking**, allergies, anticoagulation status (procedure-safety flag).
- Functional interference (Brief Pain Inventory), sleep/mood screen.

### Note templates (content)
- **Pain Consultation** (SOAP with pain diagram + BPI + neuro exam).
- **Interventional Procedure note** — pre-procedure checklist (consent, anticoagulation, fasting), procedure (type, level/laterality, drug + dose, **guidance: ultrasound/fluoroscopy**), post-procedure monitoring, complications ([guided injection practice, PK](https://pkli.org.pk/infiltrations-and-guided-injections-for-chronic-acute-pain-management/)).
- **Injection follow-up / medication-review** template.

### Service / procedure catalog examples (config, PKR)
- Pain Consultation / Follow-up.
- **Epidural steroid injection**, Facet joint / medial-branch block, Nerve root block, Trigger-point injection, Intra-articular injection, Radiofrequency ablation, Ozone/prolotherapy ([ESI in PK](https://www.karachipainclinic.com/service/epidural-injection/)).
- Ultrasound- vs fluoroscopy-guided modifiers; local anaesthetic/steroid consumables via inventory.

### Common order sets (config)
- **Lumbar radiculopathy** — MRI review + ESI + analgesic ladder + physio referral + outcome re-score at 2/6 wk.
- **Facet-mediated LBP** — medial-branch block (diagnostic) → RFA if positive.
- **Chronic pain medication set** — regimen + monitoring + BPI follow-up.

### Widget
None new. **Reuses** shared procedure log + a lightweight **pain body-map + NPRS/BPI trend** view (thin config layer over the outcome-measure engine already built for Physio) and the medication module for opioid tracking.

**Shared-core tie-back:** procedure logging, consent, medication/inventory (drugs, needles), imaging review, physio referral — all core. Pack adds intake fields, procedure/consult templates, injection catalog, and order sets.

---

## Cluster build economics
- **One new component** to build (the MSK Assessment & Rehab Suite in the Physio pack) serves all three specialties — Ortho and Pain reuse its ROM/special-tests/outcome panels and add only config/content.
- Everything else (encounters, recurring session scheduling, session-package billing counter, imaging/PACS, procedure logging, medication/inventory, referrals, patient-app HEP delivery) is existing shared core, entitlement-flagged per pack.
- Recommended enablement order: **Physio (P0) first** (largest PK segment + it builds the shared widget), then **Ortho (P1)** and **Pain (P2)** as fast config-only follow-ons; hospitals enable all three as departments on the same data model.

## Cardiology + Internal Medicine + Diabetes/Endocrinology

## Cluster: Cardiology + Internal Medicine + Diabetes/Endocrinology

**Why this cluster matters for Health OS (Pakistan-first).** These three specialties are the backbone of Pakistani outpatient chronic-disease care and overlap heavily on the same shared spine (vitals, labs, medications, longitudinal trends). Pakistan carries one of the world's heaviest non-communicable-disease (NCD) burdens: diabetes rose from ~5.2M adults (2000) to ~33M (2021) with nationwide adult prevalence now among the highest globally, hypertension affects ~25% of adults, and dyslipidemia/IHD are extremely common ([Springer – Diabetes in Pakistan](https://link.springer.com/article/10.1186/s40842-025-00235-7); [Mathews – Hypertension in Pakistan](https://www.mathewsopenaccess.com/full-text/prevalence-of-hypertension-and-associated-co-morbidities-in-pakistan); [PMC – CV risk factors in Pakistani adults](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11326748/)). Standalone "General Physician," "Diabetes & Endocrine," and "Cardiac/Heart" clinics are among the most common private outpatient setups. The engineering insight: **one shared Longitudinal Clinical Trends component + one shared Chronic-Disease Registry** serve all three; only two genuinely pack-specific clinical widgets need building (ECG/echo capture for Cardiology, insulin-titration + diabetic-foot for Diabetes). Everything else is config/templates/catalog on the existing core.

### Shared-core primitives these packs assume (build once, reuse across all three)
- **Longitudinal Clinical Trends widget** (HEAVY, funded once by this cluster, lives in shared core not in a pack): plots any numeric observation over time — BP (systolic/diastolic bands), weight/BMI, HbA1c, LDL/HDL/triglycerides, eGFR, fasting/random glucose — with target-range shading, goal lines, and "since last visit" deltas. Every pack below composes it with different metric sets.
- **Chronic-Disease Registry / problem-oriented dashboard** (config + a light list component): coded problem list (ICD-10), per-condition care-plan status, "last done / next due" recall tracker for screenings. Reused by all three.
- **Structured lab-result model + orderables** (already in core): lipid panel, HbA1c, RFT, LFT, TSH, urine ACR, ECG/echo as orderable procedures. Packs only add order-set bundles and reference ranges.
- **Vitals capture** (already in core): the packs extend the vitals set (e.g., add ankle-brachial index, waist circumference) via config, not code.

---

## 1. Cardiology Pack — HEAVY (P1)

**Positioning.** Standalone cardiac/heart clinics and hospital cardiology departments. The single specialty here that genuinely needs custom clinical components (ECG/echo diagnostics don't fit the generic note+lab model).

### Intake fields (config — added to shared registration/intake schema)
- Presenting cardiac complaint (chest pain character, dyspnea NYHA class I–IV, palpitations, syncope, orthopnea/PND, claudication)
- Cardiac risk profile: smoking (pack-years), diabetes, hypertension duration, dyslipidemia, family history of premature CAD, prior MI/PCI/CABG, known arrhythmia
- Extended vitals: BP both arms, heart rate + rhythm, ankle-brachial index (optional), height/weight/BMI, waist circumference
- Current cardiac meds (antiplatelets, statins, beta-blockers, ACE/ARB, anticoagulants) with adherence flag

### Note / SOAP templates (config content)
- **New cardiac consult** — structured CVS exam (JVP, apex, heart sounds S1/S2/added, murmurs grade & site, peripheral pulses, edema), 12-lead ECG interpretation block, impression + CV risk category, plan
- **Chest-pain assessment** — typical/atypical/non-anginal triage, differential, disposition
- **Hypertension follow-up** — home-BP log review, target attainment, med titration
- **Heart-failure follow-up** — weight/fluid status, NYHA class, device check
- **Pre-procedure / post-PCI / post-CABG follow-up** note

### Service / procedure catalog examples (config, PKR)
- Cardiology new consultation / follow-up
- Resting 12-lead ECG; Treadmill / ETT stress test; Holter 24–48h; ambulatory BP monitoring (ABPM)
- Transthoracic echocardiography (2D + Doppler); stress echo
- Lipid profile, hs-CRP, NT-proBNP, cardiac enzymes/troponin panel bundle
- Device clinic (pacemaker/ICD interrogation) — hospital tier

### Common order sets (config bundles)
- **New CAD workup:** ECG + lipid profile + FBS/HbA1c + RFT + CBC + echo
- **Hypertension baseline:** ABPM + RFT + electrolytes + urine ACR + ECG + lipid + fundus referral
- **Heart-failure panel:** NT-proBNP + echo + RFT + electrolytes + TSH + ECG
- **Pre-op cardiac clearance:** ECG + echo + CBC + coagulation + electrolytes

### Specialty widgets (the HEAVY component — genuinely new code)
1. **ECG capture & interpretation panel** — attach ECG image/PDF (or device export) to the encounter, overlay a structured interpretation form (rate, rhythm, axis, intervals PR/QRS/QT/QTc, ST-T changes, chamber enlargement, machine vs. physician read), and store findings as **structured data, not a scanned blob** — the standards literature stresses results must flow into the record structured, not as attachments ([Canvas Medical – Cardiology EHR workflow](https://www.canvasmedical.com/guides/cardiology-workflow-management-with-ehr-software)).
2. **Structured echo report builder** — templated per ASE standardization: LV size/wall thickness/systolic + diastolic function, EF, valve assessment, chambers, indexed-to-BSA fields, indications, referring + interpreting physician, study date; outputs a formatted PDF and discrete values that feed trends ([ASE – Standardized Echo Report](https://www.asecho.org/wp-content/uploads/2025/04/Standardized_Echo_Report_Rev1.pdf)).
3. **CV risk calculator widget** — 10-year CVD risk (ASCVD / Framingham, with a WHO-region chart fallback for LMIC settings) pulling age, sex, SBP, total & HDL cholesterol, smoking, diabetes, BP-treatment status straight from the record; stores the score + category on the encounter and colors the risk band ([MDCalc – Framingham Risk](https://www.mdcalc.com/calc/38/framingham-risk-score-hard-coronary-heart-disease); [PMC – CV risk-score comparison](https://pmc.ncbi.nlm.nih.gov/articles/PMC5560874/)).
- **Reused (not new):** BP/vitals trend and lipid trend come from the shared Longitudinal Trends component — config only.

### Shared-core tie-back
Config vs. code: intake, templates, catalog, order sets, reference ranges = **config**. New components = **ECG panel, echo report builder, CV-risk calculator**. BP/lipid trends = **shared Trends component (config metric set)**. Billing/orders/lab results = **existing core**.

---

## 2. Internal Medicine / General Physician Pack — LIGHT (P0)

**Positioning.** The highest-volume, broadest-applicability, lowest-build-cost pack in the cluster — the "general physician" clinic that dominates Pakistani private outpatient care and is the natural non-aesthetic wedge. Deliberately **LIGHT**: it ships as config + templates + a dashboard composed from shared components, with **no new clinical widget**. Prioritized **P0** because it unlocks the largest tenant segment for near-zero incremental engineering.

### Intake fields (config)
- Comprehensive problem list (multi-condition, ICD-10 coded) — chronic-disease coding is a known EMR weak point, so the pack ships a curated NCD code picker to keep the problem list clean ([PMC – smart disease coding in EMR](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7418012/))
- Full medication list with dose/frequency/adherence + allergy list
- Risk factors & social history (smoking, tobacco/naswar, activity, diet), family history
- Baseline vitals + BMI + waist circumference

### Note / SOAP templates (config content)
- **General adult consult** (full SOAP) — the standard internal-medicine note structure ([SOAPNoteAI – Internal Medicine](https://soapnoteai.com/soap-note-guides-and-example/internal-medicine/))
- **Chronic-disease follow-up** (multi-problem, one note) — HTN + DM + dyslipidemia reviewed together
- **Acute febrile / infectious illness** (relevant to PK: enteric fever, dengue, TB screen)
- **Medication reconciliation** template — compares taken vs. ordered meds, flags duplications/omissions/interactions each visit ([PMC – med reconciliation in internal medicine](https://pmc.ncbi.nlm.nih.gov/articles/PMC6025090/))
- **Annual health check / preventive-care** template

### Service / procedure catalog examples (config, PKR)
- GP/physician new consultation, follow-up, teleconsultation
- Annual executive health-check package (bundled labs + ECG + consult)
- Chronic-care management monthly package (recurring)
- Minor OPD procedures (dressing, injection, nebulization), health certificates

### Common order sets (config bundles)
- **NCD baseline screen:** CBC + FBS/HbA1c + lipid + RFT + LFT + TSH + urinalysis + ECG
- **Fever workup (PK-tuned):** CBC + malaria ICT + dengue NS1/serology + typhoid + urinalysis + CRP
- **Annual preventive panel:** CBC + metabolic + lipid + HbA1c + TSH + vitamin D + ECG
- **Anemia / fatigue workup:** CBC + ferritin + B12 + TSH + RFT

### Specialty widget
**None — LIGHT.** The "chronic-disease dashboard" is a **composition** of shared components: Longitudinal Trends (BP/HbA1c/lipids/weight) + Chronic-Disease Registry (problem list + recall tracker) + med-reconciliation template. Configuration only; no new clinical code.

### Shared-core tie-back
Entirely **config + templates + catalog + dashboard composition** over the existing core. This pack is the proof that "specialty pack ≠ code": it demonstrably ships without touching the codebase, validating the config-driven pack model.

---

## 3. Diabetes / Endocrinology Pack — HEAVY (P1)

**Positioning.** Given Pakistan's ~33M diabetic adults and rapid rise, dedicated diabetes/endocrine clinics are a large, growing segment ([Diabetes Research & Clinical Practice – nationwide T2DM meta-analysis](https://www.diabetesresearchclinicalpractice.com/article/S0168-8227(24)00725-3/abstract)). HEAVY because glycemic management, insulin titration, and foot screening need purpose-built tools that the generic note+lab model handles poorly.

### Intake fields (config)
- Diabetes type (T1/T2/GDM/other), year of diagnosis, current regimen (OHA classes / insulin type & TDD / GLP-1)
- Glycemic targets (individualized HbA1c goal, FBS/PPBS targets), hypoglycemia frequency & awareness
- Complication history: retinopathy, nephropathy, neuropathy, foot ulcer/amputation, CVD
- Endocrine extras (thyroid, PCOS, adrenal): relevant symptoms, current hormone therapy
- Vitals + BMI + waist circumference + BP (BP control is core to diabetes NCD care — records should carry HbA1c, FBG, BP, cholesterol, BMI together, [DoctorsApp – Diabetology EMR](https://www.doctorsapp.in/speciality/diabetologists))

### Note / SOAP templates (config content)
- **Diabetes new consult** — full endocrine history, complication screen, regimen, education plan
- **Diabetes follow-up** — glucose-log + HbA1c review, target attainment, titration, complication recall
- **Insulin start / intensification** template
- **Thyroid disorder** (hypo/hyper) consult + follow-up
- **PCOS / metabolic syndrome** template
- **Diabetic foot assessment** structured note

### Service / procedure catalog examples (config, PKR)
- Diabetology/endocrine new consult, follow-up, teleconsult
- Diabetes education / dietitian session; insulin-initiation counseling
- HbA1c, fasting/PP glucose, fructosamine, C-peptide, lipid, urine ACR, RFT
- Thyroid panel (TSH/T3/T4, anti-TPO), cortisol, HbA1c point-of-care
- Diabetic foot screening; monofilament/Doppler neuropathy exam; CGM setup & report review
- Diabetes management monthly/quarterly package (recurring)

### Common order sets (config bundles)
- **Annual diabetes review:** HbA1c + lipid + RFT + urine ACR + LFT + ECG + retinopathy screen referral + foot exam
- **New diabetes workup:** HbA1c + FBS/PPBS + lipid + RFT + urine ACR + TSH + ECG
- **Insulin-titration follow-up:** HbA1c + FBS/PP glucose log review + RFT
- **Thyroid workup:** TSH + free T4/T3 + anti-TPO + lipid

### Specialty widgets (the HEAVY component — genuinely new code)
1. **Glucose log / SMBG capture + HbA1c trend** — structured multi-reading log (fasting, pre/post-meal, bedtime), CGM import (time-in-range, GMI), plotted with target-range shading; HbA1c, FBG, lipids tracked longitudinally as visual trends is the defining diabetes-EMR feature ([DoctorsApp – Diabetology EMR](https://www.doctorsapp.in/speciality/diabetologists)). Trend rendering reuses the shared Trends component; the **glucose-log grid + CGM/TIR summary is new**.
2. **Insulin titration assistant** — records current insulin type/dose/TDD, shows recent FBS pattern against target, and suggests dose steps per a configurable protocol (e.g., titrate basal by fasting glucose), logging each adjustment and the rationale; titration-support tooling measurably improves HbA1c outcomes ([Frontiers – telehealth insulin titration RCT](https://www.frontiersin.org/journals/endocrinology/articles/10.3389/fendo.2025.1724811/full); [PMC – insulin initiation & titration](https://pmc.ncbi.nlm.nih.gov/articles/PMC6528396/)). Human-in-the-loop, clinician confirms — aligns with the platform's assistive-AI stance.
3. **Diabetic foot exam map** — a foot diagram to mark ulcers/callus/deformity/amputation sites, monofilament (10-point), vibration, pulse, and ABI results, with a risk-stratification score and recall interval; annual foot exam tracking is a standard diabetes-EMR requirement.

### Shared-core tie-back
Config vs. code: intake, templates, catalog, order sets = **config**. New components = **glucose-log/CGM grid, insulin-titration assistant, diabetic-foot map**. HbA1c/lipid/BP/weight trends = **shared Trends component**. Complication recall + problem list = **shared Registry**. Labs/billing = **existing core**.

---

## Cluster build economics (for roadmap sequencing)
- **Ship first (P0, ~zero clinical code):** Internal Medicine — pure config, immediately sellable, largest tenant pool, and it exercises/validates the pack framework.
- **Fund the shared HEAVY primitive once:** the Longitudinal Clinical Trends component + Chronic-Disease Registry. Charge it to the cluster, not any single pack.
- **Then P1 HEAVY packs:** Cardiology (ECG panel + echo builder + CV-risk calc) and Diabetes (glucose-log/CGM + insulin titration + foot map) — each adds only 2–3 focused widgets on top of the shared primitive.
- **Hospital multi-department note:** all three packs coexist as departments in a Polyclinic/Hospital tenant via entitlements; the shared registry means a patient's HTN/DM/lipid data is one record across cardiology, medicine, and endocrine clinics — a real differentiator vs. siloed competitors.

## GP/Family Medicine + Psychiatry + Neuro + Uro + Gastro + Pulmo + Nephro + Nutrition + others

## Cluster: General & Medical Specialties — "Light Pack" Family

**Thesis.** Every specialty in this cluster runs on the *same* shared clinical core (EMR, appointments, billing, inventory, orders/results, one canonical FHIR-R4-aligned data model). A "pack" here is almost entirely **configuration + content**: intake field sets, SOAP/note templates, a service/procedure catalog with PKR pricing, and common order sets. None of these specialties needs a forked codebase or a bespoke clinical engine. The few things that *look* like custom widgets (PHQ-9 scoring, anthropometry trend lines, diet plans) are **built once as reusable core components** and merely *invoked* by a pack — so the packs stay LIGHT.

### Shared-core components these packs reuse (build once, not per-pack)
- **Scored-instrument engine** — renders any questionnaire (items → auto-scored total → severity band → trend). Powers PHQ-9, GAD-7, MSE-as-structured-form, MNA, MMSE/MoCA, IPSS, mMRC/CAT, Bristol chart. *Config = the instrument definition (JSON); component = shared.*
- **Flowsheet / trend charting** — plots any coded observation over time (weight, BMI, eGFR, HbA1c, BP, PEFR). Specialties just declare which observations to pin.
- **Structured care-plan / plan builder** — reusable for diet plans, dialysis plans, medication titration, chronic-disease care plans.
- **Order-set + result-flowsheet** — lab/imaging/procedure bundles; results auto-file to the canonical model and flow into trends.
- **Document/consent + media** — reuses the existing aesthetic-pack photo/consent module for endoscopy images, ECGs, scan uploads.

Because those five live in core, ~all specialties below are **LIGHT** (config + templates + catalog + order sets). I flag the *one* candidate that could justify a HEAVY component (peds growth-percentile curves) but recommend building even that as a shared core chart, keeping the pack Light.

---

### 1. GP / Family Medicine — **the base template (LIGHT, P0)**
The canonical outpatient pack every other pack inherits and overrides.
- **Intake fields:** presenting complaint, duration, vitals (BP, pulse, temp, SpO2, weight/height/BMI), allergies, chronic conditions (HTN/DM flags), current meds, social history (smoking/tobacco/*naswar*), family history, LMP (where relevant).
- **Note templates:** generic **SOAP**; focused visit; chronic-disease follow-up (HTN/DM); acute febrile illness; well/preventive visit; sick note / medical certificate.
- **Service catalog (PKR):** consultation (new/follow-up), dressing, injection administration, nebulization, ECG, minor procedure, MC/fitness certificate.
- **Order sets:** "Adult general workup" (CBC, RBS/FBS, urine R/E, LFT, RFT, lipids); "Febrile illness — endemic" (CBC, malaria ICT, dengue NS1/IgM, typhoid, urine R/E); "Diabetic review" (HbA1c, FBS, lipids, urine ACR, creatinine).
- **Core tie-in:** 100% config on the shared EMR. No new component.

### 2. Internal / General Medicine — **LIGHT, P0**
GP base + broader chronic-disease depth for physician-led OPD (the dominant standalone clinic in Pakistan).
- **Adds:** problem-list-driven note, multimorbidity review template, medication-reconciliation template.
- **Catalog:** specialist consult, chronic-care package (quarterly review), procedure add-ons (pleural/ascitic tap billing lines).
- **Order sets:** "Anemia workup," "Thyroid panel," "Pyrexia of unknown origin," "Cardiometabolic screen." Core tie-in: config only.

### 3. Endocrinology & Diabetology — **LIGHT, P1** *(very high PK prevalence — T2DM ~11–15%, HTN ~38%)*
- **Intake:** diabetes type, duration, insulin/OHA regimen, hypo episodes, foot exam (monofilament), fundus status, BP, BMI, waist circumference.
- **Templates:** diabetes annual review; insulin titration note; thyroid consult; obesity/metabolic consult.
- **Catalog:** diabetes education session, foot-screening, insulin-start package, thyroid consult.
- **Order sets:** "Diabetes annual review" (HbA1c, lipids, urine ACR, creatinine/eGFR, ALT, TSH, ECG); "New DM workup"; "Thyroid panel."
- **Widget?** None new — reuses **flowsheet** (HbA1c/weight/BP trends) + **titration plan builder**. Config only.

### 4. Psychiatry & Mental Health — **LIGHT (borderline), P1** *(depression = top DALY contributor in PK)*
- **Intake:** presenting complaint, risk screen (suicide/self-harm/harm-to-others — mandatory field), substance use, sleep/appetite, psychosocial stressors, forensic/legal, developmental history.
- **Structured instruments (via scored-instrument engine):** **PHQ-9** (0–27 bands), **GAD-7** (0–21 bands), and a **structured Mental State Examination** (appearance, behavior, speech, mood, affect, thought process/content, perception, cognition, insight, judgment). Optional MMSE/MoCA, MDQ, AUDIT.
- **Note templates:** initial psychiatric evaluation; psychiatry progress note (with rating-scale scores in Objective); **therapy/session note** (SOAP + risk + plan); medication-management note.
- **Catalog:** initial psychiatric assessment, follow-up, psychotherapy session (individual/family), psychometric assessment.
- **Order sets:** "Baseline before psychotropics" (CBC, LFT, RFT, TSH, fasting glucose, lipids, ECG for QTc); "Lithium monitoring"; "Clozapine ANC monitoring."
- **Core tie-in:** PHQ-9/GAD-7/MSE are **instrument definitions (config)** on the shared scored-instrument engine — *not* a forked codebase. Only reason it flirts with HEAVY is if that engine doesn't yet exist in core; build it once and this stays Light.

### 5. Neurology — **LIGHT, P2**
- **Intake:** headache/seizure/weakness/dizziness characterization, GCS, handedness, seizure diary fields, stroke risk factors.
- **Templates:** neuro consult with **structured neurological exam** (cranial nerves, motor/power grading, reflexes, sensory, gait, coordination); headache note; epilepsy follow-up; post-stroke review.
- **Catalog:** neuro consult, EEG, nerve conduction study/EMG (referral or in-house billing line), Botox for migraine/spasticity.
- **Order sets:** "Seizure first-presentation" (CBC, electrolytes, Ca/Mg, glucose, EEG, MRI brain referral); "Stroke risk" (lipids, HbA1c, ECG, carotid Doppler); "Neuropathy" (HbA1c, B12, TSH, RFT). Core tie-in: config; exam is a template, not a component.

### 6. Urology — **LIGHT, P2**
- **Intake:** LUTS, hematuria, stone history, erectile/fertility concerns, **IPSS** score, PSA history, catheter status.
- **Templates:** urology consult; BPH follow-up; stone-disease note; UTI note.
- **Catalog:** urology consult, uroflowmetry, cystoscopy (billing line), catheterization, DJ-stent (referral), ESWL package.
- **Order sets:** "Hematuria workup" (urine R/E + cytology, RFT, ultrasound KUB, PSA); "Stone workup" (RFT, serum calcium/uric acid, urine, CT-KUB referral); "BPH" (PSA, uroflow, ultrasound post-void residual). Widget: **IPSS via scored-instrument engine** (config).

### 7. Gastroenterology & Hepatology — **LIGHT, P1** *(very high HBV/HCV burden in PK)*
- **Intake:** abdominal pain, dyspepsia, bowel habit, **Bristol stool scale**, jaundice, hematemesis/melena, alcohol/hepatitis risk, weight loss, ascites.
- **Templates:** GI consult; dyspepsia/GERD note; chronic liver disease follow-up; **endoscopy/colonoscopy report template** (indication, findings, biopsy, impression, follow-up).
- **Catalog:** GI consult, upper GI endoscopy, colonoscopy, H. pylori test, FibroScan, banding/polypectomy (billing lines).
- **Order sets:** "Chronic hepatitis workup" (HBsAg, anti-HCV, HCV RNA, LFT, PT/INR, AFP, ultrasound abdomen); "Dyspepsia" (CBC, H. pylori, LFT); "Diarrhea — chronic" (stool R/E + culture, celiac serology, TSH).
- **Core tie-in:** endoscopy images reuse the existing **media/document module**; report is a template. Config only.

### 8. Pulmonology / Chest — **LIGHT, P1** *(high TB & asthma/COPD burden in PK)*
- **Intake:** cough duration, sputum/hemoptysis, dyspnea (**mMRC**), wheeze, smoking pack-years, TB contact/prior ATT, occupational exposure, **CAT score** (COPD), asthma control (ACT).
- **Templates:** chest consult; asthma/COPD review; **TB initiation & DOTS follow-up note**; pre/post-bronchodilator spirometry note.
- **Catalog:** pulmonology consult, spirometry, nebulization, PEFR, 6-minute walk test, pleural tap (billing line).
- **Order sets:** "TB screen" (CXR, sputum AFB x2 / **GeneXpert MTB/RIF**, ESR); "Asthma/COPD workup" (spirometry, CBC, CXR); "Hemoptysis" (CXR, CBC, PT/INR, sputum). Widgets: **PEFR/spirometry values into flowsheet trend**; mMRC/CAT/ACT via scored-instrument engine. Config only.

### 9. Nephrology — **LIGHT, P2** *(clinically significant CKD common; ~74% with concomitant HTN)*
- **Intake:** CKD stage, primary renal diagnosis, dialysis status/access, urine output, edema, BP, dry weight, fluid/dietary adherence.
- **Templates:** nephrology consult; **CKD staging & follow-up note** (eGFR, ACR, stage); dialysis-patient review; hypertension-renal note.
- **Catalog:** nephrology consult, hemodialysis session, CKD care package, AV-fistula assessment (referral).
- **Order sets:** "CKD baseline" (creatinine/eGFR, urine ACR, electrolytes, Ca/PO4, PTH, Hb, HbA1c, ultrasound KUB); "Pre-dialysis workup" (HBsAg, anti-HCV, HIV, CBC, electrolytes); "Nephrotic screen." Widget: **eGFR/creatinine/K+ trends via flowsheet** (config). Only HEAVY if you add a full dialysis-run charting module — out of scope for OPD.

### 10. Nutrition & Dietetics — **LIGHT, P1**
- **Intake / anthropometry:** weight, height, BMI, usual body weight & % change, waist/hip circumference, body-fat %, mid-arm circumference; measured-vs-reported flag; 24-hr recall / food-frequency; allergies & restrictions; therapeutic-diet indication.
- **Templates:** **ADIME** (Assessment–Diagnosis–Intervention–Monitoring/Evaluation) note; PES-statement field; diet-review follow-up; pediatric/geriatric (**MNA**) screen.
- **Catalog:** nutrition assessment, diet-plan consult, weight-management package, follow-up, group session.
- **Order sets:** "Malnutrition screen" (CBC, albumin, iron studies, vit D, B12, TSH); "Weight-management workup" (lipids, HbA1c, LFT, TSH).
- **Widgets (reused, not new):** **anthropometry trend charts** (flowsheet) + **structured diet-plan builder** (care-plan builder: calorie target, macro %, meal structure, supplements). Both are shared core → pack stays LIGHT.

### 11. ENT / Otolaryngology — **LIGHT, P2** *(others)*
- **Intake:** ear/nose/throat complaint, hearing loss, tinnitus, vertigo, nasal obstruction, allergic rhinitis, tonsil/adenoid history.
- **Templates:** ENT consult with structured ear/nose/throat exam; audiology note; allergic-rhinitis follow-up.
- **Catalog:** ENT consult, ear syringing, nasal endoscopy, audiometry, foreign-body removal, epistaxis packing (billing lines).
- **Order sets:** "Hearing loss" (audiometry, tympanometry); "Chronic rhinosinusitis" (nasal endoscopy, CT PNS referral, allergy panel). Config only.

### 12. General Pediatrics — **LIGHT, P1** *(others — the one HEAVY candidate, kept Light)*
- **Intake:** age-band vitals, birth/immunization history, feeding, developmental milestones, weight/length/head circumference, danger signs (IMNCI).
- **Templates:** well-child visit; sick-child (IMNCI-aligned); immunization visit.
- **Catalog:** pediatric consult, vaccination (EPI + optional private schedule), nebulization, growth monitoring package.
- **Order sets:** "Febrile child," "Failure to thrive," "Anemia — pediatric."
- **The one component decision:** **WHO growth-percentile charts** (weight/height/HC-for-age with plotted percentile curves) are more than a linear trend line. **Recommendation:** build them as a *shared* growth-chart component in core (reusable by nutrition too), so pediatrics remains a **LIGHT** pack rather than a fork. If leadership prefers to defer that component, Pediatrics temporarily ships without percentile curves (plain flowsheet) and stays Light.

---

**Config-vs-component summary.** All 12 packs = **specialty intake field sets + note templates + catalog + order sets = pure configuration/content** on the shared core. The only *code* investments are the **five shared components** (scored-instrument engine, flowsheet/trends, care-plan builder, order-set/result flowsheet, media/consent — most already exist from the aesthetic pack), plus **one optional** growth-percentile chart. Ship the config-only packs immediately; the specialties that reference a shared component only need that component to exist once.



---



## Sources

- [Essential Dental EHR Features (odontogram, perio charting, per-tooth treatment planning) — Vozo Health](https://www.vozohealth.com/blog/essential-dental-ehr-features-every-dentist-should-know)
- [Dental Charting Software — CareStack (visual tooth diagram, pocket depth, mobility, historical comparison)](https://carestack.com/dental-software/features/charting)
- [Curve Dental — Streamlined Dental Charting Software (interactive odontogram, per-tooth X-ray history)](https://www.curvedental.com/dental-charting-software)
- [Prevalence of dental caries in Pakistan: systematic review and meta-analysis (national ~56.6%) — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8447584/)
- [Pakistan Bureau of Statistics — Registered Dental Doctors by year of registration](https://www.pbs.gov.pk/node/1114)
- [Best Dentist in Pakistan / Top Dental Clinics — Marham (scale of private standalone dental practice)](https://www.marham.pk/doctors/dentist)
- [Dental Colleges in Pakistan: BDS programs, fees, career/income (fresh BDS PKR 40k–80k; own practice PKR 100k–300k) — Parhlai](https://parhlai.com/blog/dental-colleges-pakistan)
- [Best Orthodontic Practice Management Software 2026 (cephalometric analysis, bracket/wire tracking, appliance timeline, bonding/debonding templates) — SoftSmile](https://softsmile.com/blog/top-orthodontic-practice-management-software/)
- [Best Orthodontic Software (Open Dental ortho charting, bracket/wire tracking; Dolphin ceph/CBCT) — The Molar Report](https://www.themolarreport.com/best-dental-software/orthodontic-software)
- [Burden of dermatologic diseases in Pakistan: insights for global dermatology (Archives of Dermatological Research)](https://link.springer.com/article/10.1007/s00403-025-04109-x)
- [Pattern of skin diseases among patients attending a tertiary care hospital in Lahore, Pakistan (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6694895/)
- [Scoring systems in dermatology (Indian Journal of Dermatology, Venereology and Leprology)](https://ijdvl.com/scoring-systems-in-dermatology/)
- [PASI / EASI / MASI severity calculators (oneSkin)](https://oneskin.com/?page_id=1581)
- [UVB phototherapy protocols (DermNet NZ)](https://dermnetnz.org/cme/phototherapy/uvb-phototherapy)
- [Vitiligo NB-UVB phototherapy treatment protocol (UMass Medical)](https://www.umassmed.edu/globalassets/vitiligo/umass-uvb-phototherapy-guidelines.pdf)
- [Billing and Coding: Mohs Micrographic Surgery documentation requirements (CMS A57477)](https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=57477&ver=12)
- [Prices of Cosmetic and Aesthetic Treatments in Pakistan (Royal Cosmetic Surgery)](https://www.royalcosmeticsurgery.com.pk/prices-of-cosmetic-and-aesthetic-treatments-in-pakistan/)
- [Aesthetic Procedures in Pakistan: Cost, Types & Clinics (Aesthedoc)](https://www.aesthedoc.com/aesthetic-procedures/)
- [Awareness Regarding Causes of Infertility Among Out-patients, Karachi tertiary care (infertility ~22%)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7233490/)
- [Australian Concept — largest IVF network in Pakistan, 15+ branches](https://acimc.org/)
- [WHO Labour Care Guide — User's Manual (partogram fields, active phase from 5cm)](https://iris.who.int/bitstream/handle/10665/337693/9789240017566-eng.pdf)
- [Advancement in Partograph: WHO's Labour Care Guide (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9652267/)
- [Calculation of EDD and Period of Gestation — Naegele's rule (PSM)](https://ihatepsm.com/blog/calculation-expected-date-delivery-edd-and-period-gestation-pog)
- [Antenatal Care — fundal height and ANC fields (PSM)](https://ihatepsm.com/blog/antenatal-care)
- [ANC Follow-Up Passport, Almanagil Teaching Hospital (patient-held record completeness)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12718479/)
- [Digital antenatal care intervention vs paper records, Nepal (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11911671/)
- [MedART — 300+ IVF EMR capabilities across 17 modules (stimulation, follicle, embryo grading, cryo)](https://meddilink.com/features)
- [EasyClinic — Fertility & IVF EMR software features](https://www.easyclinic.io/ivf-emr-software/)
- [Fertility EHR: Key Features + top platforms 2026 (Blaze)](https://www.blaze.tech/post/fertility-ehr)
- [Lifelink­r — Fertility EMR integrated tools for IVF specialists](https://www.lifelinkr.com/fertility-emr-integrated-tools-modern-ivf/)
- [Meditab — Fertility EHR / lab management](https://www.meditab.com/specialties/fertilityehr)
- [Immunization Schedule – Federal Directorate of Immunization (EPI), Pakistan](https://www.epi.gov.pk/immunization-schedule/)
- [WHO EMRO — Expanded Programme on Immunization, Pakistan](https://www.emro.who.int/pak/programmes/expanded-programme-on-immunization.html)
- [Pakistan Ranks Third Globally With the Most Unvaccinated Children (parental perception & coverage) — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8684801/)
- [Differential coverage for EPI vaccines among children in rural Pakistan — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10124121/)
- [Strengthening Immunization Through Private Provider Engagement, Karachi — Vaccines (MDPI)](https://www.mdpi.com/2076-393X/14/3/205)
- [Disease Spectrum and Frequency of Illness in Pediatric Emergency, Karachi — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6928663/)
- [Pediatric EHR Development: Growth Charts & Immunization — ANI Solutions](https://www.anisolutions.com/2026/06/23/solutions-pediatric-ehr-development/)
- [CDC/WHO Growth Charts: A 2026 Guide for Pediatric Clinics — Develo](https://develo.com/blog/cdc-growth-charts)
- [Pediatric Growth Charts & Vitals — Office Practicum EHR](https://www.officepracticum.com/ehr/clinical-efficiency/pediatric-growth-charts-and-vitals/)
- [Integrating services to boost childhood immunization rates in Pakistan — UNICEF](https://www.unicef.org/stories/sowc-2023/pakistan-integrating-health-services)
- [Ophthalmology EMR Tools: per-eye laterality, device integration (Hero EMR)](https://heroemr.com/blog/ophthalmology-emr-tools)
- [Ophthalmology SOAP Notes: Complete Eye Care Documentation Guide 2026 (SOAPNoteAI)](https://www.soapnoteai.com/soap-note-guides-and-example/ophthalmology/)
- [Evaluation of Visual Acuity - StatPearls, NCBI Bookshelf](https://www.ncbi.nlm.nih.gov/books/NBK564307/)
- [How to Read an Eyeglasses Prescription - American Academy of Ophthalmology](https://www.aao.org/eye-health/glasses-contacts/how-to-read-eyeglasses-prescription)
- [Cataract prevalence, surgical coverage and barriers - Pakistan National Blindness and Visual Impairment Survey (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2001008/)
- [Causes of blindness and visual impairment in Pakistan - National Blindness Survey (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC1954803/)
- [Quality of refractive error care in Pakistan: an unannounced standardised patient study (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10603428/)
- [Uncorrected refractive error: the major and most easily avoidable cause of vision loss (PubMed)](https://pubmed.ncbi.nlm.nih.gov/17971908/)
- [ENT EMR Tools: laryngoscopy, nasal endoscopy, in-office procedures as structured notes (Hero EMR)](https://heroemr.com/blog/ent-emr-tools)
- [ENT EMR templates: audiometry, endoscopy, sinus surgery, hearing aid, allergy (ENT-Cloud)](https://www.ent-cloud.com/ent-emr-templates/)
- [Frequency of diseases presenting in ENT OPD at Ayub Teaching Hospital Abbottabad (ResearchGate)](https://www.researchgate.net/publication/335358489_FREQUENCY_OF_DISEASES_PRESENTING_IN_ENT_OPD_AT_AYUB_TEACHING_HOSPITAL_ABBOTTABAD)
- [Development of Clinical Practice Guidelines and Primary Care Referral Pathways for ENT Conditions in Pakistan (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13109012/)
- [Global burden and prevalence of otitis media-induced hearing loss in children: 32-year study (Springer)](https://link.springer.com/article/10.1007/s00405-025-09461-2)
- [Physical Therapy EMR: CPT Codes, KX Modifier & SOAP (OmniMD) - physio EMR structured fields](https://omnimd.com/specialties/physiotherapy/)
- [Physical Therapy SOAP Notes: Complete Documentation Guide (SOAPNoteAI) - MMT 0-5, outcome measures](https://www.soapnoteai.com/soap-note-guides-and-example/physical-therapy/)
- [How to Write The Perfect Physical Therapy SOAP Note (PatientStudio) - ROM/MMT/outcome instruments](https://www.patientstudio.com/how-to-write-the-perfect-physical-therapy-soap-note-examples-and-templates)
- [Physiotherapy Assessment Template: Best Practices 2025 (Notev)](https://www.notev.ai/blog/physiotherapy-assessment-template-free-examples-best-practices-2025)
- [Orthopedics EMR Tools: structured ortho documentation & special tests (Hero EMR)](https://heroemr.com/blog/orthopedics-emr-tools)
- [A Clinical Audit of Orthopaedic Documentation of Acute Ankle Fractures (PMC) - fracture note components](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10726729/)
