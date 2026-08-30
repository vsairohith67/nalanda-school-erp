import type { PrismaClient } from "@prisma/client";

import { databaseTableExists } from "@/lib/database-capabilities";
import { normalizeBridgeJwk } from "@/lib/biometric-attendance/jwk";

export const BIOMETRIC_ATTENDANCE_BACKUP_KEYS = [
  "biometricBridges",
  "biometricDevices",
  "biometricStaffMappings",
  "biometricIngestBatches",
  "biometricRawPunches",
  "biometricSequenceGaps",
  "biometricAttendancePolicies",
  "biometricReconciliations",
  "biometricCorrections",
  "biometricAuditEvents"
] as const;

export type BiometricAttendanceBackupKey = (typeof BIOMETRIC_ATTENDANCE_BACKUP_KEYS)[number];
export type BiometricAttendanceBackup = Record<BiometricAttendanceBackupKey, Record<string, unknown>[]>;
type EntityResult = { created: number; updated: number; skipped: number; errors: string[] };
type RestoreResult = Record<BiometricAttendanceBackupKey, EntityResult> & { warnings: string[] };

const FIELDS: Record<BiometricAttendanceBackupKey, Set<string>> = {
  biometricBridges: fields("id publicBridgeId label publicSigningKey publicKeyHash keyAlgorithm keyVersion status approvedByUserId approvedAt revokedByUserId revokedAt revocationReason lastSyncAt lastEventAt lastHealthAt createdAt updatedAt"),
  biometricDevices: fields("id publicDeviceId bridgeId vendor model firmware serialReferenceMasked campus location protocolProfile protocolProofStatus status healthStatus clockDriftSeconds clockDriftStatus sequenceEpoch lastSequence lastEventAt lastSyncAt lastHealthAt approvedByUserId approvedAt revokedByUserId revokedAt revocationReason version createdAt updatedAt"),
  biometricStaffMappings: fields("id publicKey deviceId opaqueDeviceUserId staffMemberId status effectiveFrom effectiveTo preparedByUserId preparationReason approvedByUserId approvedAt revokedByUserId revokedAt revocationReason version createdAt updatedAt"),
  biometricIngestBatches: fields("id batchReference bridgeId requestHash nonceHash keyVersion eventCount sequenceStart sequenceEnd status receivedAt completedAt createdAt"),
  biometricRawPunches: fields("id publicKey eventIdentityHash eventPayloadHash batchId bridgeId deviceId mappingId staffMemberId opaqueDeviceUserId punchTimestamp bridgeReceivedTimestamp receivedTimestamp verificationMethod punchCode statusCode sequenceNumber sequenceEpoch eventReference protocolProfile clockDriftSeconds clockDriftStatus reconciliationStatus createdAt"),
  biometricSequenceGaps: fields("id deviceId batchId sequenceEpoch expectedSequence receivedSequence status detectedAt acknowledgedByUserId acknowledgedAt acknowledgementNote"),
  biometricAttendancePolicies: fields("id publicKey name campus effectiveFrom effectiveTo shiftStartTime shiftEndTime workdayBasis shiftType graceMinutes lateThresholdMinutes earlyDepartureGraceMinutes earlyDepartureThresholdMinutes fullDayThresholdMinutes halfDayThresholdMinutes halfDayRule missingInBehavior missingOutBehavior multiplePunchStrategy leaveInteraction holidayInteraction overnightShiftEnabled splitShiftEnabled status preparedByUserId approvedByUserId approvedAt version createdAt updatedAt"),
  biometricReconciliations: fields("id publicKey staffMemberId attendanceDate policyId status outcome firstPunchId lastPunchId punchCount checkInTime checkOutTime lateMinutes earlyDepartureMinutes exceptionCode leaveRequestId calendarDayId attendanceRecordId preparedByUserId preparedAt approvedByUserId approvedAt version createdAt updatedAt"),
  biometricCorrections: fields("id publicKey reconciliationId requestedByUserId preparedByUserId approvedByUserId reason originalEvidenceJson beforeJson afterJson status submittedAt approvedAt rejectedAt rejectionReason version createdAt"),
  biometricAuditEvents: fields("id entityType entityId eventType actorUserId safeMetadataJson occurredAt")
};

