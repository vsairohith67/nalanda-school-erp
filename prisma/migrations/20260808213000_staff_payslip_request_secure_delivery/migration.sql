CREATE TABLE "StaffPayslipMonthAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "salaryMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sourceType" TEXT NOT NULL DEFAULT 'HISTORICAL_RECORD',
    "existingPayslipVersionId" TEXT,
    "authorizedByUserId" TEXT NOT NULL,
    "authorizationReason" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffPayslipMonthAvailability_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipMonthAvailability_status_check" CHECK ("status" IN ('AVAILABLE', 'ALREADY_ISSUED', 'UNAVAILABLE', 'UNKNOWN', 'RECORD_REVIEW_REQUIRED')),
    CONSTRAINT "StaffPayslipMonthAvailability_source_check" CHECK ("sourceType" IN ('HISTORICAL_RECORD', 'EXISTING_PAYSLIP')),
    CONSTRAINT "StaffPayslipMonthAvailability_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "StaffPayslipRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "privateExplanation" TEXT,
    "requiredByDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "correctionOfRequestId" TEXT,
    "assignedPreparerUserId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparationStartedAt" DATETIME,
    "readyToIssueAt" DATETIME,
    "issuedAt" DATETIME,
    "rejectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "supersededAt" DATETIME,
    "expiredAt" DATETIME,
    "retentionReviewDate" DATETIME,
    "archiveStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "legalPolicyHold" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffPayslipRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipRequest_correctionOfRequestId_fkey" FOREIGN KEY ("correctionOfRequestId") REFERENCES "StaffPayslipRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipRequest_status_check" CHECK ("status" IN ('SUBMITTED', 'UNDER_REVIEW', 'PREPARATION_IN_PROGRESS', 'READY_TO_ISSUE', 'PARTIALLY_ISSUED', 'ISSUED', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'EXPIRED')),
    CONSTRAINT "StaffPayslipRequest_purpose_check" CHECK ("purpose" IN ('BANK_OR_LOAN', 'VISA_OR_TRAVEL', 'INCOME_PROOF', 'TAX_OR_FINANCIAL_RECORD', 'EMPLOYMENT_RECORD', 'PERSONAL_RECORD', 'OTHER')),
    CONSTRAINT "StaffPayslipRequest_archive_check" CHECK ("archiveStatus" IN ('ACTIVE', 'REVIEW_DUE', 'ARCHIVED')),
    CONSTRAINT "StaffPayslipRequest_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "StaffPayslipRequestMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "salaryMonth" TEXT NOT NULL,
    "availabilitySnapshot" TEXT NOT NULL,
    "issueStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "activeOverlapKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffPayslipRequestMonth_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipRequestMonth_issue_check" CHECK ("issueStatus" IN ('PENDING', 'ISSUED', 'SUPERSEDED'))
);

CREATE TABLE "StaffPayslipRequestEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER NOT NULL,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "requestHash" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffPayslipRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipRequestEvent_version_check" CHECK ("entityVersion" >= 1)
);

CREATE TABLE "StaffPayslipDocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY_TO_ISSUE',
    "verificationReference" TEXT NOT NULL,
    "sourceStorageKey" TEXT NOT NULL,
    "sourceKeyVersion" TEXT NOT NULL,
    "sourceNonce" TEXT NOT NULL,
    "sourceAuthTag" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "sourceByteSize" INTEGER NOT NULL,
    "derivativeStorageKey" TEXT NOT NULL,
    "derivativeSha256" TEXT NOT NULL,
    "derivativeByteSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "passwordKeyVersion" TEXT NOT NULL,
    "passwordNonce" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "passwordAuthTag" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "issuedAt" DATETIME,
    "replacementReason" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffPayslipDocumentVersion_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipDocumentVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "StaffPayslipDocumentVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipDocumentVersion_status_check" CHECK ("status" IN ('READY_TO_ISSUE', 'ACTIVE', 'REPLACED', 'WITHDRAWN')),
    CONSTRAINT "StaffPayslipDocumentVersion_size_check" CHECK ("sourceByteSize" > 0 AND "derivativeByteSize" > 0 AND "pageCount" BETWEEN 1 AND 50),
    CONSTRAINT "StaffPayslipDocumentVersion_version_check" CHECK ("versionNumber" >= 1)
);

CREATE TABLE "StaffPayslipDocumentMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentVersionId" TEXT NOT NULL,
    "requestMonthId" TEXT NOT NULL,
    "salaryMonth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffPayslipDocumentMonth_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "StaffPayslipDocumentVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipDocumentMonth_requestMonthId_fkey" FOREIGN KEY ("requestMonthId") REFERENCES "StaffPayslipRequestMonth" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StaffPayslipAccessEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "safeClientJson" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffPayslipAccessEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipAccessEvent_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "StaffPayslipDocumentVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipAccessEvent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffPayslipAccessEvent_type_check" CHECK ("eventType" IN ('VIEW', 'DOWNLOAD', 'PASSWORD_REVEAL'))
);

