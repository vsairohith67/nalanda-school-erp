CREATE TABLE "StudentAttendanceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendanceDate" DATETIME NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "takenByUserId" TEXT,
    "submittedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" DATETIME,
    "lockedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentAttendanceSession_takenByUserId_fkey" FOREIGN KEY ("takenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendanceSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendanceSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "StudentAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudentAttendanceSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudentAttendanceSession_attendanceDate_className_section_academicYear_key" ON "StudentAttendanceSession"("attendanceDate", "className", "section", "academicYear");
CREATE INDEX "StudentAttendanceSession_attendanceDate_idx" ON "StudentAttendanceSession"("attendanceDate");
CREATE INDEX "StudentAttendanceSession_academicYear_className_section_idx" ON "StudentAttendanceSession"("academicYear", "className", "section");
CREATE INDEX "StudentAttendanceSession_status_idx" ON "StudentAttendanceSession"("status");
CREATE UNIQUE INDEX "StudentAttendanceRecord_sessionId_studentId_key" ON "StudentAttendanceRecord"("sessionId", "studentId");
CREATE INDEX "StudentAttendanceRecord_studentId_idx" ON "StudentAttendanceRecord"("studentId");
CREATE INDEX "StudentAttendanceRecord_status_idx" ON "StudentAttendanceRecord"("status");
