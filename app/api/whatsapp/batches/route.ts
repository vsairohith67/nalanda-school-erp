import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWhatsAppBatch } from "@/lib/whatsapp-batches";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_WHATSAPP_CENTRE");
  if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status");
  return NextResponse.json({ batches: await prisma.whatsAppOutboundBatch.findMany({
    where: status ? { status } : {},
    include: { integrationProfile: { select: { profileCode: true, mode: true } }, templateMapping: { select: { mappingCode: true } }, notificationCampaign: { select: { campaignNumber: true, title: true } } },
    orderBy: { createdAt: "desc" }
  }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_WHATSAPP_BATCHES");
  if (auth.response) return auth.response;
  try { return NextResponse.json({ batch: await createWhatsAppBatch(prisma, await request.json(), auth.user) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create batch.") }, { status: 400 }); }
}
