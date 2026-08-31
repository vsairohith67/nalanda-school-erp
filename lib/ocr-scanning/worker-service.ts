import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { PrivateObjectStore } from "@/lib/portable-runtime/private-object-store";
import { configuredPrivateObjectStore } from "@/lib/portable-runtime/private-object-store";
import {
  OCR_INPUT_LIMITS,
  OCR_LANGUAGE_PROFILES,
  OcrScanningError,
  requireMember,
  safeJson,
  sha256,
  type OcrContextType,
  type OcrWorkerResult
} from "@/lib/ocr-scanning/contracts";
import { exactOcrModelReceipt } from "@/lib/ocr-scanning/model-lock";
import { mapOcrCandidates } from "@/lib/ocr-scanning/profiles";
import { putOcrRaster, readOcrPrivateObject } from "@/lib/ocr-scanning/storage";

const LEASE_MS = 90_000;
const SAFE_FAILURES = new Set([
  "OCR_MODEL_MISSING", "OCR_MODEL_HASH_MISMATCH", "OCR_CUDA_UNSUPPORTED", "OCR_GPU_OOM",
  "OCR_WORKER_CRASH", "OCR_MODEL_CACHE_CORRUPT", "OCR_NETWORK_DISABLED", "OCR_LANGUAGE_UNAVAILABLE",
  "OCR_PROCESS_TIMEOUT", "OCR_PROCESS_CANCELLED", "OCR_OUTPUT_INVALID", "OCR_RASTERIZATION_FAILED"
]);

function leaseHash(jobId: string, token: string) {
  return sha256(`${jobId}\n${token}`);
}

async function workerEvent(client: Prisma.TransactionClient, input: {
  documentId?: string; jobId?: string; entityType: string; entityId: string; eventType: string;
  workerId: string; nonceHash: string; metadata?: Record<string, unknown>;
}) {
  try {
    return await client.ocrWorkflowEvent.create({ data: {
      documentId: input.documentId, jobId: input.jobId, entityType: input.entityType,
      entityId: input.entityId, eventType: input.eventType, workerId: input.workerId,
      requestNonceHash: input.nonceHash, safeMetadataJson: input.metadata ? safeJson(input.metadata) : undefined
    } });
  } catch (error) {
    if (error instanceof Error && /Unique constraint|unique/i.test(error.message)) throw new OcrScanningError("OCR_WORKER_REPLAY_REJECTED", 409);
    throw error;
  }
}

export async function claimOcrJob(input: { client: PrismaClient; workerId: string; nonceHash: string; now?: Date }) {
  const now = input.now ?? new Date();
  const leaseToken = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  return input.client.$transaction(async (tx) => {
    await workerEvent(tx, { entityType: "OCR_WORKER", entityId: input.workerId, eventType: "OCR_WORKER_CLAIM_REQUEST", workerId: input.workerId, nonceHash: input.nonceHash });
    const timedOut = await tx.ocrJob.findMany({ where: { status: { in: ["QUEUED", "PROCESSING"] }, timeoutAt: { lte: now } }, select: { id: true, documentId: true }, take: 20 });
    for (const job of timedOut) {
      await tx.ocrJob.updateMany({ where: { id: job.id, status: { in: ["QUEUED", "PROCESSING"] } }, data: { status: "DEAD", failureCode: "OCR_JOB_TIMEOUT", completedAt: now, leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null } });
      await tx.ocrDocument.updateMany({ where: { id: job.documentId, status: { in: ["QUEUED", "PROCESSING"] } }, data: { status: "FAILED" } });
    }
    const job = await tx.ocrJob.findFirst({
      where: {
        cancellationRequested: false,
        timeoutAt: { gt: now },
        OR: [
          { status: "QUEUED" },
          { status: "PROCESSING", leaseExpiresAt: { lt: now } }
        ]
      },
      orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
      include: { document: true }
    });
    if (!job) return null;
    if (job.attemptCount >= job.maximumAttempts) {
      await tx.ocrJob.update({ where: { id: job.id }, data: { status: "DEAD", failureCode: "OCR_MAXIMUM_ATTEMPTS", completedAt: now } });
      await tx.ocrDocument.update({ where: { id: job.documentId }, data: { status: "FAILED" } });
      return null;
    }
    const changed = await tx.ocrJob.updateMany({
      where: {
        id: job.id,
        OR: [{ status: "QUEUED" }, { status: "PROCESSING", leaseExpiresAt: job.leaseExpiresAt }]
      },
      data: {
        status: "PROCESSING", attemptCount: { increment: 1 }, leaseOwner: input.workerId,
        leaseTokenHash: leaseHash(job.id, leaseToken), leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        heartbeatAt: now, claimedAt: job.claimedAt ?? now
      }
    });
    if (changed.count !== 1) return null;
    await tx.ocrDocument.updateMany({ where: { id: job.documentId, status: { in: ["QUEUED", "PROCESSING"] } }, data: { status: "PROCESSING" } });
    await tx.ocrWorkflowEvent.create({ data: {
      documentId: job.documentId, jobId: job.id, entityType: "OCR_JOB", entityId: job.id,
      eventType: job.status === "PROCESSING" ? "OCR_STALE_LEASE_RECLAIMED" : "OCR_JOB_CLAIMED",
      workerId: input.workerId, safeMetadataJson: safeJson({ attempt: job.attemptCount + 1, leaseMilliseconds: LEASE_MS })
    } });
    return {
      jobKey: job.publicKey,
      documentKey: job.document.publicKey,
      leaseToken,
      sourceSha256: job.document.sourceSha256,
      sourceMediaType: job.document.sourceMediaType,
      sourceExtension: job.document.sourceExtension,
      pageCount: job.document.pageCount,
      languageProfile: requireMember(job.document.languageProfile, OCR_LANGUAGE_PROFILES, "OCR_LANGUAGE_PROFILE_INVALID"),
      handwritingDeclared: job.document.handwritingDeclared,
      timeoutAt: job.timeoutAt.toISOString()
    };
  });
}

