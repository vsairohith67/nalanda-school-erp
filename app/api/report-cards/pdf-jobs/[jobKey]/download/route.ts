import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { resolveReportPdfJobDownload } from "@/lib/report-pdf-jobs";
import { ReportPublicationError } from "@/lib/report-publication";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobKey: string }> }
) {
  const auth = await requireApiPermission("EXPORT_REPORT_CARD_REPORTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const artifact = resolveReportPdfJobDownload(
      (await params).jobKey,
      request.nextUrl.searchParams.get("token"),
      auth.user
    );
    return new NextResponse(new Uint8Array(artifact.bytes), {
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof ReportPublicationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to download PDF artifact." }, { status: 400 });
  }
}
