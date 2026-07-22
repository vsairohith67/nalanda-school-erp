import type { PrismaClient } from "@prisma/client";
import { createCloudBackupProvider } from "@/lib/cloud-backup-provider";
import {
  CLOUD_BACKUP_ALGORITHM,
  CLOUD_BACKUP_COMPRESSION,
  CLOUD_BACKUP_CONTAINER_VERSION,
  encryptionKeyEnvironmentName,
  loadCloudBackupKey
} from "@/lib/cloud-backup-container";

export async function createCloudBackupProfile(
  prisma: PrismaClient,
  input: {
    profileCode: string;
    name: string;
    providerKind: string;
    destinationLabel: string;
    encryptionKeyVersion: string;
  },
  actorUserId?: string
) {
  const profileCode = requireCode(input.profileCode, "Profile code");
  const providerKind = input.providerKind.toUpperCase();
  if (!["MOCK", "LOCAL_FOLDER", "OBJECT_STORAGE", "GOOGLE_DRIVE"].includes(providerKind)) throw new Error("Unsupported cloud backup provider.");
  if (!input.name.trim() || input.name.length > 100 || !input.destinationLabel.trim() || input.destinationLabel.length > 120) throw new Error("Profile name and destination label are required.");
  if (!/^V[1-9][0-9]{0,2}$/.test(input.encryptionKeyVersion.toUpperCase())) throw new Error("Encryption key version must use V1 through V999.");
  return prisma.$transaction(async (tx) => {
    const profile = await tx.cloudBackupProfile.create({ data: {
      profileCode,
      name: input.name.trim(),
      providerKind,
      status: "CONFIGURED",
      liveUseEnabled: false,
      destinationLabel: input.destinationLabel.trim(),
      encryptionKeyVersion: input.encryptionKeyVersion.toUpperCase(),
      containerFormatVersion: CLOUD_BACKUP_CONTAINER_VERSION,
      compressionAlgorithm: CLOUD_BACKUP_COMPRESSION,
      encryptionAlgorithm: CLOUD_BACKUP_ALGORITHM,
      verificationRequired: true,
      privateAssetsIncluded: false
    } });
    await tx.cloudBackupRetentionPolicy.create({ data: {
      policyCode: `${profileCode}-RETENTION`,
      profileId: profile.id,
      keepLatestVerifiedCount: 2,
      minimumVerifiedCopies: 2,
      autoPruneEnabled: false,
      createdByUserId: actorUserId
    } });
    await tx.cloudBackupEvent.create({ data: {
      profileId: profile.id,
      eventType: "PROFILE_CREATED",
      safeMetadataJson: JSON.stringify({ providerKind, liveUseEnabled: false }),
      recordedByUserId: actorUserId
    } });
    return profile;
  });
}

export async function cloudBackupProfileHealth(prisma: PrismaClient, profileId: string) {
  const profile = await prisma.cloudBackupProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Cloud backup profile was not found.");
  let keyReady = false;
  let keyMessage = `${encryptionKeyEnvironmentName(profile.encryptionKeyVersion)} is unavailable.`;
  try {
    loadCloudBackupKey(profile.encryptionKeyVersion);
    keyReady = true;
    keyMessage = `Environment key ${profile.encryptionKeyVersion} is ready.`;
  } catch (error) {
    keyMessage = error instanceof Error ? error.message : keyMessage;
  }
  const provider = createCloudBackupProvider(profile);
  const providerHealth = await provider.healthCheck();
  const ready = keyReady && providerHealth.ready && ["MOCK", "LOCAL_FOLDER"].includes(profile.providerKind);
  const safeMessage = `${providerHealth.safeMessage} ${keyMessage}`;
  await prisma.cloudBackupProfile.update({ where: { id: profile.id }, data: {
    lastHealthCheckAt: new Date(),
    lastHealthCheckStatus: ready ? "READY" : "NOT_READY",
    lastHealthCheckMessage: safeMessage
  } });
  return { ready, providerKind: profile.providerKind, liveUseEnabled: false, keyVersion: profile.encryptionKeyVersion, safeMessage };
}

export async function setCloudBackupProfileStatus(
  prisma: PrismaClient,
  profileId: string,
  action: "activate" | "pause",
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.cloudBackupProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new Error("Cloud backup profile was not found.");
    if (!["MOCK", "LOCAL_FOLDER"].includes(profile.providerKind)) throw new Error("LIVE provider activation is disabled in Prompt 20C.");
    if (action === "activate") {
      const other = await tx.cloudBackupProfile.findFirst({ where: { status: "ACTIVE", id: { not: profile.id } } });
      if (other) throw new Error("Pause the current active automatic backup profile first.");
    }
    const updated = await tx.cloudBackupProfile.update({ where: { id: profile.id }, data: action === "activate"
      ? { status: "ACTIVE", liveUseEnabled: false, activatedByUserId: actorUserId, pausedByUserId: null }
      : { status: "PAUSED", liveUseEnabled: false, pausedByUserId: actorUserId }
    });
    await tx.cloudBackupEvent.create({ data: {
      profileId: profile.id,
      eventType: action === "activate" ? "PROFILE_ACTIVATED" : "PROFILE_PAUSED",
      recordedByUserId: actorUserId
    } });
    return updated;
  });
}

function requireCode(value: string, label: string) {
  const code = value.trim().toUpperCase();
  if (!/^QA20C-[A-Z0-9-]{3,40}$/.test(code)) throw new Error(`${label} must use a QA20C-prefixed safe code.`);
  return code;
}
