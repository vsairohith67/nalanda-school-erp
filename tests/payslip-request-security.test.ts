import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptPayslipSecret, encryptPayslipSecret, generateDocumentPassword, generateOwnerPassword, signPayslipDownload, verifyPayslipDownload } from "@/lib/payslip-request-crypto";
import { PayslipPdfError, validatePayslipPdf } from "@/lib/payslip-request-pdf";
import { readEncryptedPayslipSource, readProtectedPayslipDerivative, resolvePayslipStorageKey, storeEncryptedPayslipSource, storeProtectedPayslipDerivative } from "@/lib/payslip-request-storage";

const original = { ...process.env };
let root = "";

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "payslipreq1-security-"));
  process.env.PAYSLIP_REQUEST_STORAGE_ROOT = path.join(root, "storage");
  process.env.PAYSLIP_REQUEST_TEMP_ROOT = path.join(root, "processing");
  process.env.PAYSLIP_REQUEST_KEYRING_JSON = JSON.stringify({ active: "SYNTHETIC_V1", keys: { SYNTHETIC_V1: randomBytes(32).toString("base64") } });
  process.env.SESSION_SECRET = "synthetic-session-secret-that-is-at-least-32-bytes";
  delete process.env.QPDF_EXECUTABLE_PATH;
});

afterEach(async () => {
  process.env = { ...original };
  await rm(root, { recursive: true, force: true });
});

describe("HR-PAYSLIP-REQ-1 secret and delivery boundaries", () => {
  it("uses bound AES-256-GCM envelopes and fails closed for wrong bindings, keys, or tags", () => {
    const openingPassword = generateDocumentPassword(), ownerPassword = generateOwnerPassword();
    expect(openingPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(ownerPassword).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(openingPassword).not.toBe(ownerPassword);
    const envelope = encryptPayslipSecret(openingPassword, "document_binding_001", "OPENING_PASSWORD");
    expect(envelope).not.toHaveProperty("password");
    expect(decryptPayslipSecret(envelope, "document_binding_001", "OPENING_PASSWORD").toString()).toBe(openingPassword);
    expect(() => decryptPayslipSecret(envelope, "document_binding_002", "OPENING_PASSWORD")).toThrow(/failed authentication/i);
    expect(() => decryptPayslipSecret({ ...envelope, authTag: randomBytes(16).toString("base64url") }, "document_binding_001", "OPENING_PASSWORD")).toThrow(/failed authentication/i);
    process.env.PAYSLIP_REQUEST_KEYRING_JSON = JSON.stringify({ active: "OTHER", keys: { OTHER: randomBytes(32).toString("base64") } });
    expect(() => decryptPayslipSecret(envelope, "document_binding_001", "OPENING_PASSWORD")).toThrow(/key version is unavailable/i);
  });

  it("binds short-lived download authorization to the exact session and document", () => {
    const now = Date.now(), signed = signPayslipDownload("document_key_001", "session_key_001", now);
    expect(verifyPayslipDownload(signed.authorization, "document_key_001", "session_key_001", now + 100)).toBe(true);
    expect(verifyPayslipDownload(signed.authorization, "document_key_002", "session_key_001", now + 100)).toBe(false);
    expect(verifyPayslipDownload(signed.authorization, "document_key_001", "session_key_002", now + 100)).toBe(false);
    expect(verifyPayslipDownload(signed.authorization, "document_key_001", "session_key_001", now + 121_000)).toBe(false);
  });

  it("stores only encrypted management source bytes and verifies both stored hashes", async () => {
    const source = Buffer.from("synthetic-pdf-source-without-salary-data");
    const binding = "document_binding_003";
    const stored = await storeEncryptedPayslipSource(source, binding);
    const raw = await import("node:fs/promises").then(({ readFile }) => readFile(resolvePayslipStorageKey(stored.storageKey)));
    expect(raw.includes(source)).toBe(false);
    expect(await readEncryptedPayslipSource(stored.storageKey, digest(source), binding, { keyVersion: stored.envelope.keyVersion, nonce: stored.envelope.nonce, authTag: stored.envelope.authTag })).toEqual(source);
    const derivative = Buffer.from("synthetic-protected-derivative");
    const deliveryKey = await storeProtectedPayslipDerivative(derivative);
    expect(await readProtectedPayslipDerivative(deliveryKey, digest(derivative))).toEqual(derivative);
    await expect(readProtectedPayslipDerivative(deliveryKey, "0".repeat(64))).rejects.toThrow(/SHA-256/i);
    for (const key of ["../private.pdf", "delivery/aa/bb/not-a-uuid.pdf", "source/aa/bb/11111111-1111-4111-8111-111111111111.pdf"]) expect(() => resolvePayslipStorageKey(key)).toThrow();
  });

  it("rejects active PDF content before utility invocation and fails closed when protection capability is absent", async () => {
    const document = await PDFDocument.create(); document.addPage([595, 842]);
    const safe = Buffer.from(await document.save({ useObjectStreams: false }));
    const file = (bytes: Buffer) => ({ name: "synthetic.pdf", type: "application/pdf", size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
    await expect(validatePayslipPdf(file(Buffer.concat([safe.subarray(0, safe.length - 6), Buffer.from("/JavaScript\n%%EOF")])))).rejects.toThrow(/scripts|actions/i);
    await expect(validatePayslipPdf(file(safe))).rejects.toMatchObject({ code: "PDF_PROTECTION_UNAVAILABLE", status: 503 } satisfies Partial<PayslipPdfError>);
  });
});

function digest(value: Uint8Array) { return require("node:crypto").createHash("sha256").update(value).digest("hex"); }
