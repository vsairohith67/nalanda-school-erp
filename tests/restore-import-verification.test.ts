import { describe, expect, it, vi } from "vitest";
import { emptyEntityResult, type ValidatedBackup } from "../lib/restore";
import { restoreImportVerificationData } from "../lib/restore-database";

function verificationBackup(
  overrides: Partial<Pick<ValidatedBackup, "importBatches" | "goLiveChecklist">> = {}
) {
  return {
    importBatches: [{
      id: "batch-1",
      type: "PAYMENTS",
      fileName: "payments.xlsx",
      importedByUserId: "missing-user",
      importedByName: "Former Admin",
      importedAt: "2026-06-19T10:00:00.000Z",
      mode: "import-valid",
      totalRows: 10,
      createdCount: 9,
      updatedCount: 0,
      skippedCount: 1,
      errorCount: 0,
      warningCount: 1,
      status: "PARTIAL",
      notes: "Verified",
      detailsJson: "{\"samples\":[]}"
    }],
    goLiveChecklist: [{
      id: "go-live",
      backupTaken: true,
      paymentTotalsMatched: true,
      updatedBy: "Director",
      createdAt: "2026-06-19T09:00:00.000Z",
      updatedAt: "2026-06-19T10:00:00.000Z"
    }],
    ...overrides
  };
}

function restoreResult() {
  return {
    importBatches: emptyEntityResult(),
    goLiveChecklist: emptyEntityResult()
  };
}

describe("import verification restore", () => {
  it("skips an import batch whose original ID already exists", async () => {
    const create = vi.fn();
    const result = restoreResult();
    const client = {
      importBatch: {
        findUnique: vi.fn().mockResolvedValue({ id: "batch-1" }),
        create
      },
      goLiveChecklist: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      }
    };

    await restoreImportVerificationData(
      client as never,
      verificationBackup({ goLiveChecklist: [] }),
      { id: "restorer-1", name: "Director" },
      new Map(),
      result
    );

    expect(result.importBatches.skipped).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a missing import batch creator to the restoring user with a warning", async () => {
    const create = vi.fn().mockResolvedValue({ id: "batch-1" });
    const result = restoreResult();
    const client = {
      importBatch: {
        findUnique: vi.fn().mockResolvedValue(null),
        create
      },
      goLiveChecklist: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      }
    };

    await restoreImportVerificationData(
      client as never,
      verificationBackup({ goLiveChecklist: [] }),
      { id: "restorer-1", name: "Director" },
      new Map(),
      result
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "batch-1",
        importedByUserId: "restorer-1",
        importedByName: "Former Admin",
        importedAt: new Date("2026-06-19T10:00:00.000Z")
      })
    });
    expect(result.importBatches.created).toBe(1);
    expect(result.importBatches.warnings).toHaveLength(1);
  });

  it("creates then updates the canonical checklist without duplicate rows", async () => {
    const create = vi.fn().mockResolvedValue({ id: "go-live" });
    const update = vi.fn().mockResolvedValue({ id: "go-live" });
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "go-live" });
    const client = {
      importBatch: {
        findUnique: vi.fn(),
        create: vi.fn()
      },
      goLiveChecklist: { findUnique, create, update }
    };

    const first = restoreResult();
    await restoreImportVerificationData(
      client as never,
      verificationBackup({ importBatches: [] }),
      { id: "restorer-1", name: "Director" },
      new Map(),
      first
    );
    const second = restoreResult();
    await restoreImportVerificationData(
      client as never,
      verificationBackup({ importBatches: [] }),
      { id: "restorer-1", name: "Director" },
      new Map(),
      second
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "go-live",
        backupTaken: true,
        paymentTotalsMatched: true
      })
    });
    expect(first.goLiveChecklist.created).toBe(1);
    expect(second.goLiveChecklist.updated).toBe(1);
  });
});
