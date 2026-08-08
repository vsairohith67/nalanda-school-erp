ALTER TABLE "Payment" ADD COLUMN "familyCollectionId" TEXT REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD COLUMN "familyInstrumentId" TEXT REFERENCES "FamilyCollectionInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD COLUMN "familyAllocationId" TEXT REFERENCES "FamilyStudentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD COLUMN "familyShareId" TEXT REFERENCES "AllocationInstrumentShare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FamilyCollection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicReference" TEXT NOT NULL,
  "receiptReference" TEXT,
  "payerType" TEXT NOT NULL,
  "payerGuardianId" TEXT,
  "payerDisplayName" TEXT NOT NULL,
  "counterpartyReferenceHash" TEXT,
  "counterpartyDisplay" TEXT,
  "collectionDate" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "requestKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "allocationPlanHash" TEXT NOT NULL,
  "allocationPolicyVersion" TEXT NOT NULL DEFAULT 'FAMILY_AUTO_V1',
  "totalPaise" INTEGER NOT NULL,
  "creditPaise" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "currentReceiptVersion" INTEGER NOT NULL DEFAULT 0,
  "auditReason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "reversedByUserId" TEXT,
  "reversedAt" DATETIME,
  "reversalReason" TEXT,
  "replacesCollectionId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FamilyCollection_payerGuardianId_fkey" FOREIGN KEY ("payerGuardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FamilyCollection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FamilyCollection_replacesCollectionId_fkey" FOREIGN KEY ("replacesCollectionId") REFERENCES "FamilyCollection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FamilyCollectionInstrument" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "collectionId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "receivedAccount" TEXT NOT NULL,
  "referenceMasked" TEXT,
  "referenceKey" TEXT,
  "postingStatus" TEXT NOT NULL DEFAULT 'POSTED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyCollectionInstrument_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FamilyStudentAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "collectionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "installment" TEXT NOT NULL,
  "feeHead" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "allocationPolicy" TEXT NOT NULL,
  "dueBeforePaise" INTEGER NOT NULL,
  "dueAfterPaise" INTEGER NOT NULL,
  "dueSnapshotHash" TEXT NOT NULL,
  "studentNameSnapshot" TEXT NOT NULL,
  "admissionNoSnapshot" TEXT NOT NULL,
  "classNameSnapshot" TEXT NOT NULL,
  "sectionSnapshot" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyStudentAllocation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FamilyStudentAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AllocationInstrumentShare" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "allocationId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AllocationInstrumentShare_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "FamilyStudentAllocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AllocationInstrumentShare_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "FamilyCollectionInstrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FamilyReceiptVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "collectionId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "publicVersionReference" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "totalPaise" INTEGER NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "supersedesVersionId" TEXT,
  "issuedByUserId" TEXT NOT NULL,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyReceiptVersion_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FamilyReceiptVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "FamilyReceiptVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FamilyReceiptVersion_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FamilyCollectionEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "collectionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "collectionVersion" INTEGER NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "reason" TEXT,
  "detailsJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyCollectionEvent_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FamilyCollectionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FamilyProviderAllocationPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "planVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARED',
  "amountPaise" INTEGER NOT NULL,
  "planHash" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "providerOrderKeyHash" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyProviderAllocationPlan_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FamilyCollection_publicReference_key" ON "FamilyCollection"("publicReference");
CREATE UNIQUE INDEX "FamilyCollection_receiptReference_key" ON "FamilyCollection"("receiptReference");
CREATE UNIQUE INDEX "FamilyCollection_requestKey_key" ON "FamilyCollection"("requestKey");
CREATE UNIQUE INDEX "FamilyCollection_replacesCollectionId_key" ON "FamilyCollection"("replacesCollectionId");
CREATE INDEX "FamilyCollection_payerGuardianId_collectionDate_idx" ON "FamilyCollection"("payerGuardianId", "collectionDate");
CREATE INDEX "FamilyCollection_status_collectionDate_idx" ON "FamilyCollection"("status", "collectionDate");
CREATE INDEX "FamilyCollection_createdByUserId_collectionDate_idx" ON "FamilyCollection"("createdByUserId", "collectionDate");
CREATE UNIQUE INDEX "FamilyCollectionInstrument_referenceKey_key" ON "FamilyCollectionInstrument"("referenceKey");
CREATE UNIQUE INDEX "FamilyCollectionInstrument_collectionId_ordinal_key" ON "FamilyCollectionInstrument"("collectionId", "ordinal");
CREATE INDEX "FamilyCollectionInstrument_collectionId_postingStatus_idx" ON "FamilyCollectionInstrument"("collectionId", "postingStatus");
CREATE INDEX "FamilyCollectionInstrument_mode_postingStatus_idx" ON "FamilyCollectionInstrument"("mode", "postingStatus");
CREATE UNIQUE INDEX "FamilyStudentAllocation_collectionId_studentId_academicYear_installment_feeHead_key" ON "FamilyStudentAllocation"("collectionId", "studentId", "academicYear", "installment", "feeHead");
CREATE INDEX "FamilyStudentAllocation_studentId_academicYear_idx" ON "FamilyStudentAllocation"("studentId", "academicYear");
CREATE INDEX "FamilyStudentAllocation_collectionId_orderIndex_idx" ON "FamilyStudentAllocation"("collectionId", "orderIndex");
CREATE UNIQUE INDEX "AllocationInstrumentShare_allocationId_instrumentId_key" ON "AllocationInstrumentShare"("allocationId", "instrumentId");
CREATE INDEX "AllocationInstrumentShare_instrumentId_idx" ON "AllocationInstrumentShare"("instrumentId");
CREATE UNIQUE INDEX "FamilyReceiptVersion_publicVersionReference_key" ON "FamilyReceiptVersion"("publicVersionReference");
CREATE UNIQUE INDEX "FamilyReceiptVersion_supersedesVersionId_key" ON "FamilyReceiptVersion"("supersedesVersionId");
CREATE UNIQUE INDEX "FamilyReceiptVersion_collectionId_versionNumber_key" ON "FamilyReceiptVersion"("collectionId", "versionNumber");
CREATE INDEX "FamilyReceiptVersion_collectionId_status_idx" ON "FamilyReceiptVersion"("collectionId", "status");
CREATE INDEX "FamilyCollectionEvent_collectionId_createdAt_idx" ON "FamilyCollectionEvent"("collectionId", "createdAt");
CREATE INDEX "FamilyCollectionEvent_eventType_createdAt_idx" ON "FamilyCollectionEvent"("eventType", "createdAt");
CREATE INDEX "FamilyCollectionEvent_actorUserId_createdAt_idx" ON "FamilyCollectionEvent"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "FamilyProviderAllocationPlan_publicKey_key" ON "FamilyProviderAllocationPlan"("publicKey");
CREATE UNIQUE INDEX "FamilyProviderAllocationPlan_collectionId_planVersion_key" ON "FamilyProviderAllocationPlan"("collectionId", "planVersion");
CREATE INDEX "FamilyProviderAllocationPlan_status_createdAt_idx" ON "FamilyProviderAllocationPlan"("status", "createdAt");
CREATE UNIQUE INDEX "Payment_familyShareId_key" ON "Payment"("familyShareId");
CREATE INDEX "Payment_familyCollectionId_idx" ON "Payment"("familyCollectionId");
CREATE INDEX "Payment_familyInstrumentId_idx" ON "Payment"("familyInstrumentId");
CREATE INDEX "Payment_familyAllocationId_idx" ON "Payment"("familyAllocationId");