CREATE UNIQUE INDEX "StaffPayslipMonthAvailability_publicKey_key" ON "StaffPayslipMonthAvailability"("publicKey");
CREATE INDEX "StaffPayslipMonthAvailability_salaryMonth_status_idx" ON "StaffPayslipMonthAvailability"("salaryMonth", "status");
CREATE INDEX "StaffPayslipMonthAvailability_staffMemberId_status_idx" ON "StaffPayslipMonthAvailability"("staffMemberId", "status");
CREATE UNIQUE INDEX "StaffPayslipMonthAvailability_staffMemberId_salaryMonth_key" ON "StaffPayslipMonthAvailability"("staffMemberId", "salaryMonth");
CREATE UNIQUE INDEX "StaffPayslipRequest_publicKey_key" ON "StaffPayslipRequest"("publicKey");
CREATE UNIQUE INDEX "StaffPayslipRequest_requestNumber_key" ON "StaffPayslipRequest"("requestNumber");
CREATE UNIQUE INDEX "StaffPayslipRequest_submissionKey_key" ON "StaffPayslipRequest"("submissionKey");
CREATE INDEX "StaffPayslipRequest_staffMemberId_status_createdAt_idx" ON "StaffPayslipRequest"("staffMemberId", "status", "createdAt");
CREATE INDEX "StaffPayslipRequest_status_requiredByDate_idx" ON "StaffPayslipRequest"("status", "requiredByDate");
CREATE INDEX "StaffPayslipRequest_assignedPreparerUserId_status_idx" ON "StaffPayslipRequest"("assignedPreparerUserId", "status");
CREATE INDEX "StaffPayslipRequest_correctionOfRequestId_idx" ON "StaffPayslipRequest"("correctionOfRequestId");
CREATE UNIQUE INDEX "StaffPayslipRequestMonth_activeOverlapKey_key" ON "StaffPayslipRequestMonth"("activeOverlapKey");
CREATE INDEX "StaffPayslipRequestMonth_salaryMonth_issueStatus_idx" ON "StaffPayslipRequestMonth"("salaryMonth", "issueStatus");
CREATE UNIQUE INDEX "StaffPayslipRequestMonth_requestId_salaryMonth_key" ON "StaffPayslipRequestMonth"("requestId", "salaryMonth");
CREATE UNIQUE INDEX "StaffPayslipRequestEvent_publicKey_key" ON "StaffPayslipRequestEvent"("publicKey");
CREATE INDEX "StaffPayslipRequestEvent_requestId_occurredAt_idx" ON "StaffPayslipRequestEvent"("requestId", "occurredAt");
CREATE INDEX "StaffPayslipRequestEvent_eventType_occurredAt_idx" ON "StaffPayslipRequestEvent"("eventType", "occurredAt");
CREATE INDEX "StaffPayslipRequestEvent_requestHash_idx" ON "StaffPayslipRequestEvent"("requestHash");
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_publicKey_key" ON "StaffPayslipDocumentVersion"("publicKey");
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_verificationReference_key" ON "StaffPayslipDocumentVersion"("verificationReference");
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_sourceStorageKey_key" ON "StaffPayslipDocumentVersion"("sourceStorageKey");
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_derivativeStorageKey_key" ON "StaffPayslipDocumentVersion"("derivativeStorageKey");
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_supersedesVersionId_key" ON "StaffPayslipDocumentVersion"("supersedesVersionId");
CREATE INDEX "StaffPayslipDocumentVersion_requestId_status_createdAt_idx" ON "StaffPayslipDocumentVersion"("requestId", "status", "createdAt");
CREATE INDEX "StaffPayslipDocumentVersion_status_issuedAt_idx" ON "StaffPayslipDocumentVersion"("status", "issuedAt");
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_requestId_versionNumber_key" ON "StaffPayslipDocumentVersion"("requestId", "versionNumber");
CREATE INDEX "StaffPayslipDocumentMonth_requestMonthId_createdAt_idx" ON "StaffPayslipDocumentMonth"("requestMonthId", "createdAt");
CREATE INDEX "StaffPayslipDocumentMonth_salaryMonth_idx" ON "StaffPayslipDocumentMonth"("salaryMonth");
CREATE UNIQUE INDEX "StaffPayslipDocumentMonth_documentVersionId_requestMonthId_key" ON "StaffPayslipDocumentMonth"("documentVersionId", "requestMonthId");
CREATE UNIQUE INDEX "StaffPayslipAccessEvent_publicKey_key" ON "StaffPayslipAccessEvent"("publicKey");
CREATE INDEX "StaffPayslipAccessEvent_requestId_occurredAt_idx" ON "StaffPayslipAccessEvent"("requestId", "occurredAt");
CREATE INDEX "StaffPayslipAccessEvent_documentVersionId_occurredAt_idx" ON "StaffPayslipAccessEvent"("documentVersionId", "occurredAt");
CREATE INDEX "StaffPayslipAccessEvent_staffMemberId_occurredAt_idx" ON "StaffPayslipAccessEvent"("staffMemberId", "occurredAt");
CREATE INDEX "StaffPayslipAccessEvent_actorUserId_eventType_occurredAt_idx" ON "StaffPayslipAccessEvent"("actorUserId", "eventType", "occurredAt");

