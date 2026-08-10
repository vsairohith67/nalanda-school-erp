import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";

const now = "2026-07-19T10:00:00.000Z";

function fixture() {
  return createBackupDocument({
    generatedAt: new Date(now),
    generatedBy: "QA20B",
    students: [{ id: "student-1", admissionNo: "QA20B-001", studentName: "QA20B Student" }],
    feeStructures: [],
    payments: [],
    paymentAudits: [],
    users: [],
    feeRegisterOcrProfiles: [{
      id: "profile-1", profileCode: "QA20B-MOCK", name: "MOCK", providerKind: "MOCK",
      status: "ACTIVE", liveUseEnabled: false, paymentPostingEnabled: false,
      maximumFileBytes: 5_000_000, maximumImagePixels: 20_000_000,
      maximumPagesPerBatch: 25, maximumRowsPerPage: 100, requestTimeoutMs: 10_000,
      minimumSuggestionConfidence: 80, retentionDays: 30, createdAt: now, updatedAt: now
    }],
    feeRegisterOcrBatches: [{
      id: "batch-1", batchNumber: "QA20B-BATCH-1", profileId: "profile-1",
      academicYear: "2026-27", registerName: "QA20B Register", status: "NEEDS_REVIEW",
      sourcePageCount: 1, extractedRowCount: 1, verifiedRowCount: 0, duplicateRowCount: 0,
      rejectedRowCount: 0, postedRowCount: 0, postingFailedRowCount: 0,
      totalExtractedAmountMinor: 10000, totalVerifiedAmountMinor: 0, totalPostedAmountMinor: 0,
      reviewVersion: 1, createdByUserId: "private-actor", createdAt: now, updatedAt: now
    }],
    feeRegisterOcrPages: [{
      id: "page-1", batchId: "batch-1", pageNumber: 1, originalDisplayName: "QA20B.png",
      storageKey: `${"a".repeat(32)}.png`, sourceSha256: "b".repeat(64), mimeType: "image/png",
      byteSize: 24, width: 4, height: 3, rotationDegrees: 0, status: "EXTRACTED",
      providerKind: "MOCK", rawOcrText: "private provider page text",
      createdAt: now, updatedAt: now
    }],
    feeRegisterOcrRows: [{
      id: "row-1", pageId: "page-1", rowNumber: 1, rawText: "QA20B row",
      extractedFieldsJson: "{}", fieldConfidenceJson: "{}", candidateMatchesJson: "[]",
      matchedStudentId: "student-1", matchingMethod: "EXACT_ADMISSION", status: "NEEDS_REVIEW",
      amountMinor: 10000, duplicateClassification: "NO_DUPLICATE",
      duplicateEvidenceJson: "[]", verificationChecklistJson: "{}",
      createdAt: now, updatedAt: now, correctedByUserId: "private-actor"
    }],
    feeRegisterOcrRowRevisions: [{
      id: "revision-1", rowId: "row-1", revisionNumber: 1,
      previousSnapshotJson: "{}", newSnapshotJson: "{}", changeReason: "QA20B correction",
      changedByUserId: "private-actor", createdAt: now
    }],
    feeRegisterOcrPostingRuns: [],
    feeRegisterOcrEvents: [{
      id: "event-1", batchId: "batch-1", pageId: "page-1", rowId: "row-1",
      eventType: "ROW_UPDATED", safeReason: "Synthetic", actorUserId: "private-actor", createdAt: now
    }]
  });
}

describe("Prompt 20B backup and restore validation", () => {
  it("uses version 37, includes all seven OCR arrays, and excludes bytes, raw page text, and actors", () => {
    const backup = fixture();
    expect(backup.metadata.backupVersion).toBe(41);
    for (const key of [
      "feeRegisterOcrProfiles", "feeRegisterOcrBatches", "feeRegisterOcrPages",
      "feeRegisterOcrRows", "feeRegisterOcrRowRevisions", "feeRegisterOcrPostingRuns",
      "feeRegisterOcrEvents"
    ] as const) expect(backup[key]).toBeDefined();
    const serialized = JSON.stringify(backup);
    expect(serialized).not.toContain("private provider page text");
    expect(serialized).not.toContain("private-actor");
    expect(serialized).not.toContain("imageBytes");
  });

  it("accepts valid linked OCR records and rejects sensitive or broken records", () => {
    expect(parseAndValidateBackup(JSON.stringify(fixture())).feeRegisterOcrRows).toHaveLength(1);

    const sensitive: any = structuredClone(fixture());
    sensitive.feeRegisterOcrPages[0].rawOcrText = "not allowed";
    expect(() => parseAndValidateBackup(JSON.stringify(sensitive))).toThrow(/unsupported or sensitive/i);

    const broken: any = structuredClone(fixture());
    broken.feeRegisterOcrRows[0].matchedStudentId = "missing-student";
    expect(() => parseAndValidateBackup(JSON.stringify(broken))).toThrow(/does not match/i);
  });

  it("rejects a posted OCR row without its immutable Payment link", () => {
    const invalid: any = structuredClone(fixture());
    invalid.feeRegisterOcrRows[0].status = "POSTED";
    invalid.feeRegisterOcrRows[0].postedPaymentId = null;
    expect(() => parseAndValidateBackup(JSON.stringify(invalid))).toThrow(/POSTED without a Payment link/i);
  });
});
