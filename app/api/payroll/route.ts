import { NextRequest } from "next/server";
import { assignCompensation, createPayrollPeriod, createSalaryAdvance, createSalaryStructureVersion, endPayrollEligibility, loadPayrollWorkspace, preparePayrollRun, reviseCompensation } from "@/lib/payroll";
import { payrollBody, payrollError, payrollJson, requirePayrollAny } from "@/lib/payroll-api";
import { prisma } from "@/lib/prisma";
import type { CanonicalPermission } from "@/lib/permissions";

const actionPermission: Record<string, CanonicalPermission> = {
  CREATE_STRUCTURE: "MANAGE_SALARY_STRUCTURES",
  ASSIGN_COMPENSATION: "ASSIGN_COMPENSATION",
  REVISE_COMPENSATION: "ASSIGN_COMPENSATION",
  END_ELIGIBILITY: "ASSIGN_COMPENSATION",
  CREATE_PERIOD: "MANAGE_PAYROLL_INPUTS",
  PREPARE_RUN: "MANAGE_PAYROLL_INPUTS",
  CREATE_ADVANCE: "MANAGE_SALARY_ADVANCES"
};

export async function GET() {
  const auth = await requirePayrollAny(["VIEW_PAYROLL"]);
  if (auth.response) return auth.response;
  try { return payrollJson(await loadPayrollWorkspace(prisma)); } catch (error) { return payrollError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await payrollBody(request);
    const action = String(body.action ?? "").trim().toUpperCase();
    const permission = actionPermission[action];
    if (!permission) return payrollJson({ error: "Unknown payroll action." }, 400);
    const auth = await requirePayrollAny([permission]);
    if (auth.response || !auth.user || !auth.context) return auth.response;
    const actor = { user: auth.user, sessionId: auth.context.sessionId };
    const result = action === "CREATE_STRUCTURE" ? await createSalaryStructureVersion(prisma, body, actor)
      : action === "ASSIGN_COMPENSATION" ? await assignCompensation(prisma, body, actor)
      : action === "REVISE_COMPENSATION" ? await reviseCompensation(prisma, body, actor)
      : action === "END_ELIGIBILITY" ? await endPayrollEligibility(prisma, body, actor)
      : action === "CREATE_PERIOD" ? await createPayrollPeriod(prisma, body, actor)
      : action === "PREPARE_RUN" ? await preparePayrollRun(prisma, body, actor)
      : await createSalaryAdvance(prisma, body, actor);
    return payrollJson({ result }, 201);
  } catch (error) { return payrollError(error); }
}
