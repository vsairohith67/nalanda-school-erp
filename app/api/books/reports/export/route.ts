import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { bookSettlementCsv } from "@/lib/book-cash-settlement";
import { bookSalesCsv } from "@/lib/books-finance";
import { safeClientError } from "@/lib/client-errors";
import { csvCell } from "@/lib/expenses";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  FINANCE_EXPORT_ROW_LIMIT,
  parseFinanceDateRange,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

const BOOK_EXPORTS = {
  sales: {
    purpose: "Book-sale receipt reconciliation",
    fields: ["Book Receipt Number", "Date", "Academic Year", "Status", "Student", "Admission Number", "Payer", "Items", "Classes", "Publishers", "Payment Method", "Received Account", "Gross", "Discount", "Net"]
  },
  settlements: {
    purpose: "Book-cash settlement reconciliation",
    fields: ["Date", "Academic Year", "Status", "Expected Book Cash", "Handed to Director Sir", "Handed to Cash Counter", "Retained by Books In-charge", "Variance", "Source Drift"]
  },
  publishers: {
    purpose: "Publisher bill reconciliation",
    fields: ["Expense Number", "Academic Year", "Publisher", "Invoice Number", "Invoice Date", "Approval Status", "Payment Status", "Invoice Total", "Paid", "Outstanding"]
  }
} as const;

type BookExportKind = keyof typeof BOOK_EXPORTS;

function publisherCsv(rows: Array<{
  expenseNumber: string;
  academicYear: string;
  vendor: { name: string } | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  approvalStatus: string;
  paymentStatus: string;
  netAmount: Prisma.Decimal;
  payments: Array<{ amount: Prisma.Decimal }>;
}>) {
  const headers = [...BOOK_EXPORTS.publishers.fields];
  return [
    headers,
    ...rows.map((row) => {
      const paid = row.payments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Prisma.Decimal(0)
      );
      return [
        row.expenseNumber,
        row.academicYear,
        row.vendor?.name ?? "",
        row.invoiceNumber ?? "",
        row.invoiceDate?.toISOString().slice(0, 10) ?? "",
        row.approvalStatus,
        row.paymentStatus,
        row.netAmount.toFixed(2),
        paid.toFixed(2),
        row.netAmount.sub(paid).toFixed(2)
      ];
    })
  ].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_BOOK_REPORTS");
  if (auth.response) return auth.response;
  try {
    const rawKind = request.nextUrl.searchParams.get("kind") ?? "sales";
    if (!(rawKind in BOOK_EXPORTS)) {
      return privateFinanceJson({ error: "Unsupported book export type" }, { status: 400 });
    }
    const kind = rawKind as BookExportKind;
    const range = parseFinanceDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );
    let csv: string;
    let rowCount: number;

    if (kind === "settlements") {
      const rows = await prisma.bookCashSettlement.findMany({
        where: { settlementDate: range.where },
        select: {
          settlementDate: true,
          academicYear: true,
          status: true,
          expectedBookCash: true,
          handedToDirectorAmount: true,
          handedToCashCounterAmount: true,
          retainedByBooksInchargeAmount: true,
          varianceAmount: true
        },
        orderBy: { settlementDate: "asc" },
        take: FINANCE_EXPORT_ROW_LIMIT + 1
      });
      rowCount = rows.length;
      csv = bookSettlementCsv(rows.map((row) => ({ ...row, sourceDrift: false })));
    } else if (kind === "publishers") {
      const rows = await prisma.expenseRecord.findMany({
        where: {
          category: { code: "BOOKS" },
          expenseDate: range.where
        },
        select: {
          expenseNumber: true,
          academicYear: true,
          vendor: { select: { name: true } },
          invoiceNumber: true,
          invoiceDate: true,
          approvalStatus: true,
          paymentStatus: true,
          netAmount: true,
          payments: { select: { amount: true } }
        },
        orderBy: [{ expenseDate: "asc" }, { expenseNumber: "asc" }],
        take: FINANCE_EXPORT_ROW_LIMIT + 1
      });
      rowCount = rows.length;
      csv = publisherCsv(rows);
    } else {
      const rows = await prisma.bookSaleReceipt.findMany({
        where: { receiptDate: range.where },
        select: {
          receiptNumber: true,
          receiptDate: true,
          academicYear: true,
          status: true,
          payerName: true,
          paymentMethod: true,
          receivedAccount: true,
          grossAmount: true,
          discountAmount: true,
          netAmount: true,
          student: { select: { studentName: true, admissionNo: true } },
          lines: {
            select: {
              itemCodeSnapshot: true,
              itemTitleSnapshot: true,
              classNameSnapshot: true,
              publisherNameSnapshot: true
            }
          }
        },
        orderBy: [{ receiptDate: "asc" }, { receiptNumber: "asc" }],
        take: FINANCE_EXPORT_ROW_LIMIT + 1
      });
      rowCount = rows.length;
      csv = bookSalesCsv(rows);
    }

    if (rowCount > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} rows. Narrow the date range.` },
        { status: 409 }
      );
    }
    const filename = `book-${kind}-${range.from}-to-${range.to}.csv`;
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: `books-${kind}`,
      purpose: BOOK_EXPORTS[kind].purpose,
      rowCount,
      fields: [...BOOK_EXPORTS[kind].fields],
      scope: `${range.from}-to-${range.to}`,
      filename,
      from: range.from,
      to: range.to,
      csv
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "Unable to export book-finance report") },
      { status: 400 }
    );
  }
}
