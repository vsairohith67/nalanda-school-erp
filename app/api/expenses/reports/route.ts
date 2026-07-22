import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { buildExpenseReports, localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_EXPENSE_REPORTS"); if (auth.response) return auth.response;
  try {
    const from = request.nextUrl.searchParams.get("from"); const to = request.nextUrl.searchParams.get("to");
    const rows = await prisma.expenseRecord.findMany({ where: from || to ? { expenseDate: { ...(from ? { gte: localDate(from) } : {}), ...(to ? { lt: new Date(localDate(to).getTime() + 86_400_000) } : {}) } } : {}, select: { expenseNumber: true, expenseDate: true, academicYear: true, vendor: { select: { name: true } }, category: { select: { name: true } }, department: { select: { name: true } }, description: true, grossAmount: true, taxAmount: true, deductionAmount: true, netAmount: true, approvalStatus: true, paymentStatus: true, paymentMethod: true }, orderBy: { expenseDate: "desc" }, take: 10_000 });
    return NextResponse.json({ reports: buildExpenseReports(rows), rows: rows.map((row) => ({ ...row, grossAmount: row.grossAmount.toString(), taxAmount: row.taxAmount.toString(), deductionAmount: row.deductionAmount.toString(), netAmount: row.netAmount.toString() })) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to build expense reports") }, { status: 400 }); }
}