async function leasedJob(client: Prisma.TransactionClient, jobKey: string, workerId: string, leaseToken: string, now: Date, allowCancellation = false) {
  const job = await client.ocrJob.findUnique({ where: { publicKey: jobKey }, include: { document: true } });
  if (!job || job.status !== "PROCESSING" || job.leaseOwner !== workerId || job.leaseTokenHash !== leaseHash(job.id, leaseToken) || !job.leaseExpiresAt || job.leaseExpiresAt <= now) {
    throw new OcrScanningError("OCR_JOB_LEASE_INVALID", 409);
  }
  if (job.cancellationRequested && !allowCancellation) throw new OcrScanningError("OCR_JOB_CANCELLED", 409);
  return job;
}

export async function readWorkerOcrSource(input: {
  client: PrismaClient; workerId: string; nonceHash: string; jobKey: string; leaseToken: string; store?: PrivateObjectStore; now?: Date;
}) {
  const now = input.now ?? new Date();
  const job = await input.client.$transaction(async (tx) => {
    const row = await leasedJob(tx, input.jobKey, input.workerId, input.leaseToken, now);
    await workerEvent(tx, { documentId: row.documentId, jobId: row.id, entityType: "OCR_JOB", entityId: row.id, eventType: "OCR_PRIVATE_SOURCE_READ", workerId: input.workerId, nonceHash: input.nonceHash, metadata: { digestPrefix: row.document.sourceSha256.slice(0, 12) } });
    return row;
  });
  const object = await readOcrPrivateObject(job.document.sourceObjectKey, OCR_INPUT_LIMITS.maximumFileBytes, input.store ?? configuredPrivateObjectStore());
  if (object.metadata.sha256 !== job.document.sourceSha256) throw new OcrScanningError("OCR_SOURCE_CHECKSUM_MISMATCH", 409);
  return { bytes: object.bytes, mediaType: job.document.sourceMediaType, sourceSha256: job.document.sourceSha256 };
}