const REQUIRED: Record<BiometricAttendanceBackupKey, string[]> = {
  biometricBridges: required("id publicBridgeId label publicSigningKey publicKeyHash keyAlgorithm keyVersion status createdAt updatedAt"),
  biometricDevices: required("id publicDeviceId bridgeId vendor model campus location protocolProfile protocolProofStatus status healthStatus clockDriftStatus sequenceEpoch version createdAt updatedAt"),
  biometricStaffMappings: required("id publicKey deviceId opaqueDeviceUserId staffMemberId status effectiveFrom preparedByUserId preparationReason version createdAt updatedAt"),
  biometricIngestBatches: required("id batchReference bridgeId requestHash nonceHash keyVersion eventCount status receivedAt createdAt"),
  biometricRawPunches: required("id publicKey eventIdentityHash eventPayloadHash batchId bridgeId deviceId opaqueDeviceUserId punchTimestamp bridgeReceivedTimestamp receivedTimestamp verificationMethod punchCode sequenceEpoch protocolProfile clockDriftStatus reconciliationStatus createdAt"),
  biometricSequenceGaps: required("id deviceId batchId sequenceEpoch expectedSequence receivedSequence status detectedAt"),
  biometricAttendancePolicies: required("id publicKey name campus effectiveFrom shiftStartTime shiftEndTime workdayBasis shiftType graceMinutes lateThresholdMinutes earlyDepartureGraceMinutes earlyDepartureThresholdMinutes fullDayThresholdMinutes halfDayThresholdMinutes halfDayRule missingInBehavior missingOutBehavior multiplePunchStrategy leaveInteraction holidayInteraction overnightShiftEnabled splitShiftEnabled status preparedByUserId version createdAt updatedAt"),
  biometricReconciliations: required("id publicKey staffMemberId attendanceDate status outcome punchCount version createdAt updatedAt"),
  biometricCorrections: required("id publicKey reconciliationId requestedByUserId reason originalEvidenceJson beforeJson afterJson status submittedAt version createdAt"),
  biometricAuditEvents: required("id entityType entityId eventType occurredAt")
};

const DATE_FIELDS: Partial<Record<BiometricAttendanceBackupKey, string[]>> = {
  biometricBridges: required("approvedAt revokedAt lastSyncAt lastEventAt lastHealthAt createdAt updatedAt"),
  biometricDevices: required("lastEventAt lastSyncAt lastHealthAt approvedAt revokedAt createdAt updatedAt"),
  biometricStaffMappings: required("effectiveFrom effectiveTo approvedAt revokedAt createdAt updatedAt"),
  biometricIngestBatches: required("receivedAt completedAt createdAt"),
  biometricRawPunches: required("punchTimestamp bridgeReceivedTimestamp receivedTimestamp createdAt"),
  biometricSequenceGaps: required("detectedAt acknowledgedAt"),
  biometricAttendancePolicies: required("effectiveFrom effectiveTo approvedAt createdAt updatedAt"),
  biometricReconciliations: required("attendanceDate preparedAt approvedAt createdAt updatedAt"),
  biometricCorrections: required("submittedAt approvedAt rejectedAt createdAt"),
  biometricAuditEvents: required("occurredAt")
};

export function emptyBiometricAttendanceBackup(): BiometricAttendanceBackup {
  return Object.fromEntries(BIOMETRIC_ATTENDANCE_BACKUP_KEYS.map((key) => [key, []])) as unknown as BiometricAttendanceBackup;
}

export async function biometricAttendanceSchemaAvailable(client: PrismaClient) {
  try {
    if (!(client as unknown as { biometricBridge?: { findMany?: unknown } }).biometricBridge?.findMany) return false;
    return await databaseTableExists(client, "BiometricBridge");
  } catch {
    return false;
  }
}

