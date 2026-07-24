-- Row-Level Security policies for Health OS multi-tenancy.
--
-- Run this AFTER `prisma migrate` (or `prisma db push`) has created the tables,
-- e.g.  psql "$DATABASE_URL" -f prisma/rls.sql
--
-- Each tenant-scoped table is isolated by comparing its `tenantId` column
-- against the `app.tenant_id` GUC that PrismaService.forTenant() sets via
--   SELECT set_config('app.tenant_id', $tenantId, true)
-- inside the request transaction.
--
-- TWO THINGS THIS FILE GETS WRONG IF READ NAIVELY:
--
-- 1. "unset context yields NULL and matches no rows" is only true on a
--    connection where app.tenant_id was NEVER set. After the first
--    set_config(..., is_local=true) transaction, commit resets the GUC to the
--    EMPTY STRING — not to unset — and ''::uuid RAISES rather than matching
--    nothing. On a pooled connection that turns fail-closed into a 500.
--    prisma/rls-user.sql rewrites every policy below into the nullif() form:
--      "tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid
--    which is genuinely fail-closed for BOTH the unset and empty states. Write
--    new policies in that form. NEVER add an `OR current_setting(...) = ''`
--    branch: that grants cross-tenant reads whenever context is missing.
--
-- 2. These policies are INERT unless the connecting role is NOSUPERUSER and
--    NOBYPASSRLS — Postgres skips RLS entirely for a bypassing role, silently.
--    The runtime connects as healthos_app (prisma/rls-roles.sql) and
--    PrismaService refuses to boot otherwise. FORCE ROW LEVEL SECURITY does
--    NOT cover this; it only subjects a non-bypassing owner to policies.
--
-- "User" is NOT policied here — it needs a bespoke setup (login runs before
-- tenant context exists). See prisma/rls-user.sql.
--
-- NOTE: Prisma maps model field `tenantId` to a quoted column "tenantId"
-- (camelCase). The policies below reference that quoted identifier.

-- ---------------------------------------------------------------------------
-- Facility
-- ---------------------------------------------------------------------------
ALTER TABLE "Facility" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Facility" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Facility";
CREATE POLICY tenant_isolation ON "Facility"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Patient
-- ---------------------------------------------------------------------------
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Patient";
CREATE POLICY tenant_isolation ON "Patient"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Appointment
-- ---------------------------------------------------------------------------
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Appointment";
CREATE POLICY tenant_isolation ON "Appointment"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Invoice
-- ---------------------------------------------------------------------------
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Invoice";
CREATE POLICY tenant_isolation ON "Invoice"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Payment
-- ---------------------------------------------------------------------------
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Payment";
CREATE POLICY tenant_isolation ON "Payment"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Subscription
-- ---------------------------------------------------------------------------
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Subscription";
CREATE POLICY tenant_isolation ON "Subscription"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- TenantEntitlement
-- ---------------------------------------------------------------------------
ALTER TABLE "TenantEntitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantEntitlement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TenantEntitlement";
CREATE POLICY tenant_isolation ON "TenantEntitlement"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Specialty-pack layer (tenant-scoped tables)
--
-- Pack / PackVersion / InstrumentDefinition are GLOBAL catalog/reference data
-- (no tenantId) and are intentionally NOT covered by RLS. The rows a tenant
-- creates by activating a pack live in the tables below.
-- ---------------------------------------------------------------------------