export async function uploadWorkerOcrRaster(input: {
  client: PrismaClient; workerId: string; nonceHash: string; jobKey: string; leaseToken: string;
  pageNumber: number; width: number; height: number; sourceRotation: number; sourceDigest: string;
  processingDurationMs: number; retryPreprocessing: boolean; rasterSha256: string; bytes: Buffer;
  store?: PrivateObjectStore; now?: Date;
}) {
  const now = input.now ?? new Date();
  const job = await input.client.$transaction((tx) => leasedJob(tx, input.jobKey, input.workerId, input.leaseToken, now));
  if (!Number.isSafeInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > job.document.pageCount) throw new OcrScanningError("OCR_PAGE_NUMBER_INVALID");
  const pixelCount = input.width * input.height;
  if (!Number.isSafeInteger(input.width) || !Number.isSafeInteger(input.height) || input.width < 1 || input.height < 1 || input.width > OCR_INPUT_LIMITS.maximumDimension || input.height > OCR_INPUT_LIMITS.maximumDimension || !Number.isSafeInteger(pixelCount) || pixelCount > OCR_INPUT_LIMITS.maximumPixelsPerPage) throw new OcrScanningError("OCR_RASTER_RESOURCE_LIMIT", 413);
  if (![0, 90, 180, 270].includes(input.sourceRotation) || !/^[a-f0-9]{64}$/.test(input.sourceDigest) || !Number.isSafeInteger(input.processingDurationMs) || input.processingDurationMs < 0 || input.processingDurationMs > 120_000) throw new OcrScanningError("OCR_RASTER_EVIDENCE_INVALID");
  const existing = await input.client.ocrPage.findFirst({ where: { documentId: job.documentId, pageNumber: input.pageNumber } });
  if (existing) {
    if (existing.rasterSha256 !== input.rasterSha256 || existing.sourceDigest !== input.sourceDigest) throw new OcrScanningError("OCR_RASTER_REPLAY_MISMATCH", 409);
    await input.client.$transaction(async (tx) => workerEvent(tx, { documentId: job.documentId, jobId: job.id, entityType: "OCR_PAGE", entityId: existing.id, eventType: "OCR_RASTER_UPLOAD_REPLAY", workerId: input.workerId, nonceHash: input.nonceHash, metadata: { pageNumber: input.pageNumber } }));
    return { accepted: true, idempotent: true, pageKey: existing.publicKey };
  }
  const store = input.store ?? configuredPrivateObjectStore();
  const stored = await putOcrRaster({ store, documentKey: job.document.publicKey, bytes: input.bytes, expectedSha256: input.rasterSha256 });
  try {
    return await input.client.$transaction(async (tx) => {
      const active = await leasedJob(tx, input.jobKey, input.workerId, input.leaseToken, now);
      const page = await tx.ocrPage.create({ data: {
        documentId: active.documentId, pageNumber: input.pageNumber, rasterObjectKey: stored.key,
        rasterSha256: input.rasterSha256, sourceDigest: input.sourceDigest, sourceWidth: input.width,
        sourceHeight: input.height, sourceRotation: input.sourceRotation, pixelCount,
        processingDurationMs: input.processingDurationMs, retryPreprocessing: input.retryPreprocessing
      } });
      await workerEvent(tx, { documentId: active.documentId, jobId: active.id, entityType: "OCR_PAGE", entityId: page.id, eventType: "OCR_RASTER_STORED", workerId: input.workerId, nonceHash: input.nonceHash, metadata: { pageNumber: input.pageNumber, byteSize: input.bytes.length, metadataStripped: true } });
      return { accepted: true, idempotent: false, pageKey: page.publicKey };
    });
  } catch (error) {
    await store.deleteGovernedObject(stored.key, stored.version).catch(() => undefined);
    throw error;
  }
}

