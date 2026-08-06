-- Release 1 Phase 1 — attribution columns.
--
-- Four columns across three tables. Every one of them is nullable, so this
-- migration is non-destructive against existing rows. The invariants they
-- enable — doctor share, revenue-by-service, one-Employee-per-User — are
-- unrecoverable from historical data, so the columns must exist BEFORE any
-- more rows are written. This is the "irreversible if deferred" work the
-- audit called highest-ratio in Phase 1.

-- InvoiceLineItem: which catalogue item this line billed, and who performed it.
ALTER TABLE "InvoiceLineItem" ADD COLUMN "serviceCatalogItemId" UUID;
ALTER TABLE "InvoiceLineItem" ADD COLUMN "performedById" UUID;

-- Appointment: which catalogue item was booked. `service` (free text) stays
-- for display; the FK closes the loop to the catalogue.
ALTER TABLE "Appointment" ADD COLUMN "serviceCatalogItemId" UUID;

-- Employee: the User row this employee is (a doctor whose commission goes
-- onto their payslip). At-most-one Employee per User globally — see the
-- long comment in schema.prisma. NULLs are allowed and distinct in Postgres,
-- so unmapped employees do not collide.
ALTER TABLE "Employee" ADD COLUMN "userId" UUID;
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- Indexes to make the new joins cheap. Every query the columns unlock reads
-- from InvoiceLineItem / Appointment BY the joined column, so a plain B-tree
-- on each pays off from the first query.
CREATE INDEX "InvoiceLineItem_performedById_idx" ON "InvoiceLineItem"("performedById");
CREATE INDEX "InvoiceLineItem_serviceCatalogItemId_idx" ON "InvoiceLineItem"("serviceCatalogItemId");
CREATE INDEX "Appointment_serviceCatalogItemId_idx" ON "Appointment"("serviceCatalogItemId");

-- Foreign keys. NOT VALID is deliberate: we skip the up-front scan for
-- existing rows (all NULL) because every value is NULL. New writes are
-- validated normally. If a later cleanup wants to VALIDATE the constraint,
-- it can — it will pass trivially.
ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "InvoiceLineItem_serviceCatalogItemId_fkey"
  FOREIGN KEY ("serviceCatalogItemId") REFERENCES "ServiceCatalogItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "InvoiceLineItem_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_serviceCatalogItemId_fkey"
  FOREIGN KEY ("serviceCatalogItemId") REFERENCES "ServiceCatalogItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
