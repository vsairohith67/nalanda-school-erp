import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { csvCell, localDate, moneyDecimal } from "@/lib/expenses";

export const MISC_ITEM_CATEGORIES = ["UNIFORM_ACCESSORY", "CERTIFICATE", "STUDENT_DOCUMENT", "ACADEMIC_SERVICE", "LIBRARY_CHARGE", "OTHER"] as const;
export const STUDENT_LINK_POLICIES = ["REQUIRED", "OPTIONAL", "NOT_REQUIRED"] as const;
export const MISC_PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"] as const;
export const MISC_RECEIVED_ACCOUNTS = ["CASH_COUNTER", "DIRECTOR_GPAY", "NPS_CURRENT_ACCOUNT", "OTHER"] as const;
export const DEFAULT_MISC_INCOME_ITEMS = [
  { itemCode: "BELT", name: "Belt", category: "UNIFORM_ACCESSORY", studentLinkPolicy: "OPTIONAL" },
  { itemCode: "TIE", name: "Tie", category: "UNIFORM_ACCESSORY", studentLinkPolicy: "OPTIONAL" },
  { itemCode: "BONAFIDE", name: "Bonafide Certificate", category: "CERTIFICATE", studentLinkPolicy: "REQUIRED" },
  { itemCode: "TC", name: "Transfer Certificate", category: "STUDENT_DOCUMENT", studentLinkPolicy: "REQUIRED" },
  { itemCode: "CLASS-X-CERT", name: "Class X Certificate / Migration Service", category: "ACADEMIC_SERVICE", studentLinkPolicy: "REQUIRED" },
  { itemCode: "LIB-STUDENT-CHARGE", name: "Student Library Charge", category: "LIBRARY_CHARGE", studentLinkPolicy: "REQUIRED" },
  { itemCode: "LIB-STAFF-CHARGE", name: "Staff Library Charge", category: "LIBRARY_CHARGE", studentLinkPolicy: "NOT_REQUIRED" },
  { itemCode: "OTHER", name: "Other", category: "OTHER", studentLinkPolicy: "OPTIONAL" }
] as const;

export async function ensureDefaultMiscIncomeItems(client: Pick<PrismaClient, "miscIncomeItem">) {
  for (const item of DEFAULT_MISC_INCOME_ITEMS) await client.miscIncomeItem.upsert({ where: { itemCode: item.itemCode }, update: {}, create: { ...item, status: "ACTIVE" } });
}

function text(value: unknown, label: string, max: number, required = true) {
  const result = String(value ?? "").trim();
  if ((required && !result) || result.length > max) throw new Error(`${label} ${required ? "is required and " : ""}must be at most ${max} characters`);
  return result || null;
}

function oneOf<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const result = String(value ?? "").toUpperCase();
  if (!values.includes(result)) throw new Error(`${label} is not supported`);
  return result as T[number];
}

