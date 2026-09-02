import type { PrismaClient } from "@prisma/client";

import { databaseTableExists } from "@/lib/database-capabilities";
import {
  OCR_CONTEXT_TYPES,
  OCR_DOCUMENT_STATES,
  OCR_FIELD_DECISIONS,
  OCR_JOB_STATES,
  OCR_LANGUAGE_PROFILES,
  OCR_REVIEW_STATES,
  OCR_VALIDATION_STATES
} from "@/lib/ocr-scanning/contracts";

export const OCR_SCANNING_BACKUP_KEYS = [
  "ocrDocuments",
  "ocrJobs",
  "ocrPages",
  "ocrFieldCandidates",
  "ocrSubmissions",
  "ocrWorkflowEvents"
] as const;

export type OcrScanningBackupKey = (typeof OCR_SCANNING_BACKUP_KEYS)[number];
export type OcrScanningBackup = Record<OcrScanningBackupKey, Record<string, unknown>[]>;
type EntityResult = { created: number; updated: number; skipped: number; errors: string[] };
type RestoreResult = Record<OcrScanningBackupKey, EntityResult> & { warnings: string[] };

const FIELDS: Record<OcrScanningBackupKey, Set<string>> = {
  ocrDocuments: fields("id publicKey contextType contextId uploadIdentityHash sourceObjectKey sourceMediaType sourceExtension safeDisplayName byteSize sourceSha256 duplicateOfDocumentId pageCount aggregatePixels status languageProfile handwritingDeclared reviewVersion targetSnapshotVersion retentionPolicyVersion sourceRetentionUntil rasterRetentionUntil rawOutputRetentionUntil candidateRetentionUntil auditRetentionUntil purgeStatus purgeFailureCode createdByUserId submittedAt rejectedAt expiredAt purgedAt createdAt updatedAt"),
  ocrJobs: fields("id publicKey documentId idempotencyKeyHash status attemptCount maximumAttempts leaseOwner leaseTokenHash leaseExpiresAt heartbeatAt timeoutAt cancellationRequested engineId engineRevision modelReceiptJson resultSha256 outputBytes failureCode queuedAt claimedAt completedAt createdAt updatedAt"),
  ocrPages: fields("id publicKey documentId pageNumber rasterObjectKey rasterSha256 sourceDigest sourceWidth sourceHeight sourceRotation reviewOrientation pixelCount ocrState processingDurationMs retryPreprocessing createdAt updatedAt"),
  ocrFieldCandidates: fields("id publicKey documentId pageId fieldKey candidateText candidateSha256 sourceRegionJson recognitionScore scriptHint validationState reviewState critical retryPreprocessing decision approvedValue editReason reviewedByUserId reviewedAt version createdAt updatedAt"),
  ocrSubmissions: fields("id publicKey documentId idempotencyKeyHash reviewVersion targetSnapshotVersion payloadSha256 authoritativeService status resultReference failureCode submittedByUserId completedAt createdAt"),
  ocrWorkflowEvents: fields("id documentId jobId entityType entityId eventType actorUserId workerId requestNonceHash safeMetadataJson occurredAt")
};

const REQUIRED: Record<OcrScanningBackupKey, string[]> = {
  ocrDocuments: required("id publicKey contextType contextId uploadIdentityHash sourceObjectKey sourceMediaType sourceExtension safeDisplayName byteSize sourceSha256 pageCount aggregatePixels status languageProfile handwritingDeclared reviewVersion targetSnapshotVersion retentionPolicyVersion sourceRetentionUntil rasterRetentionUntil rawOutputRetentionUntil candidateRetentionUntil auditRetentionUntil purgeStatus createdByUserId createdAt updatedAt"),
  ocrJobs: required("id publicKey documentId idempotencyKeyHash status attemptCount maximumAttempts timeoutAt cancellationRequested queuedAt createdAt updatedAt"),
  ocrPages: required("id publicKey documentId pageNumber rasterObjectKey rasterSha256 sourceDigest sourceWidth sourceHeight sourceRotation reviewOrientation pixelCount ocrState processingDurationMs retryPreprocessing createdAt updatedAt"),
  ocrFieldCandidates: required("id publicKey documentId fieldKey candidateText candidateSha256 scriptHint validationState reviewState critical retryPreprocessing decision version createdAt updatedAt"),
  ocrSubmissions: required("id publicKey documentId idempotencyKeyHash reviewVersion targetSnapshotVersion payloadSha256 authoritativeService status submittedByUserId createdAt"),
  ocrWorkflowEvents: required("id entityType entityId eventType occurredAt")
};

