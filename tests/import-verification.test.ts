import { describe, expect, it, vi } from "vitest";
import { defaultGoLiveChecklist } from "../lib/go-live-checklist";
import {
  calculatePaymentReconciliation,
  compareExpectedPaymentTotals,
  createImportBatchRecord,
  deriveImportBatchStatus,
  importBatchStatusLabel,
  IMPORT_BATCH_STATUS_EXPLANATIONS,
  recordPaymentDryRun
} from "../lib/import-verification";
import {
  normalizePaymentImportRows,
  type PaymentImportStudent
} from "../lib/payment-import";
import { canViewImportVerification } from "../lib/import-verification-access";

const students: PaymentImportStudent[] = [{
  id: "student-1",
  admissionNo: "A-1",
  studentName: "Student One",
  className: "I",
  section: "A"
}];

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    Date: "18/06/2026",
    "Receipt No": "R-1",
    "Admission No": "A-1",
    Amount: 1000,
    Mode: "Cash",
    Account: "Cash",
    ...overrides
  };
}

describe("import verification", () => {
  it("calculates batch status summaries", () => {
    expect(deriveImportBatchStatus({
      createdCount: 10,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0
    })).toBe("COMPLETED");
    expect(deriveImportBatchStatus({
      createdCount: 8,
      updatedCount: 0,
      skippedCount: 1,
      errorCount: 1
    })).toBe("PARTIAL");
    expect(deriveImportBatchStatus({
      dryRun: true,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0
    })).toBe("DRY_RUN");
  });

  it("explains import batch statuses for operators", () => {
    expect(IMPORT_BATCH_STATUS_EXPLANATIONS.DRY_RUN).toBe("Dry-run = no database changes");
    expect(IMPORT_BATCH_STATUS_EXPLANATIONS.PARTIAL).toBe("Partial = valid rows processed, invalid rows rejected");
    expect(IMPORT_BATCH_STATUS_EXPLANATIONS.FAILED).toBe("Failed = no successful import");
    expect(IMPORT_BATCH_STATUS_EXPLANATIONS.COMPLETED).toBe("Completed = all valid rows processed as expected");
    expect(importBatchStatusLabel("DRY_RUN")).toBe("Dry Run");
  });

  it("calculates payment totals by account and date", () => {
    const preview = normalizePaymentImportRows([
      paymentRow(),
      paymentRow({
        Date: "19/06/2026",
        "Receipt No": "R-2",
        Amount: 2500,
        Mode: "GPay",
        Account: "Director Sir GPay",
        UTR: "UPI-2"
      }),
      paymentRow({
        Date: "19/06/2026",
        "Receipt No": "R-3",
        Amount: 750,
        Mode: "Cheque",
        Account: "Other"
      })
    ], students);
    const totals = calculatePaymentReconciliation(preview);

    expect(totals.validImportableTotalAmount).toBe(4250);
    expect(totals.amountByReceivedAccount.Cash).toBe(1000);
    expect(totals.amountByReceivedAccount["Director Sir GPay"]).toBe(2500);
    expect(totals.amountByReceivedAccount.Cheque).toBe(750);
    expect(totals.totalByDate).toEqual({
      "2026-06-18": 1000,
      "2026-06-19": 3250
    });
  });

  it("compares optional expected totals and reports differences", () => {
    const totals = calculatePaymentReconciliation(
      normalizePaymentImportRows([paymentRow()], students)
    );
    const comparison = compareExpectedPaymentTotals(totals, {
      Cash: 900,
      "Grand Total": 1000
    });

    expect(comparison).toEqual([
      expect.objectContaining({ label: "Cash", difference: 100, matched: false }),
      expect.objectContaining({ label: "Grand Total", difference: 0, matched: true })
    ]);
  });

  it("reflects duplicate rows and amounts in reconciliation", () => {
    const preview = normalizePaymentImportRows([
      paymentRow(),
      paymentRow()
    ], students);
    const totals = calculatePaymentReconciliation(preview);

    expect(preview.counts.duplicates).toBe(1);
    expect(totals.duplicateRows).toBe(1);
    expect(totals.skippedDuplicateAmount).toBe(1000);
    expect(totals.validImportableTotalAmount).toBe(1000);
  });

  it("records a dry run without creating payments", async () => {
    const importBatchCreate = vi.fn().mockResolvedValue({ id: "batch-dry" });
    const paymentCreate = vi.fn();
    const preview = normalizePaymentImportRows([paymentRow()], students);
    const client = {
      importBatch: { create: importBatchCreate },
      payment: { create: paymentCreate }
    };

    const result = await recordPaymentDryRun(client, {
      preview,
      fileName: "payments.xlsx",
      importedBy: { id: "user-1", name: "Director" }
    });

    expect(result.batch.id).toBe("batch-dry");
    expect(importBatchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "DRY_RUN",
        createdCount: 1,
        type: "PAYMENTS"
      })
    });
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("creates an actual import batch record with supplied counts", async () => {
    const create = vi.fn().mockResolvedValue({ id: "batch-1" });
    await createImportBatchRecord({ importBatch: { create } }, {
      type: "PAYMENTS",
      fileName: "real-payments.xlsx",
      importedBy: { id: "user-1", name: "Admin" },
      mode: "import-valid",
      totalRows: 12,
      createdCount: 10,
      updatedCount: 0,
      skippedCount: 1,
      errorCount: 1,
      warningCount: 2,
      status: "PARTIAL",
      details: { samples: [], warnings: [], errors: [] }
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileName: "real-payments.xlsx",
        createdCount: 10,
        status: "PARTIAL"
      })
    });
  });

  it("starts the go-live checklist with every item unchecked", () => {
    expect(Object.values(defaultGoLiveChecklist()).every((value) => value === false)).toBe(true);
  });

  it("applies import verification role scope", () => {
    expect(canViewImportVerification("DIRECTOR", "STUDENTS")).toBe(true);
    expect(canViewImportVerification("ADMIN", "PAYMENTS")).toBe(true);
    expect(canViewImportVerification("ACCOUNTANT", "PAYMENTS")).toBe(true);
    expect(canViewImportVerification("ACCOUNTANT", "STUDENTS")).toBe(false);
    expect(canViewImportVerification("VIEWER", "PAYMENTS")).toBe(false);
  });
});
