CREATE TABLE "AcademicReportDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "definitionCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "parameterSchemaJson" TEXT NOT NULL,
  "minimumGroupSize" INTEGER NOT NULL DEFAULT 5,
  "definitionHash" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicReportDefinition_family_check" CHECK ("family" IN ('STUDENT_LONGITUDINAL','CLASS_SECTION_SUMMARY','SUBJECT_PAPER_DISTRIBUTION','SUBJECT_GROUP_SUMMARY','OUTCOME_DISTRIBUTION','COMPARATIVE_DELTA','COMPLETION_MISSING_SOURCE','CLASS_AVERAGE_HIGHEST','BOARD_CLASS_COMPARATIVE','LEADERSHIP_SUMMARY')),
  CONSTRAINT "AcademicReportDefinition_status_check" CHECK ("status" IN ('ACTIVE','ARCHIVED')),
  CONSTRAINT "AcademicReportDefinition_minimum_group_check" CHECK ("minimumGroupSize" BETWEEN 3 AND 50)
);

CREATE TABLE "AcademicReportRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "parameterJson" TEXT NOT NULL,
  "accessScopeJson" TEXT NOT NULL,
  "normalizationRule" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "immutableSummaryJson" TEXT NOT NULL,
  "summaryHash" TEXT NOT NULL,
  "supersedesRunId" TEXT,
  "generatedAt" DATETIME NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByRole" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicReportRun_definition_fkey" FOREIGN KEY ("definitionId") REFERENCES "AcademicReportDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AcademicReportRun_supersedes_fkey" FOREIGN KEY ("supersedesRunId") REFERENCES "AcademicReportRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AcademicReportRun_status_check" CHECK ("status" = 'COMPLETED'),
  CONSTRAINT "AcademicReportRun_normalization_check" CHECK ("normalizationRule" IN ('STRICT_MATCH','PERCENTAGE_NORMALIZED','NONE'))
);

CREATE TABLE "AcademicReportSourceReference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reportRunId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL,
  "publicReference" TEXT NOT NULL,
  "resultSnapshotId" TEXT,
  "reportCardVersionId" TEXT,
  "formulaVersion" TEXT NOT NULL,
  "roundingPolicyVersion" TEXT NOT NULL,
  "schemeVersionRefsJson" TEXT NOT NULL,
  "attendanceBasisKey" TEXT,
  "sourceLockedAt" DATETIME NOT NULL,
  "publishedAt" DATETIME NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicReportSource_run_fkey" FOREIGN KEY ("reportRunId") REFERENCES "AcademicReportRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AcademicReportSource_snapshot_fkey" FOREIGN KEY ("resultSnapshotId") REFERENCES "StudentResultSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AcademicReportSource_report_version_fkey" FOREIGN KEY ("reportCardVersionId") REFERENCES "StudentReportCardVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AcademicReportSource_kind_check" CHECK ("sourceKind" = 'LOCKED_RESULT_AND_ISSUED_REPORT'),
  CONSTRAINT "AcademicReportSource_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 10000),
  CONSTRAINT "AcademicReportSource_version_check" CHECK ("sourceVersion" >= 1),
  CONSTRAINT "AcademicReportSource_exact_links_check" CHECK ("resultSnapshotId" IS NOT NULL AND "reportCardVersionId" IS NOT NULL)
);

CREATE TABLE "AcademicReportAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventKey" TEXT NOT NULL,
  "reportRunId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "safeDetailsJson" TEXT NOT NULL,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicReportAudit_run_fkey" FOREIGN KEY ("reportRunId") REFERENCES "AcademicReportRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AcademicReportAudit_event_check" CHECK ("eventType" IN ('RUN_GENERATED','RUN_SUPERSEDES','EXPORT_AUTHORIZED'))
);

