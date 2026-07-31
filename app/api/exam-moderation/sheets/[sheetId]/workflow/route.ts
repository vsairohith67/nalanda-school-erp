import { NextRequest } from "next/server";
import { examMarksApiError, examPrivateJson, requireExamModerationMutation } from "@/lib/exam-marks-api";
import { moderateMarkSheet } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ sheetId: string }> }) {
  const auth = await requireExamModerationMutation("MODERATE_EXAM_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { sheetId } = await context.params;
    return examPrivateJson(await moderateMarkSheet(prisma, sheetId, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}