const DATE_FIELDS: Partial<Record<OcrScanningBackupKey, string[]>> = {
  ocrDocuments: required("sourceRetentionUntil rasterRetentionUntil rawOutputRetentionUntil candidateRetentionUntil auditRetentionUntil submittedAt rejectedAt expiredAt purgedAt createdAt updatedAt"),
  ocrJobs: required("leaseExpiresAt heartbeatAt timeoutAt queuedAt claimedAt completedAt createdAt updatedAt"),
  ocrPages: required("createdAt updatedAt"),
  ocrFieldCandidates: required("reviewedAt createdAt updatedAt"),
  ocrSubmissions: required("completedAt createdAt"),
  ocrWorkflowEvents: required("occurredAt")
};

export function emptyOcrScanningBackup(): OcrScanningBackup {
  return Object.fromEntries(OCR_SCANNING_BACKUP_KEYS.map((key) => [key, []])) as unknown as OcrScanningBackup;
}

export async function ocrScanningSchemaAvailable(client: PrismaClient) {
  try {
    if (!(client as unknown as { ocrDocument?: { findMany?: unknown } }).ocrDocument?.findMany) return false;
    return await databaseTableExists(client, "OcrDocument");
  } catch {
    return false;
  }
}

export async function loadOcrScanningBackup(client: PrismaClient): Promise<OcrScanningBackup> {
  const [documents, jobs, pages, candidates, submissions, events] = await Promise.all([
    client.ocrDocument.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.ocrJob.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.ocrPage.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.ocrFieldCandidate.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.ocrSubmission.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.ocrWorkflowEvent.findMany({ orderBy: [{ occurredAt: "asc" }, { id: "asc" }] })
  ]);
  return {
    ocrDocuments: documents,
    ocrJobs: jobs,
    ocrPages: pages,
    ocrFieldCandidates: candidates,
    ocrSubmissions: submissions,
    ocrWorkflowEvents: events
  };
}

