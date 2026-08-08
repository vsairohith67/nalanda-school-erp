-- CreateTable
CREATE TABLE "PayrollPolicyVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "policyCode" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "prorationBasis" TEXT NOT NULL DEFAULT 'CALENDAR_DAYS',
    "unpaidLeaveRule" TEXT NOT NULL DEFAULT 'APPROVED_UNPAID_LEAVE_ONLY',
    "halfDayRule" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "defaultRoundingRule" TEXT NOT NULL DEFAULT 'NEAREST_PAISE',
    "requiredAttendanceRule" TEXT NOT NULL DEFAULT 'EXPLICIT_REQUIRED_DATES',
    "approvalReference" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalaryStructureVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "structureCode" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "policyVersionId" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "approvalReference" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "estimatedGrossPaise" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryStructureVersion_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PayrollPolicyVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryComponentDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "structureVersionId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "calculationMode" TEXT NOT NULL,
    "calculationRule" TEXT NOT NULL DEFAULT 'STANDARD',
    "defaultAmountPaise" INTEGER,
    "percentageBasisPoints" INTEGER,
    "percentageBaseCode" TEXT,
    "prorationRule" TEXT NOT NULL DEFAULT 'FULL_PERIOD',
    "roundingRule" TEXT NOT NULL DEFAULT 'NEAREST_PAISE',
    "statutoryTreatment" TEXT NOT NULL DEFAULT 'NOT_STATUTORY',
    "payslipVisible" BOOLEAN NOT NULL DEFAULT true,
    "accountingBehavior" TEXT NOT NULL DEFAULT 'PREVIEW_ONLY',
    "exportBehavior" TEXT NOT NULL DEFAULT 'ALLOWLISTED_SUMMARY',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryComponentDefinition_structureVersionId_fkey" FOREIGN KEY ("structureVersionId") REFERENCES "SalaryStructureVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryComponentDefinition_amount_check" CHECK ("defaultAmountPaise" IS NULL OR "defaultAmountPaise" >= 0),
    CONSTRAINT "SalaryComponentDefinition_percentage_check" CHECK ("percentageBasisPoints" IS NULL OR ("percentageBasisPoints" >= 0 AND "percentageBasisPoints" <= 100000)),
    CONSTRAINT "SalaryComponentDefinition_statutory_check" CHECK ("statutoryTreatment" != 'MANUAL_OR_EXTERNALLY_APPROVED' OR "calculationMode" = 'MANUAL')
);

-- CreateTable
CREATE TABLE "StaffCompensationAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "structureVersionId" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "payrollEligibleFrom" DATETIME NOT NULL,
    "payrollEligibleTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" DATETIME NOT NULL,
    "endReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffCompensationAssignment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffCompensationAssignment_structureVersionId_fkey" FOREIGN KEY ("structureVersionId") REFERENCES "SalaryStructureVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffCompensationAssignment_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
    CONSTRAINT "StaffCompensationAssignment_eligibility_check" CHECK ("payrollEligibleTo" IS NULL OR "payrollEligibleTo" >= "payrollEligibleFrom")
);

