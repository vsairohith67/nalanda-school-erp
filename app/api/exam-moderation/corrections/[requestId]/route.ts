import { NextRequest } from "next/server";
import { examMarksApiError, examPrivateJson, requireExamModerationMutation } from "@/lib/exam-marks-api";
import { reviewMarkCorrection } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  const auth = await requireExamModerationMutation("REOPEN_EXAM_MARK_SHEETS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { requestId } = await context.params;
    return examPrivateJson(await reviewMarkCorrection(prisma, requestId, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}
