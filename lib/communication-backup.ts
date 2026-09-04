import type { PrismaClient } from "@prisma/client";
import { databaseTableExists } from "@/lib/database-capabilities";

export const COMMUNICATION_BACKUP_KEYS = [
  "communicationContactPoints",
  "communicationTemplateDefinitions",
  "communicationTemplateVersions",
  "communicationPreferences",
  "communicationConsents",
  "communicationProviderProfiles",
  "communicationIntents",
  "communicationOutboxItems",
  "communicationAttempts",
  "communicationDeliveryReceipts",
  "communicationWebhookEvents",
  "nativePushEndpoints",
  "communicationAuditEvents"
] as const;

export type CommunicationBackupKey = (typeof COMMUNICATION_BACKUP_KEYS)[number];
export type CommunicationBackup = Record<CommunicationBackupKey, Record<string, unknown>[]>;
export type CommunicationRestoreResult = Record<CommunicationBackupKey, { created: number; updated: number; skipped: number; errors: string[] }>;
export type CommunicationRestoreIdentityMaps = {
  users: Map<string, string>;
  guardians: Map<string, string>;
  staffMembers: Map<string, string>;
  restoredBy: string;
};

const APPEND_ONLY_KEYS = new Set<CommunicationBackupKey>([
  "communicationAttempts",
  "communicationDeliveryReceipts",
  "communicationAuditEvents"
]);

const MODEL_BY_KEY: Record<CommunicationBackupKey, string> = {
  communicationContactPoints: "communicationContactPoint",
  communicationTemplateDefinitions: "communicationTemplateDefinition",
  communicationTemplateVersions: "communicationTemplateVersion",
  communicationPreferences: "communicationPreference",
  communicationConsents: "communicationConsent",
  communicationProviderProfiles: "communicationProviderProfile",
  communicationIntents: "communicationIntent",
  communicationOutboxItems: "communicationOutboxItem",
  communicationAttempts: "communicationAttempt",
  communicationDeliveryReceipts: "communicationDeliveryReceipt",
  communicationWebhookEvents: "communicationWebhookEvent",
  nativePushEndpoints: "nativePushEndpoint",
  communicationAuditEvents: "communicationAuditEvent"
};

const FIELDS: Record<CommunicationBackupKey, Set<string>> = {
  communicationContactPoints: fields("id identityKey subjectType subjectReferenceId channel contactType version status destinationDigest destinationMasked verifiedAt invalidatedAt invalidationReason createdAt updatedAt"),
  communicationTemplateDefinitions: fields("id templateKey purpose module status activeVersion createdAt updatedAt"),
  communicationTemplateVersions: fields("id templateDefinitionId version locale languageReviewStatus channel subjectTemplate titleTemplate bodyTemplate actionPathTemplate placeholderAllowlistJson contentClassification status contentHash approvedByUserId approvedAt retiredAt createdAt"),
  communicationPreferences: fields("id userId category channel optionalEnabled preferred locale quietHoursStart quietHoursEnd timezone digestFrequency version updatedByUserId createdAt updatedAt"),
  communicationConsents: fields("id identityKey subjectType subjectReferenceId channel purpose status source evidenceReference contactVersion capturedAt expiresAt revokedAt disputedAt supersedesConsentId activeKey recordedByUserId createdAt"),
  communicationProviderProfiles: fields("id profileCode channel adapterKind environment status operationalEnabled senderLabel region templateMappingJson ratePolicyJson costPolicyJson circuitState consecutiveFailureCount circuitOpenedAt circuitRetryAt lastHealthAt lastHealthStatus createdAt updatedAt"),
  communicationIntents: fields("id eventType purpose module sourceRecordType sourceRecordId sourceEventId recipientPolicy recipientPolicyVersion recipientScopeJson eligibleChannelsJson templateKey templateVersion localePreference priority notBefore expiresAt deduplicationKey idempotencyKey initiatingActorId authorizingContextJson audienceSnapshotHash state cancellationReason cancelledByUserId cancelledAt createdAt updatedAt"),
  communicationOutboxItems: fields("id intentId recipientUserId recipientSubjectType recipientSubjectReferenceId channel contactPointId contactVersion destinationDigest destinationMasked locale templateKey templateVersion substitutionsJson contentHash deduplicationKey idempotencyKey state priority providerProfileCode providerMessageId scheduledAt expiresAt attemptCount maximumAttempts nextAttemptAt acceptedAt sentAt deliveredAt failedAt cancelledAt inAppReadAt inAppArchivedAt lastSafeErrorCode lastSafeErrorMessage estimatedCostMinor estimatedCostCurrency createdAt updatedAt"),
  communicationAttempts: fields("id outboxItemId attemptNumber adapterKind requestHash resultState providerMessageId retryable safeErrorCode safeErrorMessage retryAfterAt startedAt completedAt"),
  communicationDeliveryReceipts: fields("id outboxItemId providerEventKey providerMessageId state occurredAt evidenceHash safeMetadataJson createdAt"),
  communicationWebhookEvents: fields("id providerProfileCode providerEventKey payloadHash signatureVerified timestampVerified contentTypeVerified processingState duplicateCount safeMetadataJson receivedAt processedAt"),
  nativePushEndpoints: fields("id userId nativeDeviceReference environment platform appVersion tokenDigest tokenMasked status verifiedAt revokedAt createdAt updatedAt"),
  communicationAuditEvents: fields("id intentId outboxItemId eventType previousState newState actorUserId safeReason safeMetadataJson occurredAt")
};