export function newMiscReceiptNumber(date = new Date()) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("-", "");
  return `MISC-${key}-${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export function validateMiscItemInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Income item details are required");
  const row = input as Record<string, unknown>;
  return {
    itemCode: text(row.itemCode, "Item code", 30)!.toUpperCase(),
    name: text(row.name, "Item name", 120)!,
    description: text(row.description, "Description", 500, false),
    category: oneOf(row.category, MISC_ITEM_CATEGORIES, "Item category"),
    studentLinkPolicy: oneOf(row.studentLinkPolicy, STUDENT_LINK_POLICIES, "Student link policy"),
    status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Item status")
  };
}

export function miscIncomeItemWriteError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return "Item code already exists";
  return error instanceof Error ? error.message : fallback;
}

export function validateMiscRateInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Rate details are required");
  const row = input as Record<string, unknown>;
  const effectiveFrom = row.effectiveFrom ? localDate(row.effectiveFrom, "Effective from") : null;
  const effectiveTo = row.effectiveTo ? localDate(row.effectiveTo, "Effective to") : null;
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("Effective to cannot be before effective from");
  return {
    itemId: text(row.itemId, "Item", 80)!, academicYear: text(row.academicYear, "Academic year", 20)!,
    amount: moneyDecimal(row.amount, "Rate amount"), effectiveFrom, effectiveTo,
    notes: text(row.notes, "Rate notes", 1000, false),
    status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Rate status")
  };
}

export async function assertNoActiveRateOverlap(client: Pick<PrismaClient | Prisma.TransactionClient, "miscIncomeRate">, data: ReturnType<typeof validateMiscRateInput>, excludeId?: string) {
  if (data.status !== "ACTIVE") return;
  const rates = await client.miscIncomeRate.findMany({ where: { itemId: data.itemId, academicYear: data.academicYear, status: "ACTIVE", ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { effectiveFrom: true, effectiveTo: true } });
  const from = data.effectiveFrom?.getTime() ?? Number.NEGATIVE_INFINITY;
  const to = data.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  if (rates.some((rate) => from <= (rate.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY) && (rate.effectiveFrom?.getTime() ?? Number.NEGATIVE_INFINITY) <= to)) {
    throw new Error("An overlapping active rate already exists for this item and academic year");
  }
}

function referenceFields(row: Record<string, unknown>) {
  const paymentMethod = oneOf(row.paymentMethod, MISC_PAYMENT_METHODS, "Payment method");
  const receivedAccount = row.receivedAccount ? oneOf(row.receivedAccount, MISC_RECEIVED_ACCOUNTS, "Received account") : null;
  const transactionReference = text(row.transactionReference, "Transaction reference", 120, false);
  const chequeNumber = text(row.chequeNumber, "Cheque number", 40, false);
  const chequeDate = row.chequeDate ? localDate(row.chequeDate, "Cheque date") : null;
  if (paymentMethod === "CASH") return { paymentMethod, receivedAccount: "CASH_COUNTER" as const, transactionReference: null, chequeNumber: null, chequeDate: null };
  if (!receivedAccount) throw new Error("Received account is required for non-cash income");
  if (paymentMethod === "CHEQUE") {
    if (!chequeNumber || !chequeDate) throw new Error("Cheque number and cheque date are required for cheque income");
    return { paymentMethod, receivedAccount, transactionReference: null, chequeNumber, chequeDate };
  }
  if (!transactionReference) throw new Error("Transaction reference is required for non-cash income");
  return { paymentMethod, receivedAccount, transactionReference, chequeNumber: null, chequeDate: null };
}

type MiscReceiptValidationOptions = { requireExpectedRate?: boolean };

export async function validateMiscReceiptInput(client: PrismaClient | Prisma.TransactionClient, input: unknown, options: MiscReceiptValidationOptions = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Receipt details are required");
  const row = input as Record<string, unknown>;
  if (!Array.isArray(row.lines) || !row.lines.length || row.lines.length > 30) throw new Error("At least one and at most 30 receipt lines are required");
  const academicYear = text(row.academicYear, "Academic year", 20)!;
  const studentId = text(row.studentId, "Student", 80, false);
  const itemIds = [...new Set(row.lines.map((line) => text((line as Record<string, unknown>).itemId, "Item", 80)!))];
  const items = await client.miscIncomeItem.findMany({ where: { id: { in: itemIds }, status: "ACTIVE" }, include: { rates: { where: { academicYear, status: "ACTIVE" } } } });
  if (items.length !== itemIds.length) throw new Error("Every selected income item must be active");
  const itemMap = new Map(items.map((item) => [item.id, item]));
  if (items.some((item) => item.studentLinkPolicy === "REQUIRED") && !studentId) throw new Error("A student is required for one or more selected items");
  if (items.some((item) => item.studentLinkPolicy === "NOT_REQUIRED") && studentId) throw new Error("An item configured as not requiring a student cannot be issued on a student-linked receipt");
  if (studentId && !(await client.student.findFirst({ where: { id: studentId, deletedAt: null }, select: { id: true } }))) throw new Error("Selected student was not found");
  const receiptDate = localDate(row.receiptDate, "Receipt date");
  let grossAmount = new Prisma.Decimal(0), discountAmount = new Prisma.Decimal(0);
  const lines = row.lines.map((rawLine, index) => {
    if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) throw new Error(`Line ${index + 1} is invalid`);
    const line = rawLine as Record<string, unknown>; const itemId = text(line.itemId, "Item", 80)!; const item = itemMap.get(itemId)!;
    const quantity = Number(line.quantity); if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10000) throw new Error(`Line ${index + 1} quantity must be a positive whole number`);
    const availableRates = item.rates.filter((rate) => rate.academicYear === academicYear && (!rate.effectiveFrom || rate.effectiveFrom <= receiptDate) && (!rate.effectiveTo || rate.effectiveTo >= receiptDate));
    if (availableRates.length !== 1) throw new Error(`Line ${index + 1} must resolve to exactly one active academic-year rate`);
    const rate = availableRates[0];
    if (options.requireExpectedRate) {
      const expectedRateId = String(line.expectedRateId ?? "").trim();
      const expectedRateVersion = String(line.expectedRateVersion ?? "").trim();
      if (!expectedRateId || !expectedRateVersion || Number.isNaN(new Date(expectedRateVersion).getTime())) throw new Error("MISC_INCOME_RATE_PROOF_REQUIRED");
      if (rate.id !== expectedRateId || rate.updatedAt.toISOString() !== expectedRateVersion) throw new Error("MISC_INCOME_RATE_CHANGED");
    }
    const unitAmount = rate.amount; const gross = unitAmount.mul(quantity); const discount = moneyDecimal(line.discountAmount ?? 0, `Line ${index + 1} discount`);
    if (discount.gt(gross)) throw new Error(`Line ${index + 1} discount cannot exceed its gross amount`);
    grossAmount = grossAmount.add(gross); discountAmount = discountAmount.add(discount);
    return { itemId, itemNameSnapshot: item.name, rateId: rate.id, quantity, unitAmount, discountAmount: discount, lineTotal: gross.sub(discount), notes: text(line.notes, `Line ${index + 1} notes`, 500, false) };
  });
  const netAmount = grossAmount.sub(discountAmount); if (netAmount.lte(0)) throw new Error("Receipt net amount must be greater than zero");
  return { receiptDate, academicYear, studentId, payerName: text(row.payerName, "Payer name", 120, false), ...referenceFields(row), grossAmount, discountAmount, netAmount, remarks: text(row.remarks, "Remarks", 1000, false), lines };
}

export async function createMiscReceipt(client: PrismaClient, input: unknown, actorId: string) {
  return client.$transaction((tx) => createMiscReceiptInTransaction(tx, input, actorId));
}

export async function createMiscReceiptInTransaction(tx: Prisma.TransactionClient, input: unknown, actorId: string, options: MiscReceiptValidationOptions = {}) {
  const data = await validateMiscReceiptInput(tx, input, options);
  return tx.miscIncomeReceipt.create({ data: { ...data, lines: { create: data.lines }, receiptNumber: newMiscReceiptNumber(data.receiptDate), createdByUserId: actorId }, include: miscReceiptInclude });
}

export async function cancelMiscReceipt(client: PrismaClient, id: string, reason: unknown, actorId: string) {
  const cancellationReason = text(reason, "Cancellation reason", 1000)!;
  return client.$transaction(async (tx) => {
    const changed = await tx.miscIncomeReceipt.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "CANCELLED", cancellationReason, cancelledByUserId: actorId, cancelledAt: new Date() } });
    if (changed.count !== 1) throw new Error("Receipt was not active or changed while cancellation was processed");
    const linkedCharge = await tx.libraryCharge.findUnique({ where: { miscIncomeReceiptId: id }, select: { id: true, incidentId: true, chargeNumber: true, payableAmount: true } });
    if (linkedCharge) await tx.libraryChargeEvent.create({ data: { chargeId: linkedCharge.id, incidentId: linkedCharge.incidentId, eventType: "CORRECTION", eventDate: new Date(), previousStatus: "PAID", newStatus: "PAID", amountSnapshot: linkedCharge.payableAmount, reason: `Linked receipt cancelled: ${cancellationReason}`, notes: "Reconciliation warning: the paid charge remains preserved and must not be silently reopened. An authorized compensating correction is required.", recordedByUserId: actorId } });
    return tx.miscIncomeReceipt.findUniqueOrThrow({ where: { id }, include: miscReceiptInclude });
  });
}

export const miscReceiptInclude = { student: { select: { admissionNo: true, studentName: true, className: true, section: true } }, lines: { include: { item: { select: { itemCode: true, category: true, studentLinkPolicy: true } } }, orderBy: { createdAt: "asc" as const } }, createdBy: { select: { name: true } }, cancelledBy: { select: { name: true } } };

export function serializeMiscReceipt(row: any, sensitive = true) {
  const result: Record<string, unknown> = { id: row.id, receiptNumber: row.receiptNumber, receiptDate: row.receiptDate, academicYear: row.academicYear, student: row.student, payerName: row.payerName, paymentMethod: row.paymentMethod, receivedAccount: publicAccountLabel(row.receivedAccount), grossAmount: row.grossAmount.toString(), discountAmount: row.discountAmount.toString(), netAmount: row.netAmount.toString(), status: row.status, cancelledAt: row.cancelledAt, createdAt: row.createdAt, lines: row.lines.map((line: any) => ({ id: line.id, itemCode: line.item?.itemCode, itemName: line.itemNameSnapshot, category: line.item?.category, quantity: line.quantity, unitAmount: line.unitAmount.toString(), discountAmount: line.discountAmount.toString(), lineTotal: line.lineTotal.toString(), notes: line.notes })) };
  if (sensitive) Object.assign(result, { transactionReference: row.transactionReference, chequeNumber: row.chequeNumber, chequeDate: row.chequeDate, remarks: row.remarks, cancellationReason: row.cancellationReason, createdBy: row.createdBy?.name ?? null, cancelledBy: row.cancelledBy?.name ?? null });
  return result;
}

export function publicAccountLabel(value: string | null) { return ({ CASH_COUNTER: "School cash counter", DIRECTOR_GPAY: "Director GPay", NPS_CURRENT_ACCOUNT: "School current account", OTHER: "Other school account" } as Record<string, string>)[value ?? ""] ?? null; }

export function serializeMiscIncomeItem(row: any) {
  return {
    id: row.id,
    itemCode: row.itemCode,
    name: row.name,
    description: row.description,
    category: row.category,
    studentLinkPolicy: row.studentLinkPolicy,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rates: (row.rates ?? []).map((rate: any) => ({
      id: rate.id,
      academicYear: rate.academicYear,
      amount: rate.amount.toString(),
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
      notes: rate.notes,
      status: rate.status,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt
    }))
  };
}

export function miscIncomeReport(rows: any[]) {
  const active = rows.filter((row) => row.status === "ACTIVE"); const sum = (list: any[]) => list.reduce((total, row) => total.add(row.netAmount), new Prisma.Decimal(0));
  const group = (values: Array<{ label: string; amount: Prisma.Decimal }>) => Array.from(values.reduce((map, row) => map.set(row.label, (map.get(row.label) ?? new Prisma.Decimal(0)).add(row.amount)), new Map<string, Prisma.Decimal>())).map(([label, total]) => ({ label, total: total.toFixed(2) })).sort((a, b) => a.label.localeCompare(b.label));
  return { total: sum(active).toFixed(2), cash: sum(active.filter((row) => row.paymentMethod === "CASH")).toFixed(2), nonCash: sum(active.filter((row) => row.paymentMethod !== "CASH")).toFixed(2), cancelled: sum(rows.filter((row) => row.status === "CANCELLED")).toFixed(2), dateWise: group(active.map((row) => ({ label: row.receiptDate.toISOString().slice(0, 10), amount: row.netAmount }))), itemWise: group(active.flatMap((row) => row.lines.map((line: any) => ({ label: line.itemNameSnapshot, amount: line.lineTotal })))), studentWise: group(active.filter((row) => row.student).map((row) => ({ label: `${row.student.studentName} (${row.student.admissionNo})`, amount: row.netAmount }))), methodWise: group(active.map((row) => ({ label: row.paymentMethod, amount: row.netAmount }))), accountWise: group(active.map((row) => ({ label: publicAccountLabel(row.receivedAccount) ?? "Not specified", amount: row.netAmount }))) };
}

export function miscIncomeCsv(rows: any[]) {
  const headers = ["Receipt Number", "Date", "Status", "Student", "Admission Number", "Payer", "Payment Method", "Received Account", "Items", "Gross", "Discount", "Net"];
  return [headers, ...rows.map((row) => [row.receiptNumber, row.receiptDate.toISOString().slice(0, 10), row.status, row.student?.studentName ?? "", row.student?.admissionNo ?? "", row.payerName ?? "", row.paymentMethod, publicAccountLabel(row.receivedAccount) ?? "", row.lines.map((line: any) => line.itemNameSnapshot).join("; "), row.grossAmount.toFixed(2), row.discountAmount.toFixed(2), row.netAmount.toFixed(2)])].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
