import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { requireExamConfigurationMutation } from "@/lib/exam-configuration-auth";
import { examConfigurationApiError } from "@/lib/exam-configuration-api";
import {
  getExaminationConfiguration,
  publicExaminationConfiguration,
  updateExaminationConfiguration
} from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_EXAM_CONFIGURATION");
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({
      examination: publicExaminationConfiguration(await getExaminationConfiguration(prisma, (await params).id))
    });
  } catch (error) {
    return examConfigurationApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireExamConfigurationMutation("MANAGE_EXAM_CONFIGURATION");
  if (auth.response || !auth.user) return auth.response;
  try {
    const examination = await updateExaminationConfiguration(prisma, (await params).id, await request.json(), auth.user);
    return NextResponse.json({ examination: publicExaminationConfiguration(examination) });
  } catch (error) {
    return examConfigurationApiError(error);
  }
}
