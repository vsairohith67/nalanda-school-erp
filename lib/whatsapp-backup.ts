type Row = Record<string, unknown>;

const PROFILE_KEYS = ["id","profileCode","displayName","provider","mode","status","graphApiVersion","businessAccountReference","phoneNumberReference","displayPhoneMasked","defaultCountryCode","quietHoursStart","quietHoursEnd","timezone","dailyMessageLimit","hourlyMessageLimit","costCapEnabled","maximumEstimatedBatchCostMinor","costCapCurrency","costCapUpdatedAt","maximumRetryCount","workerChunkSize","liveSendingEnabled","lastHealthCheckAt","lastHealthCheckStatus","lastHealthCheckMessage","createdAt","updatedAt"];
const CONSENT_KEYS = ["id","subjectType","guardianId","staffMemberId","channel","phoneHash","phoneLast4","countryCode","status","consentSource","consentWordingVersion","consentPurposeScope","evidenceReference","notes","optedInAt","optedOutAt","expiresAt","createdAt","updatedAt"];
const CONSENT_EVENT_KEYS = ["id","consentId","eventType","eventDate","previousStatus","newStatus","consentWordingVersion","reason","notes","createdAt"];
const MAPPING_KEYS = ["id","mappingCode","integrationProfileId","notificationCategory","internalPurpose","metaTemplateName","metaTemplateLanguage","metaTemplateCategory","providerTemplateId","providerStatus","parameterDefinitionJson","sampleValuesJson","status","lastSyncedAt","createdAt","updatedAt"];
const BATCH_KEYS = ["id","batchNumber","integrationProfileId","notificationCampaignId","notificationCampaignSnapshotJson","templateMappingId","templateMappingSnapshotJson","status","scheduledFor","emergencyOverride","emergencyOverrideReason","totalCampaignRecipients","totalEligibleContacts","totalSkipped","totalQueued","totalAccepted","totalSent","totalDelivered","totalRead","totalFailed","totalOptedOut","totalUnknown","skipReasonCountsJson","estimatedCostMinor","estimatedCostCurrency","estimateRateVersion","costCapOverrideSnapshotHash","costCapOverrideReason","costCapOverrideEstimateMinor","costCapOverrideLimitMinor","costCapOverrideCurrency","costCapOverrideRateVersion","costCapOverriddenAt","approvalNotes","cancellationReason","approvedAt","startedAt","completedAt","cancelledAt","createdAt","updatedAt"];
const DELIVERY_KEYS = ["id","batchId","notificationRecipientId","subjectType","subjectReferenceId","safeDisplayLabel","safeContextJson","phoneHash","phoneLast4","countryCode","consentId","templateNameSnapshot","templateLanguageSnapshot","templateCategorySnapshot","renderedParametersJson","requestFingerprint","providerMessageId","status","providerErrorCategory","providerErrorCode","failureMessageSafe","retryable","attemptCount","nextAttemptAt","claimedAt","acceptedAt","sentAt","deliveredAt","readAt","failedAt","optedOutAt","cancelledAt","createdAt","updatedAt"];
const ATTEMPT_KEYS = ["id","deliveryId","attemptNumber","requestFingerprint","providerMessageId","resultStatus","retryable","errorCategory","errorCode","safeErrorMessage","startedAt","completedAt","createdAt"];
const WEBHOOK_KEYS = ["id","integrationProfileId","eventKey","payloadHash","providerMessageId","deliveryId","eventType","mappedStatus","signatureValid","processingStatus","duplicateReceiptCount","safeSummaryJson","receivedAt","processedAt","createdAt"];
const OPERATIONAL_EVENT_KEYS = ["id","integrationProfileId","batchId","eventKey","eventType","limitValue","currentUsage","periodStart","periodEnd","nextEligibleAt","retryAfterSeconds","safeReason","estimatedCostMinor","costCapMinor","currency","rateVersion","snapshotHash","occurrenceCount","lastOccurredAt","createdAt"];
const RATE_KEYS = ["id","integrationProfileId","rateVersion","market","countryCallingCode","templateCategory","currency","ratePerDeliveredMessage","effectiveDate","sourceReviewDate","sourceUrl","notes","status","createdAt","updatedAt"];

