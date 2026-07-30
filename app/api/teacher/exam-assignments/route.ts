import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examConfigurationApiError } from "@/lib/exam-configuration-api";
import { listTeacherExamAssignments } from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_OWN_EXAM_ASSIGNMENTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({ assignments: await listTeacherExamAssignments(prisma, auth.user) });
  } catch (error) {
    return examConfigurationApiError(error);
  }
}