export async function loadBiometricAttendanceBackup(client: PrismaClient): Promise<BiometricAttendanceBackup> {
  const [bridges, devices, mappings, batches, punches, gaps, policies, reconciliations, corrections, events] = await Promise.all([
    client.biometricBridge.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.biometricDevice.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.biometricStaffMapping.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.biometricIngestBatch.findMany({ orderBy: [{ receivedAt: "asc" }, { id: "asc" }] }),
    client.biometricRawPunch.findMany({ orderBy: [{ receivedTimestamp: "asc" }, { id: "asc" }] }),
    client.biometricSequenceGap.findMany({ orderBy: [{ detectedAt: "asc" }, { id: "asc" }] }),
    client.biometricAttendancePolicy.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.biometricReconciliation.findMany({ orderBy: [{ attendanceDate: "asc" }, { id: "asc" }] }),
    client.biometricCorrection.findMany({ orderBy: [{ submittedAt: "asc" }, { id: "asc" }] }),
    client.biometricAuditEvent.findMany({ orderBy: [{ occurredAt: "asc" }, { id: "asc" }] })
  ]);
  return {
    biometricBridges: bridges,
    biometricDevices: devices,
    biometricStaffMappings: mappings,
    biometricIngestBatches: batches,
    biometricRawPunches: punches,
    biometricSequenceGaps: gaps,
    biometricAttendancePolicies: policies,
    biometricReconciliations: reconciliations,
    biometricCorrections: corrections,
    biometricAuditEvents: events
  };
}

