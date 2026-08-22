-- PARENT-MEETING-V1_5-1A: additive, default-off Parent appointment and follow-up log.
CREATE TABLE "ParentMeeting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "requesterGuardianId" TEXT,
  "academicYear" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "requestReason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "scheduledStartAt" DATETIME,
  "scheduledEndAt" DATETIME,
  "durationMinutes" INTEGER,
  "mode" TEXT,
  "locationReference" TEXT,
  "onlineReference" TEXT,
  "requesterUserId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "scheduledByUserId" TEXT,
  "completedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "cancellationInternalReason" TEXT,
  "parentCancellationSummary" TEXT,
  "noShowState" TEXT,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" DATETIME,
  "cancelledAt" DATETIME,
  "activeRequestKey" TEXT,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ParentMeeting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeeting_requesterGuardianId_fkey" FOREIGN KEY ("requesterGuardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeeting_source_check" CHECK ("source" IN ('PARENT_REQUEST','LEADERSHIP_CREATED')),
  CONSTRAINT "ParentMeeting_category_check" CHECK ("category" IN ('ACADEMIC_PROGRESS','ATTENDANCE','GENERAL_SCHOOL_DISCUSSION','ADMINISTRATIVE','PRINCIPAL_APPOINTMENT','OTHER')),
  CONSTRAINT "ParentMeeting_status_check" CHECK ("status" IN ('REQUESTED','SCHEDULING','SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
  CONSTRAINT "ParentMeeting_mode_check" CHECK ("mode" IS NULL OR "mode" IN ('IN_PERSON','PHONE','ONLINE_REFERENCE')),
  CONSTRAINT "ParentMeeting_no_show_check" CHECK ("noShowState" IS NULL OR "noShowState" IN ('PARENT_NO_SHOW','STAFF_NO_SHOW','BOTH_NO_SHOW'))
);

CREATE TABLE "ParentMeetingPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "startsAt" DATETIME NOT NULL,
  "endsAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentMeetingPreference_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeetingPreference_sequence_check" CHECK ("sequence" BETWEEN 1 AND 3),
  CONSTRAINT "ParentMeetingPreference_window_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "ParentMeetingParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "staffMemberId" TEXT NOT NULL,
  "participantRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "assignedByUserId" TEXT NOT NULL,
  "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attendanceAt" DATETIME,
  "removedAt" DATETIME,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ParentMeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeetingParticipant_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeetingParticipant_role_check" CHECK ("participantRole" IN ('PRIMARY_STAFF','ADDITIONAL_STAFF')),
  CONSTRAINT "ParentMeetingParticipant_status_check" CHECK ("status" IN ('ASSIGNED','ATTENDED','ABSENT','REMOVED'))
);

CREATE TABLE "ParentMeetingNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "correctsNoteId" TEXT,
  "correctionReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentMeetingNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeetingNote_correctsNoteId_fkey" FOREIGN KEY ("correctsNoteId") REFERENCES "ParentMeetingNote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeetingNote_kind_check" CHECK ("kind" IN ('LEADERSHIP_PRIVATE','PARTICIPANT_INTERNAL','PARENT_VISIBLE_SUMMARY')),
  CONSTRAINT "ParentMeetingNote_correction_check" CHECK (("correctsNoteId" IS NULL AND "correctionReason" IS NULL) OR ("correctsNoteId" IS NOT NULL AND length(trim("correctionReason")) >= 3))
);

CREATE TABLE "ParentMeetingFollowUp" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "internalDescription" TEXT NOT NULL,
  "parentVisibleDescription" TEXT,
  "responsibleStaffMemberId" TEXT NOT NULL,
  "dueDate" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdByUserId" TEXT NOT NULL,
  "completedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "completedAt" DATETIME,
  "cancelledAt" DATETIME,
  "cancellationReason" TEXT,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ParentMeetingFollowUp_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeetingFollowUp_staffMemberId_fkey" FOREIGN KEY ("responsibleStaffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentMeetingFollowUp_status_check" CHECK ("status" IN ('OPEN','DONE','CANCELLED'))
);

