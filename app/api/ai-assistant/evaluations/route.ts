import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAiAssistantFoundation } from "@/lib/ai-assistant-profiles";
import { runAiAssistantEvaluations } from "@/lib/ai-assistant-evaluations";

export async function GET() {
  const auth = await requireApiPermission("RUN_AI_ASSISTANT_EVALUATIONS"); if (auth.response) return auth.response;
  await ensureAiAssistantFoundation(prisma);
  return NextResponse.json({
    cases: await prisma.aiAssistantEvaluationCase.findMany({ orderBy: { caseCode: "asc" } }),
    runs: await prisma.aiAssistantEvaluationRun.findMany({ take: 20, orderBy: { createdAt: "desc" } })
  });
}
export async function POST() {
  const auth = await requireApiPermission("RUN_AI_ASSISTANT_EVALUATIONS"); if (auth.response) return auth.response;
  await ensureAiAssistantFoundation(prisma);
  try { return NextResponse.json({ run: await runAiAssistantEvaluations(prisma, auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Evaluation failed.") }, { status: 400 }); }
}
