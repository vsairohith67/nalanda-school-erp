import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { updateNotificationDraft } from "@/lib/notification-campaigns";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS");
  if (auth.response) return auth.response;
  const { id } = await params;
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id },
    include: {
      skippedRecipients: { select: { reasonCode: true } },
      events: { select: { id: true, eventType: true, eventDate: true, previousStatus: true, newStatus: true, reason: true, notes: true }, orderBy: [{ eventDate: "asc" }] },
      correctionOfCampaign: { select: { campaignNumber: true } },
      supersededByCampaign: { select: { campaignNumber: true } }
    }
  });
  if (!campaign) return NextResponse.json({ error: "Notification campaign was not found" }, { status: 404 });
  const skippedReasons = Object.entries(campaign.skippedRecipients.reduce<Record<string, number>>((map, row) => {
    map[row.reasonCode] = (map[row.reasonCode] ?? 0) + 1;
    return map;
  }, {})).map(([reasonCode, count]) => ({ reasonCode, count }));
  return NextResponse.json({ campaign: safeCampaignDetail(campaign), skippedReasons });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS");
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const campaign = await updateNotificationDraft(prisma, id, await request.json(), auth.user);
    return NextResponse.json({ campaign: safeCampaignDetail(campaign) });
  } catch (error) {
    return NextResponse.json({ error: message(error, "Unable to update notification draft") }, { status: 400 });
  }
}

function safeCampaignDetail(row: any) {
  const {
    createdByUserId: _created, submittedByUserId: _submitted, approvedByUserId: _approved,
    publishedByUserId: _published, withdrawnByUserId: _withdrawn, cancelledByUserId: _cancelled,
    archivedByUserId: _archived, skippedRecipients: _skipped, ...safe
  } = row;
  return safe;
}
function message(error: unknown, fallback: string) { return safeClientError(error, fallback); }
