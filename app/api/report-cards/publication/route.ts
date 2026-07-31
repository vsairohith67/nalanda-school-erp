import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  publishReportCards,
  ReportPublicationError
} from "@/lib/report-publication";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("ISSUE_REPORT_CARDS");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({
      result: await publishReportCards(prisma, await request.json(), auth.user)
    });
  } catch (error) {
    return publicationError(error);
  }
}

function publicationError(error: unknown) {
  if (error instanceof ReportPublicationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: "Unable to publish report cards." },
    { status: 400 }
  );
}
