import { NextRequest } from "next/server";
import { revealOwnPayslipPassword } from "@/lib/payslip-request";
import { payslipBody, payslipError, payslipJson, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ documentKey: string }> }) {
  const auth = await requirePayslipAny(["VIEW_OWN_PAYSLIP_REQUESTS"], "TEACHER");
  if (auth.response || !auth.context) return auth.response;
  try { return payslipJson(await revealOwnPayslipPassword(prisma, (await context.params).documentKey, await payslipBody(request), auth.context)); } catch (error) { return payslipError(error); }
}
