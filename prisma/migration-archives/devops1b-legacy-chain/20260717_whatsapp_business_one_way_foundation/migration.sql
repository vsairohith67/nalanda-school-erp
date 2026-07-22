-- Prompt 19B: official Meta WhatsApp Cloud API one-way communication foundation.
CREATE TABLE "WhatsAppIntegrationProfile" (
  "id" TEXT NOT NULL PRIMARY KEY, "profileCode" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'META_CLOUD', "mode" TEXT NOT NULL DEFAULT 'MOCK',
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "graphApiVersion" TEXT NOT NULL DEFAULT 'v25.0',
  "businessAccountReference" TEXT, "phoneNumberReference" TEXT, "displayPhoneMasked" TEXT,
  "defaultCountryCode" TEXT DEFAULT '+91', "quietHoursStart" TEXT, "quietHoursEnd" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata', "dailyMessageLimit" INTEGER,
  "hourlyMessageLimit" INTEGER, "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
  "workerChunkSize" INTEGER NOT NULL DEFAULT 25, "liveSendingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "lastHealthCheckAt" DATETIME, "lastHealthCheckStatus" TEXT, "lastHealthCheckMessage" TEXT,
  "activatedByUserId" TEXT, "pausedByUserId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "WhatsAppIntegrationProfile_profileCode_key" ON "WhatsAppIntegrationProfile"("profileCode");
CREATE INDEX "WhatsAppIntegrationProfile_mode_status_idx" ON "WhatsAppIntegrationProfile"("mode","status");
CREATE INDEX "WhatsAppIntegrationProfile_liveSendingEnabled_idx" ON "WhatsAppIntegrationProfile"("liveSendingEnabled");

CREATE TABLE "WhatsAppConsent" (
  "id" TEXT NOT NULL PRIMARY KEY, "subjectType" TEXT NOT NULL, "guardianId" TEXT, "staffMemberId" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'WHATSAPP', "phoneHash" TEXT NOT NULL, "phoneLast4" TEXT NOT NULL,
  "countryCode" TEXT, "status" TEXT NOT NULL DEFAULT 'OPTED_OUT', "consentSource" TEXT NOT NULL,
  "consentWordingVersion" TEXT NOT NULL, "consentPurposeScope" TEXT NOT NULL DEFAULT 'SCHOOL_OPERATIONAL_UPDATES',
  "evidenceReference" TEXT, "notes" TEXT, "optedInAt" DATETIME, "optedOutAt" DATETIME, "expiresAt" DATETIME,
  "collectedByUserId" TEXT, "revokedByUserId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WhatsAppConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppConsent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WhatsAppConsent_subjectType_guardianId_status_idx" ON "WhatsAppConsent"("subjectType","guardianId","status");
CREATE INDEX "WhatsAppConsent_subjectType_staffMemberId_status_idx" ON "WhatsAppConsent"("subjectType","staffMemberId","status");
CREATE INDEX "WhatsAppConsent_phoneHash_status_idx" ON "WhatsAppConsent"("phoneHash","status");

CREATE TABLE "WhatsAppConsentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "consentId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "previousStatus" TEXT, "newStatus" TEXT,
  "consentWordingVersion" TEXT, "reason" TEXT, "notes" TEXT, "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "WhatsAppConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WhatsAppConsentEvent_consentId_eventDate_idx" ON "WhatsAppConsentEvent"("consentId","eventDate");
CREATE INDEX "WhatsAppConsentEvent_eventType_eventDate_idx" ON "WhatsAppConsentEvent"("eventType","eventDate");

CREATE TABLE "WhatsAppTemplateMapping" (
  "id" TEXT NOT NULL PRIMARY KEY, "mappingCode" TEXT NOT NULL, "integrationProfileId" TEXT NOT NULL,
  "notificationCategory" TEXT NOT NULL, "internalPurpose" TEXT NOT NULL, "metaTemplateName" TEXT NOT NULL,
  "metaTemplateLanguage" TEXT NOT NULL, "metaTemplateCategory" TEXT, "providerTemplateId" TEXT,
  "providerStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "parameterDefinitionJson" TEXT NOT NULL,
  "sampleValuesJson" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT', "lastSyncedAt" DATETIME,
  "createdByUserId" TEXT, "activatedByUserId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WhatsAppTemplateMapping_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppTemplateMapping_mappingCode_key" ON "WhatsAppTemplateMapping"("mappingCode");
CREATE INDEX "WhatsAppTemplateMapping_integrationProfileId_status_idx" ON "WhatsAppTemplateMapping"("integrationProfileId","status");
CREATE INDEX "WhatsAppTemplateMapping_notificationCategory_status_idx" ON "WhatsAppTemplateMapping"("notificationCategory","status");
CREATE INDEX "WhatsAppTemplateMapping_providerStatus_idx" ON "WhatsAppTemplateMapping"("providerStatus");

CREATE TABLE "WhatsAppOutboundBatch" (
  "id" TEXT NOT NULL PRIMARY KEY, "batchNumber" TEXT NOT NULL, "integrationProfileId" TEXT NOT NULL,
  "notificationCampaignId" TEXT NOT NULL, "notificationCampaignSnapshotJson" TEXT NOT NULL,
  "templateMappingId" TEXT NOT NULL, "templateMappingSnapshotJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "scheduledFor" DATETIME, "emergencyOverride" BOOLEAN NOT NULL DEFAULT false,
  "emergencyOverrideReason" TEXT, "totalCampaignRecipients" INTEGER NOT NULL DEFAULT 0,
  "totalEligibleContacts" INTEGER NOT NULL DEFAULT 0, "totalSkipped" INTEGER NOT NULL DEFAULT 0,
  "totalQueued" INTEGER NOT NULL DEFAULT 0, "totalAccepted" INTEGER NOT NULL DEFAULT 0,
  "totalSent" INTEGER NOT NULL DEFAULT 0, "totalDelivered" INTEGER NOT NULL DEFAULT 0,
  "totalRead" INTEGER NOT NULL DEFAULT 0, "totalFailed" INTEGER NOT NULL DEFAULT 0,
  "totalOptedOut" INTEGER NOT NULL DEFAULT 0, "totalUnknown" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostMinor" INTEGER, "estimatedCostCurrency" TEXT, "estimateRateVersion" TEXT,
  "approvalNotes" TEXT, "cancellationReason" TEXT, "createdByUserId" TEXT, "approvedByUserId" TEXT,
  "startedByUserId" TEXT, "cancelledByUserId" TEXT, "approvedAt" DATETIME, "startedAt" DATETIME,
  "completedAt" DATETIME, "cancelledAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WhatsAppOutboundBatch_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppOutboundBatch_notificationCampaignId_fkey" FOREIGN KEY ("notificationCampaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppOutboundBatch_templateMappingId_fkey" FOREIGN KEY ("templateMappingId") REFERENCES "WhatsAppTemplateMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppOutboundBatch_batchNumber_key" ON "WhatsAppOutboundBatch"("batchNumber");
CREATE INDEX "WhatsAppOutboundBatch_status_scheduledFor_idx" ON "WhatsAppOutboundBatch"("status","scheduledFor");
CREATE INDEX "WhatsAppOutboundBatch_integrationProfileId_createdAt_idx" ON "WhatsAppOutboundBatch"("integrationProfileId","createdAt");
CREATE INDEX "WhatsAppOutboundBatch_notificationCampaignId_idx" ON "WhatsAppOutboundBatch"("notificationCampaignId");

CREATE TABLE "WhatsAppDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "notificationRecipientId" TEXT, "subjectType" TEXT NOT NULL,
  "subjectReferenceId" TEXT NOT NULL, "safeDisplayLabel" TEXT NOT NULL, "safeContextJson" TEXT,
  "phoneHash" TEXT NOT NULL, "phoneLast4" TEXT NOT NULL, "countryCode" TEXT, "consentId" TEXT NOT NULL,
  "templateNameSnapshot" TEXT NOT NULL, "templateLanguageSnapshot" TEXT NOT NULL,
  "templateCategorySnapshot" TEXT, "renderedParametersJson" TEXT NOT NULL, "requestFingerprint" TEXT NOT NULL,
  "providerMessageId" TEXT, "status" TEXT NOT NULL DEFAULT 'QUEUED', "providerErrorCategory" TEXT,
  "providerErrorCode" TEXT, "failureMessageSafe" TEXT, "retryable" BOOLEAN NOT NULL DEFAULT false,
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" DATETIME,
  "claimedAt" DATETIME, "acceptedAt" DATETIME, "sentAt" DATETIME, "deliveredAt" DATETIME,
  "readAt" DATETIME, "failedAt" DATETIME, "optedOutAt" DATETIME, "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WhatsAppDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WhatsAppOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppDelivery_requestFingerprint_key" ON "WhatsAppDelivery"("requestFingerprint");
CREATE UNIQUE INDEX "WhatsAppDelivery_providerMessageId_key" ON "WhatsAppDelivery"("providerMessageId");
CREATE UNIQUE INDEX "WhatsAppDelivery_batchId_subjectType_subjectReferenceId_key" ON "WhatsAppDelivery"("batchId","subjectType","subjectReferenceId");
CREATE INDEX "WhatsAppDelivery_batchId_status_idx" ON "WhatsAppDelivery"("batchId","status");
CREATE INDEX "WhatsAppDelivery_status_nextAttemptAt_idx" ON "WhatsAppDelivery"("status","nextAttemptAt");
CREATE INDEX "WhatsAppDelivery_phoneHash_idx" ON "WhatsAppDelivery"("phoneHash");

CREATE TABLE "WhatsAppDeliveryAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY, "deliveryId" TEXT NOT NULL, "attemptNumber" INTEGER NOT NULL,
  "requestFingerprint" TEXT NOT NULL, "providerMessageId" TEXT, "resultStatus" TEXT NOT NULL,
  "retryable" BOOLEAN NOT NULL DEFAULT false, "errorCategory" TEXT, "errorCode" TEXT,
  "safeErrorMessage" TEXT, "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WhatsAppDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppDeliveryAttempt_deliveryId_attemptNumber_key" ON "WhatsAppDeliveryAttempt"("deliveryId","attemptNumber");
CREATE INDEX "WhatsAppDeliveryAttempt_providerMessageId_idx" ON "WhatsAppDeliveryAttempt"("providerMessageId");
CREATE INDEX "WhatsAppDeliveryAttempt_resultStatus_retryable_idx" ON "WhatsAppDeliveryAttempt"("resultStatus","retryable");

CREATE TABLE "WhatsAppWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "integrationProfileId" TEXT NOT NULL, "eventKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "providerMessageId" TEXT, "deliveryId" TEXT, "eventType" TEXT NOT NULL, "mappedStatus" TEXT,
  "signatureValid" BOOLEAN NOT NULL, "processingStatus" TEXT NOT NULL, "safeSummaryJson" TEXT,
  "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppWebhookEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppWebhookEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WhatsAppDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_eventKey_key" ON "WhatsAppWebhookEvent"("eventKey");
CREATE INDEX "WhatsAppWebhookEvent_providerMessageId_idx" ON "WhatsAppWebhookEvent"("providerMessageId");
CREATE INDEX "WhatsAppWebhookEvent_integrationProfileId_receivedAt_idx" ON "WhatsAppWebhookEvent"("integrationProfileId","receivedAt");
CREATE INDEX "WhatsAppWebhookEvent_deliveryId_receivedAt_idx" ON "WhatsAppWebhookEvent"("deliveryId","receivedAt");
CREATE INDEX "WhatsAppWebhookEvent_processingStatus_receivedAt_idx" ON "WhatsAppWebhookEvent"("processingStatus","receivedAt");

CREATE TABLE "WhatsAppRateReference" (
  "id" TEXT NOT NULL PRIMARY KEY, "integrationProfileId" TEXT, "rateVersion" TEXT NOT NULL,
  "market" TEXT NOT NULL, "countryCallingCode" TEXT NOT NULL, "templateCategory" TEXT NOT NULL,
  "currency" TEXT NOT NULL, "ratePerDeliveredMessage" DECIMAL NOT NULL, "effectiveDate" DATETIME NOT NULL,
  "sourceReviewDate" DATETIME NOT NULL, "sourceUrl" TEXT NOT NULL, "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WhatsAppRateReference_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppRateReference_rateVersion_market_templateCategory_currency_key" ON "WhatsAppRateReference"("rateVersion","market","templateCategory","currency");
CREATE INDEX "WhatsAppRateReference_market_templateCategory_status_idx" ON "WhatsAppRateReference"("market","templateCategory","status");
CREATE INDEX "WhatsAppRateReference_effectiveDate_idx" ON "WhatsAppRateReference"("effectiveDate");
