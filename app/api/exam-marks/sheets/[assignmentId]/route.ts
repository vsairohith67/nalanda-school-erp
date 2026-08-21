import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examMarksApiError, examPrivateJson } from "@/lib/exam-marks-api";
import { saveAssignedMarkDraft } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireApiPermission("ENTER_ASSIGNED_EXAM_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { assignmentId } = await context.params;
    return examPrivateJson(await saveAssignedMarkDraft(prisma, assignmentId, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}
