import { describe, expect, it, vi } from "vitest";
import { createBackupDocument } from "../lib/backup";
import {
  cleanupTestData,
  previewTestDataCleanup,
  TEST_DATA_CLEANUP_CONFIRMATION
} from "../lib/test-data-cleanup";

function createCleanupClient() {
  const data = {
    payments: [
      { id: "pay-qa", receiptNo: "QA10C-0056", admissionNo: "NPS26006", studentName: "Anaya Begum", amountPaid: 400 },
      { id: "pay-real", receiptNo: "25023", admissionNo: "NPS26002", studentName: "Sara Khan", amountPaid: 6000 },
      { id: "pay-student", receiptNo: "QA-STUDENT-1", admissionNo: "QA-STU-1", studentName: "QA Student", amountPaid: 100 },
      { id: "pay-ambiguous-student", receiptNo: "12500", admissionNo: "QA-STU-2", studentName: "QA Mixed Student", amountPaid: 100 }
    ],
    audits: [
      { id: "audit-qa", paymentId: "pay-qa", action: "CREATED" },
      { id: "audit-real", paymentId: "pay-real", action: "CREATED" }
    ],
    notes: [
      { id: "note-qa", receiptNo: "QA10C-0056", status: "Cancelled" },
      { id: "note-real", receiptNo: "25023", status: "Cancelled" }
    ],
    importBatches: [
      { id: "batch-qa", fileName: "QA10C-0056-payments.csv", type: "PAYMENTS", mode: "DRY_RUN" },
      { id: "batch-sample", fileName: "sample-payments.csv", type: "PAYMENTS", mode: "DRY_RUN" },
      { id: "batch-real", fileName: "june-collection.csv", type: "PAYMENTS", mode: "IMPORT" }
    ],
    students: [
      { id: "student-real", admissionNo: "NPS26006", studentName: "Anaya Begum" },
      { id: "student-qa", admissionNo: "QA-STU-1", studentName: "QA Student" },
      { id: "student-mixed", admissionNo: "QA-STU-2", studentName: "QA Mixed Student" }
    ]
  };
  const deleteByIds = <T extends { id: string }>(rows: T[], ids: string[]) => {
    const before = rows.length;
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (ids.includes(rows[index].id)) rows.splice(index, 1);
    }
    return { count: before - rows.length };
  };
  const client = {
    payment: {
      findMany: vi.fn(async (args: any) => {
        const where = args?.where ?? {};
        if (typeof where.receiptNo === "string") return data.payments.filter((row) => row.receiptNo === where.receiptNo);
        if (where.receiptNo?.startsWith) return data.payments.filter((row) => row.receiptNo.startsWith(where.receiptNo.startsWith));
        if (where.admissionNo?.in) return data.payments.filter((row) => where.admissionNo.in.includes(row.admissionNo));
        if (typeof where.admissionNo === "string") return data.payments.filter((row) => row.admissionNo === where.admissionNo);
        return data.payments;
      }),
      deleteMany: vi.fn(async (args: any) => deleteByIds(data.payments, args.where.id.in))
    },
    paymentAudit: {
      findMany: vi.fn(async (args: any) => data.audits.filter((row) => args.where.paymentId.in.includes(row.paymentId))),
      deleteMany: vi.fn(async (args: any) => deleteByIds(data.audits, args.where.id.in))
    },
    receiptNote: {
      findMany: vi.fn(async (args: any) => data.notes.filter((row) => args.where.receiptNo.in.includes(row.receiptNo))),
      deleteMany: vi.fn(async (args: any) => deleteByIds(data.notes, args.where.id.in))
    },
    importBatch: {
      findMany: vi.fn(async () => data.importBatches),
      deleteMany: vi.fn(async (args: any) => deleteByIds(data.importBatches, args.where.id.in))
    },
    student: {
      findMany: vi.fn(async (args: any) => {
        const where = args?.where ?? {};
        if (where.admissionNo?.startsWith) return data.students.filter((row) => row.admissionNo.startsWith(where.admissionNo.startsWith));
        if (where.admissionNo?.in) return data.students.filter((row) => where.admissionNo.in.includes(row.admissionNo));
        return data.students;
      }),
      deleteMany: vi.fn(async (args: any) => deleteByIds(data.students, args.where.id.in))
    },
    $transaction: vi.fn(async (callback: any) => callback(client))
  };
  return { client, data };
}

