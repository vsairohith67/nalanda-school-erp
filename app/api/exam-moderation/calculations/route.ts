import { NextRequest } from "next/server";
import { runExaminationCalculationPreview } from "@/lib/exam-calculations-v2";
import { examMarksApiError, examPrivateJson, requireExamModerationMutation } from "@/lib/exam-marks-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireExamModerationMutation("RUN_EXAM_CALCULATIONS");
  if (auth.response || !auth.user) return auth.response;
  try {
    return examPrivateJson(await runExaminationCalculationPreview(prisma, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}
