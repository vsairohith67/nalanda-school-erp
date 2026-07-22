import { indiaLocalDateKey } from "@/lib/notification-visibility";

export async function buildNotificationReport(client: any) {
  const [campaigns, skipped, legacyParentNotices] = await Promise.all([
    client.notificationCampaign.findMany({
      select: {
        campaignNumber: true, status: true, category: true, priority: true, audienceType: true,
        channel: true, scheduledFor: true, publishedAt: true, withdrawnAt: true, expiresAt: true,
        acknowledgmentRequired: true, totalResolvedUsers: true, totalRecipientRows: true,
        totalSkipped: true, totalRead: true, totalAcknowledged: true, totalDismissed: true,
        correctionOfCampaignId: true, createdByUserId: true,
        recipients: { select: { availableAt: true, readAt: true } }
      },
      orderBy: [{ createdAt: "desc" }]
    }),
    client.notificationSkippedRecipient.groupBy({ by: ["reasonCode"], _count: { _all: true } }),
    client.notice.count({ where: { status: "PUBLISHED" } })
  ]);
  const group = (key: string) => Object.entries(campaigns.reduce((map: Record<string, number>, row: any) => {
    const value = String(row[key] ?? "NONE");
    map[value] = (map[value] ?? 0) + 1;
    return map;
  }, {})).map(([label, count]) => ({ label, count }));
  const readDurations = campaigns.flatMap((campaign: any) => campaign.recipients
    .filter((recipient: any) => recipient.readAt)
    .map((recipient: any) => (recipient.readAt.getTime() - recipient.availableAt.getTime()) / 60_000)
    .filter((minutes: number) => minutes >= 0));
  return {
    generatedAt: new Date(),
    byStatus: group("status"),
    byCategory: group("category"),
    byPriority: group("priority"),
    byAudienceType: group("audienceType"),
    skippedReasons: skipped.map((row: any) => ({ label: row.reasonCode, count: row._count._all })),
    totals: {
      campaigns: campaigns.length,
      scheduled: campaigns.filter((row: any) => row.status === "SCHEDULED").length,
      published: campaigns.filter((row: any) => row.status === "PUBLISHED").length,
      withdrawn: campaigns.filter((row: any) => row.status === "WITHDRAWN").length,
      cancelled: campaigns.filter((row: any) => row.status === "CANCELLED").length,
      archived: campaigns.filter((row: any) => row.status === "ARCHIVED").length,
      resolvedUsers: campaigns.reduce((sum: number, row: any) => sum + row.totalResolvedUsers, 0),
      recipientRows: campaigns.reduce((sum: number, row: any) => sum + row.totalRecipientRows, 0),
      skipped: campaigns.reduce((sum: number, row: any) => sum + row.totalSkipped, 0),
      read: campaigns.reduce((sum: number, row: any) => sum + row.totalRead, 0),
      unread: campaigns.reduce((sum: number, row: any) => sum + Math.max(0, row.totalRecipientRows - row.totalRead), 0),
      acknowledgmentRequired: campaigns.filter((row: any) => row.acknowledgmentRequired).length,
      acknowledged: campaigns.reduce((sum: number, row: any) => sum + row.totalAcknowledged, 0),
      dismissed: campaigns.reduce((sum: number, row: any) => sum + row.totalDismissed, 0),
      expired: campaigns.filter((row: any) => row.expiresAt && row.expiresAt <= new Date()).length,
      teacherAwaitingReview: campaigns.filter((row: any) => row.audienceType === "TEACHER_TIMETABLE_SCOPE" && row.status === "READY_FOR_REVIEW").length,
      corrections: campaigns.filter((row: any) => row.correctionOfCampaignId).length,
      averageMinutesToRead: readDurations.length ? Math.round(readDurations.reduce((sum: number, value: number) => sum + value, 0) / readDurations.length) : null,
      legacyParentNotices
    },
    campaigns: campaigns.map((row: any) => ({
      campaignNumber: row.campaignNumber,
      status: row.status,
      category: row.category,
      priority: row.priority,
      audienceType: row.audienceType,
      channel: row.channel,
      scheduledFor: row.scheduledFor,
      publishedAt: row.publishedAt,
      resolvedUsers: row.totalResolvedUsers,
      recipientRows: row.totalRecipientRows,
      skipped: row.totalSkipped,
      read: row.totalRead,
      unread: Math.max(0, row.totalRecipientRows - row.totalRead),
      acknowledged: row.totalAcknowledged,
      dismissed: row.totalDismissed,
      correction: Boolean(row.correctionOfCampaignId)
    }))
  };
}

export function notificationReportCsv(report: Awaited<ReturnType<typeof buildNotificationReport>>) {
  const columns = ["Campaign Number", "Status", "Category", "Priority", "Audience Type", "Channel", "Scheduled For", "Published At", "Resolved Users", "Recipient Rows", "Skipped", "Read", "Unread", "Acknowledged", "Dismissed", "Correction"] as const;
  const rows = report.campaigns.map((row: any) => [
    row.campaignNumber, row.status, row.category, row.priority, row.audienceType, row.channel,
    row.scheduledFor?.toISOString() ?? "", row.publishedAt?.toISOString() ?? "", row.resolvedUsers,
    row.recipientRows, row.skipped, row.read, row.unread, row.acknowledged, row.dismissed, row.correction ? "YES" : "NO"
  ]);
  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function notificationReportFilename(now = new Date()) {
  return `notification-aggregate-report-${indiaLocalDateKey(now)}.csv`;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