ALTER TABLE "PackActivation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PackActivation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PackActivation";
CREATE POLICY tenant_isolation ON "PackActivation"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ServiceCatalogItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceCatalogItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ServiceCatalogItem";
CREATE POLICY tenant_isolation ON "ServiceCatalogItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "NoteTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NoteTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NoteTemplate";
CREATE POLICY tenant_isolation ON "NoteTemplate"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "IntakeFieldGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeFieldGroup" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IntakeFieldGroup";
CREATE POLICY tenant_isolation ON "IntakeFieldGroup"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "OrderSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderSet" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderSet";
CREATE POLICY tenant_isolation ON "OrderSet"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "TrendChartDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrendChartDefinition" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TrendChartDefinition";
CREATE POLICY tenant_isolation ON "TrendChartDefinition"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "TrendAnnotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrendAnnotation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TrendAnnotation";
CREATE POLICY tenant_isolation ON "TrendAnnotation"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ScoredInstrumentResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScoredInstrumentResponse" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ScoredInstrumentResponse";
CREATE POLICY tenant_isolation ON "ScoredInstrumentResponse"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Observation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Observation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Observation";
CREATE POLICY tenant_isolation ON "Observation"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ConsentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentRecord" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ConsentRecord";
CREATE POLICY tenant_isolation ON "ConsentRecord"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PhotoSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PhotoSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PhotoSession";
CREATE POLICY tenant_isolation ON "PhotoSession"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PhotoAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PhotoAsset" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PhotoAsset";
CREATE POLICY tenant_isolation ON "PhotoAsset"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- EMR / encounter layer
ALTER TABLE "Encounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Encounter" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Encounter";
CREATE POLICY tenant_isolation ON "Encounter"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "IntakeSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeSubmission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IntakeSubmission";
CREATE POLICY tenant_isolation ON "IntakeSubmission"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "NoteInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NoteInstance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NoteInstance";
CREATE POLICY tenant_isolation ON "NoteInstance"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "TreatmentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentPlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TreatmentPlan";
CREATE POLICY tenant_isolation ON "TreatmentPlan"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "TreatmentPlanItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentPlanItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TreatmentPlanItem";
CREATE POLICY tenant_isolation ON "TreatmentPlanItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLineItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "InvoiceLineItem";
CREATE POLICY tenant_isolation ON "InvoiceLineItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PaymentIntent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentIntent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PaymentIntent";
CREATE POLICY tenant_isolation ON "PaymentIntent"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Refund" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Refund";
CREATE POLICY tenant_isolation ON "Refund"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Immunization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Immunization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Immunization";
CREATE POLICY tenant_isolation ON "Immunization"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ToothRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ToothRecord" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ToothRecord";
CREATE POLICY tenant_isolation ON "ToothRecord"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "LabOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabOrder" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LabOrder";
CREATE POLICY tenant_isolation ON "LabOrder"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "LabOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabOrderItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LabOrderItem";
CREATE POLICY tenant_isolation ON "LabOrderItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "LabResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabResult" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LabResult";
CREATE POLICY tenant_isolation ON "LabResult"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "StockItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StockItem";
CREATE POLICY tenant_isolation ON "StockItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Dispense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dispense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Dispense";
CREATE POLICY tenant_isolation ON "Dispense"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "DispenseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DispenseItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DispenseItem";
CREATE POLICY tenant_isolation ON "DispenseItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Employee";
CREATE POLICY tenant_isolation ON "Employee"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PayrollRun";
CREATE POLICY tenant_isolation ON "PayrollRun"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Payslip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payslip" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Payslip";
CREATE POLICY tenant_isolation ON "Payslip"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Ward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ward" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Ward";
CREATE POLICY tenant_isolation ON "Ward"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Bed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bed" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Bed";
CREATE POLICY tenant_isolation ON "Bed"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Admission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Admission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Admission";
CREATE POLICY tenant_isolation ON "Admission"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Lead";
CREATE POLICY tenant_isolation ON "Lead"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadActivity" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LeadActivity";
CREATE POLICY tenant_isolation ON "LeadActivity"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ImagingOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImagingOrder" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ImagingOrder";
CREATE POLICY tenant_isolation ON "ImagingOrder"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ImagingOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImagingOrderItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ImagingOrderItem";
CREATE POLICY tenant_isolation ON "ImagingOrderItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ImagingReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImagingReport" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ImagingReport";
CREATE POLICY tenant_isolation ON "ImagingReport"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);
-- ---------------------------------------------------------------------------
-- User / AuditLog — RLS decision (audit hardening)
-- ---------------------------------------------------------------------------
--
-- User: intentionally NOT under row-level security. Authentication looks a user
-- up by email (AuthService.validateUser) BEFORE any tenant context exists — the
-- request is anonymous at that point, so `app.tenant_id` is unset. Forcing RLS
-- here would make the login lookup return zero rows under a non-superuser role
-- and break sign-in for everyone. The `tenantId` column + application-level
-- scoping (controllers run inside a tenant context) govern who may list/manage
-- users; the table itself must stay reachable for the pre-auth lookup.
--
-- AuditLog: tenant-scoped, so we enable tenant isolation for defense in depth
-- (there is no cross-tenant read path). `tenantId` is nullable for platform-
-- level events; those rows are only reachable via the platform-admin path,
-- which in this build connects as a superuser (RLS bypassed). In production a
-- dedicated platform role/policy would be added for cross-tenant audit review.

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Obstetrics & Gynaecology pack (pack.obgyn) — tenant isolation
-- ---------------------------------------------------------------------------

