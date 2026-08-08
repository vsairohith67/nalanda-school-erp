import { NextRequest } from "next/server";
import { loadPayslipRequestQueue, setPayslipMonthAvailability } from "@/lib/payslip-request";
import { payslipBody, payslipError, payslipJson, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requirePayslipAny(["VIEW_PAYSLIP_REQUESTS"]);
  if (auth.response) return auth.response;
  const audit = await requirePayslipAny(["VIEW_PAYSLIP_REQUEST_AUDIT"]);
  try { return payslipJson(await loadPayslipRequestQueue(prisma, { includeAudit: !audit.response })); } catch (error) { return payslipError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requirePayslipAny(["MANAGE_PAYSLIP_MONTH_AVAILABILITY"]);
  if (auth.response || !auth.context) return auth.response;
  try { return payslipJson(await setPayslipMonthAvailability(prisma, await payslipBody(request), auth.context), 201); } catch (error) { return payslipError(error); }
}
