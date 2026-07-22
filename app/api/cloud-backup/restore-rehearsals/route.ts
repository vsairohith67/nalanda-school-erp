import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runCloudBackupRestoreRehearsal } from "@/lib/cloud-backup-rehearsal";

export async function GET() {
  const auth = await requireApiPermission("RUN_CLOUD_BACKUP_RESTORE_REHEARSAL"); if (auth.response) return auth.response;
  return NextResponse.json({ rehearsals: await prisma.cloudBackupRestoreRehearsal.findMany({ include: { run: { select: { runNumber: true } } }, orderBy: { createdAt: "desc" }, take: 500 }) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("RUN_CLOUD_BACKUP_RESTORE_REHEARSAL"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), artifactId = String(body.artifactId ?? "");
    if (body.confirmation !== `REHEARSE ${artifactId}`) throw new Error("Exact isolated-rehearsal confirmation is required.");
    return NextResponse.json({ rehearsal: await runCloudBackupRestoreRehearsal(prisma, artifactId, auth.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Restore rehearsal failed safely.") }, { status: 400, headers: { "Cache-Control": "private, no-store" } }); }
}
