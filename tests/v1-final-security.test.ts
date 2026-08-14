import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { admissionsStorageRoot } from "@/lib/admissions-files";
import { classworkStorageRoot } from "@/lib/classwork-files";
import { onboardingStorageRoot } from "@/lib/onboarding-storage";
import { payslipRequestStorageRoot } from "@/lib/payslip-request-storage";
import { supportStorageRoot } from "@/lib/support-files";
import { readRegisterImage, storeRegisterImage } from "@/lib/fee-register-ocr-storage";
import { verifyReleasePackage } from "@/lib/release-package";

const originalEnvironment = { ...process.env };
afterEach(() => { process.env = { ...originalEnvironment }; });

describe("V1-FINAL-1A security closure", () => {
  it("refuses every configurable private root beneath the statically public tree", () => {
    const publicChild = path.join(process.cwd(), "public", "private-fixture");
    for (const [name, resolve] of [
      ["ADMISSIONS_PRIVATE_STORAGE_ROOT", admissionsStorageRoot],
      ["CLASSWORK_PRIVATE_STORAGE_ROOT", classworkStorageRoot],
      ["SUPPORT_PRIVATE_STORAGE_ROOT", supportStorageRoot],
      ["ONBOARDING_STORAGE_ROOT", onboardingStorageRoot],
      ["PAYSLIP_REQUEST_STORAGE_ROOT", payslipRequestStorageRoot]
    ] as const) {
      process.env[name] = publicChild;
      expect(resolve, name).toThrow(/public or release-artifact/i);
      delete process.env[name];
    }
  });

  it("verifies OCR source bytes against stored size and SHA-256 on read", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "v1-final-ocr-"));
    process.env.FEE_REGISTER_OCR_STORAGE_DIR = root;
    try {
      const bytes = Buffer.from("synthetic-private-register-image");
      const storageKey = await storeRegisterImage({ bytes, mimeType: "image/png", extension: ".png", displayName: "Synthetic.png", byteSize: bytes.length, width: 1, height: 1, sha256: digest(bytes) });
      await expect(readRegisterImage(storageKey, digest(bytes), bytes.length)).resolves.toEqual(bytes);
      await expect(readRegisterImage(storageKey, "0".repeat(64), bytes.length)).rejects.toThrow(/SHA-256/);
      await expect(readRegisterImage(storageKey, digest(bytes), bytes.length + 1)).rejects.toThrow(/size/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses a high-ratio release archive before materializing its contents", () => {
    const archiveBytes = Buffer.from(zipSync({ "runtime/oversized.txt": Buffer.alloc(2 * 1024 * 1024) }, { level: 9 }));
    expect(() => verifyReleasePackage({ archiveBytes })).toThrow(/COMPRESSION_RATIO_REFUSED/);
  });

  it("requires durable support keys, pinned qpdf identity, and trusted public-source extraction", async () => {
    const supportBackup = await readFile("scripts/support-asset-backup.ts", "utf8");
    expect(supportBackup).toContain("durable SUPPORT_ASSET_BACKUP_KEY_VERSION");
    expect(supportBackup).not.toContain("randomBytes(32)");
    expect(supportBackup).toContain("keyPersisted:true");
    const qpdf = await readFile("lib/payslip-request-pdf.ts", "utf8");
    expect(qpdf).toContain("QPDF_EXECUTABLE_SHA256");
    expect(qpdf).toContain("failed SHA-256 identity verification");
    for (const route of ["app/api/public/support/requests/route.ts", "app/api/public/admissions/enquiries/route.ts"]) {
      const source = await readFile(route, "utf8");
      expect(source).toContain("loginRequestSource(request.headers)");
      expect(source).not.toContain('request.headers.get("x-forwarded-for")');
      expect(source).not.toContain('request.headers.get("user-agent")');
    }
  });
});

function digest(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
