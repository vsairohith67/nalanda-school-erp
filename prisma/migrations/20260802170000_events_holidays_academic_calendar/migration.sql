-- Prompt 23E: governed operational academic days and informational events.
-- PublicWebsiteEvent remains a separate public-content audit concept.

ALTER TABLE "StudentAttendanceSession" ADD COLUMN "operationalCalendarVersionKey" TEXT;
ALTER TABLE "StudentAttendanceSession" ADD COLUMN "operationalCalendarDayKey" TEXT;
ALTER TABLE "StudentAttendanceSession" ADD COLUMN "calendarBasisSnapshotJson" TEXT;
CREATE INDEX "StudentAttendanceSession_operationalCalendarVersionKey_idx"
ON "StudentAttendanceSession"("operationalCalendarVersionKey");

ALTER TABLE "StudentReportCardVersion" ADD COLUMN "calendarBasisVersionKey" TEXT;
ALTER TABLE "StudentReportCardVersion" ADD COLUMN "calendarBasisSnapshotJson" TEXT;

CREATE TABLE "AcademicCalendarVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveScope" TEXT NOT NULL DEFAULT 'SCHOOL_WIDE',
    "className" TEXT,
    "section" TEXT,
    "scopeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentPublicationKey" TEXT,
    "idempotencyKey" TEXT,
    "replacesVersionId" TEXT,
    "publicationReason" TEXT,
    "replacementReason" TEXT,
    "withdrawalReason" TEXT,
    "archiveReason" TEXT,
    "attendanceReconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    "replacedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademicCalendarVersion_replacesVersionId_fkey"
      FOREIGN KEY ("replacesVersionId") REFERENCES "AcademicCalendarVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AcademicCalendarVersion_status_check"
      CHECK ("status" IN ('DRAFT','READY_FOR_REVIEW','PUBLISHED','REPLACED','WITHDRAWN','ARCHIVED')),
    CONSTRAINT "AcademicCalendarVersion_scope_check"
      CHECK ("effectiveScope" IN ('SCHOOL_WIDE','CLASS','CLASS_SECTION'))
);

CREATE UNIQUE INDEX "AcademicCalendarVersion_publicKey_key" ON "AcademicCalendarVersion"("publicKey");
CREATE UNIQUE INDEX "AcademicCalendarVersion_currentPublicationKey_key" ON "AcademicCalendarVersion"("currentPublicationKey");
CREATE UNIQUE INDEX "AcademicCalendarVersion_idempotencyKey_key" ON "AcademicCalendarVersion"("idempotencyKey");
CREATE UNIQUE INDEX "AcademicCalendarVersion_academicYear_scopeKey_versionNumber_key"
ON "AcademicCalendarVersion"("academicYear","scopeKey","versionNumber");
CREATE INDEX "AcademicCalendarVersion_academicYear_status_idx" ON "AcademicCalendarVersion"("academicYear","status");
CREATE INDEX "AcademicCalendarVersion_academicYear_scopeKey_status_idx" ON "AcademicCalendarVersion"("academicYear","scopeKey","status");
CREATE INDEX "AcademicCalendarVersion_replacesVersionId_idx" ON "AcademicCalendarVersion"("replacesVersionId");

CREATE TABLE "OperationalCalendarDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "calendarVersionId" TEXT NOT NULL,
    "dayDate" DATETIME NOT NULL,
    "dayType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "scopeType" TEXT NOT NULL DEFAULT 'SCHOOL_WIDE',
    "className" TEXT,
    "section" TEXT,
    "scopeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "halfDaySession" TEXT,
    "publicInstructions" TEXT,
    "reason" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OperationalCalendarDay_calendarVersionId_fkey"
      FOREIGN KEY ("calendarVersionId") REFERENCES "AcademicCalendarVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperationalCalendarDay_type_check"
      CHECK ("dayType" IN ('WORKING_DAY','NON_WORKING_DAY','HALF_DAY','VACATION_DAY','SPECIAL_WORKING_DAY','EMERGENCY_CLOSURE')),
    CONSTRAINT "OperationalCalendarDay_source_check"
      CHECK ("sourceType" IN ('MANUAL','HOLIDAY','VACATION','SPECIAL_WORKING','HALF_DAY','EMERGENCY_CLOSURE')),
    CONSTRAINT "OperationalCalendarDay_scope_check"
      CHECK ("scopeType" IN ('SCHOOL_WIDE','CLASS','CLASS_SECTION'))
);

