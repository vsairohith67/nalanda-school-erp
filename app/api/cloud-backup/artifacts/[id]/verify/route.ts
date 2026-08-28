import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoredCloudBackupArtifact } from "@/lib/cloud-backup-verification";
import { requiresPortableBackupWorker } from "@/lib/cloud-backup-worker";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VERIFY_CLOUD_BACKUP"); if (auth.response) return auth.response;
  const artifactId = (await params).id;
  const artifact = await prisma.cloudBackupArtifact.findUnique({
    where: { id: artifactId },
    include: { run: { include: { profile: true } } }
  });
  if (!artifact) return NextResponse.json({ error: "Verified backup artifact was not found." }, { status: 404 });
  if (requiresPortableBackupWorker(artifact.run.profile)) {
    return NextResponse.json(
      { error: "Portable backup read-back verification requires the separately authorised backup job." },
      { status: 409, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  return NextResponse.json(await verifyStoredCloudBackupArtifact(prisma, artifactId, auth.user.id), { headers: { "Cache-Control": "private, no-store" } });
}
