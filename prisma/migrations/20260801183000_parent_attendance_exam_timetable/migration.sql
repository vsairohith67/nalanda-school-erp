-- Prompt 23D: governed cohort-scoped examination timetable publication.
CREATE TABLE "ExaminationTimetableVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentPublicationKey" TEXT,
    "idempotencyKey" TEXT,
    "replacesVersionId" TEXT,
    "parentInstructions" TEXT,
    "publicationReason" TEXT,
    "replacementReason" TEXT,
    "withdrawalReason" TEXT,
    "archiveReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "withdrawnByUserId" TEXT,
    "archivedByUserId" TEXT,
    "publishedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "replacedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExaminationTimetableVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationTimetableVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationTimetableVersion_replacesVersionId_fkey" FOREIGN KEY ("replacesVersionId") REFERENCES "ExaminationTimetableVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ExaminationTimetableRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timetableVersionId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "subjectNameSnapshot" TEXT NOT NULL,
    "paperCodeSnapshot" TEXT NOT NULL,
    "paperNameSnapshot" TEXT NOT NULL,
    "examDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reportingTime" TEXT,
    "venue" TEXT,
    "parentInstructions" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExaminationTimetableRow_timetableVersionId_fkey" FOREIGN KEY ("timetableVersionId") REFERENCES "ExaminationTimetableVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationTimetableRow_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ExaminationTimetableEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timetableVersionId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExaminationTimetableEvent_timetableVersionId_fkey" FOREIGN KEY ("timetableVersionId") REFERENCES "ExaminationTimetableVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExaminationTimetableVersion_publicKey_key" ON "ExaminationTimetableVersion"("publicKey");
CREATE UNIQUE INDEX "ExaminationTimetableVersion_currentPublicationKey_key" ON "ExaminationTimetableVersion"("currentPublicationKey");
CREATE UNIQUE INDEX "ExaminationTimetableVersion_idempotencyKey_key" ON "ExaminationTimetableVersion"("idempotencyKey");
CREATE INDEX "ExaminationTimetableVersion_academicYear_className_section_status_idx" ON "ExaminationTimetableVersion"("academicYear", "className", "section", "status");
CREATE INDEX "ExaminationTimetableVersion_examinationId_classScopeId_status_idx" ON "ExaminationTimetableVersion"("examinationId", "classScopeId", "status");
CREATE INDEX "ExaminationTimetableVersion_replacesVersionId_idx" ON "ExaminationTimetableVersion"("replacesVersionId");
CREATE UNIQUE INDEX "ExaminationTimetableVersion_examinationId_classScopeId_versionNumber_key" ON "ExaminationTimetableVersion"("examinationId", "classScopeId", "versionNumber");
CREATE INDEX "ExaminationTimetableRow_examDate_startTime_endTime_idx" ON "ExaminationTimetableRow"("examDate", "startTime", "endTime");
CREATE INDEX "ExaminationTimetableRow_subjectPaperId_idx" ON "ExaminationTimetableRow"("subjectPaperId");
CREATE UNIQUE INDEX "ExaminationTimetableRow_timetableVersionId_subjectPaperId_key" ON "ExaminationTimetableRow"("timetableVersionId", "subjectPaperId");
CREATE UNIQUE INDEX "ExaminationTimetableRow_timetableVersionId_displayOrder_key" ON "ExaminationTimetableRow"("timetableVersionId", "displayOrder");
CREATE INDEX "ExaminationTimetableEvent_timetableVersionId_eventDate_idx" ON "ExaminationTimetableEvent"("timetableVersionId", "eventDate");
CREATE INDEX "ExaminationTimetableEvent_examinationId_classScopeId_eventDate_idx" ON "ExaminationTimetableEvent"("examinationId", "classScopeId", "eventDate");
CREATE INDEX "ExaminationTimetableEvent_eventType_idx" ON "ExaminationTimetableEvent"("eventType");

-- Once a version has left DRAFT, its Parent-facing cohort and content are immutable.
CREATE TRIGGER "exam_timetable_version_content_immutable"
BEFORE UPDATE ON "ExaminationTimetableVersion"
WHEN OLD."status" <> 'DRAFT' AND (
  NEW."examinationId" IS NOT OLD."examinationId" OR
  NEW."classScopeId" IS NOT OLD."classScopeId" OR
  NEW."academicYear" IS NOT OLD."academicYear" OR
  NEW."className" IS NOT OLD."className" OR
  NEW."section" IS NOT OLD."section" OR
  NEW."versionNumber" IS NOT OLD."versionNumber" OR
  NEW."replacesVersionId" IS NOT OLD."replacesVersionId" OR
  NEW."parentInstructions" IS NOT OLD."parentInstructions" OR
  NEW."createdByUserId" IS NOT OLD."createdByUserId" OR
  NEW."idempotencyKey" IS NOT OLD."idempotencyKey"
)
BEGIN
  SELECT RAISE(ABORT, 'Examination timetable content is immutable after readiness');
END;

CREATE TRIGGER "exam_timetable_publication_evidence_immutable"
BEFORE UPDATE ON "ExaminationTimetableVersion"
WHEN OLD."status" IN ('PUBLISHED', 'WITHDRAWN', 'REPLACED', 'ARCHIVED') AND (
  NEW."publicationReason" IS NOT OLD."publicationReason" OR
  NEW."publishedByUserId" IS NOT OLD."publishedByUserId" OR
  NEW."publishedAt" IS NOT OLD."publishedAt"
)
BEGIN
  SELECT RAISE(ABORT, 'Examination timetable publication evidence is immutable');
END;

CREATE TRIGGER "exam_timetable_published_history_no_delete"
BEFORE DELETE ON "ExaminationTimetableVersion"
WHEN OLD."status" <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'Published examination timetable history cannot be deleted');
END;

CREATE TRIGGER "exam_timetable_row_insert_draft_only"
BEFORE INSERT ON "ExaminationTimetableRow"
WHEN COALESCE((SELECT "status" FROM "ExaminationTimetableVersion" WHERE "id" = NEW."timetableVersionId"), '') <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'Examination timetable rows can be added only to a draft');
END;

CREATE TRIGGER "exam_timetable_row_update_draft_only"
BEFORE UPDATE ON "ExaminationTimetableRow"
WHEN COALESCE((SELECT "status" FROM "ExaminationTimetableVersion" WHERE "id" = OLD."timetableVersionId"), '') <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'Examination timetable rows are immutable outside a draft');
END;

CREATE TRIGGER "exam_timetable_row_delete_draft_only"
BEFORE DELETE ON "ExaminationTimetableRow"
WHEN COALESCE((SELECT "status" FROM "ExaminationTimetableVersion" WHERE "id" = OLD."timetableVersionId"), '') <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'Examination timetable rows are immutable outside a draft');
END;

CREATE TRIGGER "exam_timetable_event_append_only_update"
BEFORE UPDATE ON "ExaminationTimetableEvent"
BEGIN
  SELECT RAISE(ABORT, 'Examination timetable events are append-only');
END;

CREATE TRIGGER "exam_timetable_event_append_only_delete"
BEFORE DELETE ON "ExaminationTimetableEvent"
BEGIN
  SELECT RAISE(ABORT, 'Examination timetable events are append-only');
END;