CREATE TABLE "ParentMeetingEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "reason" TEXT,
  "safeMetadataJson" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentMeetingEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ParentMeeting_publicKey_key" ON "ParentMeeting"("publicKey");
CREATE UNIQUE INDEX "ParentMeeting_activeRequestKey_key" ON "ParentMeeting"("activeRequestKey");
CREATE INDEX "ParentMeeting_status_scheduledStartAt_idx" ON "ParentMeeting"("status","scheduledStartAt");
CREATE INDEX "ParentMeeting_studentId_createdAt_idx" ON "ParentMeeting"("studentId","createdAt");
CREATE INDEX "ParentMeeting_requesterGuardianId_createdAt_idx" ON "ParentMeeting"("requesterGuardianId","createdAt");
CREATE INDEX "ParentMeeting_academicYear_category_status_idx" ON "ParentMeeting"("academicYear","category","status");
CREATE INDEX "ParentMeeting_scheduledStartAt_scheduledEndAt_idx" ON "ParentMeeting"("scheduledStartAt","scheduledEndAt");
CREATE UNIQUE INDEX "ParentMeetingPreference_meetingId_sequence_key" ON "ParentMeetingPreference"("meetingId","sequence");
CREATE INDEX "ParentMeetingPreference_meetingId_startsAt_idx" ON "ParentMeetingPreference"("meetingId","startsAt");
CREATE UNIQUE INDEX "ParentMeetingParticipant_publicKey_key" ON "ParentMeetingParticipant"("publicKey");
CREATE UNIQUE INDEX "ParentMeetingParticipant_meetingId_staffMemberId_key" ON "ParentMeetingParticipant"("meetingId","staffMemberId");
CREATE UNIQUE INDEX "ParentMeetingParticipant_one_primary" ON "ParentMeetingParticipant"("meetingId") WHERE "participantRole"='PRIMARY_STAFF' AND "status"<>'REMOVED';
CREATE INDEX "ParentMeetingParticipant_staffMemberId_status_idx" ON "ParentMeetingParticipant"("staffMemberId","status");
CREATE INDEX "ParentMeetingParticipant_meetingId_role_status_idx" ON "ParentMeetingParticipant"("meetingId","participantRole","status");
CREATE UNIQUE INDEX "ParentMeetingNote_publicKey_key" ON "ParentMeetingNote"("publicKey");
CREATE INDEX "ParentMeetingNote_meetingId_kind_createdAt_idx" ON "ParentMeetingNote"("meetingId","kind","createdAt");
CREATE INDEX "ParentMeetingNote_authorUserId_createdAt_idx" ON "ParentMeetingNote"("authorUserId","createdAt");
CREATE UNIQUE INDEX "ParentMeetingNote_correctsNoteId_key" ON "ParentMeetingNote"("correctsNoteId");
CREATE UNIQUE INDEX "ParentMeetingFollowUp_publicKey_key" ON "ParentMeetingFollowUp"("publicKey");
CREATE INDEX "ParentMeetingFollowUp_meetingId_status_dueDate_idx" ON "ParentMeetingFollowUp"("meetingId","status","dueDate");
CREATE INDEX "ParentMeetingFollowUp_responsible_status_dueDate_idx" ON "ParentMeetingFollowUp"("responsibleStaffMemberId","status","dueDate");
CREATE INDEX "ParentMeetingFollowUp_status_dueDate_idx" ON "ParentMeetingFollowUp"("status","dueDate");
CREATE UNIQUE INDEX "ParentMeetingEvent_publicKey_key" ON "ParentMeetingEvent"("publicKey");
CREATE INDEX "ParentMeetingEvent_meetingId_occurredAt_idx" ON "ParentMeetingEvent"("meetingId","occurredAt");
CREATE INDEX "ParentMeetingEvent_eventType_occurredAt_idx" ON "ParentMeetingEvent"("eventType","occurredAt");

