import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { requireExamConfigurationMutation } from "@/lib/exam-configuration-auth";
import { examConfigurationApiError } from "@/lib/exam-configuration-api";
import {
  createExaminationConfiguration,
  listExaminationConfigurations,
  publicExaminationConfiguration
} from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_EXAM_CONFIGURATION");
  if (auth.response) return auth.response;
  const academicYear = request.nextUrl.searchParams.get("academicYear")?.trim() || undefined;
  return NextResponse.json({ examinations: await listExaminationConfigurations(prisma, academicYear) });
}

export async function POST(request: NextRequest) {
  const auth = await requireExamConfigurationMutation("MANAGE_EXAM_CONFIGURATION");
  if (auth.response || !auth.user) return auth.response;
  try {
    const examination = await createExaminationConfiguration(prisma, await request.json(), auth.user);
    return NextResponse.json({ examination: publicExaminationConfiguration(examination) }, { status: 201 });
  } catch (error) {
    return examConfigurationApiError(error);
  }
}
