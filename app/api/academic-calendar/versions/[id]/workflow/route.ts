import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { academicCalendarContainsEmergencyClosure, normalizeAcademicCalendarWorkflowAction, transitionAcademicCalendar } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const action = normalizeAcademicCalendarWorkflowAction(body && typeof body === "object" && !Array.isArray(body) ? body.action : null);
  if (!action) return academicCalendarJson({ error: "Unsupported academic calendar action.", code: "CALENDAR_INVALID" }, 400);
  const permission: Permission = ["publish", "withdraw", "archive"].includes(action) ? "PUBLISH_ACADEMIC_CALENDAR" : action === "approve" ? "REVIEW_ACADEMIC_CALENDAR" : "MANAGE_ACADEMIC_CALENDAR";
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth.response;
  try {
    const id = (await params).id;
    if (action === "publish" && await academicCalendarContainsEmergencyClosure(prisma, id)) {
      const emergencyAuth = await requireApiPermission("PUBLISH_EMERGENCY_CLOSURE");
      if (emergencyAuth.response || !emergencyAuth.user) return emergencyAuth.response;
    }
    return academicCalendarJson({ version: await transitionAcademicCalendar(prisma, id, { ...body, action }, auth.user) });
  }
  catch (error) { return academicCalendarApiError(error); }
}