export function validateOcrScanningBackupRows(root: Record<string, unknown>): OcrScanningBackup {
  const backup = Object.fromEntries(OCR_SCANNING_BACKUP_KEYS.map((key) => [
    key,
    rows(root[key], key, FIELDS[key], REQUIRED[key])
  ])) as OcrScanningBackup;
  const documentIds = unique(backup.ocrDocuments, "ocrDocuments", "id");
  unique(backup.ocrDocuments, "ocrDocuments", "publicKey");
  unique(backup.ocrDocuments, "ocrDocuments", "sourceObjectKey");
  const jobIds = unique(backup.ocrJobs, "ocrJobs", "id");
  unique(backup.ocrJobs, "ocrJobs", "publicKey");
  const pageIds = unique(backup.ocrPages, "ocrPages", "id");
  unique(backup.ocrPages, "ocrPages", "publicKey");
  unique(backup.ocrPages, "ocrPages", "rasterObjectKey");
  unique(backup.ocrFieldCandidates, "ocrFieldCandidates", "id");
  unique(backup.ocrFieldCandidates, "ocrFieldCandidates", "publicKey");
  unique(backup.ocrSubmissions, "ocrSubmissions", "id");
  unique(backup.ocrSubmissions, "ocrSubmissions", "publicKey");
  unique(backup.ocrWorkflowEvents, "ocrWorkflowEvents", "id");

  backup.ocrDocuments.forEach((row, index) => {
    oneOf(row.contextType, OCR_CONTEXT_TYPES, `ocrDocuments[${index}].contextType`);
    oneOf(row.status, OCR_DOCUMENT_STATES, `ocrDocuments[${index}].status`);
    oneOf(row.languageProfile, OCR_LANGUAGE_PROFILES, `ocrDocuments[${index}].languageProfile`);
    oneOf(row.purgeStatus, ["NOT_REQUESTED", "PENDING", "PARTIAL_FAILURE", "CONFIRMED"], `ocrDocuments[${index}].purgeStatus`);
    hash(row.uploadIdentityHash, `ocrDocuments[${index}].uploadIdentityHash`);
    hash(row.sourceSha256, `ocrDocuments[${index}].sourceSha256`);
    boundedString(row.sourceObjectKey, 512, `ocrDocuments[${index}].sourceObjectKey`);
    boundedString(row.safeDisplayName, 160, `ocrDocuments[${index}].safeDisplayName`);
  });
  backup.ocrJobs.forEach((row, index) => {
    linked(documentIds, row.documentId, `ocrJobs[${index}].documentId`);
    oneOf(row.status, OCR_JOB_STATES, `ocrJobs[${index}].status`);
    hash(row.idempotencyKeyHash, `ocrJobs[${index}].idempotencyKeyHash`);
    if (row.leaseTokenHash) hash(row.leaseTokenHash, `ocrJobs[${index}].leaseTokenHash`);
    if (row.resultSha256) hash(row.resultSha256, `ocrJobs[${index}].resultSha256`);
    if (row.modelReceiptJson) safeJson(row.modelReceiptJson, `ocrJobs[${index}].modelReceiptJson`, 16_000);
  });
  backup.ocrPages.forEach((row, index) => {
    linked(documentIds, row.documentId, `ocrPages[${index}].documentId`);
    hash(row.rasterSha256, `ocrPages[${index}].rasterSha256`);
    hash(row.sourceDigest, `ocrPages[${index}].sourceDigest`);
    oneOf(row.sourceRotation, [0, 90, 180, 270], `ocrPages[${index}].sourceRotation`);
    oneOf(row.reviewOrientation, [0, 90, 180, 270], `ocrPages[${index}].reviewOrientation`);
  });
  backup.ocrFieldCandidates.forEach((row, index) => {
    linked(documentIds, row.documentId, `ocrFieldCandidates[${index}].documentId`);
    if (row.pageId) linked(pageIds, row.pageId, `ocrFieldCandidates[${index}].pageId`);
    hash(row.candidateSha256, `ocrFieldCandidates[${index}].candidateSha256`);
    oneOf(row.validationState, OCR_VALIDATION_STATES, `ocrFieldCandidates[${index}].validationState`);
    oneOf(row.reviewState, OCR_REVIEW_STATES, `ocrFieldCandidates[${index}].reviewState`);
    oneOf(row.decision, OCR_FIELD_DECISIONS, `ocrFieldCandidates[${index}].decision`);
    oneOf(row.scriptHint, ["LATIN", "DEVANAGARI", "TELUGU", "MIXED", "UNKNOWN"], `ocrFieldCandidates[${index}].scriptHint`);
    boundedString(row.candidateText, 2_048, `ocrFieldCandidates[${index}].candidateText`, true);
    if (row.approvedValue != null) boundedString(row.approvedValue, 2_048, `ocrFieldCandidates[${index}].approvedValue`, true);
    if (row.sourceRegionJson) safeJson(row.sourceRegionJson, `ocrFieldCandidates[${index}].sourceRegionJson`, 8_000);
  });
  backup.ocrSubmissions.forEach((row, index) => {
    linked(documentIds, row.documentId, `ocrSubmissions[${index}].documentId`);
    hash(row.idempotencyKeyHash, `ocrSubmissions[${index}].idempotencyKeyHash`);
    hash(row.payloadSha256, `ocrSubmissions[${index}].payloadSha256`);
    oneOf(row.authoritativeService, ["ADMISSIONS", "STUDENTS", "GUARDIANS", "STAFF"], `ocrSubmissions[${index}].authoritativeService`);
    oneOf(row.status, ["PENDING", "COMPLETED", "STALE", "FAILED"], `ocrSubmissions[${index}].status`);
  });
  backup.ocrWorkflowEvents.forEach((row, index) => {
    if (row.documentId) linked(documentIds, row.documentId, `ocrWorkflowEvents[${index}].documentId`);
    if (row.jobId) linked(jobIds, row.jobId, `ocrWorkflowEvents[${index}].jobId`);
    if (row.requestNonceHash) hash(row.requestNonceHash, `ocrWorkflowEvents[${index}].requestNonceHash`);
    if (row.safeMetadataJson) safeJson(row.safeMetadataJson, `ocrWorkflowEvents[${index}].safeMetadataJson`, 32_000);
  });
  return backup;
}

