import { isNotificationActive, isNotificationEffectivelyAvailable, notificationHistoryState } from "@/lib/notification-visibility";
import { notificationPathAllowedForRole } from "@/lib/notification-links";
import { serializeOwnNotification } from "@/lib/notification-recipients";

export async function listOwnNotifications(client: any, user: { id: string; role: string }, options?: { history?: boolean; now?: Date }) {
  const now = options?.now ?? new Date();
  const rows = await client.notificationRecipient.findMany({
    where: { userId: user.id },
    include: { campaign: { include: { correctionOfCampaign: { select: { campaignNumber: true } } } } },
    orderBy: [{ availableAt: "desc" }, { createdAt: "desc" }]
  });
  return rows
    .filter((row: any) => {
      const history = notificationHistoryState(row.campaign, now) !== "AVAILABLE" || Boolean(row.dismissedAt);
      return options?.history ? history : isNotificationActive(row.campaign, now) && !row.dismissedAt;
    })
    .map((row: any) => {
      const safe = serializeOwnNotification(row, now);
      return {
        ...safe,
        actionPath: notificationPathAllowedForRole(safe.actionPath, user.role) ? safe.actionPath : null,
        actionLabel: notificationPathAllowedForRole(safe.actionPath, user.role) ? safe.actionLabel : null
      };
    });
}

export async function ownNotificationDetail(client: any, campaignNumber: string, user: { id: string; role: string }, now = new Date()) {
  const row = await client.notificationRecipient.findFirst({
    where: { userId: user.id, campaign: { campaignNumber } },
    include: { campaign: { include: { correctionOfCampaign: { select: { campaignNumber: true } } } } }
  });
  if (!row || !isNotificationEffectivelyAvailable(row.campaign, now)) throw new Error("Notification was not found for this account.");
  const safe = serializeOwnNotification(row, now);
  return {
    ...safe,
    actionPath: notificationPathAllowedForRole(safe.actionPath, user.role) ? safe.actionPath : null,
    actionLabel: notificationPathAllowedForRole(safe.actionPath, user.role) ? safe.actionLabel : null
  };
}

export async function ownUnreadNotificationCount(client: any, userId: string, now = new Date()) {
  const rows = await client.notificationRecipient.findMany({
    where: { userId, readAt: null, dismissedAt: null },
    select: { campaign: { select: { status: true, scheduledFor: true, expiresAt: true, withdrawnAt: true, publishedAt: true } } }
  });
  return rows.filter((row: any) => isNotificationActive(row.campaign, now)).length;
}

export async function legacyParentNoticeCount(client: any, now = new Date()) {
  return client.notice.count({
    where: {
      status: "PUBLISHED",
      AND: [
        { OR: [{ publishDate: null }, { publishDate: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
      ]
    }
  });
}
