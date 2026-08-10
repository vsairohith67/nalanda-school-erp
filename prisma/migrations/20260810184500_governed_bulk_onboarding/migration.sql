-- IMPORT-1A adds workflow and lineage only. Existing Student, Guardian,
-- StudentGuardian, AcademicYearEnrollment, StaffMember and IAM tables remain
-- authoritative and are not duplicated.
CREATE TABLE "OnboardingBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "bundleType" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'CREATE_AND_LINK',
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "uploadedByUserId" TEXT NOT NULL,
  "originalFileNameHash" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "workbookSha256" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "referenceVersionHash" TEXT,
  "targetVersionHash" TEXT,
  "planHash" TEXT,
  "planVersion" INTEGER NOT NULL DEFAULT 0,
  "planSummaryJson" TEXT,
  "planExpiresAt" DATETIME,
  "approvedByUserId" TEXT,
  "approvalReason" TEXT,
  "approvedAt" DATETIME,
  "executionIdempotencyKey" TEXT,
  "executionPayloadHash" TEXT,
  "executedByUserId" TEXT,
  "executedAt" DATETIME,
  "executionResultJson" TEXT,
  "rollbackPreviewJson" TEXT,
  "rolledBackByUserId" TEXT,
  "rollbackReason" TEXT,
  "rolledBackAt" DATETIME,
  "purgeAfter" DATETIME NOT NULL,
  "purgedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "OnboardingBatch_publicKey_key" ON "OnboardingBatch"("publicKey");
CREATE UNIQUE INDEX "OnboardingBatch_storageKey_key" ON "OnboardingBatch"("storageKey");
CREATE UNIQUE INDEX "OnboardingBatch_executionIdempotencyKey_key" ON "OnboardingBatch"("executionIdempotencyKey");
CREATE UNIQUE INDEX "OnboardingBatch_uploadedByUserId_workbookSha256_bundleType_key" ON "OnboardingBatch"("uploadedByUserId", "workbookSha256", "bundleType");
CREATE INDEX "OnboardingBatch_status_createdAt_idx" ON "OnboardingBatch"("status", "createdAt");
CREATE INDEX "OnboardingBatch_uploadedByUserId_createdAt_idx" ON "OnboardingBatch"("uploadedByUserId", "createdAt");
CREATE INDEX "OnboardingBatch_purgeAfter_purgedAt_idx" ON "OnboardingBatch"("purgeAfter", "purgedAt");

CREATE TABLE "OnboardingRowOutcome" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "sheetName" TEXT NOT NULL,
  "sourceRowNumber" INTEGER NOT NULL,
  "importRowKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "targetRecordId" TEXT,
  "beforeHash" TEXT,
  "afterHash" TEXT,
  "issueCodesJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingRowOutcome_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OnboardingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OnboardingRowOutcome_batchId_entityType_importRowKey_key" ON "OnboardingRowOutcome"("batchId", "entityType", "importRowKey");
CREATE INDEX "OnboardingRowOutcome_batchId_sheetName_sourceRowNumber_idx" ON "OnboardingRowOutcome"("batchId", "sheetName", "sourceRowNumber");
CREATE INDEX "OnboardingRowOutcome_targetRecordId_idx" ON "OnboardingRowOutcome"("targetRecordId");

CREATE TABLE "OnboardingAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "actorUserId" TEXT NOT NULL,
  "reasonSafe" TEXT,
  "evidenceHash" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingAuditEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OnboardingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OnboardingAuditEvent_batchId_sequence_key" ON "OnboardingAuditEvent"("batchId", "sequence");
CREATE INDEX "OnboardingAuditEvent_batchId_occurredAt_idx" ON "OnboardingAuditEvent"("batchId", "occurredAt");
CREATE INDEX "OnboardingAuditEvent_eventType_occurredAt_idx" ON "OnboardingAuditEvent"("eventType", "occurredAt");
