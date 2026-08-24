import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createReportPdfJob,
  listReportPdfJobs
} from "@/lib/report-pdf-jobs";
import { ReportPublicationError } from "@/lib/report-publication";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_REPORT_CARD_REPORTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({ jobs: listReportPdfJobs(auth.user) });
  } catch (error) {
    return pdfError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_REPORT_CARD_REPORTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({
      job: await createReportPdfJob(prisma, await request.json(), auth.user)
    }, { status: 202 });
  } catch (error) {
    return pdfError(error);
  }
}

function pdfError(error: unknown) {
  if (error instanceof ReportPublicationError) {
    const response = NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error.status === 429 || error.status === 503) response.headers.set("Retry-After", "5");
    return response;
  }
  return NextResponse.json(
    { error: "Unable to manage the PDF job." },
    { status: 400 }
  );
}
