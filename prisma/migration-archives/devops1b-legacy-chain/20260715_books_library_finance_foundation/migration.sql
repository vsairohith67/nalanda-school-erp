ALTER TABLE "CashBookDay" ADD COLUMN "bookSalesCashSnapshot" DECIMAL NOT NULL DEFAULT 0;

CREATE TABLE "BookCatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "publisherVendorId" TEXT,
    "className" TEXT,
    "subject" TEXT,
    "description" TEXT,
    "studentLinkRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCatalogItem_publisherVendorId_fkey" FOREIGN KEY ("publisherVendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookCatalogItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BookCatalogRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCatalogRate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BookCatalogItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BookSaleReceipt" (
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
    CONSTRAINT "BookSaleReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceipt_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BookSaleReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCodeSnapshot" TEXT NOT NULL,
    "itemTitleSnapshot" TEXT NOT NULL,
    "classNameSnapshot" TEXT,
    "publisherNameSnapshot" TEXT,
    "rateId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitAmount" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookSaleReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "BookSaleReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BookCatalogItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceiptLine_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "BookCatalogRate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BookCashSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedBookCash" DECIMAL NOT NULL DEFAULT 0,
    "handedToDirectorAmount" DECIMAL NOT NULL DEFAULT 0,
    "handedToCashCounterAmount" DECIMAL NOT NULL DEFAULT 0,
    "retainedByBooksInchargeAmount" DECIMAL NOT NULL DEFAULT 0,
    "varianceAmount" DECIMAL NOT NULL DEFAULT 0,
    "varianceReason" TEXT,
    "booksInchargeName" TEXT,
    "receiverName" TEXT,
    "cashBookMovementId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCashSettlement_cashBookMovementId_fkey" FOREIGN KEY ("cashBookMovementId") REFERENCES "CashBookMovement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BookCatalogItem_itemCode_key" ON "BookCatalogItem"("itemCode");
CREATE INDEX "BookCatalogItem_itemType_idx" ON "BookCatalogItem"("itemType");
CREATE INDEX "BookCatalogItem_publisherVendorId_idx" ON "BookCatalogItem"("publisherVendorId");
CREATE INDEX "BookCatalogItem_className_idx" ON "BookCatalogItem"("className");
CREATE INDEX "BookCatalogItem_status_idx" ON "BookCatalogItem"("status");
CREATE INDEX "BookCatalogRate_itemId_academicYear_status_idx" ON "BookCatalogRate"("itemId", "academicYear", "status");
CREATE INDEX "BookCatalogRate_academicYear_idx" ON "BookCatalogRate"("academicYear");
CREATE UNIQUE INDEX "BookSaleReceipt_receiptNumber_key" ON "BookSaleReceipt"("receiptNumber");
CREATE INDEX "BookSaleReceipt_receiptDate_idx" ON "BookSaleReceipt"("receiptDate");
CREATE INDEX "BookSaleReceipt_academicYear_idx" ON "BookSaleReceipt"("academicYear");
CREATE INDEX "BookSaleReceipt_studentId_idx" ON "BookSaleReceipt"("studentId");
CREATE INDEX "BookSaleReceipt_paymentMethod_idx" ON "BookSaleReceipt"("paymentMethod");
CREATE INDEX "BookSaleReceipt_receivedAccount_idx" ON "BookSaleReceipt"("receivedAccount");
CREATE INDEX "BookSaleReceipt_status_idx" ON "BookSaleReceipt"("status");
CREATE INDEX "BookSaleReceiptLine_receiptId_idx" ON "BookSaleReceiptLine"("receiptId");
CREATE INDEX "BookSaleReceiptLine_itemId_idx" ON "BookSaleReceiptLine"("itemId");
CREATE INDEX "BookSaleReceiptLine_rateId_idx" ON "BookSaleReceiptLine"("rateId");
CREATE UNIQUE INDEX "BookCashSettlement_settlementDate_key" ON "BookCashSettlement"("settlementDate");
CREATE UNIQUE INDEX "BookCashSettlement_cashBookMovementId_key" ON "BookCashSettlement"("cashBookMovementId");
CREATE INDEX "BookCashSettlement_academicYear_idx" ON "BookCashSettlement"("academicYear");
CREATE INDEX "BookCashSettlement_status_idx" ON "BookCashSettlement"("status");
