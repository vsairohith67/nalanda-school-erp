import { requiresTransactionReference } from "@/lib/payment-controls";
import { publicPaymentModeLabel } from "@/lib/receipt";

type ReceiptAuditPayment = {
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
  const activePayments = receiptPayments.filter((payment) => !payment.isCancelled);
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
  if (receiptPayments.length > 0 && activePayments.length === 0) {
    status = "Cancelled";
    issues.push("All payment rows cancelled");
  } else if (note?.status === "Cancelled") {
    status = "Cancelled";
    issues.push(note.remarks || "Cancelled");
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
    issues: issues.join("; ")
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
    ["Changed by", context.changedByName],
    ["Action", context.action],
    ["Reason", context.reason]
  ];
  return fields
    .map(([label, fieldValue]) => ({ label, value: String(fieldValue ?? "").trim() }))
    .filter((field) => field.value);
}
