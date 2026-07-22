import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePaymentPayload } from "@/lib/validation";
import { requireApiPermission } from "@/lib/auth";
import { assertReceiptStudentMatchInDatabase } from "@/lib/payment-controls";

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
    const payment = await prisma.$transaction(async (tx) => {
      await assertReceiptStudentMatchInDatabase(tx, {
        receiptNo: payload.receiptNo,
        admissionNo: payload.admissionNo,
        excludePaymentId: id
      });
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
          oldValueJson: JSON.stringify(existing),
          newValueJson: JSON.stringify(updated),
          changedByUserId: auth.user.id,
          changedByName: auth.user.name,
          reason
        }
      });
      return updated;
    });
    return NextResponse.json(payment);
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to update payment") }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CANCEL_PAYMENTS");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();
  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (!reason) {
    await prisma.paymentAudit.create({
      data: {
        paymentId: id,
        action: "DELETED_ATTEMPT",
        oldValueJson: JSON.stringify(existing),
        changedByUserId: auth.user.id,
        changedByName: auth.user.name,
        reason: "Cancellation attempted without a reason"
      }
    });
    return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
  }
  if (existing.isCancelled) {
    return NextResponse.json({ error: "Payment is already cancelled" }, { status: 400 });
  }
  const payment = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.payment.update({
      where: { id },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledByUserId: auth.user.id,
        cancellationReason: reason,
        editedBy: auth.user.name
      }
    });
    await tx.paymentAudit.create({
      data: {
        paymentId: id,
        action: "CANCELLED",
        oldValueJson: JSON.stringify(existing),
        newValueJson: JSON.stringify(cancelled),
        changedByUserId: auth.user.id,
        changedByName: auth.user.name,
        reason
      }
    });
    return cancelled;
  });
  return NextResponse.json(payment);
}
