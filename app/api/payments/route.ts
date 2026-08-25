import { safeClientError } from "@/lib/client-errors";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import {
  FINANCE_PAYMENT_SELECT,
  paymentManagementResponse,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { createPaymentReceipt } from "@/lib/payment-service";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_PAYMENTS");
  if (auth.response) return auth.response;
  const searchParams = request.nextUrl.searchParams;
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      ...(searchParams.get("date") ? { date: dayRange(searchParams.get("date")!) } : {}),
      ...(searchParams.get("admissionNo") ? { admissionNo: searchParams.get("admissionNo")! } : {}),
      ...(searchParams.get("receiptNo") ? { receiptNo: searchParams.get("receiptNo")! } : {}),
      ...(searchParams.get("paymentMode") ? { paymentMode: searchParams.get("paymentMode")! } : {}),
      ...(searchParams.get("receivedAccount") ? { receivedAccount: searchParams.get("receivedAccount")! } : {})
    },
    select: FINANCE_PAYMENT_SELECT,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500
  });
  return privateFinanceJson(payments.map((payment) => paymentManagementResponse(payment)));
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_PAYMENTS");
  if (auth.response) return auth.response;
  try {
    const result = await createPaymentReceipt(prisma, await request.json(), auth.user);
    const payments = result.rows;
    return privateFinanceJson({
      receiptNo: result.receiptNo,
      split: payments.length > 1,
      total: payments.reduce((sum, payment) => sum + payment.amountPaid, 0),
      status: "ACTIVE",
      components: payments.map((payment) => paymentManagementResponse(payment))
    }, { status: 201 });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error
      ? Number((error as { status: unknown }).status)
      : 400;
    return privateFinanceJson({ error: safeClientError(error, "Unable to save payment") }, { status });
  }
}

function dayRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}
