import { NextRequest } from "next/server";
import { hasUserPermission, requireApiPermission } from "@/lib/auth";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { getAcademicCalendarVersion, saveAcademicCalendarDraft } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_CALENDAR_MANAGEMENT");
  if (auth.response) return auth.response;
  try { return academicCalendarJson({ version: await getAcademicCalendarVersion(prisma, (await params).id) }); }
  catch (error) { return academicCalendarApiError(error); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_ACADEMIC_CALENDAR");
  if (auth.response || !auth.user) return auth.response;
  try {
    const body = await request.json();
    const emergencyPermissionConfirmed = await hasUserPermission(auth.user, "PUBLISH_EMERGENCY_CLOSURE");
    return academicCalendarJson({ version: await saveAcademicCalendarDraft(prisma, (await params).id, { ...body, emergencyPermissionConfirmed }, auth.user) });
  } catch (error) { return academicCalendarApiError(error); }
}
