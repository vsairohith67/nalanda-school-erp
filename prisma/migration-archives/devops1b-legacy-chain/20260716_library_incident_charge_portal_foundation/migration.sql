-- CreateTable
CREATE TABLE "LibraryIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentNumber" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeCaseKey" TEXT,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "reportedDate" DATETIME NOT NULL,
    "incidentCondition" TEXT,
    "description" TEXT NOT NULL,
    "assessmentNotes" TEXT,
    "resolutionType" TEXT,
    "replacementCopyId" TEXT,
    "resolvedDate" DATETIME,
    "resolutionNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "resolvedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryIncident_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_replacementCopyId_fkey" FOREIGN KEY ("replacementCopyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryChargeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "className" TEXT,
    "staffType" TEXT,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "overdueAmountPerDay" DECIMAL NOT NULL,
    "maximumOverdueAmount" DECIMAL,
    "lostChargeBasis" TEXT NOT NULL DEFAULT 'MANUAL',
    "fixedLostAmount" DECIMAL,
    "damagedChargeBasis" TEXT NOT NULL DEFAULT 'MANUAL',
    "fixedDamagedAmount" DECIMAL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryChargeRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargeNumber" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeOverdueLoanKey" TEXT,
    "memberId" TEXT NOT NULL,
    "loanId" TEXT,
    "incidentId" TEXT,
    "studentId" TEXT,
    "staffMemberId" TEXT,
    "assessedDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "overdueDaysSnapshot" INTEGER,
    "ruleCodeSnapshot" TEXT,
    "rateSnapshot" DECIMAL,
    "originalAmount" DECIMAL NOT NULL,
    "waivedAmount" DECIMAL NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL NOT NULL,
    "assessmentReason" TEXT NOT NULL,
    "waiverReason" TEXT,
    "cancellationReason" TEXT,
    "miscIncomeReceiptId" TEXT,
    "approvedByUserId" TEXT,
    "waivedByUserId" TEXT,
    "collectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdByUserId" TEXT,
    "approvedAt" DATETIME,
    "waivedAt" DATETIME,
    "collectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "LibraryIncident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_miscIncomeReceiptId_fkey" FOREIGN KEY ("miscIncomeReceiptId") REFERENCES "MiscIncomeReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_waivedByUserId_fkey" FOREIGN KEY ("waivedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryChargeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargeId" TEXT,
    "incidentId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "amountSnapshot" DECIMAL,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryChargeEvent_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "LibraryCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryChargeEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "LibraryIncident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryChargeEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIncident_incidentNumber_key" ON "LibraryIncident"("incidentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIncident_activeCaseKey_key" ON "LibraryIncident"("activeCaseKey");

-- CreateIndex
CREATE INDEX "LibraryIncident_status_incidentType_idx" ON "LibraryIncident"("status", "incidentType");

-- CreateIndex
CREATE INDEX "LibraryIncident_loanId_status_idx" ON "LibraryIncident"("loanId", "status");

-- CreateIndex
CREATE INDEX "LibraryIncident_memberId_reportedDate_idx" ON "LibraryIncident"("memberId", "reportedDate");

-- CreateIndex
CREATE INDEX "LibraryIncident_copyId_status_idx" ON "LibraryIncident"("copyId", "status");

-- CreateIndex
CREATE INDEX "LibraryIncident_titleId_status_idx" ON "LibraryIncident"("titleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryChargeRule_ruleCode_key" ON "LibraryChargeRule"("ruleCode");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_memberType_status_priority_idx" ON "LibraryChargeRule"("memberType", "status", "priority");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_className_status_idx" ON "LibraryChargeRule"("className", "status");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_staffType_status_idx" ON "LibraryChargeRule"("staffType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_chargeNumber_key" ON "LibraryCharge"("chargeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_activeOverdueLoanKey_key" ON "LibraryCharge"("activeOverdueLoanKey");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_miscIncomeReceiptId_key" ON "LibraryCharge"("miscIncomeReceiptId");

-- CreateIndex
CREATE INDEX "LibraryCharge_status_chargeType_idx" ON "LibraryCharge"("status", "chargeType");

-- CreateIndex
CREATE INDEX "LibraryCharge_memberId_status_idx" ON "LibraryCharge"("memberId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_loanId_status_idx" ON "LibraryCharge"("loanId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_incidentId_status_idx" ON "LibraryCharge"("incidentId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_studentId_status_idx" ON "LibraryCharge"("studentId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_staffMemberId_status_idx" ON "LibraryCharge"("staffMemberId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_assessedDate_idx" ON "LibraryCharge"("assessedDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_chargeId_eventDate_idx" ON "LibraryChargeEvent"("chargeId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_incidentId_eventDate_idx" ON "LibraryChargeEvent"("incidentId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_eventType_eventDate_idx" ON "LibraryChargeEvent"("eventType", "eventDate");

-- Stable configurable collection items. The Library charge remains the authoritative
-- line amount; these item masters intentionally contain no price or rate.
INSERT OR IGNORE INTO "MiscIncomeItem" ("id", "itemCode", "name", "description", "category", "studentLinkPolicy", "status", "createdAt", "updatedAt")
VALUES ('library-misc-income-student-charge', 'LIB-STUDENT-CHARGE', 'Student Library Charge', 'Exactly-once collection of an approved Student Library charge.', 'LIBRARY_CHARGE', 'REQUIRED', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO "MiscIncomeItem" ("id", "itemCode", "name", "description", "category", "studentLinkPolicy", "status", "createdAt", "updatedAt")
VALUES ('library-misc-income-staff-charge', 'LIB-STAFF-CHARGE', 'Staff Library Charge', 'Exactly-once collection of an approved Staff Library charge.', 'LIBRARY_CHARGE', 'NOT_REQUIRED', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

