import { NextRequest, NextResponse } from "next/server";
import { academicReportBody, academicReportError, requireAcademicReportAccess } from "@/lib/academic-reporting-api";
import { AcademicReportingError, academicReportCsv, deterministicAcademicReportFilename, getAcademicReportRun, recordAcademicReportExport } from "@/lib/academic-reporting";
import { renderAcademicReportPdf } from "@/lib/academic-report-pdf";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runKey: string }> }) {
  const auth = await requireAcademicReportAccess();
  if (auth.response || !auth.context) return auth.response;
  try {
    const body = await academicReportBody(request), format = String(body.format ?? "").toUpperCase(), mode = String(body.mode ?? "MONOCHROME").toUpperCase();
    if (format !== "CSV" && format !== "PDF") throw new AcademicReportingError("Unsupported export format.", 400, "EXPORT_FORMAT_INVALID");
    if (mode !== "COLOUR" && mode !== "MONOCHROME") throw new AcademicReportingError("Unsupported print mode.", 400, "PRINT_MODE_INVALID");
    const run = await getAcademicReportRun(prisma, (await params).runKey, auth.context.user);
    const bytes = format === "CSV" ? Buffer.from(academicReportCsv(run.summary), "utf8") : await renderAcademicReportPdf(run.summary, mode);
    await recordAcademicReportExport(prisma, run.id, auth.context.user, format, mode);
    const extension = format === "CSV" ? "csv" : "pdf", filename = deterministicAcademicReportFilename(run.runReference, run.summaryHash, extension);
    return new NextResponse(bytes, { headers: { "Content-Type": format === "CSV" ? "text/csv; charset=utf-8" : "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return academicReportError(error); }
}
