import type { PaymentImportPreview, PaymentImportPreviewRow } from "@/lib/payment-import";
import type { StudentImportMode, StudentImportPreview } from "@/lib/student-import";
import type { GuardianImportPreview } from "@/lib/guardians";

export const IMPORT_BATCH_TYPES = ["STUDENTS", "PAYMENTS", "GUARDIANS", "STAFF", "LIBRARY_TITLES", "LIBRARY_COPIES"] as const;
export const IMPORT_BATCH_STATUSES = ["DRY_RUN", "COMPLETED", "FAILED", "PARTIAL"] as const;
export const IMPORT_BATCH_STATUS_EXPLANATIONS = {
  DRY_RUN: "Dry-run = no database changes",
  PARTIAL: "Partial = valid rows processed, invalid rows rejected",
  FAILED: "Failed = no successful import",
  COMPLETED: "Completed = all valid rows processed as expected"
} as const satisfies Record<(typeof IMPORT_BATCH_STATUSES)[number], string>;
export const RECONCILIATION_ACCOUNTS = [
  "Cash",
  "Director Sir GPay",
  "NPS Current Account UPI",
  "NPS Bank Account",
  "Cheque",
  "Other"
] as const;

export type ImportBatchType = (typeof IMPORT_BATCH_TYPES)[number];
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];
export type ReconciliationAccount = (typeof RECONCILIATION_ACCOUNTS)[number];
export type AmountMap = Record<string, number>;

export type PaymentReconciliation = {
  uploadedTotalAmount: number;
  validImportableTotalAmount: number;
  skippedDuplicateAmount: number;
  errorRowAmount: number;
  createdAmount: number;
  duplicateRows: number;
  dateRange: { from: string | null; to: string | null };
  countByPaymentMode: Record<string, number>;
  countByReceivedAccount: Record<ReconciliationAccount, number>;
  amountByReceivedAccount: Record<ReconciliationAccount, number>;
  totalByDate: AmountMap;
  totalByPaymentMode: AmountMap;
};

export type ExpectedPaymentTotals = Partial<Record<ReconciliationAccount | "Grand Total", number>>;

export type ExpectedTotalsComparisonRow = {
  label: ReconciliationAccount | "Grand Total";
  expected: number;
  actual: number;
  difference: number;
  matched: boolean;
};

export type ImportBatchDetails = {
  samples: Array<Record<string, unknown>>;
  warnings: string[];
  errors: Array<Record<string, unknown>>;
  reconciliation?: PaymentReconciliation;
  expectedTotals?: ExpectedPaymentTotals;
  expectedComparison?: ExpectedTotalsComparisonRow[];
};

export type ImportBatchCreateInput = {
  type: ImportBatchType;
  fileName: string;
  importedBy: { id: string; name: string };
  mode: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  status: ImportBatchStatus;
  notes?: string | null;
  details: ImportBatchDetails;
};

type ImportBatchClient = {
  importBatch: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
};

export async function createImportBatchRecord(
  client: ImportBatchClient,
  input: ImportBatchCreateInput
) {
  return client.importBatch.create({
    data: {
      type: input.type,
      fileName: input.fileName.trim() || "Unnamed import file",
      importedByUserId: input.importedBy.id,
      importedByName: input.importedBy.name,
      mode: input.mode,
      totalRows: input.totalRows,
      createdCount: input.createdCount,
      updatedCount: input.updatedCount,
      skippedCount: input.skippedCount,
      errorCount: input.errorCount,
      warningCount: input.warningCount,
      status: input.status,
      notes: input.notes?.trim() || null,
      detailsJson: JSON.stringify(input.details)
    }
  });
}

