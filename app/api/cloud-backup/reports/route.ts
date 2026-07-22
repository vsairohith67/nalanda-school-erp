import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudBackupAggregateReport } from "@/lib/cloud-backup-reports";

export async function GET() {
  const auth = await requireApiPermission("VIEW_CLOUD_BACKUP_REPORTS"); if (auth.response) return auth.response;
  return NextResponse.json({ report: await cloudBackupAggregateReport(prisma) }, { headers: { "Cache-Control": "private, no-store" } });
}
