import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import type { PrivateObjectStore } from "@/lib/portable-runtime/private-object-store";
import { configuredPrivateObjectStore } from "@/lib/portable-runtime/private-object-store";
import type { AdmittedOcrDocument } from "@/lib/ocr-scanning/admission";
import {
  OCR_FIELD_DECISIONS,
  OCR_INPUT_LIMITS,
  OCR_LANGUAGE_PROFILES,
  OcrScanningError,
  boundedText,
  requireMember,
  safeJson,
  sha256,
  type OcrContextType,
  type OcrDocumentState,
  type OcrFieldDecision,
  type OcrLanguageProfile
} from "@/lib/ocr-scanning/contracts";
import { ocrProfileField } from "@/lib/ocr-scanning/profiles";
import { syntheticOcrRetentionDates } from "@/lib/ocr-scanning/retention";
import { putOcrSource } from "@/lib/ocr-scanning/storage";
import { applyHumanApprovedOcrValues, loadOcrTargetSnapshot } from "@/lib/ocr-scanning/targets";

type WorkflowClient = Prisma.TransactionClient;

async function event(client: WorkflowClient, input: {
  documentId?: string;
  jobId?: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actorUserId?: string;
  workerId?: string;
  nonceHash?: string;
  metadata?: Record<string, unknown>;
}) {
  return client.ocrWorkflowEvent.create({ data: {
    documentId: input.documentId,
    jobId: input.jobId,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    actorUserId: input.actorUserId,
    workerId: input.workerId,
    requestNonceHash: input.nonceHash,
    safeMetadataJson: input.metadata ? safeJson(input.metadata) : undefined
  } });
}

function uploadKey(value: unknown) {
  const normalized = boundedText(value, 128, "OCR_IDEMPOTENCY_KEY_INVALID");
  if (normalized.length < 16 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) throw new OcrScanningError("OCR_IDEMPOTENCY_KEY_INVALID");
  return normalized;
}

function publicContextId(value: unknown) {
  const normalized = boundedText(value, 100, "OCR_CONTEXT_ID_INVALID");
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) throw new OcrScanningError("OCR_CONTEXT_ID_INVALID");
  return normalized;
}

