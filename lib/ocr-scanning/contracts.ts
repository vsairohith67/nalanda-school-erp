import { createHash } from "node:crypto";

export const OCR_INPUT_LIMITS = Object.freeze({
  maximumFileBytes: 25 * 1024 * 1024,
  maximumPages: 25,
  maximumDimension: 6_000,
  maximumPixelsPerPage: 40_000_000,
  maximumAggregatePixels: 120_000_000,
  maximumOutputBytesPerPage: 2 * 1024 * 1024,
  maximumOutputBytesPerDocument: 50 * 1024 * 1024,
  maximumBlocksPerPage: 10_000,
  maximumBlocksPerDocument: 50_000,
  maximumWallClockMs: 25 * 120_000,
  maximumQueuedJobsPerActor: 6,
  maximumActiveJobsPerActor: 2,
  maximumWorkerConcurrency: 4,
  maximumTemporaryBytes: 512 * 1024 * 1024
});

export const OCR_CONTEXT_TYPES = ["ADMISSION", "STUDENT", "GUARDIAN", "STAFF"] as const;
export const OCR_LANGUAGE_PROFILES = [
  "ENGLISH",
  "HINDI",
  "TELUGU",
  "ENGLISH_HINDI",
  "ENGLISH_TELUGU",
  "ENGLISH_HINDI_TELUGU"
] as const;
export const OCR_DOCUMENT_STATES = [
  "UPLOADED",
  "ADMITTED",
  "QUEUED",
  "PROCESSING",
  "OCR_COMPLETE",
  "REVIEW_REQUIRED",
  "REVIEW_IN_PROGRESS",
  "READY_TO_SUBMIT",
  "SUBMITTED",
  "REJECTED",
  "EXPIRED",
  "PURGED",
  "FAILED"
] as const;
export const OCR_JOB_STATES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "DEAD"] as const;
export const OCR_VALIDATION_STATES = ["VALID_FORMAT", "INVALID_FORMAT", "AMBIGUOUS", "MISSING"] as const;
export const OCR_REVIEW_STATES = ["GREEN", "AMBER", "RED"] as const;
export const OCR_FIELD_DECISIONS = ["PENDING", "ACCEPTED", "EDITED", "REJECTED_CANDIDATE", "MISSING_VALUE"] as const;

export type OcrContextType = (typeof OCR_CONTEXT_TYPES)[number];
export type OcrLanguageProfile = (typeof OCR_LANGUAGE_PROFILES)[number];
export type OcrDocumentState = (typeof OCR_DOCUMENT_STATES)[number];
export type OcrValidationState = (typeof OCR_VALIDATION_STATES)[number];
export type OcrReviewState = (typeof OCR_REVIEW_STATES)[number];
export type OcrFieldDecision = (typeof OCR_FIELD_DECISIONS)[number];
export type OcrScriptHint = "LATIN" | "DEVANAGARI" | "TELUGU" | "MIXED" | "UNKNOWN";

export type OcrSourceRegion = {
  pageNumber: number;
  polygon: Array<[number, number]>;
};

export type OcrTextBlock = {
  pageNumber: number;
  text: string;
  polygon: Array<[number, number]> | null;
  recognitionScore: number | null;
  scriptHint: OcrScriptHint;
  processingDurationMs: number;
  retryPreprocessing: boolean;
};

export type OcrWorkerResult = {
  contractVersion: "nalanda-ocr-worker-result-1";
  engineId: "paddleocr";
  engineRevision: "3.7.0";
  runtimeRevision: "paddlepaddle-gpu-3.3.1";
  modelReceipt: Array<{ name: string; revision: string; weightSha256: string }>;
  sourceSha256: string;
  pages: Array<{
    pageNumber: number;
    width: number;
    height: number;
    sourceRotation: 0 | 90 | 180 | 270;
    sourceDigest: string;
    rasterSha256: string;
    processingDurationMs: number;
    retryPreprocessing: boolean;
    blocks: OcrTextBlock[];
  }>;
  totalDurationMs: number;
};

export class OcrScanningError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = "The OCR request could not be processed."
  ) {
    super(message);
    this.name = "OcrScanningError";
  }
}

export function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function requireMember<T extends readonly string[]>(value: unknown, members: T, code: string): T[number] {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!(members as readonly string[]).includes(normalized)) throw new OcrScanningError(code);
  return normalized as T[number];
}

export function boundedText(value: unknown, maximum: number, code: string, allowEmpty = false) {
  const text = String(value ?? "").normalize("NFKC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if ((!allowEmpty && !text) || text.length > maximum) throw new OcrScanningError(code);
  return text;
}

export function safeJson(value: unknown, maximumBytes = 32 * 1024) {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > maximumBytes) throw new OcrScanningError("OCR_SAFE_METADATA_TOO_LARGE", 413);
  return json;
}

export function isOcrContextType(value: string): value is OcrContextType {
  return (OCR_CONTEXT_TYPES as readonly string[]).includes(value);
}

const ALLOWED_TRANSITIONS: Record<OcrDocumentState, readonly OcrDocumentState[]> = {
  UPLOADED: ["ADMITTED", "REJECTED", "FAILED", "PURGED"],
  ADMITTED: ["QUEUED", "REJECTED", "FAILED", "PURGED"],
  QUEUED: ["PROCESSING", "FAILED", "REJECTED", "EXPIRED", "PURGED"],
  PROCESSING: ["OCR_COMPLETE", "QUEUED", "FAILED", "REJECTED"],
  OCR_COMPLETE: ["REVIEW_REQUIRED", "FAILED"],
  REVIEW_REQUIRED: ["REVIEW_IN_PROGRESS", "REJECTED", "EXPIRED", "PURGED"],
  REVIEW_IN_PROGRESS: ["REVIEW_REQUIRED", "READY_TO_SUBMIT", "REJECTED", "EXPIRED", "PURGED"],
  READY_TO_SUBMIT: ["REVIEW_IN_PROGRESS", "SUBMITTED", "REJECTED", "EXPIRED", "PURGED"],
  SUBMITTED: ["PURGED"],
  REJECTED: ["PURGED"],
  EXPIRED: ["PURGED"],
  PURGED: [],
  FAILED: ["QUEUED", "REVIEW_REQUIRED", "PURGED"]
};

export function assertOcrDocumentTransition(from: OcrDocumentState, to: OcrDocumentState) {
  if (from === to || !ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new OcrScanningError("OCR_DOCUMENT_TRANSITION_INVALID", 409);
  }
}
