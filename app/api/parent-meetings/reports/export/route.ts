import { NextRequest, NextResponse } from "next/server";
import { exportParentMeetingReportCsv } from "@/lib/parent-meetings";
import { parentMeetingApiError, PARENT_MEETING_PRIVATE_HEADERS, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireParentMeetingApiActor("EXPORT_PARENT_MEETING_REPORTS", ["SUPER_ADMIN", "PRINCIPAL"]);
  if (auth.response || !auth.actor) return auth.response;
  try {
    const search = request.nextUrl.searchParams;
    const csv = await exportParentMeetingReportCsv(prisma, auth.actor, { status: search.get("status"), category: search.get("category"), from: search.get("from"), to: search.get("to") });
    return new NextResponse(csv, { headers: { ...PARENT_MEETING_PRIVATE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=parent-meetings-report.csv" } });
  } catch (error) { return parentMeetingApiError(error); }
}

