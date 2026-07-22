import { notificationHistoryState, isNotificationEffectivelyAvailable } from "@/lib/notification-visibility";

type RecipientClient = {
  notificationRecipient: {
    findUnique(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
    update(args: any): Promise<any>;
  };
  notificationEvent: { create(args: any): Promise<any> };
  notificationCampaign: { update(args: any): Promise<any> };
};

export async function recalculateNotificationCounts(client: any, campaignId: string) {
  const [totalRecipientRows, totalRead, totalAcknowledged, totalDismissed, totalSkipped] = await Promise.all([
    client.notificationRecipient.count({ where: { campaignId } }),
    client.notificationRecipient.count({ where: { campaignId, readAt: { not: null } } }),
    client.notificationRecipient.count({ where: { campaignId, acknowledgedAt: { not: null } } }),
    client.notificationRecipient.count({ where: { campaignId, dismissedAt: { not: null } } }),
    client.notificationSkippedRecipient.count({ where: { campaignId } })
  ]);
  return client.notificationCampaign.update({
    where: { id: campaignId },
    data: { totalResolvedUsers: totalRecipientRows, totalRecipientRows, totalRead, totalAcknowledged, totalDismissed, totalSkipped }
  });
}

export async function actOnOwnNotification(
  client: RecipientClient,
  input: { campaignId: string; userId: string; action: "read" | "acknowledge" | "dismiss"; now?: Date }
) {
  const now = input.now ?? new Date();
  const recipient = await client.notificationRecipient.findUnique({
    where: { campaignId_userId: { campaignId: input.campaignId, userId: input.userId } },
    include: { campaign: true }
  });
  if (!recipient) throw new Error("Notification was not found for this account.");
  if (!isNotificationEffectivelyAvailable(recipient.campaign, now)) throw new Error("Notification is not available yet.");
  if (recipient.campaign.expiresAt && recipient.campaign.expiresAt <= now) throw new Error("Expired notifications are preserved in history and cannot be changed.");
  if (recipient.campaign.status === "WITHDRAWN") throw new Error("Withdrawn notifications are preserved in history and cannot be changed.");
  if (input.action === "dismiss" && recipient.campaign.acknowledgmentRequired && !recipient.acknowledgedAt) {
    throw new Error("Acknowledge this notification before dismissing it.");
  }
  const eventType = input.action === "read" ? "NOTIFICATION_READ" : input.action === "acknowledge" ? "NOTIFICATION_ACKNOWLEDGED" : "NOTIFICATION_DISMISSED";
  const data = input.action === "read"
    ? { firstViewedAt: recipient.firstViewedAt ?? now, readAt: recipient.readAt ?? now, deliveryStatus: recipient.acknowledgedAt ? "ACKNOWLEDGED" : "READ" }
    : input.action === "acknowledge"
      ? { firstViewedAt: recipient.firstViewedAt ?? now, readAt: recipient.readAt ?? now, acknowledgedAt: recipient.acknowledgedAt ?? now, deliveryStatus: "ACKNOWLEDGED" }
      : { dismissedAt: recipient.dismissedAt ?? now, deliveryStatus: "DISMISSED" };
  if ((input.action === "read" && recipient.readAt) || (input.action === "acknowledge" && recipient.acknowledgedAt) || (input.action === "dismiss" && recipient.dismissedAt)) {
    return recipient;
  }
  const updated = await client.notificationRecipient.update({ where: { id: recipient.id }, data });
  await client.notificationEvent.create({
    data: { campaignId: recipient.campaignId, recipientId: recipient.id, eventType, eventDate: now, recordedByUserId: input.userId }
  });
  await recalculateNotificationCounts(client as any, recipient.campaignId);
  return updated;
}

export function serializeOwnNotification(row: any, now = new Date()) {
  return {
    campaignNumber: row.campaign.campaignNumber,
    category: row.campaign.category,
    priority: row.campaign.priority,
    title: row.campaign.title,
    body: row.campaign.body,
    actionLabel: row.campaign.actionLabel,
    actionPath: row.campaign.actionPath,
    acknowledgmentRequired: row.campaign.acknowledgmentRequired,
    correctionOfCampaignNumber: row.campaign.correctionOfCampaign?.campaignNumber ?? null,
    status: notificationHistoryState(row.campaign, now),
    contextType: row.contextType,
    context: JSON.parse(row.recipientContextJson),
    availableAt: row.availableAt,
    firstViewedAt: row.firstViewedAt,
    readAt: row.readAt,
    acknowledgedAt: row.acknowledgedAt,
    dismissedAt: row.dismissedAt
  };
}
