import { NextRequest, NextResponse } from "next/server";
import { requireExamConfigurationMutation } from "@/lib/exam-configuration-auth";
import { examConfigurationApiError } from "@/lib/exam-configuration-api";
import { archiveTeacherExamAssignment } from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const auth = await requireExamConfigurationMutation("ASSIGN_EXAM_TEACHERS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { id, assignmentId } = await params;
    return NextResponse.json({
      assignment: await archiveTeacherExamAssignment(prisma, id, assignmentId, await request.json(), auth.user)
    });
  } catch (error) {
    return examConfigurationApiError(error);
  }
}