CREATE TRIGGER "ParentMeeting_identity_immutable"
BEFORE UPDATE OF "studentId","requesterGuardianId","academicYear","source","requesterUserId","createdByUserId","createdAt" ON "ParentMeeting"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting identity is immutable'); END;

CREATE TRIGGER "ParentMeeting_status_transition"
BEFORE UPDATE OF "status" ON "ParentMeeting"
WHEN NOT (
  (OLD."status"='REQUESTED' AND NEW."status" IN ('REQUESTED','SCHEDULING','SCHEDULED','CANCELLED')) OR
  (OLD."status"='SCHEDULING' AND NEW."status" IN ('SCHEDULING','SCHEDULED','CANCELLED')) OR
  (OLD."status"='SCHEDULED' AND NEW."status" IN ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')) OR
  (OLD."status"='CONFIRMED' AND NEW."status" IN ('CONFIRMED','SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')) OR
  (OLD."status"='COMPLETED' AND NEW."status"='COMPLETED') OR
  (OLD."status"='CANCELLED' AND NEW."status"='CANCELLED') OR
  (OLD."status"='NO_SHOW' AND NEW."status"='NO_SHOW')
)
BEGIN SELECT RAISE(ABORT, 'PARENT_MEETING_TRANSITION_INVALID'); END;

CREATE TRIGGER "ParentMeeting_schedule_required"
BEFORE UPDATE OF "status","scheduledStartAt","scheduledEndAt","durationMinutes","mode" ON "ParentMeeting"
WHEN NEW."status" IN ('SCHEDULED','CONFIRMED') AND (
  NEW."scheduledStartAt" IS NULL OR NEW."scheduledEndAt" IS NULL OR NEW."durationMinutes" NOT BETWEEN 10 AND 180 OR
  NEW."scheduledEndAt" <= NEW."scheduledStartAt" OR NEW."mode" IS NULL
)
BEGIN SELECT RAISE(ABORT, 'PARENT_MEETING_SCHEDULE_INVALID'); END;

CREATE TRIGGER "ParentMeeting_schedule_conflict"
BEFORE UPDATE OF "status","scheduledStartAt","scheduledEndAt","mode","locationReference" ON "ParentMeeting"
WHEN NEW."status" IN ('SCHEDULED','CONFIRMED')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "ParentMeeting" other
    WHERE other."id"<>NEW."id" AND other."status" IN ('SCHEDULED','CONFIRMED')
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
      AND NEW."requesterGuardianId" IS NOT NULL AND other."requesterGuardianId"=NEW."requesterGuardianId"
  ) THEN RAISE(ABORT, 'PARENT_MEETING_GUARDIAN_CONFLICT') END;
  SELECT CASE WHEN NEW."mode"='IN_PERSON' AND length(trim(COALESCE(NEW."locationReference",'')))>0 AND EXISTS (
    SELECT 1 FROM "ParentMeeting" other
    WHERE other."id"<>NEW."id" AND other."status" IN ('SCHEDULED','CONFIRMED') AND other."mode"='IN_PERSON'
      AND lower(trim(other."locationReference"))=lower(trim(NEW."locationReference"))
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
  ) THEN RAISE(ABORT, 'PARENT_MEETING_LOCATION_CONFLICT') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "ParentMeetingParticipant" currentParticipant
    JOIN "ParentMeetingParticipant" otherParticipant ON otherParticipant."staffMemberId"=currentParticipant."staffMemberId" AND otherParticipant."status"<>'REMOVED'
    JOIN "ParentMeeting" other ON other."id"=otherParticipant."meetingId"
    WHERE currentParticipant."meetingId"=NEW."id" AND currentParticipant."status"<>'REMOVED'
      AND other."id"<>NEW."id" AND other."status" IN ('SCHEDULED','CONFIRMED')
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
  ) THEN RAISE(ABORT, 'PARENT_MEETING_STAFF_CONFLICT') END;
END;

