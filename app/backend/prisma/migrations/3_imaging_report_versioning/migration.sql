-- CreateEnum
CREATE TYPE "ImagingReportStatus" AS ENUM ('PRELIMINARY', 'FINAL', 'APPENDED', 'CORRECTED', 'AMENDED', 'ENTERED_IN_ERROR');

-- DropIndex
DROP INDEX "ImagingReport_tenantId_orderId_studyCode_key";

-- AlterTable
ALTER TABLE "ImagingReport" ADD COLUMN     "amendmentReason" TEXT,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "ImagingReportStatus" NOT NULL DEFAULT 'FINAL',
ADD COLUMN     "supersedesReportId" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ImagingReportCommunication" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "recipientName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "communicatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "recordedById" UUID,
    "note" TEXT,

    CONSTRAINT "ImagingReportCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImagingReportCommunication_tenantId_idx" ON "ImagingReportCommunication"("tenantId");

-- CreateIndex
CREATE INDEX "ImagingReportCommunication_reportId_idx" ON "ImagingReportCommunication"("reportId");

-- CreateIndex
CREATE INDEX "ImagingReport_supersedesReportId_idx" ON "ImagingReport"("supersedesReportId");

-- AddForeignKey
ALTER TABLE "ImagingReport" ADD CONSTRAINT "ImagingReport_supersedesReportId_fkey" FOREIGN KEY ("supersedesReportId") REFERENCES "ImagingReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingReportCommunication" ADD CONSTRAINT "ImagingReportCommunication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingReportCommunication" ADD CONSTRAINT "ImagingReportCommunication_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ImagingReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

