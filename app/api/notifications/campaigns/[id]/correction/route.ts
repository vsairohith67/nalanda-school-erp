import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createCorrectedNotificationCampaign } from "@/lib/notification-campaigns";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS");
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const campaign = await createCorrectedNotificationCampaign(prisma, id, auth.user);
    return NextResponse.json({ campaign: { id: campaign.id, campaignNumber: campaign.campaignNumber, status: campaign.status } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to create correction") }, { status: 400 });
  }
}
