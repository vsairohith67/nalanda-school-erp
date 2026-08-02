import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examinationTimetableApiError, examTimetableJson } from "@/lib/examination-timetable-api";
import { transitionExaminationTimetable } from "@/lib/examination-timetables";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" && !Array.isArray(body) ? String(body.action ?? "").toLowerCase() : "";
  const permission = ["publish", "withdraw", "archive"].includes(action) ? "PUBLISH_EXAM_TIMETABLE" : "MANAGE_EXAM_TIMETABLE";
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth.response;
  try {
    return examTimetableJson({ timetable: await transitionExaminationTimetable(prisma, (await params).id, body, auth.user) });
  } catch (error) {
    return examinationTimetableApiError(error);
  }
}