export async function restoreOcrScanningBackup(
  client: PrismaClient,
  backup: OcrScanningBackup,
  maps: {
    users: Map<string, string>;
    students: Map<string, string>;
    guardians: Map<string, string>;
    staffMembers: Map<string, string>;
    restoredBy: string;
  },
  result: RestoreResult
) {
  const documentIds = new Map<string, string>();
  const jobIds = new Map<string, string>();
  const pageIds = new Map<string, string>();
  const actor = (value: unknown) => maps.users.get(text(value)) ?? maps.restoredBy;
  const optionalActor = (value: unknown) => value ? maps.users.get(text(value)) ?? maps.restoredBy : null;

  for (const [index, row] of backup.ocrDocuments.entries()) {
    const contextId = mappedContextId(row.contextType, row.contextId, maps);
    if (!contextId) { result.ocrDocuments.skipped++; continue; }
    await createIdentityRow(client.ocrDocument, row, index, result.ocrDocuments, documentIds, ["publicKey", "sourceObjectKey"], {
      contextId,
      createdByUserId: actor(row.createdByUserId)
    }, "OCR document", "ocrDocuments");
  }
  for (const [index, row] of backup.ocrJobs.entries()) {
    const documentId = documentIds.get(text(row.documentId));
    if (!documentId) { result.ocrJobs.skipped++; continue; }
    await createIdentityRow(client.ocrJob, row, index, result.ocrJobs, jobIds, ["publicKey"], { documentId }, "OCR job", "ocrJobs");
  }
  for (const [index, row] of backup.ocrPages.entries()) {
    const documentId = documentIds.get(text(row.documentId));
    if (!documentId) { result.ocrPages.skipped++; continue; }
    await createIdentityRow(client.ocrPage, row, index, result.ocrPages, pageIds, ["publicKey", "rasterObjectKey"], { documentId }, "OCR page", "ocrPages");
  }
  for (const [index, row] of backup.ocrFieldCandidates.entries()) {
    const documentId = documentIds.get(text(row.documentId));
    if (!documentId) { result.ocrFieldCandidates.skipped++; continue; }
    const pageId = row.pageId ? pageIds.get(text(row.pageId)) ?? null : null;
    await createIdentityRow(client.ocrFieldCandidate, row, index, result.ocrFieldCandidates, new Map(), ["publicKey"], {
      documentId,
      pageId,
      reviewedByUserId: optionalActor(row.reviewedByUserId)
    }, "OCR field candidate", "ocrFieldCandidates");
  }
  for (const [index, row] of backup.ocrSubmissions.entries()) {
    const documentId = documentIds.get(text(row.documentId));
    if (!documentId) { result.ocrSubmissions.skipped++; continue; }
    await createIdentityRow(client.ocrSubmission, row, index, result.ocrSubmissions, new Map(), ["publicKey"], {
      documentId,
      submittedByUserId: actor(row.submittedByUserId)
    }, "OCR submission", "ocrSubmissions");
  }
  for (const [index, row] of backup.ocrWorkflowEvents.entries()) {
    const documentId = row.documentId ? documentIds.get(text(row.documentId)) ?? null : null;
    const jobId = row.jobId ? jobIds.get(text(row.jobId)) ?? null : null;
    if ((row.documentId && !documentId) || (row.jobId && !jobId)) { result.ocrWorkflowEvents.skipped++; continue; }
    await createPlainRow(client.ocrWorkflowEvent, row, index, result.ocrWorkflowEvents, {
      documentId,
      jobId,
      actorUserId: optionalActor(row.actorUserId)
    }, "OCR workflow event", "ocrWorkflowEvents");
  }
  result.warnings.push("OCR source documents, page rasters, full raw OCR output, model weights, worker secrets, lease credentials, and replay state are intentionally excluded from JSON backup; governed private-object recovery is separate.");
}