function validateWorkerResult(result: OcrWorkerResult, expectedSourceSha256: string, expectedPages: number) {
  if (result.contractVersion !== "nalanda-ocr-worker-result-1" || result.engineId !== "paddleocr" || result.engineRevision !== "3.7.0" || result.runtimeRevision !== "paddlepaddle-gpu-3.3.1") throw new OcrScanningError("OCR_RUNTIME_RECEIPT_INVALID", 409);
  if (!exactOcrModelReceipt(result.modelReceipt)) throw new OcrScanningError("OCR_MODEL_RECEIPT_INVALID", 409);
  if (result.sourceSha256 !== expectedSourceSha256 || result.pages.length !== expectedPages || result.totalDurationMs < 0 || result.totalDurationMs > OCR_INPUT_LIMITS.maximumWallClockMs) throw new OcrScanningError("OCR_RESULT_EVIDENCE_INVALID", 409);
  let outputBytes = 0;
  let outputBlocks = 0;
  let previousPage = 0;
  for (const page of result.pages) {
    if (page.pageNumber !== previousPage + 1) throw new OcrScanningError("OCR_RESULT_PAGE_SEQUENCE_INVALID", 409);
    previousPage = page.pageNumber;
    if (!Number.isSafeInteger(page.width) || !Number.isSafeInteger(page.height) || page.width < 1 || page.height < 1 || page.width > OCR_INPUT_LIMITS.maximumDimension || page.height > OCR_INPUT_LIMITS.maximumDimension || page.width * page.height > OCR_INPUT_LIMITS.maximumPixelsPerPage) throw new OcrScanningError("OCR_RESULT_PAGE_LIMIT", 413);
    if (!/^[a-f0-9]{64}$/.test(page.sourceDigest) || !/^[a-f0-9]{64}$/.test(page.rasterSha256)) throw new OcrScanningError("OCR_RESULT_DIGEST_INVALID", 409);
    if (![0, 90, 180, 270].includes(page.sourceRotation) || !Number.isSafeInteger(page.processingDurationMs) || page.processingDurationMs < 0 || page.processingDurationMs > 120_000 || typeof page.retryPreprocessing !== "boolean") throw new OcrScanningError("OCR_RESULT_PAGE_EVIDENCE_INVALID", 409);
    if (page.blocks.length > OCR_INPUT_LIMITS.maximumBlocksPerPage) throw new OcrScanningError("OCR_RESULT_BLOCK_LIMIT", 413);
    let pageOutputBytes = 0;
    for (const block of page.blocks) {
      if (block.pageNumber !== page.pageNumber || block.text.length > 2_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(block.text)) throw new OcrScanningError("OCR_RESULT_TEXT_INVALID", 413);
      const textBytes = Buffer.byteLength(block.text, "utf8");
      outputBytes += textBytes;
      pageOutputBytes += textBytes;
      outputBlocks++;
      if (!Number.isSafeInteger(block.processingDurationMs) || block.processingDurationMs < 0 || block.processingDurationMs > 120_000 || typeof block.retryPreprocessing !== "boolean" || !["LATIN", "DEVANAGARI", "TELUGU", "MIXED", "UNKNOWN"].includes(block.scriptHint)) throw new OcrScanningError("OCR_RESULT_BLOCK_EVIDENCE_INVALID", 409);
      if (block.recognitionScore !== null && (!Number.isFinite(block.recognitionScore) || block.recognitionScore < 0 || block.recognitionScore > 1)) throw new OcrScanningError("OCR_RESULT_SCORE_INVALID", 409);
      if (block.polygon && (block.polygon.length < 3 || block.polygon.length > 16 || block.polygon.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > page.width || y > page.height))) throw new OcrScanningError("OCR_RESULT_REGION_INVALID", 409);
    }
    if (pageOutputBytes > OCR_INPUT_LIMITS.maximumOutputBytesPerPage) throw new OcrScanningError("OCR_RESULT_PAGE_OUTPUT_LIMIT", 413);
  }
  if (outputBytes > OCR_INPUT_LIMITS.maximumOutputBytesPerDocument || outputBlocks > OCR_INPUT_LIMITS.maximumBlocksPerDocument) throw new OcrScanningError("OCR_RESULT_OUTPUT_LIMIT", 413);
  return outputBytes;
}

