# Universal Clinic Management SaaS
## Gap to Backlog Blueprint (Based on Current Codebase)

Date: 2026-07-24
Status: Actionable execution plan

## 1) Executive Summary

You already have a strong modular multi-tenant foundation with:
- Tenant isolation pattern (tenant context + RLS architecture)
- Entitlement-gated modules
- Specialty pack manifest model
- Core verticals (patients, appointments, billing, pharmacy, lab, CRM, HR/payroll, reporting)

The main gap is not the core engine. The main gap is product structure for multi-clinic ownership and enterprise operations:
- Missing Organization -> Clinic -> Branch -> Department hierarchy
- Missing cross-clinic user membership and clinic switch flow
- Missing fine-grained permission model (branch-scoped action permissions)
- Missing admin-facing form builder and rules builder (currently config is mostly pack-driven)
- Missing subscription lifecycle controls and quota governance in Platform Admin

This document converts those gaps into precise data model, API, UI, and phase deliverables.

---

## 2) Current State vs Target State

### 2.1 Current state (confirmed)
- Primary ownership unit is tenant/clinic-centric.
- Facility exists but does not represent full branch hierarchy.
- Role checks are mostly role enum + guards, not permission matrix.
- Specialty packs seed templates/config but no full self-serve builder for clinic admins.
- Platform admin onboarding exists for create/list clinic, but lifecycle controls are limited.

### 2.2 Target state (your original principle)
Build one universal clinic operating system where:
- Core is shared
- Specialty is configuration
- Multi-clinic owners operate under one organization account
- Modules, quotas, and permissions are managed centrally and safely

---

## 3) Data Model Upgrade (Exact Table Backlog)

Create these new tables first (do not break existing tenant data; add migration + backfill adapters).

### 3.1 Hierarchy and Membership
1. Organization
- id (uuid)
- code (unique)
- name
- ownerUserId (nullable for staged onboarding)
- status (ACTIVE, SUSPENDED, DEACTIVATED)
- timezone
- currency
- createdAt, updatedAt

2. OrganizationClinic
- id (uuid)
- organizationId (fk)
- tenantId (fk to existing Tenant)
- displayName
- isPrimary
- createdAt
- unique (organizationId, tenantId)

3. Branch
- id (uuid)
- tenantId (fk)
- organizationId (fk)
- clinicId (fk OrganizationClinic)
- name
- code
- phone
- email
- addressLine1, addressLine2, city, region, postalCode, country
- timezone
- isActive
- createdAt, updatedAt
- unique (tenantId, code)

4. Department
- id (uuid)
- tenantId
- branchId
- name
- specialtyKey (ex: dermatology, dental, pediatrics)
- isActive
- createdAt
- unique (branchId, name)

5. UserMembership
- id
- userId
- organizationId
- tenantId
- clinicId
- branchId (nullable for all-branches scope)
- departmentId (nullable)
- roleId
- isDefaultContext
- isActive
- createdAt
- index (userId, isActive)

6. UserContextPreference
- id
- userId
- lastOrganizationId
- lastClinicId
- lastBranchId
- updatedAt

### 3.2 RBAC v2 (permission matrix)
7. Role
- id
- tenantId (nullable for system roles)
- key
- name
- isSystem
- createdAt

8. Permission
- id
- moduleKey (appointments, billing, emr, etc)
- actionKey (view, create, edit, delete, approve, export, refund, discount)
- resourceKey (invoice, patient, treatmentPlan, etc)
- unique (moduleKey, actionKey, resourceKey)

9. RolePermission
- id
- roleId
- permissionId
- effect (ALLOW, DENY)
- unique (roleId, permissionId)

10. MembershipScope
- id
- membershipId
- scopeType (ORGANIZATION, CLINIC, BRANCH, DEPARTMENT)
- scopeId
- unique (membershipId, scopeType, scopeId)

### 3.3 Subscription and Quotas
11. SubscriptionPackage
- id
- key
- name
- billingCycle
- pricePkr, priceUsd
- isActive

