-- Prompt 18B: Class X document packages, Board-document custody tracking,
-- service-charge collection, waivers, and physical handover history.
CREATE TABLE "ClassXPackageTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateCode" TEXT NOT NULL,
  "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
  "name" TEXT NOT NULL,
  "academicYear" TEXT,
  "schoolBoard" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "documentDefinitionJson" TEXT NOT NULL,
  "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
  "defaultChargeRuleId" TEXT,
  "instructions" TEXT,
  "createdByUserId" TEXT,
  "activatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ClassXPackageTemplate_templateCode_key" ON "ClassXPackageTemplate"("templateCode");
CREATE INDEX "ClassXPackageTemplate_academicYear_status_idx" ON "ClassXPackageTemplate"("academicYear","status");
CREATE INDEX "ClassXPackageTemplate_packageType_status_idx" ON "ClassXPackageTemplate"("packageType","status");

CREATE TABLE "ClassXDocumentPackage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageNumber" TEXT NOT NULL,
  "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
  "studentId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "requestSource" TEXT NOT NULL DEFAULT 'INTERNAL',
  "applicantGuardianId" TEXT,
  "purpose" TEXT,
  "templateSnapshotJson" TEXT NOT NULL,
  "eligibilitySnapshotJson" TEXT NOT NULL,
  "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
  "totalRequiredItems" INTEGER NOT NULL DEFAULT 0,
  "readyItems" INTEGER NOT NULL DEFAULT 0,
  "handedOverItems" INTEGER NOT NULL DEFAULT 0,
  "internalNotes" TEXT,
  "publicNotes" TEXT,
  "cancellationReason" TEXT,
  "createdByUserId" TEXT,
  "reviewedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "completedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "submittedAt" DATETIME,
  "reviewedAt" DATETIME,
  "approvedAt" DATETIME,
  "completedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassXDocumentPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassXDocumentPackage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClassXPackageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassXDocumentPackage_packageNumber_key" ON "ClassXDocumentPackage"("packageNumber");
CREATE INDEX "ClassXDocumentPackage_studentId_createdAt_idx" ON "ClassXDocumentPackage"("studentId","createdAt");
CREATE INDEX "ClassXDocumentPackage_academicYear_status_idx" ON "ClassXDocumentPackage"("academicYear","status");
CREATE INDEX "ClassXDocumentPackage_requestSource_createdAt_idx" ON "ClassXDocumentPackage"("requestSource","createdAt");
CREATE INDEX "ClassXDocumentPackage_applicantGuardianId_createdAt_idx" ON "ClassXDocumentPackage"("applicantGuardianId","createdAt");

CREATE TABLE "ClassXPackageDocumentItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "issuerType" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL,
  "parentVisible" BOOLEAN NOT NULL DEFAULT true,
  "serialNumberRequired" BOOLEAN NOT NULL DEFAULT false,
  "handoverRequired" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "linkedStudentCertificateId" TEXT,
  "linkedStudentCertificateVersionId" TEXT,
  "externalDocumentReference" TEXT,
  "authorityName" TEXT,
  "requestDate" DATETIME,
  "externalIssueDate" DATETIME,
  "receivedDate" DATETIME,
  "verifiedDate" DATETIME,
  "handoverDate" DATETIME,
  "sourceNotes" TEXT,
  "publicNotes" TEXT,
  "rejectionReason" TEXT,
  "notApplicableReason" TEXT,
  "verifiedByUserId" TEXT,
  "handedOverByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassXPackageDocumentItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassXPackageDocumentItem_packageId_itemKey_key" ON "ClassXPackageDocumentItem"("packageId","itemKey");
CREATE INDEX "ClassXPackageDocumentItem_packageId_status_idx" ON "ClassXPackageDocumentItem"("packageId","status");
CREATE INDEX "ClassXPackageDocumentItem_itemType_status_idx" ON "ClassXPackageDocumentItem"("itemType","status");
CREATE INDEX "ClassXPackageDocumentItem_linkedStudentCertificateId_idx" ON "ClassXPackageDocumentItem"("linkedStudentCertificateId");
CREATE INDEX "ClassXPackageDocumentItem_linkedStudentCertificateVersionId_idx" ON "ClassXPackageDocumentItem"("linkedStudentCertificateVersionId");