const DATE_FIELDS = new Set([
  "verifiedAt", "invalidatedAt", "createdAt", "updatedAt", "approvedAt", "retiredAt", "capturedAt", "expiresAt",
  "revokedAt", "disputedAt", "circuitOpenedAt", "circuitRetryAt", "lastHealthAt", "notBefore", "cancelledAt",
  "scheduledAt", "nextAttemptAt", "acceptedAt", "sentAt", "deliveredAt", "failedAt", "inAppReadAt", "inAppArchivedAt",
  "retryAfterAt", "startedAt", "completedAt", "occurredAt", "receivedAt", "processedAt"
]);

const HASH_FIELDS = new Set(["destinationDigest", "contentHash", "requestHash", "evidenceHash", "payloadHash", "tokenDigest", "audienceSnapshotHash"]);
const JSON_FIELDS = new Set(["placeholderAllowlistJson", "templateMappingJson", "ratePolicyJson", "costPolicyJson", "recipientScopeJson", "eligibleChannelsJson", "authorizingContextJson", "substitutionsJson", "safeMetadataJson"]);

export function emptyCommunicationBackup(): CommunicationBackup {
  return Object.fromEntries(COMMUNICATION_BACKUP_KEYS.map((key) => [key, []])) as unknown as CommunicationBackup;
}

export async function communicationSchemaAvailable(client: PrismaClient) {
  try {
    return Boolean((client as any).communicationIntent?.findMany) && await databaseTableExists(client, "CommunicationIntent");
  } catch {
    return false;
  }
}

export async function loadCommunicationBackup(client: PrismaClient): Promise<CommunicationBackup> {
  const output = emptyCommunicationBackup();
  for (const key of COMMUNICATION_BACKUP_KEYS) {
    const delegate = (client as any)[MODEL_BY_KEY[key]];
    const rows = await delegate.findMany({ orderBy: { id: "asc" } });
    output[key] = rows.map((value: Record<string, unknown>) => sanitizeRow(key, value));
  }
  return output;
}

export function validateCommunicationBackupRows(root: Record<string, unknown>): CommunicationBackup {
  const output = emptyCommunicationBackup();
  for (const key of COMMUNICATION_BACKUP_KEYS) {
    const value = root[key];
    if (value === undefined) continue;
    if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${key} must be a bounded array`);
    const seen = new Set<string>();
    output[key] = value.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${key}[${index}] must be an object`);
      const row = entry as Record<string, unknown>;
      for (const field of Object.keys(row)) if (!FIELDS[key].has(field)) throw new Error(`${key}[${index}].${field} is not allowed`);
      const id = requiredText(row.id, `${key}[${index}].id`);
      if (seen.has(id)) throw new Error(`${key}[${index}].id is duplicated`);
      seen.add(id);
      for (const field of HASH_FIELDS) if (row[field] != null && !/^[a-f0-9]{64}$/i.test(String(row[field]))) throw new Error(`${key}[${index}].${field} must be a SHA-256 digest`);
      for (const field of JSON_FIELDS) if (row[field] != null) validateJson(String(row[field]), `${key}[${index}].${field}`);
      for (const field of DATE_FIELDS) if (row[field] != null && Number.isNaN(new Date(String(row[field])).getTime())) throw new Error(`${key}[${index}].${field} must be a date`);
      return sanitizeRow(key, row);
    });
  }
  validateReferences(output);
  return output;
}

export async function restoreCommunicationBackup(client: PrismaClient, backup: CommunicationBackup, result: CommunicationRestoreResult, identityMaps: CommunicationRestoreIdentityMaps) {
  for (const key of COMMUNICATION_BACKUP_KEYS) {
    const delegate = (client as any)[MODEL_BY_KEY[key]];
    for (const [index, row] of backup[key].entries()) {
      try {
        const mapped = mapRestoreRow(key, row, identityMaps);
        if (!mapped) { result[key].skipped++; continue; }
        const data = restoreDates(mapped);
        const current = await delegate.findUnique({ where: { id: String(row.id) } });
        if (current) {
          if (APPEND_ONLY_KEYS.has(key)) { result[key].skipped++; continue; }
          const { id: _id, ...update } = data;
          await delegate.update({ where: { id: String(row.id) }, data: update });
          result[key].updated++;
        } else {
          await delegate.create({ data });
          result[key].created++;
        }
      } catch (error) {
        result[key].errors.push(`${key}[${index}]: ${error instanceof Error ? error.message : "restore failed"}`);
      }
    }
  }
}

