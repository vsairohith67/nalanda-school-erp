import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { budgetDetailInclude, buildBudgetMetrics, newBudgetNumber, serializeBudget, validateActiveBudgetMasters, validateBudgetPlanInput } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_BUDGETS"); if (auth.response) return auth.response;
  try {
    const academicYear = request.nextUrl.searchParams.get("academicYear") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const plans = await prisma.budgetPlan.findMany({ where: { ...(academicYear ? { academicYear } : {}), ...(status ? { status } : {}) }, include: budgetDetailInclude, orderBy: [{ academicYear: "desc" }, { createdAt: "desc" }] });
    const years = [...new Set(plans.map((plan) => plan.academicYear))];
    const expenses = years.length ? await prisma.expenseRecord.findMany({ where: { academicYear: { in: years }, approvalStatus: "APPROVED" }, select: { academicYear: true, categoryId: true, departmentId: true, netAmount: true, payments: { select: { amount: true } } } }) : [];
    return NextResponse.json({ budgets: plans.map((plan) => serializeBudget(plan, buildBudgetMetrics(plan, expenses.filter((row) => row.academicYear === plan.academicYear)))) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to list budgets") }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_BUDGETS"); if (auth.response) return auth.response;
  try {
    const data = validateBudgetPlanInput(await request.json());
    const plan = await prisma.$transaction(async (tx) => {
      await validateActiveBudgetMasters(tx, data.allocations);
      return tx.budgetPlan.create({ data: { budgetNumber: newBudgetNumber(), academicYear: data.academicYear, title: data.title, description: data.description, totalAllocatedAmount: data.totalAllocatedAmount, warningThresholdPercent: data.warningThresholdPercent, criticalThresholdPercent: data.criticalThresholdPercent, effectiveFrom: data.effectiveFrom, effectiveTo: data.effectiveTo, createdByUserId: auth.user.id, allocations: { create: data.allocations } }, include: budgetDetailInclude });
    });
    return NextResponse.json({ budget: serializeBudget(plan) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create budget") }, { status: 400 }); }
}
