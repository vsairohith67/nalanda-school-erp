import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudBackupProfileHealth, createCloudBackupProfile, setCloudBackupProfileStatus } from "@/lib/cloud-backup-profiles";
import { loadCloudBackupKey } from "@/lib/cloud-backup-container";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_PROFILES"); if (auth.response) return auth.response;
  const profiles = await prisma.cloudBackupProfile.findMany({ include: { schedules: true, retentionPolicy: true }, orderBy: { profileCode: "asc" } });
  return NextResponse.json({ profiles }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_PROFILES"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const profile = await createCloudBackupProfile(prisma, {
      profileCode: String(body.profileCode ?? ""),
      name: String(body.name ?? ""),
      providerKind: String(body.providerKind ?? ""),
      destinationLabel: String(body.destinationLabel ?? ""),
      encryptionKeyVersion: String(body.encryptionKeyVersion ?? "")
    }, auth.user.id);
    return NextResponse.json({ profile }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (action === "health") {
    const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_PROFILES"); if (auth.response) return auth.response;
    try { return NextResponse.json({ health: await cloudBackupProfileHealth(prisma, String(body.id ?? "")) }); } catch (error) { return failure(error); }
  }
  if (action === "activate" || action === "pause") {
    const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_PROFILES"); if (auth.response) return auth.response;
    try {
      const profile = await prisma.cloudBackupProfile.findUnique({ where: { id: String(body.id ?? "") } });
      if (!profile) return NextResponse.json({ error: "Cloud backup profile not found." }, { status: 404 });
      if (action === "activate" && body.confirmation !== `ACTIVATE ${profile.profileCode}`) throw new Error("Exact profile activation confirmation is required.");
      return NextResponse.json({ profile: await setCloudBackupProfileStatus(prisma, profile.id, action, auth.user.id) });
    } catch (error) { return failure(error); }
  }
  if (action === "key-version") {
    const auth = await requireApiPermission("CHANGE_CLOUD_BACKUP_KEY_VERSION"); if (auth.response) return auth.response;
    try {
      const id = String(body.id ?? ""), version = String(body.version ?? "").toUpperCase();
      if (!/^V[1-9][0-9]{0,2}$/.test(version) || body.confirmation !== `ACTIVATE KEY ${version}`) throw new Error("Exact key-version confirmation is required.");
      loadCloudBackupKey(version);
      const profile = await prisma.cloudBackupProfile.update({ where: { id }, data: { encryptionKeyVersion: version } });
      await prisma.cloudBackupEvent.create({ data: { profileId: id, eventType: "KEY_VERSION_CHANGED", safeMetadataJson: JSON.stringify({ version }), recordedByUserId: auth.user.id } });
      return NextResponse.json({ profile });
    } catch (error) { return failure(error); }
  }
  if (action === "activate-live") {
    const auth = await requireApiPermission("ACTIVATE_LIVE_CLOUD_BACKUP"); if (auth.response) return auth.response;
    return NextResponse.json({ error: "LIVE cloud backup activation is disabled during Prompt 20C. No network call was made." }, { status: 409 });
  }
  return NextResponse.json({ error: "Unsupported cloud backup profile action." }, { status: 400 });
}

function failure(error: unknown) {
  return NextResponse.json({ error: safeClientError(error, "Cloud backup profile action failed safely.") }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
}
