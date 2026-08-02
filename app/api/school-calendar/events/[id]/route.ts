import { NextRequest } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { getSchoolCalendarEvent, updateSchoolCalendarEventDraft } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_CALENDAR_MANAGEMENT");
  if (auth.response) return auth.response;
  try { return academicCalendarJson({ event: await getSchoolCalendarEvent(prisma, (await params).id) }); }
  catch (error) { return academicCalendarApiError(error); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentAuthContext();
  const permission = context?.user.role === "TEACHER" ? "PROPOSE_SCHOOL_EVENTS" : "MANAGE_SCHOOL_EVENTS";
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth.response;
  try { return academicCalendarJson({ event: await updateSchoolCalendarEventDraft(prisma, (await params).id, await request.json(), { ...auth.user, sessionId: context?.sessionId }) }); }
  catch (error) { return academicCalendarApiError(error); }
}
