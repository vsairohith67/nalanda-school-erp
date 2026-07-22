-- Prompt 20B: private OCR staging only. Source image bytes remain outside SQLite.
CREATE TABLE "FeeRegisterOcrProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profileCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "providerKind" TEXT NOT NULL DEFAULT 'MANUAL',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
  "paymentPostingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maximumFileBytes" INTEGER NOT NULL DEFAULT 10485760,
  "maximumImagePixels" INTEGER NOT NULL DEFAULT 40000000,
  "maximumPagesPerBatch" INTEGER NOT NULL DEFAULT 20,
  "maximumRowsPerPage" INTEGER NOT NULL DEFAULT 200,
  "requestTimeoutMs" INTEGER NOT NULL DEFAULT 15000,
  "minimumSuggestionConfidence" INTEGER NOT NULL DEFAULT 70,
  "retentionDays" INTEGER,
  "createdByUserId" TEXT,
  "activatedByUserId" TEXT,
  "pausedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "FeeRegisterOcrProfile_profileCode_key" ON "FeeRegisterOcrProfile"("profileCode");
CREATE INDEX "FeeRegisterOcrProfile_providerKind_status_idx" ON "FeeRegisterOcrProfile"("providerKind", "status");
CREATE INDEX "FeeRegisterOcrProfile_paymentPostingEnabled_idx" ON "FeeRegisterOcrProfile"("paymentPostingEnabled");

CREATE TABLE "FeeRegisterOcrBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchNumber" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "registerName" TEXT NOT NULL,
  "registerPeriodStart" DATETIME,
  "registerPeriodEnd" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sourcePageCount" INTEGER NOT NULL DEFAULT 0,
  "extractedRowCount" INTEGER NOT NULL DEFAULT 0,
  "verifiedRowCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateRowCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
  "postedRowCount" INTEGER NOT NULL DEFAULT 0,
  "postingFailedRowCount" INTEGER NOT NULL DEFAULT 0,
  "totalExtractedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "totalVerifiedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "totalPostedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "reviewVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedReviewVersion" INTEGER,
  "reviewNotes" TEXT,
  "approvalNotes" TEXT,
  "rejectionReason" TEXT,
  "cancellationReason" TEXT,
  "createdByUserId" TEXT,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "postedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "submittedAt" DATETIME,
  "approvedAt" DATETIME,
  "postedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FeeRegisterOcrBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FeeRegisterOcrProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeeRegisterOcrBatch_batchNumber_key" ON "FeeRegisterOcrBatch"("batchNumber");
CREATE INDEX "FeeRegisterOcrBatch_academicYear_status_idx" ON "FeeRegisterOcrBatch"("academicYear", "status");
CREATE INDEX "FeeRegisterOcrBatch_profileId_createdAt_idx" ON "FeeRegisterOcrBatch"("profileId", "createdAt");

CREATE TABLE "FeeRegisterOcrPage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "originalDisplayName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "rotationDegrees" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "providerKind" TEXT NOT NULL,
  "providerRequestReferenceSafe" TEXT,
  "rawOcrText" TEXT,
  "overallConfidence" INTEGER,
  "failureMessageSafe" TEXT,
  "processedAt" DATETIME,
  "verifiedAt" DATETIME,
  "purgeAfter" DATETIME,
  "purgedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FeeRegisterOcrPage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeeRegisterOcrPage_batchId_pageNumber_key" ON "FeeRegisterOcrPage"("batchId", "pageNumber");
CREATE INDEX "FeeRegisterOcrPage_sourceSha256_idx" ON "FeeRegisterOcrPage"("sourceSha256");
CREATE INDEX "FeeRegisterOcrPage_batchId_status_idx" ON "FeeRegisterOcrPage"("batchId", "status");

