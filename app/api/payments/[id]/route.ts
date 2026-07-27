import { safeClientError } from "@/lib/client-errors";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePaymentPayload } from "@/lib/validation";
import { requireApiPermission } from "@/lib/auth";
import {
  cancelWholeReceipt,
  correctFinalReceipt,
  ReceiptIntegrityError
} from "@/lib/receipt-integrity";
import { privateFinanceJson } from "@/lib/finance-privacy";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CORRECT_FINAL_RECEIPT");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = validatePaymentPayload(body);
    const result = await correctFinalReceipt(prisma, {
      authorization: "CORRECT_FINAL_RECEIPT",
      paymentId: id,
      payload,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      actor: auth.user
    });
    return privateFinanceJson(result);
  } catch (error) {
    const status = error instanceof ReceiptIntegrityError ? error.status : 400;
    return privateFinanceJson({ error: safeClientError(error, "Unable to correct final receipt") }, { status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CANCEL_FINAL_RECEIPT");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const existing = await prisma.payment.findUnique({ where: { id }, select: { receiptNo: true } });
  if (!existing) return privateFinanceJson({ error: "Payment not found" }, { status: 404 });
  try {
    const result = await cancelWholeReceipt(prisma, {
      authorization: "CANCEL_FINAL_RECEIPT",
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
