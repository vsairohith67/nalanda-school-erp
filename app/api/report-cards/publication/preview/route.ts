import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  previewReportPublication,
  ReportPublicationError
} from "@/lib/report-publication";
import {
  deterministicReportPdfName,
  renderReportPdf
} from "@/lib/report-pdf";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_REPORT_CARDS");
  if (auth.response || !auth.user) return auth.response;
  if (!["PRINCIPAL", "DIRECTOR", "SUPER_ADMIN"].includes(auth.user.role)) {
    return NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const preview = await previewReportPublication(prisma, body, auth.user);
    if (String(body.output ?? "JSON").toUpperCase() === "PDF") {
      const exportAuth = await requireApiPermission("EXPORT_REPORT_CARD_REPORTS");
      if (exportAuth.response) return exportAuth.response;
      const mode = String(body.mode ?? "COLOUR").toUpperCase() === "MONOCHROME"
        ? "MONOCHROME"
        : "COLOUR";
      const report = preview.reports[0];
      const pdf = await renderReportPdf(report, mode);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${deterministicReportPdfName(report, mode)}"`,
          "X-Download-Name": deterministicReportPdfName(report, mode),
          "Cache-Control": "private, no-store"
        }
      });
    }
    const { internalReports: _internalReports, ...safePreview } = preview;
    return NextResponse.json({ preview: safePreview });
  } catch (error) {
    return publicationError(error);
  }
}

function publicationError(error: unknown) {
  if (error instanceof ReportPublicationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: "Unable to prepare publication preview." },
    { status: 400 }
  );
}
