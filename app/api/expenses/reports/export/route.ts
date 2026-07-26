import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  FINANCE_EXPORT_ROW_LIMIT,
  parseFinanceDateRange,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { expenseCsv } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

const FIELDS = [
  "Expense Number", "Date", "Academic Year", "Vendor", "Category", "Department",
  "Description", "Gross", "Tax", "Deduction", "Net", "Approval Status",
  "Payment Status", "Payment Method"
];

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_EXPENSE_REPORTS");
  if (auth.response) return auth.response;
  try {
    const range = parseFinanceDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );
    const rows = await prisma.expenseRecord.findMany({
      where: { expenseDate: range.where },
      select: {
        expenseNumber: true,
        expenseDate: true,
        academicYear: true,
        vendor: { select: { name: true } },
        category: { select: { name: true } },
        department: { select: { name: true } },
        description: true,
        grossAmount: true,
        taxAmount: true,
        deductionAmount: true,
        netAmount: true,
        approvalStatus: true,
        paymentStatus: true,
        paymentMethod: true
      },
      orderBy: [{ expenseDate: "desc" }, { expenseNumber: "asc" }],
      take: FINANCE_EXPORT_ROW_LIMIT + 1
    });
    if (rows.length > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} rows. Narrow the date range.` },
        { status: 409 }
      );
    }
    const filename = `expense-report-${range.from}-to-${range.to}.csv`;
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: "expenses",
      purpose: "Expense reconciliation",
      rowCount: rows.length,
      fields: FIELDS,
      scope: `${range.from}-to-${range.to}`,
      filename,
      from: range.from,
      to: range.to,
      csv: expenseCsv(rows.map((row) => ({
        expenseNumber: row.expenseNumber,
        expenseDate: row.expenseDate.toISOString().slice(0, 10),
        academicYear: row.academicYear,
        vendor: row.vendor?.name ?? "",
        category: row.category.name,
        department: row.department?.name ?? "",
        description: row.description,
        grossAmount: row.grossAmount.toString(),
        taxAmount: row.taxAmount.toString(),
        deductionAmount: row.deductionAmount.toString(),
        netAmount: row.netAmount.toString(),
        approvalStatus: row.approvalStatus,
        paymentStatus: row.paymentStatus,
        paymentMethod: row.paymentMethod
      })))
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "Unable to export expense report") },
      { status: 400 }
    );
  }
}
