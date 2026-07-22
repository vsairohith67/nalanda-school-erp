import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { csvCell, localDate, moneyDecimal } from "@/lib/expenses";

export const BOOK_ITEM_TYPES = ["TEXTBOOK", "WORKBOOK", "NOTEBOOK", "BOOK_SET", "GUIDE", "STATIONERY", "OTHER"] as const;
export const BOOK_PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"] as const;
export const BOOK_RECEIVED_ACCOUNTS = ["BOOKS_CASH_COUNTER", "DIRECTOR_GPAY", "NPS_CURRENT_ACCOUNT", "OTHER"] as const;

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

export function normalizeBookItemCode(value: unknown) {
  const code = text(value, "Item code", 40)!.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9_-]/g, "");
  if (!code) throw new Error("Item code must contain letters or numbers");
  return code;
}

export function newBookReceiptNumber(date = new Date()) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("-", "");
  return `BOOK-${key}-${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export function validateBookCatalogItemInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Catalog item details are required");
  const row = input as Record<string, unknown>;
  return {
    itemCode: normalizeBookItemCode(row.itemCode),
    title: text(row.title, "Title", 160)!,
    itemType: oneOf(row.itemType, BOOK_ITEM_TYPES, "Item type"),
    publisherVendorId: text(row.publisherVendorId, "Publisher", 80, false),
    className: text(row.className, "Class", 50, false),
    subject: text(row.subject, "Subject", 80, false),
    description: text(row.description, "Description", 1000, false),
    studentLinkRequired: row.studentLinkRequired !== false && String(row.studentLinkRequired).toLowerCase() !== "false",
    status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Item status")
  };
}

export function validateBookRateInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Rate details are required");
  const row = input as Record<string, unknown>;
  const effectiveFrom = row.effectiveFrom ? localDate(row.effectiveFrom, "Effective from") : null;
  const effectiveTo = row.effectiveTo ? localDate(row.effectiveTo, "Effective to") : null;
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("Effective to cannot be before effective from");
  return { itemId: text(row.itemId, "Item", 80)!, academicYear: text(row.academicYear, "Academic year", 20)!, amount: moneyDecimal(row.amount, "Rate amount", false), effectiveFrom, effectiveTo, status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Rate status"), notes: text(row.notes, "Rate notes", 1000, false) };
}

export async function assertNoBookRateOverlap(client: Pick<PrismaClient | Prisma.TransactionClient, "bookCatalogRate">, data: ReturnType<typeof validateBookRateInput>, excludeId?: string) {
  if (data.status !== "ACTIVE") return;
  const rates = await client.bookCatalogRate.findMany({ where: { itemId: data.itemId, academicYear: data.academicYear, status: "ACTIVE", ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { effectiveFrom: true, effectiveTo: true } });
  const from = data.effectiveFrom?.getTime() ?? Number.NEGATIVE_INFINITY;
  const to = data.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  if (rates.some((rate) => from <= (rate.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY) && (rate.effectiveFrom?.getTime() ?? Number.NEGATIVE_INFINITY) <= to)) throw new Error("An overlapping active rate already exists for this item and academic year");
}

export async function assertBookItemCanDelete(client: Pick<PrismaClient | Prisma.TransactionClient, "bookCatalogItem">, id: string) {
  const linked = await client.bookCatalogItem.findUnique({ where: { id }, select: { _count: { select: { rates: true, receiptLines: true } } } });
  if (!linked) throw new Error("Catalog item not found");
  if (linked._count.rates || linked._count.receiptLines) throw new Error("Linked catalog items cannot be deleted; mark the item inactive instead");
}

function referenceFields(row: Record<string, unknown>) {
  const paymentMethod = oneOf(row.paymentMethod, BOOK_PAYMENT_METHODS, "Payment method");
  const receivedAccount = row.receivedAccount ? oneOf(row.receivedAccount, BOOK_RECEIVED_ACCOUNTS, "Received account") : null;
  const transactionReference = text(row.transactionReference, "Transaction reference", 120, false);
  const chequeNumber = text(row.chequeNumber, "Cheque number", 40, false);
  const chequeDate = row.chequeDate ? localDate(row.chequeDate, "Cheque date") : null;
  if (paymentMethod === "CASH") return { paymentMethod, receivedAccount: "BOOKS_CASH_COUNTER" as const, transactionReference: null, chequeNumber: null, chequeDate: null };
  if (!receivedAccount) throw new Error("Received account is required for non-cash book sales");
  if (paymentMethod === "CHEQUE") {
    if (!chequeNumber || !chequeDate) throw new Error("Cheque number and cheque date are required for cheque book sales");
    return { paymentMethod, receivedAccount, transactionReference: null, chequeNumber, chequeDate };
  }
  if (!transactionReference) throw new Error("Transaction reference is required for non-cash book sales");
  return { paymentMethod, receivedAccount, transactionReference, chequeNumber: null, chequeDate: null };
}

export async function validateBookSaleInput(client: PrismaClient | Prisma.TransactionClient, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Book-sale receipt details are required");
  const row = input as Record<string, unknown>;
  if (!Array.isArray(row.lines) || !row.lines.length || row.lines.length > 50) throw new Error("At least one and at most 50 receipt lines are required");
  const academicYear = text(row.academicYear, "Academic year", 20)!;
  const studentId = text(row.studentId, "Student", 80, false);
  const itemIds = [...new Set(row.lines.map((line) => text((line as Record<string, unknown>).itemId, "Item", 80)!))];
  const items = await client.bookCatalogItem.findMany({ where: { id: { in: itemIds }, status: "ACTIVE" }, include: { publisherVendor: { select: { name: true } }, rates: { where: { academicYear, status: "ACTIVE" } } } });
  if (items.length !== itemIds.length) throw new Error("Every selected catalog item must be active");
  const itemMap = new Map(items.map((item) => [item.id, item]));
  if (items.some((item) => item.studentLinkRequired) && !studentId) throw new Error("A student is required for one or more selected book items");
  if (studentId && !(await client.student.findFirst({ where: { id: studentId, deletedAt: null }, select: { id: true } }))) throw new Error("Selected student was not found");
  const receiptDate = localDate(row.receiptDate, "Receipt date");
  let grossAmount = new Prisma.Decimal(0), discountAmount = new Prisma.Decimal(0);
  const lines = row.lines.map((rawLine, index) => {
    if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) throw new Error(`Line ${index + 1} is invalid`);
    const line = rawLine as Record<string, unknown>; const itemId = text(line.itemId, "Item", 80)!; const item = itemMap.get(itemId)!;
    const quantity = Number(line.quantity); if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10000) throw new Error(`Line ${index + 1} quantity must be a positive whole number`);
    const availableRates = item.rates.filter((rate) => (!rate.effectiveFrom || rate.effectiveFrom <= receiptDate) && (!rate.effectiveTo || rate.effectiveTo >= receiptDate));
    if (availableRates.length !== 1) throw new Error(`Line ${index + 1} must resolve to exactly one active academic-year rate`);
    const rate = availableRates[0]; const unitAmount = rate.amount; const gross = unitAmount.mul(quantity); const discount = moneyDecimal(line.discountAmount ?? 0, `Line ${index + 1} discount`);
    if (discount.gt(gross)) throw new Error(`Line ${index + 1} discount cannot exceed its gross amount`);
    grossAmount = grossAmount.add(gross); discountAmount = discountAmount.add(discount);
    return { itemId, itemCodeSnapshot: item.itemCode, itemTitleSnapshot: item.title, classNameSnapshot: item.className, publisherNameSnapshot: item.publisherVendor?.name ?? null, rateId: rate.id, quantity, unitAmount, discountAmount: discount, lineTotal: gross.sub(discount), notes: text(line.notes, `Line ${index + 1} notes`, 500, false) };
  });
  const netAmount = grossAmount.sub(discountAmount); if (netAmount.lte(0)) throw new Error("Receipt net amount must be greater than zero");
  return { receiptDate, academicYear, studentId, payerName: text(row.payerName, "Payer name", 120, false), ...referenceFields(row), grossAmount, discountAmount, netAmount, remarks: text(row.remarks, "Remarks", 1000, false), lines };
}

export async function createBookSaleReceipt(client: PrismaClient, input: unknown, actorId: string) {
  return client.$transaction(async (tx) => {
    const data = await validateBookSaleInput(tx, input);
    return tx.bookSaleReceipt.create({ data: { ...data, lines: { create: data.lines }, receiptNumber: newBookReceiptNumber(data.receiptDate), createdByUserId: actorId }, include: bookReceiptInclude });
  });
}

export async function cancelBookSaleReceipt(client: PrismaClient, id: string, reason: unknown, actorId: string) {
  const cancellationReason = text(reason, "Cancellation reason", 1000)!;
  return client.$transaction(async (tx) => {
    const changed = await tx.bookSaleReceipt.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "CANCELLED", cancellationReason, cancelledByUserId: actorId, cancelledAt: new Date() } });
    if (changed.count !== 1) throw new Error("Receipt was not active or changed while cancellation was processed");
    return tx.bookSaleReceipt.findUniqueOrThrow({ where: { id }, include: bookReceiptInclude });
  });
}

export const bookReceiptInclude = { student: { select: { admissionNo: true, studentName: true, className: true, section: true } }, lines: { orderBy: { createdAt: "asc" as const } }, createdBy: { select: { name: true } }, cancelledBy: { select: { name: true } } };

export function publicBookAccountLabel(value: string | null) { return ({ BOOKS_CASH_COUNTER: "Books cash counter", DIRECTOR_GPAY: "Director GPay", NPS_CURRENT_ACCOUNT: "School current account", OTHER: "Other school account" } as Record<string, string>)[value ?? ""] ?? null; }

export function serializeBookReceipt(row: any, sensitive = true) {
  const result: Record<string, unknown> = { id: row.id, receiptNumber: row.receiptNumber, receiptDate: row.receiptDate, academicYear: row.academicYear, student: row.student, payerName: row.payerName, paymentMethod: row.paymentMethod, receivedAccount: publicBookAccountLabel(row.receivedAccount), grossAmount: row.grossAmount.toString(), discountAmount: row.discountAmount.toString(), netAmount: row.netAmount.toString(), status: row.status, cancelledAt: row.cancelledAt, createdAt: row.createdAt, lines: row.lines.map((line: any) => ({ id: line.id, itemCode: line.itemCodeSnapshot, itemTitle: line.itemTitleSnapshot, className: line.classNameSnapshot, publisherName: line.publisherNameSnapshot, quantity: line.quantity, unitAmount: line.unitAmount.toString(), discountAmount: line.discountAmount.toString(), lineTotal: line.lineTotal.toString(), notes: line.notes })) };
  if (sensitive) Object.assign(result, { transactionReference: row.transactionReference, chequeNumber: row.chequeNumber, chequeDate: row.chequeDate, remarks: row.remarks, cancellationReason: row.cancellationReason, createdBy: row.createdBy?.name ?? null, cancelledBy: row.cancelledBy?.name ?? null });
  return result;
}

export function bookSalesReport(rows: any[]) {
  const active = rows.filter((row) => row.status === "ACTIVE"); const sum = (list: any[]) => list.reduce((total, row) => total.add(row.netAmount), new Prisma.Decimal(0));
  const group = (values: Array<{ label: string; amount: Prisma.Decimal }>) => Array.from(values.reduce((map, row) => map.set(row.label, (map.get(row.label) ?? new Prisma.Decimal(0)).add(row.amount)), new Map<string, Prisma.Decimal>())).map(([label, total]) => ({ label, total: total.toFixed(2) })).sort((a, b) => a.label.localeCompare(b.label));
  return { total: sum(active).toFixed(2), cash: sum(active.filter((row) => row.paymentMethod === "CASH")).toFixed(2), nonCash: sum(active.filter((row) => row.paymentMethod !== "CASH")).toFixed(2), cancelled: sum(rows.filter((row) => row.status === "CANCELLED")).toFixed(2), dateWise: group(active.map((row) => ({ label: row.receiptDate.toISOString().slice(0, 10), amount: row.netAmount }))), itemWise: group(active.flatMap((row) => row.lines.map((line: any) => ({ label: `${line.itemCodeSnapshot} - ${line.itemTitleSnapshot}`, amount: line.lineTotal })))), classWise: group(active.flatMap((row) => row.lines.map((line: any) => ({ label: line.classNameSnapshot ?? "Unassigned", amount: line.lineTotal })))), studentWise: group(active.map((row) => ({ label: row.student ? `${row.student.studentName} (${row.student.admissionNo})` : row.payerName ?? "Walk-in payer", amount: row.netAmount }))), publisherWise: group(active.flatMap((row) => row.lines.map((line: any) => ({ label: line.publisherNameSnapshot ?? "Unlinked publisher", amount: line.lineTotal })))), methodWise: group(active.map((row) => ({ label: `${row.paymentMethod} / ${publicBookAccountLabel(row.receivedAccount) ?? "Not specified"}`, amount: row.netAmount }))) };
}

export function bookSalesCsv(rows: any[]) {
  const headers = ["Book Receipt Number", "Date", "Academic Year", "Status", "Student", "Admission Number", "Payer", "Items", "Classes", "Publishers", "Payment Method", "Received Account", "Gross", "Discount", "Net"];
  return [headers, ...rows.map((row) => [row.receiptNumber, row.receiptDate.toISOString().slice(0, 10), row.academicYear, row.status, row.student?.studentName ?? "", row.student?.admissionNo ?? "", row.payerName ?? "", row.lines.map((line: any) => `${line.itemCodeSnapshot} - ${line.itemTitleSnapshot}`).join("; "), row.lines.map((line: any) => line.classNameSnapshot ?? "").filter(Boolean).join("; "), row.lines.map((line: any) => line.publisherNameSnapshot ?? "").filter(Boolean).join("; "), row.paymentMethod, publicBookAccountLabel(row.receivedAccount) ?? "", row.grossAmount.toFixed(2), row.discountAmount.toFixed(2), row.netAmount.toFixed(2)])].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