CREATE UNIQUE INDEX "OperationalCalendarDay_publicKey_key" ON "OperationalCalendarDay"("publicKey");
CREATE UNIQUE INDEX "OperationalCalendarDay_calendarVersionId_dayDate_scopeKey_key"
ON "OperationalCalendarDay"("calendarVersionId","dayDate","scopeKey");
CREATE INDEX "OperationalCalendarDay_dayDate_dayType_idx" ON "OperationalCalendarDay"("dayDate","dayType");
CREATE INDEX "OperationalCalendarDay_calendarVersionId_dayType_idx" ON "OperationalCalendarDay"("calendarVersionId","dayType");
CREATE INDEX "OperationalCalendarDay_scopeType_className_section_dayDate_idx"
ON "OperationalCalendarDay"("scopeType","className","section","dayDate");

CREATE TABLE "SchoolCalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "eventNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "currentPublishedVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolCalendarEvent_currentPublishedVersionId_fkey"
      FOREIGN KEY ("currentPublishedVersionId") REFERENCES "SchoolCalendarEventVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SchoolCalendarEvent_status_check"
      CHECK ("status" IN ('DRAFT','READY_FOR_REVIEW','PUBLISHED','REPLACED','WITHDRAWN','ARCHIVED'))
);

CREATE UNIQUE INDEX "SchoolCalendarEvent_publicKey_key" ON "SchoolCalendarEvent"("publicKey");
CREATE UNIQUE INDEX "SchoolCalendarEvent_eventNumber_key" ON "SchoolCalendarEvent"("eventNumber");
CREATE UNIQUE INDEX "SchoolCalendarEvent_currentPublishedVersionId_key" ON "SchoolCalendarEvent"("currentPublishedVersionId");
CREATE INDEX "SchoolCalendarEvent_academicYear_status_idx" ON "SchoolCalendarEvent"("academicYear","status");
CREATE INDEX "SchoolCalendarEvent_createdAt_idx" ON "SchoolCalendarEvent"("createdAt");

CREATE TABLE "SchoolCalendarEventVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "venue" TEXT,
    "parentInstructions" TEXT,
    "internalNotes" TEXT,
    "audienceType" TEXT NOT NULL,
    "roleScope" TEXT,
    "classSectionId" TEXT,
    "className" TEXT,
    "section" TEXT,
    "audienceKey" TEXT NOT NULL,
    "examinationTimetableVersionId" TEXT,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL,
    "currentPublicationKey" TEXT,
    "idempotencyKey" TEXT,
    "replacesVersionId" TEXT,
    "publicationReason" TEXT,
    "replacementReason" TEXT,
    "withdrawalReason" TEXT,
    "archiveReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    "replacedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolCalendarEventVersion_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "SchoolCalendarEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SchoolCalendarEventVersion_examinationTimetableVersionId_fkey"
      FOREIGN KEY ("examinationTimetableVersionId") REFERENCES "ExaminationTimetableVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SchoolCalendarEventVersion_replacesVersionId_fkey"
      FOREIGN KEY ("replacesVersionId") REFERENCES "SchoolCalendarEventVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SchoolCalendarEventVersion_status_check"
      CHECK ("status" IN ('DRAFT','READY_FOR_REVIEW','PUBLISHED','REPLACED','WITHDRAWN','ARCHIVED')),
    CONSTRAINT "SchoolCalendarEventVersion_type_check"
      CHECK ("eventType" IN ('SCHOOL_FUNCTION','PARENT_MEETING','ACTIVITY','COMPETITION','ACADEMIC_DEADLINE','STAFF_MEETING','EXAMINATION_REFERENCE','CLASS_EVENT','OTHER')),
    CONSTRAINT "SchoolCalendarEventVersion_audience_check"
      CHECK ("audienceType" IN ('SCHOOL_WIDE','STAFF_ONLY','PARENTS_ALL','ROLE_SPECIFIC','CLASS','CLASS_SECTION','LINKED_CHILD_COHORT','LEADERSHIP_ONLY'))
);

