import type { RestoreRecord } from "@/lib/restore";

const COLLECTIONS = {
  smsEmailIntegrationProfiles: ["id", "profileCode", "channel", "providerKind", "displayName", "mode", "status", "providerApiVersion", "senderIdentityMasked", "senderDomain", "defaultCountryCode", "timezone", "quietHoursStart", "quietHoursEnd", "hourlyLimit", "dailyLimit", "workerChunkSize", "maximumRetryCount", "liveSendingEnabled", "costCapEnabled", "maximumEstimatedBatchCostMinor", "costCapCurrency", "dltPrincipalEntityReference", "dltHeaderReference", "spfStatus", "dkimStatus", "dmarcStatus", "senderAliasStatus", "lastHealthCheckAt", "lastHealthCheckStatus", "lastHealthCheckMessage", "activatedByUserId", "pausedByUserId", "createdAt", "updatedAt"],
  smsEmailConsents: ["id", "channel", "subjectType", "guardianId", "staffMemberId", "contactHash", "contactMasked", "status", "consentSource", "consentWordingVersion", "consentPurposeScope", "evidenceReference", "optedInAt", "optedOutAt", "expiresAt", "collectedByUserId", "revokedByUserId", "createdAt", "updatedAt"],
  smsEmailConsentEvents: ["id", "consentId", "eventType", "eventDate", "previousStatus", "newStatus", "consentWordingVersion", "reason", "recordedByUserId", "createdAt"],
  smsEmailTemplateMappings: ["id", "mappingCode", "integrationProfileId", "channel", "notificationCategory", "internalPurpose", "status", "providerStatus", "smsPrincipalEntityReference", "smsHeader", "smsDltTemplateId", "smsTemplateCategory", "smsTemplateText", "emailSenderAlias", "emailSubjectTemplate", "emailTextTemplate", "emailReplyToAlias", "parameterDefinitionJson", "sampleValuesJson", "lastSyncedAt", "createdByUserId", "activatedByUserId", "createdAt", "updatedAt"],
  smsEmailOutboundBatches: ["id", "batchNumber", "channel", "integrationProfileId", "notificationCampaignId", "notificationCampaignSnapshotJson", "templateMappingId", "templateSnapshotJson", "profileSnapshotJson", "readinessSnapshotJson", "status", "scheduledFor", "emergencyOverride", "totalCampaignRecipients", "totalEligibleContacts", "totalSkipped", "totalQueued", "totalAccepted", "totalSent", "totalDelivered", "totalBounced", "totalComplained", "totalSuppressed", "totalFailed", "skipReasonCountsJson", "estimatedSegments", "estimatedMaximumCostMinor", "estimatedDeliveredCostMinor", "estimatedCostCurrency", "rateVersion", "costCapOverrideSnapshotJson", "approvalNotes", "cancellationReason", "createdByUserId", "approvedByUserId", "startedByUserId", "cancelledByUserId", "approvedAt", "startedAt", "completedAt", "cancelledAt", "createdAt", "updatedAt"],
  smsEmailDeliveries: ["id", "batchId", "notificationRecipientId", "channel", "subjectType", "guardianId", "staffMemberId", "contactHash", "contactMasked", "consentId", "safeContextJson", "renderedSubject", "renderedParametersSnapshotJson", "smsSegmentCount", "requestFingerprint", "providerMessageId", "status", "skipReasonCode", "failureCode", "failureCategory", "failureMessageSafe", "retryable", "retryCount", "nextRetryAt", "claimedAt", "acceptedAt", "sentAt", "deliveredAt", "bouncedAt", "complainedAt", "suppressedAt", "failedAt", "cancelledAt", "createdAt", "updatedAt"],
  smsEmailDeliveryAttempts: ["id", "deliveryId", "attemptNumber", "providerMode", "attemptedAt", "requestFingerprint", "providerMessageId", "result", "providerHttpStatus", "providerErrorCode", "safeErrorMessage", "durationMs", "createdAt"],
  smsEmailWebhookEvents: ["id", "integrationProfileId", "deliveryId", "channel", "providerEventKey", "providerMessageId", "eventType", "mappedStatus", "signatureVerified", "receivedAt", "processedAt", "processingStatus", "safePayloadJson", "failureReason", "duplicateCount", "createdAt"],
  smsEmailOperationalEvents: ["id", "integrationProfileId", "batchId", "eventKey", "eventType", "safeReason", "snapshotJson", "recordedByUserId", "createdAt"],
  smsEmailSuppressions: ["id", "channel", "subjectType", "guardianId", "staffMemberId", "contactHash", "contactMasked", "reason", "status", "providerReference", "reviewReason", "createdAt", "clearedAt", "createdByUserId", "clearedByUserId"],
  smsEmailCostRates: ["id", "integrationProfileId", "channel", "providerKind", "market", "messageCategory", "encodingType", "currency", "rateMinor", "unit", "rateVersion", "effectiveFrom", "sourceReviewDate", "notes", "status", "createdAt", "updatedAt"]
} as const;

