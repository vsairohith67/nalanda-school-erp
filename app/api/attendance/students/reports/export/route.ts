import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attendanceDay, attendanceReportCsv, attendanceReportData, localDateText, optionalAttendanceFilter } from "@/lib/student-attendance";
import { getSchoolSettings } from "@/lib/school-settings";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STUDENT_ATTENDANCE_REPORTS"); if (auth.response) return auth.response;
  try {
    const sp = request.nextUrl.searchParams; const settings = await getSchoolSettings(prisma);
    const today = localDateText(); const fromText = sp.get("from") || `${today.slice(0, 8)}01`; const toText = sp.get("to") || today;
    const data = await attendanceReportData(prisma, { from: attendanceDay(fromText), to: attendanceDay(toText), academicYear: sp.get("academicYear") || settings.academicYear, className: optionalAttendanceFilter(sp.get("className")), section: optionalAttendanceFilter(sp.get("section")) });
    return new NextResponse(attendanceReportCsv(data.rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=student-attendance-${fromText}-to-${toText}.csv` } });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to export attendance") }, { status: 400 }); }
}
