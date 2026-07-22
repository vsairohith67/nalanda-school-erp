import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { ownUnreadNotificationCount } from "@/lib/notification-portals";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_OWN_NOTIFICATIONS");
  if (auth.response) return auth.response;
  const unread = await ownUnreadNotificationCount(prisma, auth.user.id);
  return NextResponse.json({ unread }, { headers: { "cache-control": "private, no-store" } });
}
