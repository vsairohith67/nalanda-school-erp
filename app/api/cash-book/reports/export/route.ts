import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import {
  calculateCashSources,
  cashBookCsv,
  effectiveCashSources,
  hasSourceDrift
} from "@/lib/cash-book";
import { safeClientError } from "@/lib/client-errors";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  FINANCE_EXPORT_ROW_LIMIT,
  parseFinanceDateRange,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

const FIELDS = [
  "Date", "Status", "Opening", "Fee Cash", "Miscellaneous Cash", "Book-sale Cash",
  "Manual Inflow", "Cash Expenses", "Manual Outflow",
  "Deposited to School Current Account", "Handed to Director Sir", "Expected Closing",
  "Counted Closing", "Variance", "Source Drift"
];

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_CASH_BOOK_REPORTS");
  if (auth.response) return auth.response;
  try {
    const range = parseFinanceDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );
    const rows = await prisma.cashBookDay.findMany({
      where: { cashDate: range.where },
      orderBy: { cashDate: "asc" },
      take: FINANCE_EXPORT_ROW_LIMIT + 1
    });
    if (rows.length > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} rows. Narrow the date range.` },
        { status: 409 }
      );
    }
    const data = await Promise.all(rows.map(async (row) => {
      const live = await calculateCashSources(prisma, row.cashDate, row.openingBalance, row.id);
      return {
        ...row,
        reportSources: effectiveCashSources(row, live),
        sourceDrift: row.status !== "DRAFT" && hasSourceDrift(row.sourceSummarySnapshot, live)
      };
    }));
    const filename = `cash-book-${range.from}-to-${range.to}.csv`;
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: "cash-book",
      purpose: "Cash-book source and closing-balance reconciliation",
      rowCount: data.length,
      fields: FIELDS,
      scope: `${range.from}-to-${range.to}`,
      filename,
      from: range.from,
      to: range.to,
      csv: cashBookCsv(data)
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "Unable to export cash-book report") },
      { status: 400 }
    );
  }
}