type CollectionName = keyof typeof COLLECTIONS;
type SmsEmailBackupRows = Record<CollectionName, RestoreRecord[]>;

function rows(root: RestoreRecord, name: CollectionName): RestoreRecord[] {
  const value = root[name];
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${name}[${index}] must be an object`);
    const row = entry as RestoreRecord;
    const allowed = new Set<string>(COLLECTIONS[name]);
    for (const key of Object.keys(row)) {
      if (!allowed.has(key)) throw new Error(`${name}[${index}] contains unsupported field ${key}`);
      if (/(password|secret|token|credential|oauth|authorization|apiKey)/i.test(key)) {
        throw new Error(`${name}[${index}] contains forbidden credential field ${key}`);
      }
    }
    return row;
  });
}

function text(row: RestoreRecord, field: string, path: string) {
  const value = row[field];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path}.${field} is required`);
  return value.trim();
}

function unique(rows: RestoreRecord[], field: string, path: string) {
  const seen = new Set<string>();
  for (let index = 0; index < rows.length; index++) {
    const value = text(rows[index], field, `${path}[${index}]`);
    if (seen.has(value)) throw new Error(`${path}[${index}].${field} is duplicated`);
    seen.add(value);
  }
  return seen;
}

function exactSubject(row: RestoreRecord, path: string, references: { guardianIds: Set<string>; staffMemberIds: Set<string> }) {
  const type = text(row, "subjectType", path);
  const guardianId = typeof row.guardianId === "string" && row.guardianId ? row.guardianId : null;
  const staffMemberId = typeof row.staffMemberId === "string" && row.staffMemberId ? row.staffMemberId : null;
  if (type === "GUARDIAN" && (!guardianId || staffMemberId || !references.guardianIds.has(guardianId))) {
    throw new Error(`${path} has an invalid Guardian ownership link`);
  }
  if (type === "STAFF" && (!staffMemberId || guardianId || !references.staffMemberIds.has(staffMemberId))) {
    throw new Error(`${path} has an invalid Staff ownership link`);
  }
  if (!["GUARDIAN", "STAFF"].includes(type)) throw new Error(`${path}.subjectType is not supported`);
}

function validContactSnapshot(row: RestoreRecord, path: string) {
  const hash = text(row, "contactHash", path);
  const masked = text(row, "contactMasked", path);
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error(`${path}.contactHash must be a SHA-256 digest`);
  if (masked.includes("@") && !masked.includes("*")) throw new Error(`${path}.contactMasked must not contain a full Email address`);
  if (/^\+\d{8,15}$/.test(masked.replace(/\s/g, ""))) throw new Error(`${path}.contactMasked must not contain a full mobile number`);
}

