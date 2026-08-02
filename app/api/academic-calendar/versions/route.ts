import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { createAcademicCalendarVersion, listAcademicCalendarVersions } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_CALENDAR_MANAGEMENT");
  if (auth.response) return auth.response;
  const academicYear = request.nextUrl.searchParams.get("academicYear") ?? undefined;
  try { return academicCalendarJson({ versions: await listAcademicCalendarVersions(prisma, academicYear) }); }
  catch (error) { return academicCalendarApiError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_ACADEMIC_CALENDAR");
  if (auth.response || !auth.user) return auth.response;
  try { return academicCalendarJson({ version: await createAcademicCalendarVersion(prisma, await request.json(), auth.user) }, 201); }
  catch (error) { return academicCalendarApiError(error); }
}