12. PackageModule
- id
- packageId
- moduleKey
- enabledByDefault
- unique (packageId, moduleKey)

13. TenantModuleOverride
- id
- tenantId
- moduleKey
- enabled
- source (PACKAGE, MANUAL, PROMO)
- unique (tenantId, moduleKey)

14. TenantQuota
- id
- tenantId
- quotaKey (users, patients, branches, storageGb)
- softLimit
- hardLimit
- unique (tenantId, quotaKey)

15. TenantUsageCounter
- id
- tenantId
- usageKey
- value
- sampledAt

16. SubscriptionLifecycleEvent
- id
- tenantId
- eventType (ACTIVATE, SUSPEND, RESUME, DEACTIVATE, UPGRADE, DOWNGRADE, RENEW)
- oldPackageId
- newPackageId
- actorUserId
- reason
- createdAt

### 3.4 Config Engine (Forms + Rules)
17. FormTemplate
- id
- tenantId
- specialtyKey (nullable)
- departmentId (nullable)
- formType (patient_intake, consultation, consent, followup, prescription)
- name
- version
- status (DRAFT, PUBLISHED, ARCHIVED)
- schemaJson
- uiSchemaJson
- createdById
- publishedAt
- unique (tenantId, formType, name, version)

18. FormFieldRegistry
- id
- tenantId
- fieldKey
- label
- dataType
- validationJson
- optionsJson
- isReusable
- unique (tenantId, fieldKey)

19. FormTemplateBinding
- id
- tenantId
- formTemplateId
- branchId (nullable)
- departmentId (nullable)
- roleId (nullable)
- encounterType (nullable)

20. ClinicalRule
- id
- tenantId
- specialtyKey
- ruleType (dose_limit, session_interval, age_restriction, contraindication, required_consent, required_test)
- name
- conditionJson
- actionJson
- severity (INFO, WARN, BLOCK)
- isActive
- createdAt

21. RuleExecutionLog
- id
- tenantId
- patientId
- encounterId
- ruleId
- outcome (PASSED, WARNED, BLOCKED, OVERRIDDEN)
- message
- approvedByDoctorId (nullable)
- createdAt

### 3.5 Finance and Commission
22. CommissionScheme
- id
- tenantId
- name
- basisType (FIXED_PER_SERVICE, PERCENT_COLLECTION, PERCENT_NET_AFTER_CONSUMABLE, PER_SESSION)
- ruleJson
- isActive

23. StaffCommissionAssignment
- id
- tenantId
- staffUserId
- schemeId
- effectiveFrom
- effectiveTo

24. RevenueShareLedger
- id
- tenantId
- invoiceId
- paymentId
- branchId
- doctorShare
- technicianShare
- salesShare
- clinicShare
- createdAt

### 3.6 Attendance and Payroll Inputs
25. AttendanceDevice
- id
- tenantId
- branchId
- providerType (CAMERA, BIOMETRIC, API)
- externalKey
- isActive

26. AttendanceLog
- id
- tenantId
- branchId
- employeeId
- eventType (ENTRY, EXIT, BREAK_START, BREAK_END)
- eventAt
- source

27. ShiftDefinition
- id
- tenantId
- branchId
- name
- startTime
- endTime
- graceMinutes

28. LeaveRequest
- id
- tenantId
- employeeId
- leaveType
- startDate
- endDate
- status
- approvedById

---

## 4) API Structure Backlog (Exact Endpoint Families)

Use versioned route namespace: /v1.

### 4.1 Platform Admin APIs
1. Organizations
- POST /v1/platform/organizations
- GET /v1/platform/organizations
- GET /v1/platform/organizations/:id
- PATCH /v1/platform/organizations/:id
- POST /v1/platform/organizations/:id/suspend
- POST /v1/platform/organizations/:id/activate

2. Tenant onboarding and lifecycle
- POST /v1/platform/tenants/onboard
- POST /v1/platform/tenants/:tenantId/suspend
- POST /v1/platform/tenants/:tenantId/resume
- POST /v1/platform/tenants/:tenantId/deactivate
- POST /v1/platform/tenants/:tenantId/change-package
- GET /v1/platform/tenants/:tenantId/usage
- PATCH /v1/platform/tenants/:tenantId/quotas

