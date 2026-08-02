import { NextRequest } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { loadPublishedSchoolCalendar } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STAFF_CALENDAR");
  const context = await getCurrentAuthContext();
  if (auth.response || !auth.user || !context || auth.user.role !== "TEACHER") return auth.response ?? academicCalendarJson({ error: "Teacher context required." }, 403);
  const query = request.nextUrl.searchParams;
  try { return academicCalendarJson(await loadPublishedSchoolCalendar(prisma, { ...auth.user, sessionId: context.sessionId }, { academicYear: query.get("academicYear") ?? "", from: query.get("from"), to: query.get("to") })); }
  catch (error) { return academicCalendarApiError(error); }
}
