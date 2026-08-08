import { NextRequest } from "next/server";
import { loadOwnPayslipRequests, submitOwnPayslipRequest } from "@/lib/payslip-request";
import { payslipBody, payslipError, payslipJson, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requirePayslipAny(["VIEW_OWN_PAYSLIP_REQUESTS"], "TEACHER");
  if (auth.response || !auth.context) return auth.response;
  try { return payslipJson(await loadOwnPayslipRequests(prisma, auth.context)); } catch (error) { return payslipError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requirePayslipAny(["REQUEST_OWN_PAYSLIP"], "TEACHER");
  if (auth.response || !auth.context) return auth.response;
  try { return payslipJson(await submitOwnPayslipRequest(prisma, await payslipBody(request), auth.context), 201); } catch (error) { return payslipError(error); }
}
