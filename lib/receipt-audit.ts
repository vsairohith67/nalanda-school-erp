import { requiresTransactionReference } from "@/lib/payment-controls";
import { publicPaymentModeLabel } from "@/lib/receipt";
import { effectiveReceiptState } from "@/lib/receipt-integrity";

export const RECEIPT_AUDIT_RANGE_LIMIT = 500;

export class ReceiptAuditRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptAuditRangeError";
  }
}

export function parseReceiptAuditRange(
  startValue: string | null,
  endValue: string | null
) {
  const start = Number(startValue);
  const end = Number(endValue);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start <= 0 ||
    end <= 0 ||
    start > end
  ) {
    throw new ReceiptAuditRangeError("Valid positive receipt range is required");
  }
  const length = end - start + 1;
  if (!Number.isSafeInteger(length) || length > RECEIPT_AUDIT_RANGE_LIMIT) {
    throw new ReceiptAuditRangeError(
      `Receipt audit range is limited to ${RECEIPT_AUDIT_RANGE_LIMIT} numbers`
    );
  }
  return {
    start,
    end,
    receiptNumbers: Array.from({ length }, (_, index) => String(start + index))
  };
}

type ReceiptAuditPayment = {
  date?: Date | string | null;
  admissionNo: string;
  amountPaid: number;
  paymentMode: string;
  transactionRefNo?: string | null;
  isCancelled?: boolean | null;
};

type ReceiptAuditNote = {
  status: string;
  remarks?: string | null;
} | null | undefined;

export function analyzeReceiptPayments(
  receiptPayments: ReceiptAuditPayment[],
  note?: ReceiptAuditNote
) {
  const integrity = effectiveReceiptState(receiptPayments.map((payment, index) => ({
    ...payment,
    id: `audit-${index}`,
    receiptNo: "audit"
  })), note);
  const activePayments = integrity.status === "ACTIVE"
    ? receiptPayments
    : [];
  const total = activePayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  let status = receiptPayments.length ? "Used" : "Missing";
  const issues: string[] = [];

  if (activePayments.length > 1) {
    status = "Split Payment";
    issues.push("Multiple payment rows");
  }
  if (activePayments.length > 1 && new Set(activePayments.map((payment) => payment.admissionNo)).size > 1) {
    status = "Duplicate";
    issues.push("Same receipt used for multiple students");
  }
  if (integrity.status === "CANCELLED") {
    status = "Cancelled";
    issues.push("All payment rows cancelled");
  } else if (integrity.status === "INCONSISTENT") {
    status = "Needs Review";
    issues.push("Receipt contains both active and cancelled components");
  }
  if (!integrity.noteConsistent) {
    status = "Needs Review";
    issues.push("Receipt note disagrees with authoritative payment components");
  }
  if (activePayments.length > 0 && total <= 0) {
    status = "Needs Review";
    issues.push("Zero or invalid total");
  }
  if (activePayments.some(
    (payment) => requiresTransactionReference(payment.paymentMode) && !payment.transactionRefNo
  )) {
    status = "Needs Review";
    issues.push("UPI/bank/cheque payment reference missing");
  }

  return {
    status,
    total,
    rowCount: receiptPayments.length,
    issues: issues.join("; "),
    date: receiptPayments[0]?.date
      ? new Date(receiptPayments[0].date).toISOString()
      : null,
    paymentModes: Array.from(
      new Set(receiptPayments.map((payment) => publicPaymentModeLabel(payment)))
    ).join(" + ")
  };
}

export type PaymentAuditSummaryField = {
  label: string;
  value: string;
};

export function parsePaymentAuditJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function paymentAuditSummaryFields(
  value: string | null,
  context: { action?: string; changedByName?: string; reason?: string | null } = {}
): PaymentAuditSummaryField[] {
  const data = parsePaymentAuditJson(value);
  if (!data) {
    return [
      ["Action", context.action],
      ["Changed by", context.changedByName],
      ["Reason", context.reason]
    ].flatMap(([label, fieldValue]) => fieldValue ? [{ label: String(label), value: String(fieldValue) }] : []);
  }
  const classSection = [data.className, data.section].filter(Boolean).join("-");
  const publicModeLabel = publicPaymentModeLabel({ paymentMode: String(data.paymentMode ?? "Cash") });
  const fields: Array<[string, unknown]> = [
    ["Receipt No", data.receiptNo],
    ["Student", data.studentName],
    ["Admission No", data.admissionNo],
    ["Class/Section", classSection],
    ["Amount", data.amountPaid],
    ["Mode", data.paymentMode],
    ["Public mode label", publicModeLabel],
    ["Internal received account", data.receivedAccount],
    ["Reference/UTR", data.transactionRefNo],
    ["Fee Type", data.feeType],
    ["Term", data.termHint],
    ["Remarks", data.remarks],
    ["Correction type", data.correctionType],
    ["Original receipt", data.originalReceiptNo],
    ["Replacement receipt", data.replacementReceiptNo],
    ["Changed by", context.changedByName],
    ["Action", context.action],
    ["Reason", context.reason]
  ];
  return fields
    .map(([label, fieldValue]) => ({ label, value: String(fieldValue ?? "").trim() }))
    .filter((field) => field.value);
}
