-- SUPER-ADMIN-WORK-1A is additive and owner-isolated. Existing school,
-- examination, IAM, notification and accounting tables are not modified.
CREATE TABLE "SuperAdminDiaryEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "entryDate" DATETIME NOT NULL,
  "notesFormat" TEXT NOT NULL DEFAULT 'PLAIN_STRUCTURED',
  "notes" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "contextModule" TEXT,
  "contextReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "followUpDate" DATETIME,
  "closedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SuperAdminDiaryEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SuperAdminDiaryEntry_publicKey_key" ON "SuperAdminDiaryEntry"("publicKey");
CREATE INDEX "SuperAdminDiaryEntry_ownerUserId_entryDate_idx" ON "SuperAdminDiaryEntry"("ownerUserId", "entryDate");
CREATE INDEX "SuperAdminDiaryEntry_ownerUserId_status_followUpDate_idx" ON "SuperAdminDiaryEntry"("ownerUserId", "status", "followUpDate");
CREATE INDEX "SuperAdminDiaryEntry_ownerUserId_category_priority_idx" ON "SuperAdminDiaryEntry"("ownerUserId", "category", "priority");

CREATE TABLE "SuperAdminTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TO_DO',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "dueDate" DATETIME NOT NULL,
  "dueTime" TEXT,
  "reminderAt" DATETIME,
  "category" TEXT NOT NULL,
  "linkedModule" TEXT,
  "linkedEntityType" TEXT,
  "linkedEntityReference" TEXT,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SuperAdminTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SuperAdminTask_publicKey_key" ON "SuperAdminTask"("publicKey");
CREATE INDEX "SuperAdminTask_ownerUserId_status_dueDate_idx" ON "SuperAdminTask"("ownerUserId", "status", "dueDate");
CREATE INDEX "SuperAdminTask_ownerUserId_reminderAt_idx" ON "SuperAdminTask"("ownerUserId", "reminderAt");
CREATE INDEX "SuperAdminTask_ownerUserId_category_priority_idx" ON "SuperAdminTask"("ownerUserId", "category", "priority");

CREATE TABLE "SuperAdminContact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT,
  "category" TEXT NOT NULL,
  "phone" TEXT,
  "alternatePhone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "website" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "preferred" BOOLEAN NOT NULL DEFAULT false,
  "tagsJson" TEXT NOT NULL DEFAULT '[]',
  "lastContactDate" DATETIME,
  "nextFollowUpDate" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SuperAdminContact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SuperAdminContact_publicKey_key" ON "SuperAdminContact"("publicKey");
CREATE INDEX "SuperAdminContact_ownerUserId_status_preferred_idx" ON "SuperAdminContact"("ownerUserId", "status", "preferred");
CREATE INDEX "SuperAdminContact_ownerUserId_category_name_idx" ON "SuperAdminContact"("ownerUserId", "category", "name");
CREATE INDEX "SuperAdminContact_ownerUserId_nextFollowUpDate_idx" ON "SuperAdminContact"("ownerUserId", "nextFollowUpDate");

CREATE TABLE "SuperAdminWorkAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityPublicKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "safeMetadataJson" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuperAdminWorkAudit_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SuperAdminWorkAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SuperAdminWorkAudit_publicKey_key" ON "SuperAdminWorkAudit"("publicKey");
CREATE INDEX "SuperAdminWorkAudit_ownerUserId_occurredAt_idx" ON "SuperAdminWorkAudit"("ownerUserId", "occurredAt");
CREATE INDEX "SuperAdminWorkAudit_ownerUserId_entityType_entityPublicKey_idx" ON "SuperAdminWorkAudit"("ownerUserId", "entityType", "entityPublicKey");
CREATE INDEX "SuperAdminWorkAudit_eventType_occurredAt_idx" ON "SuperAdminWorkAudit"("eventType", "occurredAt");