3. Support access
- POST /v1/platform/support/sessions
- DELETE /v1/platform/support/sessions/:id
- GET /v1/platform/support/sessions/audit

### 4.2 Organization Admin APIs
4. Context and switch
- GET /v1/me/contexts
- POST /v1/me/context/select

5. Clinics, branches, departments
- POST /v1/org/clinics
- GET /v1/org/clinics
- POST /v1/org/clinics/:clinicId/branches
- GET /v1/org/clinics/:clinicId/branches
- PATCH /v1/org/branches/:branchId
- POST /v1/org/branches/:branchId/departments
- GET /v1/org/branches/:branchId/departments

6. Membership and RBAC
- POST /v1/org/memberships
- PATCH /v1/org/memberships/:id
- POST /v1/org/roles
- GET /v1/org/roles
- POST /v1/org/roles/:roleId/permissions

### 4.3 Configuration Engine APIs
7. Form builder
- POST /v1/config/forms
- GET /v1/config/forms
- GET /v1/config/forms/:id
- PATCH /v1/config/forms/:id
- POST /v1/config/forms/:id/publish
- POST /v1/config/forms/:id/bindings

8. Rules engine
- POST /v1/config/rules
- GET /v1/config/rules
- PATCH /v1/config/rules/:id
- POST /v1/config/rules/:id/activate
- POST /v1/config/rules/:id/deactivate

### 4.4 Module and quota controls
9. Modules
- GET /v1/subscription/modules
- PATCH /v1/subscription/modules/:moduleKey

10. Quotas
- GET /v1/subscription/quotas
- GET /v1/subscription/usage

### 4.5 Clinical safety and audit
11. Approvals and override logs
- POST /v1/clinical/rules/:ruleId/override
- GET /v1/clinical/rule-executions

---

## 5) Screen List Backlog (Web UI)

### 5.1 Platform Super Admin Portal
1. Organizations list
2. Organization detail
3. New organization + clinic onboarding wizard
4. Tenant lifecycle actions (activate/suspend/deactivate)
5. Package and module assignment screen
6. Quota and usage dashboard
7. Support access console with justification and expiry
8. Platform health and activity audit screen

### 5.2 Organization Super Admin
9. Multi-clinic dashboard (consolidated KPIs)
10. Clinic switcher modal/dropdown
11. Clinic-level dashboard
12. Branch management
13. Department management
14. Membership and role assignment
15. Role-permission matrix editor
16. Subscription and module visibility screen
17. Quota consumption screen

### 5.3 Config Builder
18. Form template list
19. Form template designer (drag/drop fields + conditional logic)
20. Form publish/version history
21. Form bindings by branch/department
22. Clinical rules list
23. Rule editor (conditions/actions)
24. Rule simulation/test runner (safe mode)

### 5.4 Domain screens to finish/upgrade
25. CRM pipeline board with source attribution
26. Finance share and commission dashboard
27. Attendance monitor screen (live in/out)
28. Payroll run screen with attendance and commissions included
29. Report center with org, clinic, branch filters

---

## 6) MVP Scope (Release 1)

Release 1 must include universal core plus Dermatology and Aesthetic, while preserving future configurability.

### 6.1 Must have
- Organization, Clinic, Branch, Department hierarchy
- User memberships with context switching
- Entitlement + module control retained and upgraded
- Form builder v1 (patient intake, consultation, consent)
- Rule engine v1 (warn/block rules, doctor override)
- Dermatology/Aesthetic pack integration through config layer
- Branch-aware billing and reporting basics

### 6.2 Can defer to Release 2
- Full finance revenue share automation
- Camera attendance hardware integrations beyond one connector
- Advanced campaign attribution and cross-channel analytics
- Deep external ecosystem integrations

---

## 7) Delivery Phases with Acceptance Criteria

