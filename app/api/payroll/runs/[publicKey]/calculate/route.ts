import { NextRequest } from "next/server";
import { calculatePayrollRun } from "@/lib/payroll";
import { payrollBody, payrollError, payrollJson, requirePayrollAny } from "@/lib/payroll-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) {
  const auth = await requirePayrollAny(["CALCULATE_PAYROLL"]);
  if (auth.response || !auth.user || !auth.context) return auth.response;
  try { return payrollJson({ run: await calculatePayrollRun(prisma, (await context.params).publicKey, await payrollBody(request), { user: auth.user, sessionId: auth.context.sessionId }) }); } catch (error) { return payrollError(error); }
}