CREATE UNIQUE INDEX "SchoolCalendarEventVersion_publicKey_key" ON "SchoolCalendarEventVersion"("publicKey");
CREATE UNIQUE INDEX "SchoolCalendarEventVersion_currentPublicationKey_key" ON "SchoolCalendarEventVersion"("currentPublicationKey");
CREATE UNIQUE INDEX "SchoolCalendarEventVersion_idempotencyKey_key" ON "SchoolCalendarEventVersion"("idempotencyKey");
CREATE UNIQUE INDEX "SchoolCalendarEventVersion_eventId_versionNumber_key"
ON "SchoolCalendarEventVersion"("eventId","versionNumber");
CREATE INDEX "SchoolCalendarEventVersion_status_startsAt_endsAt_idx" ON "SchoolCalendarEventVersion"("status","startsAt","endsAt");
CREATE INDEX "SchoolCalendarEventVersion_audienceType_className_section_startsAt_idx"
ON "SchoolCalendarEventVersion"("audienceType","className","section","startsAt");
CREATE INDEX "SchoolCalendarEventVersion_examinationTimetableVersionId_idx" ON "SchoolCalendarEventVersion"("examinationTimetableVersionId");
CREATE INDEX "SchoolCalendarEventVersion_replacesVersionId_idx" ON "SchoolCalendarEventVersion"("replacesVersionId");

CREATE TABLE "AcademicCalendarAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "calendarVersionId" TEXT,
    "schoolEventId" TEXT,
    "eventVersionId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicCalendarAuditEvent_calendarVersionId_fkey"
      FOREIGN KEY ("calendarVersionId") REFERENCES "AcademicCalendarVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AcademicCalendarAuditEvent_schoolEventId_fkey"
      FOREIGN KEY ("schoolEventId") REFERENCES "SchoolCalendarEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AcademicCalendarAuditEvent_eventVersionId_fkey"
      FOREIGN KEY ("eventVersionId") REFERENCES "SchoolCalendarEventVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AcademicCalendarAuditEvent_calendarVersionId_eventDate_idx" ON "AcademicCalendarAuditEvent"("calendarVersionId","eventDate");
CREATE INDEX "AcademicCalendarAuditEvent_schoolEventId_eventDate_idx" ON "AcademicCalendarAuditEvent"("schoolEventId","eventDate");
CREATE INDEX "AcademicCalendarAuditEvent_eventVersionId_eventDate_idx" ON "AcademicCalendarAuditEvent"("eventVersionId","eventDate");
CREATE INDEX "AcademicCalendarAuditEvent_eventType_eventDate_idx" ON "AcademicCalendarAuditEvent"("eventType","eventDate");

-- Operational classifications freeze once submitted. Replacements must be
-- prepared as a new DRAFT version; published history is never hard deleted.
CREATE TRIGGER "academic_calendar_version_content_immutable"
BEFORE UPDATE ON "AcademicCalendarVersion"
WHEN OLD."status" <> 'DRAFT' AND (
  NEW."academicYear" IS NOT OLD."academicYear" OR
  NEW."versionNumber" IS NOT OLD."versionNumber" OR
  NEW."effectiveScope" IS NOT OLD."effectiveScope" OR
  NEW."className" IS NOT OLD."className" OR
  NEW."section" IS NOT OLD."section" OR
  NEW."scopeKey" IS NOT OLD."scopeKey" OR
  NEW."title" IS NOT OLD."title" OR
  NEW."replacesVersionId" IS NOT OLD."replacesVersionId" OR
  NEW."createdByUserId" IS NOT OLD."createdByUserId"
)
BEGIN SELECT RAISE(ABORT, 'Academic calendar content is immutable after review submission'); END;

CREATE TRIGGER "academic_calendar_publication_evidence_immutable"
BEFORE UPDATE ON "AcademicCalendarVersion"
WHEN OLD."status" IN ('PUBLISHED','REPLACED','WITHDRAWN','ARCHIVED') AND (
  NEW."publicationReason" IS NOT OLD."publicationReason" OR
  NEW."publishedAt" IS NOT OLD."publishedAt"
)
BEGIN SELECT RAISE(ABORT, 'Academic calendar publication evidence is immutable'); END;

CREATE TRIGGER "academic_calendar_published_history_no_delete"
BEFORE DELETE ON "AcademicCalendarVersion" WHEN OLD."status" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Published academic calendar history cannot be deleted'); END;

