import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { ownNotificationDetail } from "@/lib/notification-portals";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ campaignNumber: string }> }) {
  const auth = await requireApiPermission("VIEW_OWN_NOTIFICATIONS");
  if (auth.response) return auth.response;
  if (auth.user.role !== "PARENT") return NextResponse.json({ error: "Parent access required" }, { status: 403 });
  try {
    return NextResponse.json({ notification: await ownNotificationDetail(prisma, (await params).campaignNumber, auth.user) });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Notification was not found") }, { status: 404 });
  }
}
