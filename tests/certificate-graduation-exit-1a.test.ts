import { certificateUploadAdmission } from "@/lib/request-security";
import { describe, expect, it, vi } from "vitest";
import { defaultTemplateDefinition, GRADUATION_DISCLAIMER, validateCertificateTemplateDefinition } from "@/lib/certificate-templates";
import { newCertificateToken, renderCertificatePdf } from "@/lib/certificate-pdf";
import { certificateWorkbookTemplate, parseCertificateWorkbook } from "@/lib/certificate-workbooks";
import { operationalReleaseFeatureAvailability } from "@/lib/release-feature-flag-runtime";
import { CERTIFICATE_GRADUATION_FEATURE } from "@/lib/certificate-graduation-policy";
import { validateRequestInput } from "@/lib/certificate-requests";
import { RATE_LIMIT_POLICIES } from "@/lib/security-resilience";
import * as XLSX from "xlsx";
import { unzipSync, strToU8, zipSync } from "fflate";

function workbook(change?: (wb: XLSX.WorkBook) => void) {
  const wb = XLSX.read(certificateWorkbookTemplate());
  XLSX.utils.sheet_add_aoa(wb.Sheets.Certificates, [["SYNTHETIC-REQUEST", "SYNTHETIC-ADMISSION", "SYNTHETIC STUDENT", "2026-27", "X"]], { origin: "A2" });
  change?.(wb); return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
describe("Graduation authenticity and fail-closed policy", () => {
  it("preserves the institutional disclaimer and accepts the reusable default", () => {
    const d = validateCertificateTemplateDefinition("GRADUATION", defaultTemplateDefinition("GRADUATION"));
    expect(d.disclaimer).toBe(GRADUATION_DISCLAIMER);
    expect(() => validateCertificateTemplateDefinition("GRADUATION", { ...d, disclaimer: "Official certificate" })).toThrow();
  });
  it.each([
    { body: "Has passed the Board examination" },
    { body: "{{conductText}}", customConductText: "Board pass" },
    { recognitionText: "Board pass" },
    { signatories: [{ name: "SYNTHETIC PERSON", role: "Principal" }] },
    { disclaimer: `${GRADUATION_DISCLAIMER} It replaces the Board pass certificate.` },
  ])("rejects unsupported claims and typed personal signatures %j", change => {
    expect(() => validateCertificateTemplateDefinition("GRADUATION", { ...defaultTemplateDefinition("GRADUATION"), ...change })).toThrow();
  });
  it("canonicalizes a mixed-case request before policy checks", () => expect(validateRequestInput({ certificateType: "graduation", purpose: "Synthetic" }).certificateType).toBe("GRADUATION"));
  it("keeps production default OFF, including an attempted synthetic override", () => {
    expect(operationalReleaseFeatureAvailability(CERTIFICATE_GRADUATION_FEATURE, { environment: { NODE_ENV: "production", RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY", RELEASE_FEATURE_FLAGS_QA_ENABLED: CERTIFICATE_GRADUATION_FEATURE.key } }).enabled).toBe(false);
  });
  it("creates independent opaque 256-bit tokens", () => {
    const tokens = Array.from({ length: 1000 }, newCertificateToken);
    expect(new Set(tokens).size).toBe(1000); expect(tokens.every(t => /^[A-Za-z0-9_-]{43}$/.test(t))).toBe(true);
  });
  it("uses bounded verification and bulk rate policies", () => {
    expect(RATE_LIMIT_POLICIES.find(p => p.id === "certificate.verify")?.maximum).toBe(20);
    expect(RATE_LIMIT_POLICIES.find(p => p.id === "certificate.bulk")?.maximum).toBe(10);
  });
  it("fails truthfully when Georgia is missing", async () => {
    const prior = process.env.CERTIFICATE_GEORGIA_BOLD_PATH;
    process.env.CERTIFICATE_GEORGIA_BOLD_PATH = "C:/synthetic-missing-font/georgiab.ttf";
    try { await expect(renderCertificatePdf({}, "DRAFT")).rejects.toThrow(/GEORGIA/); }
    finally { if (prior === undefined) delete process.env.CERTIFICATE_GEORGIA_BOLD_PATH; else process.env.CERTIFICATE_GEORGIA_BOLD_PATH = prior; }
  });
});
describe("bounded certificate XLSX admission", () => {
  it("accepts an exact certificate-specific workbook", async () => expect(await parseCertificateWorkbook(workbook())).toHaveLength(1));
  it("rejects a formula", async () => { await expect(parseCertificateWorkbook(workbook(w => { w.Sheets.Certificates.A2 = { t: "n", v: 2, f: "1+1" }; }))).rejects.toThrow(); });
  it("rejects a hidden sheet", async () => { await expect(parseCertificateWorkbook(workbook(w => { w.Workbook ??= {}; w.Workbook.Sheets = [{ name: "Certificates", Hidden: 1 }, { name: "Metadata", Hidden: 0 }]; }))).rejects.toThrow(); });
  it("rejects excessive rows before processing", async () => { await expect(parseCertificateWorkbook(workbook(w => { w.Sheets.Certificates["!ref"] = "A1:E10000"; }))).rejects.toThrow(); });
  it("rejects macros and external relationships", async () => {
    const files = unzipSync(workbook()); files["xl/vbaProject.bin"] = strToU8("SYNTHETIC NOT EXECUTABLE");
    await expect(parseCertificateWorkbook(zipSync(files))).rejects.toThrow();
    delete files["xl/vbaProject.bin"]; files["xl/_rels/workbook.xml.rels"] = strToU8('<Relationships><Relationship TargetMode="External" Target="https://synthetic.invalid"/></Relationships>');
    await expect(parseCertificateWorkbook(zipSync(files))).rejects.toThrow();
  });
  it("rejects oversized input and wrong schema", async () => {
    await expect(parseCertificateWorkbook(new Uint8Array(1024 * 1024 + 1))).rejects.toThrow(/SIZE/);
    await expect(parseCertificateWorkbook(workbook(w => { w.Sheets.Certificates.A1.v = "Student ID"; }))).rejects.toThrow();
  });
});

describe("Certificate multipart admission before the route adapter", () => {
  const request = (body: ReadableStream<Uint8Array>, length?: string) => ({ method: "POST", nextUrl: { pathname: "/api/certificates/bulk" }, headers: new Headers({ "content-type": "multipart/form-data; boundary=synthetic", ...(length ? { "content-length": length } : {}) }), clone: () => ({ body }) }) as any;
  it("preserves a complete bounded stream and refuses mismatched length", async () => {
    const stream = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(3)); c.close(); } });
    expect(await certificateUploadAdmission(request(stream(), "3"))).toBeNull();
    expect((await certificateUploadAdmission(request(stream(), "5")))?.status).toBe(400);
  });
  it("refuses oversized actual bytes independently of the declared length", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(1024 * 1024 + 16 * 1024 + 1)); c.close(); } });
    expect((await certificateUploadAdmission(request(stream, "1")))?.status).toBe(413);
  });
  it("returns a controlled deadline and cancels a stalled source", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn(), stream = new ReadableStream<Uint8Array>({ cancel });
      const result = certificateUploadAdmission(request(stream, "100"));
      await vi.advanceTimersByTimeAsync(10_000);
      expect((await result)?.status).toBe(408); expect(cancel).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
});
