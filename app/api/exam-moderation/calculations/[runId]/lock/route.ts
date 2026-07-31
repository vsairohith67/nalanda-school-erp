import { NextRequest } from "next/server";
import { lockExaminationCalculation } from "@/lib/exam-calculations-v2";
import { examMarksApiError, examPrivateJson, requireExamModerationMutation } from "@/lib/exam-marks-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const auth = await requireExamModerationMutation("LOCK_EXAM_CALCULATIONS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { runId } = await context.params;
    return examPrivateJson(await lockExaminationCalculation(prisma, runId, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}
