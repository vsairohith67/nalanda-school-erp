import { NextRequest } from "next/server";
import { cancelOwnPayslipRequest } from "@/lib/payslip-request";
import { payslipBody, payslipError, payslipJson, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ requestKey: string }> }) {
  const auth = await requirePayslipAny(["REQUEST_OWN_PAYSLIP"], "TEACHER");
  if (auth.response || !auth.context) return auth.response;
  try { return payslipJson(await cancelOwnPayslipRequest(prisma, (await context.params).requestKey, await payslipBody(request), auth.context)); } catch (error) { return payslipError(error); }
}