-- CreateTable
CREATE TABLE "SalaryRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "previousAssignmentId" TEXT,
    "newAssignmentId" TEXT NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "oldGrossPaise" INTEGER NOT NULL,
    "newGrossPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approvedAt" DATETIME NOT NULL,
    "cancellationReason" TEXT,
    "cancelledAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryRevision_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryRevision_previousAssignmentId_fkey" FOREIGN KEY ("previousAssignmentId") REFERENCES "StaffCompensationAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryRevision_newAssignmentId_fkey" FOREIGN KEY ("newAssignmentId") REFERENCES "StaffCompensationAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryRevision_amounts_check" CHECK ("oldGrossPaise" >= 0 AND "newGrossPaise" >= 0)
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "payrollMonth" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requiredAttendanceDatesJson" TEXT NOT NULL DEFAULT '[]',
    "inputApprovalReference" TEXT,
    "inputsLockedByUserId" TEXT,
    "inputsLockedAt" DATETIME,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollPeriod_dates_check" CHECK ("endDate" >= "startDate")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "runType" TEXT NOT NULL DEFAULT 'REGULAR',
    "sequenceNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeKey" TEXT,
    "sourceRunId" TEXT,
    "manualAdjustmentsJson" TEXT NOT NULL DEFAULT '[]',
    "inputSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "exceptionsJson" TEXT NOT NULL DEFAULT '[]',
    "formulaPreviewJson" TEXT NOT NULL DEFAULT '{}',
    "financePostingStatus" TEXT NOT NULL DEFAULT 'DISABLED',
    "financePostingPreviewJson" TEXT NOT NULL DEFAULT '{}',
    "totalGrossPaise" INTEGER NOT NULL DEFAULT 0,
    "totalDeductionPaise" INTEGER NOT NULL DEFAULT 0,
    "totalReimbursementPaise" INTEGER NOT NULL DEFAULT 0,
    "totalNetPaise" INTEGER NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "preparedByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "payslipsIssuedByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "payslipsIssuedAt" DATETIME,
    "reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollRun_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PayrollPolicyVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollRun_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "PayrollRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollRun_totals_check" CHECK ("totalGrossPaise" >= 0 AND "totalDeductionPaise" >= 0 AND "totalReimbursementPaise" >= 0 AND "totalNetPaise" >= 0 AND "employeeCount" >= 0 AND "exceptionCount" >= 0),
    CONSTRAINT "PayrollRun_finance_boundary_check" CHECK ("financePostingStatus" IN ('DISABLED', 'PREVIEW_ONLY'))
);

-- CreateTable
CREATE TABLE "EmployeePayrollResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "compensationAssignmentId" TEXT NOT NULL,
    "salaryRevisionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "eligibleDays" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "unpaidLeaveUnits" INTEGER NOT NULL DEFAULT 0,
    "halfDayUnits" INTEGER NOT NULL DEFAULT 0,
    "attendanceSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "sourceVersionsJson" TEXT NOT NULL DEFAULT '{}',
    "formulaSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "grossPaise" INTEGER NOT NULL DEFAULT 0,
    "deductionPaise" INTEGER NOT NULL DEFAULT 0,
    "reimbursementPaise" INTEGER NOT NULL DEFAULT 0,
    "netPaise" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeePayrollResult_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePayrollResult_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePayrollResult_compensationAssignmentId_fkey" FOREIGN KEY ("compensationAssignmentId") REFERENCES "StaffCompensationAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePayrollResult_salaryRevisionId_fkey" FOREIGN KEY ("salaryRevisionId") REFERENCES "SalaryRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePayrollResult_totals_check" CHECK ("eligibleDays" >= 0 AND "periodDays" > 0 AND "unpaidLeaveUnits" >= 0 AND "halfDayUnits" >= 0 AND "grossPaise" >= 0 AND "deductionPaise" >= 0 AND "reimbursementPaise" >= 0 AND "netPaise" >= 0)
);

-- CreateTable
CREATE TABLE "PayrollComponentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeePayrollResultId" TEXT NOT NULL,
    "componentDefinitionId" TEXT,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "baseAmountPaise" INTEGER,
    "percentageBasisPoints" INTEGER,
    "roundingRule" TEXT NOT NULL,
    "formulaText" TEXT NOT NULL,
    "sourceVersionReference" TEXT NOT NULL,
    "payslipVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollComponentResult_employeePayrollResultId_fkey" FOREIGN KEY ("employeePayrollResultId") REFERENCES "EmployeePayrollResult" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollComponentResult_componentDefinitionId_fkey" FOREIGN KEY ("componentDefinitionId") REFERENCES "SalaryComponentDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollComponentResult_amount_check" CHECK ("amountPaise" >= 0)
);

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "requestSource" TEXT NOT NULL DEFAULT 'STAFF_REQUEST',
    "requestedAmountPaise" INTEGER NOT NULL,
    "requestedReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "approvedAmountPaise" INTEGER,
    "remainingBalancePaise" INTEGER NOT NULL DEFAULT 0,
    "approvalReason" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "rejectedByUserId" TEXT,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryAdvance_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryAdvance_amount_check" CHECK ("requestedAmountPaise" > 0 AND ("approvedAmountPaise" IS NULL OR "approvedAmountPaise" > 0) AND "remainingBalancePaise" >= 0 AND ("approvedAmountPaise" IS NULL OR "remainingBalancePaise" <= "approvedAmountPaise"))
);

