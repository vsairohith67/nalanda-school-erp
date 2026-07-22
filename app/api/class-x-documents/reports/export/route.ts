import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { schoolDateKey } from "@/lib/format";
import { CLASS_X_REPORT_ROW_LIMIT, classXPackageCsv } from "@/lib/class-x-package-reports";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_CLASS_X_PACKAGE_REPORTS"); if (auth.response) return auth.response;
  const rows = await prisma.classXDocumentPackage.findMany({ include: { student: { select: { studentName: true, admissionNo: true } }, charge: { select: { status: true } } }, orderBy: { createdAt: "desc" }, take: CLASS_X_REPORT_ROW_LIMIT });
  return new NextResponse(classXPackageCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="class-x-package-report-${schoolDateKey()}.csv"`, "X-Result-Limit": String(CLASS_X_REPORT_ROW_LIMIT) } });
}
