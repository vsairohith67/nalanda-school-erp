CREATE TABLE "GradingScheme" (
  "id" TEXT NOT NULL PRIMARY KEY, "schemeCode" TEXT NOT NULL, "name" TEXT NOT NULL,
  "academicYear" TEXT, "reportType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT, "createdByUserId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "GradingScheme_schemeCode_key" ON "GradingScheme"("schemeCode");
CREATE INDEX "GradingScheme_academicYear_reportType_status_idx" ON "GradingScheme"("academicYear", "reportType", "status");

CREATE TABLE "GradeBand" (
  "id" TEXT NOT NULL PRIMARY KEY, "gradingSchemeId" TEXT NOT NULL, "gradeCode" TEXT NOT NULL,
  "label" TEXT NOT NULL, "minimumPercentage" DECIMAL NOT NULL, "maximumPercentage" DECIMAL,
  "displayOrder" INTEGER NOT NULL, "remarks" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GradeBand_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "GradingScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_gradeCode_key" ON "GradeBand"("gradingSchemeId", "gradeCode");
CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_displayOrder_key" ON "GradeBand"("gradingSchemeId", "displayOrder");
CREATE INDEX "GradeBand_gradingSchemeId_minimumPercentage_idx" ON "GradeBand"("gradingSchemeId", "minimumPercentage");

CREATE TABLE "ReportCardTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY, "templateCode" TEXT NOT NULL, "name" TEXT NOT NULL,
  "reportType" TEXT NOT NULL, "academicYear" TEXT, "className" TEXT, "gradingSchemeId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "templateDefinitionJson" TEXT NOT NULL,
  "printSettingsJson" TEXT, "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT, "activatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReportCardTemplate_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "GradingScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportCardTemplate_templateCode_key" ON "ReportCardTemplate"("templateCode");
CREATE INDEX "ReportCardTemplate_reportType_status_idx" ON "ReportCardTemplate"("reportType", "status");
CREATE INDEX "ReportCardTemplate_academicYear_className_idx" ON "ReportCardTemplate"("academicYear", "className");
CREATE INDEX "ReportCardTemplate_gradingSchemeId_idx" ON "ReportCardTemplate"("gradingSchemeId");

CREATE TABLE "ReportCardBatch" (
  "id" TEXT NOT NULL PRIMARY KEY, "batchNumber" TEXT NOT NULL, "academicYear" TEXT NOT NULL,
  "reportType" TEXT NOT NULL, "templateId" TEXT NOT NULL, "className" TEXT NOT NULL, "section" TEXT,
  "title" TEXT NOT NULL, "reportingPeriod" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "templateSnapshotJson" TEXT NOT NULL, "cancellationReason" TEXT,
  "createdByUserId" TEXT, "openedByUserId" TEXT, "submittedByUserId" TEXT, "approvedByUserId" TEXT,
  "issuedByUserId" TEXT, "archivedByUserId" TEXT, "cancelledByUserId" TEXT,
  "openedAt" DATETIME, "submittedAt" DATETIME, "approvedAt" DATETIME, "issuedAt" DATETIME,
  "archivedAt" DATETIME, "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReportCardBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportCardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportCardBatch_batchNumber_key" ON "ReportCardBatch"("batchNumber");
CREATE INDEX "ReportCardBatch_academicYear_className_section_idx" ON "ReportCardBatch"("academicYear", "className", "section");
CREATE INDEX "ReportCardBatch_reportType_status_idx" ON "ReportCardBatch"("reportType", "status");
CREATE INDEX "ReportCardBatch_templateId_idx" ON "ReportCardBatch"("templateId");

CREATE TABLE "ReportCardBatchExamSource" (
  "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "examCycleId" TEXT NOT NULL,
  "weightagePercent" DECIMAL, "displayOrder" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportCardBatchExamSource_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReportCardBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReportCardBatchExamSource_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportCardBatchExamSource_batchId_examCycleId_key" ON "ReportCardBatchExamSource"("batchId", "examCycleId");
CREATE UNIQUE INDEX "ReportCardBatchExamSource_batchId_displayOrder_key" ON "ReportCardBatchExamSource"("batchId", "displayOrder");
CREATE INDEX "ReportCardBatchExamSource_examCycleId_idx" ON "ReportCardBatchExamSource"("examCycleId");

CREATE TABLE "StudentReportCard" (
  "id" TEXT NOT NULL PRIMARY KEY, "reportCardNumber" TEXT NOT NULL, "batchId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL, "academicYear" TEXT NOT NULL, "className" TEXT NOT NULL, "section" TEXT,
  "reportType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
  "draftDataJson" TEXT NOT NULL, "teacherOverallComment" TEXT, "principalComment" TEXT, "directorComment" TEXT,
  "finalGrade" TEXT, "progressionDecisionId" TEXT, "promotionDisplayText" TEXT, "cancellationReason" TEXT,
  "createdByUserId" TEXT, "submittedByUserId" TEXT, "approvedByUserId" TEXT, "issuedByUserId" TEXT, "cancelledByUserId" TEXT,
  "submittedAt" DATETIME, "approvedAt" DATETIME, "issuedAt" DATETIME, "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StudentReportCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReportCardBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentReportCard_reportCardNumber_key" ON "StudentReportCard"("reportCardNumber");
CREATE UNIQUE INDEX "StudentReportCard_batchId_studentId_key" ON "StudentReportCard"("batchId", "studentId");
CREATE INDEX "StudentReportCard_studentId_academicYear_idx" ON "StudentReportCard"("studentId", "academicYear");
CREATE INDEX "StudentReportCard_batchId_status_idx" ON "StudentReportCard"("batchId", "status");
CREATE INDEX "StudentReportCard_progressionDecisionId_idx" ON "StudentReportCard"("progressionDecisionId");

CREATE TABLE "StudentReportCardVersion" (
  "id" TEXT NOT NULL PRIMARY KEY, "reportCardId" TEXT NOT NULL, "versionNumber" INTEGER NOT NULL,
  "versionType" TEXT NOT NULL, "snapshotJson" TEXT NOT NULL, "correctionReason" TEXT,
  "issuedAt" DATETIME NOT NULL, "issuedByUserId" TEXT, "supersedesVersionId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentReportCardVersion_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "StudentReportCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentReportCardVersion_reportCardId_versionNumber_key" ON "StudentReportCardVersion"("reportCardId", "versionNumber");
CREATE INDEX "StudentReportCardVersion_reportCardId_issuedAt_idx" ON "StudentReportCardVersion"("reportCardId", "issuedAt");
CREATE INDEX "StudentReportCardVersion_supersedesVersionId_idx" ON "StudentReportCardVersion"("supersedesVersionId");

CREATE TABLE "StudentReportCardEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "reportCardId" TEXT NOT NULL, "versionId" TEXT,
  "eventType" TEXT NOT NULL, "eventDate" DATETIME NOT NULL, "previousStatus" TEXT, "newStatus" TEXT,
  "reason" TEXT, "notes" TEXT, "recordedByUserId" TEXT, "actorLabel" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentReportCardEvent_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "StudentReportCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StudentReportCardEvent_reportCardId_eventDate_idx" ON "StudentReportCardEvent"("reportCardId", "eventDate");
CREATE INDEX "StudentReportCardEvent_versionId_idx" ON "StudentReportCardEvent"("versionId");
CREATE INDEX "StudentReportCardEvent_eventType_idx" ON "StudentReportCardEvent"("eventType");
