import { randomUUID } from "node:crypto";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { validatePaymentPayload } from "@/lib/validation";
import { assertReceiptStudentMatchInDatabase, normalizePaymentComponents } from "@/lib/payment-controls";
import { assertReceiptIsNewForCreate } from "@/lib/receipt-integrity";
import { receiptAuditSnapshot } from "@/lib/receipt";
import { allocateFees } from "@/lib/fee-allocation";

type Actor = { id: string; name: string };
type PaymentReceiptOptions = { serverReceipt?: boolean; enforceCurrentDue?: boolean; requireActiveStudent?: boolean; requireCurrentYearFee?: boolean };

export function newOfflineReceiptNumber(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("-", "");
  return `OFF-${day}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function createPaymentReceiptInTransaction(
  tx: Prisma.TransactionClient,
  input: unknown,
  actor: Actor,
  options: PaymentReceiptOptions = {}
) {
  const body = { ...(input as Record<string, unknown>) };
  if (options.serverReceipt) body.receiptNo = newOfflineReceiptNumber();
  const components = normalizePaymentComponents(body);
  const payloads = components ? components.map((component) => validatePaymentPayload({ ...body, ...component })) : [validatePaymentPayload(body)];
  const first = payloads[0];
  if (payloads.some((payload) => payload.receiptNo !== first.receiptNo || payload.admissionNo !== first.admissionNo || payload.date.getTime() !== first.date.getTime() || payload.feeType !== first.feeType || payload.termHint !== first.termHint)) {
    throw new Error("All payment components must use the same receipt, student, date, fee type, and term");
  }
  if (options.requireCurrentYearFee && first.feeType !== "Current Year Fee") throw new Error("FEE_TYPE_NOT_SUPPORTED_OFFLINE");
  const student = await tx.student.findUnique({ where: { admissionNo: first.admissionNo } });
  if (!student || student.deletedAt) throw new Error(options.requireActiveStudent ? "STUDENT_NO_LONGER_ACTIVE" : "Admission number not found in Student Master");
  if (options.requireActiveStudent && student.status.toLowerCase() !== "active") throw new Error("STUDENT_NO_LONGER_ACTIVE");
  if (options.enforceCurrentDue && first.feeType === "Current Year Fee") {
    const structure = await tx.feeStructure.findUnique({ where: { academicYear_className: { academicYear: student.academicYear, className: student.className } } });
    if (!structure || !structure.active) throw new Error("FEE_STRUCTURE_CHANGED_OR_UNAVAILABLE");
    const previous = await tx.payment.findMany({ where: { admissionNo: student.admissionNo, deletedAt: null }, select: { amountPaid: true, feeType: true, isCancelled: true, deletedAt: true } });
    const pending = allocateFees(student, structure, previous, first.date).totalPending;
    const total = payloads.reduce((sum, payload) => sum + payload.amountPaid, 0);
    if (total > pending + 0.001) throw new Error("PAYMENT_EXCEEDS_CURRENT_DUE");
  }
  await assertReceiptIsNewForCreate(tx, first.receiptNo);
  await assertReceiptStudentMatchInDatabase(tx, { receiptNo: first.receiptNo, admissionNo: first.admissionNo });
  await tx.receiptNote.create({ data: { receiptNo: first.receiptNo, status: "Active", remarks: options.serverReceipt ? "Created from an encrypted offline draft" : "Payment receipt created" } });
  const rows = [];
  for (const payload of payloads) {
    const created = await tx.payment.create({ data: { ...payload, enteredBy: actor.name, editedBy: null, studentId: student.id, studentName: student.studentName, className: student.className, section: student.section } });
    await tx.paymentAudit.create({ data: { paymentId: created.id, action: "CREATED", newValueJson: JSON.stringify(receiptAuditSnapshot(created)), changedByUserId: actor.id, changedByName: actor.name, reason: options.serverReceipt ? "Encrypted offline draft synchronized" : payloads.length > 1 ? "Split receipt component created" : "Payment entry created" } });
    rows.push(created);
  }
  return { receiptNo: first.receiptNo, rows };
}

export function createPaymentReceipt(client: PrismaClient, input: unknown, actor: Actor, options: PaymentReceiptOptions = {}) {
  return client.$transaction((tx) => createPaymentReceiptInTransaction(tx, input, actor, options));
}
