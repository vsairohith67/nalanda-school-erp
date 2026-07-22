-- Prompt 16A: expense and vendor foundation. Expense records remain separate from student payments.
CREATE TABLE "Vendor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vendorCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT,
  "mobile" TEXT,
  "alternateMobile" TEXT,
  "email" TEXT,
  "address" TEXT,
  "gstin" TEXT,
  "pan" TEXT,
  "bankName" TEXT,
  "accountLastFour" TEXT,
  "ifsc" TEXT,
  "paymentTermsDays" INTEGER,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Vendor_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");
CREATE INDEX "Vendor_mobile_idx" ON "Vendor"("mobile");
CREATE INDEX "Vendor_gstin_idx" ON "Vendor"("gstin");
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

CREATE TABLE "ExpenseCategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "parentCategoryId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ExpenseCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");
CREATE INDEX "ExpenseCategory_status_idx" ON "ExpenseCategory"("status");
CREATE INDEX "ExpenseCategory_parentCategoryId_idx" ON "ExpenseCategory"("parentCategoryId");

CREATE TABLE "ExpenseDepartment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ExpenseDepartment_name_key" ON "ExpenseDepartment"("name");
CREATE UNIQUE INDEX "ExpenseDepartment_code_key" ON "ExpenseDepartment"("code");
CREATE INDEX "ExpenseDepartment_status_idx" ON "ExpenseDepartment"("status");

CREATE TABLE "ExpenseRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expenseNumber" TEXT NOT NULL,
  "expenseDate" DATETIME NOT NULL,
  "academicYear" TEXT NOT NULL,
  "vendorId" TEXT,
  "categoryId" TEXT NOT NULL,
  "departmentId" TEXT,
  "description" TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "invoiceDate" DATETIME,
  "grossAmount" DECIMAL NOT NULL,
  "taxAmount" DECIMAL NOT NULL DEFAULT 0,
  "deductionAmount" DECIMAL NOT NULL DEFAULT 0,
  "netAmount" DECIMAL NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "transactionReference" TEXT,
  "chequeNumber" TEXT,
  "chequeDate" DATETIME,
  "paidDate" DATETIME,
  "notes" TEXT,
  "rejectionReason" TEXT,
  "cancellationReason" TEXT,
  "createdByUserId" TEXT,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "paidByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "submittedAt" DATETIME,
  "approvedAt" DATETIME,
  "paidAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ExpenseRecord_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExpenseRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExpenseRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ExpenseDepartment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExpenseRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExpenseRecord_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExpenseRecord_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExpenseRecord_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExpenseRecord_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExpenseRecord_expenseNumber_key" ON "ExpenseRecord"("expenseNumber");
CREATE INDEX "ExpenseRecord_expenseDate_idx" ON "ExpenseRecord"("expenseDate");
CREATE INDEX "ExpenseRecord_academicYear_idx" ON "ExpenseRecord"("academicYear");
CREATE INDEX "ExpenseRecord_vendorId_idx" ON "ExpenseRecord"("vendorId");
CREATE INDEX "ExpenseRecord_categoryId_idx" ON "ExpenseRecord"("categoryId");
CREATE INDEX "ExpenseRecord_departmentId_idx" ON "ExpenseRecord"("departmentId");
CREATE INDEX "ExpenseRecord_approvalStatus_idx" ON "ExpenseRecord"("approvalStatus");
CREATE INDEX "ExpenseRecord_paymentStatus_idx" ON "ExpenseRecord"("paymentStatus");

CREATE TABLE "ExpensePayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expenseRecordId" TEXT NOT NULL,
  "paymentDate" DATETIME NOT NULL,
  "amount" DECIMAL NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "transactionReference" TEXT,
  "chequeNumber" TEXT,
  "chequeDate" DATETIME,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpensePayment_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExpensePayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ExpensePayment_expenseRecordId_paymentDate_idx" ON "ExpensePayment"("expenseRecordId", "paymentDate");

CREATE TABLE "ExpenseAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expenseRecordId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "detailsJson" TEXT,
  "actorUserId" TEXT,
  "actorName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseAudit_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExpenseAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ExpenseAudit_expenseRecordId_createdAt_idx" ON "ExpenseAudit"("expenseRecordId", "createdAt");

INSERT INTO "ExpenseCategory" ("id", "name", "code", "status", "createdAt", "updatedAt") VALUES
  ('exp-cat-salaries-staff', 'Salaries & Staff', 'SALARIES', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-electricity', 'Electricity', 'ELECTRICITY', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-water', 'Water', 'WATER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-internet', 'Internet/Telephone', 'INTERNET', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-rent', 'Rent', 'RENT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-maintenance', 'Maintenance & Repairs', 'MAINTENANCE', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-stationery', 'Stationery', 'STATIONERY', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-books', 'Books & Academic Materials', 'BOOKS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-transport', 'Transport', 'TRANSPORT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-events', 'Events & Activities', 'EVENTS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-sports', 'Sports', 'SPORTS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-technology', 'Technology/Software', 'TECHNOLOGY', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-professional', 'Professional Fees', 'PROFESSIONAL', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-compliance', 'Government/Compliance Fees', 'COMPLIANCE', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-cat-misc', 'Miscellaneous', 'MISC', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "ExpenseDepartment" ("id", "name", "code", "status", "createdAt", "updatedAt") VALUES
  ('exp-dept-academics', 'Academics', 'ACADEMICS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-dept-administration', 'Administration', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-dept-maintenance', 'Maintenance', 'MAINT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-dept-transport', 'Transport', 'TRANSPORT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-dept-library', 'Library', 'LIBRARY', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-dept-sports', 'Sports', 'SPORTS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-dept-technology', 'Technology', 'TECH', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-dept-general', 'General', 'GENERAL', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
