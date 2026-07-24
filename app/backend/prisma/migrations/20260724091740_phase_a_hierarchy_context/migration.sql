-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" UUID,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationClinic" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "displayName" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationClinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "specialtyKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "branchId" UUID,
    "departmentId" UUID,
    "role" "UserRole" NOT NULL,
    "isDefaultContext" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContextPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastOrganizationId" UUID,
    "lastClinicId" UUID,
    "lastBranchId" UUID,
    "lastDepartmentId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContextPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "Organization_ownerUserId_idx" ON "Organization"("ownerUserId");

-- CreateIndex
CREATE INDEX "OrganizationClinic_organizationId_idx" ON "OrganizationClinic"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationClinic_tenantId_idx" ON "OrganizationClinic"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationClinic_organizationId_tenantId_key" ON "OrganizationClinic"("organizationId", "tenantId");

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");

-- CreateIndex
CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId");

-- CreateIndex
CREATE INDEX "Branch_clinicId_idx" ON "Branch"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_tenantId_code_key" ON "Branch"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Department_branchId_idx" ON "Department"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_branchId_name_key" ON "Department"("branchId", "name");

-- CreateIndex
CREATE INDEX "UserMembership_userId_isActive_idx" ON "UserMembership"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserMembership_tenantId_idx" ON "UserMembership"("tenantId");

-- CreateIndex
CREATE INDEX "UserMembership_organizationId_idx" ON "UserMembership"("organizationId");

-- CreateIndex
CREATE INDEX "UserMembership_clinicId_idx" ON "UserMembership"("clinicId");

-- CreateIndex
CREATE INDEX "UserMembership_branchId_idx" ON "UserMembership"("branchId");

-- CreateIndex
CREATE INDEX "UserMembership_departmentId_idx" ON "UserMembership"("departmentId");

-- CreateIndex
CREATE INDEX "UserContextPreference_lastOrganizationId_idx" ON "UserContextPreference"("lastOrganizationId");

-- CreateIndex
CREATE INDEX "UserContextPreference_lastClinicId_idx" ON "UserContextPreference"("lastClinicId");

-- CreateIndex
CREATE INDEX "UserContextPreference_lastBranchId_idx" ON "UserContextPreference"("lastBranchId");

-- CreateIndex
CREATE INDEX "UserContextPreference_lastDepartmentId_idx" ON "UserContextPreference"("lastDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserContextPreference_userId_key" ON "UserContextPreference"("userId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationClinic" ADD CONSTRAINT "OrganizationClinic_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationClinic" ADD CONSTRAINT "OrganizationClinic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "OrganizationClinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "OrganizationClinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContextPreference" ADD CONSTRAINT "UserContextPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContextPreference" ADD CONSTRAINT "UserContextPreference_lastOrganizationId_fkey" FOREIGN KEY ("lastOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContextPreference" ADD CONSTRAINT "UserContextPreference_lastClinicId_fkey" FOREIGN KEY ("lastClinicId") REFERENCES "OrganizationClinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContextPreference" ADD CONSTRAINT "UserContextPreference_lastBranchId_fkey" FOREIGN KEY ("lastBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContextPreference" ADD CONSTRAINT "UserContextPreference_lastDepartmentId_fkey" FOREIGN KEY ("lastDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
