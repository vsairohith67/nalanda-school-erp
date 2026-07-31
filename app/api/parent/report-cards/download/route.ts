import { NextRequest, NextResponse } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveParentReportToken } from "@/lib/report-parent-delivery";
import {
  deterministicReportPdfName,
  renderReportPdf
} from "@/lib/report-pdf";
import { ReportPublicationError } from "@/lib/report-publication";

export async function GET(request: NextRequest) {
  const auth = await requireApiRolePermission("VIEW_OWN_REPORT_CARDS", "PARENT");
  if (auth.response || !auth.user) return auth.response;
  try {
    const access = await resolveParentReportToken(
      prisma,
      request.nextUrl.searchParams.get("token"),
      auth.user,
      "DOWNLOAD"
    );
    const pdf = await renderReportPdf(access.snapshot, access.mode);
    const fileName = deterministicReportPdfName(access.snapshot, access.mode);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof ReportPublicationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to download the issued report." }, { status: 400 });
  }
}
