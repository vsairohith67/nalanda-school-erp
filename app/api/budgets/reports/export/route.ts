import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { budgetCsv, budgetDetailInclude, getBudgetMetrics } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_BUDGET_REPORTS"); if (auth.response) return auth.response;
  const planId = request.nextUrl.searchParams.get("planId"); const academicYear = request.nextUrl.searchParams.get("academicYear");
  const plan = await prisma.budgetPlan.findFirst({ where: { ...(planId ? { id: planId } : {}), ...(!planId && academicYear ? { academicYear } : {}), status: { in: ["APPROVED", "LOCKED"] } }, include: budgetDetailInclude, orderBy: { approvedAt: "desc" } });
  if (!plan) return NextResponse.json({ error: "No approved or locked budget found" }, { status: 404 });
  const metrics = await getBudgetMetrics(prisma, plan);
  const csv = budgetCsv(metrics.allocations.map((row) => ({ "Budget Number": plan.budgetNumber, "Academic Year": plan.academicYear, Category: row.category?.name ?? "All categories", Department: row.department?.name ?? "All departments", Allocated: row.allocated.toFixed(2), Committed: row.committed.toFixed(2), "Paid Actual": row.paid.toFixed(2), Utilized: row.utilized.toFixed(2), Available: row.available.toFixed(2), "Utilization Percent": row.utilizationPercent == null ? "" : row.utilizationPercent.toFixed(2), Threshold: row.thresholdState, "Over Budget": row.overBudget.toFixed(2) })));
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="budget-report-${plan.academicYear}.csv"`, "Cache-Control": "no-store" } });
}