export async function createOcrUpload(input: {
  client: PrismaClient;
  actor: AuthUser;
  contextType: OcrContextType;
  contextId: string;
  languageProfile: OcrLanguageProfile;
  handwritingDeclared: boolean;
  idempotencyKey: string;
  admitted: AdmittedOcrDocument;
  store?: PrivateObjectStore;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const contextId = publicContextId(input.contextId);
  const idempotencyKey = uploadKey(input.idempotencyKey);
  const identityHash = sha256(`${input.actor.id}\n${idempotencyKey}`);
  const existing = await input.client.ocrDocument.findFirst({
    where: { contextType: input.contextType, contextId, uploadIdentityHash: identityHash },
    select: { publicKey: true, status: true, sourceSha256: true }
  });
  if (existing) {
    if (existing.sourceSha256 !== input.admitted.sha256) throw new OcrScanningError("OCR_IDEMPOTENCY_PAYLOAD_MISMATCH", 409);
    return { ...existing, idempotent: true, duplicateDetected: false };
  }
  const preflight = await input.client.$transaction(async (tx) => {
    const target = await loadOcrTargetSnapshot(tx, input.contextType, contextId);
    const activeJobs = await tx.ocrDocument.count({
      where: { createdByUserId: input.actor.id, status: { in: ["UPLOADED", "ADMITTED", "QUEUED", "PROCESSING"] } }
    });
    const queuedJobs = await tx.ocrDocument.count({
      where: { createdByUserId: input.actor.id, status: { in: ["UPLOADED", "ADMITTED", "QUEUED"] } }
    });
    if (activeJobs >= OCR_INPUT_LIMITS.maximumActiveJobsPerActor) throw new OcrScanningError("OCR_ACTOR_ACTIVE_JOB_LIMIT", 429);
    if (queuedJobs >= OCR_INPUT_LIMITS.maximumQueuedJobsPerActor) throw new OcrScanningError("OCR_ACTOR_QUEUE_LIMIT", 429);
    const duplicate = await tx.ocrDocument.findFirst({
      where: { contextType: input.contextType, contextId, sourceSha256: input.admitted.sha256 },
      orderBy: { createdAt: "desc" }, select: { id: true, publicKey: true }
    });
    return { target, duplicate };
  });

  const documentKey = randomUUID().toLowerCase();
  const store = input.store ?? configuredPrivateObjectStore();
  const stored = await putOcrSource({
    store,
    documentKey,
    bytes: input.admitted.bytes,
    sha256: input.admitted.sha256,
    mediaType: input.admitted.mediaType,
    sourceExtension: input.admitted.extension
  });
  try {
    const retention = syntheticOcrRetentionDates(now);
    const result = await input.client.$transaction(async (tx) => {
      const document = await tx.ocrDocument.create({ data: {
        publicKey: documentKey,
        contextType: input.contextType,
        contextId,
        uploadIdentityHash: identityHash,
        sourceObjectKey: stored.key,
        sourceMediaType: input.admitted.mediaType,
        sourceExtension: input.admitted.extension === ".jpeg" ? ".jpg" : input.admitted.extension,
        safeDisplayName: input.admitted.safeDisplayName,
        byteSize: input.admitted.byteSize,
        sourceSha256: input.admitted.sha256,
        duplicateOfDocumentId: preflight.duplicate?.id,
        pageCount: input.admitted.pageCount,
        aggregatePixels: input.admitted.aggregatePixels,
        status: "QUEUED",
        languageProfile: input.languageProfile,
        handwritingDeclared: input.handwritingDeclared,
        targetSnapshotVersion: preflight.target.version,
        ...retention,
        createdByUserId: input.actor.id
      } });
      const job = await tx.ocrJob.create({ data: {
        documentId: document.id,
        idempotencyKeyHash: sha256(`${identityHash}\ninitial-job`),
        timeoutAt: new Date(now.getTime() + OCR_INPUT_LIMITS.maximumWallClockMs)
      } });
      await event(tx, {
        documentId: document.id, entityType: "OCR_DOCUMENT", entityId: document.id,
        eventType: "OCR_DOCUMENT_ADMITTED_AND_QUEUED", actorUserId: input.actor.id,
        metadata: { pageCount: input.admitted.pageCount, byteSize: input.admitted.byteSize, duplicateDetected: Boolean(preflight.duplicate), lifecycle: ["UPLOADED", "ADMITTED", "QUEUED"] }
      });
      await event(tx, {
        documentId: document.id, jobId: job.id, entityType: "OCR_JOB", entityId: job.id,
        eventType: "OCR_JOB_QUEUED", actorUserId: input.actor.id,
        metadata: { maximumAttempts: job.maximumAttempts, timeoutAt: job.timeoutAt.toISOString() }
      });
      return document;
    });
    return { publicKey: result.publicKey, status: result.status, sourceSha256: result.sourceSha256, idempotent: false, duplicateDetected: Boolean(preflight.duplicate), duplicateReference: preflight.duplicate?.publicKey ?? null };
  } catch (error) {
    await store.deleteGovernedObject(stored.key, stored.version).catch(() => undefined);
    const raced = await input.client.ocrDocument.findFirst({ where: { contextType: input.contextType, contextId, uploadIdentityHash: identityHash } });
    if (raced && raced.sourceSha256 === input.admitted.sha256) return { publicKey: raced.publicKey, status: raced.status, sourceSha256: raced.sourceSha256, idempotent: true, duplicateDetected: false };
    throw error;
  }
}

export async function loadOcrReviewWorkspace(client: PrismaClient, publicKey: string) {
  const row = await client.ocrDocument.findUnique({
    where: { publicKey },
    include: {
      pages: { orderBy: { pageNumber: "asc" } },
      candidates: { orderBy: [{ critical: "desc" }, { fieldKey: "asc" }] },
      jobs: { orderBy: { createdAt: "desc" }, take: 1 },
      submissions: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  if (!row) throw new OcrScanningError("OCR_DOCUMENT_NOT_FOUND", 404);
  const contextType = row.contextType as OcrContextType;
  const target = await client.$transaction((tx) => loadOcrTargetSnapshot(tx, contextType, row.contextId));
  return {
    document: {
      publicKey: row.publicKey, contextType, contextId: row.contextId, status: row.status,
      safeDisplayName: row.safeDisplayName, pageCount: row.pageCount, languageProfile: row.languageProfile,
      handwritingDeclared: row.handwritingDeclared, reviewVersion: row.reviewVersion,
      targetSnapshotVersion: row.targetSnapshotVersion, targetCurrentVersion: target.version,
      targetStale: target.version !== row.targetSnapshotVersion, duplicateDetected: Boolean(row.duplicateOfDocumentId)
    },
    target,
    pages: row.pages.map((page) => ({
      publicKey: page.publicKey, pageNumber: page.pageNumber, width: page.sourceWidth, height: page.sourceHeight,
      sourceRotation: page.sourceRotation, reviewOrientation: page.reviewOrientation, rasterSha256: page.rasterSha256
    })),
    fields: row.candidates.map((candidate) => ({
      publicKey: candidate.publicKey, fieldKey: candidate.fieldKey, candidateText: candidate.candidateText,
      approvedValue: candidate.approvedValue, sourceRegionJson: candidate.sourceRegionJson,
      recognitionScore: candidate.recognitionScore, scriptHint: candidate.scriptHint,
      validationState: candidate.validationState, reviewState: candidate.reviewState, critical: candidate.critical,
      decision: candidate.decision, editReason: candidate.editReason, pageNumber: row.pages.find((page) => page.id === candidate.pageId)?.pageNumber ?? null,
      version: candidate.version
    })),
    latestJob: row.jobs[0] ? { status: row.jobs[0].status, failureCode: row.jobs[0].failureCode, attemptCount: row.jobs[0].attemptCount } : null,
    latestSubmission: row.submissions[0] ? { status: row.submissions[0].status, failureCode: row.submissions[0].failureCode, completedAt: row.submissions[0].completedAt?.toISOString() ?? null } : null
  };
}

export async function reviewOcrField(input: {
  client: PrismaClient;
  actor: AuthUser;
  documentKey: string;
  fieldKey: string;
  decision: OcrFieldDecision;
  approvedValue?: string;
  editReason?: string;
  expectedFieldVersion: number;
  expectedReviewVersion: number;
}) {
  return input.client.$transaction(async (tx) => {
    const document = await tx.ocrDocument.findUnique({ where: { publicKey: input.documentKey } });
    if (!document) throw new OcrScanningError("OCR_DOCUMENT_NOT_FOUND", 404);
    if (!["REVIEW_REQUIRED", "REVIEW_IN_PROGRESS", "READY_TO_SUBMIT"].includes(document.status)) throw new OcrScanningError("OCR_REVIEW_STATE_INVALID", 409);
    if (document.reviewVersion !== input.expectedReviewVersion) throw new OcrScanningError("OCR_REVIEW_STALE", 409);
    const contextType = document.contextType as OcrContextType;
    const definition = ocrProfileField(contextType, input.fieldKey);
    if (!definition) throw new OcrScanningError("OCR_FIELD_NOT_APPROVED", 400);
    const candidate = await tx.ocrFieldCandidate.findFirst({ where: { documentId: document.id, fieldKey: input.fieldKey } });
    if (!candidate) throw new OcrScanningError("OCR_FIELD_NOT_FOUND", 404);
    const decision = requireMember(input.decision, OCR_FIELD_DECISIONS, "OCR_FIELD_DECISION_INVALID");
    let approvedValue: string | null = null;
    let editReason: string | null = null;
    if (decision === "ACCEPTED") {
      if (!candidate.candidateText) throw new OcrScanningError("OCR_MISSING_CANDIDATE_CANNOT_BE_ACCEPTED", 409);
      approvedValue = candidate.candidateText;
    } else if (decision === "EDITED") {
      approvedValue = boundedText(input.approvedValue, definition.maximumLength, "OCR_APPROVED_VALUE_INVALID");
      editReason = boundedText(input.editReason, 400, "OCR_EDIT_REASON_REQUIRED");
      if (editReason.length < 3) throw new OcrScanningError("OCR_EDIT_REASON_REQUIRED");
    }
    const changed = await tx.ocrFieldCandidate.updateMany({
      where: { id: candidate.id, version: input.expectedFieldVersion },
      data: { decision, approvedValue, editReason, reviewedByUserId: input.actor.id, reviewedAt: new Date(), version: { increment: 1 } }
    });
    if (changed.count !== 1) throw new OcrScanningError("OCR_FIELD_REVIEW_STALE", 409);
    const pending = await tx.ocrFieldCandidate.count({ where: { documentId: document.id, decision: "PENDING" } });
    const nextStatus = pending === 0 ? "READY_TO_SUBMIT" : "REVIEW_IN_PROGRESS";
    const nextReviewVersion = document.reviewVersion + 1;
    await tx.ocrDocument.update({ where: { id: document.id }, data: { status: nextStatus, reviewVersion: nextReviewVersion } });
    await event(tx, {
      documentId: document.id, entityType: "OCR_FIELD", entityId: candidate.id,
      eventType: `OCR_FIELD_${decision}`, actorUserId: input.actor.id,
      metadata: { fieldKey: candidate.fieldKey, critical: candidate.critical, reviewState: candidate.reviewState, candidatePreserved: true }
    });
    return { accepted: true, status: nextStatus, reviewVersion: nextReviewVersion, fieldVersion: input.expectedFieldVersion + 1 };
  });
}

export async function rotateOcrReviewPage(input: {
  client: PrismaClient; actor: AuthUser; documentKey: string; pageNumber: number; rotation: number; expectedReviewVersion: number;
}) {
  if (![0, 90, 180, 270].includes(input.rotation)) throw new OcrScanningError("OCR_PAGE_ROTATION_INVALID");
  return input.client.$transaction(async (tx) => {
    const document = await tx.ocrDocument.findUnique({ where: { publicKey: input.documentKey } });
    if (!document) throw new OcrScanningError("OCR_DOCUMENT_NOT_FOUND", 404);
    if (document.reviewVersion !== input.expectedReviewVersion) throw new OcrScanningError("OCR_REVIEW_STALE", 409);
    const page = await tx.ocrPage.findFirst({ where: { documentId: document.id, pageNumber: input.pageNumber } });
    if (!page) throw new OcrScanningError("OCR_PAGE_NOT_FOUND", 404);
    await tx.ocrPage.update({ where: { id: page.id }, data: { reviewOrientation: input.rotation } });
    const reviewVersion = document.reviewVersion + 1;
    await tx.ocrDocument.update({ where: { id: document.id }, data: { reviewVersion } });
    await event(tx, { documentId: document.id, entityType: "OCR_PAGE", entityId: page.id, eventType: "OCR_REVIEW_ORIENTATION_CHANGED", actorUserId: input.actor.id, metadata: { pageNumber: page.pageNumber, reviewOrientation: input.rotation, sourceEvidenceUnchanged: true } });
    return { accepted: true, reviewVersion };
  });
}

function canonicalPayload(values: Record<string, string>) {
  return JSON.stringify(Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right))));
}

export async function submitOcrReview(input: {
  client: PrismaClient;
  actor: AuthUser;
  documentKey: string;
  expectedReviewVersion: number;
  idempotencyKey: string;
  confirmation: string;
}) {
  if (input.confirmation !== "CONFIRM_OCR_SUBMISSION") throw new OcrScanningError("OCR_FINAL_CONFIRMATION_REQUIRED", 409);
  const idempotencyHash = sha256(`${input.actor.id}\n${uploadKey(input.idempotencyKey)}`);
  return input.client.$transaction(async (tx) => {
    const document = await tx.ocrDocument.findUnique({ where: { publicKey: input.documentKey }, include: { candidates: true } });
    if (!document) throw new OcrScanningError("OCR_DOCUMENT_NOT_FOUND", 404);
    const replay = await tx.ocrSubmission.findFirst({ where: { documentId: document.id, idempotencyKeyHash: idempotencyHash } });
    if (replay) {
      if (replay.status !== "COMPLETED") throw new OcrScanningError("OCR_SUBMISSION_INCOMPLETE", 409);
      return { accepted: true, idempotent: true, reference: replay.resultReference, status: document.status };
    }
    if (document.status !== "READY_TO_SUBMIT") throw new OcrScanningError("OCR_DOCUMENT_NOT_READY", 409);
    if (document.reviewVersion !== input.expectedReviewVersion) throw new OcrScanningError("OCR_REVIEW_STALE", 409);
    if (document.candidates.some((candidate) => candidate.decision === "PENDING")) throw new OcrScanningError("OCR_FIELD_REVIEW_INCOMPLETE", 409);
    if (document.candidates.some((candidate) => candidate.critical && !["ACCEPTED", "EDITED", "REJECTED_CANDIDATE", "MISSING_VALUE"].includes(candidate.decision))) {
      throw new OcrScanningError("OCR_CRITICAL_FIELD_CONFIRMATION_REQUIRED", 409);
    }
    const values = Object.fromEntries(document.candidates
      .filter((candidate) => ["ACCEPTED", "EDITED"].includes(candidate.decision) && candidate.approvedValue)
      .map((candidate) => [candidate.fieldKey, candidate.approvedValue!])) as Record<string, string>;
    const payloadSha256 = sha256(canonicalPayload(values));
    const submission = await tx.ocrSubmission.create({ data: {
      documentId: document.id,
      idempotencyKeyHash: idempotencyHash,
      reviewVersion: document.reviewVersion,
      targetSnapshotVersion: document.targetSnapshotVersion,
      payloadSha256,
      authoritativeService: ({ ADMISSION: "ADMISSIONS", STUDENT: "STUDENTS", GUARDIAN: "GUARDIANS", STAFF: "STAFF" } as const)[document.contextType as OcrContextType],
      submittedByUserId: input.actor.id
    } });
    const applied = await applyHumanApprovedOcrValues({
      client: tx,
      contextType: document.contextType as OcrContextType,
      contextId: document.contextId,
      expectedVersion: document.targetSnapshotVersion,
      values,
      actor: input.actor
    });
    await tx.ocrSubmission.update({ where: { id: submission.id }, data: { status: "COMPLETED", resultReference: applied.reference, completedAt: applied.appliedAt } });
    await tx.ocrDocument.update({ where: { id: document.id }, data: { status: "SUBMITTED", submittedAt: applied.appliedAt } });
    await event(tx, {
      documentId: document.id, entityType: "OCR_SUBMISSION", entityId: submission.id,
      eventType: "OCR_HUMAN_APPROVED_VALUES_SUBMITTED", actorUserId: input.actor.id,
      metadata: { authoritativeService: applied.service, approvedFieldKeys: Object.keys(values).sort(), targetVersionBefore: document.targetSnapshotVersion, targetVersionAfter: applied.version, directPrismaBypass: false }
    });
    return { accepted: true, idempotent: false, reference: applied.reference, status: "SUBMITTED" };
  });
}

export async function rejectOcrDocument(input: { client: PrismaClient; actor: AuthUser; documentKey: string; reason: string }) {
  const reason = boundedText(input.reason, 400, "OCR_REJECTION_REASON_REQUIRED");
  return input.client.$transaction(async (tx) => {
    const document = await tx.ocrDocument.findUnique({ where: { publicKey: input.documentKey } });
    if (!document) throw new OcrScanningError("OCR_DOCUMENT_NOT_FOUND", 404);
    if (["SUBMITTED", "PURGED"].includes(document.status)) throw new OcrScanningError("OCR_REJECTION_STATE_INVALID", 409);
    await tx.ocrJob.updateMany({
      where: { documentId: document.id, status: "QUEUED" },
      data: { status: "CANCELLED", failureCode: "OCR_PROCESS_CANCELLED", cancellationRequested: true, completedAt: new Date() }
    });
    await tx.ocrJob.updateMany({
      where: { documentId: document.id, status: "PROCESSING" },
      data: { cancellationRequested: true }
    });
    await tx.ocrDocument.update({ where: { id: document.id }, data: { status: "REJECTED", rejectedAt: new Date() } });
    await event(tx, { documentId: document.id, entityType: "OCR_DOCUMENT", entityId: document.id, eventType: "OCR_DOCUMENT_REJECTED", actorUserId: input.actor.id, metadata: { reasonCode: sha256(reason).slice(0, 16), queuedJobsCancelled: true, runningJobsCancellationRequested: true, sourceRetainedUntilGovernedPurge: true } });
    return { accepted: true, status: "REJECTED" };
  });
}

export async function purgeOcrDocument(input: {
  client: PrismaClient; actor: AuthUser; documentKey: string; store?: PrivateObjectStore;
}) {
  const document = await input.client.ocrDocument.findUnique({
    where: { publicKey: input.documentKey }, include: { pages: { select: { rasterObjectKey: true } }, jobs: { where: { status: { in: ["QUEUED", "PROCESSING"] } }, select: { id: true } } }
  });
  if (!document) throw new OcrScanningError("OCR_DOCUMENT_NOT_FOUND", 404);
  if (["QUEUED", "PROCESSING"].includes(document.status) || document.jobs.length) throw new OcrScanningError("OCR_PURGE_ACTIVE_JOB", 409);
  await input.client.ocrDocument.update({ where: { id: document.id }, data: { purgeStatus: "PENDING", purgeFailureCode: null } });
  const store = input.store ?? configuredPrivateObjectStore();
  const keys = [document.sourceObjectKey, ...document.pages.map((page) => page.rasterObjectKey)];
  const failures: string[] = [];
  for (const key of keys) {
    try {
      const metadata = await store.statPrivateObject(key);
      if (metadata) await store.deleteGovernedObject(key, metadata.version);
      if (await store.statPrivateObject(key)) failures.push("OBJECT_DELETE_NOT_CONFIRMED");
    } catch {
      failures.push("OBJECT_DELETE_FAILED");
    }
  }
  if (failures.length) {
    await input.client.$transaction(async (tx) => {
      await tx.ocrDocument.update({ where: { id: document.id }, data: { purgeStatus: "PARTIAL_FAILURE", purgeFailureCode: failures[0] } });
      await event(tx, { documentId: document.id, entityType: "OCR_DOCUMENT", entityId: document.id, eventType: "OCR_PURGE_PARTIAL_FAILURE", actorUserId: input.actor.id, metadata: { objectCount: keys.length, failureCount: failures.length } });
    });
    throw new OcrScanningError("OCR_PURGE_NOT_CONFIRMED", 503);
  }
  return input.client.$transaction(async (tx) => {
    const purgedAt = new Date();
    await tx.ocrDocument.update({ where: { id: document.id }, data: { status: "PURGED", purgeStatus: "CONFIRMED", purgeFailureCode: null, purgedAt } });
    await event(tx, { documentId: document.id, entityType: "OCR_DOCUMENT", entityId: document.id, eventType: "OCR_PURGE_CONFIRMED", actorUserId: input.actor.id, metadata: { objectCount: keys.length, durableAuditRetained: true } });
    return { accepted: true, status: "PURGED", purgedAt };
  });
}

export async function markExpiredOcrDocuments(client: PrismaClient, now = new Date()) {
  const candidates = await client.ocrDocument.findMany({
    where: { sourceRetentionUntil: { lte: now }, status: { in: ["QUEUED", "FAILED", "REVIEW_REQUIRED", "REVIEW_IN_PROGRESS", "READY_TO_SUBMIT"] } },
    select: { id: true }, take: 100
  });
  let expired = 0;
  for (const candidate of candidates) {
    const result = await client.ocrDocument.updateMany({
      where: { id: candidate.id, status: { in: ["QUEUED", "FAILED", "REVIEW_REQUIRED", "REVIEW_IN_PROGRESS", "READY_TO_SUBMIT"] } },
      data: { status: "EXPIRED", expiredAt: now }
    });
    expired += result.count;
  }
  return { expired, purgeRequired: expired };
}

export function parseOcrUploadOptions(input: Record<string, unknown>) {
  return {
    languageProfile: requireMember(input.languageProfile ?? "ENGLISH", OCR_LANGUAGE_PROFILES, "OCR_LANGUAGE_PROFILE_INVALID"),
    handwritingDeclared: input.handwritingDeclared === true,
    idempotencyKey: uploadKey(input.idempotencyKey)
  };
}
