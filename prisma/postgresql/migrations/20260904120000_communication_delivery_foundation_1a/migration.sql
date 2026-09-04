-- CreateTable
CREATE TABLE "CommunicationContactPoint" (
    "id" TEXT NOT NULL,
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
    "verifiedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplateDefinition" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplateDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplateVersion" (
    "id" TEXT NOT NULL,
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
    "approvedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPreference" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationConsent" (
    "id" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectReferenceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidenceReference" TEXT,
    "contactVersion" INTEGER,
    "capturedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "supersedesConsentId" TEXT,
    "activeKey" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationProviderProfile" (
    "id" TEXT NOT NULL,
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
    "circuitOpenedAt" TIMESTAMP(3),
    "circuitRetryAt" TIMESTAMP(3),
    "lastHealthAt" TIMESTAMP(3),
    "lastHealthStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationIntent" (
    "id" TEXT NOT NULL,
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
    "notBefore" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deduplicationKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "initiatingActorId" TEXT NOT NULL,
    "authorizingContextJson" TEXT NOT NULL,
    "audienceSnapshotHash" TEXT,
    "state" TEXT NOT NULL DEFAULT 'CREATED',
    "cancellationReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationOutboxItem" (
    "id" TEXT NOT NULL,
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
    "scheduledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maximumAttempts" INTEGER NOT NULL DEFAULT 4,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "inAppReadAt" TIMESTAMP(3),
    "inAppArchivedAt" TIMESTAMP(3),
    "lastSafeErrorCode" TEXT,
    "lastSafeErrorMessage" TEXT,
    "estimatedCostMinor" INTEGER,
    "estimatedCostCurrency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationOutboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAttempt" (
    "id" TEXT NOT NULL,
    "outboxItemId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "adapterKind" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resultState" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "safeErrorCode" TEXT,
    "safeErrorMessage" TEXT,
    "retryAfterAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDeliveryReceipt" (
    "id" TEXT NOT NULL,
    "outboxItemId" TEXT NOT NULL,
    "providerEventKey" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "state" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "safeMetadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationDeliveryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationWebhookEvent" (
    "id" TEXT NOT NULL,
    "providerProfileCode" TEXT NOT NULL,
    "providerEventKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL,
    "timestampVerified" BOOLEAN NOT NULL,
    "contentTypeVerified" BOOLEAN NOT NULL,
    "processingState" TEXT NOT NULL,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "safeMetadataJson" TEXT NOT NULL DEFAULT '{}',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativePushEndpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nativeDeviceReference" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "tokenDigest" TEXT NOT NULL,
    "tokenMasked" TEXT NOT NULL,
    "encryptedTokenSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SYNTHETIC_ONLY',
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativePushEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAuditEvent" (
    "id" TEXT NOT NULL,
    "intentId" TEXT,
    "outboxItemId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "actorUserId" TEXT,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationContactPoint_subjectType_subjectReferenceId_ch_idx" ON "CommunicationContactPoint"("subjectType", "subjectReferenceId", "channel", "status");

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
CREATE UNIQUE INDEX "CommunicationTemplateVersion_templateDefinitionId_version_l_key" ON "CommunicationTemplateVersion"("templateDefinitionId", "version", "locale", "channel");

-- CreateIndex
CREATE INDEX "CommunicationPreference_userId_channel_idx" ON "CommunicationPreference"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPreference_userId_category_channel_key" ON "CommunicationPreference"("userId", "category", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationConsent_activeKey_key" ON "CommunicationConsent"("activeKey");

-- CreateIndex
CREATE INDEX "CommunicationConsent_identityKey_channel_purpose_status_idx" ON "CommunicationConsent"("identityKey", "channel", "purpose", "status");

-- CreateIndex
CREATE INDEX "CommunicationConsent_subjectType_subjectReferenceId_channel_idx" ON "CommunicationConsent"("subjectType", "subjectReferenceId", "channel", "status");

-- CreateIndex
CREATE INDEX "CommunicationConsent_expiresAt_idx" ON "CommunicationConsent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationProviderProfile_profileCode_key" ON "CommunicationProviderProfile"("profileCode");

-- CreateIndex
CREATE INDEX "CommunicationProviderProfile_channel_status_operationalEnab_idx" ON "CommunicationProviderProfile"("channel", "status", "operationalEnabled");

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
CREATE INDEX "CommunicationOutboxItem_channel_state_nextAttemptAt_schedul_idx" ON "CommunicationOutboxItem"("channel", "state", "nextAttemptAt", "scheduledAt");

-- CreateIndex
CREATE INDEX "CommunicationOutboxItem_recipientUserId_channel_inAppArchiv_idx" ON "CommunicationOutboxItem"("recipientUserId", "channel", "inAppArchivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationOutboxItem_leaseExpiresAt_idx" ON "CommunicationOutboxItem"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "CommunicationOutboxItem_destinationDigest_channel_idx" ON "CommunicationOutboxItem"("destinationDigest", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationOutboxItem_intentId_recipientSubjectType_recip_key" ON "CommunicationOutboxItem"("intentId", "recipientSubjectType", "recipientSubjectReferenceId", "channel");

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

-- AddForeignKey
ALTER TABLE "CommunicationTemplateVersion" ADD CONSTRAINT "CommunicationTemplateVersion_templateDefinitionId_fkey" FOREIGN KEY ("templateDefinitionId") REFERENCES "CommunicationTemplateDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationOutboxItem" ADD CONSTRAINT "CommunicationOutboxItem_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "CommunicationIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttempt" ADD CONSTRAINT "CommunicationAttempt_outboxItemId_fkey" FOREIGN KEY ("outboxItemId") REFERENCES "CommunicationOutboxItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDeliveryReceipt" ADD CONSTRAINT "CommunicationDeliveryReceipt_outboxItemId_fkey" FOREIGN KEY ("outboxItemId") REFERENCES "CommunicationOutboxItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQLite trigger parity: CommunicationAttempt_no_update
CREATE FUNCTION "nalanda_trigger_8d83c8bb7aab351d5f7c"() RETURNS trigger LANGUAGE plpgsql AS $nalanda_trigger$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMMUNICATION_ATTEMPT_IMMUTABLE'; RETURN NEW; END;
$nalanda_trigger$;
CREATE TRIGGER "CommunicationAttempt_no_update" BEFORE UPDATE ON "CommunicationAttempt" FOR EACH ROW EXECUTE FUNCTION "nalanda_trigger_8d83c8bb7aab351d5f7c"();

-- SQLite trigger parity: CommunicationAttempt_no_delete
CREATE FUNCTION "nalanda_trigger_0cf3272e0e98e0722ee7"() RETURNS trigger LANGUAGE plpgsql AS $nalanda_trigger$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMMUNICATION_ATTEMPT_IMMUTABLE'; RETURN OLD; END;
$nalanda_trigger$;
CREATE TRIGGER "CommunicationAttempt_no_delete" BEFORE DELETE ON "CommunicationAttempt" FOR EACH ROW EXECUTE FUNCTION "nalanda_trigger_0cf3272e0e98e0722ee7"();

-- SQLite trigger parity: CommunicationDeliveryReceipt_no_update
CREATE FUNCTION "nalanda_trigger_02b597e20b3153858dff"() RETURNS trigger LANGUAGE plpgsql AS $nalanda_trigger$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMMUNICATION_RECEIPT_IMMUTABLE'; RETURN NEW; END;
$nalanda_trigger$;
CREATE TRIGGER "CommunicationDeliveryReceipt_no_update" BEFORE UPDATE ON "CommunicationDeliveryReceipt" FOR EACH ROW EXECUTE FUNCTION "nalanda_trigger_02b597e20b3153858dff"();

-- SQLite trigger parity: CommunicationDeliveryReceipt_no_delete
CREATE FUNCTION "nalanda_trigger_0df99731671c6f9098da"() RETURNS trigger LANGUAGE plpgsql AS $nalanda_trigger$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMMUNICATION_RECEIPT_IMMUTABLE'; RETURN OLD; END;
$nalanda_trigger$;
CREATE TRIGGER "CommunicationDeliveryReceipt_no_delete" BEFORE DELETE ON "CommunicationDeliveryReceipt" FOR EACH ROW EXECUTE FUNCTION "nalanda_trigger_0df99731671c6f9098da"();

-- SQLite trigger parity: CommunicationAuditEvent_no_update
CREATE FUNCTION "nalanda_trigger_3b889e0bc1b7b95c419b"() RETURNS trigger LANGUAGE plpgsql AS $nalanda_trigger$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMMUNICATION_AUDIT_IMMUTABLE'; RETURN NEW; END;
$nalanda_trigger$;
CREATE TRIGGER "CommunicationAuditEvent_no_update" BEFORE UPDATE ON "CommunicationAuditEvent" FOR EACH ROW EXECUTE FUNCTION "nalanda_trigger_3b889e0bc1b7b95c419b"();

-- SQLite trigger parity: CommunicationAuditEvent_no_delete
CREATE FUNCTION "nalanda_trigger_f2dd0cc30415cb7648bb"() RETURNS trigger LANGUAGE plpgsql AS $nalanda_trigger$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMMUNICATION_AUDIT_IMMUTABLE'; RETURN OLD; END;
$nalanda_trigger$;
CREATE TRIGGER "CommunicationAuditEvent_no_delete" BEFORE DELETE ON "CommunicationAuditEvent" FOR EACH ROW EXECUTE FUNCTION "nalanda_trigger_f2dd0cc30415cb7648bb"();
