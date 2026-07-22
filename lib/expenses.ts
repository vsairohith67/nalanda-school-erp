import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export const EXPENSE_PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"] as const;
export const EXPENSE_APPROVAL_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const EXPENSE_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

function requiredText(value: unknown, label: string, max: number) {
  const result = String(value ?? "").trim();
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return result;
}
function optionalText(value: unknown, max: number, label: string) { const result = String(value ?? "").trim(); if (result.length > max) throw new Error(`${label} must be at most ${max} characters`); return result || null; }

export function localDate(value: unknown, label = "Date") {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} must use YYYY-MM-DD`);
  // Persist date-only values at UTC midnight. This matches the project's
  // displayDate/date-input convention and prevents an entered school date
  // from serializing as the previous ISO calendar day.
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${label} is invalid`);
  return date;
}

export function moneyDecimal(value: unknown, label: string, allowZero = true) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be a non-negative amount with at most two decimals`);
  const decimal = new Prisma.Decimal(raw);
  if (!allowZero && decimal.lte(0)) throw new Error(`${label} must be greater than zero`);
  return decimal;
}

export function validateExpenseAmounts(input: { grossAmount: unknown; taxAmount?: unknown; deductionAmount?: unknown; netAmount: unknown }) {
  const grossAmount = moneyDecimal(input.grossAmount, "Gross amount", false);
  const taxAmount = moneyDecimal(input.taxAmount ?? 0, "Tax amount");
  const deductionAmount = moneyDecimal(input.deductionAmount ?? 0, "Deduction amount");
  const netAmount = moneyDecimal(input.netAmount, "Net amount", false);
  const expected = grossAmount.add(taxAmount).sub(deductionAmount);
  if (expected.lte(0)) throw new Error("Gross plus tax minus deduction must be greater than zero");
  if (!expected.equals(netAmount)) throw new Error(`Net amount must equal gross amount plus tax amount minus deduction amount (${expected.toFixed(2)})`);
  return { grossAmount, taxAmount, deductionAmount, netAmount };
}

export function validatePaymentReference(input: Record<string, unknown>, final = false) {
  const paymentMethod = String(input.paymentMethod ?? "").toUpperCase() as ExpensePaymentMethod;
  if (!EXPENSE_PAYMENT_METHODS.includes(paymentMethod)) throw new Error("Unsupported payment method");
  const transactionReference = optionalText(input.transactionReference, 120, "Transaction reference");
  const chequeNumber = optionalText(input.chequeNumber, 40, "Cheque number");
  const chequeDate = input.chequeDate ? localDate(input.chequeDate, "Cheque date") : null;
  if (final && paymentMethod !== "CASH" && paymentMethod !== "CHEQUE" && !transactionReference) throw new Error("Transaction reference is required for non-cash payment");
  if (final && paymentMethod === "CHEQUE" && (!chequeNumber || !chequeDate)) throw new Error("Cheque number and cheque date are required for cheque payment");
  if (paymentMethod === "CASH") return { paymentMethod, transactionReference: null, chequeNumber: null, chequeDate: null };
  if (paymentMethod === "CHEQUE") return { paymentMethod, transactionReference: null, chequeNumber, chequeDate };
  return { paymentMethod, transactionReference, chequeNumber: null, chequeDate: null };
}

export function validateExpenseInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expense details are required");
  const row = input as Record<string, unknown>;
  return {
    expenseDate: localDate(row.expenseDate, "Expense date"), academicYear: requiredText(row.academicYear, "Academic year", 20),
    vendorId: optionalText(row.vendorId, 80, "Vendor"), categoryId: requiredText(row.categoryId, "Category", 80), departmentId: optionalText(row.departmentId, 80, "Department"),
    description: requiredText(row.description, "Description", 500), invoiceNumber: optionalText(row.invoiceNumber, 100, "Invoice number"),
    invoiceDate: row.invoiceDate ? localDate(row.invoiceDate, "Invoice date") : null,
    ...validateExpenseAmounts(row as never), ...validatePaymentReference(row, false), notes: optionalText(row.notes, 2000, "Notes")
  };
}

type ExpenseMasterClient = Pick<PrismaClient | Prisma.TransactionClient, "vendor" | "expenseCategory" | "expenseDepartment">;
export async function validateActiveExpenseMasters(
  client: ExpenseMasterClient,
  input: { vendorId?: string | null; categoryId: string; departmentId?: string | null }
) {
  const [vendor, category, department] = await Promise.all([
    input.vendorId ? client.vendor.findFirst({ where: { id: input.vendorId, status: "ACTIVE" }, select: { id: true } }) : null,
    client.expenseCategory.findFirst({ where: { id: input.categoryId, status: "ACTIVE" }, select: { id: true } }),
    input.departmentId ? client.expenseDepartment.findFirst({ where: { id: input.departmentId, status: "ACTIVE" }, select: { id: true } }) : null
  ]);
  if (input.vendorId && !vendor) throw new Error("Vendor must be active before it can be assigned to an expense");
  if (!category) throw new Error("Expense category must be active");
  if (input.departmentId && !department) throw new Error("Expense department must be active");
}

export function newExpenseNumber(date = new Date()) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("-", "");
  return `EXP-${key}-${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function expenseCsv(rows: Array<Record<string, unknown>>) {
  const headers = ["Expense Number", "Date", "Academic Year", "Vendor", "Category", "Department", "Description", "Gross", "Tax", "Deduction", "Net", "Approval Status", "Payment Status", "Payment Method"];
  return [headers.map(csvCell).join(","), ...rows.map((row) => [row.expenseNumber, row.expenseDate, row.academicYear, row.vendor, row.category, row.department, row.description, row.grossAmount, row.taxAmount, row.deductionAmount, row.netAmount, row.approvalStatus, row.paymentStatus, row.paymentMethod].map(csvCell).join(","))].join("\r\n") + "\r\n";
}

export type ExpenseReportRow = { expenseNumber: string; expenseDate: Date; academicYear: string; vendor?: { name: string } | null; category: { name: string }; department?: { name: string } | null; description: string; grossAmount: Prisma.Decimal; taxAmount: Prisma.Decimal; deductionAmount: Prisma.Decimal; netAmount: Prisma.Decimal; approvalStatus: string; paymentStatus: string; paymentMethod: string };
export function buildExpenseReports(rows: ExpenseReportRow[]) {
  const active = rows.filter((row) => row.approvalStatus !== "CANCELLED");
  const group = (key: (row: ExpenseReportRow) => string) => Array.from(active.reduce((map, row) => { const label = key(row); map.set(label, (map.get(label) ?? new Prisma.Decimal(0)).add(row.netAmount)); return map; }, new Map<string, Prisma.Decimal>())).map(([label, total]) => ({ label, total: total.toString() })).sort((a, b) => a.label.localeCompare(b.label));
  const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const total = active.reduce((sum, row) => sum.add(row.netAmount), new Prisma.Decimal(0));
  return { total: total.toString(), count: active.length, cancelledCount: rows.length - active.length, dateWise: group((row) => dateKey(row.expenseDate)), vendorWise: group((row) => row.vendor?.name ?? "No vendor"), categoryWise: group((row) => row.category.name), departmentWise: group((row) => row.department?.name ?? "No department"), paymentStatus: group((row) => row.paymentStatus), approvalStatus: group((row) => row.approvalStatus) };
}

export function serializeExpense(row: any, includeSensitive = true) {
  const safe = {
    id: row.id, expenseNumber: row.expenseNumber, expenseDate: row.expenseDate, academicYear: row.academicYear,
    vendor: row.vendor ? { id: row.vendor.id, vendorCode: row.vendor.vendorCode, name: row.vendor.name } : null,
    category: row.category ? { id: row.category.id, name: row.category.name, code: row.category.code } : null,
    department: row.department ? { id: row.department.id, name: row.department.name, code: row.department.code } : null,
    description: row.description, invoiceNumber: row.invoiceNumber, invoiceDate: row.invoiceDate,
    grossAmount: row.grossAmount.toString(), taxAmount: row.taxAmount.toString(), deductionAmount: row.deductionAmount.toString(), netAmount: row.netAmount.toString(),
    paymentMethod: row.paymentMethod, paymentStatus: row.paymentStatus, approvalStatus: row.approvalStatus, paidDate: row.paidDate,
    submittedAt: row.submittedAt, approvedAt: row.approvedAt, paidAt: row.paidAt, cancelledAt: row.cancelledAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
    payments: row.payments?.map((payment: any) => ({ paymentDate: payment.paymentDate, amount: payment.amount.toString(), paymentMethod: payment.paymentMethod, createdAt: payment.createdAt })),
    audits: row.audits?.map((audit: any) => ({ action: audit.action, fromStatus: audit.fromStatus, toStatus: audit.toStatus, createdAt: audit.createdAt }))
  };
  if (!includeSensitive) return safe;
  return {
    ...safe,
    transactionReference: row.transactionReference, chequeNumber: row.chequeNumber, chequeDate: row.chequeDate,
    notes: row.notes, rejectionReason: row.rejectionReason, cancellationReason: row.cancellationReason,
    createdBy: row.createdBy?.name ?? null, submittedBy: row.submittedBy?.name ?? null, approvedBy: row.approvedBy?.name ?? null, paidBy: row.paidBy?.name ?? null, cancelledBy: row.cancelledBy?.name ?? null,
    payments: row.payments?.map((payment: any) => ({ id: payment.id, paymentDate: payment.paymentDate, amount: payment.amount.toString(), paymentMethod: payment.paymentMethod, transactionReference: payment.transactionReference, chequeNumber: payment.chequeNumber, notes: payment.notes, recordedBy: payment.recordedBy?.name ?? null, createdAt: payment.createdAt })),
    audits: row.audits?.map((audit: any) => ({ action: audit.action, fromStatus: audit.fromStatus, toStatus: audit.toStatus, details: audit.detailsJson ? JSON.parse(audit.detailsJson) : null, actorName: audit.actorName, createdAt: audit.createdAt }))
  };
}

export const expenseDetailInclude = {
  vendor: { select: { id: true, vendorCode: true, name: true } }, category: { select: { id: true, name: true, code: true } }, department: { select: { id: true, name: true, code: true } },
  createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } }, paidBy: { select: { name: true } }, cancelledBy: { select: { name: true } },
  payments: { include: { recordedBy: { select: { name: true } } }, orderBy: [{ paymentDate: "asc" as const }, { createdAt: "asc" as const }] }, audits: { orderBy: { createdAt: "asc" as const } }
};

