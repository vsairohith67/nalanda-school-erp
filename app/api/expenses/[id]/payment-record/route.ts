import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentRecordError, readExpensePaymentRecord } from "@/lib/expense-payment-record";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_EXPENSES");
  if (auth.response) return auth.response;
  const context = await getCurrentAuthContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const paymentId = request.nextUrl.searchParams.get("paymentId");
  const version = request.nextUrl.searchParams.get("version");
  if (!paymentId || !version || !/^[a-f0-9]{64}$/.test(version))
    return NextResponse.json({ error: "An existing payment and preview version are required" }, { status: 400 });
  try {
    const record = await readExpensePaymentRecord(prisma, { userId: context.user.id, sessionId: context.sessionId,
      roleAssignmentId: context.user.roleAssignmentId }, id, paymentId, version);
    return NextResponse.json({ record }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentRecordError ? error.message : "Unable to verify the payment record" },
      { status: error instanceof PaymentRecordError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
