import { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { examMarksApiError, examPrivateJson } from "@/lib/exam-marks-api";
import { requestMarkCorrection } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireApiRolePermission("REQUEST_EXAM_MARK_CORRECTION", "TEACHER");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { assignmentId } = await context.params;
    return examPrivateJson(await requestMarkCorrection(prisma, assignmentId, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}
