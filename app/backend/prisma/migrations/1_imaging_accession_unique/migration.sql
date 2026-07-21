-- CreateIndex
CREATE UNIQUE INDEX "ImagingOrder_tenantId_accessionNumber_key" ON "ImagingOrder"("tenantId", "accessionNumber");

