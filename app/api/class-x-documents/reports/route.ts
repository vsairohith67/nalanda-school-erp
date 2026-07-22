import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { CLASS_X_REPORT_ROW_LIMIT, classXPackageReport } from "@/lib/class-x-package-reports";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_CLASS_X_PACKAGE_REPORTS"); if (auth.response) return auth.response;
  const rows = await prisma.classXDocumentPackage.findMany({ include: { items: true, charge: { include: { linkedMiscIncomeReceipt: true } } }, orderBy: { createdAt: "desc" }, take: CLASS_X_REPORT_ROW_LIMIT });
  return NextResponse.json({ report: classXPackageReport(rows), rowLimit: CLASS_X_REPORT_ROW_LIMIT });
}
