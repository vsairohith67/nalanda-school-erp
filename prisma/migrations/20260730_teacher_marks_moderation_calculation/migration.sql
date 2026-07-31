-- EXAM-RC-IMPL-2: governed marks, moderation and calculation snapshots.
-- Additive only. Historical migrations and legacy marks/report-card tables remain unchanged.

ALTER TABLE "ExaminationSchemeAudit" ADD COLUMN "eventKey" TEXT;

ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "markDecimalPlaces" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "absentTreatment" TEXT NOT NULL DEFAULT 'ZERO';
ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "exemptTreatment" TEXT NOT NULL DEFAULT 'EXCLUDE';
ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "notApplicableTreatment" TEXT NOT NULL DEFAULT 'EXCLUDE';
ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "passFailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "passThresholdPercentage" DECIMAL;
ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "rankEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExaminationSchemeVersion" ADD COLUMN "rankTiePolicy" TEXT NOT NULL DEFAULT 'COMPETITION_SHARED_STABLE_ADMISSION';

CREATE TABLE "ExamMarkSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "logicalSheetKey" TEXT NOT NULL,
    "currentKey" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "supersedesSheetId" TEXT,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "primaryAssignmentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "optimisticVersion" INTEGER NOT NULL DEFAULT 1,
    "assignmentSnapshotJson" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "moderatedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "correctionRequestId" TEXT,
    "correctionRequestStatus" TEXT,
    "correctionPriorStatus" TEXT,
    "correctionRequestReason" TEXT,
    "correctionRequestedByUserId" TEXT,
    "correctionRequestedAt" DATETIME,
    "correctionReviewedByUserId" TEXT,
    "correctionReviewReason" TEXT,
    "correctionReviewedAt" DATETIME,
    "submittedAt" DATETIME,
    "moderatedAt" DATETIME,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamMarkSheet_supersedesSheetId_fkey" FOREIGN KEY ("supersedesSheetId") REFERENCES "ExamMarkSheet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamMarkSheet_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamMarkSheet_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamMarkSheet_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamMarkSheet_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ExaminationComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamMarkSheet_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamMarkSheet_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "TeacherExamAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ExamMarkEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "entryState" TEXT NOT NULL DEFAULT 'NOT_ENTERED',
    "marksObtained" DECIMAL,
    "remarks" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "enteredByUserId" TEXT,
    "enteredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamMarkEntry_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ExamMarkSheet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamMarkEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StudentResultSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calculationRunId" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "runStatus" TEXT NOT NULL DEFAULT 'PREVIEW',
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "snapshotVersion" INTEGER NOT NULL,
    "totalObtained" DECIMAL NOT NULL,
    "totalMaximum" DECIMAL NOT NULL,
    "percentage" DECIMAL NOT NULL,
    "gradeCode" TEXT,
    "gradePoint" DECIMAL,
    "passResult" TEXT,
    "rankValue" INTEGER,
    "formulaVersion" TEXT NOT NULL,
    "roundingPolicyVersion" TEXT NOT NULL,
    "warningsJson" TEXT NOT NULL,
    "sourceSheetVersionsJson" TEXT NOT NULL,
    "sourceSchemeVersionsJson" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "calculatedByUserId" TEXT NOT NULL,
    "calculatedAt" DATETIME NOT NULL,
    "lockedByUserId" TEXT,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentResultSnapshot_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentResultSnapshot_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentResultSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentResultSnapshot_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExamMarkSheet_currentKey_key" ON "ExamMarkSheet"("currentKey");
CREATE UNIQUE INDEX "ExamMarkSheet_supersedesSheetId_key" ON "ExamMarkSheet"("supersedesSheetId");
CREATE UNIQUE INDEX "ExamMarkSheet_correctionRequestId_key" ON "ExamMarkSheet"("correctionRequestId");
CREATE INDEX "ExamMarkSheet_examinationId_classScopeId_subjectPaperId_componentId_currentKey_idx" ON "ExamMarkSheet"("examinationId", "classScopeId", "subjectPaperId", "componentId", "currentKey");
CREATE INDEX "ExamMarkSheet_academicYear_className_section_status_idx" ON "ExamMarkSheet"("academicYear", "className", "section", "status");
CREATE INDEX "ExamMarkSheet_primaryAssignmentId_status_idx" ON "ExamMarkSheet"("primaryAssignmentId", "status");
CREATE INDEX "ExamMarkSheet_schemeVersionId_idx" ON "ExamMarkSheet"("schemeVersionId");
CREATE INDEX "ExamMarkSheet_supersedesSheetId_idx" ON "ExamMarkSheet"("supersedesSheetId");
CREATE UNIQUE INDEX "ExamMarkSheet_logicalSheetKey_versionNumber_key" ON "ExamMarkSheet"("logicalSheetKey", "versionNumber");

CREATE INDEX "ExamMarkEntry_studentId_idx" ON "ExamMarkEntry"("studentId");
CREATE INDEX "ExamMarkEntry_entryState_idx" ON "ExamMarkEntry"("entryState");
CREATE UNIQUE INDEX "ExamMarkEntry_sheetId_studentId_key" ON "ExamMarkEntry"("sheetId", "studentId");

CREATE INDEX "StudentResultSnapshot_inputFingerprint_idx" ON "StudentResultSnapshot"("inputFingerprint");
CREATE INDEX "StudentResultSnapshot_calculationRunId_idx" ON "StudentResultSnapshot"("calculationRunId");
CREATE INDEX "StudentResultSnapshot_studentId_calculatedAt_idx" ON "StudentResultSnapshot"("studentId", "calculatedAt");
CREATE INDEX "StudentResultSnapshot_examinationId_classScopeId_idx" ON "StudentResultSnapshot"("examinationId", "classScopeId");
CREATE UNIQUE INDEX "StudentResultSnapshot_calculationRunId_studentId_key" ON "StudentResultSnapshot"("calculationRunId", "studentId");
CREATE UNIQUE INDEX "StudentResultSnapshot_examinationId_classScopeId_studentId_snapshotVersion_key" ON "StudentResultSnapshot"("examinationId", "classScopeId", "studentId", "snapshotVersion");

CREATE UNIQUE INDEX "ExaminationSchemeAudit_eventKey_key" ON "ExaminationSchemeAudit"("eventKey");
