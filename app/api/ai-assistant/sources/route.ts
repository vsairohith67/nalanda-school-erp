import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAiAssistantFoundation } from "@/lib/ai-assistant-profiles";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_AI_ASSISTANT_SOURCES"); if (auth.response) return auth.response;
  await ensureAiAssistantFoundation(prisma);
  return NextResponse.json({ sources: await prisma.aiAssistantSourcePolicy.findMany({ orderBy: [{ sourceType: "asc" }, { displayName: "asc" }] }) });
}
