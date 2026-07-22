import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { ownNotificationDetail } from "@/lib/notification-portals";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ campaignNumber: string }> }) {
  const auth = await requireApiPermission("VIEW_OWN_NOTIFICATIONS");
  if (auth.response) return auth.response;
  try {
    const { campaignNumber } = await params;
    const notification = await ownNotificationDetail(prisma, campaignNumber, auth.user);
    return NextResponse.json({ notification });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Notification was not found") }, { status: 404 });
  }
}