export function validateSmsEmailBackupRows(
  root: RestoreRecord,
  references: {
    guardianIds: Set<string>;
    staffMemberIds: Set<string>;
    campaignIds: Set<string>;
    notificationRecipientIds: Set<string>;
  }
): SmsEmailBackupRows {
  const data = Object.fromEntries(
    (Object.keys(COLLECTIONS) as CollectionName[]).map((name) => [name, rows(root, name)])
  ) as SmsEmailBackupRows;

  const profileIds = unique(data.smsEmailIntegrationProfiles, "id", "smsEmailIntegrationProfiles");
  unique(data.smsEmailIntegrationProfiles, "profileCode", "smsEmailIntegrationProfiles");
  for (const [index, row] of data.smsEmailIntegrationProfiles.entries()) {
    if (!["SMS", "EMAIL"].includes(text(row, "channel", `smsEmailIntegrationProfiles[${index}]`))) throw new Error(`smsEmailIntegrationProfiles[${index}].channel is not supported`);
    if (row.liveSendingEnabled === true && row.mode !== "LIVE") throw new Error(`smsEmailIntegrationProfiles[${index}] cannot enable live sending outside LIVE mode`);
  }

  const consentIds = unique(data.smsEmailConsents, "id", "smsEmailConsents");
  for (const [index, row] of data.smsEmailConsents.entries()) {
    exactSubject(row, `smsEmailConsents[${index}]`, references);
    validContactSnapshot(row, `smsEmailConsents[${index}]`);
  }
  unique(data.smsEmailConsentEvents, "id", "smsEmailConsentEvents");
  data.smsEmailConsentEvents.forEach((row, index) => {
    if (!consentIds.has(text(row, "consentId", `smsEmailConsentEvents[${index}]`))) throw new Error(`smsEmailConsentEvents[${index}].consentId is invalid`);
  });

  const mappingIds = unique(data.smsEmailTemplateMappings, "id", "smsEmailTemplateMappings");
  unique(data.smsEmailTemplateMappings, "mappingCode", "smsEmailTemplateMappings");
  data.smsEmailTemplateMappings.forEach((row, index) => {
    if (!profileIds.has(text(row, "integrationProfileId", `smsEmailTemplateMappings[${index}]`))) throw new Error(`smsEmailTemplateMappings[${index}].integrationProfileId is invalid`);
  });

  const batchIds = unique(data.smsEmailOutboundBatches, "id", "smsEmailOutboundBatches");
  unique(data.smsEmailOutboundBatches, "batchNumber", "smsEmailOutboundBatches");
  data.smsEmailOutboundBatches.forEach((row, index) => {
    const path = `smsEmailOutboundBatches[${index}]`;
    if (!profileIds.has(text(row, "integrationProfileId", path)) || !mappingIds.has(text(row, "templateMappingId", path)) || !references.campaignIds.has(text(row, "notificationCampaignId", path))) {
      throw new Error(`${path} contains an invalid profile, template or campaign link`);
    }
  });

  const deliveryIds = unique(data.smsEmailDeliveries, "id", "smsEmailDeliveries");
  unique(data.smsEmailDeliveries, "requestFingerprint", "smsEmailDeliveries");
  const providerMessages = new Set<string>();
  data.smsEmailDeliveries.forEach((row, index) => {
    const path = `smsEmailDeliveries[${index}]`;
    if (!batchIds.has(text(row, "batchId", path)) || !consentIds.has(text(row, "consentId", path))) throw new Error(`${path} contains an invalid batch or consent link`);
    exactSubject(row, path, references);
    validContactSnapshot(row, path);
    if (typeof row.notificationRecipientId === "string" && row.notificationRecipientId && !references.notificationRecipientIds.has(row.notificationRecipientId)) throw new Error(`${path}.notificationRecipientId is invalid`);
    if (typeof row.providerMessageId === "string" && row.providerMessageId) {
      if (providerMessages.has(row.providerMessageId)) throw new Error(`${path}.providerMessageId is duplicated`);
      providerMessages.add(row.providerMessageId);
    }
  });

  unique(data.smsEmailDeliveryAttempts, "id", "smsEmailDeliveryAttempts");
  const attemptKeys = new Set<string>();
  data.smsEmailDeliveryAttempts.forEach((row, index) => {
    const path = `smsEmailDeliveryAttempts[${index}]`;
    const deliveryId = text(row, "deliveryId", path);
    const attemptNumber = Number(row.attemptNumber);
    if (!deliveryIds.has(deliveryId) || !Number.isInteger(attemptNumber) || attemptNumber < 1) throw new Error(`${path} has an invalid delivery or attempt number`);
    const key = `${deliveryId}|${attemptNumber}`;
    if (attemptKeys.has(key)) throw new Error(`${path} duplicates a delivery attempt number`);
    attemptKeys.add(key);
  });

  unique(data.smsEmailWebhookEvents, "id", "smsEmailWebhookEvents");
  unique(data.smsEmailWebhookEvents, "providerEventKey", "smsEmailWebhookEvents");
  data.smsEmailWebhookEvents.forEach((row, index) => {
    const path = `smsEmailWebhookEvents[${index}]`;
    if (!profileIds.has(text(row, "integrationProfileId", path))) throw new Error(`${path}.integrationProfileId is invalid`);
    if (typeof row.deliveryId === "string" && row.deliveryId && !deliveryIds.has(row.deliveryId)) throw new Error(`${path}.deliveryId is invalid`);
  });

  unique(data.smsEmailOperationalEvents, "id", "smsEmailOperationalEvents");
  unique(data.smsEmailOperationalEvents, "eventKey", "smsEmailOperationalEvents");
  data.smsEmailOperationalEvents.forEach((row, index) => {
    const path = `smsEmailOperationalEvents[${index}]`;
    if (!profileIds.has(text(row, "integrationProfileId", path))) throw new Error(`${path}.integrationProfileId is invalid`);
    if (typeof row.batchId === "string" && row.batchId && !batchIds.has(row.batchId)) throw new Error(`${path}.batchId is invalid`);
  });

  unique(data.smsEmailSuppressions, "id", "smsEmailSuppressions");
  data.smsEmailSuppressions.forEach((row, index) => {
    exactSubject(row, `smsEmailSuppressions[${index}]`, references);
    validContactSnapshot(row, `smsEmailSuppressions[${index}]`);
  });

  unique(data.smsEmailCostRates, "id", "smsEmailCostRates");
  data.smsEmailCostRates.forEach((row, index) => {
    const path = `smsEmailCostRates[${index}]`;
    if (typeof row.integrationProfileId === "string" && row.integrationProfileId && !profileIds.has(row.integrationProfileId)) throw new Error(`${path}.integrationProfileId is invalid`);
    if (!Number.isInteger(Number(row.rateMinor)) || Number(row.rateMinor) < 0) throw new Error(`${path}.rateMinor is invalid`);
  });

  return data;
}
