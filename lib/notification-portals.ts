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
      if (!calendarNotificationVisibleInRole(row, user.role)) return false;
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
  if (!row || !calendarNotificationVisibleInRole(row, user.role) || !isNotificationEffectivelyAvailable(row.campaign, now)) throw new Error("Notification was not found for this account.");
  const safe = serializeOwnNotification(row, now);
  return {
    ...safe,
    actionPath: notificationPathAllowedForRole(safe.actionPath, user.role) ? safe.actionPath : null,
    actionLabel: notificationPathAllowedForRole(safe.actionPath, user.role) ? safe.actionLabel : null
  };
}

export async function ownUnreadNotificationCount(client: any, user: { id: string; role: string }, now = new Date()) {
  const rows = await client.notificationRecipient.findMany({
    where: { userId: user.id, readAt: null, dismissedAt: null },
    select: { recipientRoleSnapshot: true, campaign: { select: { status: true, scheduledFor: true, expiresAt: true, withdrawnAt: true, publishedAt: true, audienceDefinitionJson: true } } }
  });
  return rows.filter((row: any) => calendarNotificationVisibleInRole(row, user.role) && isNotificationActive(row.campaign, now)).length;
}

function calendarNotificationVisibleInRole(row: any, role: string) {
  let definition: any = null;
  try { definition = JSON.parse(row.campaign?.audienceDefinitionJson ?? "null"); } catch { return false; }
  if (definition?.source !== "SCHOOL_CALENDAR") return true;
  const audience = definition.audienceType;
  if (audience === "SCHOOL_WIDE") return true;
  if (audience === "LEADERSHIP_ONLY") return ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
  if (audience === "STAFF_ONLY") return ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "TEACHER"].includes(role);
  if (audience === "PARENTS_ALL") return role === "PARENT" || ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
  if (audience === "ROLE_SPECIFIC") return role === definition.roleScope || ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
  if (["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(audience)) return row.recipientRoleSnapshot === role || ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
  return false;
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
