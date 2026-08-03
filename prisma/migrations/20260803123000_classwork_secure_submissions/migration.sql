-- Prompt 23F: governed classwork, private attachments and immutable submissions.

-- Student self-service is a governed IAM context. Rebuild the existing table
-- only to widen its role check; all rows and natural keys are preserved.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DROP TRIGGER "iam_prevent_last_super_admin_suspension";
DROP TRIGGER "iam_prevent_last_super_admin_role_end";
DROP TRIGGER "iam_prevent_active_super_admin_role_delete";
DROP TRIGGER "iam_prevent_expiring_super_admin_role_insert";
DROP TRIGGER "iam_prevent_expiring_super_admin_role_update";
CREATE TABLE "new_UserRoleAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" DATETIME,
  "reason" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "endedByUserId" TEXT,
  "endedAt" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  "contextVersion" INTEGER NOT NULL DEFAULT 1,
  "activeKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserRoleAssignment_role_check" CHECK ("role" IN ('SUPER_ADMIN','DIRECTOR','PRINCIPAL','ADMIN','ACCOUNTANT','COMPUTER_OPERATOR','TEACHER','PARENT','STUDENT','VIEWER')),
  CONSTRAINT "UserRoleAssignment_status_check" CHECK ("status" IN ('ACTIVE','ENDED','REVOKED')),
  CONSTRAINT "UserRoleAssignment_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "UserRoleAssignment_end_check" CHECK (("status" = 'ACTIVE' AND "endedAt" IS NULL) OR ("status" <> 'ACTIVE' AND "endedAt" IS NOT NULL))
);
INSERT INTO "new_UserRoleAssignment" ("id","publicKey","userId","role","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","contextVersion","activeKey","createdAt","updatedAt") SELECT "id","publicKey","userId","role","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","contextVersion","activeKey","createdAt","updatedAt" FROM "UserRoleAssignment";
DROP TABLE "UserRoleAssignment";
ALTER TABLE "new_UserRoleAssignment" RENAME TO "UserRoleAssignment";
CREATE UNIQUE INDEX "UserRoleAssignment_publicKey_key" ON "UserRoleAssignment"("publicKey");
CREATE UNIQUE INDEX "UserRoleAssignment_activeKey_key" ON "UserRoleAssignment"("activeKey");
CREATE INDEX "UserRoleAssignment_userId_status_validFrom_validUntil_idx" ON "UserRoleAssignment"("userId","status","validFrom","validUntil");
CREATE INDEX "UserRoleAssignment_role_status_idx" ON "UserRoleAssignment"("role","status");
CREATE TRIGGER "iam_prevent_last_super_admin_suspension"
BEFORE UPDATE OF "isActive", "lifecycleStatus" ON "User"
WHEN OLD."isActive" = 1 AND OLD."lifecycleStatus" = 'ACTIVE' AND (NEW."isActive" <> 1 OR NEW."lifecycleStatus" <> 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "UserRoleAssignment" assignment WHERE assignment."userId" = OLD."id" AND assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE')
  AND (SELECT COUNT(*) FROM "UserRoleAssignment" assignment JOIN "User" account ON account."id" = assignment."userId" WHERE assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE' AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE') <= 1
BEGIN SELECT RAISE(ABORT, 'LAST_ACTIVE_SUPER_ADMIN_REQUIRED'); END;
CREATE TRIGGER "iam_prevent_last_super_admin_role_end"
BEFORE UPDATE OF "role", "status" ON "UserRoleAssignment"
WHEN OLD."role" = 'SUPER_ADMIN' AND OLD."status" = 'ACTIVE' AND (NEW."role" <> 'SUPER_ADMIN' OR NEW."status" <> 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "User" account WHERE account."id" = OLD."userId" AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE')
  AND (SELECT COUNT(*) FROM "UserRoleAssignment" assignment JOIN "User" account ON account."id" = assignment."userId" WHERE assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE' AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE') <= 1
BEGIN SELECT RAISE(ABORT, 'LAST_ACTIVE_SUPER_ADMIN_REQUIRED'); END;
CREATE TRIGGER "iam_prevent_active_super_admin_role_delete"
BEFORE DELETE ON "UserRoleAssignment"
WHEN OLD."role" = 'SUPER_ADMIN' AND OLD."status" = 'ACTIVE' AND EXISTS (SELECT 1 FROM "User" account WHERE account."id" = OLD."userId" AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE')
BEGIN SELECT RAISE(ABORT, 'ACTIVE_SUPER_ADMIN_HISTORY_IS_IMMUTABLE'); END;
CREATE TRIGGER "iam_prevent_expiring_super_admin_role_insert" BEFORE INSERT ON "UserRoleAssignment" WHEN NEW."role" = 'SUPER_ADMIN' AND NEW."validUntil" IS NOT NULL BEGIN SELECT RAISE(ABORT, 'SUPER_ADMIN_ASSIGNMENT_CANNOT_EXPIRE'); END;
CREATE TRIGGER "iam_prevent_expiring_super_admin_role_update" BEFORE UPDATE OF "role", "validUntil" ON "UserRoleAssignment" WHEN NEW."role" = 'SUPER_ADMIN' AND NEW."validUntil" IS NOT NULL BEGIN SELECT RAISE(ABORT, 'SUPER_ADMIN_ASSIGNMENT_CANNOT_EXPIRE'); END;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE TABLE "ClassworkItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "itemNumber" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL,
  "timetableSubjectId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "closedByUserId" TEXT,
  "archivedByUserId" TEXT,
  "publishedAt" DATETIME,
  "closedAt" DATETIME,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassworkItem_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkItem_kind_check" CHECK ("kind" IN ('CLASSWORK','HOMEWORK','ASSIGNMENT')),
  CONSTRAINT "ClassworkItem_status_check" CHECK ("status" IN ('DRAFT','PUBLISHED','CLOSED','ARCHIVED')),
  CONSTRAINT "ClassworkItem_scope_check" CHECK (length(trim("academicYear")) > 0 AND length(trim("className")) > 0 AND length(trim("section")) > 0 AND length(trim("subjectName")) > 0),
  CONSTRAINT "ClassworkItem_version_check" CHECK ("currentVersionNumber" >= 1 AND "rowVersion" >= 1)
);
CREATE UNIQUE INDEX "ClassworkItem_publicKey_key" ON "ClassworkItem"("publicKey");
CREATE UNIQUE INDEX "ClassworkItem_itemNumber_key" ON "ClassworkItem"("itemNumber");
CREATE INDEX "ClassworkItem_academicYear_className_section_subjectName_idx" ON "ClassworkItem"("academicYear","className","section","subjectName");
CREATE INDEX "ClassworkItem_timetableSubjectId_academicYear_idx" ON "ClassworkItem"("timetableSubjectId","academicYear");
CREATE INDEX "ClassworkItem_status_publishedAt_idx" ON "ClassworkItem"("status","publishedAt");
CREATE INDEX "ClassworkItem_createdByUserId_createdAt_idx" ON "ClassworkItem"("createdByUserId","createdAt");

CREATE TABLE "ClassworkItemVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "instructions" TEXT NOT NULL,
  "dueAt" DATETIME,
  "correctionReason" TEXT,
  "publishRequestKey" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "publishedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" DATETIME,
  "replacedAt" DATETIME,
  CONSTRAINT "ClassworkItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClassworkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkItemVersion_status_check" CHECK ("versionStatus" IN ('DRAFT','PUBLISHED','REPLACED')),
  CONSTRAINT "ClassworkItemVersion_number_check" CHECK ("versionNumber" >= 1)
);
CREATE UNIQUE INDEX "ClassworkItemVersion_publicKey_key" ON "ClassworkItemVersion"("publicKey");
CREATE UNIQUE INDEX "ClassworkItemVersion_publishRequestKey_key" ON "ClassworkItemVersion"("publishRequestKey");
CREATE UNIQUE INDEX "ClassworkItemVersion_itemId_versionNumber_key" ON "ClassworkItemVersion"("itemId","versionNumber");
CREATE INDEX "ClassworkItemVersion_itemId_versionStatus_idx" ON "ClassworkItemVersion"("itemId","versionStatus");
CREATE INDEX "ClassworkItemVersion_publishedAt_idx" ON "ClassworkItemVersion"("publishedAt");

CREATE TABLE "ClassworkSubmission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "createdByRole" TEXT NOT NULL,
  "lastSubmittedByUserId" TEXT,
  "lastSubmittedByRole" TEXT,
  "firstSubmittedAt" DATETIME,
  "lastSubmittedAt" DATETIME,
  "returnedAt" DATETIME,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassworkSubmission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClassworkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkSubmission_status_check" CHECK ("status" IN ('DRAFT','SUBMITTED','LATE','RETURNED','RESUBMITTED','REVIEWED')),
  CONSTRAINT "ClassworkSubmission_version_check" CHECK ("currentVersionNumber" >= 1 AND "rowVersion" >= 1)
);
CREATE UNIQUE INDEX "ClassworkSubmission_publicKey_key" ON "ClassworkSubmission"("publicKey");
CREATE UNIQUE INDEX "ClassworkSubmission_itemId_studentId_key" ON "ClassworkSubmission"("itemId","studentId");
CREATE INDEX "ClassworkSubmission_itemId_status_lastSubmittedAt_idx" ON "ClassworkSubmission"("itemId","status","lastSubmittedAt");
CREATE INDEX "ClassworkSubmission_studentId_status_updatedAt_idx" ON "ClassworkSubmission"("studentId","status","updatedAt");