CREATE TABLE "FeeRegisterOcrRow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pageId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "boundingBoxJson" TEXT,
  "rawText" TEXT NOT NULL,
  "extractedFieldsJson" TEXT NOT NULL,
  "fieldConfidenceJson" TEXT NOT NULL,
  "candidateMatchesJson" TEXT NOT NULL DEFAULT '[]',
  "matchedStudentId" TEXT,
  "matchingMethod" TEXT NOT NULL DEFAULT 'NONE',
  "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
  "paymentDate" DATETIME,
  "amountMinor" INTEGER,
  "paymentMode" TEXT,
  "receivedAccount" TEXT,
  "academicTerm" TEXT,
  "handwrittenReceiptReference" TEXT,
  "registerRemarks" TEXT,
  "duplicateClassification" TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  "duplicateEvidenceJson" TEXT,
  "duplicateResolutionReason" TEXT,
  "verificationChecklistJson" TEXT,
  "verificationSnapshotJson" TEXT,
  "verifiedByUserId" TEXT,
  "verifiedAt" DATETIME,
  "rejectedByUserId" TEXT,
  "rejectedAt" DATETIME,
  "rejectionReason" TEXT,
  "postedPaymentId" TEXT,
  "postingFailureSafe" TEXT,
  "postedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FeeRegisterOcrRow_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FeeRegisterOcrPage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeeRegisterOcrRow_postedPaymentId_key" ON "FeeRegisterOcrRow"("postedPaymentId");
CREATE UNIQUE INDEX "FeeRegisterOcrRow_pageId_rowNumber_key" ON "FeeRegisterOcrRow"("pageId", "rowNumber");
CREATE INDEX "FeeRegisterOcrRow_matchedStudentId_paymentDate_amountMinor_idx" ON "FeeRegisterOcrRow"("matchedStudentId", "paymentDate", "amountMinor");
CREATE INDEX "FeeRegisterOcrRow_status_idx" ON "FeeRegisterOcrRow"("status");
CREATE INDEX "FeeRegisterOcrRow_handwrittenReceiptReference_idx" ON "FeeRegisterOcrRow"("handwrittenReceiptReference");

CREATE TABLE "FeeRegisterOcrRowRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rowId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "previousSnapshotJson" TEXT NOT NULL,
  "newSnapshotJson" TEXT NOT NULL,
  "changeReason" TEXT NOT NULL,
  "changedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeRegisterOcrRowRevision_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "FeeRegisterOcrRow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeeRegisterOcrRowRevision_rowId_revisionNumber_key" ON "FeeRegisterOcrRowRevision"("rowId", "revisionNumber");
CREATE INDEX "FeeRegisterOcrRowRevision_rowId_createdAt_idx" ON "FeeRegisterOcrRowRevision"("rowId", "createdAt");

CREATE TABLE "FeeRegisterOcrPostingRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runNumber" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "reviewVersion" INTEGER NOT NULL,
  "selectedRowIdsJson" TEXT NOT NULL,
  "selectedRowCount" INTEGER NOT NULL,
  "attemptedAmountMinor" INTEGER NOT NULL,
  "postedRowCount" INTEGER NOT NULL DEFAULT 0,
  "postedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "failedRowCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
  "financialPreviewJson" TEXT NOT NULL,
  "postingPolicySnapshotJson" TEXT NOT NULL,
  "approvalReason" TEXT,
  "failureSummaryJson" TEXT,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "processedByUserId" TEXT,
  "approvedAt" DATETIME,
  "processedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FeeRegisterOcrPostingRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeeRegisterOcrPostingRun_runNumber_key" ON "FeeRegisterOcrPostingRun"("runNumber");
CREATE INDEX "FeeRegisterOcrPostingRun_batchId_createdAt_idx" ON "FeeRegisterOcrPostingRun"("batchId", "createdAt");
CREATE INDEX "FeeRegisterOcrPostingRun_status_idx" ON "FeeRegisterOcrPostingRun"("status");

CREATE TABLE "FeeRegisterOcrEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "pageId" TEXT,
  "rowId" TEXT,
  "postingRunId" TEXT,
  "eventType" TEXT NOT NULL,
  "safeReason" TEXT,
  "safeMetadataJson" TEXT,
  "actorUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeRegisterOcrEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FeeRegisterOcrEvent_batchId_createdAt_idx" ON "FeeRegisterOcrEvent"("batchId", "createdAt");
CREATE INDEX "FeeRegisterOcrEvent_rowId_createdAt_idx" ON "FeeRegisterOcrEvent"("rowId", "createdAt");
CREATE INDEX "FeeRegisterOcrEvent_eventType_createdAt_idx" ON "FeeRegisterOcrEvent"("eventType", "createdAt");