export function validateWhatsAppBackupRows(source: Row, refs: {
  guardianIds: Set<string>; staffMemberIds: Set<string>; campaignIds: Set<string>; notificationRecipientIds: Set<string>;
}) {
  const profiles = rows(source.whatsAppIntegrationProfiles, "whatsAppIntegrationProfiles", PROFILE_KEYS);
  const consents = rows(source.whatsAppConsents, "whatsAppConsents", CONSENT_KEYS);
  const consentEvents = rows(source.whatsAppConsentEvents, "whatsAppConsentEvents", CONSENT_EVENT_KEYS);
  const mappings = rows(source.whatsAppTemplateMappings, "whatsAppTemplateMappings", MAPPING_KEYS);
  const batches = rows(source.whatsAppOutboundBatches, "whatsAppOutboundBatches", BATCH_KEYS);
  const deliveries = rows(source.whatsAppDeliveries, "whatsAppDeliveries", DELIVERY_KEYS);
  const attempts = rows(source.whatsAppDeliveryAttempts, "whatsAppDeliveryAttempts", ATTEMPT_KEYS);
  const webhooks = rows(source.whatsAppWebhookEvents, "whatsAppWebhookEvents", WEBHOOK_KEYS);
  const operationalEvents = rows(source.whatsAppOperationalEvents, "whatsAppOperationalEvents", OPERATIONAL_EVENT_KEYS);
  const rates = rows(source.whatsAppRateReferences, "whatsAppRateReferences", RATE_KEYS);
  for (const [key, value] of Object.entries({ profiles, consents, consentEvents, mappings, batches, deliveries, attempts, webhooks, operationalEvents, rates })) {
    assertNoSensitiveWhatsAppData(value, key);
  }
  const profileIds = unique(profiles, "id", "profile ID"); unique(profiles, "profileCode", "profile code", upper);
  const consentIds = unique(consents, "id", "consent ID");
  const mappingIds = unique(mappings, "id", "mapping ID"); unique(mappings, "mappingCode", "mapping code", upper);
  const batchIds = unique(batches, "id", "batch ID"); unique(batches, "batchNumber", "batch number", upper);
  const deliveryIds = unique(deliveries, "id", "delivery ID"); unique(deliveries.filter((row) => row.providerMessageId), "providerMessageId", "provider message ID");
  unique(attempts, "id", "attempt ID"); unique(webhooks, "id", "webhook ID"); unique(webhooks, "eventKey", "webhook event key");
  unique(operationalEvents, "id", "operational event ID"); unique(operationalEvents, "eventKey", "operational event key");
  consents.forEach((row, index) => {
    const guardianId = text(row.guardianId), staffId = text(row.staffMemberId);
    if ((guardianId ? 1 : 0) + (staffId ? 1 : 0) !== 1) throw new Error(`whatsAppConsents[${index}] must link exactly one Guardian or StaffMember`);
    if (guardianId && (!refs.guardianIds.has(guardianId) || row.subjectType !== "GUARDIAN")) throw new Error(`whatsAppConsents[${index}] Guardian link is invalid`);
    if (staffId && (!refs.staffMemberIds.has(staffId) || row.subjectType !== "STAFF")) throw new Error(`whatsAppConsents[${index}] Staff link is invalid`);
    if (!/^[a-f0-9]{64}$/i.test(required(row.phoneHash, `whatsAppConsents[${index}].phoneHash`)) || !/^\d{4}$/.test(required(row.phoneLast4, `whatsAppConsents[${index}].phoneLast4`))) throw new Error(`whatsAppConsents[${index}] phone identity is invalid`);
  });
  consentEvents.forEach((row, index) => link(consentIds, row.consentId, `whatsAppConsentEvents[${index}].consentId`));
  mappings.forEach((row, index) => link(profileIds, row.integrationProfileId, `whatsAppTemplateMappings[${index}].integrationProfileId`));
  batches.forEach((row, index) => {
    link(profileIds, row.integrationProfileId, `whatsAppOutboundBatches[${index}].integrationProfileId`);
    link(mappingIds, row.templateMappingId, `whatsAppOutboundBatches[${index}].templateMappingId`);
    link(refs.campaignIds, row.notificationCampaignId, `whatsAppOutboundBatches[${index}].notificationCampaignId`);
  });
  const deliveryProvider = new Map<string, string>();
  deliveries.forEach((row, index) => {
    link(batchIds, row.batchId, `whatsAppDeliveries[${index}].batchId`);
    link(consentIds, row.consentId, `whatsAppDeliveries[${index}].consentId`);
    if (row.notificationRecipientId) link(refs.notificationRecipientIds, row.notificationRecipientId, `whatsAppDeliveries[${index}].notificationRecipientId`);
    const ref = required(row.subjectReferenceId, `whatsAppDeliveries[${index}].subjectReferenceId`);
    if (row.subjectType === "GUARDIAN" ? !refs.guardianIds.has(ref) : row.subjectType === "STAFF" ? !refs.staffMemberIds.has(ref) : true) throw new Error(`whatsAppDeliveries[${index}] subject link is invalid`);
    if (row.providerMessageId) deliveryProvider.set(String(row.providerMessageId), required(row.id, "delivery id"));
  });
  attempts.forEach((row, index) => link(deliveryIds, row.deliveryId, `whatsAppDeliveryAttempts[${index}].deliveryId`));
  webhooks.forEach((row, index) => {
    link(profileIds, row.integrationProfileId, `whatsAppWebhookEvents[${index}].integrationProfileId`);
    if (row.deliveryId) {
      link(deliveryIds, row.deliveryId, `whatsAppWebhookEvents[${index}].deliveryId`);
      if (row.providerMessageId && deliveryProvider.get(String(row.providerMessageId)) !== String(row.deliveryId)) throw new Error(`whatsAppWebhookEvents[${index}] provider message belongs to another delivery`);
    }
  });
  operationalEvents.forEach((row, index) => {
    link(profileIds, row.integrationProfileId, `whatsAppOperationalEvents[${index}].integrationProfileId`);
    if (row.batchId) link(batchIds, row.batchId, `whatsAppOperationalEvents[${index}].batchId`);
  });
  rates.forEach((row, index) => { if (row.integrationProfileId) link(profileIds, row.integrationProfileId, `whatsAppRateReferences[${index}].integrationProfileId`); });
  return {
    whatsAppIntegrationProfiles: profiles,
    whatsAppConsents: consents,
    whatsAppConsentEvents: consentEvents,
    whatsAppTemplateMappings: mappings,
    whatsAppOutboundBatches: batches,
    whatsAppDeliveries: deliveries,
    whatsAppDeliveryAttempts: attempts,
    whatsAppWebhookEvents: webhooks,
    whatsAppOperationalEvents: operationalEvents,
    whatsAppRateReferences: rates
  };
}

