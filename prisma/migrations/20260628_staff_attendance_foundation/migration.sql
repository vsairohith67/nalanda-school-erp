CREATE TABLE "StaffAttendanceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendanceDate" DATETIME NOT NULL,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "takenByUserId" TEXT,
    "submittedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" DATETIME,
    "lockedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffAttendanceSession_takenByUserId_fkey" FOREIGN KEY ("takenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffAttendanceSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffAttendanceSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "StaffAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "staffCode" TEXT,
    "status" TEXT NOT NULL,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "lateMinutes" INTEGER,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StaffAttendanceSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffAttendanceRecord_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StaffAttendanceSession_attendanceDate_key" ON "StaffAttendanceSession"("attendanceDate");
CREATE INDEX "StaffAttendanceSession_status_idx" ON "StaffAttendanceSession"("status");
CREATE UNIQUE INDEX "StaffAttendanceRecord_sessionId_staffMemberId_key" ON "StaffAttendanceRecord"("sessionId", "staffMemberId");
CREATE INDEX "StaffAttendanceRecord_staffMemberId_idx" ON "StaffAttendanceRecord"("staffMemberId");
CREATE INDEX "StaffAttendanceRecord_status_idx" ON "StaffAttendanceRecord"("status");
CREATE INDEX "StaffAttendanceRecord_source_idx" ON "StaffAttendanceRecord"("source");