function mappedContextId(contextType: unknown, contextId: unknown, maps: { students: Map<string, string>; guardians: Map<string, string>; staffMembers: Map<string, string> }) {
  const original = text(contextId);
  if (contextType === "STUDENT") return maps.students.get(original) ?? null;
  if (contextType === "GUARDIAN") return maps.guardians.get(original) ?? null;
  if (contextType === "STAFF") return maps.staffMembers.get(original) ?? null;
  return original || null;
}

async function createIdentityRow(model: any, row: Record<string, unknown>, index: number, result: EntityResult, ids: Map<string, string>, alternateFields: string[], overrides: Record<string, unknown>, label: string, key: OcrScanningBackupKey) {
  try {
    const id = text(row.id);
    const existing = await model.findFirst({ where: { OR: [{ id }, ...alternateFields.map((field) => ({ [field]: row[field] }))] } });
    if (existing) {
      if (existing.id !== id || alternateFields.some((field) => comparable(existing[field]) !== comparable(row[field]))) throw new Error("identity collision");
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

async function createPlainRow(model: any, row: Record<string, unknown>, index: number, result: EntityResult, overrides: Record<string, unknown>, label: string, key: OcrScanningBackupKey) {
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
function oneOf(value: unknown, allowed: readonly (string | number)[], label: string) { if (!allowed.some((candidate) => String(candidate) === text(value))) throw new Error(`${label} is unsupported`); }
function hash(value: unknown, label: string) { if (!/^[a-f0-9]{64}$/.test(text(value))) throw new Error(`${label} is invalid`); }
function boundedString(value: unknown, maximum: number, label: string, allowEmpty = false) { const normalized = text(value); if ((!allowEmpty && !normalized) || normalized.length > maximum) throw new Error(`${label} is invalid`); }
function safeJson(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > maximum) throw new Error(`${label} is invalid`);
  try {
    const parsed = JSON.parse(value);
    rejectProtectedMaterial(parsed);
  } catch { throw new Error(`${label} is invalid`); }
}
function rejectProtectedMaterial(value: unknown) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach(rejectProtectedMaterial); return; }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/^(?:base64|raw(?:ocr)?(?:text|output)|source(?:bytes|document)|imagebytes|modelweights|lease(?:token|secret)|hmacsecret)$/i.test(key)) throw new Error("protected material");
    rejectProtectedMaterial(child);
  }
}
function comparable(value: unknown) { return value instanceof Date ? value.toISOString() : value === null || value === undefined ? String(value) : String(value); }
function restoreDates(row: Record<string, unknown>, key: OcrScanningBackupKey) { const restored = { ...row }; for (const field of DATE_FIELDS[key] ?? []) if (restored[field]) restored[field] = new Date(String(restored[field])); return restored; }
function errorText(label: string, index: number, error: unknown) { return `${label} ${index + 1}: ${error instanceof Error ? error.message : "Unknown restore error"}`; }
