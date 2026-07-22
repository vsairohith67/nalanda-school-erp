export const SCHOOL_TIME_ZONE = "Asia/Kolkata";

export type NotificationVisibilityCampaign = {
  status: string;
  scheduledFor: Date | string | null;
  expiresAt: Date | string | null;
  withdrawnAt?: Date | string | null;
  publishedAt?: Date | string | null;
};

export function notificationAvailableAt(campaign: NotificationVisibilityCampaign) {
  if (campaign.status === "SCHEDULED" && campaign.scheduledFor) return new Date(campaign.scheduledFor);
  return new Date(campaign.publishedAt ?? campaign.scheduledFor ?? 0);
}

export function isNotificationEffectivelyAvailable(campaign: NotificationVisibilityCampaign, now = new Date()) {
  if (["CANCELLED", "WITHDRAWN", "ARCHIVED"].includes(campaign.status)) return false;
  if (campaign.status === "PUBLISHED") return true;
  return campaign.status === "SCHEDULED"
    && Boolean(campaign.scheduledFor)
    && new Date(campaign.scheduledFor!).getTime() <= now.getTime();
}

export function isNotificationActive(campaign: NotificationVisibilityCampaign, now = new Date()) {
  if (!isNotificationEffectivelyAvailable(campaign, now)) return false;
  return !campaign.expiresAt || new Date(campaign.expiresAt).getTime() > now.getTime();
}

export function notificationHistoryState(campaign: NotificationVisibilityCampaign, now = new Date()) {
  if (campaign.status === "WITHDRAWN") return "WITHDRAWN";
  if (campaign.status === "ARCHIVED") return "ARCHIVED";
  if (campaign.expiresAt && new Date(campaign.expiresAt).getTime() <= now.getTime()) return "EXPIRED";
  return isNotificationEffectivelyAvailable(campaign, now) ? "AVAILABLE" : "PENDING";
}

export function requireFutureSchedule(scheduledFor: Date | null, now = new Date()) {
  if (!scheduledFor || scheduledFor.getTime() <= now.getTime()) {
    throw new Error("Scheduled time must be a future India-local date and time.");
  }
}

export function indiaLocalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
