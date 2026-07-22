import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { budgetDetailInclude, getBudgetMetrics, serializeBudget } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_BUDGET_REPORTS"); if (auth.response) return auth.response;
  const planId = request.nextUrl.searchParams.get("planId"); const academicYear = request.nextUrl.searchParams.get("academicYear");
  const plan = await prisma.budgetPlan.findFirst({ where: { ...(planId ? { id: planId } : {}), ...(!planId && academicYear ? { academicYear } : {}), status: { in: ["APPROVED", "LOCKED"] } }, include: budgetDetailInclude, orderBy: { approvedAt: "desc" } });
  if (!plan) return NextResponse.json({ budget: null });
  return NextResponse.json({ budget: serializeBudget(plan, await getBudgetMetrics(prisma, plan)) });
}
