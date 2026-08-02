import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { ACADEMIC_CALENDAR_PRIVATE_HEADERS, academicCalendarApiError } from "@/lib/academic-calendar-api";
import { academicCalendarCsv, assertCalendarLeadershipActor, getAcademicCalendarVersion, listSchoolCalendarEvents } from "@/lib/academic-calendar";
import { checkAcademicCalendarExportRateLimit } from "@/lib/academic-calendar-export-rate-limit";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_ACADEMIC_CALENDAR");
  if (auth.response || !auth.user) return auth.response;
  try {
    assertCalendarLeadershipActor(auth.user);
    const rateLimit = checkAcademicCalendarExportRateLimit(auth.user.id);
    if (!rateLimit.allowed) return NextResponse.json({ error: "Calendar export rate limit reached. Try again shortly." }, { status: 429, headers: { ...ACADEMIC_CALENDAR_PRIVATE_HEADERS, "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const version = await getAcademicCalendarVersion(prisma, request.nextUrl.searchParams.get("version") ?? "");
    const events = await listSchoolCalendarEvents(prisma, version.academicYear);
    const rows = [
      ...version.days.map((day: any) => ({ kind: "Operational day", date: day.dayDate.toISOString().slice(0, 10), dayType: day.dayType, title: day.title, scopeLabel: day.scopeType, className: day.className, section: day.section, status: version.status })),
      ...events.flatMap((event: any) => event.versions.filter((item: any) => item.status === "PUBLISHED").map((item: any) => ({ kind: "Informational event", eventType: item.eventType, title: item.title, audienceLabel: item.audienceType, className: item.className, section: item.section, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(), venue: item.venue, status: item.status, replacesVersionId: item.replacesVersionId })))
    ];
    return new NextResponse(academicCalendarCsv(rows), { headers: { ...ACADEMIC_CALENDAR_PRIVATE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="academic-calendar-${version.academicYear}.csv"` } });
  } catch (error) { return academicCalendarApiError(error); }
}