-- CreateTable
CREATE TABLE "AdvanceRecoverySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "salaryAdvanceId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "payrollPeriodId" TEXT,
    "scheduledAmountPaise" INTEGER NOT NULL,
    "recoveredAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "revisionReason" TEXT,
    "employeePayrollResultId" TEXT,
    "recoveredAt" DATETIME,
    "reversedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdvanceRecoverySchedule_salaryAdvanceId_fkey" FOREIGN KEY ("salaryAdvanceId") REFERENCES "SalaryAdvance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdvanceRecoverySchedule_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdvanceRecoverySchedule_employeePayrollResultId_fkey" FOREIGN KEY ("employeePayrollResultId") REFERENCES "EmployeePayrollResult" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdvanceRecoverySchedule_amount_check" CHECK ("scheduledAmountPaise" > 0 AND "recoveredAmountPaise" >= 0 AND "recoveredAmountPaise" <= "scheduledAmountPaise")
);

-- CreateTable
CREATE TABLE "PayslipVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "employeePayrollResultId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "snapshotJson" TEXT NOT NULL,
    "snapshotSha256" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "supersedesPayslipId" TEXT,
    "correctionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayslipVersion_employeePayrollResultId_fkey" FOREIGN KEY ("employeePayrollResultId") REFERENCES "EmployeePayrollResult" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayslipVersion_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayslipVersion_supersedesPayslipId_fkey" FOREIGN KEY ("supersedesPayslipId") REFERENCES "PayslipVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityPublicKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT,
    "safeSnapshotJson" TEXT,
    "requestKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollEvent_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPolicyVersion_publicKey_key" ON "PayrollPolicyVersion"("publicKey");

