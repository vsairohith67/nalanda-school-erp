import type { PrismaClient } from "@prisma/client";
import { getUserEffectivePermissions } from "@/lib/iam/effective-access";

export async function publishCriticalOperationalAlertNotification(client: PrismaClient, alert: {
  id: string;
  publicKey: string;
  fingerprint: string;
  titleSafe: string;
  evidenceSummarySafe: string;
  severity: string;
  version: number;
}, now = new Date()) {
  if (alert.severity !== "CRITICAL") return { recipients: 0, skipped: true };
  const candidates = await client.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "DIRECTOR"] }, isActive: true, lifecycleStatus: "ACTIVE" },
    select: { id: true, role: true },
    orderBy: { id: "asc" }
  });
  const recipients: typeof candidates = [];
  for (const candidate of candidates) {
    if (candidate.role === "SUPER_ADMIN") recipients.push(candidate);
    else if ((await getUserEffectivePermissions(client, { userId: candidate.id })).has("VIEW_TECHNICAL_OPERATIONS")) recipients.push(candidate);
  }
  const campaignNumber = `OPS1A-CRITICAL-${alert.fingerprint.slice(0, 20).toUpperCase()}-${alert.version}`;
  const existing = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { totalRecipientRows: true } });
  if (existing) return { recipients: existing.totalRecipientRows, skipped: true };
  return client.$transaction(async (tx) => {
    const campaign = await tx.notificationCampaign.create({ data: {
      campaignNumber,
      category: "SYSTEM",
      priority: "URGENT",
      title: alert.titleSafe,
      body: alert.evidenceSummarySafe,
      actionLabel: "Open Technical Operations",
      actionPath: "/technical-operations",
      audienceType: "SPECIFIC_USERS",
      audienceDefinitionJson: JSON.stringify({ source: "OBS-1A", severity: "CRITICAL" }),
      audienceSnapshotJson: JSON.stringify({ resolvedCount: recipients.length, channel: "IN_APP" }),
      channel: "IN_APP",
      status: "PUBLISHED",
      acknowledgmentRequired: true,
      totalResolvedUsers: recipients.length,
      totalRecipientRows: recipients.length,
      totalSkipped: recipients.length ? 0 : 1,
      submittedAt: now,
      approvedAt: now,
      publishedAt: now
    } });
    for (const recipient of recipients) await tx.notificationRecipient.create({ data: {
      campaignId: campaign.id,
      userId: recipient.id,
      recipientRoleSnapshot: recipient.role,
      contextType: "TECHNICAL_OPERATIONS_ALERT",
      recipientContextJson: JSON.stringify({ alertReference: alert.publicKey }),
      deliveryStatus: "AVAILABLE",
      availableAt: now
    } });
    if (!recipients.length) await tx.notificationSkippedRecipient.create({ data: { campaignId: campaign.id, targetType: "TECHNICAL_OPERATIONS", targetReferenceKey: alert.publicKey, reasonCode: "NO_ACTIVE_AUTHORISED_USER", safeContextJson: JSON.stringify({ severity: "CRITICAL" }) } });
    await tx.notificationEvent.create({ data: { campaignId: campaign.id, eventType: "OPERATIONAL_CRITICAL_ALERT_PUBLISHED", newStatus: "PUBLISHED", reason: recipients.length ? `Resolved ${recipients.length} authorised recipient(s).` : "No active authorised recipient was available.", eventDate: now } });
    return { recipients: recipients.length, skipped: false };
  });
}
