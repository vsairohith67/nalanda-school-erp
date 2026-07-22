-- Prompt 16B: annual budget plans, allocations, and immutable revision snapshots.
CREATE TABLE "BudgetPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "budgetNumber" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "totalAllocatedAmount" DECIMAL NOT NULL DEFAULT 0,
  "warningThresholdPercent" INTEGER NOT NULL DEFAULT 80,
  "criticalThresholdPercent" INTEGER NOT NULL DEFAULT 100,
  "effectiveFrom" DATETIME,
  "effectiveTo" DATETIME,
  "rejectionReason" TEXT,
  "cancellationReason" TEXT,
  "createdByUserId" TEXT,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "lockedByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "submittedAt" DATETIME,
  "approvedAt" DATETIME,
  "lockedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BudgetPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BudgetPlan_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BudgetPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BudgetPlan_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BudgetPlan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BudgetPlan_budgetNumber_key" ON "BudgetPlan"("budgetNumber");
CREATE INDEX "BudgetPlan_academicYear_idx" ON "BudgetPlan"("academicYear");
CREATE INDEX "BudgetPlan_status_idx" ON "BudgetPlan"("status");
CREATE INDEX "BudgetPlan_academicYear_status_idx" ON "BudgetPlan"("academicYear", "status");
CREATE UNIQUE INDEX "BudgetPlan_one_official_per_year" ON "BudgetPlan"("academicYear") WHERE "status" IN ('APPROVED', 'LOCKED');

CREATE TABLE "BudgetAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "budgetPlanId" TEXT NOT NULL,
  "categoryId" TEXT,
  "departmentId" TEXT,
  "allocationKey" TEXT NOT NULL,
  "allocatedAmount" DECIMAL NOT NULL,
  "warningThresholdPercent" INTEGER,
  "criticalThresholdPercent" INTEGER,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BudgetAllocation_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BudgetAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BudgetAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ExpenseDepartment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BudgetAllocation_budgetPlanId_allocationKey_key" ON "BudgetAllocation"("budgetPlanId", "allocationKey");
CREATE INDEX "BudgetAllocation_budgetPlanId_idx" ON "BudgetAllocation"("budgetPlanId");
CREATE INDEX "BudgetAllocation_categoryId_idx" ON "BudgetAllocation"("categoryId");
CREATE INDEX "BudgetAllocation_departmentId_idx" ON "BudgetAllocation"("departmentId");

CREATE TABLE "BudgetRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "budgetPlanId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "previousTotalAmount" DECIMAL NOT NULL,
  "revisedTotalAmount" DECIMAL NOT NULL,
  "revisionData" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "submittedAt" DATETIME,
  "approvedAt" DATETIME,
  "rejectionReason" TEXT,
  "cancellationReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetRevision_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BudgetRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BudgetRevision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BudgetRevision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BudgetRevision_budgetPlanId_revisionNumber_key" ON "BudgetRevision"("budgetPlanId", "revisionNumber");
CREATE INDEX "BudgetRevision_budgetPlanId_status_idx" ON "BudgetRevision"("budgetPlanId", "status");
