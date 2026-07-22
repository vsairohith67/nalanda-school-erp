import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("RESTORE_PAYMENTS");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Restore reason is required" }, { status: 400 });
  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (!existing.isCancelled) return NextResponse.json({ error: "Payment is not cancelled" }, { status: 400 });
  const payment = await prisma.$transaction(async (tx) => {
    const restored = await tx.payment.update({
      where: { id },
      data: {
        isCancelled: false,
        cancelledAt: null,
        cancelledByUserId: null,
        cancellationReason: null,
        editedBy: auth.user.name
      }
    });
    await tx.paymentAudit.create({
      data: {
        paymentId: id,
        action: "RESTORED",
        oldValueJson: JSON.stringify(existing),
        newValueJson: JSON.stringify(restored),
        changedByUserId: auth.user.id,
        changedByName: auth.user.name,
        reason
      }
    });
    return restored;
  });
  return NextResponse.json(payment);
}
