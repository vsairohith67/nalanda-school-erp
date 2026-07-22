-- Prompt 19C: disabled-by-default one-way SMS and Email communication foundation.
-- Credentials, OAuth tokens, full mobile numbers and full Email destinations are not stored here.
CREATE TABLE "SmsEmailIntegrationProfile" (
  "id" TEXT NOT NULL PRIMARY KEY, "profileCode" TEXT NOT NULL, "channel" TEXT NOT NULL,
  "providerKind" TEXT NOT NULL, "displayName" TEXT NOT NULL, "mode" TEXT NOT NULL DEFAULT 'MOCK',
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "providerApiVersion" TEXT, "senderIdentityMasked" TEXT,
  "senderDomain" TEXT, "defaultCountryCode" TEXT DEFAULT '+91', "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "quietHoursStart" TEXT, "quietHoursEnd" TEXT, "hourlyLimit" INTEGER, "dailyLimit" INTEGER,
  "workerChunkSize" INTEGER NOT NULL DEFAULT 25, "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
  "liveSendingEnabled" BOOLEAN NOT NULL DEFAULT false, "costCapEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maximumEstimatedBatchCostMinor" INTEGER, "costCapCurrency" TEXT NOT NULL DEFAULT 'INR',
  "dltPrincipalEntityReference" TEXT, "dltHeaderReference" TEXT,
  "spfStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "dkimStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "dmarcStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "senderAliasStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "lastHealthCheckAt" DATETIME, "lastHealthCheckStatus" TEXT, "lastHealthCheckMessage" TEXT,
  "activatedByUserId" TEXT, "pausedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "SmsEmailIntegrationProfile_profileCode_key" ON "SmsEmailIntegrationProfile"("profileCode");
CREATE INDEX "SmsEmailIntegrationProfile_channel_mode_status_idx" ON "SmsEmailIntegrationProfile"("channel","mode","status");
CREATE INDEX "SmsEmailIntegrationProfile_channel_liveSendingEnabled_idx" ON "SmsEmailIntegrationProfile"("channel","liveSendingEnabled");

CREATE TABLE "SmsEmailConsent" (
  "id" TEXT NOT NULL PRIMARY KEY, "channel" TEXT NOT NULL, "subjectType" TEXT NOT NULL,
  "guardianId" TEXT, "staffMemberId" TEXT, "contactHash" TEXT NOT NULL, "contactMasked" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPTED_OUT', "consentSource" TEXT NOT NULL,
  "consentWordingVersion" TEXT NOT NULL, "consentPurposeScope" TEXT NOT NULL DEFAULT 'SCHOOL_OPERATIONAL_UPDATES',
  "evidenceReference" TEXT, "optedInAt" DATETIME, "optedOutAt" DATETIME, "expiresAt" DATETIME,
  "collectedByUserId" TEXT, "revokedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SmsEmailConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailConsent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SmsEmailConsent_channel_subjectType_guardianId_status_idx" ON "SmsEmailConsent"("channel","subjectType","guardianId","status");
CREATE INDEX "SmsEmailConsent_channel_subjectType_staffMemberId_status_idx" ON "SmsEmailConsent"("channel","subjectType","staffMemberId","status");
CREATE INDEX "SmsEmailConsent_channel_contactHash_status_idx" ON "SmsEmailConsent"("channel","contactHash","status");

CREATE TABLE "SmsEmailConsentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "consentId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "previousStatus" TEXT, "newStatus" TEXT,
  "consentWordingVersion" TEXT, "reason" TEXT, "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsEmailConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "SmsEmailConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SmsEmailConsentEvent_consentId_eventDate_idx" ON "SmsEmailConsentEvent"("consentId","eventDate");
CREATE INDEX "SmsEmailConsentEvent_eventType_eventDate_idx" ON "SmsEmailConsentEvent"("eventType","eventDate");

CREATE TABLE "SmsEmailTemplateMapping" (
  "id" TEXT NOT NULL PRIMARY KEY, "mappingCode" TEXT NOT NULL, "integrationProfileId" TEXT NOT NULL,
  "channel" TEXT NOT NULL, "notificationCategory" TEXT NOT NULL, "internalPurpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "providerStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "smsPrincipalEntityReference" TEXT, "smsHeader" TEXT, "smsDltTemplateId" TEXT,
  "smsTemplateCategory" TEXT, "smsTemplateText" TEXT, "emailSenderAlias" TEXT,
  "emailSubjectTemplate" TEXT, "emailTextTemplate" TEXT, "emailReplyToAlias" TEXT,
  "parameterDefinitionJson" TEXT NOT NULL, "sampleValuesJson" TEXT, "lastSyncedAt" DATETIME,
  "createdByUserId" TEXT, "activatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SmsEmailTemplateMapping_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsEmailTemplateMapping_mappingCode_key" ON "SmsEmailTemplateMapping"("mappingCode");
CREATE INDEX "SmsEmailTemplateMapping_integrationProfileId_status_idx" ON "SmsEmailTemplateMapping"("integrationProfileId","status");
CREATE INDEX "SmsEmailTemplateMapping_channel_notificationCategory_status_idx" ON "SmsEmailTemplateMapping"("channel","notificationCategory","status");
CREATE INDEX "SmsEmailTemplateMapping_providerStatus_idx" ON "SmsEmailTemplateMapping"("providerStatus");

CREATE TABLE "SmsEmailOutboundBatch" (
  "id" TEXT NOT NULL PRIMARY KEY, "batchNumber" TEXT NOT NULL, "channel" TEXT NOT NULL,
  "integrationProfileId" TEXT NOT NULL, "notificationCampaignId" TEXT NOT NULL,
  "notificationCampaignSnapshotJson" TEXT NOT NULL, "templateMappingId" TEXT NOT NULL,
  "templateSnapshotJson" TEXT NOT NULL, "profileSnapshotJson" TEXT NOT NULL,
  "readinessSnapshotJson" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduledFor" DATETIME, "emergencyOverride" BOOLEAN NOT NULL DEFAULT false,
  "totalCampaignRecipients" INTEGER NOT NULL DEFAULT 0, "totalEligibleContacts" INTEGER NOT NULL DEFAULT 0,
  "totalSkipped" INTEGER NOT NULL DEFAULT 0, "totalQueued" INTEGER NOT NULL DEFAULT 0,
  "totalAccepted" INTEGER NOT NULL DEFAULT 0, "totalSent" INTEGER NOT NULL DEFAULT 0,
  "totalDelivered" INTEGER NOT NULL DEFAULT 0, "totalBounced" INTEGER NOT NULL DEFAULT 0,
  "totalComplained" INTEGER NOT NULL DEFAULT 0, "totalSuppressed" INTEGER NOT NULL DEFAULT 0,
  "totalFailed" INTEGER NOT NULL DEFAULT 0, "skipReasonCountsJson" TEXT NOT NULL DEFAULT '{}',
  "estimatedSegments" INTEGER, "estimatedMaximumCostMinor" INTEGER, "estimatedDeliveredCostMinor" INTEGER,
  "estimatedCostCurrency" TEXT, "rateVersion" TEXT, "costCapOverrideSnapshotJson" TEXT,
  "approvalNotes" TEXT, "cancellationReason" TEXT, "createdByUserId" TEXT, "approvedByUserId" TEXT,
  "startedByUserId" TEXT, "cancelledByUserId" TEXT, "approvedAt" DATETIME, "startedAt" DATETIME,
  "completedAt" DATETIME, "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SmsEmailOutboundBatch_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailOutboundBatch_notificationCampaignId_fkey" FOREIGN KEY ("notificationCampaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailOutboundBatch_templateMappingId_fkey" FOREIGN KEY ("templateMappingId") REFERENCES "SmsEmailTemplateMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsEmailOutboundBatch_batchNumber_key" ON "SmsEmailOutboundBatch"("batchNumber");
CREATE INDEX "SmsEmailOutboundBatch_channel_status_scheduledFor_idx" ON "SmsEmailOutboundBatch"("channel","status","scheduledFor");
CREATE INDEX "SmsEmailOutboundBatch_integrationProfileId_createdAt_idx" ON "SmsEmailOutboundBatch"("integrationProfileId","createdAt");
CREATE INDEX "SmsEmailOutboundBatch_notificationCampaignId_idx" ON "SmsEmailOutboundBatch"("notificationCampaignId");

CREATE TABLE "SmsEmailDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "notificationRecipientId" TEXT,
  "channel" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "guardianId" TEXT, "staffMemberId" TEXT,
  "contactHash" TEXT NOT NULL, "contactMasked" TEXT NOT NULL, "consentId" TEXT NOT NULL,
  "safeContextJson" TEXT, "renderedSubject" TEXT, "renderedParametersSnapshotJson" TEXT NOT NULL,
  "smsSegmentCount" INTEGER, "requestFingerprint" TEXT NOT NULL, "providerMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED', "skipReasonCode" TEXT, "failureCode" TEXT,
  "failureCategory" TEXT, "failureMessageSafe" TEXT, "retryable" BOOLEAN NOT NULL DEFAULT false,
  "retryCount" INTEGER NOT NULL DEFAULT 0, "nextRetryAt" DATETIME, "claimedAt" DATETIME,
  "acceptedAt" DATETIME, "sentAt" DATETIME, "deliveredAt" DATETIME, "bouncedAt" DATETIME,
  "complainedAt" DATETIME, "suppressedAt" DATETIME, "failedAt" DATETIME, "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SmsEmailDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SmsEmailOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailDelivery_notificationRecipientId_fkey" FOREIGN KEY ("notificationRecipientId") REFERENCES "NotificationRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailDelivery_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailDelivery_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailDelivery_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "SmsEmailConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsEmailDelivery_requestFingerprint_key" ON "SmsEmailDelivery"("requestFingerprint");
CREATE UNIQUE INDEX "SmsEmailDelivery_providerMessageId_key" ON "SmsEmailDelivery"("providerMessageId");
CREATE UNIQUE INDEX "SmsEmailDelivery_batchId_subjectType_guardianId_staffMemberId_contactHash_key" ON "SmsEmailDelivery"("batchId","subjectType","guardianId","staffMemberId","contactHash");
CREATE INDEX "SmsEmailDelivery_batchId_status_idx" ON "SmsEmailDelivery"("batchId","status");
CREATE INDEX "SmsEmailDelivery_channel_status_nextRetryAt_idx" ON "SmsEmailDelivery"("channel","status","nextRetryAt");
CREATE INDEX "SmsEmailDelivery_channel_contactHash_idx" ON "SmsEmailDelivery"("channel","contactHash");

CREATE TABLE "SmsEmailDeliveryAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY, "deliveryId" TEXT NOT NULL, "attemptNumber" INTEGER NOT NULL,
  "providerMode" TEXT NOT NULL, "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestFingerprint" TEXT NOT NULL, "providerMessageId" TEXT, "result" TEXT NOT NULL,
  "providerHttpStatus" INTEGER, "providerErrorCode" TEXT, "safeErrorMessage" TEXT,
  "durationMs" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsEmailDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SmsEmailDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsEmailDeliveryAttempt_deliveryId_attemptNumber_key" ON "SmsEmailDeliveryAttempt"("deliveryId","attemptNumber");
CREATE INDEX "SmsEmailDeliveryAttempt_providerMessageId_idx" ON "SmsEmailDeliveryAttempt"("providerMessageId");
CREATE INDEX "SmsEmailDeliveryAttempt_result_idx" ON "SmsEmailDeliveryAttempt"("result");

CREATE TABLE "SmsEmailWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "integrationProfileId" TEXT NOT NULL, "deliveryId" TEXT,
  "channel" TEXT NOT NULL, "providerEventKey" TEXT NOT NULL, "providerMessageId" TEXT,
  "eventType" TEXT NOT NULL, "mappedStatus" TEXT, "signatureVerified" BOOLEAN NOT NULL,
  "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" DATETIME,
  "processingStatus" TEXT NOT NULL, "safePayloadJson" TEXT NOT NULL, "failureReason" TEXT,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsEmailWebhookEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailWebhookEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SmsEmailDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsEmailWebhookEvent_providerEventKey_key" ON "SmsEmailWebhookEvent"("providerEventKey");
CREATE INDEX "SmsEmailWebhookEvent_integrationProfileId_receivedAt_idx" ON "SmsEmailWebhookEvent"("integrationProfileId","receivedAt");
CREATE INDEX "SmsEmailWebhookEvent_providerMessageId_idx" ON "SmsEmailWebhookEvent"("providerMessageId");
CREATE INDEX "SmsEmailWebhookEvent_deliveryId_receivedAt_idx" ON "SmsEmailWebhookEvent"("deliveryId","receivedAt");

CREATE TABLE "SmsEmailOperationalEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "integrationProfileId" TEXT NOT NULL, "batchId" TEXT,
  "eventKey" TEXT NOT NULL, "eventType" TEXT NOT NULL, "safeReason" TEXT, "snapshotJson" TEXT,
  "recordedByUserId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsEmailOperationalEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailOperationalEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SmsEmailOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsEmailOperationalEvent_eventKey_key" ON "SmsEmailOperationalEvent"("eventKey");
CREATE INDEX "SmsEmailOperationalEvent_eventType_createdAt_idx" ON "SmsEmailOperationalEvent"("eventType","createdAt");
CREATE INDEX "SmsEmailOperationalEvent_integrationProfileId_createdAt_idx" ON "SmsEmailOperationalEvent"("integrationProfileId","createdAt");
CREATE INDEX "SmsEmailOperationalEvent_batchId_createdAt_idx" ON "SmsEmailOperationalEvent"("batchId","createdAt");

CREATE TABLE "SmsEmailSuppression" (
  "id" TEXT NOT NULL PRIMARY KEY, "channel" TEXT NOT NULL, "subjectType" TEXT NOT NULL,
  "guardianId" TEXT, "staffMemberId" TEXT, "contactHash" TEXT NOT NULL, "contactMasked" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "providerReference" TEXT,
  "reviewReason" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "clearedAt" DATETIME,
  "createdByUserId" TEXT, "clearedByUserId" TEXT,
  CONSTRAINT "SmsEmailSuppression_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SmsEmailSuppression_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SmsEmailSuppression_channel_contactHash_status_idx" ON "SmsEmailSuppression"("channel","contactHash","status");
CREATE INDEX "SmsEmailSuppression_subjectType_guardianId_status_idx" ON "SmsEmailSuppression"("subjectType","guardianId","status");
CREATE INDEX "SmsEmailSuppression_subjectType_staffMemberId_status_idx" ON "SmsEmailSuppression"("subjectType","staffMemberId","status");

CREATE TABLE "SmsEmailCostRate" (
  "id" TEXT NOT NULL PRIMARY KEY, "integrationProfileId" TEXT, "channel" TEXT NOT NULL,
  "providerKind" TEXT NOT NULL, "market" TEXT NOT NULL, "messageCategory" TEXT NOT NULL,
  "encodingType" TEXT, "currency" TEXT NOT NULL, "rateMinor" INTEGER NOT NULL, "unit" TEXT NOT NULL,
  "rateVersion" TEXT NOT NULL, "effectiveFrom" DATETIME NOT NULL, "sourceReviewDate" DATETIME NOT NULL,
  "notes" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SmsEmailCostRate_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsEmailCostRate_channel_providerKind_market_messageCategory_encodingType_currency_rateVersion_key" ON "SmsEmailCostRate"("channel","providerKind","market","messageCategory","encodingType","currency","rateVersion");
CREATE INDEX "SmsEmailCostRate_channel_status_effectiveFrom_idx" ON "SmsEmailCostRate"("channel","status","effectiveFrom");
