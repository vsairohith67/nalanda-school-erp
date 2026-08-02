import { NextRequest } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { loadPublishedSchoolCalendar } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_OWN_CALENDAR");
  const context = await getCurrentAuthContext();
  if (auth.response || !auth.user || !context || auth.user.role !== "PARENT") return auth.response ?? academicCalendarJson({ error: "Parent context required." }, 403);
  const query = request.nextUrl.searchParams;
  try { return academicCalendarJson(await loadPublishedSchoolCalendar(prisma, { ...auth.user, sessionId: context.sessionId }, { academicYear: query.get("academicYear") ?? "", from: query.get("from"), to: query.get("to"), childHandle: query.get("child"), expectedContextVersion: optionalInteger(query.get("contextVersion")) })); }
  catch (error) { return academicCalendarApiError(error); }
}

function optionalInteger(value: string | null) { if (value === null || value === "") return null; const number = Number(value); return Number.isInteger(number) ? number : -1; }
