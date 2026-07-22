import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { previewNotificationAudience } from "@/lib/notification-campaigns";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth = await requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS");
  if (auth.response) {
    auth = await requireApiPermission("CREATE_SCOPED_NOTIFICATIONS");
    if (auth.response) return auth.response;
  }
  try {
    const { id } = await params;
    const campaign = await prisma.notificationCampaign.findUnique({ where: { id } });
    if (!campaign) return NextResponse.json({ error: "Notification campaign was not found" }, { status: 404 });
    const before = await prisma.notificationRecipient.count({ where: { campaignId: id } });
    const preview = await previewNotificationAudience(prisma, campaign, auth.user);
    const after = await prisma.notificationRecipient.count({ where: { campaignId: id } });
    return NextResponse.json({
      preview: {
        recipientCount: preview.recipients.length,
        skippedCount: preview.skipped.length,
        skippedReasons: reasonCounts(preview.skipped),
        summary: preview.summary
      },
      writesPerformed: after - before
    });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to preview notification audience") }, { status: 400 });
  }
}

function reasonCounts(rows: Array<{ reasonCode: string }>) {
  return Object.entries(rows.reduce<Record<string, number>>((map, row) => {
    map[row.reasonCode] = (map[row.reasonCode] ?? 0) + 1;
    return map;
  }, {})).map(([reasonCode, count]) => ({ reasonCode, count }));
}
