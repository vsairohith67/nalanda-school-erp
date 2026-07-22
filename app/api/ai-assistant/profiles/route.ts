import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAiAssistantFoundation, validateAiProfileUpdate } from "@/lib/ai-assistant-profiles";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_AI_ASSISTANT"); if (auth.response) return auth.response;
  await ensureAiAssistantFoundation(prisma);
  return NextResponse.json({ profiles: await prisma.aiAssistantProfile.findMany({ orderBy: { createdAt: "asc" } }) });
}
export async function PATCH(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_AI_ASSISTANT"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const profile = await prisma.aiAssistantProfile.findUnique({ where: { id: String(body.id ?? "") } });
    if (!profile) return NextResponse.json({ error: "Assistant profile not found." }, { status: 404 });
    return NextResponse.json({ profile: await prisma.aiAssistantProfile.update({ where: { id: profile.id }, data: validateAiProfileUpdate(body) }) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Profile update failed.") }, { status: 400 }); }
}