export function validateBiometricAttendanceBackupRows(root: Record<string, unknown>): BiometricAttendanceBackup {
  const backup = Object.fromEntries(BIOMETRIC_ATTENDANCE_BACKUP_KEYS.map((key) => [key, rows(root[key], key, FIELDS[key], REQUIRED[key])])) as BiometricAttendanceBackup;
  const bridgeIds = unique(backup.biometricBridges, "biometricBridges", "id");
  unique(backup.biometricBridges, "biometricBridges", "publicBridgeId");
  const deviceIds = unique(backup.biometricDevices, "biometricDevices", "id");
  unique(backup.biometricDevices, "biometricDevices", "publicDeviceId");
  const mappingIds = unique(backup.biometricStaffMappings, "biometricStaffMappings", "id");
  const batchIds = unique(backup.biometricIngestBatches, "biometricIngestBatches", "id");
  const punchIds = unique(backup.biometricRawPunches, "biometricRawPunches", "id");
  unique(backup.biometricRawPunches, "biometricRawPunches", "eventIdentityHash");
  const policyIds = unique(backup.biometricAttendancePolicies, "biometricAttendancePolicies", "id");
  const reconciliationIds = unique(backup.biometricReconciliations, "biometricReconciliations", "id");

  backup.biometricBridges.forEach((row, index) => {
    oneOf(row.status, ["PENDING_APPROVAL", "ACTIVE", "REVOKED", "RETIRED"], `biometricBridges[${index}].status`);
    oneOf(row.keyAlgorithm, ["ED25519", "ECDSA_P256_SHA256"], `biometricBridges[${index}].keyAlgorithm`);
    hash(row.publicKeyHash, `biometricBridges[${index}].publicKeyHash`);
    safeJson(row.publicSigningKey, `biometricBridges[${index}].publicSigningKey`, 4_000);
    const normalized = normalizeBridgeJwk(row.publicSigningKey);
    const serialized = JSON.stringify(normalized.jwk);
    if (normalized.algorithm !== row.keyAlgorithm || serialized !== row.publicSigningKey) {
      throw new Error(`biometricBridges[${index}].publicSigningKey is not a canonical public verification key`);
    }
  });
  backup.biometricDevices.forEach((row, index) => {
    linked(bridgeIds, row.bridgeId, `biometricDevices[${index}].bridgeId`);
    oneOf(row.protocolProfile, ["ESSL_K30_PRO_PUSH", "ESSL_ZK_LAN_SDK", "ZK_ADMS_PUSH", "GENERIC_ADMS_PUSH", "GENERIC_LAN_POLL", "GENERIC_CSV_IMPORT", "SIMULATOR"], `biometricDevices[${index}].protocolProfile`);
    oneOf(row.protocolProofStatus, ["NOT_PROVIDED", "NOT_REQUIRED", "OFFICIAL_VERIFIED", "ADAPTER_CONTRACT_PENDING", "ADAPTER_CONTRACT_APPROVED"], `biometricDevices[${index}].protocolProofStatus`);
    oneOf(row.status, ["PENDING_APPROVAL", "ACTIVE", "REVOKED", "RETIRED"], `biometricDevices[${index}].status`);
    oneOf(row.clockDriftStatus, ["HEALTHY", "WARNING", "UNTRUSTED_TIME", "UNKNOWN"], `biometricDevices[${index}].clockDriftStatus`);
  });
  backup.biometricStaffMappings.forEach((row, index) => {
    linked(deviceIds, row.deviceId, `biometricStaffMappings[${index}].deviceId`);
    oneOf(row.status, ["PENDING_APPROVAL", "ACTIVE", "REVOKED"], `biometricStaffMappings[${index}].status`);
  });
  backup.biometricIngestBatches.forEach((row, index) => {
    linked(bridgeIds, row.bridgeId, `biometricIngestBatches[${index}].bridgeId`);
    hash(row.requestHash, `biometricIngestBatches[${index}].requestHash`);
    hash(row.nonceHash, `biometricIngestBatches[${index}].nonceHash`);
    oneOf(row.status, ["RECEIVED", "COMPLETED", "REJECTED"], `biometricIngestBatches[${index}].status`);
  });
  backup.biometricRawPunches.forEach((row, index) => {
    linked(batchIds, row.batchId, `biometricRawPunches[${index}].batchId`);
    linked(bridgeIds, row.bridgeId, `biometricRawPunches[${index}].bridgeId`);
    linked(deviceIds, row.deviceId, `biometricRawPunches[${index}].deviceId`);
    if (row.mappingId) linked(mappingIds, row.mappingId, `biometricRawPunches[${index}].mappingId`);
    hash(row.eventIdentityHash, `biometricRawPunches[${index}].eventIdentityHash`);
    hash(row.eventPayloadHash, `biometricRawPunches[${index}].eventPayloadHash`);
    oneOf(row.clockDriftStatus, ["HEALTHY", "WARNING", "UNTRUSTED_TIME", "UNKNOWN"], `biometricRawPunches[${index}].clockDriftStatus`);
    oneOf(row.reconciliationStatus, ["PENDING", "MAPPED_PENDING", "RECONCILED", "UNMAPPED_STAFF", "MAPPING_CONFLICT", "INACTIVE_STAFF", "DEVICE_EXCEPTION", "DEVICE_TIME_UNTRUSTED"], `biometricRawPunches[${index}].reconciliationStatus`);
  });
  backup.biometricSequenceGaps.forEach((row, index) => {
    linked(deviceIds, row.deviceId, `biometricSequenceGaps[${index}].deviceId`);
    linked(batchIds, row.batchId, `biometricSequenceGaps[${index}].batchId`);
    oneOf(row.status, ["OPEN", "ACKNOWLEDGED", "RESOLVED"], `biometricSequenceGaps[${index}].status`);
  });
  backup.biometricAttendancePolicies.forEach((row, index) => {
    oneOf(row.status, ["DRAFT", "ACTIVE", "RETIRED"], `biometricAttendancePolicies[${index}].status`);
    if (row.overnightShiftEnabled !== false || row.splitShiftEnabled !== false) throw new Error(`biometricAttendancePolicies[${index}] complex shifts are not supported in 1A`);
  });
  backup.biometricReconciliations.forEach((row, index) => {
    if (row.policyId) linked(policyIds, row.policyId, `biometricReconciliations[${index}].policyId`);
    if (row.firstPunchId) linked(punchIds, row.firstPunchId, `biometricReconciliations[${index}].firstPunchId`);
    if (row.lastPunchId) linked(punchIds, row.lastPunchId, `biometricReconciliations[${index}].lastPunchId`);
    oneOf(row.status, ["PENDING", "READY_FOR_APPROVAL", "EXCEPTION", "APPROVED", "CORRECTED"], `biometricReconciliations[${index}].status`);
    oneOf(row.outcome, ["UNRESOLVED","PRESENT","ABSENT_PENDING_REVIEW","LATE","EARLY_DEPARTURE","LATE_AND_EARLY","HALF_DAY","ON_APPROVED_LEAVE","NON_WORKING_DAY","HOLIDAY_PUNCH","MISSING_IN","MISSING_OUT","MULTIPLE_PUNCHES","UNMAPPED_STAFF","DEVICE_TIME_UNTRUSTED","DEVICE_EXCEPTION","EXCEPTION"], `biometricReconciliations[${index}].outcome`);
  });
  backup.biometricCorrections.forEach((row, index) => {
    linked(reconciliationIds, row.reconciliationId, `biometricCorrections[${index}].reconciliationId`);
    oneOf(row.status, ["SUBMITTED", "APPROVED", "REJECTED"], `biometricCorrections[${index}].status`);
    safeJson(row.originalEvidenceJson, `biometricCorrections[${index}].originalEvidenceJson`, 100_000);
    safeJson(row.beforeJson, `biometricCorrections[${index}].beforeJson`, 10_000);
    safeJson(row.afterJson, `biometricCorrections[${index}].afterJson`, 10_000);
  });
  unique(backup.biometricSequenceGaps, "biometricSequenceGaps", "id");
  unique(backup.biometricCorrections, "biometricCorrections", "id");
  unique(backup.biometricAuditEvents, "biometricAuditEvents", "id");
  backup.biometricAuditEvents.forEach((row, index) => {
    if (row.safeMetadataJson) safeJson(row.safeMetadataJson, `biometricAuditEvents[${index}].safeMetadataJson`, 8_000);
  });
  return backup;
}

