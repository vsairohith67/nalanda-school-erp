import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createNotificationCampaign } from "@/lib/notification-campaigns";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("CREATE_SCOPED_NOTIFICATIONS");
  if (auth.response) return auth.response;
  if (auth.user.role !== "TEACHER") return NextResponse.json({ error: "Teacher scoped access required" }, { status: 403 });
  const campaigns = await prisma.notificationCampaign.findMany({
    where: { createdByUserId: auth.user.id, audienceType: "TEACHER_TIMETABLE_SCOPE" },
    select: {
      id: true, campaignNumber: true, category: true, priority: true, title: true, audienceType: true,
      status: true, scheduledFor: true, expiresAt: true, totalResolvedUsers: true, totalSkipped: true, createdAt: true
    },
    orderBy: [{ createdAt: "desc" }]
  });
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_SCOPED_NOTIFICATIONS");
  if (auth.response) return auth.response;
  if (auth.user.role !== "TEACHER") return NextResponse.json({ error: "Teacher scoped access required" }, { status: 403 });
  try {
    const campaign = await createNotificationCampaign(prisma, await request.json(), auth.user);
    return NextResponse.json({ campaign: { id: campaign.id, campaignNumber: campaign.campaignNumber, status: campaign.status } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to create Teacher notification draft") }, { status: 400 });
  }
}