describe("test data cleanup", () => {
  it("dry-run detects exact QA receipts and does not delete anything", async () => {
    const { client, data } = createCleanupClient();

    const result = await cleanupTestData(client as never, {
      receipts: ["QA10C-0056"],
      databaseUrl: "file:./dev.db"
    });

    expect(result.applied).toBe(false);
    expect(result.preview.payments.map((row) => row.id)).toEqual(["pay-qa"]);
    expect(result.preview.paymentAudits.map((row) => row.id)).toEqual(["audit-qa"]);
    expect(result.preview.receiptNotes.map((row) => row.id)).toEqual(["note-qa"]);
    expect(result.preview.importBatches.map((row) => row.id)).toEqual(["batch-qa"]);
    expect(result.preview.manualReview).toContainEqual(expect.objectContaining({
      scope: "student",
      label: "NPS26006"
    }));
    expect(client.payment.deleteMany).not.toHaveBeenCalled();
    expect(data.payments).toHaveLength(4);
  });

  it("does not include numeric receipt prefixes in prefix cleanup", async () => {
    const { client } = createCleanupClient();

    const preview = await previewTestDataCleanup(client as never, { prefixes: ["25023"] });

    expect(preview.payments).toEqual([]);
    expect(preview.manualReview).toContainEqual(expect.objectContaining({
      scope: "prefix",
      label: "25023"
    }));
  });

  it("skips ambiguous exact receipts instead of deleting them", async () => {
    const { client } = createCleanupClient();

    const preview = await previewTestDataCleanup(client as never, { receipts: ["25023"] });

    expect(preview.payments).toEqual([]);
    expect(preview.manualReview).toContainEqual(expect.objectContaining({
      scope: "receipt",
      label: "25023"
    }));
  });

  it("requires typed confirmation for apply mode", async () => {
    const { client } = createCleanupClient();

    await expect(cleanupTestData(client as never, {
      apply: true,
      receipts: ["QA10C-0056"],
      databaseUrl: "file:./dev.db"
    })).rejects.toThrow("Apply mode requires");
    expect(client.payment.findMany).not.toHaveBeenCalled();
  });

  it("refuses production/live database names unless explicitly overridden", async () => {
    const { client } = createCleanupClient();

    await expect(cleanupTestData(client as never, {
      receipts: ["QA10C-0056"],
      databaseUrl: "file:./production.db",
      environment: {}
    })).rejects.toThrow("Refusing test-data cleanup");
    expect(client.payment.findMany).not.toHaveBeenCalled();

    await expect(cleanupTestData(client as never, {
      receipts: ["QA10C-0056"],
      databaseUrl: "file:./production.db",
      environment: { QA_CLEANUP_ALLOW_LIVE: "true" }
    })).resolves.toMatchObject({ applied: false });
  });

  it("apply cleans payment, receipt note, and audit records consistently", async () => {
    const { client, data } = createCleanupClient();

    const result = await cleanupTestData(client as never, {
      apply: true,
      confirm: TEST_DATA_CLEANUP_CONFIRMATION,
      receipts: ["QA10C-0056"],
      databaseUrl: "file:./dev.db"
    });

    expect(result.applied).toBe(true);
    expect(result.deleted).toMatchObject({
      paymentAudits: 1,
      payments: 1,
      receiptNotes: 1,
      importBatches: 1,
      students: 0
    });
    expect(data.payments.map((row) => row.id)).not.toContain("pay-qa");
    expect(data.audits.map((row) => row.id)).not.toContain("audit-qa");
    expect(data.notes.map((row) => row.id)).not.toContain("note-qa");
    expect(data.payments.map((row) => row.id)).toContain("pay-real");
  });

  it("allows QA students only when no non-test payments remain", async () => {
    const { client } = createCleanupClient();

    const preview = await previewTestDataCleanup(client as never, { prefixes: ["QA"] });

    expect(preview.students.map((row) => row.id)).toEqual(["student-qa"]);
    expect(preview.manualReview).toContainEqual(expect.objectContaining({
      scope: "student",
      label: "QA-STU-2",
      reason: expect.stringContaining("non-test payment")
    }));
  });

  it("backup document creation still works after cleanup removes test rows", async () => {
    const { client, data } = createCleanupClient();
    await cleanupTestData(client as never, {
      apply: true,
      confirm: TEST_DATA_CLEANUP_CONFIRMATION,
      receipts: ["QA10C-0056"],
      databaseUrl: "file:./dev.db"
    });

    const backup = createBackupDocument({
      generatedAt: new Date("2026-06-26T01:30:00.000Z"),
      generatedBy: "QA cleanup test",
      students: data.students,
      feeStructures: [],
      payments: data.payments,
      paymentAudits: data.audits,
      users: [],
      receiptNotes: data.notes,
      importBatches: data.importBatches
    });

    expect(backup.payments.map((row: any) => row.receiptNo)).not.toContain("QA10C-0056");
    expect(backup.metadata.backupVersion).toBe(45);
    expect(backup.users).toEqual([]);
  });
});
