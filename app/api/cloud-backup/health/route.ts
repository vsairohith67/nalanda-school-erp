import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudBackupHealthSummary } from "@/lib/cloud-backup-reports";

export async function GET() {
  const auth = await requireApiPermission("VIEW_CLOUD_BACKUP"); if (auth.response) return auth.response;
  return NextResponse.json({ health: await cloudBackupHealthSummary(prisma) }, { headers: { "Cache-Control": "private, no-store" } });
}
