-- Prompt 19B-QA recovery: cost-cap snapshots and append-only operational control events.
ALTER TABLE "WhatsAppIntegrationProfile" ADD COLUMN "costCapEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WhatsAppIntegrationProfile" ADD COLUMN "maximumEstimatedBatchCostMinor" INTEGER;
ALTER TABLE "WhatsAppIntegrationProfile" ADD COLUMN "costCapCurrency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "WhatsAppIntegrationProfile" ADD COLUMN "costCapUpdatedAt" DATETIME;
ALTER TABLE "WhatsAppIntegrationProfile" ADD COLUMN "costCapUpdatedByUserId" TEXT;

ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "skipReasonCountsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverrideSnapshotHash" TEXT;
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverrideReason" TEXT;
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverrideEstimateMinor" INTEGER;
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverrideLimitMinor" INTEGER;
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverrideCurrency" TEXT;
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverrideRateVersion" TEXT;
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverriddenAt" DATETIME;
ALTER TABLE "WhatsAppOutboundBatch" ADD COLUMN "costCapOverriddenByUserId" TEXT;

ALTER TABLE "WhatsAppWebhookEvent" ADD COLUMN "duplicateReceiptCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WhatsAppOperationalEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "integrationProfileId" TEXT NOT NULL,
  "batchId" TEXT,
  "eventKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "limitValue" INTEGER,
  "currentUsage" INTEGER,
  "periodStart" DATETIME,
  "periodEnd" DATETIME,
  "nextEligibleAt" DATETIME,
  "retryAfterSeconds" INTEGER,
  "safeReason" TEXT,
  "estimatedCostMinor" INTEGER,
  "costCapMinor" INTEGER,
  "currency" TEXT,
  "rateVersion" TEXT,
  "snapshotHash" TEXT,
  "recordedByUserId" TEXT,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "lastOccurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppOperationalEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppOperationalEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WhatsAppOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppOperationalEvent_eventKey_key" ON "WhatsAppOperationalEvent"("eventKey");
CREATE INDEX "WhatsAppOperationalEvent_eventType_createdAt_idx" ON "WhatsAppOperationalEvent"("eventType","createdAt");
CREATE INDEX "WhatsAppOperationalEvent_integrationProfileId_createdAt_idx" ON "WhatsAppOperationalEvent"("integrationProfileId","createdAt");
CREATE INDEX "WhatsAppOperationalEvent_batchId_createdAt_idx" ON "WhatsAppOperationalEvent"("batchId","createdAt");
