import { safeClientError } from "@/lib/client-errors";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePaymentPayload } from "@/lib/validation";
import { requireApiPermission } from "@/lib/auth";
import { assertReceiptStudentMatchInDatabase } from "@/lib/payment-controls";
import {
  assertReceiptAcceptsActiveComponent,
  assertReceiptMutationVersion,
  cancelWholeReceipt,
  isReceiptCancellationAuthority,
  ReceiptIntegrityError
} from "@/lib/receipt-integrity";
import { paymentManagementResponse, privateFinanceJson } from "@/lib/finance-privacy";
import { receiptAuditSnapshot } from "@/lib/receipt";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("EDIT_PAYMENTS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const reason = String(body.reason ?? "").trim();
    if (!reason) throw new Error("Edit reason is required");
    const payload = validatePaymentPayload(body);
    const student = await prisma.student.findUnique({ where: { admissionNo: payload.admissionNo } });
    if (!student || student.deletedAt) throw new Error("Admission number not found in Student Master");
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new Error("Payment not found");
    if (existing.isCancelled) throw new Error("Cancelled payments must be restored before editing");
    if (
      payload.receiptNo !== existing.receiptNo ||
      payload.admissionNo !== existing.admissionNo
    ) {
      throw new ReceiptIntegrityError(
        "Receipt and admission numbers cannot be changed during a payment correction",
        409
      );
    }
    const payment = await prisma.$transaction(async (tx) => {
      await assertReceiptMutationVersion(tx, existing.receiptNo, body.expectedVersion);
      await assertReceiptStudentMatchInDatabase(tx, {
        receiptNo: payload.receiptNo,
        admissionNo: payload.admissionNo,
        excludePaymentId: id
      });
      await assertReceiptAcceptsActiveComponent(tx, payload, id);
      const updated = await tx.payment.update({
        where: { id },
        data: {
          ...payload,
          enteredBy: existing.enteredBy,
          studentId: student.id,
          studentName: student.studentName,
          className: student.className,
          section: student.section,
          editedBy: auth.user.name
        }
      });
      await tx.paymentAudit.create({
        data: {
          paymentId: id,
          action: "UPDATED",
          oldValueJson: JSON.stringify(receiptAuditSnapshot(existing)),
          newValueJson: JSON.stringify(receiptAuditSnapshot(updated)),
          changedByUserId: auth.user.id,
          changedByName: auth.user.name,
          reason
        }
      });
      await tx.receiptNote.upsert({
        where: { receiptNo: payload.receiptNo },
        update: { status: "Active" },
        create: { receiptNo: payload.receiptNo, status: "Active", remarks: "Audited payment correction" }
      });
      return updated;
    });
    return privateFinanceJson(paymentManagementResponse(payment));
  } catch (error) {
    const status = error instanceof ReceiptIntegrityError ? error.status : 400;
    return privateFinanceJson({ error: safeClientError(error, "Unable to update payment") }, { status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CANCEL_PAYMENTS");
  if (auth.response) return auth.response;
  if (!isReceiptCancellationAuthority(auth.user.role)) {
    return privateFinanceJson({ error: "Only the Director or Super Admin can cancel a final receipt" }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const existing = await prisma.payment.findUnique({ where: { id }, select: { receiptNo: true } });
  if (!existing) return privateFinanceJson({ error: "Payment not found" }, { status: 404 });
  try {
    const result = await cancelWholeReceipt(prisma, {
      receiptNo: existing.receiptNo,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      actor: auth.user
    });
    return privateFinanceJson(result);
  } catch (error) {
    const status = error instanceof ReceiptIntegrityError ? error.status : 409;
    return privateFinanceJson({ error: safeClientError(error, "Unable to cancel receipt") }, { status });
  }
}
