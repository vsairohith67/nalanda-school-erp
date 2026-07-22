import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { budgetDetailInclude, getBudgetMetrics, serializeBudget, validateActiveBudgetMasters, validateBudgetPlanInput } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_BUDGETS"); if (auth.response) return auth.response;
  const { id } = await params; const plan = await prisma.budgetPlan.findUnique({ where: { id }, include: budgetDetailInclude });
  if (!plan) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ budget: serializeBudget(plan, await getBudgetMetrics(prisma, plan)) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_BUDGETS"); if (auth.response) return auth.response;
  try {
    const { id } = await params; const data = validateBudgetPlanInput(await request.json());
    const plan = await prisma.$transaction(async (tx) => {
      await validateActiveBudgetMasters(tx, data.allocations);
      const claim = await tx.budgetPlan.updateMany({ where: { id, status: "DRAFT" }, data: { academicYear: data.academicYear, title: data.title, description: data.description, totalAllocatedAmount: data.totalAllocatedAmount, warningThresholdPercent: data.warningThresholdPercent, criticalThresholdPercent: data.criticalThresholdPercent, effectiveFrom: data.effectiveFrom, effectiveTo: data.effectiveTo } });
      if (claim.count !== 1) throw new Error("Only a draft budget can be edited");
      await tx.budgetAllocation.deleteMany({ where: { budgetPlanId: id } });
      await tx.budgetAllocation.createMany({ data: data.allocations.map((row) => ({ budgetPlanId: id, ...row })) });
      return tx.budgetPlan.findUniqueOrThrow({ where: { id }, include: budgetDetailInclude });
    });
    return NextResponse.json({ budget: serializeBudget(plan) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update budget") }, { status: 409 }); }
}