CREATE TABLE "ClassworkSubmissionVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "itemVersionId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "textBody" TEXT,
  "submissionRequestKey" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdByRole" TEXT NOT NULL,
  "parentGuardianId" TEXT,
  "submittedAt" DATETIME,
  "lockedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassworkSubmissionVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ClassworkSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkSubmissionVersion_itemVersionId_fkey" FOREIGN KEY ("itemVersionId") REFERENCES "ClassworkItemVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkSubmissionVersion_status_check" CHECK ("versionStatus" IN ('DRAFT','SUBMITTED','LATE','RESUBMITTED')),
  CONSTRAINT "ClassworkSubmissionVersion_number_check" CHECK ("versionNumber" >= 1)
);
CREATE UNIQUE INDEX "ClassworkSubmissionVersion_publicKey_key" ON "ClassworkSubmissionVersion"("publicKey");
CREATE UNIQUE INDEX "ClassworkSubmissionVersion_submissionRequestKey_key" ON "ClassworkSubmissionVersion"("submissionRequestKey");
CREATE UNIQUE INDEX "ClassworkSubmissionVersion_submissionId_versionNumber_key" ON "ClassworkSubmissionVersion"("submissionId","versionNumber");
CREATE INDEX "ClassworkSubmissionVersion_submissionId_versionStatus_idx" ON "ClassworkSubmissionVersion"("submissionId","versionStatus");
CREATE INDEX "ClassworkSubmissionVersion_itemVersionId_idx" ON "ClassworkSubmissionVersion"("itemVersionId");

