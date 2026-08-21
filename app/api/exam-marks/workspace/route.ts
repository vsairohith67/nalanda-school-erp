import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examMarksApiError, examPrivateJson } from "@/lib/exam-marks-api";
import { loadTeacherMarksWorkspace } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_OWN_EXAM_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const assignmentId = request.nextUrl.searchParams.get("assignmentId")?.trim() || undefined;
    return examPrivateJson(await loadTeacherMarksWorkspace(prisma, auth.user, assignmentId));
  } catch (error) {
    return examMarksApiError(error);
  }
}