function mapRestoreRow(key: CommunicationBackupKey, source: Record<string, unknown>, maps: CommunicationRestoreIdentityMaps) {
  const row = { ...source };
  const requiredSubject = (subjectType: unknown, subjectReferenceId: unknown, targetField = "subjectReferenceId") => {
    const mapped = mapSubjectReference(String(subjectType ?? ""), String(subjectReferenceId ?? ""), maps);
    if (!mapped) return false;
    row[targetField] = mapped;
    if ("identityKey" in row) row.identityKey = mapped;
    return true;
  };
  const optionalActor = (field: string) => {
    if (row[field] == null) return;
    row[field] = maps.users.get(String(row[field])) ?? maps.restoredBy;
  };
  if (key === "communicationContactPoints" || key === "communicationConsents") {
    if (!requiredSubject(row.subjectType, row.subjectReferenceId)) return null;
    if (key === "communicationConsents") optionalActor("recordedByUserId");
  }
  if (key === "communicationPreferences") {
    const userId = maps.users.get(String(row.userId ?? ""));
    if (!userId) return null;
    row.userId = userId;
    row.updatedByUserId = maps.users.get(String(row.updatedByUserId ?? "")) ?? maps.restoredBy;
  }
  if (key === "communicationTemplateVersions") optionalActor("approvedByUserId");
  if (key === "communicationIntents") {
    row.initiatingActorId = maps.users.get(String(row.initiatingActorId ?? "")) ?? maps.restoredBy;
    optionalActor("cancelledByUserId");
  }
  if (key === "communicationOutboxItems") {
    if (!requiredSubject(row.recipientSubjectType, row.recipientSubjectReferenceId, "recipientSubjectReferenceId")) return null;
    if (row.recipientUserId != null) {
      const userId = maps.users.get(String(row.recipientUserId));
      if (!userId) return null;
      row.recipientUserId = userId;
    }
    if (["CLAIMED", "SENDING"].includes(String(row.state))) {
      row.state = "DEAD_LETTER";
      row.nextAttemptAt = null;
      row.failedAt = row.updatedAt ?? row.createdAt;
      row.lastSafeErrorCode = "RESTORED_INFLIGHT_REQUIRES_REVIEW";
      row.lastSafeErrorMessage = "An in-flight item was restored into a non-sending manual-review state.";
    }
  }
  if (key === "nativePushEndpoints") {
    const userId = maps.users.get(String(row.userId ?? ""));
    if (!userId) return null;
    row.userId = userId;
  }
  if (key === "communicationAuditEvents") optionalActor("actorUserId");
  return row;
}

function mapSubjectReference(subjectType: string, reference: string, maps: CommunicationRestoreIdentityMaps) {
  if (subjectType === "SYNTHETIC") return reference;
  if (subjectType === "USER") return maps.users.get(reference) ?? null;
  if (subjectType === "GUARDIAN") return maps.guardians.get(reference) ?? null;
  if (subjectType === "STAFF") return maps.staffMembers.get(reference) ?? null;
  return null;
}

function sanitizeRow(key: CommunicationBackupKey, value: Record<string, unknown>) {
  const allowed = FIELDS[key];
  const safe = Object.fromEntries(Object.entries(value).filter(([field]) => allowed.has(field)));
  if (key === "communicationProviderProfiles") return { ...safe, status: "DISABLED", operationalEnabled: false };
  if (key === "nativePushEndpoints" && safe.status !== "REVOKED") return { ...safe, status: "SYNTHETIC_ONLY" };
  return safe;
}

function restoreDates(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([field, value]) => [field, value != null && DATE_FIELDS.has(field) ? new Date(String(value)) : value]));
}

function validateReferences(backup: CommunicationBackup) {
  const templateIds = ids(backup.communicationTemplateDefinitions);
  const intentIds = ids(backup.communicationIntents);
  const itemIds = ids(backup.communicationOutboxItems);
  backup.communicationTemplateVersions.forEach((row, index) => linked(templateIds, row.templateDefinitionId, `communicationTemplateVersions[${index}].templateDefinitionId`));
  backup.communicationOutboxItems.forEach((row, index) => linked(intentIds, row.intentId, `communicationOutboxItems[${index}].intentId`));
  backup.communicationAttempts.forEach((row, index) => linked(itemIds, row.outboxItemId, `communicationAttempts[${index}].outboxItemId`));
  backup.communicationDeliveryReceipts.forEach((row, index) => linked(itemIds, row.outboxItemId, `communicationDeliveryReceipts[${index}].outboxItemId`));
}

function fields(value: string) { return new Set(value.split(/\s+/)); }
function ids(rows: Record<string, unknown>[]) { return new Set(rows.map((row) => String(row.id))); }
function linked(values: Set<string>, value: unknown, label: string) { if (!values.has(requiredText(value, label))) throw new Error(`${label} does not reference a backed-up row`); }
function requiredText(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text || text.length > 512) throw new Error(`${label} is invalid`); return text; }
function validateJson(value: string, label: string) { if (value.length > 100_000) throw new Error(`${label} is too large`); try { JSON.parse(value); } catch { throw new Error(`${label} is invalid JSON`); } }
