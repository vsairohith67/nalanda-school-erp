CREATE TABLE "LibraryStockVerificationSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "verificationDate" DATETIME NOT NULL,
  "scopeType" TEXT NOT NULL,
  "shelfCodeFilter" TEXT,
  "titleIdFilter" TEXT,
  "categoryFilter" TEXT,
  "subjectFilter" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "expectedCopyCount" INTEGER NOT NULL DEFAULT 0,
  "verifiedCopyCount" INTEGER NOT NULL DEFAULT 0,
  "presentCount" INTEGER NOT NULL DEFAULT 0,
  "issuedOffsiteCount" INTEGER NOT NULL DEFAULT 0,
  "knownRepairCount" INTEGER NOT NULL DEFAULT 0,
  "missingCount" INTEGER NOT NULL DEFAULT 0,
  "misShelvedCount" INTEGER NOT NULL DEFAULT 0,
  "damagedCount" INTEGER NOT NULL DEFAULT 0,
  "unexpectedCount" INTEGER NOT NULL DEFAULT 0,
  "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT, "cancellationReason" TEXT,
  "createdByUserId" TEXT, "startedByUserId" TEXT, "submittedByUserId" TEXT,
  "reviewedByUserId" TEXT, "approvedByUserId" TEXT, "lockedByUserId" TEXT, "cancelledByUserId" TEXT,
  "startedAt" DATETIME, "submittedAt" DATETIME, "reviewedAt" DATETIME,
  "approvedAt" DATETIME, "lockedAt" DATETIME, "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryStockVerificationSession_titleIdFilter_fkey" FOREIGN KEY ("titleIdFilter") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationSession_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationSession_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationSession_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationSession_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LibraryStockVerificationSession_sessionNumber_key" ON "LibraryStockVerificationSession"("sessionNumber");
CREATE INDEX "LibraryStockVerificationSession_academicYear_status_idx" ON "LibraryStockVerificationSession"("academicYear", "status");
CREATE INDEX "LibraryStockVerificationSession_verificationDate_idx" ON "LibraryStockVerificationSession"("verificationDate");
CREATE INDEX "LibraryStockVerificationSession_scopeType_idx" ON "LibraryStockVerificationSession"("scopeType");

CREATE TABLE "LibraryStockVerificationRecord" (
  "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "copyId" TEXT NOT NULL,
  "expectedAccessionNumberSnapshot" TEXT NOT NULL, "expectedBarcodeSnapshot" TEXT,
  "expectedTitleSnapshot" TEXT NOT NULL, "expectedShelfCodeSnapshot" TEXT,
  "expectedStatusSnapshot" TEXT NOT NULL, "expectedConditionSnapshot" TEXT NOT NULL,
  "expectedLoanStatusSnapshot" TEXT, "expectedBorrowerTypeSnapshot" TEXT, "expectedDueDateSnapshot" DATETIME,
  "observationStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED', "observedAt" DATETIME,
  "observedShelfCode" TEXT, "observedCondition" TEXT, "scanMethod" TEXT,
  "observationNotes" TEXT, "discrepancyReason" TEXT,
  "resolutionStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED', "resolutionNotes" TEXT,
  "appliedCopyEventId" TEXT, "observedByUserId" TEXT, "reviewedByUserId" TEXT, "appliedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LibraryStockVerificationRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationRecord_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationRecord_appliedCopyEventId_fkey" FOREIGN KEY ("appliedCopyEventId") REFERENCES "LibraryCopyEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationRecord_observedByUserId_fkey" FOREIGN KEY ("observedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationRecord_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LibraryStockVerificationRecord_appliedCopyEventId_key" ON "LibraryStockVerificationRecord"("appliedCopyEventId");
CREATE UNIQUE INDEX "LibraryStockVerificationRecord_sessionId_copyId_key" ON "LibraryStockVerificationRecord"("sessionId", "copyId");
CREATE INDEX "LibraryStockVerificationRecord_sessionId_observationStatus_idx" ON "LibraryStockVerificationRecord"("sessionId", "observationStatus");
CREATE INDEX "LibraryStockVerificationRecord_sessionId_resolutionStatus_idx" ON "LibraryStockVerificationRecord"("sessionId", "resolutionStatus");
CREATE INDEX "LibraryStockVerificationRecord_copyId_idx" ON "LibraryStockVerificationRecord"("copyId");

CREATE TABLE "LibraryStockVerificationScanEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "recordId" TEXT,
  "normalizedInput" TEXT NOT NULL, "scanMethod" TEXT NOT NULL, "resultType" TEXT NOT NULL,
  "scannedAt" DATETIME NOT NULL, "notes" TEXT, "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryStockVerificationScanEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationScanEvent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "LibraryStockVerificationRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationScanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LibraryStockVerificationScanEvent_sessionId_scannedAt_idx" ON "LibraryStockVerificationScanEvent"("sessionId", "scannedAt");
CREATE INDEX "LibraryStockVerificationScanEvent_recordId_idx" ON "LibraryStockVerificationScanEvent"("recordId");
CREATE INDEX "LibraryStockVerificationScanEvent_resultType_idx" ON "LibraryStockVerificationScanEvent"("resultType");

CREATE TABLE "LibraryStockVerificationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL, "notes" TEXT, "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryStockVerificationEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryStockVerificationEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LibraryStockVerificationEvent_sessionId_eventDate_idx" ON "LibraryStockVerificationEvent"("sessionId", "eventDate");
CREATE INDEX "LibraryStockVerificationEvent_eventType_idx" ON "LibraryStockVerificationEvent"("eventType");
