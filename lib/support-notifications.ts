import { createHash } from "node:crypto";

export type SupportNotificationType =
  | "REQUEST_SUBMITTED"
  | "REQUEST_ACKNOWLEDGED"
  | "REQUEST_ASSIGNED"
  | "REQUESTER_VISIBLE_RESPONSE"
  | "INFORMATION_REQUESTED"
  | "REQUEST_ESCALATED"
  | "REQUEST_RESOLVED"
  | "REQUEST_CLOSED"
  | "REQUEST_REOPENED"
  | "URGENT_RESTRICTED_ALERT"
  | "SATISFACTION_REQUEST";

export async function publishSupportNotification(client: any, input: {
  eventKey: string;
  type: SupportNotificationType;
  actorUserId: string;
  requestPublicKey: string;
  requesterUserId?: string | null;
  assigneeUserId?: string | null;
  queueRoles?: string[];
  confidentiality?: string;
  priority?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const fingerprint = createHash("sha256").update(`SUPPORT1A|${input.type}|${input.eventKey}`).digest("hex").slice(0, 24).toUpperCase();
  const campaignNumber = `SUPPORT1A-${input.type}-${fingerprint}`;
  const existing = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { totalRecipientRows: true } });
  if (existing) return { campaignNumber, recipients: existing.totalRecipientRows, idempotent: true };
  const recipients = await resolveRecipients(client, input);
  const copy = notificationCopy(input.type);
  let campaign: { id: string };
  try {
    campaign = await client.notificationCampaign.create({ data: {
      campaignNumber,
      category: input.confidentiality === "SAFEGUARDING" ? "EMERGENCY" : "GENERAL",
      priority: input.priority === "URGENT" || input.type === "URGENT_RESTRICTED_ALERT" ? "URGENT" : input.type === "REQUEST_ESCALATED" ? "HIGH" : "NORMAL",
      title: copy.title,
      body: copy.body,
      actionLabel: copy.actionLabel,
      actionPath: copy.actionPath,
      audienceType: "SPECIFIC_USERS",
      audienceDefinitionJson: JSON.stringify({ governedSupportRequest: true, eventType: input.type }),
      audienceSnapshotJson: JSON.stringify({ resolvedUsers: recipients.length, resolvedAt: now.toISOString(), channel: "IN_APP" }),
      channel: "IN_APP",
      status: "PUBLISHED",
      acknowledgmentRequired: input.type === "URGENT_RESTRICTED_ALERT",
      totalResolvedUsers: recipients.length,
      totalRecipientRows: recipients.length,
      totalSkipped: recipients.length ? 0 : 1,
      createdByUserId: input.actorUserId,
      submittedByUserId: input.actorUserId,
      approvedByUserId: input.actorUserId,
      publishedByUserId: input.actorUserId,
      submittedAt: now,
      approvedAt: now,
      publishedAt: now
    } });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const raced = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { totalRecipientRows: true } });
    if (!raced) throw error;
    return { campaignNumber, recipients: raced.totalRecipientRows, idempotent: true };
  }
  for (const recipient of recipients) {
    await client.notificationRecipient.create({ data: {
      campaignId: campaign.id,
      userId: recipient.id,
      recipientRoleSnapshot: recipient.role,
      contextType: "SUPPORT_REQUEST_PRIVATE",
      recipientContextJson: JSON.stringify({ requestReference: input.requestPublicKey, eventReference: fingerprint }),
      deliveryStatus: "AVAILABLE",
      availableAt: now
    } });
  }
  if (!recipients.length) await client.notificationSkippedRecipient.create({ data: {
    campaignId: campaign.id,
    targetType: "SUPPORT_REQUEST_SCOPE",
    targetReferenceKey: fingerprint,
    reasonCode: "NO_ACTIVE_AUTHORISED_USER",
    safeContextJson: JSON.stringify({ eventType: input.type })
  } });
  await client.notificationEvent.create({ data: {
    campaignId: campaign.id,
    eventType: `SUPPORT_${input.type}_NOTIFIED`,
    newStatus: "PUBLISHED",
    reason: recipients.length ? `Resolved ${recipients.length} authorised recipient(s).` : "No active authorised recipient was available.",
    recordedByUserId: input.actorUserId,
    eventDate: now
  } });
  return { campaignNumber, recipients: recipients.length, idempotent: false };
}

