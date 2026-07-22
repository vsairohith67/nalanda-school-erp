CREATE TABLE "ExamCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examCode" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "openedByUserId" TEXT,
    "closedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "openedAt" DATETIME,
    "closedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ExamCycle_examCode_key" ON "ExamCycle"("examCode");
CREATE INDEX "ExamCycle_academicYear_status_idx" ON "ExamCycle"("academicYear", "status");
CREATE INDEX "ExamCycle_startDate_endDate_idx" ON "ExamCycle"("startDate", "endDate");

CREATE TABLE "ExamAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examCycleId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "subjectName" TEXT NOT NULL,
    "timetableSubjectId" TEXT,
    "componentName" TEXT NOT NULL DEFAULT '',
    "assessmentType" TEXT NOT NULL,
    "maxMarks" DECIMAL NOT NULL,
    "passMarks" DECIMAL,
    "weightagePercent" DECIMAL,
    "entryStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamAssessment_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamAssessment_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExamAssessment_examCycleId_className_section_subjectName_componentName_key" ON "ExamAssessment"("examCycleId", "className", "section", "subjectName", "componentName");
CREATE INDEX "ExamAssessment_academicYear_className_section_idx" ON "ExamAssessment"("academicYear", "className", "section");
CREATE INDEX "ExamAssessment_timetableSubjectId_idx" ON "ExamAssessment"("timetableSubjectId");
CREATE INDEX "ExamAssessment_entryStatus_idx" ON "ExamAssessment"("entryStatus");

CREATE TABLE "StudentMark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "marksObtained" DECIMAL,
    "entryStatus" TEXT NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "enteredByUserId" TEXT,
    "verifiedByUserId" TEXT,
    "enteredAt" DATETIME,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentMark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ExamAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentMark_assessmentId_studentId_key" ON "StudentMark"("assessmentId", "studentId");
CREATE INDEX "StudentMark_studentId_academicYear_idx" ON "StudentMark"("studentId", "academicYear");
CREATE INDEX "StudentMark_entryStatus_idx" ON "StudentMark"("entryStatus");

CREATE TABLE "StudentMarkEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "studentMarkId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousMarks" DECIMAL,
    "newMarks" DECIMAL,
    "previousEntryStatus" TEXT,
    "newEntryStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "actorLabel" TEXT,
    "eventDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentMarkEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ExamAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StudentMarkEvent_assessmentId_eventDate_idx" ON "StudentMarkEvent"("assessmentId", "eventDate");
CREATE INDEX "StudentMarkEvent_studentMarkId_idx" ON "StudentMarkEvent"("studentMarkId");
CREATE INDEX "StudentMarkEvent_eventType_idx" ON "StudentMarkEvent"("eventType");
