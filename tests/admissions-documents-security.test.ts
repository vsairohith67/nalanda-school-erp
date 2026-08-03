import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAdmissionStorageKey } from "@/lib/admissions-files";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("Prompt 23H private admissions documents", () => {
  it("refuses traversal, non-opaque names and unsupported extensions", () => {
    for (const key of ["../secret.pdf", "birth-certificate.pdf", "aa/bb/not-a-uuid.pdf", "aa/bb/11111111-1111-4111-8111-111111111111.svg"]) expect(() => resolveAdmissionStorageKey(key)).toThrow();
  });

  it("reuses strict PDF/image validation and enforces per-cycle document enablement", () => {
    const files = source("lib/admissions-files.ts");
    expect(files).toContain("validateClassworkUpload");
    expect(files).toContain("documentTypesJson");
    expect(files).toContain("MAX_TOTAL_BYTES");
    expect(files).toContain("isSymbolicLink");
    expect(files).not.toMatch(/public\/uploads|originalPath|exif/i);
  });

  it("requires two encrypted restores before marking recovery verified", () => {
    const backup = source("lib/admissions-asset-backup.ts");
    expect(backup).toContain("restoreRoots: [string, string]");
    expect(backup).toContain("firstRestore");
    expect(backup).toContain("secondRestore");
    expect(backup).toContain('recoveryStatus: "VERIFIED"');
    expect(backup).toContain("decryptCloudBackup");
  });

  it("keeps applicant access token-bound and staff retrieval authenticated", () => {
    const files = source("lib/admissions-files.ts");
    expect(files).toContain("application.id !== document.applicationId");
    expect(files).toContain("assignedTeacher");
    expect(files).toContain("DOCUMENT_RECOVERY_REQUIRED");
    expect(source("app/api/public/admissions/application/documents/[publicKey]/route.ts")).toContain("invitationToken(request)");
    expect(source("lib/admissions-api.ts")).toContain("x-admission-invitation");
  });
});
