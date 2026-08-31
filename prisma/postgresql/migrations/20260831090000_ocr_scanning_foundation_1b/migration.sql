-- OCR-SCANNING-FOUNDATION-1B durable metadata only. Private source/raster
-- bytes and full raw OCR output remain outside the database.
CREATE TABLE "OcrDocument" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "contextType" TEXT NOT NULL, "contextId" TEXT NOT NULL,
  "uploadIdentityHash" TEXT NOT NULL, "sourceObjectKey" TEXT NOT NULL, "sourceMediaType" TEXT NOT NULL,
  "sourceExtension" TEXT NOT NULL, "safeDisplayName" TEXT NOT NULL, "byteSize" INTEGER NOT NULL,
  "sourceSha256" TEXT NOT NULL, "duplicateOfDocumentId" TEXT, "pageCount" INTEGER NOT NULL,
  "aggregatePixels" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "languageProfile" TEXT NOT NULL DEFAULT 'ENGLISH', "handwritingDeclared" BOOLEAN NOT NULL DEFAULT FALSE,
  "reviewVersion" INTEGER NOT NULL DEFAULT 1, "targetSnapshotVersion" TEXT NOT NULL,
  "retentionPolicyVersion" TEXT NOT NULL DEFAULT 'OCR-1B-SYNTHETIC-1',
  "sourceRetentionUntil" TIMESTAMP(3) NOT NULL, "rasterRetentionUntil" TIMESTAMP(3) NOT NULL,
  "rawOutputRetentionUntil" TIMESTAMP(3) NOT NULL, "candidateRetentionUntil" TIMESTAMP(3) NOT NULL,
  "auditRetentionUntil" TIMESTAMP(3) NOT NULL, "purgeStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "purgeFailureCode" TEXT, "createdByUserId" TEXT NOT NULL, "submittedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3), "expiredAt" TIMESTAMP(3), "purgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OcrDocument_context_check" CHECK ("contextType" IN ('ADMISSION','STUDENT','GUARDIAN','STAFF')),
  CONSTRAINT "OcrDocument_media_check" CHECK ("sourceMediaType" IN ('image/png','image/jpeg','application/pdf') AND "sourceExtension" IN ('.png','.jpg','.jpeg','.pdf')),
  CONSTRAINT "OcrDocument_limits_check" CHECK ("byteSize" BETWEEN 1 AND 26214400 AND "pageCount" BETWEEN 1 AND 25 AND "aggregatePixels" BETWEEN 1 AND 120000000 AND "reviewVersion" >= 1),
  CONSTRAINT "OcrDocument_status_check" CHECK ("status" IN ('UPLOADED','ADMITTED','QUEUED','PROCESSING','OCR_COMPLETE','REVIEW_REQUIRED','REVIEW_IN_PROGRESS','READY_TO_SUBMIT','SUBMITTED','REJECTED','EXPIRED','PURGED','FAILED')),
  CONSTRAINT "OcrDocument_language_check" CHECK ("languageProfile" IN ('ENGLISH','HINDI','TELUGU','ENGLISH_HINDI','ENGLISH_TELUGU','ENGLISH_HINDI_TELUGU')),
  CONSTRAINT "OcrDocument_purge_check" CHECK ("purgeStatus" IN ('NOT_REQUESTED','PENDING','PARTIAL_FAILURE','CONFIRMED'))
);

CREATE TABLE "OcrJob" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "documentId" TEXT NOT NULL, "idempotencyKeyHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED', "attemptCount" INTEGER NOT NULL DEFAULT 0, "maximumAttempts" INTEGER NOT NULL DEFAULT 3,
  "leaseOwner" TEXT, "leaseTokenHash" TEXT, "leaseExpiresAt" TIMESTAMP(3), "heartbeatAt" TIMESTAMP(3),
  "timeoutAt" TIMESTAMP(3) NOT NULL, "cancellationRequested" BOOLEAN NOT NULL DEFAULT FALSE,
  "engineId" TEXT, "engineRevision" TEXT, "modelReceiptJson" TEXT, "resultSha256" TEXT, "outputBytes" INTEGER,
  "failureCode" TEXT, "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OcrJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OcrDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OcrJob_status_check" CHECK ("status" IN ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED','DEAD')),
  CONSTRAINT "OcrJob_limits_check" CHECK ("attemptCount" BETWEEN 0 AND "maximumAttempts" AND "maximumAttempts" BETWEEN 1 AND 5 AND ("outputBytes" IS NULL OR "outputBytes" BETWEEN 0 AND 52428800))
);