CREATE TABLE "ClassXPackageChargeRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ruleCode" TEXT NOT NULL,
  "academicYear" TEXT,
  "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
  "name" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "miscellaneousIncomeItemCode" TEXT NOT NULL,
  "paymentRequired" BOOLEAN NOT NULL DEFAULT true,
  "waiverAllowed" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" DATETIME,
  "effectiveTo" DATETIME,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ClassXPackageChargeRule_ruleCode_key" ON "ClassXPackageChargeRule"("ruleCode");
CREATE INDEX "ClassXPackageChargeRule_academicYear_packageType_status_idx" ON "ClassXPackageChargeRule"("academicYear","packageType","status");
CREATE INDEX "ClassXPackageChargeRule_status_effectiveFrom_effectiveTo_idx" ON "ClassXPackageChargeRule"("status","effectiveFrom","effectiveTo");

CREATE TABLE "ClassXPackageCharge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageId" TEXT NOT NULL,
  "chargeRuleId" TEXT,
  "chargeCode" TEXT NOT NULL,
  "miscellaneousIncomeItemCode" TEXT,
  "originalAmount" DECIMAL NOT NULL,
  "waivedAmount" DECIMAL NOT NULL DEFAULT 0,
  "payableAmount" DECIMAL NOT NULL,
  "paidAmount" DECIMAL NOT NULL DEFAULT 0,
  "waiverAllowedSnapshot" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "waiverReason" TEXT,
  "cancellationReason" TEXT,
  "approvedByUserId" TEXT,
  "waivedByUserId" TEXT,
  "collectedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "linkedMiscIncomeReceiptId" TEXT,
  "approvedAt" DATETIME,
  "waivedAt" DATETIME,
  "paidAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassXPackageCharge_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassXPackageCharge_chargeRuleId_fkey" FOREIGN KEY ("chargeRuleId") REFERENCES "ClassXPackageChargeRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassXPackageCharge_linkedMiscIncomeReceiptId_fkey" FOREIGN KEY ("linkedMiscIncomeReceiptId") REFERENCES "MiscIncomeReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassXPackageCharge_packageId_key" ON "ClassXPackageCharge"("packageId");
CREATE UNIQUE INDEX "ClassXPackageCharge_chargeCode_key" ON "ClassXPackageCharge"("chargeCode");
CREATE UNIQUE INDEX "ClassXPackageCharge_linkedMiscIncomeReceiptId_key" ON "ClassXPackageCharge"("linkedMiscIncomeReceiptId");
CREATE INDEX "ClassXPackageCharge_status_createdAt_idx" ON "ClassXPackageCharge"("status","createdAt");
CREATE INDEX "ClassXPackageCharge_chargeRuleId_idx" ON "ClassXPackageCharge"("chargeRuleId");

CREATE TABLE "ClassXPackageHandover" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageId" TEXT NOT NULL,
  "handoverNumber" TEXT NOT NULL,
  "handoverDate" DATETIME NOT NULL,
  "recipientType" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "relationship" TEXT,
  "recipientAcknowledgementText" TEXT NOT NULL,
  "identityChecked" BOOLEAN NOT NULL DEFAULT false,
  "identityCheckMethod" TEXT,
  "itemSnapshotJson" TEXT NOT NULL,
  "handedOverByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassXPackageHandover_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassXPackageHandover_handoverNumber_key" ON "ClassXPackageHandover"("handoverNumber");
CREATE INDEX "ClassXPackageHandover_packageId_handoverDate_idx" ON "ClassXPackageHandover"("packageId","handoverDate");

CREATE TABLE "ClassXPackageEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageId" TEXT NOT NULL,
  "documentItemId" TEXT,
  "chargeId" TEXT,
  "handoverId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassXPackageEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ClassXPackageEvent_packageId_eventDate_idx" ON "ClassXPackageEvent"("packageId","eventDate");
CREATE INDEX "ClassXPackageEvent_documentItemId_idx" ON "ClassXPackageEvent"("documentItemId");
CREATE INDEX "ClassXPackageEvent_chargeId_idx" ON "ClassXPackageEvent"("chargeId");
CREATE INDEX "ClassXPackageEvent_handoverId_idx" ON "ClassXPackageEvent"("handoverId");
CREATE INDEX "ClassXPackageEvent_eventType_eventDate_idx" ON "ClassXPackageEvent"("eventType","eventDate");
