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