CREATE TABLE "ClassworkAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "itemVersionId" TEXT,
  "submissionVersionId" TEXT,
  "storageKey" TEXT NOT NULL,
  "safeDisplayName" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "recoveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "backupArtifactSha256" TEXT,
  "backupKeyVersion" TEXT,
  "backupVerifiedAt" DATETIME,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassworkAttachment_itemVersionId_fkey" FOREIGN KEY ("itemVersionId") REFERENCES "ClassworkItemVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkAttachment_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "ClassworkSubmissionVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkAttachment_owner_check" CHECK (("itemVersionId" IS NOT NULL AND "submissionVersionId" IS NULL) OR ("itemVersionId" IS NULL AND "submissionVersionId" IS NOT NULL)),
  CONSTRAINT "ClassworkAttachment_type_check" CHECK (("extension" = '.pdf' AND "mediaType" = 'application/pdf') OR ("extension" = '.png' AND "mediaType" = 'image/png') OR ("extension" IN ('.jpg','.jpeg') AND "mediaType" = 'image/jpeg') OR ("extension" = '.webp' AND "mediaType" = 'image/webp')),
  CONSTRAINT "ClassworkAttachment_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880),
  CONSTRAINT "ClassworkAttachment_dimension_check" CHECK (("width" IS NULL AND "height" IS NULL) OR ("width" BETWEEN 1 AND 8000 AND "height" BETWEEN 1 AND 8000)),
  CONSTRAINT "ClassworkAttachment_hash_check" CHECK (length("sha256") = 64),
  CONSTRAINT "ClassworkAttachment_recovery_check" CHECK ("recoveryStatus" IN ('PENDING','VERIFIED'))
);
CREATE UNIQUE INDEX "ClassworkAttachment_publicKey_key" ON "ClassworkAttachment"("publicKey");
CREATE UNIQUE INDEX "ClassworkAttachment_storageKey_key" ON "ClassworkAttachment"("storageKey");
CREATE INDEX "ClassworkAttachment_itemVersionId_createdAt_idx" ON "ClassworkAttachment"("itemVersionId","createdAt");
CREATE INDEX "ClassworkAttachment_submissionVersionId_createdAt_idx" ON "ClassworkAttachment"("submissionVersionId","createdAt");
CREATE INDEX "ClassworkAttachment_recoveryStatus_createdAt_idx" ON "ClassworkAttachment"("recoveryStatus","createdAt");
CREATE INDEX "ClassworkAttachment_sha256_idx" ON "ClassworkAttachment"("sha256");

