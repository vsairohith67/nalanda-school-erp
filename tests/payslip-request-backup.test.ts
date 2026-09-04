import { createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { validatePayslipRequestBackupRows } from "@/lib/payslip-request-backup";
import { createAndVerifyPayslipRequestAssetBackup, restorePayslipRequestAssetBackup } from "@/lib/payslip-request-asset-backup";
import { resolvePayslipStorageKey } from "@/lib/payslip-request-storage";
import { parseAndValidateBackup } from "@/lib/restore";

const roots: string[] = [];
afterEach(async () => { while (roots.length) await rm(roots.pop()!, { recursive: true, force: true }); });

describe("HR-PAYSLIP-REQ-1 backup and recovery", () => {
  it("preserves request/version/envelope links in version 37 without plaintext secret fields", () => {
    const rows = metadataRows();
    const backup = createBackupDocument({ generatedAt: new Date("2026-08-08T00:00:00.000Z"), generatedBy: "PAYSLIPREQ1", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...rows });
    expect(backup.metadata.backupVersion).toBe(45);
    expect(backup.metadata.counts.staffPayslipDocumentVersions).toBe(1);
    const parsed = parseAndValidateBackup(backup);
    expect(parsed.staffPayslipDocumentVersions[0]).toMatchObject({ requestId: "request-1", passwordKeyVersion: "SYNTHETIC_V1", supersedesVersionId: null });
    expect(parsed.staffPayslipDocumentMonths[0]).toMatchObject({ documentVersionId: "document-1", requestMonthId: "month-1" });
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain("synthetic-opening-password");
    expect(serialized).not.toContain("synthetic-owner-password");
    expect(serialized).not.toContain("PAYSLIP_REQUEST_KEYRING_JSON");
  });

  it("refuses dangling links and explicit plaintext-password fields", () => {
    const rows: any = metadataRows();
    rows.staffPayslipDocumentMonths[0].requestMonthId = "missing";
    expect(() => validatePayslipRequestBackupRows(rows)).toThrow(/requestMonthId relationship/i);
    rows.staffPayslipDocumentMonths[0].requestMonthId = "month-1";
    rows.staffPayslipDocumentVersions[0].openingPassword = "forbidden";
    expect(() => validatePayslipRequestBackupRows(rows)).toThrow(/unsupported fields/i);
  });

  it("encrypts actual source/derivative bytes, restores twice exactly, and fails for wrong keys or corruption", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "payslipreq1-backup-")); roots.push(root);
    process.env.PAYSLIP_REQUEST_STORAGE_ROOT = path.join(root, "storage");
    const sourceKey = "source/11/11/11111111-1111-4111-8111-111111111111.enc", derivativeKey = "delivery/22/22/22222222-2222-4222-8222-222222222222.pdf";
    const source = Buffer.from("ciphertext-only-synthetic-source"), derivative = Buffer.from("password-protected-synthetic-derivative");
    for (const [key, bytes] of [[sourceKey, source], [derivativeKey, derivative]] as const) { const target = resolvePayslipStorageKey(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); }
    const client: any = { staffPayslipDocumentVersion: { findMany: async () => [{ publicKey: "document_public_001", versionNumber: 1, sourceStorageKey: sourceKey, sourceSha256: sha(Buffer.from("synthetic-visible-source")), derivativeStorageKey: derivativeKey, derivativeSha256: sha(derivative), pageCount: 1, request: { publicKey: "request_public_001" } }] } };
    const key = randomBytes(32), artifactPath = path.join(root, "artifact.npsbackup");
    const proof = await createAndVerifyPayslipRequestAssetBackup(client, { artifactPath, key, keyVersion: "V91", restoreRoots: [path.join(root, "restore-a"), path.join(root, "restore-b")] });
    expect(proof.firstRestore.assetDigest).toBe(proof.secondRestore.assetDigest);
    expect(await readFile(path.join(root, "restore-a", derivativeKey))).toEqual(derivative);
    const container = await readFile(artifactPath);
    await expect(restorePayslipRequestAssetBackup(container, { key: randomBytes(32), targetRoot: path.join(root, "wrong-key") })).rejects.toThrow();
    const corrupt = Buffer.from(container); corrupt[Math.floor(corrupt.length / 2)] ^= 1;
    await expect(restorePayslipRequestAssetBackup(corrupt, { key, targetRoot: path.join(root, "corrupt") })).rejects.toThrow();
  });
});

function metadataRows() {
  const date = new Date("2026-08-08T00:00:00.000Z");
  return {
    staffPayslipMonthAvailability: [],
    staffPayslipRequests: [{ id: "request-1", publicKey: "request_public_001", requestNumber: "PSR-20260808-0001", submissionKey: "11111111-1111-4111-8111-111111111111", staffMemberId: "staff-1", purpose: "PERSONAL_RECORD", privateExplanation: null, requiredByDate: null, status: "ISSUED", correctionOfRequestId: null, assignedPreparerUserId: "user-2", submittedAt: date, preparationStartedAt: date, readyToIssueAt: date, issuedAt: date, rejectedAt: null, cancelledAt: null, supersededAt: null, expiredAt: null, retentionReviewDate: null, archiveStatus: "ACTIVE", legalPolicyHold: false, version: 4, createdAt: date, updatedAt: date }],
    staffPayslipRequestMonths: [{ id: "month-1", requestId: "request-1", salaryMonth: "2026-07", availabilitySnapshot: "AVAILABLE", issueStatus: "ISSUED", activeOverlapKey: null, createdAt: date }],
    staffPayslipRequestEvents: [{ id: "event-1", publicKey: "event_public_001", requestId: "request-1", eventType: "REQUEST_SUBMITTED", actorUserId: "user-1", actorRole: "TEACHER", previousStatus: null, newStatus: "SUBMITTED", entityVersion: 1, safeReason: null, safeMetadataJson: "{}", requestHash: null, occurredAt: date, createdAt: date }],
    staffPayslipDocumentVersions: [{ id: "document-1", publicKey: "document_public_001", requestId: "request-1", versionNumber: 1, status: "ACTIVE", verificationReference: "PSV-synthetic-reference", sourceStorageKey: "source/11/11/11111111-1111-4111-8111-111111111111.enc", sourceKeyVersion: "SYNTHETIC_V1", sourceNonce: "AAAAAAAAAAAAAAAA", sourceAuthTag: "AAAAAAAAAAAAAAAAAAAAAA", sourceSha256: "a".repeat(64), sourceByteSize: 100, derivativeStorageKey: "delivery/22/22/22222222-2222-4222-8222-222222222222.pdf", derivativeSha256: "b".repeat(64), derivativeByteSize: 200, pageCount: 1, passwordKeyVersion: "SYNTHETIC_V1", passwordNonce: "BBBBBBBBBBBBBBBB", passwordCiphertext: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", passwordAuthTag: "DDDDDDDDDDDDDDDDDDDDDD", uploadedByUserId: "user-2", approvedByUserId: "user-3", issuedByUserId: "user-3", issuedAt: date, replacementReason: null, supersedesVersionId: null, createdAt: date, updatedAt: date }],
    staffPayslipDocumentMonths: [{ id: "document-month-1", documentVersionId: "document-1", requestMonthId: "month-1", salaryMonth: "2026-07", createdAt: date }],
    staffPayslipAccessEvents: []
  };
}

function sha(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
