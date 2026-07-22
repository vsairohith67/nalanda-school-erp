import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_AI_ASSISTANT"); if (auth.response) return auth.response;
  const id = (await params).id, body = await request.json();
  const profile = await prisma.aiAssistantProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  if (body.action === "activate") {
    if (profile.providerKind !== "MOCK") return NextResponse.json({ error: "Only MOCK may be activated during Prompt 20A." }, { status: 400 });
    if (body.confirmation !== `ACTIVATE ${profile.profileCode}`) return NextResponse.json({ error: "Exact activation confirmation is required." }, { status: 400 });
    await prisma.$transaction([
      prisma.aiAssistantProfile.updateMany({ where: { status: "ACTIVE" }, data: { status: "PAUSED", liveUseEnabled: false } }),
      prisma.aiAssistantProfile.update({ where: { id }, data: { status: "ACTIVE", liveUseEnabled: false, activatedByUserId: auth.user.id } })
    ]);
  } else if (body.action === "pause") {
    await prisma.aiAssistantProfile.update({ where: { id }, data: { status: "PAUSED", liveUseEnabled: false, pausedByUserId: auth.user.id } });
  } else return NextResponse.json({ error: "Unsupported profile action." }, { status: 400 });
  return NextResponse.json({ profile: await prisma.aiAssistantProfile.findUnique({ where: { id } }) });
}
