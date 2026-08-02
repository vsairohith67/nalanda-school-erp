import { NextRequest } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { createSchoolCalendarEvent, listSchoolCalendarEvents } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_CALENDAR_MANAGEMENT");
  if (auth.response) return auth.response;
  try { return academicCalendarJson({ events: await listSchoolCalendarEvents(prisma, request.nextUrl.searchParams.get("academicYear") ?? undefined) }); }
  catch (error) { return academicCalendarApiError(error); }
}

export async function POST(request: NextRequest) {
  const context = await getCurrentAuthContext();
  const permission = context?.user.role === "TEACHER" ? "PROPOSE_SCHOOL_EVENTS" : "MANAGE_SCHOOL_EVENTS";
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth.response;
  try { return academicCalendarJson({ event: await createSchoolCalendarEvent(prisma, await request.json(), { ...auth.user, sessionId: context?.sessionId }) }, 201); }
  catch (error) { return academicCalendarApiError(error); }
}
