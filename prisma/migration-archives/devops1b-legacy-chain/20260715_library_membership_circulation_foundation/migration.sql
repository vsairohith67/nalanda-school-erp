CREATE TABLE "LibraryMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "memberCode" TEXT NOT NULL,
  "memberType" TEXT NOT NULL,
  "studentId" TEXT,
  "staffMemberId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "joinedDate" DATETIME NOT NULL,
  "suspendedUntil" DATETIME,
  "suspensionReason" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryMember_exactly_one_link_check" CHECK (
    ("memberType" = 'STUDENT' AND "studentId" IS NOT NULL AND "staffMemberId" IS NULL) OR
    ("memberType" = 'STAFF' AND "staffMemberId" IS NOT NULL AND "studentId" IS NULL)
  ),
  CONSTRAINT "LibraryMember_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
  CONSTRAINT "LibraryMember_suspension_reason_check" CHECK ("status" <> 'SUSPENDED' OR length(trim(COALESCE("suspensionReason", ''))) > 0),
  CONSTRAINT "LibraryMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryMember_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryMember_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryMember_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "LibraryPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "policyCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "memberType" TEXT NOT NULL,
  "className" TEXT,
  "staffType" TEXT,
  "maxActiveLoans" INTEGER NOT NULL,
  "loanPeriodDays" INTEGER NOT NULL,
  "maxRenewals" INTEGER NOT NULL,
  "renewalPeriodDays" INTEGER NOT NULL,
  "reservationLimit" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryPolicy_scope_check" CHECK (
    ("memberType" = 'STUDENT' AND "staffType" IS NULL) OR
    ("memberType" = 'STAFF' AND "className" IS NULL)
  ),
  CONSTRAINT "LibraryPolicy_limits_check" CHECK ("maxActiveLoans" > 0 AND "loanPeriodDays" > 0 AND "maxRenewals" >= 0 AND "renewalPeriodDays" > 0 AND "reservationLimit" >= 0),
  CONSTRAINT "LibraryPolicy_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT "LibraryPolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "LibraryLoan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loanNumber" TEXT NOT NULL,
  "copyId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "activeCopyKey" TEXT,
  "issueDate" DATETIME NOT NULL,
  "dueDate" DATETIME NOT NULL,
  "returnedDate" DATETIME,
  "renewCount" INTEGER NOT NULL DEFAULT 0,
  "policyCodeSnapshot" TEXT NOT NULL,
  "loanPeriodDaysSnapshot" INTEGER NOT NULL,
  "maxRenewalsSnapshot" INTEGER NOT NULL,
  "renewalPeriodDaysSnapshot" INTEGER NOT NULL,
  "issueConditionSnapshot" TEXT NOT NULL,
  "returnConditionSnapshot" TEXT,
  "issueNotes" TEXT,
  "returnNotes" TEXT,
  "cancellationReason" TEXT,
  "issuedByUserId" TEXT,
  "returnedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryLoan_status_check" CHECK ("status" IN ('ISSUED', 'RETURNED', 'CANCELLED')),
  CONSTRAINT "LibraryLoan_active_key_check" CHECK (("status" = 'ISSUED' AND "activeCopyKey" IS NOT NULL AND "returnedDate" IS NULL) OR ("status" <> 'ISSUED' AND "activeCopyKey" IS NULL)),
  CONSTRAINT "LibraryLoan_dates_check" CHECK ("dueDate" >= "issueDate" AND ("returnedDate" IS NULL OR "returnedDate" >= "issueDate")),
  CONSTRAINT "LibraryLoan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoan_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoan_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "LibraryReservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationNumber" TEXT NOT NULL,
  "titleId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WAITING',
  "activeMemberTitleKey" TEXT,
  "requestedDate" DATETIME NOT NULL,
  "expiresDate" DATETIME,
  "fulfilledLoanId" TEXT,
  "fulfilledAt" DATETIME,
  "cancelledAt" DATETIME,
  "cancellationReason" TEXT,
  "createdByUserId" TEXT,
  "fulfilledByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryReservation_status_check" CHECK ("status" IN ('WAITING', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT "LibraryReservation_active_key_check" CHECK (("status" = 'WAITING' AND "activeMemberTitleKey" IS NOT NULL) OR ("status" <> 'WAITING' AND "activeMemberTitleKey" IS NULL)),
  CONSTRAINT "LibraryReservation_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryReservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryReservation_fulfilledLoanId_fkey" FOREIGN KEY ("fulfilledLoanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryReservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryReservation_fulfilledByUserId_fkey" FOREIGN KEY ("fulfilledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryReservation_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "LibraryLoanEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loanId" TEXT,
  "reservationId" TEXT,
  "memberId" TEXT NOT NULL,
  "copyId" TEXT,
  "titleId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL,
  "previousDueDate" DATETIME,
  "newDueDate" DATETIME,
  "reason" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryLoanEvent_parent_check" CHECK ("loanId" IS NOT NULL OR "reservationId" IS NOT NULL OR "eventType" IN ('MEMBER_SUSPENDED', 'MEMBER_REACTIVATED', 'CORRECTION')),
  CONSTRAINT "LibraryLoanEvent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoanEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "LibraryReservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoanEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoanEvent_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoanEvent_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LibraryMember_memberCode_key" ON "LibraryMember"("memberCode");
CREATE UNIQUE INDEX "LibraryMember_studentId_key" ON "LibraryMember"("studentId");
CREATE UNIQUE INDEX "LibraryMember_staffMemberId_key" ON "LibraryMember"("staffMemberId");
CREATE INDEX "LibraryMember_memberType_status_idx" ON "LibraryMember"("memberType", "status");
CREATE INDEX "LibraryMember_joinedDate_idx" ON "LibraryMember"("joinedDate");
CREATE UNIQUE INDEX "LibraryPolicy_policyCode_key" ON "LibraryPolicy"("policyCode");
CREATE UNIQUE INDEX "LibraryPolicy_active_scope_priority_key" ON "LibraryPolicy"("memberType", IFNULL("className", ''), IFNULL("staffType", ''), "priority") WHERE "status" = 'ACTIVE';
CREATE INDEX "LibraryPolicy_memberType_status_priority_idx" ON "LibraryPolicy"("memberType", "status", "priority");
CREATE INDEX "LibraryPolicy_className_status_idx" ON "LibraryPolicy"("className", "status");
CREATE INDEX "LibraryPolicy_staffType_status_idx" ON "LibraryPolicy"("staffType", "status");
CREATE UNIQUE INDEX "LibraryLoan_loanNumber_key" ON "LibraryLoan"("loanNumber");
CREATE UNIQUE INDEX "LibraryLoan_activeCopyKey_key" ON "LibraryLoan"("activeCopyKey");
CREATE INDEX "LibraryLoan_memberId_status_idx" ON "LibraryLoan"("memberId", "status");
CREATE INDEX "LibraryLoan_copyId_status_idx" ON "LibraryLoan"("copyId", "status");
CREATE INDEX "LibraryLoan_status_dueDate_idx" ON "LibraryLoan"("status", "dueDate");
CREATE INDEX "LibraryLoan_issueDate_idx" ON "LibraryLoan"("issueDate");
CREATE INDEX "LibraryLoan_returnedDate_idx" ON "LibraryLoan"("returnedDate");
CREATE UNIQUE INDEX "LibraryReservation_reservationNumber_key" ON "LibraryReservation"("reservationNumber");
CREATE UNIQUE INDEX "LibraryReservation_activeMemberTitleKey_key" ON "LibraryReservation"("activeMemberTitleKey");
CREATE UNIQUE INDEX "LibraryReservation_fulfilledLoanId_key" ON "LibraryReservation"("fulfilledLoanId");
CREATE INDEX "LibraryReservation_titleId_status_requestedDate_createdAt_idx" ON "LibraryReservation"("titleId", "status", "requestedDate", "createdAt");
CREATE INDEX "LibraryReservation_memberId_status_idx" ON "LibraryReservation"("memberId", "status");
CREATE INDEX "LibraryReservation_status_expiresDate_idx" ON "LibraryReservation"("status", "expiresDate");
CREATE INDEX "LibraryLoanEvent_loanId_eventDate_idx" ON "LibraryLoanEvent"("loanId", "eventDate");
CREATE INDEX "LibraryLoanEvent_reservationId_eventDate_idx" ON "LibraryLoanEvent"("reservationId", "eventDate");
CREATE INDEX "LibraryLoanEvent_memberId_eventDate_idx" ON "LibraryLoanEvent"("memberId", "eventDate");
CREATE INDEX "LibraryLoanEvent_eventType_eventDate_idx" ON "LibraryLoanEvent"("eventType", "eventDate");
