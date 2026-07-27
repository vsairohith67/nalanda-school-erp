import { effectiveReceiptState, type ReceiptIntegrityNote } from "@/lib/receipt-integrity";

export type ReceiptPaymentRow = {
  id: string;
  receiptNo: string;
  amountPaid: number;
  paymentMode: string;
  receivedAccount: string;
  transactionRefNo?: string | null;
  isCancelled?: boolean | null;
  deletedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type ReceiptStatus = "ACTIVE" | "PARTIALLY_CANCELLED" | "CANCELLED";

export type ReceiptCorrectionDisplay = {
  lifecycleStatus: "ACTIVE" | "CANCELLED" | "INCONSISTENT" | "CORRECTED" | "SUPERSEDED" | "CORRECTED_REPLACEMENT";
  originalReceiptNo: string | null;
  replacementReceiptNo: string | null;
};

export function publicPaymentModeLabel(
  row: Pick<ReceiptPaymentRow, "paymentMode">,
  upiIndex?: number
) {
  if (row.paymentMode === "UPI") return upiIndex ? `UPI ${upiIndex}` : "UPI";
  if (["NEFT", "RTGS", "IMPS", "Cheque", "Other"].includes(row.paymentMode)) return row.paymentMode;
  if (row.paymentMode === "Bank Transfer") return "Bank Transfer";
  return "Cash";
}

export function receiptPublicRows<T extends ReceiptPaymentRow>(rows: T[]) {
  let upiCount = 0;
  return rows.map((row) => {
    const upiIndex = row.paymentMode === "UPI" ? ++upiCount : undefined;
    return {
      ...row,
      publicModeLabel: publicPaymentModeLabel(row, upiIndex)
    };
  });
}

export function groupReceiptPayments<T extends ReceiptPaymentRow>(
  rows: T[],
  note?: ReceiptIntegrityNote
) {
  if (!rows.length) throw new Error("Receipt has no payment rows");
  const integrity = effectiveReceiptState(rows, note);
  const activeRows = integrity.activeRows as T[];
  const status: ReceiptStatus =
    integrity.status === "INCONSISTENT" ? "PARTIALLY_CANCELLED" : integrity.status;
  const rowsForTotals = activeRows.length ? activeRows : rows;
  const breakup = rowsForTotals.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.paymentMode} / ${row.receivedAccount}`;
    acc[key] = (acc[key] ?? 0) + row.amountPaid;
    return acc;
  }, {});
  const publicBreakup = receiptPublicRows(rowsForTotals).reduce<Record<string, number>>((acc, row) => {
    acc[row.publicModeLabel] = (acc[row.publicModeLabel] ?? 0) + row.amountPaid;
    return acc;
  }, {});
  return {
    receiptNo: rows[0].receiptNo,
    status,
    totalAmount: rowsForTotals.reduce((sum, row) => sum + row.amountPaid, 0),
    originalTotal: rows.reduce((sum, row) => sum + row.amountPaid, 0),
    activeRows,
    rows,
    breakup,
    publicBreakup,
    isSplit: rows.length > 1,
    version: integrity.version,
    noteConsistent: integrity.noteConsistent
  };
}

export function receiptAuditSnapshot(row: Record<string, unknown>) {
  return {
    receiptNo: text(row.receiptNo),
    admissionNo: text(row.admissionNo),
    studentName: text(row.studentName),
    className: text(row.className),
    section: nullableText(row.section),
    date: dateText(row.date),
    amountPaid: numberValue(row.amountPaid),
    paymentMode: text(row.paymentMode),
    receivedAccount: text(row.receivedAccount),
    transactionRefNo: nullableText(row.transactionRefNo),
    feeType: text(row.feeType),
    termHint: text(row.termHint),
    remarks: nullableText(row.remarks),
    isCancelled: Boolean(row.isCancelled),
    cancelledAt: dateText(row.cancelledAt),
    cancellationReason: nullableText(row.cancellationReason),
    correctionType: nullableText(row.correctionType),
    originalReceiptNo: nullableText(row.originalReceiptNo),
    replacementReceiptNo: nullableText(row.replacementReceiptNo)
  };
}

export function sanitizedPaymentAuditJson(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return JSON.stringify(receiptAuditSnapshot(parsed as Record<string, unknown>));
  } catch {
    return null;
  }
}

export function receiptCorrectionDisplay(
  audits: Array<{ action?: string | null; newValueJson?: string | null }>,
  effectiveStatus: "ACTIVE" | "CANCELLED" | "INCONSISTENT" | "PARTIALLY_CANCELLED"
): ReceiptCorrectionDisplay {
  let corrected = false;
  let superseded = false;
  let reissued = false;
  let originalReceiptNo: string | null = null;
  let replacementReceiptNo: string | null = null;
  for (const audit of audits) {
    corrected ||= audit.action === "RECEIPT_CORRECTED";
    superseded ||= audit.action === "RECEIPT_SUPERSEDED";
    reissued ||= audit.action === "RECEIPT_REISSUED";
    try {
      const snapshot = JSON.parse(audit.newValueJson ?? "{}") as Record<string, unknown>;
      originalReceiptNo ??= nullableText(snapshot.originalReceiptNo);
      replacementReceiptNo ??= nullableText(snapshot.replacementReceiptNo);
    } catch {}
  }
  if (superseded) {
    return { lifecycleStatus: "SUPERSEDED", originalReceiptNo, replacementReceiptNo };
  }
  if (reissued) {
    return { lifecycleStatus: "CORRECTED_REPLACEMENT", originalReceiptNo, replacementReceiptNo };
  }
  if (corrected) {
    return { lifecycleStatus: "CORRECTED", originalReceiptNo, replacementReceiptNo };
  }
  return {
    lifecycleStatus:
      effectiveStatus === "PARTIALLY_CANCELLED"
        ? "INCONSISTENT"
        : effectiveStatus,
    originalReceiptNo,
    replacementReceiptNo
  };
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const result = text(value);
  return result || null;
}

function dateText(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberValue(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
