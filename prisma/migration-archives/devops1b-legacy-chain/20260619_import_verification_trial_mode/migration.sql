CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedByUserId" TEXT NOT NULL,
    "importedByName" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "detailsJson" TEXT,
    CONSTRAINT "ImportBatch_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ImportBatch_type_idx" ON "ImportBatch"("type");
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");
CREATE INDEX "ImportBatch_importedAt_idx" ON "ImportBatch"("importedAt");
CREATE INDEX "ImportBatch_importedByUserId_idx" ON "ImportBatch"("importedByUserId");

CREATE TABLE "GoLiveChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'go-live',
    "backupTaken" BOOLEAN NOT NULL DEFAULT false,
    "schoolSettingsVerified" BOOLEAN NOT NULL DEFAULT false,
    "realUsersCreated" BOOLEAN NOT NULL DEFAULT false,
    "defaultPasswordsChanged" BOOLEAN NOT NULL DEFAULT false,
    "studentMasterImported" BOOLEAN NOT NULL DEFAULT false,
    "randomStudentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "paymentTrialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "paymentTotalsMatched" BOOLEAN NOT NULL DEFAULT false,
    "randomPaymentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "testReceiptPrinted" BOOLEAN NOT NULL DEFAULT false,
    "pendingDuesChecked" BOOLEAN NOT NULL DEFAULT false,
    "backupAfterImportTaken" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
