import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { withDatabaseRetry } from "@/lib/database-retry";

export type PaymentRecordActor = { userId: string; sessionId: string; roleAssignmentId: string };
export class PaymentRecordError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** A read-only projection of an existing annual CASH payment, not a voucher
 * number, acknowledgement event, signature, payment or payroll operation. */
export async function readExpensePaymentRecord(client: PrismaClient, actor: PaymentRecordActor,
  expenseId: string, paymentId: string, expectedVersion?: string) {
  return withDatabaseRetry(() => client.$transaction(async tx => {
    const allowed = async (permission: string) => (await evaluateEffectivePermission(tx, { ...actor, permission })).allowed;
    if (!await allowed("VIEW_EXPENSES") || !(await Promise.all(
      ["MANAGE_EXPENSES", "APPROVE_EXPENSES", "MARK_EXPENSE_PAID", "CANCEL_EXPENSES"].map(allowed))).some(Boolean))
      throw new PaymentRecordError("Finance operator permission is required", 403);
    const [user, session] = await Promise.all([
      tx.user.findUnique({ where: { id: actor.userId }, select: { credentialVersion: true, mustChangePassword: true } }),
      tx.authSession.findUnique({ where: { id: actor.sessionId }, select: { credentialVersion: true } })
    ]);
    if (!user || user.mustChangePassword || session?.credentialVersion !== user.credentialVersion)
      throw new PaymentRecordError("The session is no longer current", 403);
    const row = await tx.expenseRecord.findUnique({ where: { id: expenseId }, include: {
      vendor: { select: { id: true, name: true } }, payments: true,
      audits: { where: { action: "CREATED_FROM_LIBRARY_SERVICE_TEMPLATE" }, select: { detailsJson: true } }
    } });
    const payment = row?.payments.find(item => item.id === paymentId);
    if (!row || !payment) throw new PaymentRecordError("Payment record not found for this expense", 404);
    if (row.approvalStatus !== "APPROVED" || !["PAID", "PARTIALLY_PAID"].includes(row.paymentStatus) ||
      row.paymentMethod !== "CASH" || payment.paymentMethod !== "CASH" || row.audits.length !== 1 || !row.vendor)
      throw new PaymentRecordError("An approved annual CASH expense with a recorded payment is required", 409);
    let provenance: { servicePeriod?: unknown; academicYear?: unknown; payrollUsed?: unknown };
    try { provenance = JSON.parse(row.audits[0].detailsJson ?? "null"); }
    catch { throw new PaymentRecordError("The recorded service interval is unavailable", 409); }
    if (!provenance || typeof provenance.servicePeriod !== "string" || !provenance.servicePeriod.trim() ||
      provenance.servicePeriod.length > 120 || provenance.academicYear !== row.academicYear || provenance.payrollUsed !== false)
      throw new PaymentRecordError("The recorded service interval is unavailable", 409);
    const totalPaid = row.payments.reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0));
    if (payment.amount.lte(0) || totalPaid.gt(row.netAmount) ||
      (row.paymentStatus === "PAID" ? !totalPaid.equals(row.netAmount) : totalPaid.gte(row.netAmount)))
      throw new PaymentRecordError("Recorded expense and payment amounts are inconsistent", 409);
    const settings = await tx.schoolSettings.findUnique({ where: { id: "school" }, select: { schoolName: true } });
    if (!settings?.schoolName.trim()) throw new PaymentRecordError("The school name is not configured", 409);
    const record = {
      documentKind: "PAYMENT_RECORD_ACKNOWLEDGEMENT_DRAFT" as const,
      officialReceipt: false as const, acknowledgementRecorded: false as const,
      schoolName: settings.schoolName, expenseId: row.id, paymentId: payment.id,
      expenseReference: row.expenseNumber, payeeId: row.vendor.id, payeeName: row.vendor.name,
      purpose: row.description, coveredInterval: provenance.servicePeriod,
      academicYear: row.academicYear, amount: payment.amount.toFixed(2), currency: "INR" as const,
      paymentMethod: "CASH" as const, paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      approvalStatus: row.approvalStatus, paymentStatus: row.paymentStatus,
      expenseUpdatedAt: row.updatedAt.toISOString(), paymentCreatedAt: payment.createdAt.toISOString()
    };
    const version = createHash("sha256").update(JSON.stringify(record)).digest("hex");
    if (expectedVersion !== undefined && expectedVersion !== version)
      throw new PaymentRecordError("This preview is stale. Refresh and review the current payment record", 409);
    return { ...record, version };
  }, { isolationLevel: "Serializable" }));
}

export type ExpensePaymentRecord = Awaited<ReturnType<typeof readExpensePaymentRecord>>;
