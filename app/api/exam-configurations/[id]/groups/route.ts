import { NextRequest, NextResponse } from "next/server";
import { requireExamConfigurationMutation } from "@/lib/exam-configuration-auth";
import { examConfigurationApiError } from "@/lib/exam-configuration-api";
import { createSubjectGroup } from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireExamConfigurationMutation("MANAGE_EXAM_CONFIGURATION");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json(
      { subjectGroup: await createSubjectGroup(prisma, (await params).id, await request.json(), auth.user) },
      { status: 201 }
    );
  } catch (error) {
    return examConfigurationApiError(error);
  }
}