export async function restoreBiometricAttendanceBackup(
  client: PrismaClient,
  backup: BiometricAttendanceBackup,
  maps: { users: Map<string, string>; staffMembers: Map<string, string>; restoredBy: string },
  result: RestoreResult
) {
  const bridgeIds = new Map<string, string>();
  const deviceIds = new Map<string, string>();
  const mappingIds = new Map<string, string>();
  const batchIds = new Map<string, string>();
  const punchIds = new Map<string, string>();
  const policyIds = new Map<string, string>();
  const reconciliationIds = new Map<string, string>();
  const actor = (value: unknown) => { const original = text(value); return (maps.users.get(original) ?? original) || maps.restoredBy; };
  const optionalActor = (value: unknown) => value ? actor(value) : null;

  for (const [index, row] of backup.biometricBridges.entries()) {
    if (await webSha256(text(row.publicSigningKey)) !== text(row.publicKeyHash)) { result.biometricBridges.errors.push(`Biometric bridge ${index + 1}: public key hash mismatch`); continue; }
    await createIdentityRow(client.biometricBridge, row, index, result.biometricBridges, bridgeIds, ["publicBridgeId"], { approvedByUserId: optionalActor(row.approvedByUserId), revokedByUserId: optionalActor(row.revokedByUserId) }, "Biometric bridge", "biometricBridges");
  }
  for (const [index, row] of backup.biometricDevices.entries()) {
    const bridgeId = bridgeIds.get(text(row.bridgeId));
    if (!bridgeId) { result.biometricDevices.skipped++; continue; }
    await createIdentityRow(client.biometricDevice, row, index, result.biometricDevices, deviceIds, ["publicDeviceId"], { bridgeId, approvedByUserId: optionalActor(row.approvedByUserId), revokedByUserId: optionalActor(row.revokedByUserId) }, "Biometric device", "biometricDevices");
  }
  for (const [index, row] of backup.biometricStaffMappings.entries()) {
    const deviceId = deviceIds.get(text(row.deviceId)), staffMemberId = maps.staffMembers.get(text(row.staffMemberId));
    if (!deviceId || !staffMemberId) { result.biometricStaffMappings.skipped++; continue; }
    await createIdentityRow(client.biometricStaffMapping, row, index, result.biometricStaffMappings, mappingIds, ["publicKey"], { deviceId, staffMemberId, preparedByUserId: actor(row.preparedByUserId), approvedByUserId: optionalActor(row.approvedByUserId), revokedByUserId: optionalActor(row.revokedByUserId) }, "Biometric mapping", "biometricStaffMappings");
  }
  for (const [index, row] of backup.biometricIngestBatches.entries()) {
    const bridgeId = bridgeIds.get(text(row.bridgeId));
    if (!bridgeId) { result.biometricIngestBatches.skipped++; continue; }
    await createIdentityRow(client.biometricIngestBatch, row, index, result.biometricIngestBatches, batchIds, [], { bridgeId }, "Biometric ingest batch", "biometricIngestBatches");
  }
  for (const [index, row] of backup.biometricRawPunches.entries()) {
    const batchId = batchIds.get(text(row.batchId)), bridgeId = bridgeIds.get(text(row.bridgeId)), deviceId = deviceIds.get(text(row.deviceId));
    if (!batchId || !bridgeId || !deviceId) { result.biometricRawPunches.skipped++; continue; }
    const mappingId = row.mappingId ? mappingIds.get(text(row.mappingId)) ?? null : null;
    const staffMemberId = row.staffMemberId ? maps.staffMembers.get(text(row.staffMemberId)) ?? null : null;
    await createIdentityRow(client.biometricRawPunch, row, index, result.biometricRawPunches, punchIds, ["publicKey", "eventIdentityHash"], { batchId, bridgeId, deviceId, mappingId, staffMemberId }, "Biometric raw punch", "biometricRawPunches");
  }
  for (const [index, row] of backup.biometricSequenceGaps.entries()) {
    const deviceId = deviceIds.get(text(row.deviceId)), batchId = batchIds.get(text(row.batchId));
    if (!deviceId || !batchId) { result.biometricSequenceGaps.skipped++; continue; }
    await createPlainRow(client.biometricSequenceGap, row, index, result.biometricSequenceGaps, { deviceId, batchId, acknowledgedByUserId: optionalActor(row.acknowledgedByUserId) }, "Biometric sequence gap", "biometricSequenceGaps");
  }
  for (const [index, row] of backup.biometricAttendancePolicies.entries()) await createIdentityRow(client.biometricAttendancePolicy, row, index, result.biometricAttendancePolicies, policyIds, ["publicKey"], { preparedByUserId: actor(row.preparedByUserId), approvedByUserId: optionalActor(row.approvedByUserId) }, "Biometric attendance policy", "biometricAttendancePolicies");
  for (const [index, row] of backup.biometricReconciliations.entries()) {
    const staffMemberId = maps.staffMembers.get(text(row.staffMemberId));
    if (!staffMemberId) { result.biometricReconciliations.skipped++; continue; }
    await createIdentityRow(client.biometricReconciliation, row, index, result.biometricReconciliations, reconciliationIds, ["publicKey"], {
      staffMemberId,
      policyId: row.policyId ? policyIds.get(text(row.policyId)) ?? null : null,
      firstPunchId: row.firstPunchId ? punchIds.get(text(row.firstPunchId)) ?? null : null,
      lastPunchId: row.lastPunchId ? punchIds.get(text(row.lastPunchId)) ?? null : null,
      preparedByUserId: optionalActor(row.preparedByUserId),
      approvedByUserId: optionalActor(row.approvedByUserId)
    }, "Biometric reconciliation", "biometricReconciliations");
  }
  for (const [index, row] of backup.biometricCorrections.entries()) {
    const reconciliationId = reconciliationIds.get(text(row.reconciliationId));
    if (!reconciliationId) { result.biometricCorrections.skipped++; continue; }
    await createPlainRow(client.biometricCorrection, row, index, result.biometricCorrections, { reconciliationId, requestedByUserId: actor(row.requestedByUserId), preparedByUserId: optionalActor(row.preparedByUserId), approvedByUserId: optionalActor(row.approvedByUserId) }, "Biometric correction", "biometricCorrections");
  }
  for (const [index, row] of backup.biometricAuditEvents.entries()) await createPlainRow(client.biometricAuditEvent, row, index, result.biometricAuditEvents, { actorUserId: optionalActor(row.actorUserId) }, "Biometric audit event", "biometricAuditEvents");

  result.warnings.push("Biometric replay nonces, device administrator credentials, bridge private signing keys, card secrets, biometric images, and biometric templates are intentionally excluded from backup and restore.");
}

