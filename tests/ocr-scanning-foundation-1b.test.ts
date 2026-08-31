import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { admitOcrDocument } from "@/lib/ocr-scanning/admission";
import { OCR_DOCUMENT_PROFILES, mapOcrCandidates } from "@/lib/ocr-scanning/profiles";
import { OCR_ENGINE_LOCK, exactOcrModelReceipt } from "@/lib/ocr-scanning/model-lock";
import { signOcrWorkerRequest, verifyOcrWorkerRequest } from "@/lib/ocr-scanning/worker-auth";
import { validateOcrScanningBackupRows } from "@/lib/ocr-scanning/backup";
import { operationPolicy } from "@/lib/security-resilience";
import { requestBodyLimitBytes } from "@/lib/request-security";
import { createFileSystemPrivateObjectStore } from "@/lib/portable-runtime/private-object-store";
import { purgeOcrObjects } from "@/lib/ocr-scanning/storage";
import { readBoundedOcrRequestBody } from "@/lib/ocr-scanning/request-body";

const source = (path: string) => readFileSync(path, "utf8");

describe("OCR-SCANNING-FOUNDATION-1B", () => {
  it("ships hidden, default-off, zero-percent, and restricted to Super Admin", () => {
    const flags = JSON.parse(source("config/release-feature-flags.json"));
    expect(flags.find((flag: { key: string }) => flag.key === "ocr-scanning-foundation-1b")).toMatchObject({
      defaultState: false,
      rolloutPercentage: 0,
      allowedRoles: ["SUPER_ADMIN"]
    });
    expect(source("lib/ocr-scanning/feature-flag.ts")).toContain('OCR_SCANNING_FLAG_NAME = "OCR_SCANNING_FOUNDATION_1B"');
  });

  it("pins PaddleOCR and every approved model to exact immutable receipts", () => {
    expect(OCR_ENGINE_LOCK).toMatchObject({ paddleOcrVersion: "3.7.0", paddleRuntimeVersion: "3.3.1" });
    expect(OCR_ENGINE_LOCK.models.map((model) => [model.name, model.revision, model.weightSha256])).toEqual([
      ["PP-OCRv5_mobile_det", "0d63e78e2b680928f6b1747d76a08db6e645efb7", "afa1820cb16c1fd0dad589d0f8b389139061c1ef6d68019685fd07be997dda5b"],
      ["en_PP-OCRv5_mobile_rec", "267c36e24c331595590fe7bd72bde2436fd286f2", "3ec8a97ed6cefe8568d3e2ee90bb193299b566a7661aa4fd52d224b96b59f66b"],
      ["devanagari_PP-OCRv5_mobile_rec", "99dcce6d196bd4aaf268c7a5c72c3cc9f3ea4932", "719be7d20bfe9530e2deae324c999e9911087496bce5e70846767c448d023a01"],
      ["te_PP-OCRv5_mobile_rec", "151ab3b1c2f2a058f07a944416b92e9eaec6bf36", "45967d00d6b4af590221733bf0d93791babc1feb17b98da401dba53d3cf110c9"]
    ]);
    const receipt = OCR_ENGINE_LOCK.models.map(({ name, revision, weightSha256 }) => ({ name, revision, weightSha256 }));
    expect(exactOcrModelReceipt(receipt)).toBe(true);
    expect(exactOcrModelReceipt(receipt.map((row, index) => index ? row : { ...row, weightSha256: "0".repeat(64) }))).toBe(false);
    const worker = source("tools/ocr-worker/worker.ts");
    expect(worker).toContain('"--network", "none"');
    expect(worker).not.toMatch(/tesseract|surya|unlimited/i);
  });

  it("admits only decoder-valid files whose extension, MIME, and magic agree", async () => {
    const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: "white" } }).png().toBuffer();
    const admitted = await admitOcrDocument({ bytes: png, filename: "synthetic-form.png", declaredMime: "image/png" });
    expect(admitted).toMatchObject({ mediaType: "image/png", extension: ".png", pageCount: 1, aggregatePixels: 307_200, safeDisplayName: "Private OCR document.png" });
    await expect(admitOcrDocument({ bytes: png, filename: "synthetic-form.jpg", declaredMime: "image/jpeg" })).rejects.toMatchObject({ code: "OCR_EXTENSION_MIME_MAGIC_MISMATCH", status: 415 });
    await expect(admitOcrDocument({ bytes: Buffer.from("%PDF-not-a-valid-document"), filename: "synthetic.pdf", declaredMime: "application/pdf" })).rejects.toMatchObject({ code: "OCR_PDF_PARSER_REJECTED" });
  });

  it("maps approved fields deterministically and emits explicit red missing rows", () => {
    const blocks = [
      { pageNumber: 1, text: "Student name: Asha Rao", polygon: [[10, 10], [200, 10], [200, 30], [10, 30]] as Array<[number, number]>, recognitionScore: 0.98, scriptHint: "LATIN" as const, processingDurationMs: 10, retryPreprocessing: false },
      { pageNumber: 1, text: "Date of birth: 01-01-2015", polygon: [[10, 40], [200, 40], [200, 60], [10, 60]] as Array<[number, number]>, recognitionScore: 0.97, scriptHint: "LATIN" as const, processingDurationMs: 10, retryPreprocessing: false }
    ];
    const mapped = mapOcrCandidates({ contextType: "STUDENT", blocks, handwritingDeclared: false });
    expect(mapped).toHaveLength(OCR_DOCUMENT_PROFILES.STUDENT.length);
    expect(mapped.find((row) => row.fieldKey === "studentName")).toMatchObject({ candidateText: "Asha Rao", validationState: "VALID_FORMAT" });
    expect(mapped.find((row) => row.fieldKey === "admissionNo")).toMatchObject({ candidateText: "", validationState: "MISSING", reviewState: "RED", scriptHint: "UNKNOWN" });
    expect(mapOcrCandidates({ contextType: "STUDENT", blocks, handwritingDeclared: true }).every((row) => row.reviewState === "RED")).toBe(true);
  });

  it("binds machine requests to method, path, worker, time, nonce, and body", () => {
    const environment = { NODE_ENV: "test", OCR_WORKER_HMAC_SECRET: "s".repeat(64) } as NodeJS.ProcessEnv;
    const body = Buffer.from('{"job":null}');
    const now = Date.parse("2026-08-31T10:00:00.000Z");
    const headers = signOcrWorkerRequest({ method: "POST", pathname: "/api/internal/ocr/worker/claim", workerId: "nalanda-ocr-worker-1b", timestamp: now, nonce: "n".repeat(48), body, environment });
    const request = new Request("http://127.0.0.1/api/internal/ocr/worker/claim", { method: "POST", headers, body });
    expect(verifyOcrWorkerRequest({ request, body, now, environment })).toMatchObject({ workerId: "nalanda-ocr-worker-1b" });
    try {
      verifyOcrWorkerRequest({ request, body: Buffer.from("{}"), now, environment });
      throw new Error("expected worker integrity failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "OCR_WORKER_BODY_INTEGRITY_FAILED", status: 401 });
    }
  });

  it("stops chunked OCR bodies at the route-local byte ceiling", async () => {
    const request = new Request("http://127.0.0.1/api/ocr/documents", { method: "POST", body: Buffer.from("oversized") });
    await expect(readBoundedOcrRequestBody(request, 4)).rejects.toMatchObject({ code: "OCR_REQUEST_BODY_TOO_LARGE", status: 413 });
  });

  it("keeps backup bounded and rejects protected raw OCR material", () => {
    expect(validateOcrScanningBackupRows({})).toEqual({
      ocrDocuments: [], ocrJobs: [], ocrPages: [], ocrFieldCandidates: [], ocrSubmissions: [], ocrWorkflowEvents: []
    });
    expect(() => validateOcrScanningBackupRows({ ocrJobs: [{ id: "j", rawOutput: "forbidden" }] })).toThrowError(/rawOutput is unsupported/);
    const backup = source("lib/ocr-scanning/backup.ts");
    expect(backup).toContain("source documents, page rasters, full raw OCR output, model weights, worker secrets");
  });

  it("enumerates and confirms deletion of filesystem-backed private OCR objects", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "nalanda-ocr-private-store-"));
    const store = createFileSystemPrivateObjectStore(root);
    const documentKey = "a".repeat(32);
    const bytes = Buffer.from("synthetic-private-object");
    const digest = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    try {
      await store.putPrivateObject({ key: `private/ocr/${documentKey}/source/${"b".repeat(32)}.png`, bytes, sha256: digest, contentType: "image/png" });
      await store.putPrivateObject({ key: `private/ocr/${documentKey}/derivative/${"c".repeat(32)}.png`, bytes, sha256: digest, contentType: "image/png" });
      expect(await store.listBoundedPrefix(`private/ocr/${documentKey}`, 100)).toHaveLength(2);
      await expect(purgeOcrObjects(documentKey, store)).resolves.toMatchObject({ confirmed: true, deletedObjects: 2, failures: [] });
      expect(await store.listBoundedPrefix(`private/ocr/${documentKey}`, 1)).toEqual([]);
    } finally {
      store.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("gives upload and signed worker routes independent fail-closed budgets", () => {
    expect(operationPolicy("/api/ocr/documents", "POST")?.id).toBe("ocr.upload");
    expect(operationPolicy("/api/internal/ocr/worker/claim", "POST")?.id).toBe("ocr.worker");
    expect(requestBodyLimitBytes("/api/ocr/documents")).toBe(26 * 1024 * 1024);
    expect(requestBodyLimitBytes("/api/internal/ocr/worker/jobs/job/result")).toBe(51 * 1024 * 1024);
    expect(source("middleware.ts")).toContain('pathname.startsWith("/api/internal/ocr/worker/")');
  });

  it("provides matched constraints and immutable evidence/audit triggers", () => {
    for (const migration of ["prisma/migrations/20260831090000_ocr_scanning_foundation_1b/migration.sql", "prisma/postgresql/migrations/20260831090000_ocr_scanning_foundation_1b/migration.sql"]) {
      const sql = source(migration);
      for (const table of ["OcrDocument", "OcrJob", "OcrPage", "OcrFieldCandidate", "OcrSubmission", "OcrWorkflowEvent"]) expect(sql).toContain(`CREATE TABLE "${table}"`);
      expect(sql).not.toMatch(/(?:sourceBytes|rasterBytes|rawOcrOutput|modelWeights)/i);
    }
    const sqlite = source("prisma/migrations/20260831090000_ocr_scanning_foundation_1b/migration.sql");
    expect(sqlite).toContain("OCR_CANDIDATE_SOURCE_EVIDENCE_IMMUTABLE");
    expect(sqlite).toContain("OCR_WORKFLOW_EVENT_IMMUTABLE");
    const postgresTriggers = source("prisma/postgresql/trigger-equivalents.sql");
    expect(postgresTriggers).toContain("OcrCandidate_source_evidence_immutable");
    expect(postgresTriggers).toContain("OcrWorkflowEvent_no_delete");
    expect(source("deploy/portable/compose.yml")).toContain("PORTABLE_EXPECTED_POSTGRES_MIGRATION: 20260831090000_ocr_scanning_foundation_1b");
  });

  it("renders raster evidence beside field decisions and requires explicit final confirmation", () => {
    const review = source("components/ocr-review-workspace.tsx");
    expect(review).toContain("CONFIRM_OCR_SUBMISSION");
    expect(review).toContain("Save draft");
    expect(review).toContain("Submit approved values");
    expect(review).toContain("Discard the unsaved field decision?");
    expect(review).not.toMatch(/<iframe|<embed|application\/pdf/i);
  });
});
