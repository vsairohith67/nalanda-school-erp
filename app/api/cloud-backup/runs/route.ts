import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManualCloudBackupRun, executeCloudBackupRun } from "@/lib/cloud-backup-worker";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VERIFY_CLOUD_BACKUP"); if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status");
  const runs = await prisma.cloudBackupRun.findMany({
    where: status ? { status } : undefined,
    include: { profile: { select: { providerKind: true, name: true } }, artifacts: true, _count: { select: { verifications: true, events: true } } },
    orderBy: { createdAt: "desc" },
    take: 500
  });
  return NextResponse.json({ runs }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("RUN_CLOUD_BACKUP"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const profile = await prisma.cloudBackupProfile.findUnique({ where: { id: String(body.profileId ?? "") } });
    if (!profile) return NextResponse.json({ error: "Cloud backup profile not found." }, { status: 404 });
    if (body.confirmation !== `RUN ${profile.profileCode}`) throw new Error("Exact encrypted-backup confirmation is required.");
    const run = await createManualCloudBackupRun(prisma, profile.id, auth.user.id);
    return NextResponse.json({ run: await executeCloudBackupRun(prisma, run.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Encrypted backup run failed safely.") }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