async function createIdentityRow(model: any, row: Record<string, unknown>, index: number, result: EntityResult, ids: Map<string, string>, alternateFields: string[], overrides: Record<string, unknown>, label: string, key: BiometricAttendanceBackupKey) {
  try {
    const id = text(row.id);
    const selectors = [{ id }, ...alternateFields.map((field) => ({ [field]: row[field] }))];
    const existing = await model.findFirst({ where: { OR: selectors } });
    if (existing) {
      if (existing.id !== id || alternateFields.some((field) => String(existing[field]) !== String(row[field]))) throw new Error("identity collision");
      ids.set(id, existing.id);
      result.skipped++;
      return;
    }
    await model.create({ data: { ...restoreDates(row, key), ...overrides } });
    ids.set(id, id);
    result.created++;
  } catch (error) {
    result.errors.push(errorText(label, index, error));
  }
}

async function createPlainRow(model: any, row: Record<string, unknown>, index: number, result: EntityResult, overrides: Record<string, unknown>, label: string, key: BiometricAttendanceBackupKey) {
  try {
    const data = { ...restoreDates(row, key), ...overrides };
    const existing = await model.findUnique({ where: { id: text(row.id) } });
    if (existing) {
      if (Object.entries(data).some(([field, value]) => comparable(existing[field]) !== comparable(value))) throw new Error("identity collision");
      result.skipped++;
      return;
    }
    await model.create({ data });
    result.created++;
  } catch (error) {
    result.errors.push(errorText(label, index, error));
  }
}

