-- CreateTable
CREATE TABLE "CommunicationContactPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identityKey" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectReferenceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "destinationDigest" TEXT NOT NULL,
    "destinationMasked" TEXT NOT NULL,
    "encryptedDestinationSnapshot" TEXT,
    "verifiedAt" DATETIME,
    "invalidatedAt" DATETIME,
    "invalidationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunicationTemplateDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeVersion" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunicationTemplateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateDefinitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "languageReviewStatus" TEXT NOT NULL DEFAULT 'DRAFT_PENDING_LANGUAGE_REVIEW',
    "channel" TEXT NOT NULL,
    "subjectTemplate" TEXT,
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "actionPathTemplate" TEXT,
    "placeholderAllowlistJson" TEXT NOT NULL,
    "contentClassification" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "contentHash" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "retiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationTemplateVersion_templateDefinitionId_fkey" FOREIGN KEY ("templateDefinitionId") REFERENCES "CommunicationTemplateDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunicationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "optionalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "digestFrequency" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunicationConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identityKey" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectReferenceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidenceReference" TEXT,
    "contactVersion" INTEGER,
    "capturedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "disputedAt" DATETIME,
    "supersedesConsentId" TEXT,
    "activeKey" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CommunicationProviderProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileCode" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "adapterKind" TEXT NOT NULL DEFAULT 'DISABLED',
    "environment" TEXT NOT NULL DEFAULT 'SYNTHETIC',
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "operationalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "senderLabel" TEXT,
    "region" TEXT,
    "templateMappingJson" TEXT NOT NULL DEFAULT '{}',
    "ratePolicyJson" TEXT NOT NULL DEFAULT '{}',
    "costPolicyJson" TEXT NOT NULL DEFAULT '{}',
    "circuitState" TEXT NOT NULL DEFAULT 'CLOSED',
    "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
    "circuitOpenedAt" DATETIME,
    "circuitRetryAt" DATETIME,
    "lastHealthAt" DATETIME,
    "lastHealthStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunicationIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "sourceRecordType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "recipientPolicy" TEXT NOT NULL,
    "recipientPolicyVersion" INTEGER NOT NULL DEFAULT 1,
    "recipientScopeJson" TEXT NOT NULL,
    "eligibleChannelsJson" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "localePreference" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notBefore" DATETIME,
    "expiresAt" DATETIME,
    "deduplicationKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "initiatingActorId" TEXT NOT NULL,
    "authorizingContextJson" TEXT NOT NULL,
    "audienceSnapshotHash" TEXT,
    "state" TEXT NOT NULL DEFAULT 'CREATED',
    "cancellationReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunicationOutboxItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intentId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientSubjectType" TEXT NOT NULL,
    "recipientSubjectReferenceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "contactPointId" TEXT,
    "contactVersion" INTEGER,
    "destinationDigest" TEXT,
    "destinationMasked" TEXT,
    "locale" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "substitutionsJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "providerProfileCode" TEXT,
    "providerMessageId" TEXT,
    "scheduledAt" DATETIME,
    "expiresAt" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maximumAttempts" INTEGER NOT NULL DEFAULT 4,
    "nextAttemptAt" DATETIME,
    "leaseOwner" TEXT,
    "leaseToken" TEXT,
    "claimedAt" DATETIME,
    "leaseExpiresAt" DATETIME,
    "acceptedAt" DATETIME,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "failedAt" DATETIME,
    "cancelledAt" DATETIME,
    "inAppReadAt" DATETIME,
    "inAppArchivedAt" DATETIME,
    "lastSafeErrorCode" TEXT,
    "lastSafeErrorMessage" TEXT,
    "estimatedCostMinor" INTEGER,
    "estimatedCostCurrency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommunicationOutboxItem_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "CommunicationIntent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunicationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outboxItemId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "adapterKind" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resultState" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "safeErrorCode" TEXT,
    "safeErrorMessage" TEXT,
    "retryAfterAt" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "CommunicationAttempt_outboxItemId_fkey" FOREIGN KEY ("outboxItemId") REFERENCES "CommunicationOutboxItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunicationDeliveryReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outboxItemId" TEXT NOT NULL,
    "providerEventKey" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "state" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "safeMetadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationDeliveryReceipt_outboxItemId_fkey" FOREIGN KEY ("outboxItemId") REFERENCES "CommunicationOutboxItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunicationWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerProfileCode" TEXT NOT NULL,
    "providerEventKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL,
    "timestampVerified" BOOLEAN NOT NULL,
    "contentTypeVerified" BOOLEAN NOT NULL,
    "processingState" TEXT NOT NULL,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "safeMetadataJson" TEXT NOT NULL DEFAULT '{}',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "NativePushEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nativeDeviceReference" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "tokenDigest" TEXT NOT NULL,
    "tokenMasked" TEXT NOT NULL,
    "encryptedTokenSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SYNTHETIC_ONLY',
    "verifiedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunicationAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intentId" TEXT,
    "outboxItemId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "actorUserId" TEXT,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CommunicationContactPoint_subjectType_subjectReferenceId_channel_status_idx" ON "CommunicationContactPoint"("subjectType", "subjectReferenceId", "channel", "status");