CREATE TRIGGER "StaffPayslipRequest_no_delete"
BEFORE DELETE ON "StaffPayslipRequest"
BEGIN SELECT RAISE(ABORT, 'Staff payslip requests are append-preserved'); END;

CREATE TRIGGER "StaffPayslipRequestMonth_no_delete"
BEFORE DELETE ON "StaffPayslipRequestMonth"
BEGIN SELECT RAISE(ABORT, 'Staff payslip request months are append-preserved'); END;

CREATE TRIGGER "StaffPayslipRequestEvent_no_update"
BEFORE UPDATE ON "StaffPayslipRequestEvent"
BEGIN SELECT RAISE(ABORT, 'Staff payslip request events are append-only'); END;

CREATE TRIGGER "StaffPayslipRequestEvent_no_delete"
BEFORE DELETE ON "StaffPayslipRequestEvent"
BEGIN SELECT RAISE(ABORT, 'Staff payslip request events are append-only'); END;

CREATE TRIGGER "StaffPayslipDocumentVersion_no_delete"
BEFORE DELETE ON "StaffPayslipDocumentVersion"
BEGIN SELECT RAISE(ABORT, 'Staff payslip document versions are immutable'); END;

CREATE TRIGGER "StaffPayslipDocumentVersion_issued_immutable"
BEFORE UPDATE ON "StaffPayslipDocumentVersion"
FOR EACH ROW WHEN OLD."status" IN ('ACTIVE', 'REPLACED', 'WITHDRAWN') AND (
  NEW."requestId" <> OLD."requestId" OR NEW."versionNumber" <> OLD."versionNumber" OR
  NEW."verificationReference" <> OLD."verificationReference" OR NEW."sourceStorageKey" <> OLD."sourceStorageKey" OR
  NEW."sourceKeyVersion" <> OLD."sourceKeyVersion" OR NEW."sourceNonce" <> OLD."sourceNonce" OR
  NEW."sourceAuthTag" <> OLD."sourceAuthTag" OR NEW."sourceSha256" <> OLD."sourceSha256" OR
  NEW."sourceByteSize" <> OLD."sourceByteSize" OR NEW."derivativeStorageKey" <> OLD."derivativeStorageKey" OR
  NEW."derivativeSha256" <> OLD."derivativeSha256" OR NEW."derivativeByteSize" <> OLD."derivativeByteSize" OR
  NEW."pageCount" <> OLD."pageCount" OR NEW."passwordKeyVersion" <> OLD."passwordKeyVersion" OR
  NEW."passwordNonce" <> OLD."passwordNonce" OR NEW."passwordCiphertext" <> OLD."passwordCiphertext" OR
  NEW."passwordAuthTag" <> OLD."passwordAuthTag" OR NEW."uploadedByUserId" <> OLD."uploadedByUserId" OR
  COALESCE(NEW."supersedesVersionId", '') <> COALESCE(OLD."supersedesVersionId", '')
)
BEGIN SELECT RAISE(ABORT, 'Issued staff payslip document bytes and protection metadata are immutable'); END;

CREATE TRIGGER "StaffPayslipDocumentMonth_no_update"
BEFORE UPDATE ON "StaffPayslipDocumentMonth"
BEGIN SELECT RAISE(ABORT, 'Staff payslip document month links are immutable'); END;

CREATE TRIGGER "StaffPayslipDocumentMonth_no_delete"
BEFORE DELETE ON "StaffPayslipDocumentMonth"
BEGIN SELECT RAISE(ABORT, 'Staff payslip document month links are immutable'); END;

CREATE TRIGGER "StaffPayslipAccessEvent_no_update"
BEFORE UPDATE ON "StaffPayslipAccessEvent"
BEGIN SELECT RAISE(ABORT, 'Staff payslip access events are append-only'); END;

CREATE TRIGGER "StaffPayslipAccessEvent_no_delete"
BEFORE DELETE ON "StaffPayslipAccessEvent"
BEGIN SELECT RAISE(ABORT, 'Staff payslip access events are append-only'); END;
