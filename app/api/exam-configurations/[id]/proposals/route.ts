import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examConfigurationApiError } from "@/lib/exam-configuration-api";
import { recordTeacherSchemeProposal } from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("PROPOSE_EXAM_SCHEMES");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({
      proposal: await recordTeacherSchemeProposal(prisma, (await params).id, await request.json(), auth.user)
    });
  } catch (error) {
    return examConfigurationApiError(error);
  }
}
