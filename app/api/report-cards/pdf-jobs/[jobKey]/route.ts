import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getReportPdfJob,
  retryReportPdfJob
} from "@/lib/report-pdf-jobs";
import { ReportPublicationError } from "@/lib/report-publication";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobKey: string }> }
) {
  const auth = await requireApiPermission("EXPORT_REPORT_CARD_REPORTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({
      job: getReportPdfJob((await params).jobKey, auth.user)
    });
  } catch (error) {
    return pdfError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobKey: string }> }
) {
  const auth = await requireApiPermission("EXPORT_REPORT_CARD_REPORTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const body = await request.json();
    if (String(body.action ?? "").toLowerCase() !== "retry") {
      throw new ReportPublicationError("Choose retry for a failed PDF job.");
    }
    return NextResponse.json({
      job: await retryReportPdfJob(prisma, (await params).jobKey, auth.user)
    }, { status: 202 });
  } catch (error) {
    return pdfError(error);
  }
}

function pdfError(error: unknown) {
  if (error instanceof ReportPublicationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: "Unable to manage the PDF job." },
    { status: 400 }
  );
}
