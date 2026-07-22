CREATE TABLE "LibraryTitle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "titleCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "authors" TEXT NOT NULL,
  "isbn" TEXT,
  "edition" TEXT,
  "publisherName" TEXT,
  "publisherVendorId" TEXT,
  "publicationYear" INTEGER,
  "language" TEXT,
  "subject" TEXT,
  "category" TEXT,
  "classificationNumber" TEXT,
  "defaultShelfCode" TEXT,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryTitle_publisherVendorId_fkey" FOREIGN KEY ("publisherVendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryTitle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "LibraryCopy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "titleId" TEXT NOT NULL,
  "accessionNumber" TEXT NOT NULL,
  "barcodeValue" TEXT,
  "acquisitionDate" DATETIME,
  "acquisitionType" TEXT NOT NULL DEFAULT 'OTHER',
  "acquisitionCost" DECIMAL,
  "vendorId" TEXT,
  "expenseRecordId" TEXT,
  "donorName" TEXT,
  "invoiceNumberSnapshot" TEXT,
  "condition" TEXT NOT NULL DEFAULT 'GOOD',
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "shelfCode" TEXT,
  "notes" TEXT,
  "withdrawnDate" DATETIME,
  "withdrawalReason" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryCopy_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryCopy_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryCopy_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryCopy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryCopy_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "LibraryCopyEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "copyId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "previousCondition" TEXT,
  "newCondition" TEXT,
  "previousShelfCode" TEXT,
  "newShelfCode" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryCopyEvent_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryCopyEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LibraryTitle_titleCode_key" ON "LibraryTitle"("titleCode");
CREATE UNIQUE INDEX "LibraryTitle_isbn_key" ON "LibraryTitle"("isbn");
CREATE INDEX "LibraryTitle_title_idx" ON "LibraryTitle"("title");
CREATE INDEX "LibraryTitle_authors_idx" ON "LibraryTitle"("authors");
CREATE INDEX "LibraryTitle_publisherVendorId_idx" ON "LibraryTitle"("publisherVendorId");
CREATE INDEX "LibraryTitle_status_language_idx" ON "LibraryTitle"("status", "language");
CREATE INDEX "LibraryTitle_subject_category_idx" ON "LibraryTitle"("subject", "category");
CREATE UNIQUE INDEX "LibraryCopy_accessionNumber_key" ON "LibraryCopy"("accessionNumber");
CREATE UNIQUE INDEX "LibraryCopy_barcodeValue_key" ON "LibraryCopy"("barcodeValue");
CREATE INDEX "LibraryCopy_titleId_status_idx" ON "LibraryCopy"("titleId", "status");
CREATE INDEX "LibraryCopy_condition_idx" ON "LibraryCopy"("condition");
CREATE INDEX "LibraryCopy_shelfCode_idx" ON "LibraryCopy"("shelfCode");
CREATE INDEX "LibraryCopy_vendorId_idx" ON "LibraryCopy"("vendorId");
CREATE INDEX "LibraryCopy_expenseRecordId_idx" ON "LibraryCopy"("expenseRecordId");
CREATE INDEX "LibraryCopy_acquisitionType_idx" ON "LibraryCopy"("acquisitionType");
CREATE INDEX "LibraryCopyEvent_copyId_eventDate_idx" ON "LibraryCopyEvent"("copyId", "eventDate");
CREATE INDEX "LibraryCopyEvent_eventType_idx" ON "LibraryCopyEvent"("eventType");
CREATE INDEX "LibraryCopyEvent_recordedByUserId_idx" ON "LibraryCopyEvent"("recordedByUserId");
