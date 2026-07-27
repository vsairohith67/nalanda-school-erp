import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { privateFinanceJson } from "@/lib/finance-privacy";
import {
  ReceiptIntegrityError,
  restoreWholeReceipt
} from "@/lib/receipt-integrity";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("RESTORE_PAYMENTS");
  if (auth.response) return auth.response;
  if (!["DIRECTOR", "SUPER_ADMIN"].includes(auth.user.role)) {
    return privateFinanceJson({ error: "Only the Director or Super Admin can restore a cancelled receipt" }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const existing = await prisma.payment.findUnique({ where: { id }, select: { receiptNo: true } });
  if (!existing) return privateFinanceJson({ error: "Payment not found" }, { status: 404 });
  try {
    const result = await restoreWholeReceipt(prisma, {
      receiptNo: existing.receiptNo,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      actor: auth.user
    });
    return privateFinanceJson(result);
  } catch (error) {
    const status = error instanceof ReceiptIntegrityError ? error.status : 409;
    return privateFinanceJson({ error: safeClientError(error, "Unable to restore receipt") }, { status });
  }
}
