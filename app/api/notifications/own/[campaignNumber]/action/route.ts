import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { actOnOwnNotification } from "@/lib/notification-recipients";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignNumber: string }> }) {
  const source = await request.json().catch(() => ({}));
  const action = String(source.action ?? "") as "read" | "acknowledge" | "dismiss";
  const permission = action === "acknowledge" ? "ACKNOWLEDGE_OWN_NOTIFICATIONS" : "VIEW_OWN_NOTIFICATIONS";
  const auth = await requireApiPermission(permission);
  if (auth.response) return auth.response;
  if (!["read", "acknowledge", "dismiss"].includes(action)) return NextResponse.json({ error: "Unsupported notification action" }, { status: 400 });
  try {
    const { campaignNumber } = await params;
    const campaign = await prisma.notificationCampaign.findUnique({ where: { campaignNumber }, select: { id: true } });
    if (!campaign) return NextResponse.json({ error: "Notification was not found for this account" }, { status: 404 });
    const recipient = await actOnOwnNotification(prisma, { campaignId: campaign.id, userId: auth.user.id, action });
    return NextResponse.json({
      recipient: {
        status: recipient.deliveryStatus,
        readAt: recipient.readAt,
        acknowledgedAt: recipient.acknowledgedAt,
        dismissedAt: recipient.dismissedAt
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to update notification") }, { status: 400 });
  }
}
