import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoredCloudBackupArtifact } from "@/lib/cloud-backup-verification";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VERIFY_CLOUD_BACKUP"); if (auth.response) return auth.response;
  return NextResponse.json(await verifyStoredCloudBackupArtifact(prisma, (await params).id, auth.user.id), { headers: { "Cache-Control": "private, no-store" } });
}
