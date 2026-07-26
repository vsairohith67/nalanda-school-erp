import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  FINANCE_EXPORT_ROW_LIMIT,
  parseFinanceDateRange,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { miscIncomeCsv } from "@/lib/misc-income";
import { prisma } from "@/lib/prisma";

const FIELDS = [
  "Receipt Number", "Date", "Status", "Student", "Admission Number", "Payer",
  "Payment Method", "Received Account", "Items", "Gross", "Discount", "Net"
];

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_MISC_INCOME_REPORTS");
  if (auth.response) return auth.response;
  try {
    const range = parseFinanceDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );
    const rows = await prisma.miscIncomeReceipt.findMany({
      where: { receiptDate: range.where },
      select: {
        receiptNumber: true,
        receiptDate: true,
        status: true,
        payerName: true,
        paymentMethod: true,
        receivedAccount: true,
        grossAmount: true,
        discountAmount: true,
        netAmount: true,
        student: { select: { studentName: true, admissionNo: true } },
        lines: { select: { itemNameSnapshot: true } }
      },
      orderBy: [{ receiptDate: "asc" }, { receiptNumber: "asc" }],
      take: FINANCE_EXPORT_ROW_LIMIT + 1
    });
    if (rows.length > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} rows. Narrow the date range.` },
        { status: 409 }
      );
    }
    const filename = `miscellaneous-income-${range.from}-to-${range.to}.csv`;
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: "misc-income",
      purpose: "Miscellaneous income reconciliation",
      rowCount: rows.length,
      fields: FIELDS,
      scope: `${range.from}-to-${range.to}`,
      filename,
      from: range.from,
      to: range.to,
      csv: miscIncomeCsv(rows)
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "Unable to export miscellaneous income report") },
      { status: 400 }
    );
  }
}
