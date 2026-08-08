import { NextRequest } from "next/server";
import { salaryAdvanceWorkflow } from "@/lib/payroll";
import { payrollBody, payrollError, payrollJson, requirePayrollAny } from "@/lib/payroll-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) {
  const auth = await requirePayrollAny(["APPROVE_SALARY_ADVANCES"]);
  if (auth.response || !auth.user || !auth.context) return auth.response;
  try { return payrollJson({ advance: await salaryAdvanceWorkflow(prisma, (await context.params).publicKey, await payrollBody(request), { user: auth.user, sessionId: auth.context.sessionId }) }); } catch (error) { return payrollError(error); }
}