## Phase A: Foundation Refactor (3 to 4 weeks)
Deliverables:
- Add hierarchy and membership tables
- Add context selection token/session model
- Keep old tenant paths backward-compatible

Acceptance:
- One user can access multiple clinics under same organization
- Clinic switch without logout works
- Branch-scoped data queries enforced

## Phase B: RBAC v2 + Subscription Controls (2 to 3 weeks)
Deliverables:
- Role/permission matrix
- Membership scope enforcement
- Quota tables and usage counters
- Platform lifecycle controls

Acceptance:
- Permission checks are action-level, not role-only
- Tenant suspension blocks protected operations safely
- Quota violations produce deterministic errors

## Phase C: Config Engine v1 (3 to 4 weeks)
Deliverables:
- Form templates, publishing, bindings
- Rules definition and execution logging
- Doctor override capture and audit

Acceptance:
- Clinic admin can create and publish forms without code change
- Rule outcomes logged for every evaluated event
- Override requires authorized doctor identity

## Phase D: Dermatology/Aesthetic First Productization (2 to 3 weeks)
Deliverables:
- Bind current derma flows to form/rule/config layers
- Finalize branch-aware reports for this specialty

Acceptance:
- New dermatology clinic onboarding requires zero code changes
- All required derma forms and consents configured via builder

## Phase E: Expansion Packs and Ops Hardening (ongoing)
Deliverables:
- Dental, Pediatrics, GP, Physiotherapy through same config pattern
- Support tooling, migration playbooks, QA automation

Acceptance:
- New specialty onboarding is manifest/config work, not core rebuild

---

## 8) API and Migration Strategy (No Breakage)

1. Introduce /v1 endpoints while keeping existing endpoints operational.
2. Add compatibility adapters mapping old tenant/facility assumptions to new hierarchy context.
3. Migrate UI in slices:
- auth/context first
- hierarchy screens second
- config screens third
- specialty pages fourth
4. Add migration scripts:
- one-time backfill: Tenant -> Organization + Clinic + default Branch
- user membership seeding from current role model

---

## 9) Risk Register and Controls

1. Risk: RLS and scope regressions in hierarchy migration.
- Control: mandatory cross-scope security integration tests before release.

2. Risk: Permission complexity causes accidental lockout.
- Control: seeded default roles + emergency owner fallback role.

3. Risk: Over-flexible form/rules builder causes unsafe clinical states.
- Control: rule validation, safe defaults, doctor mandatory approval on critical actions.

4. Risk: Data migration inconsistency.
- Control: rehearsal migrations + rollback snapshots + row-count reconciliation scripts.

---

## 10) Immediate Task Breakdown (Sprint-Ready)

### Sprint 1
- Create Organization, OrganizationClinic, Branch, Department, UserMembership tables
- Build context selection API and token/session propagation
- Build clinic switcher UI component

### Sprint 2
- Implement Role, Permission, RolePermission, MembershipScope
- Replace role-only checks for 3 critical modules (patients, billing, reports)
- Add baseline platform lifecycle endpoints

### Sprint 3
- Implement FormTemplate and FormTemplateBinding APIs + simple builder UI
- Implement ClinicalRule + execution log with warn/block behavior
- Integrate with dermatology consultation flow

### Sprint 4
- Branch-aware reports, quota controls, support audit access
- Hardening, QA, UAT, go-live checklist

---

## 11) Definition of Done (Program Level)

Done means:
1. One organization can manage multiple clinics and branches in one account.
2. Clinic switch works without re-authentication.
3. Module and quota controls are enforceable from Platform Admin.
4. Forms and rules are configurable by admins without code deployment.
5. Dermatology/Aesthetic onboarding works through configuration.
6. Adding next specialty does not require core architecture rewrite.

---

## 12) Final Recommendation

Do not rewrite the system from zero.
Your current base is valuable and already aligned with the universal-core direction.

Best path:
- Preserve existing tenant-isolated module engine
- Upgrade ownership hierarchy, permissions, and config tooling
- Productize with phased migrations and strict security regression tests

This gets you back to the original principle without losing the progress already made.
