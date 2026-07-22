import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { LIBRARY_CHARGE_REPORT_TYPES, libraryChargeReportCsv, libraryChargeReportFilename, loadLibraryChargeReports } from "@/lib/library-charge-reports";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("EXPORT_LIBRARY_CHARGE_REPORTS"); if (auth.response) return auth.response; try { const type = request.nextUrl.searchParams.get("type") ?? "charges"; if (!LIBRARY_CHARGE_REPORT_TYPES.includes(type as any)) throw new Error("Unsupported report type"); const csv = libraryChargeReportCsv(await loadLibraryChargeReports(prisma, false), type as any); return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${libraryChargeReportFilename(type)}"` } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to export report") }, { status: 400 }); } }