async function resolveRecipients(client: any, input: Parameters<typeof publishSupportNotification>[1]) {
  const direct = new Set<string>();
  if (["REQUEST_ACKNOWLEDGED", "REQUESTER_VISIBLE_RESPONSE", "INFORMATION_REQUESTED", "REQUEST_RESOLVED", "REQUEST_CLOSED", "REQUEST_REOPENED", "SATISFACTION_REQUEST"].includes(input.type) && input.requesterUserId) direct.add(input.requesterUserId);
  if (input.type === "REQUEST_ASSIGNED" && input.assigneeUserId) direct.add(input.assigneeUserId);
  if (input.type === "REQUEST_SUBMITTED" && input.requesterUserId) direct.add(input.requesterUserId);
  if (input.type === "REQUEST_SUBMITTED") {
    const routine = await activeUsersForRoles(client, input.queueRoles ?? []);
    const nonLeadership = routine.filter((row: any) => !["SUPER_ADMIN", "DIRECTOR"].includes(row.role));
    for (const row of (nonLeadership.length ? nonLeadership : routine).slice(0, 20)) direct.add(row.id);
  }
  if (["REQUEST_ESCALATED", "URGENT_RESTRICTED_ALERT"].includes(input.type)) {
    const leadershipRoles = input.confidentiality === "SAFEGUARDING" ? ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"] : ["SUPER_ADMIN", "DIRECTOR"];
    for (const row of await activeUsersForRoles(client, leadershipRoles)) direct.add(row.id);
  }
  return client.user.findMany({ where: { id: { in: [...direct] }, isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true }, orderBy: { id: "asc" }, take: 50 });
}

async function activeUsersForRoles(client: any, roles: string[]) {
  if (!roles.length) return [];
  const now = new Date();
  return client.user.findMany({ where: { isActive: true, lifecycleStatus: "ACTIVE", iamRoleAssignments: { some: { role: { in: roles }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } }, select: { id: true, role: true }, orderBy: { id: "asc" }, take: 50 });
}

function notificationCopy(type: SupportNotificationType) {
  if (type === "REQUEST_SUBMITTED") return { title: "Support request received", body: "A governed support request is available to authorised participants.", actionLabel: "Open Support", actionPath: "/support" };
  if (type === "REQUEST_ACKNOWLEDGED") return { title: "Support request acknowledged", body: "The school has acknowledged your support request.", actionLabel: "Open My Support", actionPath: "/my-support" };
  if (type === "REQUEST_ASSIGNED") return { title: "Support request assigned", body: "A support request has been assigned within your authorised queue.", actionLabel: "Open Support", actionPath: "/support" };
  if (type === "REQUESTER_VISIBLE_RESPONSE") return { title: "New support response", body: "A requester-visible response is available in your private support timeline.", actionLabel: "Open My Support", actionPath: "/my-support" };
  if (type === "INFORMATION_REQUESTED") return { title: "Information requested", body: "The school requested additional information in your private support timeline.", actionLabel: "Open My Support", actionPath: "/my-support" };
  if (type === "REQUEST_ESCALATED") return { title: "Support request escalated", body: "An authorised support request requires leadership attention.", actionLabel: "Open Oversight", actionPath: "/support" };
  if (type === "URGENT_RESTRICTED_ALERT") return { title: "Urgent restricted support alert", body: "An urgent restricted case requires immediate authorised review. No case details are included here.", actionLabel: "Open Restricted Queue", actionPath: "/support" };
  if (type === "REQUEST_RESOLVED") return { title: "Support request resolved", body: "A resolution summary is available in your private support timeline.", actionLabel: "Open My Support", actionPath: "/my-support" };
  if (type === "REQUEST_CLOSED") return { title: "Support request closed", body: "Your support request has been closed with its history preserved.", actionLabel: "Open My Support", actionPath: "/my-support" };
  if (type === "REQUEST_REOPENED") return { title: "Support request reopened", body: "The support request has returned to its governed queue.", actionLabel: "Open Support", actionPath: "/my-support" };
  return { title: "Support feedback", body: "You may optionally provide private service feedback for the latest resolution.", actionLabel: "Open My Support", actionPath: "/my-support" };
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
