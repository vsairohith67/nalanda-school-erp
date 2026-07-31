import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { loadMarksModerationDashboard } from "@/lib/exam-calculations-v2";
import { examMarksApiError, examPrivateJson } from "@/lib/exam-marks-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_EXAM_MODERATION");
  if (auth.response || !auth.user) return auth.response;
  try {
    return examPrivateJson(await loadMarksModerationDashboard(prisma, {
      examinationId: request.nextUrl.searchParams.get("examinationId")?.trim() || undefined,
      classScopeId: request.nextUrl.searchParams.get("classScopeId")?.trim() || undefined
    }));
  } catch (error) {
    return examMarksApiError(error);
  }
}
