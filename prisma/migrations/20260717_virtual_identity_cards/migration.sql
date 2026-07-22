-- Prompt 18C: privacy-safe virtual Student and Staff identity cards.
CREATE TABLE "IdentityCardNumberSeries" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "seriesCode" TEXT NOT NULL,
  "cardType" TEXT NOT NULL,
  "academicYear" TEXT,
  "prefix" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "paddingLength" INTEGER NOT NULL DEFAULT 4,
  "suffix" TEXT,
  "resetPolicy" TEXT NOT NULL DEFAULT 'NEVER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "IdentityCardNumberSeries_seriesCode_key" ON "IdentityCardNumberSeries"("seriesCode");
CREATE INDEX "IdentityCardNumberSeries_cardType_academicYear_status_idx" ON "IdentityCardNumberSeries"("cardType", "academicYear", "status");

CREATE TABLE "IdentityCardTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateCode" TEXT NOT NULL,
  "cardType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "academicYear" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "frontDefinitionJson" TEXT NOT NULL,
  "backDefinitionJson" TEXT NOT NULL,
  "printSettingsJson" TEXT,
  "photoRequired" BOOLEAN NOT NULL DEFAULT false,
  "barcodeEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "activatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "IdentityCardTemplate_templateCode_key" ON "IdentityCardTemplate"("templateCode");
CREATE INDEX "IdentityCardTemplate_cardType_academicYear_status_idx" ON "IdentityCardTemplate"("cardType", "academicYear", "status");

CREATE TABLE "IdentityCardBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchNumber" TEXT NOT NULL,
  "cardType" TEXT NOT NULL,
  "academicYear" TEXT,
  "templateId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "className" TEXT,
  "section" TEXT,
  "staffDesignation" TEXT,
  "validFrom" DATETIME NOT NULL,
  "validUntil" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "expectedCount" INTEGER NOT NULL DEFAULT 0,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "issuedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "scopeSnapshotJson" TEXT,
  "resultSnapshotJson" TEXT,
  "notes" TEXT,
  "cancellationReason" TEXT,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "issuedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "approvedAt" DATETIME,
  "issuedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "IdentityCardBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IdentityCardTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IdentityCardBatch_batchNumber_key" ON "IdentityCardBatch"("batchNumber");
CREATE INDEX "IdentityCardBatch_cardType_academicYear_status_idx" ON "IdentityCardBatch"("cardType", "academicYear", "status");
CREATE INDEX "IdentityCardBatch_templateId_idx" ON "IdentityCardBatch"("templateId");

CREATE TABLE "IdentityCard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cardType" TEXT NOT NULL,
  "batchId" TEXT,
  "templateId" TEXT NOT NULL,
  "numberSeriesId" TEXT,
  "studentId" TEXT,
  "staffMemberId" TEXT,
  "academicYear" TEXT,
  "cardNumber" TEXT,
  "validFrom" DATETIME NOT NULL,
  "validUntil" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
  "draftDataJson" TEXT NOT NULL,
  "templateSnapshotJson" TEXT NOT NULL,
  "issueReason" TEXT,
  "revocationReason" TEXT,
  "cancellationReason" TEXT,
  "replacesCardId" TEXT,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "issuedByUserId" TEXT,
  "revokedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "approvedAt" DATETIME,
  "issuedAt" DATETIME,
  "revokedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "IdentityCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdentityCardBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IdentityCard_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IdentityCardTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IdentityCard_numberSeriesId_fkey" FOREIGN KEY ("numberSeriesId") REFERENCES "IdentityCardNumberSeries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IdentityCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IdentityCard_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IdentityCard_replacesCardId_fkey" FOREIGN KEY ("replacesCardId") REFERENCES "IdentityCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IdentityCard_cardNumber_key" ON "IdentityCard"("cardNumber");
CREATE UNIQUE INDEX "IdentityCard_replacesCardId_key" ON "IdentityCard"("replacesCardId");
CREATE INDEX "IdentityCard_cardType_academicYear_status_idx" ON "IdentityCard"("cardType", "academicYear", "status");
CREATE INDEX "IdentityCard_studentId_academicYear_status_idx" ON "IdentityCard"("studentId", "academicYear", "status");
CREATE INDEX "IdentityCard_staffMemberId_academicYear_status_idx" ON "IdentityCard"("staffMemberId", "academicYear", "status");
CREATE INDEX "IdentityCard_batchId_idx" ON "IdentityCard"("batchId");
CREATE INDEX "IdentityCard_templateId_idx" ON "IdentityCard"("templateId");
CREATE INDEX "IdentityCard_numberSeriesId_idx" ON "IdentityCard"("numberSeriesId");

CREATE TABLE "IdentityCardVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identityCardId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionType" TEXT NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "correctionReason" TEXT,
  "issuedAt" DATETIME NOT NULL,
  "issuedByUserId" TEXT,
  "supersedesVersionId" TEXT,
  "snapshotHash" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityCardVersion_identityCardId_fkey" FOREIGN KEY ("identityCardId") REFERENCES "IdentityCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IdentityCardVersion_identityCardId_versionNumber_key" ON "IdentityCardVersion"("identityCardId", "versionNumber");
CREATE INDEX "IdentityCardVersion_cardNumber_idx" ON "IdentityCardVersion"("cardNumber");
CREATE INDEX "IdentityCardVersion_supersedesVersionId_idx" ON "IdentityCardVersion"("supersedesVersionId");

CREATE TABLE "IdentityCardEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT,
  "identityCardId" TEXT,
  "versionId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityCardEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdentityCardBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IdentityCardEvent_identityCardId_fkey" FOREIGN KEY ("identityCardId") REFERENCES "IdentityCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IdentityCardEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "IdentityCardVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "IdentityCardEvent_batchId_eventDate_idx" ON "IdentityCardEvent"("batchId", "eventDate");
CREATE INDEX "IdentityCardEvent_identityCardId_eventDate_idx" ON "IdentityCardEvent"("identityCardId", "eventDate");
CREATE INDEX "IdentityCardEvent_versionId_idx" ON "IdentityCardEvent"("versionId");
CREATE INDEX "IdentityCardEvent_eventType_eventDate_idx" ON "IdentityCardEvent"("eventType", "eventDate");
