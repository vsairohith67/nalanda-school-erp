import { createHash } from "node:crypto";

export type PayslipNotificationType = "REQUEST_SUBMITTED" | "STATUS_CHANGED" | "DOCUMENT_ISSUED" | "REQUEST_REJECTED" | "DOCUMENT_REPLACED" | "PROCESSING_OVERDUE";

export async function publishPayslipRequestNotification(client: any, input: {
  eventKey: string;
  type: PayslipNotificationType;
  actorUserId: string;
  requestPublicKey: string;
  staffUserId?: string | null;
  assignedPreparerUserId?: string | null;
  assignedPreparerOnly?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const fingerprint = createHash("sha256").update(`PAYSLIPREQ1|${input.type}|${input.eventKey}`).digest("hex").slice(0, 24).toUpperCase();
  const campaignNumber = `PAYSLIPREQ1-${input.type}-${fingerprint}`;
  const existing = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { totalRecipientRows: true } });
  if (existing) return { campaignNumber, recipients: existing.totalRecipientRows, idempotent: true };
  const recipients = input.assignedPreparerOnly && input.assignedPreparerUserId
    ? await activeUsers(client, [input.assignedPreparerUserId])
    : input.type === "REQUEST_SUBMITTED" || input.type === "PROCESSING_OVERDUE"
    ? await managementRecipients(client, input.assignedPreparerUserId)
    : input.staffUserId ? await activeUsers(client, [input.staffUserId]) : [];
  const copy = notificationCopy(input.type);
  let campaign: { id: string };
  try {
    campaign = await client.notificationCampaign.create({ data: {
      campaignNumber,
      category: "HUMAN_RESOURCES",
      priority: input.type === "REQUEST_REJECTED" || input.type === "PROCESSING_OVERDUE" ? "HIGH" : "NORMAL",
      title: copy.title,
      body: copy.body,
      actionLabel: copy.actionLabel,
      actionPath: copy.actionPath,
      audienceType: "SPECIFIC_USERS",
      audienceDefinitionJson: JSON.stringify({ governedPayslipRequest: true, eventType: input.type }),
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
      contextType: "PAYSLIP_REQUEST_PRIVATE",
      recipientContextJson: JSON.stringify({ requestReference: input.requestPublicKey, eventReference: fingerprint }),
      deliveryStatus: "AVAILABLE",
      availableAt: now
    } });
  }
  if (!recipients.length) await client.notificationSkippedRecipient.create({ data: {
    campaignId: campaign.id,
    targetType: "PAYSLIP_REQUEST_SCOPE",
    targetReferenceKey: fingerprint,
    reasonCode: "NO_ACTIVE_AUTHORISED_USER",
    safeContextJson: JSON.stringify({ eventType: input.type })
  } });
  await client.notificationEvent.create({ data: {
    campaignId: campaign.id,
    eventType: `PAYSLIP_REQUEST_${input.type}_NOTIFIED`,
    newStatus: "PUBLISHED",
    reason: recipients.length ? `Resolved ${recipients.length} authorised recipient(s).` : "No active authorised recipient was available.",
    recordedByUserId: input.actorUserId,
    eventDate: now
  } });
  return { campaignNumber, recipients: recipients.length, idempotent: false };
}

async function managementRecipients(client: any, assignedPreparerUserId?: string | null) {
  const now = new Date();
  const rows = await client.user.findMany({
    where: {
      isActive: true,
      lifecycleStatus: "ACTIVE",
      OR: [
        { iamRoleAssignments: { some: { role: { in: ["SUPER_ADMIN", "DIRECTOR"] }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } },
        ...(assignedPreparerUserId ? [{ id: assignedPreparerUserId }] : [])
      ]
    },
    select: { id: true, role: true },
    orderBy: { id: "asc" },
    take: 100
  });
  return [...new Map(rows.map((row: { id: string; role: string }) => [row.id, row])).values()];
}

async function activeUsers(client: any, ids: string[]) {
  return client.user.findMany({ where: { id: { in: ids }, isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true }, take: 10 });
}

function notificationCopy(type: PayslipNotificationType) {
  if (type === "REQUEST_SUBMITTED") return { title: "New payslip request", body: "A private Staff payslip request is ready for authorised review.", actionLabel: "Open Request Queue", actionPath: "/payslip-requests" };
  if (type === "DOCUMENT_ISSUED") return { title: "Payslip document issued", body: "A password-protected, editing-restricted and tamper-evident payslip document is available in your private Staff portal.", actionLabel: "Open Payslip Requests", actionPath: "/my-payslip-requests" };
  if (type === "REQUEST_REJECTED") return { title: "Payslip request update", body: "Your private payslip request was not issued. Open the request timeline for the approved reason.", actionLabel: "Open Request", actionPath: "/my-payslip-requests" };
  if (type === "DOCUMENT_REPLACED") return { title: "Payslip document replaced", body: "A corrected protected payslip version is available. The former version is no longer downloadable.", actionLabel: "Open Payslip Requests", actionPath: "/my-payslip-requests" };
  if (type === "PROCESSING_OVERDUE") return { title: "Payslip request requires attention", body: "An authorised payslip request has passed its required-by date.", actionLabel: "Open Request Queue", actionPath: "/payslip-requests" };
  return { title: "Payslip request status updated", body: "Your private payslip request timeline has been updated.", actionLabel: "Open Request", actionPath: "/my-payslip-requests" };
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
