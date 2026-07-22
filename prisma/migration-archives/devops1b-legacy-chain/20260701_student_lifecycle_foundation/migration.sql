CREATE TABLE "AcademicYearEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "rollNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrollmentDate" DATETIME,
    "exitDate" DATETIME,
    "exitReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademicYearEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StudentLifecycleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT,
    "eventType" TEXT NOT NULL,
    "fromClass" TEXT,
    "fromSection" TEXT,
    "toClass" TEXT,
    "toSection" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "effectiveDate" DATETIME NOT NULL,
    "reason" TEXT,
    "evidenceNotes" TEXT,
    "parentAcknowledgementNotes" TEXT,
    "approvedByUserId" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentLifecycleEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentLifecycleEvent_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentLifecycleEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AcademicYearEnrollment_studentId_academicYear_key" ON "AcademicYearEnrollment"("studentId", "academicYear");
CREATE INDEX "AcademicYearEnrollment_academicYear_className_section_idx" ON "AcademicYearEnrollment"("academicYear", "className", "section");
CREATE INDEX "AcademicYearEnrollment_academicYear_status_idx" ON "AcademicYearEnrollment"("academicYear", "status");
CREATE INDEX "AcademicYearEnrollment_studentId_createdAt_idx" ON "AcademicYearEnrollment"("studentId", "createdAt");
CREATE INDEX "StudentLifecycleEvent_studentId_effectiveDate_idx" ON "StudentLifecycleEvent"("studentId", "effectiveDate");
CREATE INDEX "StudentLifecycleEvent_academicYear_eventType_idx" ON "StudentLifecycleEvent"("academicYear", "eventType");
CREATE INDEX "StudentLifecycleEvent_approvedByUserId_idx" ON "StudentLifecycleEvent"("approvedByUserId");
CREATE INDEX "StudentLifecycleEvent_recordedByUserId_idx" ON "StudentLifecycleEvent"("recordedByUserId");
