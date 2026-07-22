-- Prompt 17A: Homework and Assignments Foundation.
CREATE TABLE "HomeworkAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentNumber" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instructions" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "section" TEXT,
  "subjectName" TEXT NOT NULL,
  "timetableSubjectId" TEXT,
  "assignedDate" DATETIME NOT NULL,
  "dueDate" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "resourceLink" TEXT,
  "teacherNotes" TEXT,
  "publicNotes" TEXT,
  "correctionReason" TEXT,
  "cancellationReason" TEXT,
  "createdByUserId" TEXT,
  "publishedByUserId" TEXT,
  "archivedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "publishedAt" DATETIME,
  "archivedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "HomeworkAssignment_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "HomeworkAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "HomeworkAssignment_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "HomeworkAssignment_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "HomeworkAssignment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HomeworkAssignment_assignmentNumber_key" ON "HomeworkAssignment"("assignmentNumber");
CREATE INDEX "HomeworkAssignment_academicYear_className_section_idx" ON "HomeworkAssignment"("academicYear", "className", "section");
CREATE INDEX "HomeworkAssignment_academicYear_subjectName_idx" ON "HomeworkAssignment"("academicYear", "subjectName");
CREATE INDEX "HomeworkAssignment_status_assignedDate_idx" ON "HomeworkAssignment"("status", "assignedDate");
CREATE INDEX "HomeworkAssignment_dueDate_idx" ON "HomeworkAssignment"("dueDate");
CREATE INDEX "HomeworkAssignment_createdByUserId_idx" ON "HomeworkAssignment"("createdByUserId");
CREATE INDEX "HomeworkAssignment_timetableSubjectId_idx" ON "HomeworkAssignment"("timetableSubjectId");

CREATE TABLE "HomeworkAssignmentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL,
  "titleSnapshot" TEXT,
  "instructionsSnapshot" TEXT,
  "dueDateSnapshot" DATETIME,
  "reason" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeworkAssignmentEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HomeworkAssignmentEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "HomeworkAssignmentEvent_assignmentId_eventDate_idx" ON "HomeworkAssignmentEvent"("assignmentId", "eventDate");
CREATE INDEX "HomeworkAssignmentEvent_eventType_idx" ON "HomeworkAssignmentEvent"("eventType");
CREATE INDEX "HomeworkAssignmentEvent_recordedByUserId_idx" ON "HomeworkAssignmentEvent"("recordedByUserId");
