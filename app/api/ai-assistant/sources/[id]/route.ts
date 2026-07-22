import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSourcePolicyUpdate } from "@/lib/ai-assistant-profiles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_AI_ASSISTANT_SOURCES"); if (auth.response) return auth.response;
  const id = (await params).id, existing = await prisma.aiAssistantSourcePolicy.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Source policy not found." }, { status: 404 });
  try {
    const data = validateSourcePolicyUpdate(existing, await request.json());
    return NextResponse.json({ source: await prisma.aiAssistantSourcePolicy.update({ where: { id }, data: { ...data, updatedByUserId: auth.user.id } }) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Source update failed.") }, { status: 400 }); }
}
