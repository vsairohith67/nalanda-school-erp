import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  assertPrivateFeeRegisterStorageRoot,
  FEE_REGISTER_IMAGE_TYPES,
  feeRegisterStorageRoot,
  sanitizeRegisterDisplayName,
  validateRegisterImage
} from "../lib/fee-register-ocr-storage";
import {
  runFeeRegisterOcrProvider,
  validateLocalOcrEndpoint,
  validateOcrProviderResponse
} from "../lib/fee-register-ocr-provider";
import {
  feeRegisterOcrAggregateCsv,
  feeRegisterOcrReportData,
  reviewedOcrStagingCsv
} from "../lib/fee-register-ocr-reports";
import {
  addManualOcrRow,
  assertOcrBatchContentAdditionAllowed,
  assertOcrBatchRowMutationAllowed,
  assertOcrRowMutationAllowed,
  ensureFeeRegisterOcrFoundation,
  matchStudentForOcr,
  ocrBatchCancelPermission,
  processOcrPosting
} from "../lib/fee-register-ocr";
import { RECOMMENDED_ROLE_PERMISSIONS } from "../lib/permissions";

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii"), result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
}

function png(width = 4, height = 3, animated = false) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.concat(Array.from({ length: height }, () => Buffer.alloc(1 + width * 3)));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    ...(animated ? [pngChunk("acTL", Buffer.from([0, 0, 0, 1, 0, 0, 0, 0]))] : []),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function jpeg(width = 4, height = 3) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x00, 0x3f, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, sos, Buffer.from([0x00, 0xff, 0xd9])]);
}

function webp(width = 4, height = 3, animated = false) {
  const extended = Buffer.alloc(10);
  extended[0] = animated ? 0x02 : 0;
  extended.writeUIntLE(width - 1, 4, 3);
  extended.writeUIntLE(height - 1, 7, 3);
  const lossy = Buffer.alloc(10);
  Buffer.from([0x9d, 0x01, 0x2a]).copy(lossy, 3);
  lossy.writeUInt16LE(width, 6);
  lossy.writeUInt16LE(height, 8);
  const chunks = Buffer.concat([riffChunk("VP8X", extended), riffChunk("VP8 ", lossy)]);
  const result = Buffer.alloc(12 + chunks.length);
  result.write("RIFF", 0, "ascii");
  result.writeUInt32LE(result.length - 8, 4);
  result.write("WEBP", 8, "ascii");
  chunks.copy(result, 12);
  return result;
}