-- CreateIndex
CREATE INDEX "CommunicationContactPoint_destinationDigest_channel_status_idx" ON "CommunicationContactPoint"("destinationDigest", "channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationContactPoint_identityKey_channel_version_key" ON "CommunicationContactPoint"("identityKey", "channel", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplateDefinition_templateKey_key" ON "CommunicationTemplateDefinition"("templateKey");

-- CreateIndex
CREATE INDEX "CommunicationTemplateDefinition_purpose_module_status_idx" ON "CommunicationTemplateDefinition"("purpose", "module", "status");

-- CreateIndex
CREATE INDEX "CommunicationTemplateVersion_channel_locale_status_idx" ON "CommunicationTemplateVersion"("channel", "locale", "status");

-- CreateIndex
CREATE INDEX "CommunicationTemplateVersion_contentHash_idx" ON "CommunicationTemplateVersion"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplateVersion_templateDefinitionId_version_locale_channel_key" ON "CommunicationTemplateVersion"("templateDefinitionId", "version", "locale", "channel");

-- CreateIndex
CREATE INDEX "CommunicationPreference_userId_channel_idx" ON "CommunicationPreference"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPreference_userId_category_channel_key" ON "CommunicationPreference"("userId", "category", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationConsent_activeKey_key" ON "CommunicationConsent"("activeKey");

-- CreateIndex
CREATE INDEX "CommunicationConsent_identityKey_channel_purpose_status_idx" ON "CommunicationConsent"("identityKey", "channel", "purpose", "status");

-- CreateIndex
CREATE INDEX "CommunicationConsent_subjectType_subjectReferenceId_channel_status_idx" ON "CommunicationConsent"("subjectType", "subjectReferenceId", "channel", "status");

-- CreateIndex
CREATE INDEX "CommunicationConsent_expiresAt_idx" ON "CommunicationConsent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationProviderProfile_profileCode_key" ON "CommunicationProviderProfile"("profileCode");

-- CreateIndex
CREATE INDEX "CommunicationProviderProfile_channel_status_operationalEnabled_idx" ON "CommunicationProviderProfile"("channel", "status", "operationalEnabled");

-- CreateIndex
CREATE INDEX "CommunicationProviderProfile_adapterKind_circuitState_idx" ON "CommunicationProviderProfile"("adapterKind", "circuitState");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationIntent_deduplicationKey_key" ON "CommunicationIntent"("deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationIntent_idempotencyKey_key" ON "CommunicationIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommunicationIntent_module_sourceRecordType_sourceRecordId_idx" ON "CommunicationIntent"("module", "sourceRecordType", "sourceRecordId");

-- CreateIndex
CREATE INDEX "CommunicationIntent_state_notBefore_idx" ON "CommunicationIntent"("state", "notBefore");

-- CreateIndex
CREATE INDEX "CommunicationIntent_purpose_priority_createdAt_idx" ON "CommunicationIntent"("purpose", "priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationOutboxItem_idempotencyKey_key" ON "CommunicationOutboxItem"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommunicationOutboxItem_channel_state_nextAttemptAt_scheduledAt_idx" ON "CommunicationOutboxItem"("channel", "state", "nextAttemptAt", "scheduledAt");

-- CreateIndex
CREATE INDEX "CommunicationOutboxItem_recipientUserId_channel_inAppArchivedAt_createdAt_idx" ON "CommunicationOutboxItem"("recipientUserId", "channel", "inAppArchivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationOutboxItem_leaseExpiresAt_idx" ON "CommunicationOutboxItem"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "CommunicationOutboxItem_destinationDigest_channel_idx" ON "CommunicationOutboxItem"("destinationDigest", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationOutboxItem_intentId_recipientSubjectType_recipientSubjectReferenceId_channel_key" ON "CommunicationOutboxItem"("intentId", "recipientSubjectType", "recipientSubjectReferenceId", "channel");

-- CreateIndex
CREATE INDEX "CommunicationAttempt_resultState_retryable_startedAt_idx" ON "CommunicationAttempt"("resultState", "retryable", "startedAt");

-- CreateIndex
CREATE INDEX "CommunicationAttempt_providerMessageId_idx" ON "CommunicationAttempt"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationAttempt_outboxItemId_attemptNumber_key" ON "CommunicationAttempt"("outboxItemId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationDeliveryReceipt_providerEventKey_key" ON "CommunicationDeliveryReceipt"("providerEventKey");

-- CreateIndex
CREATE INDEX "CommunicationDeliveryReceipt_outboxItemId_occurredAt_idx" ON "CommunicationDeliveryReceipt"("outboxItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationDeliveryReceipt_providerMessageId_idx" ON "CommunicationDeliveryReceipt"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationWebhookEvent_providerEventKey_key" ON "CommunicationWebhookEvent"("providerEventKey");

-- CreateIndex
CREATE INDEX "CommunicationWebhookEvent_providerProfileCode_receivedAt_idx" ON "CommunicationWebhookEvent"("providerProfileCode", "receivedAt");

-- CreateIndex
CREATE INDEX "CommunicationWebhookEvent_processingState_receivedAt_idx" ON "CommunicationWebhookEvent"("processingState", "receivedAt");

-- CreateIndex
CREATE INDEX "NativePushEndpoint_userId_status_idx" ON "NativePushEndpoint"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NativePushEndpoint_userId_nativeDeviceReference_environment_key" ON "NativePushEndpoint"("userId", "nativeDeviceReference", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "NativePushEndpoint_environment_tokenDigest_key" ON "NativePushEndpoint"("environment", "tokenDigest");

-- CreateIndex
CREATE INDEX "CommunicationAuditEvent_intentId_occurredAt_idx" ON "CommunicationAuditEvent"("intentId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationAuditEvent_outboxItemId_occurredAt_idx" ON "CommunicationAuditEvent"("outboxItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationAuditEvent_eventType_occurredAt_idx" ON "CommunicationAuditEvent"("eventType", "occurredAt");

-- Delivery attempts, provider receipts, and communication audit records are
-- append-only evidence. Corrections are represented by new evidence rows.
CREATE TRIGGER "CommunicationAttempt_no_update" BEFORE UPDATE ON "CommunicationAttempt"
BEGIN SELECT RAISE(ABORT, 'COMMUNICATION_ATTEMPT_IMMUTABLE'); END;
CREATE TRIGGER "CommunicationAttempt_no_delete" BEFORE DELETE ON "CommunicationAttempt"
BEGIN SELECT RAISE(ABORT, 'COMMUNICATION_ATTEMPT_IMMUTABLE'); END;
CREATE TRIGGER "CommunicationDeliveryReceipt_no_update" BEFORE UPDATE ON "CommunicationDeliveryReceipt"
BEGIN SELECT RAISE(ABORT, 'COMMUNICATION_RECEIPT_IMMUTABLE'); END;
CREATE TRIGGER "CommunicationDeliveryReceipt_no_delete" BEFORE DELETE ON "CommunicationDeliveryReceipt"
BEGIN SELECT RAISE(ABORT, 'COMMUNICATION_RECEIPT_IMMUTABLE'); END;
CREATE TRIGGER "CommunicationAuditEvent_no_update" BEFORE UPDATE ON "CommunicationAuditEvent"
BEGIN SELECT RAISE(ABORT, 'COMMUNICATION_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER "CommunicationAuditEvent_no_delete" BEFORE DELETE ON "CommunicationAuditEvent"
BEGIN SELECT RAISE(ABORT, 'COMMUNICATION_AUDIT_IMMUTABLE'); END;
