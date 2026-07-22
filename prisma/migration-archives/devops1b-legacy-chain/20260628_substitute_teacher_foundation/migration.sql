CREATE TABLE "SubstituteAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentDate" DATETIME NOT NULL,
    "academicYear" TEXT,
    "leaveRequestId" TEXT,
    "absentStaffMemberId" TEXT NOT NULL,
    "substituteStaffMemberId" TEXT,
    "timetableAssignmentId" TEXT,
    "className" TEXT,
    "section" TEXT,
    "subject" TEXT,
    "periodLabel" TEXT,
    "periodStartTime" TEXT,
    "periodEndTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "assignedByUserId" TEXT,
    "confirmedByUserId" TEXT,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "assignedAt" DATETIME,
    "confirmedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubstituteAssignment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "StaffLeaveRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_absentStaffMemberId_fkey" FOREIGN KEY ("absentStaffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_substituteStaffMemberId_fkey" FOREIGN KEY ("substituteStaffMemberId") REFERENCES "StaffMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_timetableAssignmentId_fkey" FOREIGN KEY ("timetableAssignmentId") REFERENCES "TimetableAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SubstituteAssignment_assignmentDate_idx" ON "SubstituteAssignment"("assignmentDate");
CREATE INDEX "SubstituteAssignment_status_idx" ON "SubstituteAssignment"("status");
CREATE INDEX "SubstituteAssignment_absentStaffMemberId_assignmentDate_idx" ON "SubstituteAssignment"("absentStaffMemberId", "assignmentDate");
CREATE INDEX "SubstituteAssignment_substituteStaffMemberId_assignmentDate_idx" ON "SubstituteAssignment"("substituteStaffMemberId", "assignmentDate");
CREATE INDEX "SubstituteAssignment_leaveRequestId_idx" ON "SubstituteAssignment"("leaveRequestId");
CREATE INDEX "SubstituteAssignment_timetableAssignmentId_idx" ON "SubstituteAssignment"("timetableAssignmentId");