CREATE TABLE "OcrPage" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "documentId" TEXT NOT NULL, "pageNumber" INTEGER NOT NULL,
  "rasterObjectKey" TEXT NOT NULL, "rasterSha256" TEXT NOT NULL, "sourceDigest" TEXT NOT NULL,
  "sourceWidth" INTEGER NOT NULL, "sourceHeight" INTEGER NOT NULL, "sourceRotation" INTEGER NOT NULL DEFAULT 0,
  "reviewOrientation" INTEGER NOT NULL DEFAULT 0, "pixelCount" INTEGER NOT NULL,
  "ocrState" TEXT NOT NULL DEFAULT 'OCR_COMPLETE', "processingDurationMs" INTEGER NOT NULL,
  "retryPreprocessing" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OcrPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OcrDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OcrPage_contract_check" CHECK ("pageNumber" BETWEEN 1 AND 25 AND "sourceWidth" BETWEEN 1 AND 6000 AND "sourceHeight" BETWEEN 1 AND 6000 AND "pixelCount" BETWEEN 1 AND 40000000 AND "sourceRotation" IN (0,90,180,270) AND "reviewOrientation" IN (0,90,180,270) AND "processingDurationMs" BETWEEN 0 AND 120000 AND "ocrState" IN ('OCR_COMPLETE','REVIEW_REQUIRED','FAILED'))
);

CREATE TABLE "OcrFieldCandidate" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "documentId" TEXT NOT NULL, "pageId" TEXT, "fieldKey" TEXT NOT NULL,
  "candidateText" TEXT NOT NULL, "candidateSha256" TEXT NOT NULL, "sourceRegionJson" TEXT, "recognitionScore" DOUBLE PRECISION,
  "scriptHint" TEXT NOT NULL, "validationState" TEXT NOT NULL, "reviewState" TEXT NOT NULL,
  "critical" BOOLEAN NOT NULL DEFAULT FALSE, "retryPreprocessing" BOOLEAN NOT NULL DEFAULT FALSE,
  "decision" TEXT NOT NULL DEFAULT 'PENDING', "approvedValue" TEXT, "editReason" TEXT, "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OcrFieldCandidate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OcrDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OcrFieldCandidate_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "OcrPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OcrFieldCandidate_contract_check" CHECK (char_length("candidateText") <= 2000 AND char_length("fieldKey") BETWEEN 1 AND 80 AND "version" >= 1 AND ("recognitionScore" IS NULL OR "recognitionScore" BETWEEN 0.0 AND 1.0) AND "scriptHint" IN ('LATIN','DEVANAGARI','TELUGU','MIXED','UNKNOWN') AND "validationState" IN ('VALID_FORMAT','INVALID_FORMAT','AMBIGUOUS','MISSING') AND "reviewState" IN ('GREEN','AMBER','RED') AND "decision" IN ('PENDING','ACCEPTED','EDITED','REJECTED_CANDIDATE','MISSING_VALUE'))
);

CREATE TABLE "OcrSubmission" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "documentId" TEXT NOT NULL, "idempotencyKeyHash" TEXT NOT NULL,
  "reviewVersion" INTEGER NOT NULL, "targetSnapshotVersion" TEXT NOT NULL, "payloadSha256" TEXT NOT NULL,
  "authoritativeService" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "resultReference" TEXT,
  "failureCode" TEXT, "submittedByUserId" TEXT NOT NULL, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OcrSubmission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OcrDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OcrSubmission_contract_check" CHECK ("reviewVersion" >= 1 AND "status" IN ('PENDING','COMPLETED','STALE','FAILED') AND "authoritativeService" IN ('ADMISSIONS','STUDENTS','GUARDIANS','STAFF'))
);

