import { NextRequest, NextResponse } from "next/server";
import { requireExamConfigurationMutation } from "@/lib/exam-configuration-auth";
import { examConfigurationApiError } from "@/lib/exam-configuration-api";
import { activateSchemeVersion, archiveExaminationConfiguration } from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" && !Array.isArray(body) ? String(body.action ?? "") : "";
  const permission = action === "activate_scheme" ? "ACTIVATE_EXAM_SCHEMES" : "MANAGE_EXAM_CONFIGURATION";
  const auth = await requireExamConfigurationMutation(permission);
  if (auth.response || !auth.user) return auth.response;
  try {
    const id = (await params).id;
    if (action === "activate_scheme") {
      return NextResponse.json({ schemeVersion: await activateSchemeVersion(prisma, id, body, auth.user) });
    }
    if (action === "archive_examination") {
      return NextResponse.json({ examination: await archiveExaminationConfiguration(prisma, id, body, auth.user) });
    }
    return NextResponse.json({ error: "Unsupported examination configuration action." }, { status: 400 });
  } catch (error) {
    return examConfigurationApiError(error);
  }
}
