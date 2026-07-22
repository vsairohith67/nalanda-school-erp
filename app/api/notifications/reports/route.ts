import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { buildNotificationReport } from "@/lib/notification-reports";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_NOTIFICATION_REPORTS");
  if (auth.response) return auth.response;
  return NextResponse.json({ report: await buildNotificationReport(prisma), privacy: "Aggregate only; no individual Parent read surveillance." });
}
