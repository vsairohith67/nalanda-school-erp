import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { buildNotificationReport, notificationReportCsv, notificationReportFilename } from "@/lib/notification-reports";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_NOTIFICATION_REPORTS");
  if (auth.response) return auth.response;
  const report = await buildNotificationReport(prisma);
  return new NextResponse(notificationReportCsv(report), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${notificationReportFilename()}"`,
      "cache-control": "private, no-store"
    }
  });
}
