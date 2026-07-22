import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { LIBRARY_REPORT_TYPES, libraryReportCsv, libraryReportFilename, loadLibraryReports, type LibraryReportType } from "@/lib/library-reports";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("EXPORT_LIBRARY_REPORTS"); if (auth.response) return auth.response; const type = (request.nextUrl.searchParams.get("type") ?? "accession-register") as LibraryReportType; if (!LIBRARY_REPORT_TYPES.includes(type)) return NextResponse.json({ error: "Unsupported library report" }, { status: 400 }); const report = await loadLibraryReports(prisma); return new NextResponse(libraryReportCsv(report, type), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=${libraryReportFilename(type)}` } }); }