type Actor = { id: string; name: string };
export async function transitionExpense(client: PrismaClient, id: string, action: "submit" | "approve" | "reject" | "cancel", actor: Actor, reason?: string) {
  const config = action === "submit" ? { from: "DRAFT", to: "PENDING_APPROVAL", data: { submittedByUserId: actor.id, submittedAt: new Date(), rejectionReason: null } }
    : action === "approve" ? { from: "PENDING_APPROVAL", to: "APPROVED", data: { approvedByUserId: actor.id, approvedAt: new Date(), rejectionReason: null } }
      : action === "reject" ? { from: "PENDING_APPROVAL", to: "REJECTED", data: { rejectionReason: requiredText(reason, "Rejection reason", 1000) } }
        : { from: null, to: "CANCELLED", data: { cancellationReason: requiredText(reason, "Cancellation reason", 1000), cancelledByUserId: actor.id, cancelledAt: new Date(), paymentStatus: "CANCELLED" } };
  return client.$transaction(async (tx) => {
    const current = await tx.expenseRecord.findUnique({ where: { id }, select: { approvalStatus: true } });
    if (!current) throw new Error("Expense not found");
    if (action === "cancel" ? current.approvalStatus === "CANCELLED" : current.approvalStatus !== config.from) throw new Error(`Cannot ${action} an expense in ${current.approvalStatus} status`);
    const updated = await tx.expenseRecord.updateMany({ where: { id, approvalStatus: current.approvalStatus }, data: { ...config.data, approvalStatus: config.to } });
    if (updated.count !== 1) throw new Error("Expense changed while this action was being processed. Refresh and review it.");
    await tx.expenseAudit.create({ data: { expenseRecordId: id, action: action.toUpperCase(), fromStatus: current.approvalStatus, toStatus: config.to, detailsJson: reason ? JSON.stringify({ reason }) : null, actorUserId: actor.id, actorName: actor.name } });
    return tx.expenseRecord.findUniqueOrThrow({ where: { id }, include: expenseDetailInclude });
  });
}