CREATE TRIGGER "operational_calendar_day_insert_draft_only"
BEFORE INSERT ON "OperationalCalendarDay"
WHEN COALESCE((SELECT "status" FROM "AcademicCalendarVersion" WHERE "id"=NEW."calendarVersionId"),'') <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Operational calendar days can be added only to a draft'); END;
CREATE TRIGGER "operational_calendar_day_update_draft_only"
BEFORE UPDATE ON "OperationalCalendarDay"
WHEN COALESCE((SELECT "status" FROM "AcademicCalendarVersion" WHERE "id"=OLD."calendarVersionId"),'') <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Operational calendar days are immutable outside a draft'); END;
CREATE TRIGGER "operational_calendar_day_delete_draft_only"
BEFORE DELETE ON "OperationalCalendarDay"
WHEN COALESCE((SELECT "status" FROM "AcademicCalendarVersion" WHERE "id"=OLD."calendarVersionId"),'') <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Operational calendar days are immutable outside a draft'); END;

CREATE TRIGGER "school_calendar_event_version_content_immutable"
BEFORE UPDATE ON "SchoolCalendarEventVersion"
WHEN OLD."status" <> 'DRAFT' AND (
  NEW."eventType" IS NOT OLD."eventType" OR NEW."title" IS NOT OLD."title" OR
  NEW."description" IS NOT OLD."description" OR NEW."startsAt" IS NOT OLD."startsAt" OR
  NEW."endsAt" IS NOT OLD."endsAt" OR NEW."allDay" IS NOT OLD."allDay" OR
  NEW."venue" IS NOT OLD."venue" OR NEW."parentInstructions" IS NOT OLD."parentInstructions" OR
  NEW."internalNotes" IS NOT OLD."internalNotes" OR NEW."audienceType" IS NOT OLD."audienceType" OR
  NEW."roleScope" IS NOT OLD."roleScope" OR NEW."classSectionId" IS NOT OLD."classSectionId" OR
  NEW."className" IS NOT OLD."className" OR NEW."section" IS NOT OLD."section" OR
  NEW."audienceKey" IS NOT OLD."audienceKey" OR
  NEW."examinationTimetableVersionId" IS NOT OLD."examinationTimetableVersionId" OR
  NEW."replacesVersionId" IS NOT OLD."replacesVersionId" OR NEW."contentHash" IS NOT OLD."contentHash"
)
BEGIN SELECT RAISE(ABORT, 'School calendar event content is immutable after review submission'); END;

CREATE TRIGGER "school_calendar_event_publication_evidence_immutable"
BEFORE UPDATE ON "SchoolCalendarEventVersion"
WHEN OLD."status" IN ('PUBLISHED','REPLACED','WITHDRAWN','ARCHIVED') AND (
  NEW."publicationReason" IS NOT OLD."publicationReason" OR
  NEW."publishedAt" IS NOT OLD."publishedAt"
)
BEGIN SELECT RAISE(ABORT, 'School calendar event publication evidence is immutable'); END;

CREATE TRIGGER "school_calendar_event_published_history_no_delete"
BEFORE DELETE ON "SchoolCalendarEventVersion" WHEN OLD."status" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Published school calendar event history cannot be deleted'); END;

CREATE TRIGGER "academic_calendar_audit_append_only_update"
BEFORE UPDATE ON "AcademicCalendarAuditEvent"
BEGIN SELECT RAISE(ABORT, 'Academic calendar audit is append-only'); END;
CREATE TRIGGER "academic_calendar_audit_append_only_delete"
BEFORE DELETE ON "AcademicCalendarAuditEvent"
BEGIN SELECT RAISE(ABORT, 'Academic calendar audit is append-only'); END;

-- Lifecycle transitions are monotonic. Content guards must never be bypassed by
-- first moving a published row back to DRAFT.
CREATE TRIGGER "academic_calendar_version_insert_draft_only"
BEFORE INSERT ON "AcademicCalendarVersion" WHEN NEW."status" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Academic calendar versions must begin as drafts'); END;

