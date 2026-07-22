import { Prisma, type PrismaClient } from "@prisma/client";
import { expenseDetailInclude, localDate, moneyDecimal, newExpenseNumber, validateActiveExpenseMasters, validateExpenseAmounts } from "@/lib/expenses";

type Actor = { id: string; name: string };
function requiredText(value: unknown, label: string, max = 500) { const result = String(value ?? "").trim(); if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`); return result; }
function optionalText(value: unknown, label: string, max = 1000) { const result = String(value ?? "").trim(); if (result.length > max) throw new Error(`${label} must be at most ${max} characters`); return result || null; }

async function booksMasters(client: PrismaClient | Prisma.TransactionClient, departmentCode?: "LIBRARY" | "ACADEMICS") {
  const [category, department] = await Promise.all([
    client.expenseCategory.findFirst({ where: { code: "BOOKS", status: "ACTIVE" }, select: { id: true } }),
    client.expenseDepartment.findFirst({ where: { code: departmentCode ?? { in: ["LIBRARY", "ACADEMICS"] }, status: "ACTIVE" }, select: { id: true } })
  ]);
  if (!category) throw new Error("The active Books & Academic Materials expense category is required");
  if (!department) throw new Error("An active Library or Academics expense department is required");
  return { categoryId: category.id, departmentId: department.id };
}

export async function createPublisherBillDraft(client: PrismaClient, input: unknown, actor: Actor) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Publisher bill details are required");
  const row = input as Record<string, unknown>;
  const vendorId = requiredText(row.vendorId, "Publisher vendor", 80);
  const amounts = validateExpenseAmounts(row as never);
  return client.$transaction(async (tx) => {
    const defaults = await booksMasters(tx, String(row.departmentCode ?? "LIBRARY").toUpperCase() === "ACADEMICS" ? "ACADEMICS" : "LIBRARY");
    const data = { expenseDate: localDate(row.expenseDate, "Expense date"), academicYear: requiredText(row.academicYear, "Academic year", 20), vendorId, ...defaults, description: requiredText(row.description, "Description"), invoiceNumber: requiredText(row.invoiceNumber, "Invoice number", 100), invoiceDate: localDate(row.invoiceDate, "Invoice date"), ...amounts, paymentMethod: "BANK_TRANSFER", transactionReference: null, chequeNumber: null, chequeDate: null, notes: optionalText(row.notes, "Notes", 2000) };
    await validateActiveExpenseMasters(tx, data);
    const expense = await tx.expenseRecord.create({ data: { ...data, expenseNumber: newExpenseNumber(), createdByUserId: actor.id } });
    await tx.expenseAudit.create({ data: { expenseRecordId: expense.id, action: "CREATED_FROM_PUBLISHER_BILL", toStatus: "DRAFT", actorUserId: actor.id, actorName: actor.name } });
    return tx.expenseRecord.findUniqueOrThrow({ where: { id: expense.id }, include: expenseDetailInclude });
  });
}

export async function createLibraryManagementServiceDraft(client: PrismaClient, input: unknown, actor: Actor) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Library-management service details are required");
  const row = input as Record<string, unknown>;
  const vendorId = requiredText(row.vendorId, "Approved service-provider vendor", 80);
  const amount = moneyDecimal(row.amount, "Service amount", false);
  const academicYear = requiredText(row.academicYear, "Academic year", 20);
  const servicePeriod = requiredText(row.servicePeriod, "Service period", 120);
  return client.$transaction(async (tx) => {
    const [category, department] = await Promise.all([
      tx.expenseCategory.findFirst({ where: { code: "PROFESSIONAL", status: "ACTIVE" }, select: { id: true } }),
      tx.expenseDepartment.findFirst({ where: { code: "LIBRARY", status: "ACTIVE" }, select: { id: true } })
    ]);
    if (!category || !department) throw new Error("Active Professional Fees and Library expense masters are required");
    const data = { expenseDate: localDate(row.expenseDate, "Expense date"), academicYear, vendorId, categoryId: category.id, departmentId: department.id, description: `Library management service - ${academicYear} - ${servicePeriod}`, invoiceNumber: optionalText(row.invoiceNumber, "Invoice number", 100), invoiceDate: row.invoiceDate ? localDate(row.invoiceDate, "Invoice date") : null, grossAmount: amount, taxAmount: new Prisma.Decimal(0), deductionAmount: new Prisma.Decimal(0), netAmount: amount, paymentMethod: "CASH", transactionReference: null, chequeNumber: null, chequeDate: null, notes: optionalText(row.notes, "Notes", 2000) };
    await validateActiveExpenseMasters(tx, data);
    const expense = await tx.expenseRecord.create({ data: { ...data, expenseNumber: newExpenseNumber(), createdByUserId: actor.id } });
    await tx.expenseAudit.create({ data: { expenseRecordId: expense.id, action: "CREATED_FROM_LIBRARY_SERVICE_TEMPLATE", toStatus: "DRAFT", detailsJson: JSON.stringify({ academicYear, servicePeriod, payrollUsed: false }), actorUserId: actor.id, actorName: actor.name } });
    return tx.expenseRecord.findUniqueOrThrow({ where: { id: expense.id }, include: expenseDetailInclude });
  });
}

export function publisherExpenseWhere(filters: { vendorId?: string; academicYear?: string; paymentStatus?: string; from?: Date; to?: Date } = {}): Prisma.ExpenseRecordWhereInput {
  return { vendorId: filters.vendorId || undefined, academicYear: filters.academicYear || undefined, paymentStatus: filters.paymentStatus || undefined, category: { code: "BOOKS" }, ...(filters.from || filters.to ? { invoiceDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } } : {}) };
}

export function publisherBillTotals(rows: Array<{ netAmount: Prisma.Decimal; payments: Array<{ amount: Prisma.Decimal }>; approvalStatus: string }>) {
  return rows.reduce((result, row) => { if (row.approvalStatus === "CANCELLED") return result; const paid = row.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0)); return { invoiceTotal: result.invoiceTotal.add(row.netAmount), paid: result.paid.add(paid), outstanding: result.outstanding.add(row.netAmount.sub(paid)) }; }, { invoiceTotal: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(0) });
}