CREATE TABLE "ClassworkFeedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "submissionVersionId" TEXT,
  "sequenceNumber" INTEGER NOT NULL,
  "feedbackType" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByRole" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassworkFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ClassworkSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkFeedback_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "ClassworkSubmissionVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkFeedback_type_check" CHECK ("feedbackType" IN ('COMMENT','RETURN_REASON','REVIEW')),
  CONSTRAINT "ClassworkFeedback_sequence_check" CHECK ("sequenceNumber" >= 1)
);
CREATE UNIQUE INDEX "ClassworkFeedback_publicKey_key" ON "ClassworkFeedback"("publicKey");
CREATE UNIQUE INDEX "ClassworkFeedback_submissionId_sequenceNumber_key" ON "ClassworkFeedback"("submissionId","sequenceNumber");
CREATE INDEX "ClassworkFeedback_submissionId_createdAt_idx" ON "ClassworkFeedback"("submissionId","createdAt");
CREATE INDEX "ClassworkFeedback_submissionVersionId_idx" ON "ClassworkFeedback"("submissionVersionId");

CREATE TABLE "ClassworkAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT,
  "submissionId" TEXT,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassworkAuditEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClassworkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkAuditEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ClassworkSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassworkAuditEvent_owner_check" CHECK ("itemId" IS NOT NULL OR "submissionId" IS NOT NULL)
);
CREATE INDEX "ClassworkAuditEvent_itemId_occurredAt_idx" ON "ClassworkAuditEvent"("itemId","occurredAt");
CREATE INDEX "ClassworkAuditEvent_submissionId_occurredAt_idx" ON "ClassworkAuditEvent"("submissionId","occurredAt");
CREATE INDEX "ClassworkAuditEvent_eventType_occurredAt_idx" ON "ClassworkAuditEvent"("eventType","occurredAt");
CREATE INDEX "ClassworkAuditEvent_actorUserId_occurredAt_idx" ON "ClassworkAuditEvent"("actorUserId","occurredAt");

