import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { normalizeSchoolEventWorkflowAction, transitionSchoolCalendarEvent } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const action = normalizeSchoolEventWorkflowAction(body && typeof body === "object" && !Array.isArray(body) ? body.action : null);
  if (!action) return academicCalendarJson({ error: "Unsupported school calendar event action.", code: "CALENDAR_INVALID" }, 400);
  const permission: Permission = ["publish", "withdraw", "archive"].includes(action) ? "PUBLISH_SCHOOL_EVENTS" : action === "approve" || action === "ready" ? "REVIEW_SCHOOL_EVENTS" : "MANAGE_SCHOOL_EVENTS";
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth.response;
  try { return academicCalendarJson({ event: await transitionSchoolCalendarEvent(prisma, (await params).id, { ...body, action }, auth.user) }); }
  catch (error) { return academicCalendarApiError(error); }
}