export async function completeOcrJob(input: {
  client: PrismaClient; workerId: string; nonceHash: string; jobKey: string; leaseToken: string; result: OcrWorkerResult; now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.client.$transaction(async (tx) => {
    const job = await leasedJob(tx, input.jobKey, input.workerId, input.leaseToken, now);
    const outputBytes = validateWorkerResult(input.result, job.document.sourceSha256, job.document.pageCount);
    const storedPages = await tx.ocrPage.findMany({ where: { documentId: job.documentId }, orderBy: { pageNumber: "asc" } });
    if (storedPages.length !== input.result.pages.length || storedPages.some((page, index) => page.pageNumber !== input.result.pages[index].pageNumber || page.rasterSha256 !== input.result.pages[index].rasterSha256 || page.sourceDigest !== input.result.pages[index].sourceDigest)) throw new OcrScanningError("OCR_RASTER_EVIDENCE_INCOMPLETE", 409);
    if (await tx.ocrFieldCandidate.count({ where: { documentId: job.documentId } })) throw new OcrScanningError("OCR_RESULT_ALREADY_COMMITTED", 409);
    const blocks = input.result.pages.flatMap((page) => page.blocks);
    const mapped = mapOcrCandidates({ contextType: job.document.contextType as OcrContextType, blocks, handwritingDeclared: job.document.handwritingDeclared });
    const pages = new Map(storedPages.map((page) => [page.pageNumber, page]));
    for (const candidate of mapped) {
      await tx.ocrFieldCandidate.create({ data: {
        documentId: job.documentId,
        pageId: candidate.sourceRegionJson ? pages.get(candidate.pageNumber)?.id : null,
        fieldKey: candidate.fieldKey, candidateText: candidate.candidateText, candidateSha256: candidate.candidateSha256,
        sourceRegionJson: candidate.sourceRegionJson, recognitionScore: candidate.recognitionScore,
        scriptHint: candidate.scriptHint, validationState: candidate.validationState, reviewState: candidate.reviewState,
        critical: candidate.critical, retryPreprocessing: candidate.retryPreprocessing
      } });
    }
    const resultSha256 = sha256(safeJson(input.result, OCR_INPUT_LIMITS.maximumOutputBytesPerDocument));
    await tx.ocrJob.update({ where: { id: job.id }, data: {
      status: "COMPLETED", engineId: input.result.engineId, engineRevision: input.result.engineRevision,
      modelReceiptJson: safeJson(input.result.modelReceipt), resultSha256, outputBytes, completedAt: now,
      leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null, heartbeatAt: now
    } });
    await tx.ocrDocument.update({ where: { id: job.documentId }, data: { status: "REVIEW_REQUIRED" } });
    await workerEvent(tx, { documentId: job.documentId, jobId: job.id, entityType: "OCR_JOB", entityId: job.id, eventType: "OCR_RESULT_COMMITTED_FOR_HUMAN_REVIEW", workerId: input.workerId, nonceHash: input.nonceHash, metadata: { engineRevision: input.result.engineRevision, pageCount: input.result.pages.length, mappedFieldCount: mapped.length, outputBytes, rawOutputPersisted: false, authoritativeWrite: false } });
    return { accepted: true, status: "REVIEW_REQUIRED", mappedFieldCount: mapped.length };
  });
}

export async function heartbeatOcrJob(input: { client: PrismaClient; workerId: string; nonceHash: string; jobKey: string; leaseToken: string; now?: Date }) {
  const now = input.now ?? new Date();
  return input.client.$transaction(async (tx) => {
    const job = await leasedJob(tx, input.jobKey, input.workerId, input.leaseToken, now, true);
    await tx.ocrJob.update({ where: { id: job.id }, data: { heartbeatAt: now, ...(!job.cancellationRequested ? { leaseExpiresAt: new Date(now.getTime() + LEASE_MS) } : {}) } });
    await workerEvent(tx, { documentId: job.documentId, jobId: job.id, entityType: "OCR_JOB", entityId: job.id, eventType: "OCR_JOB_HEARTBEAT", workerId: input.workerId, nonceHash: input.nonceHash, metadata: { cancellationRequested: job.cancellationRequested } });
    return { accepted: true, cancellationRequested: job.cancellationRequested, leaseExpiresAt: new Date(now.getTime() + LEASE_MS).toISOString() };
  });
}

export async function failOcrJob(input: {
  client: PrismaClient; workerId: string; nonceHash: string; jobKey: string; leaseToken: string; failureCode: string; retryable: boolean; now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!SAFE_FAILURES.has(input.failureCode)) throw new OcrScanningError("OCR_WORKER_FAILURE_CODE_INVALID");
  return input.client.$transaction(async (tx) => {
    const job = await leasedJob(tx, input.jobKey, input.workerId, input.leaseToken, now, true);
    const cancelled = job.cancellationRequested && input.failureCode === "OCR_PROCESS_CANCELLED";
    const retry = !cancelled && input.retryable && job.attemptCount < job.maximumAttempts && job.timeoutAt > now;
    const terminalStatus = cancelled ? "CANCELLED" : "FAILED";
    await tx.ocrJob.update({ where: { id: job.id }, data: {
      status: retry ? "QUEUED" : terminalStatus, failureCode: input.failureCode,
      queuedAt: retry ? now : job.queuedAt, completedAt: retry ? null : now,
      leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null, heartbeatAt: now
    } });
    if (!cancelled || job.document.status !== "REJECTED") {
      await tx.ocrDocument.update({ where: { id: job.documentId }, data: { status: retry ? "QUEUED" : terminalStatus } });
    }
    await workerEvent(tx, { documentId: job.documentId, jobId: job.id, entityType: "OCR_JOB", entityId: job.id, eventType: retry ? "OCR_JOB_RETRY_QUEUED" : cancelled ? "OCR_JOB_CANCELLED" : "OCR_JOB_FAILED", workerId: input.workerId, nonceHash: input.nonceHash, metadata: { failureCode: input.failureCode, attempt: job.attemptCount, retry, documentStatusPreserved: cancelled && job.document.status === "REJECTED" } });
    return { accepted: true, status: retry ? "QUEUED" : terminalStatus, retry };
  });
}
