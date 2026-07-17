# Health OS — Frontend UI Build Plan & Screen Inventory

> **✅ STATUS: COMPLETE — 100 screens built.** Open `index.html` (launcher) or `health-os-prototype.html` (single-file bundle). Live artifact: https://claude.ai/code/artifact/d9315e79-d875-437b-b46f-4b948e6f5484

**Goal:** a complete, navigable **frontend‑only** prototype of the whole Health OS platform — every module, every key screen — built on ONE shared design system (teal brand + per‑edition accent), with realistic mock data. No backend.

## Approach
- **Static HTML** pages, one per screen, under `frontend/screens/`, each linking one shared stylesheet `assets/app.css` and script `assets/app.js` (design system + app shell + mock interactions). No build step — open/serve the folder.
- **One design system** (the teal color system) drives everything; an edition re‑tints the whole UI by overriding a single `--accent` token (Specialty = plum, Lab = green, Pharmacy = amber, Hospital = blue).
- **Consistent shell:** every web‑admin screen shares the same sidebar + topbar (injected/standardised); only the `<main>` content differs per screen.
- **Mock data** everywhere (realistic PKR figures, Pakistani names, treatments). Interactions are cosmetic (nav, tabs, modals open/close) — no real data flow.
- **Surfaces:** Web Admin (desktop), Patient App (mobile device frame), Public/marketing (responsive), Summit Control Plane (super‑admin).
- **Verification:** render key screens to PNG via headless Chrome; publish an index showcase as an artifact.

## File structure
```
frontend/
  index.html                 ← launcher: directory of all screens, grouped
  assets/app.css             ← design system + components
  assets/app.js              ← icon sprite, sidebar/topbar, tabs, modals, edition switcher
  screens/<id>.html          ← one file per screen
  PLAN.md                    ← this file (status tracker)
```

## Component kit (classes every screen uses — defined in app.css)
Layout: `.app .sidebar .brand .nav .nav-group .main .topbar .search .top-actions .iconbtn .me .content .page-head`
Cards/grid: `.card .card-head .card-body .grid-2 .grid-3 .grid-4 .kpis .kpi`
Data: `table.table .tablewrap` · buttons `.btn .btn.primary .btn.accent .btn.ghost .btn.danger .btn.sm`
Status: `.status .s-good .s-warn .s-crit .s-info .s-muted` · `.pill .tag .dot .bar`
Forms: `.form .field .form-grid .switch .segmented .filters .toolbar`
Widgets: `.av .av-sm .kanban .col .leadcard .timeline .calendar .modal .empty .tabs .breadcrumb .chip .spark .phone`
Icons: `<svg class="ic"><use href="#i-..."/></svg>` (sprite in app.js)

---

## SCREEN INVENTORY  (✓ = built)

### 0 · Foundations
- [ ] `index` — Launcher / screen directory (all screens grouped, edition switcher)
- [x] design system (`assets/app.css`, `assets/app.js`)

### A · Auth & Onboarding
- [ ] `login` — Login (email/password, 2FA hint, branding)
- [ ] `signup` — Tenant sign‑up + onboarding wizard (edition pick, clinic profile, seed)
- [ ] `forgot` — Forgot / reset password
- [ ] `verify-2fa` — Two‑factor code

### B · Dashboards
- [ ] `dashboard` — Owner/Admin dashboard (KPIs, revenue chart, appts, approvals, share, low‑stock, marketing)
- [ ] `dashboard-reception` — Reception dashboard (today, queue, check‑ins)
- [ ] `dashboard-doctor` — Doctor dashboard (my patients, my earnings, schedule)

### C · CRM & Sales
- [ ] `crm-leads` — Leads pipeline (kanban) + list toggle
- [ ] `crm-lead` — Lead detail (timeline, follow‑ups, convert)
- [ ] `crm-lead-new` — Add/edit lead (form)
- [ ] `crm-followups` — Follow‑ups / tasks board
- [ ] `crm-funnel` — Conversion funnel + source performance

### D · Appointments & Front Office
- [ ] `appt-calendar` — Doctor/resource calendar (day/week)
- [ ] `appt-new` — New appointment (service, slot, deposit)
- [ ] `appt-detail` — Appointment detail (check‑in, reschedule, no‑show)
- [ ] `queue` — Reception queue / token board
- [ ] `waitlist` — Waitlist + auto‑fill

### E · Patients
- [ ] `patients` — Patient list / search
- [ ] `patient` — Patient profile (overview: demographics, medical, tabs)
- [ ] `patient-history` — Consultation & treatment history timeline
- [ ] `patient-photos` — Before/after gallery (consent‑gated)
- [ ] `patient-docs` — Documents
- [ ] `patient-new` — Add/edit patient (form)

### F · Clinical / Consultation (EMR)
- [ ] `consult` — Consultation / encounter (SOAP note, vitals, diagnosis)
- [ ] `eprescription` — e‑Prescription (drug search, safety alerts)
- [ ] `orders` — Orders / CPOE (lab, imaging, procedures)
- [ ] `careplan` — Care plan & follow‑up
- [ ] `ai-scribe` — AI Scribe (live transcript → structured note, review/approve)

