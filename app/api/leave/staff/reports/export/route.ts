import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leaveDate, localLeaveDateText, staffLeaveReportCsv, staffLeaveReportData } from "@/lib/staff-leave";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STAFF_LEAVE_REPORTS"); if (auth.response) return auth.response;
  try { const sp = request.nextUrl.searchParams; const today = localLeaveDateText(); const fromText = sp.get("from") || `${today.slice(0,8)}01`; const toText = sp.get("to") || today; const data = await staffLeaveReportData(prisma, { from: leaveDate(fromText), to: leaveDate(toText), staffMemberId: sp.get("staffMemberId") }); return new NextResponse(staffLeaveReportCsv(data.requests), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=staff-leave-${fromText}-to-${toText}.csv` } }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to export staff leave") }, { status: 400 }); }
}
