import { NextRequest } from "next/server";
import { createSalaryAdvance, loadPayrollWorkspace } from "@/lib/payroll";
import { payrollBody, payrollError, payrollJson, requirePayrollAny } from "@/lib/payroll-api";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const auth = await requirePayrollAny(["VIEW_OWN_PAYROLL"]);
  if (auth.response || !auth.user) return auth.response;
  try { return payrollJson(await loadPayrollWorkspace(prisma, { ownUserId: auth.user.id })); } catch (error) { return payrollError(error); }
}
export async function POST(request: NextRequest) {
  const auth = await requirePayrollAny(["REQUEST_SALARY_ADVANCE"]);
  if (auth.response || !auth.user || !auth.context) return auth.response;
  try { return payrollJson({ advance: await createSalaryAdvance(prisma, await payrollBody(request), { user: auth.user, sessionId: auth.context.sessionId }, auth.user.id) }, 201); } catch (error) { return payrollError(error); }
}