CREATE TRIGGER "ParentMeetingParticipant_schedule_conflict_insert"
BEFORE INSERT ON "ParentMeetingParticipant"
WHEN NEW."status"<>'REMOVED'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "ParentMeeting" currentMeeting
    JOIN "ParentMeetingParticipant" otherParticipant ON otherParticipant."staffMemberId"=NEW."staffMemberId" AND otherParticipant."status"<>'REMOVED'
    JOIN "ParentMeeting" otherMeeting ON otherMeeting."id"=otherParticipant."meetingId"
    WHERE currentMeeting."id"=NEW."meetingId" AND currentMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND otherMeeting."id"<>currentMeeting."id" AND otherMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND currentMeeting."scheduledStartAt" < otherMeeting."scheduledEndAt" AND currentMeeting."scheduledEndAt" > otherMeeting."scheduledStartAt"
  ) THEN RAISE(ABORT, 'PARENT_MEETING_STAFF_CONFLICT') END;
END;

CREATE TRIGGER "ParentMeetingParticipant_schedule_conflict_update"
BEFORE UPDATE OF "staffMemberId","status" ON "ParentMeetingParticipant"
WHEN NEW."status"<>'REMOVED'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "ParentMeeting" currentMeeting
    JOIN "ParentMeetingParticipant" otherParticipant ON otherParticipant."staffMemberId"=NEW."staffMemberId" AND otherParticipant."status"<>'REMOVED' AND otherParticipant."id"<>NEW."id"
    JOIN "ParentMeeting" otherMeeting ON otherMeeting."id"=otherParticipant."meetingId"
    WHERE currentMeeting."id"=NEW."meetingId" AND currentMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND otherMeeting."id"<>currentMeeting."id" AND otherMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND currentMeeting."scheduledStartAt" < otherMeeting."scheduledEndAt" AND currentMeeting."scheduledEndAt" > otherMeeting."scheduledStartAt"
  ) THEN RAISE(ABORT, 'PARENT_MEETING_STAFF_CONFLICT') END;
END;

CREATE TRIGGER "ParentMeetingFollowUp_status_transition"
BEFORE UPDATE OF "status" ON "ParentMeetingFollowUp"
WHEN NOT ((OLD."status"='OPEN' AND NEW."status" IN ('OPEN','DONE','CANCELLED')) OR (OLD."status"=NEW."status" AND OLD."status" IN ('DONE','CANCELLED')))
BEGIN SELECT RAISE(ABORT, 'PARENT_MEETING_FOLLOW_UP_TRANSITION_INVALID'); END;

CREATE TRIGGER "ParentMeeting_no_delete" BEFORE DELETE ON "ParentMeeting"
BEGIN SELECT RAISE(ABORT, 'Parent Meetings use governed cancellation'); END;
CREATE TRIGGER "ParentMeetingPreference_no_update" BEFORE UPDATE ON "ParentMeetingPreference"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting preferences are immutable evidence'); END;
CREATE TRIGGER "ParentMeetingPreference_no_delete" BEFORE DELETE ON "ParentMeetingPreference"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting preferences are immutable evidence'); END;
CREATE TRIGGER "ParentMeetingParticipant_no_delete" BEFORE DELETE ON "ParentMeetingParticipant"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting participant history is retained'); END;
CREATE TRIGGER "ParentMeetingNote_no_update" BEFORE UPDATE ON "ParentMeetingNote"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting notes are append-only'); END;
CREATE TRIGGER "ParentMeetingNote_no_delete" BEFORE DELETE ON "ParentMeetingNote"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting notes are append-only'); END;
CREATE TRIGGER "ParentMeetingFollowUp_no_delete" BEFORE DELETE ON "ParentMeetingFollowUp"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting follow-up history is retained'); END;
CREATE TRIGGER "ParentMeetingEvent_no_update" BEFORE UPDATE ON "ParentMeetingEvent"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting event history is append-only'); END;
CREATE TRIGGER "ParentMeetingEvent_no_delete" BEFORE DELETE ON "ParentMeetingEvent"
BEGIN SELECT RAISE(ABORT, 'Parent Meeting event history is append-only'); END;