CREATE TRIGGER "ClassworkItem_no_delete" BEFORE DELETE ON "ClassworkItem" BEGIN SELECT RAISE(ABORT, 'Classwork history cannot be deleted'); END;
CREATE TRIGGER "ClassworkItemVersion_no_delete" BEFORE DELETE ON "ClassworkItemVersion" BEGIN SELECT RAISE(ABORT, 'Published instruction history cannot be deleted'); END;
CREATE TRIGGER "ClassworkSubmission_no_delete" BEFORE DELETE ON "ClassworkSubmission" BEGIN SELECT RAISE(ABORT, 'Submission history cannot be deleted'); END;
CREATE TRIGGER "ClassworkSubmissionVersion_no_delete" BEFORE DELETE ON "ClassworkSubmissionVersion" BEGIN SELECT RAISE(ABORT, 'Submission versions cannot be deleted'); END;
CREATE TRIGGER "ClassworkAttachment_no_delete" BEFORE DELETE ON "ClassworkAttachment" BEGIN SELECT RAISE(ABORT, 'Attachment evidence cannot be deleted'); END;
CREATE TRIGGER "ClassworkFeedback_no_update" BEFORE UPDATE ON "ClassworkFeedback" BEGIN SELECT RAISE(ABORT, 'Feedback is append-only'); END;
CREATE TRIGGER "ClassworkFeedback_no_delete" BEFORE DELETE ON "ClassworkFeedback" BEGIN SELECT RAISE(ABORT, 'Feedback is append-only'); END;
CREATE TRIGGER "ClassworkAuditEvent_no_update" BEFORE UPDATE ON "ClassworkAuditEvent" BEGIN SELECT RAISE(ABORT, 'Classwork audit is append-only'); END;
CREATE TRIGGER "ClassworkAuditEvent_no_delete" BEFORE DELETE ON "ClassworkAuditEvent" BEGIN SELECT RAISE(ABORT, 'Classwork audit is append-only'); END;

CREATE TRIGGER "ClassworkItemVersion_published_content_immutable"
BEFORE UPDATE OF "title","instructions","dueAt","correctionReason","createdByUserId" ON "ClassworkItemVersion"
WHEN OLD."versionStatus" IN ('PUBLISHED','REPLACED')
BEGIN SELECT RAISE(ABORT, 'Published instructions are immutable'); END;

CREATE TRIGGER "ClassworkItemVersion_lifecycle_guard"
BEFORE UPDATE OF "versionStatus" ON "ClassworkItemVersion"
WHEN NOT ((OLD."versionStatus" = 'DRAFT' AND NEW."versionStatus" = 'PUBLISHED') OR (OLD."versionStatus" = 'PUBLISHED' AND NEW."versionStatus" = 'REPLACED') OR OLD."versionStatus" = NEW."versionStatus")
BEGIN SELECT RAISE(ABORT, 'Invalid classwork version transition'); END;

CREATE TRIGGER "ClassworkSubmissionVersion_locked_immutable"
BEFORE UPDATE OF "textBody","itemVersionId","createdByUserId","createdByRole","parentGuardianId" ON "ClassworkSubmissionVersion"
WHEN OLD."versionStatus" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Submitted work is immutable'); END;

CREATE TRIGGER "ClassworkSubmissionVersion_lifecycle_guard"
BEFORE UPDATE OF "versionStatus" ON "ClassworkSubmissionVersion"
WHEN NOT (OLD."versionStatus" = 'DRAFT' AND NEW."versionStatus" IN ('SUBMITTED','LATE','RESUBMITTED')) AND OLD."versionStatus" <> NEW."versionStatus"
BEGIN SELECT RAISE(ABORT, 'Invalid submission version transition'); END;

CREATE TRIGGER "ClassworkAttachment_identity_immutable"
BEFORE UPDATE OF "itemVersionId","submissionVersionId","storageKey","safeDisplayName","mediaType","extension","byteSize","sha256","width","height","createdByUserId" ON "ClassworkAttachment"
BEGIN SELECT RAISE(ABORT, 'Attachment identity and bytes are immutable'); END;
