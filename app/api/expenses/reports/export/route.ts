import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { expenseCsv, localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_EXPENSE_REPORTS"); if (auth.response) return auth.response;
  try {
    const from = request.nextUrl.searchParams.get("from"); const to = request.nextUrl.searchParams.get("to");
    const rows = await prisma.expenseRecord.findMany({ where: from || to ? { expenseDate: { ...(from ? { gte: localDate(from) } : {}), ...(to ? { lt: new Date(localDate(to).getTime() + 86_400_000) } : {}) } } : {}, include: { vendor: { select: { name: true } }, category: { select: { name: true } }, department: { select: { name: true } } }, orderBy: [{ expenseDate: "desc" }, { expenseNumber: "asc" }], take: 10_000 });
    const csv = expenseCsv(rows.map((row) => ({ expenseNumber: row.expenseNumber, expenseDate: row.expenseDate.toISOString().slice(0, 10), academicYear: row.academicYear, vendor: row.vendor?.name ?? "", category: row.category.name, department: row.department?.name ?? "", description: row.description, grossAmount: row.grossAmount.toString(), taxAmount: row.taxAmount.toString(), deductionAmount: row.deductionAmount.toString(), netAmount: row.netAmount.toString(), approvalStatus: row.approvalStatus, paymentStatus: row.paymentStatus, paymentMethod: row.paymentMethod })));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="expense-report-${new Date().toISOString().slice(0, 10)}.csv"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to export expense report") }, { status: 400 }); }
}