CREATE TRIGGER "academic_calendar_version_status_transition"
BEFORE UPDATE OF "status" ON "AcademicCalendarVersion"
WHEN NOT (
  NEW."status" = OLD."status" OR
  (OLD."status" = 'DRAFT' AND NEW."status" = 'READY_FOR_REVIEW' AND NEW."submittedAt" IS NOT NULL) OR
  (OLD."status" = 'READY_FOR_REVIEW' AND NEW."status" = 'PUBLISHED' AND NEW."approvedAt" IS NOT NULL AND NEW."publishedAt" IS NOT NULL AND NEW."publicationReason" IS NOT NULL AND NEW."currentPublicationKey" IS NOT NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'REPLACED' AND NEW."replacedAt" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'WITHDRAWN' AND NEW."withdrawnAt" IS NOT NULL AND NEW."withdrawalReason" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" IN ('REPLACED','WITHDRAWN') AND NEW."status" = 'ARCHIVED' AND NEW."archivedAt" IS NOT NULL AND NEW."archiveReason" IS NOT NULL)
)
BEGIN SELECT RAISE(ABORT, 'Invalid academic calendar lifecycle transition'); END;

CREATE TRIGGER "academic_calendar_version_evidence_set_once"
BEFORE UPDATE ON "AcademicCalendarVersion"
WHEN
  (OLD."submittedAt" IS NOT NULL AND NEW."submittedAt" IS NOT OLD."submittedAt") OR
  (OLD."approvedAt" IS NOT NULL AND NEW."approvedAt" IS NOT OLD."approvedAt") OR
  (OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS NOT OLD."publishedAt") OR
  (OLD."replacedAt" IS NOT NULL AND NEW."replacedAt" IS NOT OLD."replacedAt") OR
  (OLD."withdrawnAt" IS NOT NULL AND NEW."withdrawnAt" IS NOT OLD."withdrawnAt") OR
  (OLD."archivedAt" IS NOT NULL AND NEW."archivedAt" IS NOT OLD."archivedAt") OR
  (OLD."publicationReason" IS NOT NULL AND NEW."publicationReason" IS NOT OLD."publicationReason") OR
  (OLD."replacementReason" IS NOT NULL AND NEW."replacementReason" IS NOT OLD."replacementReason") OR
  (OLD."withdrawalReason" IS NOT NULL AND NEW."withdrawalReason" IS NOT OLD."withdrawalReason") OR
  (OLD."archiveReason" IS NOT NULL AND NEW."archiveReason" IS NOT OLD."archiveReason") OR
  (OLD."idempotencyKey" IS NOT NULL AND NEW."idempotencyKey" IS NOT OLD."idempotencyKey") OR
  (OLD."replacesVersionId" IS NOT NULL AND NEW."replacesVersionId" IS NOT OLD."replacesVersionId")
BEGIN SELECT RAISE(ABORT, 'Academic calendar lifecycle evidence is set-once'); END;

CREATE TRIGGER "academic_calendar_replacement_scope_guard"
BEFORE INSERT ON "AcademicCalendarVersion" WHEN NEW."replacesVersionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "AcademicCalendarVersion" prior WHERE prior."id" = NEW."replacesVersionId" AND prior."academicYear" = NEW."academicYear" AND prior."scopeKey" = NEW."scopeKey" AND prior."versionNumber" < NEW."versionNumber"
)
BEGIN SELECT RAISE(ABORT, 'Academic calendar replacement must reference an earlier version in the same scope'); END;

CREATE TRIGGER "school_calendar_event_insert_draft_only"
BEFORE INSERT ON "SchoolCalendarEvent" WHEN NEW."status" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'School calendar events must begin as drafts'); END;

CREATE TRIGGER "school_calendar_event_version_insert_draft_only"
BEFORE INSERT ON "SchoolCalendarEventVersion" WHEN NEW."status" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'School calendar event versions must begin as drafts'); END;

