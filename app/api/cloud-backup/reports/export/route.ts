import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudBackupAggregateReport, cloudBackupReportCsv } from "@/lib/cloud-backup-reports";
import { indiaDateKey } from "@/lib/cloud-backup-schedules";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_CLOUD_BACKUP_REPORTS"); if (auth.response) return auth.response;
  const csv = cloudBackupReportCsv(await cloudBackupAggregateReport(prisma));
  return new NextResponse(csv, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="cloud-backup-recovery-report-${indiaDateKey(new Date()).slice(0, 10)}.csv"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}
