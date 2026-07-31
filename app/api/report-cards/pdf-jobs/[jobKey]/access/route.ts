import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizeReportPdfJobDownload } from "@/lib/report-pdf-jobs";
import { ReportPublicationError } from "@/lib/report-publication";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobKey: string }> }
) {
  const auth = await requireApiPermission("EXPORT_REPORT_CARD_REPORTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({
      access: await authorizeReportPdfJobDownload(prisma, (await params).jobKey, auth.user)
    });
  } catch (error) {
    if (error instanceof ReportPublicationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to authorize PDF download." }, { status: 400 });
  }
}