CREATE TRIGGER "school_calendar_event_version_status_transition"
BEFORE UPDATE OF "status" ON "SchoolCalendarEventVersion"
WHEN NOT (
  NEW."status" = OLD."status" OR
  (OLD."status" = 'DRAFT' AND NEW."status" = 'READY_FOR_REVIEW' AND NEW."submittedAt" IS NOT NULL) OR
  (OLD."status" = 'READY_FOR_REVIEW' AND NEW."status" = 'PUBLISHED' AND NEW."approvedAt" IS NOT NULL AND NEW."publishedAt" IS NOT NULL AND NEW."publicationReason" IS NOT NULL AND NEW."currentPublicationKey" IS NOT NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'REPLACED' AND NEW."replacedAt" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'WITHDRAWN' AND NEW."withdrawnAt" IS NOT NULL AND NEW."withdrawalReason" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" IN ('REPLACED','WITHDRAWN') AND NEW."status" = 'ARCHIVED' AND NEW."archivedAt" IS NOT NULL AND NEW."archiveReason" IS NOT NULL)
)
BEGIN SELECT RAISE(ABORT, 'Invalid school calendar event lifecycle transition'); END;

CREATE TRIGGER "school_calendar_event_version_evidence_set_once"
BEFORE UPDATE ON "SchoolCalendarEventVersion"
WHEN
  (OLD."submittedAt" IS NOT NULL AND NEW."submittedAt" IS NOT OLD."submittedAt") OR
  (OLD."approvedAt" IS NOT NULL AND NEW."approvedAt" IS NOT OLD."approvedAt") OR
  (OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS NOT OLD."publishedAt") OR
  (OLD."replacedAt" IS NOT NULL AND NEW."replacedAt" IS NOT OLD."replacedAt") OR
  (OLD."withdrawnAt" IS NOT NULL AND NEW."withdrawnAt" IS NOT OLD."withdrawnAt") OR
  (OLD."archivedAt" IS NOT NULL AND NEW."archivedAt" IS NOT OLD."archivedAt") OR
  (OLD."publicationReason" IS NOT NULL AND NEW."publicationReason" IS NOT OLD."publicationReason") OR
  (OLD."replacementReason" IS NOT NULL AND NEW."replacementReason" IS NOT OLD."replacementReason") OR
  (OLD."withdrawalReason" IS NOT NULL AND NEW."withdrawalReason" IS NOT OLD."withdrawalReason") OR
  (OLD."archiveReason" IS NOT NULL AND NEW."archiveReason" IS NOT OLD."archiveReason") OR
  (OLD."idempotencyKey" IS NOT NULL AND NEW."idempotencyKey" IS NOT OLD."idempotencyKey") OR
  (OLD."replacesVersionId" IS NOT NULL AND NEW."replacesVersionId" IS NOT OLD."replacesVersionId")
BEGIN SELECT RAISE(ABORT, 'School calendar event lifecycle evidence is set-once'); END;

CREATE TRIGGER "school_calendar_event_replacement_owner_guard"
BEFORE INSERT ON "SchoolCalendarEventVersion" WHEN NEW."replacesVersionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "SchoolCalendarEventVersion" prior WHERE prior."id" = NEW."replacesVersionId" AND prior."eventId" = NEW."eventId" AND prior."versionNumber" < NEW."versionNumber"
)
BEGIN SELECT RAISE(ABORT, 'School calendar event replacement must reference an earlier version of the same event'); END;

CREATE TRIGGER "school_calendar_current_pointer_owner_guard"
BEFORE UPDATE OF "currentPublishedVersionId" ON "SchoolCalendarEvent"
WHEN NEW."currentPublishedVersionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "SchoolCalendarEventVersion" currentVersion WHERE currentVersion."id" = NEW."currentPublishedVersionId" AND currentVersion."eventId" = NEW."id" AND currentVersion."status" = 'PUBLISHED' AND currentVersion."currentPublicationKey" IS NOT NULL
)
BEGIN SELECT RAISE(ABORT, 'Current event publication must belong to the same event'); END;

CREATE TRIGGER "academic_calendar_audit_target_guard"
BEFORE INSERT ON "AcademicCalendarAuditEvent"
WHEN NOT (
  (NEW."entityType" = 'OPERATIONAL_CALENDAR' AND NEW."calendarVersionId" IS NOT NULL AND NEW."schoolEventId" IS NULL AND NEW."eventVersionId" IS NULL) OR
  (NEW."entityType" = 'INFORMATIONAL_EVENT' AND NEW."calendarVersionId" IS NULL AND NEW."schoolEventId" IS NOT NULL AND NEW."eventVersionId" IS NOT NULL AND EXISTS (SELECT 1 FROM "SchoolCalendarEventVersion" v WHERE v."id" = NEW."eventVersionId" AND v."eventId" = NEW."schoolEventId"))
)
BEGIN SELECT RAISE(ABORT, 'Academic calendar audit target is invalid'); END;
