-- CreateTable
CREATE TABLE "DispenseItemBatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "dispenseItemId" UUID NOT NULL,
    "batchNo" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiry" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispenseItemBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DispenseItemBatch_tenantId_idx" ON "DispenseItemBatch"("tenantId");

-- CreateIndex
CREATE INDEX "DispenseItemBatch_dispenseItemId_idx" ON "DispenseItemBatch"("dispenseItemId");

-- CreateIndex
CREATE INDEX "DispenseItemBatch_tenantId_batchNo_idx" ON "DispenseItemBatch"("tenantId", "batchNo");

-- AddForeignKey
ALTER TABLE "DispenseItemBatch" ADD CONSTRAINT "DispenseItemBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseItemBatch" ADD CONSTRAINT "DispenseItemBatch_dispenseItemId_fkey" FOREIGN KEY ("dispenseItemId") REFERENCES "DispenseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