export async function recordPaymentDryRun(
  client: ImportBatchClient,
  input: {
    preview: PaymentImportPreview;
    fileName: string;
    importedBy: { id: string; name: string };
    notes?: string | null;
    expectedTotals?: ExpectedPaymentTotals;
  }
) {
  const reconciliation = calculatePaymentReconciliation(input.preview);
  const expectedTotals = input.expectedTotals ?? {};
  const expectedComparison = compareExpectedPaymentTotals(reconciliation, expectedTotals);
  const warnings = [
    ...input.preview.fileWarnings,
    ...input.preview.rows.flatMap((row) =>
      row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`)
    )
  ];
  const errors = input.preview.rows
    .filter((row) => row.errors.length)
    .map((row) => ({
      rowNumber: row.rowNumber,
      receiptNo: row.normalized.receiptNo,
      admissionNo: row.normalized.admissionNo,
      amountPaid: row.normalized.amountPaid,
      reason: row.errors.join("; "),
      originalValuesJson: JSON.stringify(row.originalValues)
    }));
  const batch = await createImportBatchRecord(client, {
    type: "PAYMENTS",
    fileName: input.fileName,
    importedBy: input.importedBy,
    mode: "dry-run",
    totalRows: input.preview.counts.total,
    createdCount: input.preview.counts.ready,
    updatedCount: 0,
    skippedCount: input.preview.counts.duplicates,
    errorCount: input.preview.counts.errors,
    warningCount: input.preview.counts.warnings,
    status: "DRY_RUN",
    notes: input.notes,
    details: {
      samples: paymentSampleRows(input.preview),
      warnings,
      errors: errors.slice(0, 1000),
      reconciliation,
      expectedTotals,
      expectedComparison
    }
  });
  return { batch, reconciliation, expectedComparison };
}

export function calculatePaymentReconciliation(
  preview: PaymentImportPreview,
  createdRows: PaymentImportPreviewRow[] = []
): PaymentReconciliation {
  const validRows = preview.rows.filter((row) => row.errors.length === 0 && !row.duplicate);
  const duplicateRows = preview.rows.filter((row) => row.duplicate);
  const errorRows = preview.rows.filter((row) => row.errors.length > 0);
  const datedRows = preview.rows.filter((row) => row.normalized.date);

  return {
    uploadedTotalAmount: sumAmounts(preview.rows),
    validImportableTotalAmount: sumAmounts(validRows),
    skippedDuplicateAmount: sumAmounts(duplicateRows),
    errorRowAmount: sumAmounts(errorRows),
    createdAmount: sumAmounts(createdRows),
    duplicateRows: duplicateRows.length,
    dateRange: {
      from: datedRows.length ? datedRows.map((row) => row.normalized.date).sort()[0] : null,
      to: datedRows.length ? datedRows.map((row) => row.normalized.date).sort().at(-1) ?? null : null
    },
    countByPaymentMode: countBy(validRows, (row) => row.normalized.paymentMode || "Unknown"),
    countByReceivedAccount: accountRecord((account) =>
      validRows.filter((row) => reconciliationAccount(row) === account).length
    ),
    amountByReceivedAccount: accountRecord((account) =>
      sumAmounts(validRows.filter((row) => reconciliationAccount(row) === account))
    ),
    totalByDate: amountBy(validRows, (row) => row.normalized.date || "Unknown"),
    totalByPaymentMode: amountBy(validRows, (row) => row.normalized.paymentMode || "Unknown")
  };
}

export function compareExpectedPaymentTotals(
  reconciliation: PaymentReconciliation,
  expected: ExpectedPaymentTotals
) {
  return [...RECONCILIATION_ACCOUNTS, "Grand Total" as const]
    .filter((label) => expected[label] !== undefined)
    .map((label): ExpectedTotalsComparisonRow => {
      const actual = label === "Grand Total"
        ? reconciliation.validImportableTotalAmount
        : reconciliation.amountByReceivedAccount[label];
      const expectedAmount = Number(expected[label] ?? 0);
      const difference = roundMoney(actual - expectedAmount);
      return {
        label,
        expected: expectedAmount,
        actual,
        difference,
        matched: Math.abs(difference) < 0.01
      };
    });
}

export function summarizeStudentTrial(
  preview: StudentImportPreview,
  existingAdmissions: ReadonlySet<string>,
  mode: StudentImportMode
) {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  for (const row of preview.rows) {
    if (row.errors.length) continue;
    const exists = existingAdmissions.has(row.normalized.admissionNo.toLowerCase());
    if (!exists) createdCount += 1;
    else if (mode === "update") updatedCount += 1;
    else skippedCount += 1;
  }
  return {
    totalRows: preview.counts.total,
    createdCount,
    updatedCount,
    skippedCount,
    errorCount: preview.counts.errors,
    warningCount: preview.counts.warnings
  };
}

export function deriveImportBatchStatus(input: {
  dryRun?: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
}): ImportBatchStatus {
  if (input.dryRun) return "DRY_RUN";
  const successfulRows = input.createdCount + input.updatedCount;
  if (input.errorCount > 0 && successfulRows === 0) return "FAILED";
  if (input.errorCount > 0 || input.skippedCount > 0) return "PARTIAL";
  return "COMPLETED";
}

export function importBatchStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function studentSampleRows(preview: StudentImportPreview) {
  const readyRows = preview.rows.filter((row) => row.errors.length === 0);
  return sampleUpToTen(readyRows.length ? readyRows : preview.rows).map((row) => ({
    rowNumber: row.rowNumber,
    admissionNo: row.normalized.admissionNo,
    studentName: row.normalized.studentName,
    className: row.normalized.className,
    fatherName: row.normalized.fatherName,
    phone1: row.normalized.phone1,
    studentType: row.normalized.studentType,
    discountPercent: row.normalized.discountPercent,
    status: row.errors.length ? "Error" : row.warnings.length ? "Warning" : "Ready"
  }));
}

export function paymentSampleRows(preview: PaymentImportPreview) {
  const readyRows = preview.rows.filter((row) => row.errors.length === 0 && !row.duplicate);
  return sampleUpToTen(readyRows.length ? readyRows : preview.rows).map((row) => ({
    rowNumber: row.rowNumber,
    date: row.normalized.date,
    receiptNo: row.normalized.receiptNo,
    admissionNo: row.normalized.admissionNo,
    studentName: row.normalized.studentName,
    amountPaid: row.normalized.amountPaid,
    paymentMode: row.normalized.paymentMode,
    receivedAccount: row.normalized.receivedAccount,
    transactionRefNo: row.normalized.transactionRefNo,
    status: row.errors.length ? "Error" : row.duplicate ? "Duplicate" : row.warnings.length ? "Warning" : "Ready"
  }));
}

export function guardianSampleRows(preview: GuardianImportPreview) {
  const readyRows = preview.rows.filter((row) => row.errors.length === 0);
  return sampleUpToTen(readyRows.length ? readyRows : preview.rows).map((row) => ({
    rowNumber: row.rowNumber,
    admissionNo: row.normalized.admissionNo,
    studentName: row.matchedStudent?.studentName ?? row.normalized.studentName,
    guardianName: row.normalized.guardianName,
    mobile: row.normalized.mobile,
    relationship: row.normalized.relationship,
    matchedGuardian: row.matchedGuardian?.displayName ?? null,
    status: row.errors.length ? "Error" : row.existingLink ? "Existing Link" : row.warnings.length ? "Warning" : "Ready"
  }));
}

export function parseImportBatchDetails(value: string | null): ImportBatchDetails {
  if (!value) return { samples: [], warnings: [], errors: [] };
  try {
    const parsed = JSON.parse(value) as Partial<ImportBatchDetails>;
    return {
      samples: Array.isArray(parsed.samples) ? parsed.samples : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      ...(parsed.reconciliation ? { reconciliation: parsed.reconciliation } : {}),
      ...(parsed.expectedTotals ? { expectedTotals: parsed.expectedTotals } : {}),
      ...(parsed.expectedComparison ? { expectedComparison: parsed.expectedComparison } : {})
    };
  } catch {
    return { samples: [], warnings: ["Stored batch details could not be read."], errors: [] };
  }
}

function reconciliationAccount(row: PaymentImportPreviewRow): ReconciliationAccount {
  if (row.normalized.paymentMode === "Cheque") return "Cheque";
  const account = row.normalized.receivedAccount;
  return (RECONCILIATION_ACCOUNTS as readonly string[]).includes(account)
    ? account as ReconciliationAccount
    : "Other";
}

function sumAmounts(rows: PaymentImportPreviewRow[]) {
  return roundMoney(rows.reduce((sum, row) => sum + Math.max(0, Number(row.normalized.amountPaid) || 0), 0));
}

function countBy(rows: PaymentImportPreviewRow[], key: (row: PaymentImportPreviewRow) => string) {
  return rows.reduce<Record<string, number>>((result, row) => {
    const label = key(row);
    result[label] = (result[label] ?? 0) + 1;
    return result;
  }, {});
}

function amountBy(rows: PaymentImportPreviewRow[], key: (row: PaymentImportPreviewRow) => string) {
  return rows.reduce<AmountMap>((result, row) => {
    const label = key(row);
    result[label] = roundMoney((result[label] ?? 0) + row.normalized.amountPaid);
    return result;
  }, {});
}

function accountRecord<T>(value: (account: ReconciliationAccount) => T) {
  return Object.fromEntries(RECONCILIATION_ACCOUNTS.map((account) => [account, value(account)])) as Record<ReconciliationAccount, T>;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sampleUpToTen<T>(rows: T[]) {
  if (rows.length <= 10) return rows;
  const selected = new Set<number>();
  for (let index = 0; index < 10; index += 1) {
    selected.add(Math.round(index * (rows.length - 1) / 9));
  }
  return [...selected].map((index) => rows[index]);
}