export async function recordExpensePayment(client: PrismaClient, id: string, input: unknown, actor: Actor) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Payment details are required");
  const row = input as Record<string, unknown>;
  const amount = moneyDecimal(row.amount, "Payment amount", false);
  const paymentDate = localDate(row.paymentDate, "Payment date");
  const reference = validatePaymentReference(row, true);
  const notes = optionalText(row.notes, 1000, "Payment notes");
  return client.$transaction(async (tx) => {
    const current = await tx.expenseRecord.findUnique({ where: { id }, include: { payments: { select: { amount: true } } } });
    if (!current) throw new Error("Expense not found");
    if (current.approvalStatus !== "APPROVED" || current.paymentStatus === "CANCELLED" || current.paymentStatus === "PAID") throw new Error("Only an approved unpaid or partially paid expense can be marked paid");
    const paid = current.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
    const remaining = current.netAmount.sub(paid);
    if (amount.gt(remaining)) throw new Error(`Payment exceeds the remaining amount of ${remaining.toFixed(2)}`);
    await tx.expensePayment.create({ data: { expenseRecordId: id, paymentDate, amount, ...reference, notes, recordedByUserId: actor.id } });
    const paymentStatus = amount.equals(remaining) ? "PAID" : "PARTIALLY_PAID";
    const update = await tx.expenseRecord.updateMany({ where: { id, approvalStatus: "APPROVED", paymentStatus: current.paymentStatus }, data: { paymentStatus, paymentMethod: reference.paymentMethod, transactionReference: reference.transactionReference, chequeNumber: reference.chequeNumber, chequeDate: reference.chequeDate, paidDate: paymentStatus === "PAID" ? paymentDate : null, paidAt: paymentStatus === "PAID" ? new Date() : null, paidByUserId: actor.id } });
    if (update.count !== 1) throw new Error("Expense changed while payment was being recorded. Refresh and review it.");
    await tx.expenseAudit.create({ data: { expenseRecordId: id, action: "PAYMENT_RECORDED", fromStatus: current.paymentStatus, toStatus: paymentStatus, detailsJson: JSON.stringify({ amount: amount.toFixed(2), paymentMethod: reference.paymentMethod }), actorUserId: actor.id, actorName: actor.name } });
    return tx.expenseRecord.findUniqueOrThrow({ where: { id }, include: expenseDetailInclude });
  });
}
