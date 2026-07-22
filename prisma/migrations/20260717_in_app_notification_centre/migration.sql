-- Prompt 19A: internal-only notification centre and delivery ledger.
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionPath" TEXT,
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "NotificationCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignNumber" TEXT NOT NULL,
    "templateId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionPath" TEXT,
    "audienceType" TEXT NOT NULL,
    "audienceDefinitionJson" TEXT NOT NULL,
    "audienceSnapshotJson" TEXT,
    "templateSnapshotJson" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" DATETIME,
    "expiresAt" DATETIME,
    "totalResolvedUsers" INTEGER NOT NULL DEFAULT 0,
    "totalRecipientRows" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "totalAcknowledged" INTEGER NOT NULL DEFAULT 0,
    "totalDismissed" INTEGER NOT NULL DEFAULT 0,
    "correctionOfCampaignId" TEXT,
    "reviewNotes" TEXT,
    "withdrawalReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "withdrawnByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "archivedByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "cancelledAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationCampaign_correctionOfCampaignId_fkey" FOREIGN KEY ("correctionOfCampaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientRoleSnapshot" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "recipientContextJson" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" DATETIME NOT NULL,
    "firstViewedAt" DATETIME,
    "readAt" DATETIME,
    "acknowledgedAt" DATETIME,
    "dismissedAt" DATETIME,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "NotificationSkippedRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetReferenceKey" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "safeContextJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationSkippedRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "campaignId" TEXT,
    "recipientId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NotificationRecipient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationTemplate_templateCode_key" ON "NotificationTemplate"("templateCode");
CREATE INDEX "NotificationTemplate_status_category_idx" ON "NotificationTemplate"("status", "category");
CREATE INDEX "NotificationTemplate_createdAt_idx" ON "NotificationTemplate"("createdAt");
CREATE UNIQUE INDEX "NotificationCampaign_campaignNumber_key" ON "NotificationCampaign"("campaignNumber");
CREATE UNIQUE INDEX "NotificationCampaign_correctionOfCampaignId_key" ON "NotificationCampaign"("correctionOfCampaignId");
CREATE INDEX "NotificationCampaign_status_scheduledFor_idx" ON "NotificationCampaign"("status", "scheduledFor");
CREATE INDEX "NotificationCampaign_category_priority_idx" ON "NotificationCampaign"("category", "priority");
CREATE INDEX "NotificationCampaign_audienceType_idx" ON "NotificationCampaign"("audienceType");
CREATE INDEX "NotificationCampaign_createdByUserId_createdAt_idx" ON "NotificationCampaign"("createdByUserId", "createdAt");
CREATE INDEX "NotificationCampaign_expiresAt_idx" ON "NotificationCampaign"("expiresAt");
CREATE INDEX "NotificationRecipient_userId_deliveryStatus_availableAt_idx" ON "NotificationRecipient"("userId", "deliveryStatus", "availableAt");
CREATE INDEX "NotificationRecipient_campaignId_readAt_idx" ON "NotificationRecipient"("campaignId", "readAt");
CREATE INDEX "NotificationRecipient_campaignId_acknowledgedAt_idx" ON "NotificationRecipient"("campaignId", "acknowledgedAt");
CREATE UNIQUE INDEX "NotificationRecipient_campaignId_userId_key" ON "NotificationRecipient"("campaignId", "userId");
CREATE INDEX "NotificationSkippedRecipient_campaignId_reasonCode_idx" ON "NotificationSkippedRecipient"("campaignId", "reasonCode");
CREATE INDEX "NotificationEvent_templateId_eventDate_idx" ON "NotificationEvent"("templateId", "eventDate");
CREATE INDEX "NotificationEvent_campaignId_eventDate_idx" ON "NotificationEvent"("campaignId", "eventDate");
CREATE INDEX "NotificationEvent_recipientId_eventDate_idx" ON "NotificationEvent"("recipientId", "eventDate");
CREATE INDEX "NotificationEvent_eventType_eventDate_idx" ON "NotificationEvent"("eventType", "eventDate");
