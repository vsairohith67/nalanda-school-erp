CREATE TABLE "TimetableDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TimetableDraft_academicYear_name_key" ON "TimetableDraft"("academicYear", "name");
CREATE INDEX "TimetableDraft_academicYear_idx" ON "TimetableDraft"("academicYear");
CREATE INDEX "TimetableDraft_status_idx" ON "TimetableDraft"("status");
CREATE INDEX "TimetableDraft_createdByUserId_idx" ON "TimetableDraft"("createdByUserId");

CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "classSectionId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "assignmentId" TEXT,
    "teacherId" TEXT,
    "subjectId" TEXT,
    "label" TEXT,
    "entryType" TEXT NOT NULL DEFAULT 'EMPTY',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableEntry_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TimetableDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "TimetableClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TimetableAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "TimetableSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TimetableEntry_draftId_classSectionId_dayOfWeek_periodNumber_key" ON "TimetableEntry"("draftId", "classSectionId", "dayOfWeek", "periodNumber");
CREATE INDEX "TimetableEntry_draftId_idx" ON "TimetableEntry"("draftId");
CREATE INDEX "TimetableEntry_academicYear_idx" ON "TimetableEntry"("academicYear");
CREATE INDEX "TimetableEntry_teacherId_dayOfWeek_periodNumber_idx" ON "TimetableEntry"("teacherId", "dayOfWeek", "periodNumber");
CREATE INDEX "TimetableEntry_classSectionId_idx" ON "TimetableEntry"("classSectionId");
CREATE INDEX "TimetableEntry_assignmentId_idx" ON "TimetableEntry"("assignmentId");
