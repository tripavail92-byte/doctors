-- CreateEnum
CREATE TYPE "Edition" AS ENUM ('SOLO', 'CLINIC', 'SPECIALTY', 'LAB', 'PHARMACY', 'HOSPITAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'RECEPTION', 'DOCTOR', 'SALES', 'TREATMENT', 'INVENTORY', 'FINANCE', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'UNPAID', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'SAFEPAY', 'PAYFAST', 'PAYPRO', 'POS');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'CONSUMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('ORDERED', 'COLLECTED', 'RESULTED', 'REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "ImagingOrderStatus" AS ENUM ('ORDERED', 'ACQUIRED', 'REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackTier" AS ENUM ('LIGHT', 'HEAVY');

-- CreateEnum
CREATE TYPE "PackActivationStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "TrendAggregation" AS ENUM ('RAW', 'DAILY_MEAN', 'LAST_PER_VISIT');

-- CreateEnum
CREATE TYPE "BodySide" AS ENUM ('LEFT', 'RIGHT', 'BILATERAL');

-- CreateEnum
CREATE TYPE "ConsentScope" AS ENUM ('CLINICAL_PHOTOGRAPHY', 'TREATMENT', 'DATA_SHARING', 'TELEHEALTH');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('WRITTEN', 'VERBAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('BEFORE', 'AFTER', 'PROGRESS', 'CLINICAL');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TreatmentPlanStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EddMethod" AS ENUM ('LMP', 'USG', 'CLINICAL');

-- CreateEnum
CREATE TYPE "RhFactor" AS ENUM ('POSITIVE', 'NEGATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('ACTIVE', 'DELIVERED', 'MISCARRIED', 'TERMINATED', 'ECTOPIC', 'TRANSFERRED_OUT', 'LOST_TO_FOLLOWUP');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('SVD', 'ASSISTED_VACUUM', 'ASSISTED_FORCEPS', 'ELECTIVE_CS', 'EMERGENCY_CS');

-- CreateEnum
CREATE TYPE "Presentation" AS ENUM ('CEPHALIC', 'BREECH', 'TRANSVERSE', 'OBLIQUE', 'UNSTABLE', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "DipstickResult" AS ENUM ('NIL', 'TRACE', 'PLUS_1', 'PLUS_2', 'PLUS_3', 'PLUS_4');

-- CreateEnum
CREATE TYPE "FhrMethod" AS ENUM ('DOPPLER', 'PINARD', 'CTG', 'USG');

-- CreateEnum
CREATE TYPE "OedemaGrade" AS ENUM ('NONE', 'ANKLE', 'PITTING_KNEE', 'GENERALIZED');

-- CreateEnum
CREATE TYPE "FmStatus" AS ENUM ('NORMAL', 'REDUCED', 'ABSENT', 'NA_TOO_EARLY');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('DATING', 'NT', 'ANOMALY', 'GROWTH', 'BPP', 'DOPPLER', 'CERVICAL_LENGTH');

-- CreateEnum
CREATE TYPE "PlacentaSite" AS ENUM ('ANTERIOR', 'POSTERIOR', 'FUNDAL', 'LATERAL_LEFT', 'LATERAL_RIGHT', 'LOW_LYING', 'PREVIA_MARGINAL', 'PREVIA_COMPLETE');

-- CreateEnum
CREATE TYPE "LiquorAssessment" AS ENUM ('NORMAL', 'OLIGOHYDRAMNIOS', 'POLYHYDRAMNIOS', 'ANHYDRAMNIOS');

-- CreateEnum
CREATE TYPE "MembraneStatus" AS ENUM ('INTACT', 'RUPTURED_SPONT', 'RUPTURED_ARM');

-- CreateEnum
CREATE TYPE "PartogramStatus" AS ENUM ('ACTIVE', 'DELIVERED', 'REFERRED', 'CS_DECIDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FhrDecel" AS ENUM ('NONE', 'EARLY', 'LATE', 'VARIABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AmnioticFluid" AS ENUM ('INTACT', 'CLEAR', 'MECONIUM', 'BLOOD_STAINED', 'ABSENT');

-- CreateEnum
CREATE TYPE "CycleRegularity" AS ENUM ('REGULAR', 'IRREGULAR', 'AMENORRHEA', 'OLIGOMENORRHEA');

-- CreateEnum
CREATE TYPE "FlowAmount" AS ENUM ('LIGHT', 'NORMAL', 'HEAVY', 'HEAVY_WITH_CLOTS');

-- CreateEnum
CREATE TYPE "DysmenorrheaSeverity" AS ENUM ('NONE', 'MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "ContraceptionMethod" AS ENUM ('NONE', 'OCP', 'IUCD', 'INJECTABLE', 'IMPLANT', 'CONDOM', 'TL', 'OTHER');

-- CreateEnum
CREATE TYPE "InfertilityType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "TubalTest" AS ENUM ('NONE', 'HSG', 'LAPAROSCOPY');

-- CreateEnum
CREATE TYPE "FurcationGrade" AS ENUM ('NONE', 'I', 'II', 'III');

-- CreateEnum
CREATE TYPE "DentalPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrthoCaseStatus" AS ENUM ('PLANNED', 'ACTIVE', 'RETENTION', 'COMPLETED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "OrthoEventType" AS ENUM ('RECORDS', 'BONDING', 'ADJUSTMENT', 'WIRE_CHANGE', 'ELASTICS_CHANGE', 'REPAIR', 'DEBOND', 'RETAINER_FIT', 'RETAINER_REVIEW');

-- CreateEnum
CREATE TYPE "ApplianceType" AS ENUM ('METAL_FIXED', 'CERAMIC_FIXED', 'SELF_LIGATING', 'LINGUAL', 'CLEAR_ALIGNER', 'REMOVABLE', 'FUNCTIONAL', 'RETAINER_HAWLEY', 'RETAINER_ESSIX', 'RETAINER_FIXED');

-- CreateEnum
CREATE TYPE "EyeExamStatus" AS ENUM ('IN_PROGRESS', 'SIGNED', 'AMENDED');

-- CreateEnum
CREATE TYPE "VaCondition" AS ENUM ('UNAIDED', 'PINHOLE', 'WITH_GLASSES', 'BEST_CORRECTED');

-- CreateEnum
CREATE TYPE "VaNotation" AS ENUM ('SNELLEN_6', 'SNELLEN_20', 'LOGMAR');

-- CreateEnum
CREATE TYPE "RefractionMethod" AS ENUM ('AUTOREFRACTOR', 'RETINOSCOPY', 'SUBJECTIVE', 'CYCLOPLEGIC');

-- CreateEnum
CREATE TYPE "IopMethod" AS ENUM ('GAT', 'NCT', 'ICARE', 'PERKINS', 'TONOPEN');

-- CreateEnum
CREATE TYPE "EyeSegment" AS ENUM ('ANTERIOR', 'POSTERIOR');

-- CreateEnum
CREATE TYPE "EyeStructure" AS ENUM ('LIDS', 'CONJUNCTIVA', 'CORNEA', 'ANTERIOR_CHAMBER', 'IRIS', 'PUPIL', 'LENS', 'VITREOUS', 'DISC', 'CUP_DISC_RATIO', 'MACULA', 'VESSELS', 'PERIPHERY');

-- CreateEnum
CREATE TYPE "EyeFindingStatus" AS ENUM ('NORMAL', 'ABNORMAL', 'NOT_EXAMINED');

-- CreateEnum
CREATE TYPE "RxType" AS ENUM ('GLASSES', 'CONTACT_LENS');

-- CreateEnum
CREATE TYPE "RxStatus" AS ENUM ('DRAFT', 'FINAL', 'DISPENSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RehabEpisodeStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCHARGED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "RehabSessionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PhototherapyModality" AS ENUM ('NB_UVB', 'BB_UVB', 'PUVA', 'EXCIMER');

-- CreateEnum
CREATE TYPE "PhototherapyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PhototherapyBodySite" AS ENUM ('WHOLE_BODY', 'HANDS_FEET', 'SCALP', 'LOCALIZED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ToothType" AS ENUM ('PERMANENT', 'PRIMARY', 'SUPERNUMERARY');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('EXISTING', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "VvmStage" AS ENUM ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4');

-- CreateEnum
CREATE TYPE "AefiSeverity" AS ENUM ('MINOR', 'SEVERE', 'SERIOUS');

-- CreateEnum
CREATE TYPE "AefiOutcome" AS ENUM ('RECOVERED', 'RECOVERING', 'NOT_RECOVERED', 'RECOVERED_WITH_SEQUELAE', 'DIED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "edition" "Edition" NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "edition" "Edition" NOT NULL,
    "pricePkr" INTEGER NOT NULL,
    "priceUsd" INTEGER NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFeature" (
    "planId" UUID NOT NULL,
    "featureId" UUID NOT NULL,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("planId","featureId")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantEntitlement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TenantEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "mrn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "service" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "planId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedById" UUID,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "fbrInvoiceNumber" TEXT,
    "fbrStatus" TEXT,
    "fbrSubmittedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPricePkr" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotalPkr" INTEGER NOT NULL,
    "side" "BodySide",

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immunization" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "vaccineCode" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "givenAt" TIMESTAMP(3) NOT NULL,
    "lotNumber" TEXT,
    "site" TEXT,
    "givenById" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" UUID,

    CONSTRAINT "Immunization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "toothFdi" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "surfaces" JSONB,
    "note" TEXT,
    "recordedById" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToothRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "accessionNumber" TEXT,
    "note" TEXT,
    "orderedById" UUID,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrderItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "testCode" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "pricePkr" INTEGER NOT NULL,

    CONSTRAINT "LabOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "testCode" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "valueText" TEXT,
    "unit" TEXT,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "flag" TEXT NOT NULL,
    "resultedById" UUID,
    "resultedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "formularyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "expiry" TIMESTAMP(3) NOT NULL,
    "quantityOnHand" INTEGER NOT NULL,
    "unitCostPkr" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispense" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "receiptNumber" TEXT NOT NULL,
    "totalPkr" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "dispensedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispenseItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "dispenseId" UUID NOT NULL,
    "formularyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePkr" INTEGER NOT NULL,
    "lineTotalPkr" INTEGER NOT NULL,
    "batchNo" TEXT,

    CONSTRAINT "DispenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "baseSalaryPkr" INTEGER NOT NULL,
    "allowancesPkr" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "cnic" TEXT,
    "joinDate" TIMESTAMP(3),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "totalNetPkr" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "baseSalaryPkr" INTEGER NOT NULL,
    "allowancesPkr" INTEGER NOT NULL,
    "deductionsPkr" INTEGER NOT NULL,
    "netPkr" INTEGER NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "admittingDoctorId" UUID,
    "diagnosis" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" TEXT,
    "interest" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" UUID,
    "note" TEXT,
    "convertedPatientId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "dueAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "ImagingOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "accessionNumber" TEXT,
    "note" TEXT,
    "orderedById" UUID,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingOrderItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "studyCode" TEXT NOT NULL,
    "studyName" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "pricePkr" INTEGER NOT NULL,

    CONSTRAINT "ImagingOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingReport" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "studyCode" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "impression" TEXT NOT NULL,
    "reportedById" UUID,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "tier" "PackTier" NOT NULL DEFAULT 'HEAVY',
    "description" TEXT NOT NULL,
    "latestVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackVersion" (
    "id" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentDefinition" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackActivation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "packVersionId" UUID NOT NULL,
    "status" "PackActivationStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalogItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "packKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pricePkr" INTEGER NOT NULL,
    "durationMin" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lateralizable" BOOLEAN NOT NULL DEFAULT false,
    "bilateralPricePkr" INTEGER,

    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "packKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeFieldGroup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "packKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeFieldGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSet" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "packKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendChartDefinition" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "packKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "observationCodes" TEXT[],
    "unit" TEXT NOT NULL,
    "splitByLaterality" BOOLEAN NOT NULL DEFAULT false,
    "yMin" DOUBLE PRECISION,
    "yMax" DOUBLE PRECISION,
    "referenceBands" JSONB,
    "targetLines" JSONB,
    "aggregation" "TrendAggregation" NOT NULL DEFAULT 'RAW',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendChartDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendAnnotation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "chartKey" TEXT NOT NULL,
    "atDateTime" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "side" "BodySide",
    "linkedResourceId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoredInstrumentResponse" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "instrumentKey" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "band" TEXT,
    "flags" TEXT[],
    "recordedById" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoredInstrumentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "side" "BodySide",
    "note" TEXT,
    "recordedById" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "scope" "ConsentScope" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "method" "ConsentMethod" NOT NULL DEFAULT 'WRITTEN',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "capturedById" UUID,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "consentId" UUID NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "label" TEXT,
    "area" TEXT,
    "note" TEXT,
    "capturedById" UUID,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAsset" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "providerId" UUID,
    "packKey" TEXT,
    "status" "EncounterStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeSubmission" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "packKey" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteInstance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "templateId" UUID,
    "templateKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "authoredById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "status" "TreatmentPlanStatus" NOT NULL DEFAULT 'PROPOSED',
    "totalPkr" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlanItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "serviceCatalogItemId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPricePkr" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotalPkr" INTEGER NOT NULL,

    CONSTRAINT "TreatmentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PregnancyEpisode" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "lmp" TIMESTAMP(3),
    "lmpReliable" BOOLEAN NOT NULL DEFAULT false,
    "eddByLmp" TIMESTAMP(3),
    "eddByUsg" TIMESTAMP(3),
    "eddFinal" TIMESTAMP(3),
    "eddMethod" "EddMethod" NOT NULL DEFAULT 'LMP',
    "eddLockedAt" TIMESTAMP(3),
    "gravida" INTEGER NOT NULL,
    "para" INTEGER NOT NULL,
    "abortus" INTEGER NOT NULL,
    "livingChildren" INTEGER NOT NULL DEFAULT 0,
    "bloodGroup" TEXT,
    "rhFactor" "RhFactor",
    "heightCm" INTEGER,
    "prePregnancyWeightKg" INTEGER,
    "prevCsCount" INTEGER NOT NULL DEFAULT 0,
    "riskFlags" TEXT[],
    "riskNotes" TEXT,
    "fetusCount" INTEGER NOT NULL DEFAULT 1,
    "status" "PregnancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "treatmentPlanId" UUID,
    "deliveryDate" TIMESTAMP(3),
    "deliveryMode" "DeliveryMode",
    "deliveryEncounterId" UUID,
    "babyRecords" JSONB,
    "complications" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PregnancyEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AncVisit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "pregnancyEpisodeId" UUID NOT NULL,
    "encounterId" UUID,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "contactNumber" INTEGER,
    "gaWeeks" INTEGER,
    "gaDays" INTEGER,
    "weightKg" INTEGER,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "fundalHeightCm" INTEGER,
    "fhrBpm" INTEGER,
    "fhrPerFetus" JSONB,
    "fhrMethod" "FhrMethod",
    "presentation" "Presentation",
    "engagementFifths" INTEGER,
    "urineAlbumin" "DipstickResult",
    "urineSugar" "DipstickResult",
    "hbGdl" DOUBLE PRECISION,
    "oedema" "OedemaGrade",
    "fetalMovements" "FmStatus",
    "dangerSigns" TEXT[],
    "ironFolateGiven" BOOLEAN NOT NULL DEFAULT false,
    "calciumGiven" BOOLEAN NOT NULL DEFAULT false,
    "ttImmunizationId" UUID,
    "planNotes" TEXT,
    "nextVisitDate" TIMESTAMP(3),
    "alertFlags" TEXT[],
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AncVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObstetricUltrasound" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "pregnancyEpisodeId" UUID NOT NULL,
    "encounterId" UUID,
    "orderId" UUID,
    "scanDate" TIMESTAMP(3) NOT NULL,
    "scanType" "ScanType" NOT NULL,
    "fetusNumber" INTEGER NOT NULL DEFAULT 1,
    "studyId" TEXT NOT NULL,
    "crlMm" DOUBLE PRECISION,
    "gsMm" DOUBLE PRECISION,
    "bpdMm" DOUBLE PRECISION,
    "hcMm" DOUBLE PRECISION,
    "acMm" DOUBLE PRECISION,
    "flMm" DOUBLE PRECISION,
    "efwGrams" INTEGER,
    "efwFormula" TEXT,
    "efwPercentile" DOUBLE PRECISION,
    "gaByUsgWeeks" INTEGER,
    "gaByUsgDays" INTEGER,
    "fetalHeartActivity" BOOLEAN,
    "fhrBpm" INTEGER,
    "presentation" "Presentation",
    "placentaSite" "PlacentaSite",
    "liquorAfiCm" DOUBLE PRECISION,
    "liquorDvpCm" DOUBLE PRECISION,
    "liquorAssessment" "LiquorAssessment",
    "cervicalLengthMm" DOUBLE PRECISION,
    "anomalyChecklist" JSONB,
    "adnexaFindings" JSONB,
    "impression" TEXT NOT NULL,
    "performedById" UUID,
    "mediaAssetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObstetricUltrasound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partogram" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "pregnancyEpisodeId" UUID NOT NULL,
    "encounterId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "parity" INTEGER NOT NULL,
    "membraneStatus" "MembraneStatus" NOT NULL DEFAULT 'INTACT',
    "membranesRupturedAt" TIMESTAMP(3),
    "companionPresent" BOOLEAN,
    "painReliefOffered" BOOLEAN,
    "oralFluidsAllowed" BOOLEAN,
    "status" "PartogramStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "closureNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partogram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartogramEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partogramId" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" UUID,
    "correctsEntryId" UUID,
    "cervicalDilationCm" INTEGER,
    "descentFifths" INTEGER,
    "contractionsPer10Min" INTEGER,
    "contractionDurationSec" INTEGER,
    "fhrBpm" INTEGER,
    "fhrDeceleration" "FhrDecel",
    "amnioticFluid" "AmnioticFluid",
    "caput" INTEGER,
    "moulding" INTEGER,
    "maternalPulse" INTEGER,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "temperatureC" DOUBLE PRECISION,
    "urineOutput" TEXT,
    "urineProtein" "DipstickResult",
    "oxytocinUnitsPerL" DOUBLE PRECISION,
    "oxytocinDropsPerMin" INTEGER,
    "medicines" TEXT,
    "ivFluids" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "alertFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartogramEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GynaeProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "menarcheAgeYears" INTEGER,
    "cycleLengthDays" INTEGER,
    "cycleRegularity" "CycleRegularity",
    "flowDurationDays" INTEGER,
    "flowAmount" "FlowAmount",
    "dysmenorrhea" "DysmenorrheaSeverity",
    "lmpRecorded" TIMESTAMP(3),
    "contraceptionMethod" "ContraceptionMethod",
    "papSmearLastDate" TIMESTAMP(3),
    "pcosRotterdam" JSONB,
    "infertilityType" "InfertilityType",
    "infertilityDurationMonths" INTEGER,
    "partnerSemenAnalysisDone" BOOLEAN,
    "tubalPatencyTest" "TubalTest",
    "priorTreatments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GynaeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoseCalculationLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "drugKey" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "ageMonths" INTEGER,
    "computedMgPerDose" DOUBLE PRECISION NOT NULL,
    "computedMgPerDay" DOUBLE PRECISION NOT NULL,
    "cappedByMax" BOOLEAN NOT NULL DEFAULT false,
    "chosenConcentration" JSONB,
    "volumeMl" DOUBLE PRECISION,
    "medicationRequestId" TEXT,
    "clinicianId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoseCalculationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerioExam" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "examType" TEXT NOT NULL DEFAULT 'FULL',
    "bpeSextants" INTEGER[],
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerioExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerioToothRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "perioExamId" UUID NOT NULL,
    "toothFdi" TEXT NOT NULL,
    "pocketMm" INTEGER[],
    "recessionMm" INTEGER[],
    "bleeding" BOOLEAN[],
    "suppuration" BOOLEAN[],
    "plaque" BOOLEAN[],
    "furcation" "FurcationGrade" NOT NULL DEFAULT 'NONE',
    "mobility" INTEGER,

    CONSTRAINT "PerioToothRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothPlanItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "catalogCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "toothFdi" TEXT,
    "surfaces" JSONB,
    "pricePkr" INTEGER NOT NULL,
    "status" "DentalPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "conditionOnComplete" TEXT,
    "completedEncounterId" UUID,
    "completedAt" TIMESTAMP(3),
    "invoiceLineItemId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToothPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrthoCase" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "treatmentPlanId" UUID,
    "appliance" "ApplianceType" NOT NULL,
    "angleClass" TEXT,
    "startDate" TIMESTAMP(3),
    "plannedMonths" INTEGER,
    "debondDate" TIMESTAMP(3),
    "status" "OrthoCaseStatus" NOT NULL DEFAULT 'PLANNED',
    "applianceMap" JSONB NOT NULL,
    "photoTimelineTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrthoCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrthoEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orthoCaseId" UUID NOT NULL,
    "encounterId" UUID,
    "eventType" "OrthoEventType" NOT NULL,
    "wireUpper" TEXT,
    "wireLower" TEXT,
    "elastics" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrthoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EyeExam" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "status" "EyeExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "chiefComplaint" TEXT,
    "signedById" UUID,
    "signedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EyeExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualAcuityMeasure" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "eyeExamId" UUID NOT NULL,
    "laterality" "BodySide" NOT NULL,
    "condition" "VaCondition" NOT NULL,
    "notation" "VaNotation" NOT NULL,
    "displayValue" TEXT NOT NULL,
    "logmarValue" DOUBLE PRECISION,
    "chartDistanceM" DOUBLE PRECISION,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualAcuityMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refraction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "eyeExamId" UUID NOT NULL,
    "laterality" "BodySide" NOT NULL,
    "method" "RefractionMethod" NOT NULL,
    "sphere" DOUBLE PRECISION NOT NULL,
    "cylinder" DOUBLE PRECISION,
    "axis" INTEGER,
    "add" DOUBLE PRECISION,
    "vaAchieved" TEXT,
    "pdBinocularMm" DOUBLE PRECISION,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Refraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IopMeasurement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "eyeExamId" UUID NOT NULL,
    "laterality" "BodySide" NOT NULL,
    "valueMmHg" DOUBLE PRECISION NOT NULL,
    "method" "IopMethod" NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cctMicrons" INTEGER,
    "postDilation" BOOLEAN NOT NULL DEFAULT false,
    "alertSeverity" TEXT,
    "observationId" UUID,

    CONSTRAINT "IopMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EyeSegmentFinding" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "eyeExamId" UUID NOT NULL,
    "laterality" "BodySide" NOT NULL,
    "segment" "EyeSegment" NOT NULL,
    "structure" "EyeStructure" NOT NULL,
    "status" "EyeFindingStatus" NOT NULL,
    "findingCode" TEXT,
    "gradeValue" TEXT,
    "freeText" TEXT,

    CONSTRAINT "EyeSegmentFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpticalPrescription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "eyeExamId" UUID,
    "patientId" UUID NOT NULL,
    "type" "RxType" NOT NULL,
    "status" "RxStatus" NOT NULL DEFAULT 'DRAFT',
    "odSphere" DOUBLE PRECISION,
    "odCylinder" DOUBLE PRECISION,
    "odAxis" INTEGER,
    "odAdd" DOUBLE PRECISION,
    "osSphere" DOUBLE PRECISION,
    "osCylinder" DOUBLE PRECISION,
    "osAxis" INTEGER,
    "osAdd" DOUBLE PRECISION,
    "pdBinocularMm" DOUBLE PRECISION,
    "lensRecommendation" JSONB,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "prescribedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpticalPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RehabEpisode" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "bodyRegion" TEXT NOT NULL,
    "onsetDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RehabEpisodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "sessionsPlanned" INTEGER NOT NULL DEFAULT 0,
    "goals" TEXT,
    "safetyIntake" JSONB,
    "dischargedAt" TIMESTAMP(3),
    "dischargeNote" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RehabEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MskAssessment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rehabEpisodeId" UUID NOT NULL,
    "encounterId" UUID,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posture" TEXT,
    "gait" TEXT,
    "palpation" TEXT,
    "specialTests" JSONB,
    "notes" TEXT,
    "assessedById" UUID,

    CONSTRAINT "MskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomMeasurement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "mskAssessmentId" UUID NOT NULL,
    "joint" TEXT NOT NULL,
    "movement" TEXT NOT NULL,
    "laterality" "BodySide",
    "activeDegrees" INTEGER,
    "passiveDegrees" INTEGER,
    "normalDegrees" INTEGER NOT NULL,
    "deficitPct" INTEGER,
    "deficitBand" TEXT,
    "note" TEXT,

    CONSTRAINT "RomMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RehabSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rehabEpisodeId" UUID NOT NULL,
    "encounterId" UUID,
    "sessionNumber" INTEGER NOT NULL,
    "status" "RehabSessionStatus" NOT NULL DEFAULT 'COMPLETED',
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modalities" TEXT[],
    "safetyNotes" JSONB,
    "painPre" INTEGER,
    "painPost" INTEGER,
    "notes" TEXT,
    "performedById" UUID,

    CONSTRAINT "RehabSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExercisePrescription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rehabEpisodeId" UUID NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "holdSeconds" INTEGER,
    "frequencyPerWeek" INTEGER,
    "progression" TEXT,
    "instructions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExercisePrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhototherapyCourse" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "modality" "PhototherapyModality" NOT NULL DEFAULT 'NB_UVB',
    "bodySite" "PhototherapyBodySite" NOT NULL DEFAULT 'WHOLE_BODY',
    "laterality" "BodySide",
    "fitzpatrickType" INTEGER NOT NULL,
    "indication" TEXT NOT NULL,
    "protocolKey" TEXT NOT NULL DEFAULT 'NBUVB_STANDARD',
    "startDoseMj" INTEGER NOT NULL,
    "incrementPct" INTEGER NOT NULL DEFAULT 15,
    "maxDoseMj" INTEGER NOT NULL,
    "medMj" INTEGER,
    "burnHoldDoseMj" INTEGER,
    "burnHoldAt" TIMESTAMP(3),
    "status" "PhototherapyStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdById" UUID,

    CONSTRAINT "PhototherapyCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhototherapySession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "sessionNo" INTEGER NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "doseMj" INTEGER NOT NULL DEFAULT 0,
    "cumulativeMj" INTEGER NOT NULL DEFAULT 0,
    "lampHours" DOUBLE PRECISION,
    "gapDays" INTEGER,
    "erythemaGrade" INTEGER NOT NULL DEFAULT 0,
    "burnFlag" BOOLEAN NOT NULL DEFAULT false,
    "doseDecision" JSONB,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    "notes" TEXT,
    "deliveredById" UUID,

    CONSTRAINT "PhototherapySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkinLesion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "bodyRegion" TEXT NOT NULL,
    "laterality" "BodySide",
    "morphology" TEXT NOT NULL,
    "diagnosisCode" TEXT,
    "abcde" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkinLesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoseRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "drugKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT 'oral',
    "form" TEXT,
    "mgPerKgPerDay" DOUBLE PRECISION NOT NULL,
    "dosesPerDay" INTEGER NOT NULL,
    "maxSingleDoseMg" DOUBLE PRECISION,
    "maxDailyDoseMg" DOUBLE PRECISION,
    "minAgeMonths" INTEGER,
    "maxWeightKgForRule" DOUBLE PRECISION,
    "roundingStepMl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "concentrations" JSONB NOT NULL,
    "cautions" TEXT[],
    "highRisk" BOOLEAN NOT NULL DEFAULT false,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoseRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "drugKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "mgPerDose" DOUBLE PRECISION NOT NULL,
    "dosesPerDay" INTEGER NOT NULL,
    "mgPerDay" DOUBLE PRECISION NOT NULL,
    "volumePerDoseMl" DOUBLE PRECISION,
    "concentrationLabel" TEXT,
    "durationDays" INTEGER,
    "prn" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "doseCalculationLogId" UUID,
    "prescribedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothFinding" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "toothFdi" TEXT NOT NULL,
    "toothType" "ToothType" NOT NULL DEFAULT 'PERMANENT',
    "supernumeraryRef" TEXT,
    "surfaces" TEXT[],
    "condition" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'EXISTING',
    "mobilityGrade" INTEGER,
    "archSide" "BodySide",
    "note" TEXT,
    "supersededById" UUID,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToothFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccineBatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vaccineCode" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "expiry" TIMESTAMP(3) NOT NULL,
    "vvmStage" "VvmStage" NOT NULL DEFAULT 'STAGE_1',
    "dosesReceived" INTEGER NOT NULL,
    "dosesRemaining" INTEGER NOT NULL,
    "storageLocation" TEXT,
    "discardedAt" TIMESTAMP(3),
    "discardReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccineBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aefi" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "immunizationId" UUID,
    "batchId" UUID,
    "onsetAt" TIMESTAMP(3) NOT NULL,
    "symptoms" TEXT[],
    "severity" "AefiSeverity" NOT NULL,
    "outcome" "AefiOutcome" NOT NULL DEFAULT 'UNKNOWN',
    "narrative" TEXT,
    "reportedToAuthorityAt" TIMESTAMP(3),
    "reportedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aefi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Facility_tenantId_idx" ON "Facility"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_key_key" ON "Feature"("key");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "TenantEntitlement_tenantId_idx" ON "TenantEntitlement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantEntitlement_tenantId_featureKey_key" ON "TenantEntitlement"("tenantId", "featureKey");

-- CreateIndex
CREATE INDEX "Patient_tenantId_idx" ON "Patient"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_tenantId_mrn_key" ON "Patient"("tenantId", "mrn");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_idx" ON "Appointment"("tenantId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_patientId_idx" ON "Invoice"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_number_key" ON "Invoice"("tenantId", "number");

-- CreateIndex
CREATE INDEX "PaymentIntent_tenantId_idx" ON "PaymentIntent"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentIntent_invoiceId_idx" ON "PaymentIntent"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_tenantId_reference_key" ON "PaymentIntent"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_tenantId_idx" ON "InvoiceLineItem"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_reference_key" ON "Payment"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "Immunization_tenantId_idx" ON "Immunization"("tenantId");

-- CreateIndex
CREATE INDEX "Immunization_patientId_idx" ON "Immunization"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Immunization_tenantId_patientId_vaccineCode_dose_key" ON "Immunization"("tenantId", "patientId", "vaccineCode", "dose");

-- CreateIndex
CREATE INDEX "ToothRecord_tenantId_idx" ON "ToothRecord"("tenantId");

-- CreateIndex
CREATE INDEX "ToothRecord_patientId_idx" ON "ToothRecord"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "ToothRecord_tenantId_patientId_toothFdi_key" ON "ToothRecord"("tenantId", "patientId", "toothFdi");

-- CreateIndex
CREATE INDEX "LabOrder_tenantId_idx" ON "LabOrder"("tenantId");

-- CreateIndex
CREATE INDEX "LabOrder_patientId_idx" ON "LabOrder"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrder_tenantId_orderNumber_key" ON "LabOrder"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "LabOrderItem_tenantId_idx" ON "LabOrderItem"("tenantId");

-- CreateIndex
CREATE INDEX "LabOrderItem_orderId_idx" ON "LabOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "LabResult_tenantId_idx" ON "LabResult"("tenantId");

-- CreateIndex
CREATE INDEX "LabResult_orderId_idx" ON "LabResult"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_tenantId_orderId_testCode_key" ON "LabResult"("tenantId", "orderId", "testCode");

-- CreateIndex
CREATE INDEX "StockItem_tenantId_idx" ON "StockItem"("tenantId");

-- CreateIndex
CREATE INDEX "StockItem_tenantId_formularyCode_idx" ON "StockItem"("tenantId", "formularyCode");

-- CreateIndex
CREATE INDEX "Dispense_tenantId_idx" ON "Dispense"("tenantId");

-- CreateIndex
CREATE INDEX "Dispense_patientId_idx" ON "Dispense"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispense_tenantId_receiptNumber_key" ON "Dispense"("tenantId", "receiptNumber");

-- CreateIndex
CREATE INDEX "DispenseItem_tenantId_idx" ON "DispenseItem"("tenantId");

-- CreateIndex
CREATE INDEX "DispenseItem_dispenseId_idx" ON "DispenseItem"("dispenseId");

-- CreateIndex
CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_cnic_key" ON "Employee"("tenantId", "cnic");

-- CreateIndex
CREATE INDEX "PayrollRun_tenantId_idx" ON "PayrollRun"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_tenantId_period_key" ON "PayrollRun"("tenantId", "period");

-- CreateIndex
CREATE INDEX "Payslip_tenantId_idx" ON "Payslip"("tenantId");

-- CreateIndex
CREATE INDEX "Payslip_runId_idx" ON "Payslip"("runId");

-- CreateIndex
CREATE INDEX "Ward_tenantId_idx" ON "Ward"("tenantId");

-- CreateIndex
CREATE INDEX "Bed_tenantId_idx" ON "Bed"("tenantId");

-- CreateIndex
CREATE INDEX "Bed_wardId_idx" ON "Bed"("wardId");

-- CreateIndex
CREATE UNIQUE INDEX "Bed_tenantId_wardId_code_key" ON "Bed"("tenantId", "wardId", "code");

-- CreateIndex
CREATE INDEX "Admission_tenantId_idx" ON "Admission"("tenantId");

-- CreateIndex
CREATE INDEX "Admission_patientId_idx" ON "Admission"("patientId");

-- CreateIndex
CREATE INDEX "Admission_bedId_idx" ON "Admission"("bedId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");

-- CreateIndex
CREATE INDEX "LeadActivity_tenantId_idx" ON "LeadActivity"("tenantId");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");

-- CreateIndex
CREATE INDEX "ImagingOrder_tenantId_idx" ON "ImagingOrder"("tenantId");

-- CreateIndex
CREATE INDEX "ImagingOrder_patientId_idx" ON "ImagingOrder"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "ImagingOrder_tenantId_orderNumber_key" ON "ImagingOrder"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "ImagingOrderItem_tenantId_idx" ON "ImagingOrderItem"("tenantId");

-- CreateIndex
CREATE INDEX "ImagingOrderItem_orderId_idx" ON "ImagingOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ImagingReport_tenantId_idx" ON "ImagingReport"("tenantId");

-- CreateIndex
CREATE INDEX "ImagingReport_orderId_idx" ON "ImagingReport"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ImagingReport_tenantId_orderId_studyCode_key" ON "ImagingReport"("tenantId", "orderId", "studyCode");

-- CreateIndex
CREATE INDEX "Refund_tenantId_idx" ON "Refund"("tenantId");

-- CreateIndex
CREATE INDEX "Refund_invoiceId_idx" ON "Refund"("invoiceId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Pack_key_key" ON "Pack"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PackVersion_packId_version_key" ON "PackVersion"("packId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentDefinition_key_key" ON "InstrumentDefinition"("key");

-- CreateIndex
CREATE INDEX "PackActivation_tenantId_idx" ON "PackActivation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PackActivation_tenantId_packId_key" ON "PackActivation"("tenantId", "packId");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_tenantId_idx" ON "ServiceCatalogItem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalogItem_tenantId_code_key" ON "ServiceCatalogItem"("tenantId", "code");

-- CreateIndex
CREATE INDEX "NoteTemplate_tenantId_idx" ON "NoteTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTemplate_tenantId_key_key" ON "NoteTemplate"("tenantId", "key");

-- CreateIndex
CREATE INDEX "IntakeFieldGroup_tenantId_idx" ON "IntakeFieldGroup"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeFieldGroup_tenantId_key_key" ON "IntakeFieldGroup"("tenantId", "key");

-- CreateIndex
CREATE INDEX "OrderSet_tenantId_idx" ON "OrderSet"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSet_tenantId_key_key" ON "OrderSet"("tenantId", "key");

-- CreateIndex
CREATE INDEX "TrendChartDefinition_tenantId_idx" ON "TrendChartDefinition"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TrendChartDefinition_tenantId_key_key" ON "TrendChartDefinition"("tenantId", "key");

-- CreateIndex
CREATE INDEX "TrendAnnotation_tenantId_idx" ON "TrendAnnotation"("tenantId");

-- CreateIndex
CREATE INDEX "TrendAnnotation_tenantId_patientId_chartKey_idx" ON "TrendAnnotation"("tenantId", "patientId", "chartKey");

-- CreateIndex
CREATE INDEX "ScoredInstrumentResponse_tenantId_idx" ON "ScoredInstrumentResponse"("tenantId");

-- CreateIndex
CREATE INDEX "ScoredInstrumentResponse_patientId_idx" ON "ScoredInstrumentResponse"("patientId");

-- CreateIndex
CREATE INDEX "Observation_tenantId_idx" ON "Observation"("tenantId");

-- CreateIndex
CREATE INDEX "Observation_patientId_metric_idx" ON "Observation"("patientId", "metric");

-- CreateIndex
CREATE INDEX "ConsentRecord_tenantId_idx" ON "ConsentRecord"("tenantId");

-- CreateIndex
CREATE INDEX "ConsentRecord_patientId_scope_idx" ON "ConsentRecord"("patientId", "scope");

-- CreateIndex
CREATE INDEX "PhotoSession_tenantId_idx" ON "PhotoSession"("tenantId");

-- CreateIndex
CREATE INDEX "PhotoSession_patientId_idx" ON "PhotoSession"("patientId");

-- CreateIndex
CREATE INDEX "PhotoAsset_tenantId_idx" ON "PhotoAsset"("tenantId");

-- CreateIndex
CREATE INDEX "PhotoAsset_sessionId_idx" ON "PhotoAsset"("sessionId");

-- CreateIndex
CREATE INDEX "Encounter_tenantId_idx" ON "Encounter"("tenantId");

-- CreateIndex
CREATE INDEX "Encounter_patientId_idx" ON "Encounter"("patientId");

-- CreateIndex
CREATE INDEX "IntakeSubmission_tenantId_idx" ON "IntakeSubmission"("tenantId");

-- CreateIndex
CREATE INDEX "IntakeSubmission_patientId_idx" ON "IntakeSubmission"("patientId");

-- CreateIndex
CREATE INDEX "NoteInstance_tenantId_idx" ON "NoteInstance"("tenantId");

-- CreateIndex
CREATE INDEX "NoteInstance_patientId_idx" ON "NoteInstance"("patientId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_tenantId_idx" ON "TreatmentPlan"("tenantId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_patientId_idx" ON "TreatmentPlan"("patientId");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_tenantId_idx" ON "TreatmentPlanItem"("tenantId");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_planId_idx" ON "TreatmentPlanItem"("planId");

-- CreateIndex
CREATE INDEX "PregnancyEpisode_tenantId_idx" ON "PregnancyEpisode"("tenantId");

-- CreateIndex
CREATE INDEX "PregnancyEpisode_tenantId_patientId_status_idx" ON "PregnancyEpisode"("tenantId", "patientId", "status");

-- CreateIndex
CREATE INDEX "AncVisit_tenantId_idx" ON "AncVisit"("tenantId");

-- CreateIndex
CREATE INDEX "AncVisit_tenantId_pregnancyEpisodeId_visitDate_idx" ON "AncVisit"("tenantId", "pregnancyEpisodeId", "visitDate");

-- CreateIndex
CREATE INDEX "ObstetricUltrasound_tenantId_idx" ON "ObstetricUltrasound"("tenantId");

-- CreateIndex
CREATE INDEX "ObstetricUltrasound_tenantId_pregnancyEpisodeId_scanDate_idx" ON "ObstetricUltrasound"("tenantId", "pregnancyEpisodeId", "scanDate");

-- CreateIndex
CREATE INDEX "Partogram_tenantId_idx" ON "Partogram"("tenantId");

-- CreateIndex
CREATE INDEX "Partogram_tenantId_pregnancyEpisodeId_idx" ON "Partogram"("tenantId", "pregnancyEpisodeId");

-- CreateIndex
CREATE INDEX "PartogramEntry_tenantId_idx" ON "PartogramEntry"("tenantId");

-- CreateIndex
CREATE INDEX "PartogramEntry_tenantId_partogramId_recordedAt_idx" ON "PartogramEntry"("tenantId", "partogramId", "recordedAt");

-- CreateIndex
CREATE INDEX "GynaeProfile_tenantId_idx" ON "GynaeProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GynaeProfile_tenantId_patientId_key" ON "GynaeProfile"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "DoseCalculationLog_tenantId_idx" ON "DoseCalculationLog"("tenantId");

-- CreateIndex
CREATE INDEX "DoseCalculationLog_tenantId_patientId_idx" ON "DoseCalculationLog"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "PerioExam_tenantId_idx" ON "PerioExam"("tenantId");

-- CreateIndex
CREATE INDEX "PerioExam_tenantId_patientId_idx" ON "PerioExam"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "PerioToothRecord_tenantId_idx" ON "PerioToothRecord"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PerioToothRecord_perioExamId_toothFdi_key" ON "PerioToothRecord"("perioExamId", "toothFdi");

-- CreateIndex
CREATE INDEX "ToothPlanItem_tenantId_idx" ON "ToothPlanItem"("tenantId");

-- CreateIndex
CREATE INDEX "ToothPlanItem_tenantId_patientId_idx" ON "ToothPlanItem"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "OrthoCase_tenantId_idx" ON "OrthoCase"("tenantId");

-- CreateIndex
CREATE INDEX "OrthoCase_tenantId_patientId_idx" ON "OrthoCase"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "OrthoEvent_tenantId_idx" ON "OrthoEvent"("tenantId");

-- CreateIndex
CREATE INDEX "OrthoEvent_tenantId_orthoCaseId_idx" ON "OrthoEvent"("tenantId", "orthoCaseId");

-- CreateIndex
CREATE INDEX "EyeExam_tenantId_idx" ON "EyeExam"("tenantId");

-- CreateIndex
CREATE INDEX "EyeExam_tenantId_patientId_idx" ON "EyeExam"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "VisualAcuityMeasure_tenantId_idx" ON "VisualAcuityMeasure"("tenantId");

-- CreateIndex
CREATE INDEX "VisualAcuityMeasure_eyeExamId_idx" ON "VisualAcuityMeasure"("eyeExamId");

-- CreateIndex
CREATE INDEX "Refraction_tenantId_idx" ON "Refraction"("tenantId");

-- CreateIndex
CREATE INDEX "Refraction_eyeExamId_idx" ON "Refraction"("eyeExamId");

-- CreateIndex
CREATE INDEX "IopMeasurement_tenantId_idx" ON "IopMeasurement"("tenantId");

-- CreateIndex
CREATE INDEX "IopMeasurement_eyeExamId_idx" ON "IopMeasurement"("eyeExamId");

-- CreateIndex
CREATE INDEX "EyeSegmentFinding_tenantId_idx" ON "EyeSegmentFinding"("tenantId");

-- CreateIndex
CREATE INDEX "EyeSegmentFinding_eyeExamId_idx" ON "EyeSegmentFinding"("eyeExamId");

-- CreateIndex
CREATE UNIQUE INDEX "EyeSegmentFinding_tenantId_eyeExamId_laterality_structure_key" ON "EyeSegmentFinding"("tenantId", "eyeExamId", "laterality", "structure");

-- CreateIndex
CREATE INDEX "OpticalPrescription_tenantId_idx" ON "OpticalPrescription"("tenantId");

-- CreateIndex
CREATE INDEX "OpticalPrescription_tenantId_patientId_idx" ON "OpticalPrescription"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "RehabEpisode_tenantId_idx" ON "RehabEpisode"("tenantId");

-- CreateIndex
CREATE INDEX "RehabEpisode_tenantId_patientId_status_idx" ON "RehabEpisode"("tenantId", "patientId", "status");

-- CreateIndex
CREATE INDEX "MskAssessment_tenantId_idx" ON "MskAssessment"("tenantId");

-- CreateIndex
CREATE INDEX "MskAssessment_tenantId_rehabEpisodeId_idx" ON "MskAssessment"("tenantId", "rehabEpisodeId");

-- CreateIndex
CREATE INDEX "RomMeasurement_tenantId_idx" ON "RomMeasurement"("tenantId");

-- CreateIndex
CREATE INDEX "RomMeasurement_mskAssessmentId_idx" ON "RomMeasurement"("mskAssessmentId");

-- CreateIndex
CREATE INDEX "RehabSession_tenantId_idx" ON "RehabSession"("tenantId");

-- CreateIndex
CREATE INDEX "RehabSession_tenantId_rehabEpisodeId_idx" ON "RehabSession"("tenantId", "rehabEpisodeId");

-- CreateIndex
CREATE UNIQUE INDEX "RehabSession_tenantId_rehabEpisodeId_sessionNumber_key" ON "RehabSession"("tenantId", "rehabEpisodeId", "sessionNumber");

-- CreateIndex
CREATE INDEX "ExercisePrescription_tenantId_idx" ON "ExercisePrescription"("tenantId");

-- CreateIndex
CREATE INDEX "ExercisePrescription_tenantId_rehabEpisodeId_idx" ON "ExercisePrescription"("tenantId", "rehabEpisodeId");

-- CreateIndex
CREATE INDEX "PhototherapyCourse_tenantId_patientId_status_idx" ON "PhototherapyCourse"("tenantId", "patientId", "status");

-- CreateIndex
CREATE INDEX "PhototherapySession_tenantId_courseId_deliveredAt_idx" ON "PhototherapySession"("tenantId", "courseId", "deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhototherapySession_tenantId_courseId_sessionNo_key" ON "PhototherapySession"("tenantId", "courseId", "sessionNo");

-- CreateIndex
CREATE INDEX "SkinLesion_tenantId_patientId_bodyRegion_idx" ON "SkinLesion"("tenantId", "patientId", "bodyRegion");

-- CreateIndex
CREATE INDEX "DoseRule_tenantId_idx" ON "DoseRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DoseRule_tenantId_drugKey_route_key" ON "DoseRule"("tenantId", "drugKey", "route");

-- CreateIndex
CREATE INDEX "Prescription_tenantId_idx" ON "Prescription"("tenantId");

-- CreateIndex
CREATE INDEX "Prescription_tenantId_patientId_idx" ON "Prescription"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "ToothFinding_tenantId_idx" ON "ToothFinding"("tenantId");

-- CreateIndex
CREATE INDEX "ToothFinding_tenantId_patientId_toothFdi_idx" ON "ToothFinding"("tenantId", "patientId", "toothFdi");

-- CreateIndex
CREATE INDEX "ToothFinding_tenantId_encounterId_idx" ON "ToothFinding"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "VaccineBatch_tenantId_vaccineCode_expiry_idx" ON "VaccineBatch"("tenantId", "vaccineCode", "expiry");

-- CreateIndex
CREATE UNIQUE INDEX "VaccineBatch_tenantId_vaccineCode_lotNumber_key" ON "VaccineBatch"("tenantId", "vaccineCode", "lotNumber");

-- CreateIndex
CREATE INDEX "Aefi_tenantId_patientId_idx" ON "Aefi"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "Aefi_tenantId_batchId_idx" ON "Aefi"("tenantId", "batchId");

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantEntitlement" ADD CONSTRAINT "TenantEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VaccineBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothRecord" ADD CONSTRAINT "ToothRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothRecord" ADD CONSTRAINT "ToothRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispense" ADD CONSTRAINT "Dispense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispense" ADD CONSTRAINT "Dispense_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseItem" ADD CONSTRAINT "DispenseItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseItem" ADD CONSTRAINT "DispenseItem_dispenseId_fkey" FOREIGN KEY ("dispenseId") REFERENCES "Dispense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingOrder" ADD CONSTRAINT "ImagingOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingOrder" ADD CONSTRAINT "ImagingOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingOrderItem" ADD CONSTRAINT "ImagingOrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingOrderItem" ADD CONSTRAINT "ImagingOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ImagingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingReport" ADD CONSTRAINT "ImagingReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingReport" ADD CONSTRAINT "ImagingReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ImagingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackVersion" ADD CONSTRAINT "PackVersion_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackActivation" ADD CONSTRAINT "PackActivation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackActivation" ADD CONSTRAINT "PackActivation_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackActivation" ADD CONSTRAINT "PackActivation_packVersionId_fkey" FOREIGN KEY ("packVersionId") REFERENCES "PackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCatalogItem" ADD CONSTRAINT "ServiceCatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTemplate" ADD CONSTRAINT "NoteTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeFieldGroup" ADD CONSTRAINT "IntakeFieldGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSet" ADD CONSTRAINT "OrderSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendChartDefinition" ADD CONSTRAINT "TrendChartDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendAnnotation" ADD CONSTRAINT "TrendAnnotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendAnnotation" ADD CONSTRAINT "TrendAnnotation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoredInstrumentResponse" ADD CONSTRAINT "ScoredInstrumentResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoredInstrumentResponse" ADD CONSTRAINT "ScoredInstrumentResponse_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSession" ADD CONSTRAINT "PhotoSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSession" ADD CONSTRAINT "PhotoSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSession" ADD CONSTRAINT "PhotoSession_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "ConsentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PhotoSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInstance" ADD CONSTRAINT "NoteInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInstance" ADD CONSTRAINT "NoteInstance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInstance" ADD CONSTRAINT "NoteInstance_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInstance" ADD CONSTRAINT "NoteInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NoteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyEpisode" ADD CONSTRAINT "PregnancyEpisode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyEpisode" ADD CONSTRAINT "PregnancyEpisode_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AncVisit" ADD CONSTRAINT "AncVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AncVisit" ADD CONSTRAINT "AncVisit_pregnancyEpisodeId_fkey" FOREIGN KEY ("pregnancyEpisodeId") REFERENCES "PregnancyEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObstetricUltrasound" ADD CONSTRAINT "ObstetricUltrasound_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObstetricUltrasound" ADD CONSTRAINT "ObstetricUltrasound_pregnancyEpisodeId_fkey" FOREIGN KEY ("pregnancyEpisodeId") REFERENCES "PregnancyEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partogram" ADD CONSTRAINT "Partogram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partogram" ADD CONSTRAINT "Partogram_pregnancyEpisodeId_fkey" FOREIGN KEY ("pregnancyEpisodeId") REFERENCES "PregnancyEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartogramEntry" ADD CONSTRAINT "PartogramEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartogramEntry" ADD CONSTRAINT "PartogramEntry_partogramId_fkey" FOREIGN KEY ("partogramId") REFERENCES "Partogram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GynaeProfile" ADD CONSTRAINT "GynaeProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GynaeProfile" ADD CONSTRAINT "GynaeProfile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseCalculationLog" ADD CONSTRAINT "DoseCalculationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerioExam" ADD CONSTRAINT "PerioExam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerioExam" ADD CONSTRAINT "PerioExam_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerioToothRecord" ADD CONSTRAINT "PerioToothRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerioToothRecord" ADD CONSTRAINT "PerioToothRecord_perioExamId_fkey" FOREIGN KEY ("perioExamId") REFERENCES "PerioExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothPlanItem" ADD CONSTRAINT "ToothPlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothPlanItem" ADD CONSTRAINT "ToothPlanItem_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrthoCase" ADD CONSTRAINT "OrthoCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrthoCase" ADD CONSTRAINT "OrthoCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrthoEvent" ADD CONSTRAINT "OrthoEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrthoEvent" ADD CONSTRAINT "OrthoEvent_orthoCaseId_fkey" FOREIGN KEY ("orthoCaseId") REFERENCES "OrthoCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EyeExam" ADD CONSTRAINT "EyeExam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EyeExam" ADD CONSTRAINT "EyeExam_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualAcuityMeasure" ADD CONSTRAINT "VisualAcuityMeasure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualAcuityMeasure" ADD CONSTRAINT "VisualAcuityMeasure_eyeExamId_fkey" FOREIGN KEY ("eyeExamId") REFERENCES "EyeExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refraction" ADD CONSTRAINT "Refraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refraction" ADD CONSTRAINT "Refraction_eyeExamId_fkey" FOREIGN KEY ("eyeExamId") REFERENCES "EyeExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IopMeasurement" ADD CONSTRAINT "IopMeasurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IopMeasurement" ADD CONSTRAINT "IopMeasurement_eyeExamId_fkey" FOREIGN KEY ("eyeExamId") REFERENCES "EyeExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EyeSegmentFinding" ADD CONSTRAINT "EyeSegmentFinding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EyeSegmentFinding" ADD CONSTRAINT "EyeSegmentFinding_eyeExamId_fkey" FOREIGN KEY ("eyeExamId") REFERENCES "EyeExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpticalPrescription" ADD CONSTRAINT "OpticalPrescription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpticalPrescription" ADD CONSTRAINT "OpticalPrescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpticalPrescription" ADD CONSTRAINT "OpticalPrescription_eyeExamId_fkey" FOREIGN KEY ("eyeExamId") REFERENCES "EyeExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehabEpisode" ADD CONSTRAINT "RehabEpisode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehabEpisode" ADD CONSTRAINT "RehabEpisode_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MskAssessment" ADD CONSTRAINT "MskAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MskAssessment" ADD CONSTRAINT "MskAssessment_rehabEpisodeId_fkey" FOREIGN KEY ("rehabEpisodeId") REFERENCES "RehabEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomMeasurement" ADD CONSTRAINT "RomMeasurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomMeasurement" ADD CONSTRAINT "RomMeasurement_mskAssessmentId_fkey" FOREIGN KEY ("mskAssessmentId") REFERENCES "MskAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehabSession" ADD CONSTRAINT "RehabSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehabSession" ADD CONSTRAINT "RehabSession_rehabEpisodeId_fkey" FOREIGN KEY ("rehabEpisodeId") REFERENCES "RehabEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePrescription" ADD CONSTRAINT "ExercisePrescription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePrescription" ADD CONSTRAINT "ExercisePrescription_rehabEpisodeId_fkey" FOREIGN KEY ("rehabEpisodeId") REFERENCES "RehabEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhototherapyCourse" ADD CONSTRAINT "PhototherapyCourse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhototherapyCourse" ADD CONSTRAINT "PhototherapyCourse_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhototherapySession" ADD CONSTRAINT "PhototherapySession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhototherapySession" ADD CONSTRAINT "PhototherapySession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "PhototherapyCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkinLesion" ADD CONSTRAINT "SkinLesion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkinLesion" ADD CONSTRAINT "SkinLesion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseRule" ADD CONSTRAINT "DoseRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineBatch" ADD CONSTRAINT "VaccineBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aefi" ADD CONSTRAINT "Aefi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aefi" ADD CONSTRAINT "Aefi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

