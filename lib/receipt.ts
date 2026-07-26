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
    cancellationReason: nullableText(row.cancellationReason)
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
