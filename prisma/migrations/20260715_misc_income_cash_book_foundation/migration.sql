-- CreateTable
CREATE TABLE "MiscIncomeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "studentLinkPolicy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MiscIncomeItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MiscIncomeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MiscIncomeRate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MiscIncomeItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "MiscIncomeReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "studentId" TEXT,
    "payerName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "receivedAccount" TEXT,
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" DATETIME,
    "grossAmount" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "netAmount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MiscIncomeReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceipt_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MiscIncomeReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "rateId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitAmount" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiscIncomeReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MiscIncomeReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MiscIncomeItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceiptLine_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "MiscIncomeRate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CashBookDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "openingBalance" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "feeCashSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "miscIncomeCashSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "cashExpenseSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "manualInflowSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "manualOutflowSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "bankDepositSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "directorHandoverSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "calculatedClosingBalance" DECIMAL NOT NULL DEFAULT 0,
    "countedClosingBalance" DECIMAL,
    "varianceAmount" DECIMAL,
    "sourceSummarySnapshot" TEXT,
    "notes" TEXT,
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
    CONSTRAINT "CashBookDay_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CashBookMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashBookDayId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "movementDate" DATETIME NOT NULL,
    "referenceNumber" TEXT,
    "bankName" TEXT,
    "recipientName" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashBookMovement_cashBookDayId_fkey" FOREIGN KEY ("cashBookDayId") REFERENCES "CashBookDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashBookMovement_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookMovement_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MiscIncomeItem_itemCode_key" ON "MiscIncomeItem"("itemCode");
CREATE INDEX "MiscIncomeItem_category_idx" ON "MiscIncomeItem"("category");
CREATE INDEX "MiscIncomeItem_status_idx" ON "MiscIncomeItem"("status");
CREATE INDEX "MiscIncomeRate_itemId_academicYear_status_idx" ON "MiscIncomeRate"("itemId", "academicYear", "status");
CREATE INDEX "MiscIncomeRate_academicYear_idx" ON "MiscIncomeRate"("academicYear");
CREATE UNIQUE INDEX "MiscIncomeReceipt_receiptNumber_key" ON "MiscIncomeReceipt"("receiptNumber");
CREATE INDEX "MiscIncomeReceipt_receiptDate_idx" ON "MiscIncomeReceipt"("receiptDate");
CREATE INDEX "MiscIncomeReceipt_academicYear_idx" ON "MiscIncomeReceipt"("academicYear");
CREATE INDEX "MiscIncomeReceipt_studentId_idx" ON "MiscIncomeReceipt"("studentId");
CREATE INDEX "MiscIncomeReceipt_paymentMethod_idx" ON "MiscIncomeReceipt"("paymentMethod");
CREATE INDEX "MiscIncomeReceipt_receivedAccount_idx" ON "MiscIncomeReceipt"("receivedAccount");
CREATE INDEX "MiscIncomeReceipt_status_idx" ON "MiscIncomeReceipt"("status");
CREATE INDEX "MiscIncomeReceiptLine_receiptId_idx" ON "MiscIncomeReceiptLine"("receiptId");
CREATE INDEX "MiscIncomeReceiptLine_itemId_idx" ON "MiscIncomeReceiptLine"("itemId");
CREATE INDEX "MiscIncomeReceiptLine_rateId_idx" ON "MiscIncomeReceiptLine"("rateId");
CREATE UNIQUE INDEX "CashBookDay_cashDate_key" ON "CashBookDay"("cashDate");
CREATE INDEX "CashBookDay_academicYear_idx" ON "CashBookDay"("academicYear");
CREATE INDEX "CashBookDay_status_idx" ON "CashBookDay"("status");
CREATE INDEX "CashBookMovement_cashBookDayId_status_idx" ON "CashBookMovement"("cashBookDayId", "status");
CREATE INDEX "CashBookMovement_movementDate_idx" ON "CashBookMovement"("movementDate");
CREATE INDEX "CashBookMovement_movementType_idx" ON "CashBookMovement"("movementType");
