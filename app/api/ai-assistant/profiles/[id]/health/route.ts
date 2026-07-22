import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_AI_ASSISTANT"); if (auth.response) return auth.response;
  const profile = await prisma.aiAssistantProfile.findUnique({ where: { id: (await params).id } });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const health = profile.providerKind === "MOCK"
    ? { status: "PASS", message: "Deterministic MOCK ready. No network request occurred." }
    : { status: "DISABLED", message: `${profile.providerKind} remains disabled pending supervised provider and data-processing review.` };
  await prisma.aiAssistantProfile.update({ where: { id: profile.id }, data: { lastHealthCheckAt: new Date(), lastHealthCheckStatus: health.status, lastHealthCheckMessage: health.message } });
  return NextResponse.json({ health });
}
