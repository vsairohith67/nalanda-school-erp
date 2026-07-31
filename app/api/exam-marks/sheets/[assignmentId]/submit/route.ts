import { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { examMarksApiError, examPrivateJson } from "@/lib/exam-marks-api";
import { submitAssignedMarkSheet } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireApiRolePermission("SUBMIT_ASSIGNED_EXAM_MARKS", "TEACHER");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { assignmentId } = await context.params;
    return examPrivateJson(await submitAssignedMarkSheet(prisma, assignmentId, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}