### G · Treatment Plans
- [ ] `treatment-catalog` — Treatment/service catalog & pricing
- [ ] `treatment-plan-new` — Build treatment plan (sessions, package price)
- [ ] `treatment-plan` — Plan detail / progress (sessions done/remaining)
- [ ] `session` — Session execution (mark done, issue consumables, injectable ledger)

### H · Billing & Payments
- [ ] `billing-invoices` — Invoices list
- [ ] `invoice` — Invoice detail / create (line items, tax, FBR)
- [ ] `payment` — Take payment (Safepay/PayFast/PayPro/cash/bank/POS)
- [ ] `ledger` — Patient payment ledger / statement
- [ ] `discounts` — Discount approvals queue
- [ ] `installments` — Installment plan schedule

### I · Revenue Share
- [ ] `revshare-config` — Revenue‑share rules (per doctor/treatment)
- [ ] `revshare-earnings` — Doctor earnings report / statement

### J · Inventory & Procurement
- [ ] `inventory` — Stock list (items, levels)
- [ ] `inventory-item` — Item detail (batches, expiry, movements)
- [ ] `stock-in` — Stock‑in / purchase order
- [ ] `suppliers` — Suppliers
- [ ] `issue` — Issue consumables against patient/session
- [ ] `inventory-alerts` — Low‑stock & near‑expiry alerts

### K · HR & Payroll
- [ ] `hr-employees` — Employees list
- [ ] `hr-employee` — Employee profile
- [ ] `attendance` — Attendance (biometric) board
- [ ] `roster` — Roster / shifts
- [ ] `payroll` — Payroll run
- [ ] `payslip` — Payslip

### L · Reports & Analytics
- [ ] `reports` — Reports hub
- [ ] `report-revenue` — Revenue (daily/monthly)
- [ ] `report-ar` — Outstanding / AR aging
- [ ] `analytics` — BI dashboard (funnel, retention, doctor productivity)

### M · Marketing & Engagement
- [ ] `marketing-campaigns` — Campaigns list (WhatsApp/Meta, "number safe")
- [ ] `campaign-new` — Campaign builder (audience, template, schedule)
- [ ] `journeys` — Automations / journeys (recall, birthday, win‑back)
- [ ] `loyalty` — Loyalty & memberships
- [ ] `reviews` — Reviews & reputation
- [ ] `booking-network` — Public booking & discovery network editor

### N · Lab (LIS) — Lab edition
- [ ] `lab-orders` — Lab orders worklist
- [ ] `lab-accession` — Sample accession / barcode
- [ ] `lab-results` — Result entry & validation (Westgard/QC)
- [ ] `lab-catalog` — Test catalog
- [ ] `lab-report` — Report & release

### O · Pharmacy — Pharmacy edition
- [ ] `pharmacy-pos` — Dispensary / POS
- [ ] `pharmacy-formulary` — Drug master / formulary
- [ ] `pharmacy-rx` — Prescription queue
- [ ] `pharmacy-narcotics` — Narcotics register

### P · Imaging & Telehealth
- [ ] `imaging-orders` — Imaging orders
- [ ] `imaging-viewer` — Study viewer (DICOM/OHIF placeholder)
- [ ] `telehealth` — Video consultation room (LiveKit style)

### Q · Hospital (IPD) — Hospital edition
- [ ] `hosp-admissions` — Admissions (ADT)
- [ ] `hosp-beds` — Ward / bed board
- [ ] `hosp-nursing` — Nursing station / eMAR
- [ ] `hosp-ot` — OT scheduling
- [ ] `hosp-er` — ER / triage board
- [ ] `hosp-discharge` — Discharge summary

### R · Platform / Admin & Settings
- [ ] `admin-users` — Users & roles
- [ ] `admin-permissions` — Roles & permissions matrix
- [ ] `settings` — Clinic profile & branding
- [ ] `settings-editions` — Editions & entitlements (feature flags)
- [ ] `settings-billing` — Tenant subscription & billing (Kill Bill)
- [ ] `settings-integrations` — Integrations (WhatsApp, payments, FBR, biometric)
- [ ] `audit-log` — Audit log
- [ ] `notifications` — Notifications center

### S · Summit Control Plane (super‑admin)
- [ ] `cp-tenants` — Tenants list
- [ ] `cp-tenant` — Tenant detail
- [ ] `cp-plans` — Plans & pricing
- [ ] `cp-mrr` — MRR / churn dashboard

### T · Patient App (mobile device frames)
- [ ] `pt-home` — Patient home
- [ ] `pt-book` — Book appointment
- [ ] `pt-plan` — My treatment plan (progress)
- [ ] `pt-pay` — Invoices & pay
- [ ] `pt-photos` — My before/after
- [ ] `pt-profile` — Profile & notifications

### U · Public surfaces
- [ ] `public-booking` — Public booking page (per‑tenant)
- [ ] `public-directory` — Discovery directory (zero‑commission network)

**Total: ~90 screens** across 20 groups + shell + index.

## Build phases
1. ✅ Design system (`app.css`) + app shell/JS (`app.js`) + 2–3 reference screens (dashboard, login) — lock the look.
2. Generate screens in parallel batches (agents produce `<main>` content using the kit; assembled into the shell).
3. Assemble `index.html` launcher; verify by rendering; publish showcase.
