import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import {
  CLASS_X_REPORT_ROW_LIMIT,
  classXPackageCsv
} from "@/lib/class-x-package-reports";
import { safeClientError } from "@/lib/client-errors";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  parseFinanceDateRange,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

const FIELDS = [
  "Package Number", "Academic Year", "Student Name", "Admission Number",
  "Request Source", "Package Status", "Payment Status", "Required Items",
  "Ready Items", "Handed Over Items", "Created Date", "Completed Date"
];

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_CLASS_X_PACKAGE_REPORTS");
  if (auth.response) return auth.response;
  try {
    const range = parseFinanceDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );
    const rows = await prisma.classXDocumentPackage.findMany({
      where: { createdAt: range.where },
      select: {
        packageNumber: true,
        academicYear: true,
        requestSource: true,
        status: true,
        totalRequiredItems: true,
        readyItems: true,
        handedOverItems: true,
        createdAt: true,
        completedAt: true,
        student: { select: { studentName: true, admissionNo: true } },
        charge: { select: { status: true } }
      },
      orderBy: [{ createdAt: "desc" }, { packageNumber: "asc" }],
      take: CLASS_X_REPORT_ROW_LIMIT + 1
    });
    if (rows.length > CLASS_X_REPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${CLASS_X_REPORT_ROW_LIMIT} rows. Narrow the date range.` },
        { status: 409 }
      );
    }
    const filename = `class-x-package-${range.from}-to-${range.to}.csv`;
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: "class-x-packages",
      purpose: "Class X document-package and linked charge reconciliation",
      rowCount: rows.length,
      fields: FIELDS,
      scope: `${range.from}-to-${range.to}`,
      filename,
      from: range.from,
      to: range.to,
      csv: classXPackageCsv(rows)
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "Unable to export Class X package report") },
      { status: 400 }
    );
  }
}
