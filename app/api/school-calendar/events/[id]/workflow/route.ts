import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { academicCalendarApiError, academicCalendarJson } from "@/lib/academic-calendar-api";
import { transitionSchoolCalendarEvent } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" && !Array.isArray(body) ? String(body.action ?? "").toLowerCase() : "";
  const permission: Permission = ["publish", "withdraw", "archive"].includes(action) ? "PUBLISH_SCHOOL_EVENTS" : action === "approve" || action === "ready" ? "REVIEW_SCHOOL_EVENTS" : "MANAGE_SCHOOL_EVENTS";
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth.response;
  try { return academicCalendarJson({ event: await transitionSchoolCalendarEvent(prisma, (await params).id, body, auth.user) }); }
  catch (error) { return academicCalendarApiError(error); }
}