ALTER TABLE "PregnancyEpisode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PregnancyEpisode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PregnancyEpisode";
CREATE POLICY tenant_isolation ON "PregnancyEpisode"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "AncVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AncVisit" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AncVisit";
CREATE POLICY tenant_isolation ON "AncVisit"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ObstetricUltrasound" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ObstetricUltrasound" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ObstetricUltrasound";
CREATE POLICY tenant_isolation ON "ObstetricUltrasound"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Partogram" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Partogram" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Partogram";
CREATE POLICY tenant_isolation ON "Partogram"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PartogramEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartogramEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PartogramEntry";
CREATE POLICY tenant_isolation ON "PartogramEntry"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "GynaeProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GynaeProfile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "GynaeProfile";
CREATE POLICY tenant_isolation ON "GynaeProfile"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "DoseCalculationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DoseCalculationLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DoseCalculationLog";
CREATE POLICY tenant_isolation ON "DoseCalculationLog"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PerioExam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerioExam" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PerioExam";
CREATE POLICY tenant_isolation ON "PerioExam"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PerioToothRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerioToothRecord" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PerioToothRecord";
CREATE POLICY tenant_isolation ON "PerioToothRecord"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ToothPlanItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ToothPlanItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ToothPlanItem";
CREATE POLICY tenant_isolation ON "ToothPlanItem"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "OrthoCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrthoCase" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrthoCase";
CREATE POLICY tenant_isolation ON "OrthoCase"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "OrthoEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrthoEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrthoEvent";
CREATE POLICY tenant_isolation ON "OrthoEvent"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "EyeExam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EyeExam" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "EyeExam";
CREATE POLICY tenant_isolation ON "EyeExam"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "VisualAcuityMeasure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisualAcuityMeasure" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "VisualAcuityMeasure";
CREATE POLICY tenant_isolation ON "VisualAcuityMeasure"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Refraction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Refraction" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Refraction";
CREATE POLICY tenant_isolation ON "Refraction"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "IopMeasurement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IopMeasurement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IopMeasurement";
CREATE POLICY tenant_isolation ON "IopMeasurement"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "EyeSegmentFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EyeSegmentFinding" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "EyeSegmentFinding";
CREATE POLICY tenant_isolation ON "EyeSegmentFinding"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "OpticalPrescription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OpticalPrescription" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OpticalPrescription";
CREATE POLICY tenant_isolation ON "OpticalPrescription"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "RehabEpisode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RehabEpisode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RehabEpisode";
CREATE POLICY tenant_isolation ON "RehabEpisode"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "MskAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MskAssessment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MskAssessment";
CREATE POLICY tenant_isolation ON "MskAssessment"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "RomMeasurement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RomMeasurement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RomMeasurement";
CREATE POLICY tenant_isolation ON "RomMeasurement"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "RehabSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RehabSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RehabSession";
CREATE POLICY tenant_isolation ON "RehabSession"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "ExercisePrescription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExercisePrescription" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ExercisePrescription";
CREATE POLICY tenant_isolation ON "ExercisePrescription"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PhototherapyCourse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PhototherapyCourse" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PhototherapyCourse";
CREATE POLICY tenant_isolation ON "PhototherapyCourse"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "PhototherapySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PhototherapySession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PhototherapySession";
CREATE POLICY tenant_isolation ON "PhototherapySession"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "SkinLesion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkinLesion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SkinLesion";
CREATE POLICY tenant_isolation ON "SkinLesion"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "DoseRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DoseRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DoseRule";
CREATE POLICY tenant_isolation ON "DoseRule"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Prescription — the order produced by a committed dose calculation.
-- ---------------------------------------------------------------------------
ALTER TABLE "Prescription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prescription" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Prescription";
CREATE POLICY tenant_isolation ON "Prescription"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- ToothFinding — append-only dental chart history.
-- ---------------------------------------------------------------------------
ALTER TABLE "ToothFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ToothFinding" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ToothFinding";
CREATE POLICY tenant_isolation ON "ToothFinding"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Cold chain + AEFI
-- ---------------------------------------------------------------------------
ALTER TABLE "VaccineBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VaccineBatch" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "VaccineBatch";
CREATE POLICY tenant_isolation ON "VaccineBatch"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Aefi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Aefi" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Aefi";
CREATE POLICY tenant_isolation ON "Aefi"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- DispenseItemBatch
-- ---------------------------------------------------------------------------
ALTER TABLE "DispenseItemBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DispenseItemBatch" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DispenseItemBatch";
CREATE POLICY tenant_isolation ON "DispenseItemBatch"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- ImagingReportCommunication
-- ---------------------------------------------------------------------------
ALTER TABLE "ImagingReportCommunication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImagingReportCommunication" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ImagingReportCommunication";
CREATE POLICY tenant_isolation ON "ImagingReportCommunication"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Phase A hierarchy
-- ---------------------------------------------------------------------------

ALTER TABLE "OrganizationClinic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationClinic" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrganizationClinic";
CREATE POLICY tenant_isolation ON "OrganizationClinic"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Branch";
CREATE POLICY tenant_isolation ON "Branch"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Department";
CREATE POLICY tenant_isolation ON "Department"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "UserMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserMembership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "UserMembership";
CREATE POLICY tenant_isolation ON "UserMembership"
  USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Organization has no tenantId column by design; scope through its clinic links.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Organization";
CREATE POLICY tenant_isolation ON "Organization"
  USING (
    EXISTS (
      SELECT 1
      FROM "OrganizationClinic" oc
      WHERE oc."organizationId" = "Organization"."id"
        AND oc."tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
  )
  WITH CHECK (
    (
      "ownerUserId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "User" u
        WHERE u."id" = "Organization"."ownerUserId"
          AND u."tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid
      )
    )
    OR EXISTS (
      SELECT 1
      FROM "OrganizationClinic" oc
      WHERE oc."organizationId" = "Organization"."id"
        AND oc."tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
  );

-- UserContextPreference has no tenantId column; scope through the owning user.
ALTER TABLE "UserContextPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserContextPreference" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "UserContextPreference";
CREATE POLICY tenant_isolation ON "UserContextPreference"
  USING (
    EXISTS (
      SELECT 1
      FROM "User" u
      WHERE u."id" = "UserContextPreference"."userId"
        AND u."tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
  );