-- CreateIndex
CREATE INDEX "PayrollPolicyVersion_status_effectiveFrom_effectiveTo_idx" ON "PayrollPolicyVersion"("status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPolicyVersion_policyCode_versionNumber_key" ON "PayrollPolicyVersion"("policyCode", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureVersion_publicKey_key" ON "SalaryStructureVersion"("publicKey");

-- CreateIndex
CREATE INDEX "SalaryStructureVersion_status_effectiveFrom_effectiveTo_idx" ON "SalaryStructureVersion"("status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SalaryStructureVersion_policyVersionId_idx" ON "SalaryStructureVersion"("policyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureVersion_structureCode_versionNumber_key" ON "SalaryStructureVersion"("structureCode", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponentDefinition_publicKey_key" ON "SalaryComponentDefinition"("publicKey");

-- CreateIndex
CREATE INDEX "SalaryComponentDefinition_classification_calculationMode_idx" ON "SalaryComponentDefinition"("classification", "calculationMode");

-- CreateIndex
CREATE INDEX "SalaryComponentDefinition_effectiveFrom_effectiveTo_idx" ON "SalaryComponentDefinition"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponentDefinition_structureVersionId_componentCode_key" ON "SalaryComponentDefinition"("structureVersionId", "componentCode");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCompensationAssignment_publicKey_key" ON "StaffCompensationAssignment"("publicKey");

-- CreateIndex
CREATE INDEX "StaffCompensationAssignment_staffMemberId_effectiveFrom_effectiveTo_idx" ON "StaffCompensationAssignment"("staffMemberId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "StaffCompensationAssignment_status_payrollEligibleFrom_payrollEligibleTo_idx" ON "StaffCompensationAssignment"("status", "payrollEligibleFrom", "payrollEligibleTo");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRevision_publicKey_key" ON "SalaryRevision"("publicKey");

-- CreateIndex
CREATE INDEX "SalaryRevision_staffMemberId_effectiveDate_idx" ON "SalaryRevision"("staffMemberId", "effectiveDate");

-- CreateIndex
CREATE INDEX "SalaryRevision_status_effectiveDate_idx" ON "SalaryRevision"("status", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_publicKey_key" ON "PayrollPeriod"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_periodCode_key" ON "PayrollPeriod"("periodCode");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_startDate_endDate_idx" ON "PayrollPeriod"("status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_publicKey_key" ON "PayrollRun"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_runNumber_key" ON "PayrollRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_requestKey_key" ON "PayrollRun"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_activeKey_key" ON "PayrollRun"("activeKey");

-- CreateIndex
CREATE INDEX "PayrollRun_periodId_status_idx" ON "PayrollRun"("periodId", "status");

-- CreateIndex
CREATE INDEX "PayrollRun_status_createdAt_idx" ON "PayrollRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollRun_sourceRunId_idx" ON "PayrollRun"("sourceRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_periodId_sequenceNumber_key" ON "PayrollRun"("periodId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollResult_publicKey_key" ON "EmployeePayrollResult"("publicKey");

-- CreateIndex
CREATE INDEX "EmployeePayrollResult_staffMemberId_createdAt_idx" ON "EmployeePayrollResult"("staffMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeePayrollResult_status_idx" ON "EmployeePayrollResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollResult_payrollRunId_staffMemberId_key" ON "EmployeePayrollResult"("payrollRunId", "staffMemberId");

-- CreateIndex
CREATE INDEX "PayrollComponentResult_componentCode_classification_idx" ON "PayrollComponentResult"("componentCode", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponentResult_employeePayrollResultId_componentCode_key" ON "PayrollComponentResult"("employeePayrollResultId", "componentCode");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvance_publicKey_key" ON "SalaryAdvance"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvance_advanceNumber_key" ON "SalaryAdvance"("advanceNumber");

-- CreateIndex
CREATE INDEX "SalaryAdvance_staffMemberId_status_idx" ON "SalaryAdvance"("staffMemberId", "status");

-- CreateIndex
CREATE INDEX "SalaryAdvance_status_createdAt_idx" ON "SalaryAdvance"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRecoverySchedule_publicKey_key" ON "AdvanceRecoverySchedule"("publicKey");

-- CreateIndex
CREATE INDEX "AdvanceRecoverySchedule_employeePayrollResultId_idx" ON "AdvanceRecoverySchedule"("employeePayrollResultId");

-- CreateIndex
CREATE INDEX "AdvanceRecoverySchedule_payrollPeriodId_status_idx" ON "AdvanceRecoverySchedule"("payrollPeriodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRecoverySchedule_salaryAdvanceId_sequenceNumber_key" ON "AdvanceRecoverySchedule"("salaryAdvanceId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipVersion_publicKey_key" ON "PayslipVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipVersion_reference_key" ON "PayslipVersion"("reference");

-- CreateIndex
CREATE INDEX "PayslipVersion_staffMemberId_issueDate_idx" ON "PayslipVersion"("staffMemberId", "issueDate");

-- CreateIndex
CREATE INDEX "PayslipVersion_status_idx" ON "PayslipVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipVersion_employeePayrollResultId_versionNumber_key" ON "PayslipVersion"("employeePayrollResultId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEvent_publicKey_key" ON "PayrollEvent"("publicKey");

-- CreateIndex
CREATE INDEX "PayrollEvent_payrollRunId_createdAt_idx" ON "PayrollEvent"("payrollRunId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollEvent_entityType_entityPublicKey_createdAt_idx" ON "PayrollEvent"("entityType", "entityPublicKey", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollEvent_eventType_createdAt_idx" ON "PayrollEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollEvent_requestKey_idx" ON "PayrollEvent"("requestKey");

-- Approved salary and payroll history is retained through versioning. Draft calculations
-- may be replaced before review, but approved results, payslips, advances and audit events
-- cannot be hard-deleted.
CREATE TRIGGER "SalaryStructureVersion_no_approved_update"
BEFORE UPDATE ON "SalaryStructureVersion"
FOR EACH ROW WHEN OLD."status" IN ('ACTIVE', 'ARCHIVED')
BEGIN SELECT RAISE(ABORT, 'Approved salary structure versions are immutable'); END;

CREATE TRIGGER "SalaryStructureVersion_no_approved_delete"
BEFORE DELETE ON "SalaryStructureVersion"
FOR EACH ROW WHEN OLD."status" IN ('ACTIVE', 'ARCHIVED')
BEGIN SELECT RAISE(ABORT, 'Approved salary structure versions cannot be deleted'); END;

CREATE TRIGGER "SalaryComponentDefinition_no_locked_update"
BEFORE UPDATE ON "SalaryComponentDefinition"
FOR EACH ROW WHEN EXISTS (SELECT 1 FROM "SalaryStructureVersion" s WHERE s."id" = OLD."structureVersionId" AND s."status" IN ('ACTIVE', 'ARCHIVED'))
BEGIN SELECT RAISE(ABORT, 'Components of approved salary structures are immutable'); END;

CREATE TRIGGER "SalaryComponentDefinition_no_locked_delete"
BEFORE DELETE ON "SalaryComponentDefinition"
FOR EACH ROW WHEN EXISTS (SELECT 1 FROM "SalaryStructureVersion" s WHERE s."id" = OLD."structureVersionId" AND s."status" IN ('ACTIVE', 'ARCHIVED'))
BEGIN SELECT RAISE(ABORT, 'Components of approved salary structures cannot be deleted'); END;

CREATE TRIGGER "SalaryRevision_no_update"
BEFORE UPDATE ON "SalaryRevision"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Salary revisions are append-only'); END;

CREATE TRIGGER "SalaryRevision_no_delete"
BEFORE DELETE ON "SalaryRevision"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Salary revisions cannot be deleted'); END;

CREATE TRIGGER "PayrollRun_no_approved_delete"
BEFORE DELETE ON "PayrollRun"
FOR EACH ROW WHEN OLD."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED')
BEGIN SELECT RAISE(ABORT, 'Approved payroll runs cannot be deleted'); END;

CREATE TRIGGER "EmployeePayrollResult_no_approved_update"
BEFORE UPDATE ON "EmployeePayrollResult"
FOR EACH ROW WHEN EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."id" = OLD."payrollRunId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))
BEGIN SELECT RAISE(ABORT, 'Approved payroll results are immutable'); END;

CREATE TRIGGER "EmployeePayrollResult_no_approved_delete"
BEFORE DELETE ON "EmployeePayrollResult"
FOR EACH ROW WHEN EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."id" = OLD."payrollRunId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))
BEGIN SELECT RAISE(ABORT, 'Approved payroll results cannot be deleted'); END;

CREATE TRIGGER "PayrollComponentResult_no_approved_update"
BEFORE UPDATE ON "PayrollComponentResult"
FOR EACH ROW WHEN EXISTS (SELECT 1 FROM "EmployeePayrollResult" e JOIN "PayrollRun" r ON r."id" = e."payrollRunId" WHERE e."id" = OLD."employeePayrollResultId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))
BEGIN SELECT RAISE(ABORT, 'Approved payroll components are immutable'); END;

CREATE TRIGGER "PayrollComponentResult_no_approved_delete"
BEFORE DELETE ON "PayrollComponentResult"
FOR EACH ROW WHEN EXISTS (SELECT 1 FROM "EmployeePayrollResult" e JOIN "PayrollRun" r ON r."id" = e."payrollRunId" WHERE e."id" = OLD."employeePayrollResultId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))
BEGIN SELECT RAISE(ABORT, 'Approved payroll components cannot be deleted'); END;

CREATE TRIGGER "PayslipVersion_no_update"
BEFORE UPDATE ON "PayslipVersion"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Issued payslip versions are immutable'); END;

CREATE TRIGGER "PayslipVersion_no_delete"
BEFORE DELETE ON "PayslipVersion"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Issued payslip versions cannot be deleted'); END;

CREATE TRIGGER "SalaryAdvance_no_delete"
BEFORE DELETE ON "SalaryAdvance"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Salary advances cannot be deleted'); END;

CREATE TRIGGER "AdvanceRecoverySchedule_no_delete"
BEFORE DELETE ON "AdvanceRecoverySchedule"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Advance recovery history cannot be deleted'); END;

CREATE TRIGGER "PayrollEvent_no_update"
BEFORE UPDATE ON "PayrollEvent"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Payroll audit events are append-only'); END;

CREATE TRIGGER "PayrollEvent_no_delete"
BEFORE DELETE ON "PayrollEvent"
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'Payroll audit events cannot be deleted'); END;