CREATE UNIQUE INDEX "AcademicReportDefinition_publicKey_key" ON "AcademicReportDefinition"("publicKey");
CREATE UNIQUE INDEX "AcademicReportDefinition_definitionCode_key" ON "AcademicReportDefinition"("definitionCode");
CREATE INDEX "AcademicReportDefinition_family_status_idx" ON "AcademicReportDefinition"("family", "status");
CREATE UNIQUE INDEX "AcademicReportRun_publicKey_key" ON "AcademicReportRun"("publicKey");
CREATE UNIQUE INDEX "AcademicReportRun_requestFingerprint_key" ON "AcademicReportRun"("requestFingerprint");
CREATE INDEX "AcademicReportRun_definitionId_generatedAt_idx" ON "AcademicReportRun"("definitionId", "generatedAt");
CREATE INDEX "AcademicReportRun_supersedesRunId_idx" ON "AcademicReportRun"("supersedesRunId");
CREATE INDEX "AcademicReportRun_createdByUserId_generatedAt_idx" ON "AcademicReportRun"("createdByUserId", "generatedAt");
CREATE UNIQUE INDEX "AcademicReportSourceReference_reportRunId_ordinal_key" ON "AcademicReportSourceReference"("reportRunId", "ordinal");
CREATE UNIQUE INDEX "AcademicReportSourceReference_reportRunId_sourceKind_sourceRecordId_sourceVersion_key" ON "AcademicReportSourceReference"("reportRunId", "sourceKind", "sourceRecordId", "sourceVersion");
CREATE INDEX "AcademicReportSourceReference_resultSnapshotId_idx" ON "AcademicReportSourceReference"("resultSnapshotId");
CREATE INDEX "AcademicReportSourceReference_reportCardVersionId_idx" ON "AcademicReportSourceReference"("reportCardVersionId");
CREATE INDEX "AcademicReportSourceReference_publicReference_idx" ON "AcademicReportSourceReference"("publicReference");
CREATE UNIQUE INDEX "AcademicReportAuditEvent_eventKey_key" ON "AcademicReportAuditEvent"("eventKey");
CREATE INDEX "AcademicReportAuditEvent_reportRunId_occurredAt_idx" ON "AcademicReportAuditEvent"("reportRunId", "occurredAt");
CREATE INDEX "AcademicReportAuditEvent_eventType_occurredAt_idx" ON "AcademicReportAuditEvent"("eventType", "occurredAt");
CREATE INDEX "AcademicReportAuditEvent_actorUserId_occurredAt_idx" ON "AcademicReportAuditEvent"("actorUserId", "occurredAt");

-- Report runs and their evidence are append-only. A correction is represented by
-- a new run whose supersedesRunId points to the preserved former run.
CREATE TRIGGER "AcademicReportRun_no_update"
BEFORE UPDATE ON "AcademicReportRun" BEGIN SELECT RAISE(ABORT, 'ACADEMIC_REPORT_RUN_IMMUTABLE'); END;
CREATE TRIGGER "AcademicReportRun_no_delete"
BEFORE DELETE ON "AcademicReportRun" BEGIN SELECT RAISE(ABORT, 'ACADEMIC_REPORT_RUN_IMMUTABLE'); END;
CREATE TRIGGER "AcademicReportSource_no_update"
BEFORE UPDATE ON "AcademicReportSourceReference" BEGIN SELECT RAISE(ABORT, 'ACADEMIC_REPORT_SOURCE_IMMUTABLE'); END;
CREATE TRIGGER "AcademicReportSource_no_delete"
BEFORE DELETE ON "AcademicReportSourceReference" BEGIN SELECT RAISE(ABORT, 'ACADEMIC_REPORT_SOURCE_IMMUTABLE'); END;
CREATE TRIGGER "AcademicReportAudit_no_update"
BEFORE UPDATE ON "AcademicReportAuditEvent" BEGIN SELECT RAISE(ABORT, 'ACADEMIC_REPORT_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER "AcademicReportAudit_no_delete"
BEFORE DELETE ON "AcademicReportAuditEvent" BEGIN SELECT RAISE(ABORT, 'ACADEMIC_REPORT_AUDIT_IMMUTABLE'); END;
