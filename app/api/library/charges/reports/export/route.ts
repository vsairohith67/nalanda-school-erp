import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  FINANCE_EXPORT_ROW_LIMIT,
  parseFinanceDateRange,
  privateFinanceJson
} from "@/lib/finance-privacy";
import {
  LIBRARY_CHARGE_REPORT_TYPES,
  libraryChargeReportCsv,
  libraryChargeReportFilename,
  loadLibraryChargeReports
} from "@/lib/library-charge-reports";
import { prisma } from "@/lib/prisma";

const FIELDS = {
  charges: ["Charge Number", "Borrower", "Member Type", "Class or Staff Type", "Charge Type", "Status", "Assessed Date", "Original Amount", "Waived Amount", "Payable Amount", "Loan Number", "Incident Number", "Receipt Number", "Receipt Status", "Reconciliation Warning"],
  incidents: ["Incident Number", "Type", "Status", "Borrower", "Member Type", "Title Code", "Title", "Accession", "Reported Date", "Resolution", "Replacement Accession", "Linked Charges"],
  "overdue-unassessed": ["Loan Number", "Borrower", "Member Type", "Title", "Accession", "Due Date", "Overdue Days"],
  "receipt-reconciliation": ["Charge Number", "Borrower", "Member Type", "Class or Staff Type", "Charge Type", "Status", "Assessed Date", "Original Amount", "Waived Amount", "Payable Amount", "Loan Number", "Incident Number", "Receipt Number", "Receipt Status", "Reconciliation Warning"]
} as const;

type ReportType = keyof typeof FIELDS;

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_LIBRARY_CHARGE_REPORTS");
  if (auth.response) return auth.response;
  try {
    const rawType = request.nextUrl.searchParams.get("type") ?? "charges";
    if (!LIBRARY_CHARGE_REPORT_TYPES.includes(rawType as ReportType)) {
      return privateFinanceJson({ error: "Unsupported report type" }, { status: 400 });
    }
    const type = rawType as ReportType;
    const range = parseFinanceDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );
    const report = await loadLibraryChargeReports(prisma, false);
    const inRange = (value: string) => value >= range.from && value <= range.to;
    const filtered = {
      ...report,
      charges: report.charges.filter((row) => inRange(row.assessedDate)),
      incidents: report.incidents.filter((row) => inRange(row.reportedDate)),
      overdueUnassessed: report.overdueUnassessed.filter((row) => inRange(row.dueDate))
    };
    const rows = type === "incidents"
      ? filtered.incidents
      : type === "overdue-unassessed"
        ? filtered.overdueUnassessed
        : type === "receipt-reconciliation"
          ? filtered.charges.filter((row) => row.receiptNumber || row.status === "PAID")
          : filtered.charges;
    if (rows.length > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} rows. Narrow the date range.` },
        { status: 409 }
      );
    }
    const filename = libraryChargeReportFilename(
      `${type}-${range.from}-to-${range.to}`
    );
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: `library-${type}`,
      purpose: `Library ${type.replaceAll("-", " ")} reconciliation`,
      rowCount: rows.length,
      fields: [...FIELDS[type]],
      scope: `${range.from}-to-${range.to}`,
      filename,
      from: range.from,
      to: range.to,
      csv: libraryChargeReportCsv(filtered, type)
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "Unable to export library charge report") },
      { status: 400 }
    );
  }
}