CREATE TABLE "OcrWorkflowEvent" (
  "id" TEXT PRIMARY KEY, "documentId" TEXT, "jobId" TEXT, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL, "actorUserId" TEXT, "workerId" TEXT, "requestNonceHash" TEXT,
  "safeMetadataJson" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OcrWorkflowEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OcrDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OcrWorkflowEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OcrJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OcrDocument_publicKey_key" ON "OcrDocument"("publicKey");
CREATE UNIQUE INDEX "OcrDocument_sourceObjectKey_key" ON "OcrDocument"("sourceObjectKey");
CREATE UNIQUE INDEX "OcrDocument_contextType_contextId_uploadIdentityHash_key" ON "OcrDocument"("contextType","contextId","uploadIdentityHash");
CREATE INDEX "OcrDocument_contextType_contextId_createdAt_idx" ON "OcrDocument"("contextType","contextId","createdAt");
CREATE INDEX "OcrDocument_contextType_contextId_sourceSha256_idx" ON "OcrDocument"("contextType","contextId","sourceSha256");
CREATE INDEX "OcrDocument_status_updatedAt_idx" ON "OcrDocument"("status","updatedAt");
CREATE INDEX "OcrDocument_sourceRetentionUntil_idx" ON "OcrDocument"("sourceRetentionUntil");
CREATE INDEX "OcrDocument_purgeStatus_updatedAt_idx" ON "OcrDocument"("purgeStatus","updatedAt");
CREATE UNIQUE INDEX "OcrJob_publicKey_key" ON "OcrJob"("publicKey");
CREATE UNIQUE INDEX "OcrJob_documentId_idempotencyKeyHash_key" ON "OcrJob"("documentId","idempotencyKeyHash");
CREATE INDEX "OcrJob_status_queuedAt_idx" ON "OcrJob"("status","queuedAt");
CREATE INDEX "OcrJob_leaseExpiresAt_idx" ON "OcrJob"("leaseExpiresAt");
CREATE INDEX "OcrJob_documentId_createdAt_idx" ON "OcrJob"("documentId","createdAt");
CREATE UNIQUE INDEX "OcrPage_publicKey_key" ON "OcrPage"("publicKey");
CREATE UNIQUE INDEX "OcrPage_rasterObjectKey_key" ON "OcrPage"("rasterObjectKey");
CREATE UNIQUE INDEX "OcrPage_documentId_pageNumber_key" ON "OcrPage"("documentId","pageNumber");
CREATE INDEX "OcrPage_documentId_pageNumber_idx" ON "OcrPage"("documentId","pageNumber");
CREATE INDEX "OcrPage_ocrState_updatedAt_idx" ON "OcrPage"("ocrState","updatedAt");
CREATE UNIQUE INDEX "OcrFieldCandidate_publicKey_key" ON "OcrFieldCandidate"("publicKey");
CREATE UNIQUE INDEX "OcrFieldCandidate_documentId_fieldKey_key" ON "OcrFieldCandidate"("documentId","fieldKey");
CREATE INDEX "OcrFieldCandidate_documentId_reviewState_decision_idx" ON "OcrFieldCandidate"("documentId","reviewState","decision");
CREATE INDEX "OcrFieldCandidate_pageId_idx" ON "OcrFieldCandidate"("pageId");
CREATE INDEX "OcrFieldCandidate_reviewedByUserId_reviewedAt_idx" ON "OcrFieldCandidate"("reviewedByUserId","reviewedAt");
CREATE UNIQUE INDEX "OcrSubmission_publicKey_key" ON "OcrSubmission"("publicKey");
CREATE UNIQUE INDEX "OcrSubmission_documentId_idempotencyKeyHash_key" ON "OcrSubmission"("documentId","idempotencyKeyHash");
CREATE INDEX "OcrSubmission_documentId_createdAt_idx" ON "OcrSubmission"("documentId","createdAt");
CREATE INDEX "OcrSubmission_status_createdAt_idx" ON "OcrSubmission"("status","createdAt");
CREATE UNIQUE INDEX "OcrWorkflowEvent_requestNonceHash_key" ON "OcrWorkflowEvent"("requestNonceHash");
CREATE INDEX "OcrWorkflowEvent_documentId_occurredAt_idx" ON "OcrWorkflowEvent"("documentId","occurredAt");
CREATE INDEX "OcrWorkflowEvent_jobId_occurredAt_idx" ON "OcrWorkflowEvent"("jobId","occurredAt");
CREATE INDEX "OcrWorkflowEvent_entityType_entityId_occurredAt_idx" ON "OcrWorkflowEvent"("entityType","entityId","occurredAt");
CREATE INDEX "OcrWorkflowEvent_eventType_occurredAt_idx" ON "OcrWorkflowEvent"("eventType","occurredAt");
CREATE INDEX "OcrWorkflowEvent_actorUserId_occurredAt_idx" ON "OcrWorkflowEvent"("actorUserId","occurredAt");
