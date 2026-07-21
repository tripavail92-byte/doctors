-- Data-integrity constraints that Prisma's schema cannot express (partial /
-- filtered unique indexes). Run after `prisma db push`, alongside the rls-*.sql
-- files. Idempotent: safe to re-run.

-- One ADMITTED admission per patient, per tenant.
--
-- admit() checked "is this patient already admitted?" with a lockless read, then
-- created the admission. Two concurrent admits of the same patient to different
-- beds both passed the read (the bed lock only serialises admits to the SAME
-- bed), so one patient ended up in two beds at once — reproduced 2/2. A read is
-- not a constraint; this index is. The service catches its violation and returns
-- a clean 400.
CREATE UNIQUE INDEX IF NOT EXISTS "admission_one_active_per_patient"
  ON "Admission" ("tenantId", "patientId")
  WHERE status = 'ADMITTED';

-- One invoice per treatment plan, per tenant.
--
-- Billing invoices a plan only while it is PROPOSED and flips it to ACCEPTED
-- under a row lock, so the plan bills once. But the plan's status is writable
-- from EMR, and resetting ACCEPTED -> PROPOSED re-armed that guard: one 80,000
-- plan was invoiced three times (reproduced, 240,000 PKR). The status transition
-- table in emr.service.ts now forbids the reset, but a transition rule in
-- application code is not a guarantee — this index is. Invoice.planId is the
-- provenance of the plan an invoice was raised from; partial because most
-- invoices are raised directly and carry no plan. billing catches the violation
-- and returns a clean 409.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_one_per_plan"
  ON "Invoice" ("tenantId", "planId")
  WHERE "planId" IS NOT NULL;

-- Exactly one CURRENT report per study, per tenant.
--
-- This replaces the old @@unique([tenantId, orderId, studyCode]), which made a
-- report permanently unamendable: the only way to change one was to overwrite it
-- in place, and that is precisely how a finalized "acute intracranial
-- haemorrhage" became "no acute abnormality" on the same row with the original
-- timestamp intact.
--
-- Amendments are now new rows in a version chain, so several rows share
-- (tenantId, orderId, studyCode) — but only ONE may be live. Prisma cannot
-- express a partial unique index, so it lives here. The service catches the
-- violation and returns a clean 409.
CREATE UNIQUE INDEX IF NOT EXISTS "imaging_report_one_current_per_study"
  ON "ImagingReport" ("tenantId", "orderId", "studyCode")
  WHERE "isCurrent" = true;