function rows(value: unknown, label: string, allowed: string[]) {
  if (value == null) return [] as Row[];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label}[${index}] must be an object`);
    for (const key of Object.keys(item)) if (!allowed.includes(key)) throw new Error(`${label}[${index}] contains unsupported field ${key}`);
    return item as Row;
  });
}
function unique(rows: Row[], key: string, label: string, normalize = (value: string) => value) {
  const values = rows.map((row, index) => normalize(required(row[key], `${label} at row ${index}`)));
  if (new Set(values).size !== values.length) throw new Error(`WhatsApp backup contains duplicate ${label}`);
  return new Set(values);
}
function link(set: Set<string>, value: unknown, label: string) { if (!set.has(required(value, label))) throw new Error(`${label} does not match this backup`); }
function required(value: unknown, label: string) { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; }
function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function upper(value: string) { return value.toUpperCase(); }
function assertNoSensitiveWhatsAppData(rows: Row[], label: string) {
  const json = JSON.stringify(rows);
  if (/(access.?token|app.?secret|verify.?token|authorization|bearer\s)/i.test(json)) throw new Error(`${label} contains a credential-like value`);
  if (/\\?["']?(?:to|e164|fullPhone|mobile|primaryMobile)\\?["']?\s*:/i.test(json)) throw new Error(`${label} contains a full-phone field`);
  if (/\+[1-9]\d{7,14}/.test(json)) throw new Error(`${label} contains a full E.164 phone number`);
}
