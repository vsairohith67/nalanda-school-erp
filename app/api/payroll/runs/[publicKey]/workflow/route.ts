import { NextRequest } from "next/server";
import { payrollRunWorkflow } from "@/lib/payroll";
import { payrollBody, payrollError, payrollJson, requirePayrollAny } from "@/lib/payroll-api";
import { prisma } from "@/lib/prisma";
import type { CanonicalPermission } from "@/lib/permissions";
const permissions: Record<string, CanonicalPermission> = { SUBMIT: "SUBMIT_PAYROLL", APPROVE: "APPROVE_PAYROLL", LOCK: "LOCK_PAYROLL", ISSUE: "ISSUE_PAYSLIPS", ISSUE_PAYSLIPS: "ISSUE_PAYSLIPS", REVERSE: "REVERSE_PAYROLL", CREATE_CORRECTION: "REVERSE_PAYROLL" };
export async function POST(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) {
  try {
    const body = await payrollBody(request), action = String(body.action ?? "").trim().toUpperCase(), permission = permissions[action];
    if (!permission) return payrollJson({ error: "Unknown payroll workflow action." }, 400);
    const auth = await requirePayrollAny([permission]);
    if (auth.response || !auth.user || !auth.context) return auth.response;
    return payrollJson({ run: await payrollRunWorkflow(prisma, (await context.params).publicKey, { ...body, action: action === "ISSUE" ? "ISSUE_PAYSLIPS" : action }, { user: auth.user, sessionId: auth.context.sessionId }) });
  } catch (error) { return payrollError(error); }
}