function riffChunk(type: string, data: Buffer) {
  const result = Buffer.alloc(8 + data.length + (data.length % 2));
  result.write(type, 0, "ascii");
  result.writeUInt32LE(data.length, 4);
  data.copy(result, 8);
  return result;
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

describe("Prompt 20B private source validation", () => {
  it("accepts bounded PNG bytes by magic signature and dimensions", () => {
    const image = validateRegisterImage(
      { bytes: png(), filename: "QA20B register.png", declaredMime: "image/png" },
      { maximumFileBytes: 1_000, maximumImagePixels: 100 }
    );
    expect(image).toMatchObject({ mimeType: "image/png", width: 4, height: 3 });
    expect(image.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts structurally valid JPEG, PNG, and still WebP", () => {
    expect(FEE_REGISTER_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(validateRegisterImage({ bytes: jpeg(), filename: "page.jpg" }, { maximumFileBytes: 10_000, maximumImagePixels: 100 }).mimeType).toBe("image/jpeg");
    expect(validateRegisterImage({ bytes: webp(), filename: "page.webp" }, { maximumFileBytes: 10_000, maximumImagePixels: 100 }).mimeType).toBe("image/webp");
  });

  it("rejects malformed, animated, extension, MIME, size, dimension, and empty-file mismatches", () => {
    const limits = { maximumFileBytes: 1_000, maximumImagePixels: 100 };
    expect(() => validateRegisterImage({ bytes: png(), filename: "wrong.jpg", declaredMime: "image/png" }, limits)).toThrow(/extension/i);
    expect(() => validateRegisterImage({ bytes: png(), filename: "page.png", declaredMime: "image/jpeg" }, limits)).toThrow(/declared/i);
    expect(() => validateRegisterImage({ bytes: png(11, 10), filename: "page.png" }, limits)).toThrow(/dimensions/i);
    expect(() => validateRegisterImage({ bytes: png(), filename: "page.png" }, { ...limits, maximumFileBytes: 4 })).toThrow(/file-size/i);
    expect(() => validateRegisterImage({ bytes: Buffer.alloc(0), filename: "page.png" }, limits)).toThrow(/empty/i);
    expect(() => validateRegisterImage({ bytes: png().subarray(0, 40), filename: "page.png" }, limits)).toThrow(/valid JPEG, PNG, or WebP/i);
    expect(() => validateRegisterImage({ bytes: jpeg().subarray(0, -2), filename: "page.jpg" }, limits)).toThrow(/valid JPEG, PNG, or WebP/i);
    expect(() => validateRegisterImage({ bytes: png(4, 3, true), filename: "page.png" }, limits)).toThrow(/Animated PNG/i);
    expect(() => validateRegisterImage({ bytes: webp(4, 3, true), filename: "page.webp" }, limits)).toThrow(/Animated WebP/i);
  });

  it("sanitizes display names and refuses a public storage root", () => {
    expect(sanitizeRegisterDisplayName("../unsafe/register?.png")).toBe("register_.png");
    const previous = process.env.FEE_REGISTER_OCR_STORAGE_DIR;
    process.env.FEE_REGISTER_OCR_STORAGE_DIR = `${process.cwd()}\\public\\fee-register`;
    try {
      expect(() => feeRegisterStorageRoot()).toThrow(/must not be inside the public/i);
    } finally {
      if (previous == null) delete process.env.FEE_REGISTER_OCR_STORAGE_DIR;
      else process.env.FEE_REGISTER_OCR_STORAGE_DIR = previous;
    }
  });

  it("rejects a configured symlink and a post-realpath public target", () => {
    const privateRoot = `${process.cwd()}\\data\\fee-register-ocr`;
    const publicRoot = `${process.cwd()}\\public`;
    expect(() => assertPrivateFeeRegisterStorageRoot(privateRoot, privateRoot, publicRoot, true)).toThrow(/symbolic link or junction/i);
    expect(() => assertPrivateFeeRegisterStorageRoot(privateRoot, `${publicRoot}\\fee-register`, publicRoot, false)).toThrow(/resolve inside the public/i);
    expect(() => assertPrivateFeeRegisterStorageRoot(privateRoot, privateRoot, publicRoot, false)).not.toThrow();
  });
});

describe("Prompt 20B workflow state boundaries", () => {
  it("never reactivates a paused built-in profile during foundation reads", async () => {
    const rows = new Map<string, any>([
      ["OCR-MOCK-DETERMINISTIC", { id: "mock", profileCode: "OCR-MOCK-DETERMINISTIC", status: "PAUSED", liveUseEnabled: false, paymentPostingEnabled: false }],
      ["MANUAL-TRANSCRIPTION", { id: "manual", profileCode: "MANUAL-TRANSCRIPTION", status: "PAUSED", liveUseEnabled: false, paymentPostingEnabled: false }]
    ]);
    const client: any = {
      feeRegisterOcrBatch: { count: async () => 0 },
      feeRegisterOcrProfile: {
        findUnique: async ({ where }: any) => rows.get(where.profileCode) ?? null,
        delete: async () => undefined,
        update: async () => undefined,
        upsert: async ({ where, update, create }: any) => {
          const current = rows.get(where.profileCode);
          rows.set(where.profileCode, current ? { ...current, ...update } : create);
        }
      }
    };
    await ensureFeeRegisterOcrFoundation(client);
    expect(rows.get("OCR-MOCK-DETERMINISTIC").status).toBe("PAUSED");
    expect(rows.get("MANUAL-TRANSCRIPTION").status).toBe("PAUSED");
  });

  it("uses explicit cancel permissions and blocks terminal batch or row mutation", () => {
    expect(ocrBatchCancelPermission("NEEDS_REVIEW")).toBe("REVIEW_FEE_REGISTER_OCR_ROWS");
    expect(ocrBatchCancelPermission("APPROVED")).toBe("APPROVE_FEE_REGISTER_OCR_BATCHES");
    for (const status of ["POSTING", "PARTIALLY_POSTED", "POSTED", "REJECTED", "CANCELLED", "ARCHIVED"]) {
      expect(ocrBatchCancelPermission(status)).toBeNull();
      expect(() => assertOcrBatchRowMutationAllowed(status)).toThrow(/cannot be changed/i);
    }
    expect(() => assertOcrRowMutationAllowed({ status: "DUPLICATE", page: { batch: { status: "NEEDS_REVIEW" } } })).toThrow(/DUPLICATE/);
    expect(() => assertOcrRowMutationAllowed({ status: "MATCHED", page: { batch: { status: "CANCELLED" } } })).toThrow(/CANCELLED/);
    expect(() => assertOcrRowMutationAllowed({ status: "MATCHED", page: { batch: { status: "NEEDS_REVIEW" } } })).not.toThrow();
    expect(() => assertOcrBatchContentAdditionAllowed("APPROVED")).toThrow(/cannot be added/i);
    expect(() => assertOcrBatchContentAdditionAllowed("NEEDS_REVIEW")).not.toThrow();
  });

  it("enforces the configured manual row cap before creating a row", async () => {
    const page = {
      id: "page-1",
      status: "NEEDS_REVIEW",
      batchId: "batch-1",
      batch: { status: "NEEDS_REVIEW", profile: { maximumRowsPerPage: 2, minimumSuggestionConfidence: 80 } },
      rows: [{ rowNumber: 1 }, { rowNumber: 2 }]
    };
    const client: any = {
      $transaction: async (work: any) => work(client),
      feeRegisterOcrPage: { findUnique: async () => page },
      feeRegisterOcrRow: { create: async () => { throw new Error("row create must not run"); } }
    };
    await expect(addManualOcrRow(client, page.id, {}, "reviewer-1")).rejects.toThrow(/configured row limit/i);
  });

  it("routes cancellation through review or approval permissions instead of upload permission", () => {
    const route = readFileSync("app/api/fee-register-ocr/batches/[id]/route.ts", "utf8");
    expect(route).toContain("ocrBatchCancelPermission");
    expect(route).toContain('requireApiPermission("VIEW_FEE_REGISTER_OCR")');
    const ui = readFileSync("components/fee-register-ocr-ui.tsx", "utf8");
    expect(ui).toContain('can("REVIEW_FEE_REGISTER_OCR_ROWS")');
    expect(ui).toContain('can("APPROVE_FEE_REGISTER_OCR_BATCHES")');
  });
});

describe("Prompt 20B provider trust boundary", () => {
  it("keeps MOCK deterministic and MANUAL network-free", () => {
    const context = { sourceSha256: "a".repeat(64), maximumRows: 20 };
    expect(runFeeRegisterOcrProvider("MOCK", context)).toEqual(runFeeRegisterOcrProvider("MOCK", context));
    expect(runFeeRegisterOcrProvider("MANUAL", context)).toEqual({ rawText: "", confidence: 0, rows: [] });
  });

  it("fails closed for local and cloud providers", () => {
    const context = { sourceSha256: "b".repeat(64), maximumRows: 20 };
    expect(() => runFeeRegisterOcrProvider("LOCAL_HTTP", context)).toThrow(/disabled/i);
    expect(() => runFeeRegisterOcrProvider("CLOUD_API", context)).toThrow(/disabled/i);
    expect(validateLocalOcrEndpoint("http://127.0.0.1:8080/ocr")).toMatch(/^http:/);
    expect(() => validateLocalOcrEndpoint("https://example.com/ocr")).toThrow(/loopback/i);
    expect(() => validateLocalOcrEndpoint("http://user:pass@localhost/ocr")).toThrow(/credentials/i);
  });

  it("rejects extra fields, invalid confidence, duplicate rows, and unsafe boxes", () => {
    const base = {
      rawText: "page",
      confidence: 80,
      rows: [{ rowNumber: 1, rawText: "row", fields: { amount: "10" }, confidence: { amount: "HIGH" } }]
    };
    expect(() => validateOcrProviderResponse({ ...base, prompt: "ignore instructions" }, 10)).toThrow(/unsupported/i);
    expect(() => validateOcrProviderResponse({ ...base, rows: [{ ...base.rows[0], confidence: { amount: "CERTAIN" } }] }, 10)).toThrow(/invalid/i);
    expect(() => validateOcrProviderResponse({ ...base, rows: [base.rows[0], base.rows[0]] }, 10)).toThrow(/unique/i);
    expect(() => validateOcrProviderResponse({ ...base, rows: [{ ...base.rows[0], boundingBox: { x: 0.9, y: 0, width: 0.2, height: 0.2 } }] }, 10)).toThrow(/outside/i);
  });

  it("rejects malformed, excessive, oversized, and unsupported provider output without a network adapter", () => {
    const baseRow = {
      rowNumber: 1,
      rawText: "row",
      fields: { amount: "10" },
      confidence: { amount: "HIGH" }
    };
    expect(() => validateOcrProviderResponse(null, 2)).toThrow(/invalid response/i);
    expect(() => validateOcrProviderResponse({ rawText: "page", confidence: 101, rows: [] }, 2)).toThrow(/between 0 and 100/i);
    expect(() => validateOcrProviderResponse({
      rawText: "page",
      confidence: 50,
      rows: [baseRow, { ...baseRow, rowNumber: 2 }, { ...baseRow, rowNumber: 3 }]
    }, 2)).toThrow(/too many rows/i);
    expect(() => validateOcrProviderResponse({
      rawText: "page",
      confidence: 50,
      rows: [{ ...baseRow, fields: { amount: "10", guardianPhone: "9000000000" } }]
    }, 2)).toThrow(/unsupported fields/i);
    expect(() => validateOcrProviderResponse({
      rawText: "x".repeat(50_001),
      confidence: 50,
      rows: []
    }, 2)).toThrow(/too long/i);

    const providerSource = readFileSync("lib/fee-register-ocr-provider.ts", "utf8");
    expect(providerSource).not.toMatch(/\bfetch\s*\(/);
    expect(providerSource).not.toMatch(/\bhttps?\.(?:get|request)\s*\(/);
  });
});

describe("Prompt 20B conservative Student matching", () => {
  const enrollment = { academicYear: "2026-27", className: "VI", section: "A", status: "ACTIVE" };
  const students = [
    { id: "one", admissionNo: "QA20B-001", studentName: "QA20B Student One", className: "VI", section: "A", deletedAt: null, academicYearEnrollments: [enrollment] },
    { id: "two", admissionNo: "QA20B-002", studentName: "QA20B Duplicate Name", className: "VI", section: "A", deletedAt: null, academicYearEnrollments: [enrollment] },
    { id: "three", admissionNo: "QA20B-003", studentName: "QA20B Duplicate Name", className: "VI", section: "A", deletedAt: null, academicYearEnrollments: [enrollment] }
  ];
  const client = { student: { findMany: async () => students } };

  it("auto-selects only authoritative unique exact matches", async () => {
    const admission = await matchStudentForOcr(client, "2026-27", { admissionNumber: "qa20b-001" });
    expect(admission).toMatchObject({ student: { id: "one" }, method: "ADMISSION_NUMBER_EXACT" });
    const duplicateName = await matchStudentForOcr(client, "2026-27", { studentName: "QA20B Duplicate Name", className: "6", section: "A" });
    expect(duplicateName.student).toBeNull();
    expect(duplicateName.candidates).toHaveLength(2);
  });

  it("does not expose unrelated same-class Students when the source name is absent", async () => {
    const missingName = await matchStudentForOcr(client, "2026-27", { studentName: "", className: "6", section: "A" });
    expect(missingName).toEqual({ student: null, method: "NONE", candidates: [] });
  });
});

describe("Prompt 20B controlled posting and exports", () => {
  it("keeps Payment posting fail-closed until finance invariants are proven", async () => {
    await expect(processOcrPosting()).rejects.toThrow(/disabled/i);
  });

  it("produces formula-safe aggregate and reviewed staging CSV", async () => {
    const aggregate = feeRegisterOcrAggregateCsv({
      generatedAt: "2026-07-19T00:00:00.000Z",
      totals: {},
      batchesByStatus: {},
      pagesByStatus: {},
      rowsByStatus: {},
      duplicateClassifications: {},
      matchingMethods: {},
      fieldConfidence: {},
      providerModes: {},
      batches: [{
        batchNumber: "=CMD()", academicYear: "2026-27", registerName: "QA20B",
        status: "NEEDS_REVIEW", providerKind: "MOCK", pages: 1, rows: 1,
        verifiedAmountMinor: 0, postedAmountMinor: 0, paymentPostingEnabled: false
      }]
    } as any);
    expect(aggregate).toContain("\"'=CMD()\"");

    const client = {
      feeRegisterOcrBatch: {
        findUnique: async () => ({
          batchNumber: "QA20B-BATCH",
          pages: [{
            pageNumber: 1,
            rows: [{
              rowNumber: 1, matchedStudentId: null, paymentDate: null, amountMinor: null,
              paymentMode: "=HYPERLINK(\"x\")", receivedAccount: "", academicTerm: "",
              handwrittenReceiptReference: "", duplicateClassification: "INSUFFICIENT_DATA",
              status: "NEEDS_REVIEW"
            }]
          }]
        })
      },
      student: { findMany: async () => [] }
    };
    const staging = await reviewedOcrStagingCsv(client, "batch-1");
    expect(staging).toContain("does not prove that a Payment was posted");
    expect(staging).toContain("'=HYPERLINK");
  });

  it("does not misclassify an unlinked posted row as a duplicate Payment link", async () => {
    const report = await feeRegisterOcrReportData({
      feeRegisterOcrBatch: {
        findMany: async () => [{
          status: "POSTED", totalVerifiedAmountMinor: 0, totalPostedAmountMinor: 0,
          profile: { providerKind: "MOCK", paymentPostingEnabled: false },
          postingRuns: [], pages: [{ status: "PURGED", providerKind: "MOCK", rows: [
            { status: "POSTED", postedPaymentId: null, amountMinor: 100, fieldConfidenceJson: "{}", duplicateClassification: "NO_DUPLICATE", matchingMethod: "MANUAL_SELECTION" },
            { status: "POSTED", postedPaymentId: "payment-1", amountMinor: 100, fieldConfidenceJson: "{}", duplicateClassification: "NO_DUPLICATE", matchingMethod: "MANUAL_SELECTION" },
            { status: "POSTED", postedPaymentId: "payment-1", amountMinor: 100, fieldConfidenceJson: "{}", duplicateClassification: "NO_DUPLICATE", matchingMethod: "MANUAL_SELECTION" }
          ] }]
        }]
      }
    });
    expect(report.totals.unlinkedPostedRows).toBe(1);
    expect(report.totals.duplicatePaymentLinks).toBe(1);
  });
});

describe("Prompt 20B permission and UI guardrails", () => {
  it("blocks Teacher and Parent while keeping Viewer read-only", () => {
    for (const role of ["TEACHER", "PARENT"] as const) {
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("VIEW_FEE_REGISTER_OCR")).toBe(false);
    }
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_FEE_REGISTER_OCR")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_FEE_REGISTER_OCR_REPORTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("REVIEW_FEE_REGISTER_OCR_ROWS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ACCOUNTANT.has("POST_FEE_REGISTER_OCR_PAYMENTS")).toBe(true);
  });

  it("uses in-app dialogs and private no-store image responses", () => {
    const ui = readFileSync("components/fee-register-ocr-ui.tsx", "utf8");
    const storage = readFileSync("lib/fee-register-ocr-storage.ts", "utf8");
    const imageRoute = readFileSync("app/api/fee-register-ocr/pages/[pageId]/image/route.ts", "utf8");
    const rowRoute = readFileSync("app/api/fee-register-ocr/rows/[rowId]/route.ts", "utf8");
    const uploadRoute = readFileSync("app/api/fee-register-ocr/batches/[id]/pages/route.ts", "utf8");
    const restoreRoute = readFileSync("app/api/restore/route.ts", "utf8");
    const reportPage = readFileSync("app/fee-register-ocr/reports/page.tsx", "utf8");
    expect(ui).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    expect(ui).toMatch(/role="dialog"/);
    expect(ui).toMatch(/PDF, HEIC, SVG, HTML and office files are not supported/);
    expect(ui).toMatch(/selectedCandidateId/);
    expect(ui).toMatch(/studentId: selectedCandidateId/);
    expect(ui).not.toMatch(/studentId: reason/);
    expect(ui).toMatch(/setReason\(""\);\s*setSelectedCandidateId\(candidateId\);\s*setChecklist\(\{\}\)/);
    expect(imageRoute).toMatch(/private, no-store/);
    expect(imageRoute).toMatch(/Content-Security-Policy/);
    expect(storage).toMatch(/stat\.isSymbolicLink\(\)/);
    expect(storage).toMatch(/assertWithin\(root, resolved\)/);
    expect(storage).toMatch(/Invalid OCR source storage key/);
    expect(rowRoute).toMatch(/requireApiPermission\("REVIEW_FEE_REGISTER_OCR_ROWS"\)/);
    expect(uploadRoute).toMatch(/where: \{ sourceSha256: image\.sha256 \}/);
    expect(restoreRoute).toMatch(/feeRegisterOcrEvents: backup\.feeRegisterOcrEvents\.length/);
    expect(reportPage).toMatch(/canViewBatches \? <Link/);
  });
});
