import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { listOwnNotifications } from "@/lib/notification-portals";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_OWN_NOTIFICATIONS");
  if (auth.response) return auth.response;
  const notifications = await listOwnNotifications(prisma, auth.user, {
    history: request.nextUrl.searchParams.get("view") === "history"
  });
  return NextResponse.json({ notifications });
}
