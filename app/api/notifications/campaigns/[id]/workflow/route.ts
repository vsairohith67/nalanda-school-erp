import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import {
  approveNotificationCampaign,
  publishOrScheduleNotificationCampaign,
  submitNotificationCampaign,
  transitionNotificationEnding
} from "@/lib/notification-campaigns";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";

const permissions: Record<string, Permission> = {
  approve: "APPROVE_NOTIFICATION_CAMPAIGNS",
  publish: "PUBLISH_NOTIFICATION_CAMPAIGNS",
  schedule: "SCHEDULE_NOTIFICATION_CAMPAIGNS",
  withdraw: "WITHDRAW_NOTIFICATION_CAMPAIGNS",
  cancel: "CREATE_NOTIFICATION_CAMPAIGNS",
  archive: "WITHDRAW_NOTIFICATION_CAMPAIGNS"
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const source = await request.json();
    const action = String(source.action ?? "");
    let auth;
    if (action === "submit") {
      auth = await requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS");
      if (auth.response) {
        auth = await requireApiPermission("CREATE_SCOPED_NOTIFICATIONS");
        if (auth.response) return auth.response;
      }
    } else {
      const permission = permissions[action];
      if (!permission) return NextResponse.json({ error: "Unsupported notification workflow action" }, { status: 400 });
      auth = await requireApiPermission(permission);
      if (auth.response) return auth.response;
    }
    const { id } = await params;
    const current = await prisma.notificationCampaign.findUnique({ where: { id }, select: { category: true } });
    if (!current) return NextResponse.json({ error: "Notification campaign was not found" }, { status: 404 });
    if (action === "publish" && current.category === "EMERGENCY") {
      const emergency = await requireApiPermission("PUBLISH_EMERGENCY_NOTIFICATIONS");
      if (emergency.response) return emergency.response;
    }
    const campaign = action === "submit"
      ? await submitNotificationCampaign(prisma, id, auth.user)
      : action === "approve"
        ? await approveNotificationCampaign(prisma, id, auth.user)
        : action === "publish" || action === "schedule"
          ? await publishOrScheduleNotificationCampaign(prisma, id, auth.user, action, source.scheduledFor ? new Date(source.scheduledFor) : null)
          : await transitionNotificationEnding(prisma, id, auth.user, action as "withdraw" | "cancel" | "archive", source.reason);
    return NextResponse.json({ campaign: { id: campaign.id, campaignNumber: campaign.campaignNumber, status: campaign.status } });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to change notification workflow") }, { status: 400 });
  }
}
