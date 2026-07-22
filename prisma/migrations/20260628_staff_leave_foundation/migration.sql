-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffMemberId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "leaveType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "halfDaySession" TEXT,
    "totalDays" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "substituteRequired" BOOLEAN NOT NULL DEFAULT false,
    "substituteNotes" TEXT,
    "approverUserId" TEXT,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffLeaveRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffLeaveRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffLeaveRequest_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffLeaveRequest_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "StaffLeaveRequest_staffMemberId_startDate_endDate_idx" ON "StaffLeaveRequest"("staffMemberId", "startDate", "endDate");
CREATE INDEX "StaffLeaveRequest_status_idx" ON "StaffLeaveRequest"("status");
CREATE INDEX "StaffLeaveRequest_leaveType_idx" ON "StaffLeaveRequest"("leaveType");
CREATE INDEX "StaffLeaveRequest_startDate_endDate_idx" ON "StaffLeaveRequest"("startDate", "endDate");
CREATE INDEX "StaffLeaveRequest_requestedByUserId_idx" ON "StaffLeaveRequest"("requestedByUserId");
CREATE INDEX "StaffLeaveRequest_approverUserId_idx" ON "StaffLeaveRequest"("approverUserId");
