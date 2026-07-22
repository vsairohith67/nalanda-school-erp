import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createNotificationCampaign } from "@/lib/notification-campaigns";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS");
  if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status");
  const category = request.nextUrl.searchParams.get("category");
  const campaigns = await prisma.notificationCampaign.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(category ? { category } : {})
    },
    select: safeCampaignSelect,
    orderBy: [{ createdAt: "desc" }]
  });
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS");
  if (auth.response) return auth.response;
  try {
    const campaign = await createNotificationCampaign(prisma, await request.json(), auth.user);
    return NextResponse.json({ campaign: safeCampaign(campaign) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error, "Unable to create notification campaign") }, { status: 400 });
  }
}

const safeCampaignSelect = {
  id: true, campaignNumber: true, category: true, priority: true, title: true, audienceType: true,
  channel: true, status: true, acknowledgmentRequired: true, scheduledFor: true, expiresAt: true,
  totalResolvedUsers: true, totalRecipientRows: true, totalSkipped: true, totalRead: true,
  totalAcknowledged: true, totalDismissed: true, createdAt: true, updatedAt: true
} as const;
function safeCampaign(row: any) {
  return Object.fromEntries(Object.keys(safeCampaignSelect).map((key) => [key, row[key]]));
}
function message(error: unknown, fallback: string) { return safeClientError(error, fallback); }
