import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { budgetCsv, budgetDetailInclude, getBudgetMetrics } from "@/lib/budgets";
import { safeClientError } from "@/lib/client-errors";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  FINANCE_EXPORT_ROW_LIMIT,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

const FIELDS = [
  "Budget Number", "Academic Year", "Category", "Department", "Allocated",
  "Committed", "Paid Actual", "Utilized", "Available", "Utilization Percent",
  "Threshold", "Over Budget"
];

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_BUDGET_REPORTS");
  if (auth.response) return auth.response;
  try {
    const planId = request.nextUrl.searchParams.get("planId");
    const academicYear = request.nextUrl.searchParams.get("academicYear");
    const plan = await prisma.budgetPlan.findFirst({
      where: {
        ...(planId ? { id: planId } : {}),
        ...(!planId && academicYear ? { academicYear } : {}),
        status: { in: ["APPROVED", "LOCKED"] }
      },
      include: budgetDetailInclude,
      orderBy: { approvedAt: "desc" }
    });
    if (!plan) {
      return privateFinanceJson(
        { error: "No approved or locked budget found" },
        { status: 404 }
      );
    }
    const metrics = await getBudgetMetrics(prisma, plan);
    if (metrics.allocations.length > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} allocation rows.` },
        { status: 409 }
      );
    }
    const rows = metrics.allocations.map((row) => ({
      "Budget Number": plan.budgetNumber,
      "Academic Year": plan.academicYear,
      Category: row.category?.name ?? "All categories",
      Department: row.department?.name ?? "All departments",
      Allocated: row.allocated.toFixed(2),
      Committed: row.committed.toFixed(2),
      "Paid Actual": row.paid.toFixed(2),
      Utilized: row.utilized.toFixed(2),
      Available: row.available.toFixed(2),
      "Utilization Percent": row.utilizationPercent == null ? "" : row.utilizationPercent.toFixed(2),
      Threshold: row.thresholdState,
      "Over Budget": row.overBudget.toFixed(2)
    }));
    const safeYear = plan.academicYear.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40);
    const filename = `budget-report-${safeYear}.csv`;
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: "budget",
      purpose: "Approved budget allocation and utilization reconciliation",
      rowCount: rows.length,
      fields: FIELDS,
      scope: plan.academicYear,
      filename,
      csv: budgetCsv(rows)
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "Unable to export budget report") },
      { status: 400 }
    );
  }
}
