import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { calculatePilotReconciliationTotals } from "@/lib/pilot-acceptance";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("RUN_PILOT_ACCEPTANCE");
  if (auth.response) return auth.response;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return NextResponse.json({ error: "Valid from and to dates are required" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "From date must not be after to date" }, { status: 400 });
  }

  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      isCancelled: false,
      date: inclusiveDateRange(from, to)
    },
    select: {
      amountPaid: true,
      paymentMode: true,
      receivedAccount: true,
      isCancelled: true,
      deletedAt: true
    }
  });

  return NextResponse.json({
    from,
    to,
    totals: calculatePilotReconciliationTotals(payments)
  });
}

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function inclusiveDateRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}
