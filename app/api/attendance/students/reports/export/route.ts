import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { prisma } from "@/lib/prisma";
import {
  attendanceDateRange,
  attendanceReportCsv,
  attendanceReportData,
  localDateText,
  optionalAttendanceFilter
} from "@/lib/student-attendance";
import { getSchoolSettings } from "@/lib/school-settings";
import {
  AttendanceScopeError,
  attendanceScopeWhere,
  requireAttendanceReportFilter,
  resolveTeacherAttendanceScope
} from "@/lib/teacher-attendance-scope";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STUDENT_ATTENDANCE_REPORTS");
  if (auth.response) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const settings = await getSchoolSettings(prisma);
    const today = localDateText();
    const fromText = sp.get("from") || `${today.slice(0, 8)}01`;
    const toText = sp.get("to") || today;
    const { from, to } = attendanceDateRange(fromText, toText);
    const requestedAcademicYear = sp.get("academicYear") || settings.academicYear;
    if (auth.user.role === "TEACHER" && requestedAcademicYear !== settings.academicYear) {
      throw new AttendanceScopeError();
    }
    const className = optionalAttendanceFilter(sp.get("className"));
    const section = sp.has("section")
      ? String(sp.get("section") ?? "").trim().toUpperCase()
      : undefined;
    const resolved = await resolveTeacherAttendanceScope(prisma, auth.user, {
      academicYear: auth.user.role === "TEACHER" ? settings.academicYear : requestedAcademicYear,
      from,
      to
    });
    if (auth.user.role === "TEACHER" && !resolved.targets.length) throw new AttendanceScopeError();
    requireAttendanceReportFilter(resolved, {
      academicYear: requestedAcademicYear,
      className,
      section
    });
    const data = await attendanceReportData(prisma, {
      from,
      to,
      academicYear: requestedAcademicYear,
      className,
      section,
      scopeWhere: attendanceScopeWhere(resolved)
    });
    return new NextResponse(attendanceReportCsv(data.rows), {
      headers: {
        ...PRIVATE_HEADERS,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="student-attendance-${fromText}-to-${toText}.csv"`
      }
    });
  } catch (error) {
    const status = error instanceof AttendanceScopeError ? error.status : 400;
    const message = error instanceof AttendanceScopeError
      ? error.message
      : safeClientError(error, "Unable to export attendance");
    return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
  }
}