function fields(value: string) { return new Set(value.split(" ")); }
function required(value: string) { return value.split(" "); }
function text(value: unknown) { return String(value ?? "").trim(); }
function rows(value: unknown, label: string, allowed: Set<string>, requiredFields: string[]) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200_000) throw new Error(`${label} must be a bounded array`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label}[${index}] must be an object`);
    const row = item as Record<string, unknown>;
    for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`${label}[${index}].${key} is unsupported`);
    for (const key of requiredFields) if (row[key] === undefined || row[key] === null || row[key] === "") throw new Error(`${label}[${index}].${key} is required`);
    return row;
  });
}
function unique(items: Record<string, unknown>[], label: string, field: string) {
  const values = new Set<string>();
  items.forEach((row, index) => {
    const value = text(row[field]);
    if (!value || values.has(value)) throw new Error(`${label}[${index}].${field} is missing or duplicated`);
    values.add(value);
  });
  return values;
}
function linked(ids: Set<string>, value: unknown, label: string) { if (!ids.has(text(value))) throw new Error(`${label} is invalid`); }
function oneOf(value: unknown, allowed: string[], label: string) { if (!allowed.includes(text(value))) throw new Error(`${label} is unsupported`); }
function hash(value: unknown, label: string) { if (!/^[a-f0-9]{64}$/.test(text(value))) throw new Error(`${label} is invalid`); }
async function webSha256(value: string) { const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function comparable(value: unknown) { return value instanceof Date ? value.toISOString() : value === null || value === undefined ? String(value) : String(value); }
function safeJson(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || value.length > max) throw new Error(`${label} is invalid`);
  try {
    const parsed = JSON.parse(value);
    rejectProtectedBiometricMaterial(parsed, label);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BIOMETRIC_BACKUP_PROTECTED_MATERIAL")) throw error;
    throw new Error(`${label} is invalid`);
  }
}
function rejectProtectedBiometricMaterial(value: unknown, label: string) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach((item) => rejectProtectedBiometricMaterial(item, label)); return; }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/(fingerprint|facial|face).*(image|template)|biometric.*(image|template|database)|card.*secret|admin.*password|private.*key/i.test(key)) throw new Error(`BIOMETRIC_BACKUP_PROTECTED_MATERIAL:${label}`);
    rejectProtectedBiometricMaterial(child, label);
  }
}
function restoreDates(row: Record<string, unknown>, key: BiometricAttendanceBackupKey) {
  const restored = { ...row };
  for (const field of DATE_FIELDS[key] ?? []) if (restored[field]) restored[field] = new Date(String(restored[field]));
  return restored;
}
function errorText(label: string, index: number, error: unknown) { return `${label} ${index + 1}: ${error instanceof Error ? error.message : "Unknown restore error"}`; }
