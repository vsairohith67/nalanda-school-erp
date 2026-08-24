import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { CIRCULATION_REPORT_TYPES, circulationReportCsv, circulationReportFilename, loadCirculationReports, type CirculationReportType } from "@/lib/library-circulation-reports";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_LIBRARY_CIRCULATION_REPORTS");
  if (auth.response) return auth.response;
  const type = (request.nextUrl.searchParams.get("type") ?? "active-loans") as CirculationReportType;
  if (!CIRCULATION_REPORT_TYPES.includes(type)) return NextResponse.json({ error: "Unsupported circulation report" }, { status: 400 });
  const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? "7");
  if (!Number.isInteger(requestedDays) || requestedDays < 0 || requestedDays > 90) return NextResponse.json({ error: "days must be a whole number from 0 to 90" }, { status: 400 });
  const report = await loadCirculationReports(prisma, false, requestedDays);
  return new NextResponse(circulationReportCsv(report, type), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=${circulationReportFilename(type)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
