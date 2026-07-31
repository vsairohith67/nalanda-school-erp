import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  replacePublishedReport,
  ReportPublicationError,
  withdrawPublishedReport
} from "@/lib/report-publication";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CORRECT_ISSUED_REPORT_CARDS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const body = await request.json();
    const action = String(body.action ?? "").toLowerCase();
    if (action === "withdraw") {
      return NextResponse.json({
        result: await withdrawPublishedReport(prisma, body, auth.user)
      });
    }
    if (action === "replace") {
      return NextResponse.json({
        result: await replacePublishedReport(prisma, body, auth.user)
      });
    }
    throw new ReportPublicationError("Choose withdrawal or replacement.");
  } catch (error) {
    if (error instanceof ReportPublicationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to update publication." },
      { status: 400 }
    );
  }
}
