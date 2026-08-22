import { createHash } from "node:crypto";

export type ParentMeetingNotificationType =
  | "REQUESTED"
  | "SCHEDULED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "UPCOMING"
  | "COMPLETED"
  | "NO_SHOW"
  | "SUMMARY_PUBLISHED"
  | "SUMMARY_CORRECTED"
  | "FOLLOW_UP_CREATED"
  | "FOLLOW_UP_DUE"
  | "FOLLOW_UP_DONE";

export async function publishParentMeetingNotification(client: any, input: {
  eventKey: string;
  type: ParentMeetingNotificationType;
  actorUserId: string;
  meetingPublicKey: string;
  requesterGuardianId?: string | null;
  includeParent?: boolean;
  participantStaffMemberIds?: string[];
  leadershipRecipients?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const fingerprint = createHash("sha256")
    .update(`PARENTMEETING15|${input.type}|${input.eventKey}`)
    .digest("hex").slice(0, 24).toUpperCase();
  const campaignNumber = `PARENTMEETING15-${input.type}-${fingerprint}`;
  const existing = await client.notificationCampaign.findUnique({
    where: { campaignNumber }, select: { totalRecipientRows: true }
  });
  if (existing) return { campaignNumber, recipients: existing.totalRecipientRows, idempotent: true };

  const recipients = await resolveRecipients(client, input, now);
  const copy = notificationCopy(input.type);
  let campaign: { id: string };
  try {
    const createCampaign = async (db: any) => {
      const created = await db.notificationCampaign.create({ data: {
      campaignNumber,
      category: "GENERAL",
      priority: ["CANCELLED", "NO_SHOW", "FOLLOW_UP_DUE"].includes(input.type) ? "HIGH" : "NORMAL",
      title: copy.title,
      body: copy.body,
      audienceType: "SPECIFIC_USERS",
      audienceDefinitionJson: JSON.stringify({ governedParentMeeting: true, eventType: input.type }),
      audienceSnapshotJson: JSON.stringify({ resolvedUsers: recipients.length, resolvedAt: now.toISOString(), channel: "IN_APP" }),
      channel: "IN_APP",
      status: "PUBLISHED",
      acknowledgmentRequired: false,
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

      for (const recipient of recipients) {
        await db.notificationRecipient.create({ data: {
          campaignId: created.id,
          userId: recipient.id,
          recipientRoleSnapshot: recipient.role,
          contextType: "PARENT_MEETING_PRIVATE",
          recipientContextJson: JSON.stringify({ meetingReference: input.meetingPublicKey, eventReference: fingerprint }),
          deliveryStatus: "AVAILABLE",
          availableAt: now
        } });
      }
      if (!recipients.length) await db.notificationSkippedRecipient.create({ data: {
        campaignId: created.id,
        targetType: "PARENT_MEETING_SCOPE",
        targetReferenceKey: fingerprint,
        reasonCode: "NO_ACTIVE_AUTHORISED_USER",
        safeContextJson: JSON.stringify({ eventType: input.type })
      } });
      await db.notificationEvent.create({ data: {
        campaignId: created.id,
        eventType: `PARENT_MEETING_${input.type}`,
        newStatus: "PUBLISHED",
        reason: recipients.length ? `Resolved ${recipients.length} authorised recipient(s).` : "No active authorised recipient was available.",
        recordedByUserId: input.actorUserId,
        eventDate: now
      } });
      return created;
    };
    campaign = typeof client.$transaction === "function"
      ? await client.$transaction((tx: any) => createCampaign(tx))
      : await createCampaign(client);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const raced = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { totalRecipientRows: true } });
    if (!raced) throw error;
    return { campaignNumber, recipients: raced.totalRecipientRows, idempotent: true };
  }

  return { campaignNumber, recipients: recipients.length, idempotent: false };
}

async function resolveRecipients(client: any, input: Parameters<typeof publishParentMeetingNotification>[1], now: Date) {
  const ids = new Set<string>();
  if (input.includeParent !== false && input.requesterGuardianId) {
    const parentUsers = await client.user.findMany({
      where: { guardianId: input.requesterGuardianId, isActive: true, lifecycleStatus: "ACTIVE" },
      select: { id: true }, take: 10
    });
    for (const user of parentUsers) ids.add(user.id);
  }
  if (input.participantStaffMemberIds?.length) {
    const participantUsers = await client.staffMember.findMany({
      where: { id: { in: [...new Set(input.participantStaffMemberIds)] }, status: "ACTIVE", userId: { not: null } },
      select: { userId: true }, take: 50
    });
    for (const staff of participantUsers) if (staff.userId) ids.add(staff.userId);
  }
  if (input.leadershipRecipients) {
    const leadership = await client.user.findMany({
      where: {
        isActive: true,
        lifecycleStatus: "ACTIVE",
        iamRoleAssignments: { some: { role: { in: ["SUPER_ADMIN", "PRINCIPAL"] }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } }
      },
      select: { id: true }, take: 30
    });
    for (const user of leadership) ids.add(user.id);
  }
  return client.user.findMany({
    where: { id: { in: [...ids] }, isActive: true, lifecycleStatus: "ACTIVE" },
    select: { id: true, role: true }, orderBy: { id: "asc" }, take: 80
  });
}

function notificationCopy(type: ParentMeetingNotificationType) {
  if (type === "REQUESTED") return { title: "Parent meeting requested", body: "A governed Parent meeting request is available to authorised participants." };
  if (type === "SCHEDULED") return { title: "Parent meeting scheduled", body: "The Parent meeting schedule is available in the private ERP." };
  if (type === "RESCHEDULED") return { title: "Parent meeting rescheduled", body: "The Parent meeting schedule has changed. Review the confirmed local time in the ERP." };
  if (type === "CANCELLED") return { title: "Parent meeting cancelled", body: "The Parent meeting was cancelled. Any Parent-safe explanation is available in the private meeting record." };
  if (type === "UPCOMING") return { title: "Parent meeting upcoming", body: "An assigned Parent meeting is approaching. Review its private schedule in the ERP." };
  if (type === "COMPLETED") return { title: "Parent meeting completed", body: "The Parent meeting occurrence has been recorded." };
  if (type === "NO_SHOW") return { title: "Parent meeting no-show recorded", body: "A no-show outcome was recorded for an authorised Parent meeting." };
  if (type === "SUMMARY_PUBLISHED") return { title: "Meeting summary available", body: "The school released a Parent-visible meeting summary." };
  if (type === "SUMMARY_CORRECTED") return { title: "Meeting summary corrected", body: "The school published a preserved correction to the Parent-visible meeting summary." };
  if (type === "FOLLOW_UP_CREATED") return { title: "Meeting follow-up created", body: "A governed follow-up was recorded for an authorised Parent meeting." };
  if (type === "FOLLOW_UP_DUE") return { title: "Meeting follow-up due", body: "An assigned Parent meeting follow-up is due in the private ERP." };
  return { title: "Meeting follow-up completed", body: "The Parent meeting follow-up was completed with history preserved." };
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
