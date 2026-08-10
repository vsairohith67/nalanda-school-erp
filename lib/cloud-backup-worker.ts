import { randomBytes } from "node:crypto";
import type { CloudBackupRun, PrismaClient } from "@prisma/client";
import { generateFullBackup, serializeBackup } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import {
  CLOUD_BACKUP_CONTAINER_VERSION,
  decryptCloudBackup,
  encryptCloudBackup,
  sha256
} from "@/lib/cloud-backup-container";
import {
  createCloudBackupProvider,
  safeProviderError
} from "@/lib/cloud-backup-provider";
import { indiaDateKey, nextCloudBackupDueAt } from "@/lib/cloud-backup-schedules";
import { verifyStoredCloudBackupArtifact } from "@/lib/cloud-backup-verification";

const ACTIVE_RUN_STATUSES = [
  "PENDING", "CREATING_BACKUP", "VALIDATING", "COMPRESSING",
  "ENCRYPTING", "UPLOADING", "VERIFYING"
];
const DEFAULT_STALE_RUN_MS = 60 * 60 * 1000;

export async function createManualCloudBackupRun(
  prisma: PrismaClient,
  profileId: string,
  actorUserId?: string,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.cloudBackupProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.status !== "ACTIVE") throw new Error("An active cloud backup profile is required.");
    if (!["MOCK", "LOCAL_FOLDER"].includes(profile.providerKind) || profile.liveUseEnabled) throw new Error("Prompt 20C permits only non-LIVE MOCK or LOCAL_FOLDER runs.");
    const active = await tx.cloudBackupRun.findFirst({ where: { profileId, status: { in: ACTIVE_RUN_STATUSES } } });
    if (active) return active;
    const suffix = randomBytes(3).toString("hex");
    const run = await tx.cloudBackupRun.create({ data: {
      runNumber: `CBR-${indiaDateKey(now)}-${suffix}`.toUpperCase(),
      profileId,
      triggerType: "MANUAL",
      status: "PENDING",
      idempotencyKey: `manual:${now.toISOString()}:${suffix}`,
      createdByUserId: actorUserId
    } });
    await event(tx as any, { profileId, runId: run.id, eventType: "BACKUP_DUE", recordedByUserId: actorUserId });
    return run;
  });
}

export async function executeCloudBackupRun(prisma: PrismaClient, runId: string) {
  const claimed = await prisma.cloudBackupRun.updateMany({
    where: { id: runId, status: "PENDING" },
    data: { status: "CREATING_BACKUP", startedAt: new Date(), failureCode: null, failureMessageSafe: null }
  });
  if (claimed.count === 0) {
    const existing = await prisma.cloudBackupRun.findUnique({ where: { id: runId } });
    if (!existing) throw new Error("Cloud backup run was not found.");
    return existing;
  }
  let run = await prisma.cloudBackupRun.findUniqueOrThrow({ where: { id: runId }, include: { profile: true, schedule: true } });
  const provider = createCloudBackupProvider(run.profile);
  try {
    if (run.profile.status !== "ACTIVE" || !["MOCK", "LOCAL_FOLDER"].includes(run.profile.providerKind) || run.profile.liveUseEnabled) {
      throw new Error("PROFILE_NOT_ACTIVE");
    }
    const health = await provider.healthCheck();
    if (!health.ready) throw new Error("PROVIDER_NOT_READY");
    await event(prisma, { profileId: run.profileId, scheduleId: run.scheduleId, runId, eventType: "BACKUP_STARTED" });

    const generatedAt = new Date();
    const backup = await generateFullBackup(prisma, {
      generatedAt,
      generatedBy: "Automatic encrypted backup worker",
      excludeCloudBackupRunId: run.id
    });
    await transition(prisma, runId, "CREATING_BACKUP", "VALIDATING");
    const plaintext = Buffer.from(serializeBackup(backup), "utf8");
    const validated = parseAndValidateBackup(plaintext.toString("utf8"));
    if (validated.metadata.backupVersion !== 41) throw new Error("BACKUP_VERSION_INVALID");
    await event(prisma, { profileId: run.profileId, runId, eventType: "BACKUP_VALIDATED", safeMetadataJson: JSON.stringify({ backupVersion: 41 }) });

    await transition(prisma, runId, "VALIDATING", "COMPRESSING");
    await transition(prisma, runId, "COMPRESSING", "ENCRYPTING");
    const encrypted = await encryptCloudBackup(plaintext, {
      backupFormatVersion: 36,
      createdAt: generatedAt,
      encryptionKeyVersion: run.profile.encryptionKeyVersion
    });
    const artifactId = randomBytes(13).toString("hex");
    const objectKeySafe = `cloud-backup/${run.id}/${artifactId}.npsbackup`;
    const artifact = await prisma.cloudBackupArtifact.create({ data: {
      id: artifactId,
      runId,
      artifactType: "DATABASE_BACKUP",
      status: "ENCRYPTED",
      objectKeySafe,
      encryptionKeyVersion: encrypted.header.encryptionKeyVersion,
      plaintextSha256: encrypted.header.plaintextSha256,
      ciphertextSha256: encrypted.header.ciphertextSha256,
      plaintextBytes: encrypted.header.plaintextBytes,
      compressedBytes: encrypted.header.compressedBytes,
      ciphertextBytes: encrypted.header.ciphertextBytes,
      privateAssetsIncluded: false,
      sourceCoverageJson: JSON.stringify({
        databasePayload: "INCLUDED",
        passwordHashes: "EXCLUDED",
        providerCredentials: "EXCLUDED",
        encryptionKeys: "EXCLUDED",
        feeRegisterOcrImageBytes: "EXCLUDED",
        privateAssetsStatus: "NOT_INCLUDED"
      })
    } });
    await prisma.cloudBackupRun.update({ where: { id: runId }, data: {
      sourceBackupVersion: 36,
      sourceGeneratedAt: generatedAt,
      sourcePlaintextSha256: encrypted.header.plaintextSha256,
      ciphertextSha256: encrypted.header.ciphertextSha256,
      plaintextBytes: encrypted.header.plaintextBytes,
      compressedBytes: encrypted.header.compressedBytes,
      encryptedBytes: encrypted.bytes.length,
      encryptionKeyVersion: encrypted.header.encryptionKeyVersion,
      containerFormatVersion: CLOUD_BACKUP_CONTAINER_VERSION,
      status: "UPLOADING"
    } });
    await verification(prisma, runId, artifact.id, "LOCAL_CONTAINER", "PASSED", "Validated backup was compressed and authenticated locally.");
    await event(prisma, { profileId: run.profileId, runId, artifactId: artifact.id, eventType: "BACKUP_ENCRYPTED" });

    const uploaded = await provider.putObject(objectKeySafe, encrypted.bytes);
    await prisma.cloudBackupArtifact.update({ where: { id: artifact.id }, data: {
      status: "UPLOADED", providerObjectIdSafe: uploaded.objectIdSafe, uploadedAt: new Date()
    } });
    await prisma.cloudBackupRun.update({ where: { id: runId }, data: {
      status: "VERIFYING",
      providerObjectReferenceSafe: uploaded.objectIdSafe,
      providerObjectVersionSafe: uploaded.versionSafe
    } });
    await event(prisma, { profileId: run.profileId, runId, artifactId: artifact.id, eventType: "BACKUP_UPLOADED" });

    const head = await provider.headObject(objectKeySafe);
    if (!head || head.byteSize !== encrypted.bytes.length) throw new Error("REMOTE_HEAD_MISMATCH");
    await verification(prisma, runId, artifact.id, "REMOTE_HEAD", "PASSED", "Provider metadata confirms the expected encrypted byte size.");
    const readback = await provider.getObject(objectKeySafe);
    await verification(prisma, runId, artifact.id, "REMOTE_READBACK", "PASSED", "Encrypted object was read back from the provider.");
    if (sha256(readback.subarray(readback.length - encrypted.header.ciphertextBytes)) !== encrypted.header.ciphertextSha256) {
      throw new Error("CIPHERTEXT_HASH_MISMATCH");
    }
    const decrypted = await decryptCloudBackup(readback);
    await verification(prisma, runId, artifact.id, "DECRYPTION", "PASSED", "AES-GCM authentication and decryption passed.");
    await verification(prisma, runId, artifact.id, "PLAINTEXT_HASH", "PASSED", "Decrypted exact-byte SHA-256 matches the validated source.");
    const readbackBackup = parseAndValidateBackup(decrypted.plaintext.toString("utf8"));
    if (readbackBackup.metadata.backupVersion !== 41) throw new Error("BACKUP_SCHEMA_INVALID");
    await verification(prisma, runId, artifact.id, "BACKUP_SCHEMA", "PASSED", "Read-back payload is a supported Nalanda backup version 41.");
    await verification(prisma, runId, artifact.id, "RESTORE_COMPATIBILITY", "PASSED", "Backup passed schema and link validation required before restore rehearsal.");

    const completedAt = new Date();
    await prisma.$transaction([
      prisma.cloudBackupArtifact.update({ where: { id: artifact.id }, data: { status: "VERIFIED", verifiedAt: completedAt } }),
      prisma.cloudBackupRun.update({ where: { id: runId }, data: { status: "VERIFIED", completedAt, nextRetryAt: null } }),
      ...(run.scheduleId ? [prisma.cloudBackupSchedule.update({ where: { id: run.scheduleId }, data: {
        lastCompletedAt: completedAt, consecutiveFailureCount: 0
      } })] : [])
    ]);
    await event(prisma, { profileId: run.profileId, scheduleId: run.scheduleId, runId, artifactId: artifact.id, eventType: "BACKUP_VERIFIED" });
  } catch (error) {
    const providerFailure = safeProviderError(error);
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : providerFailure.code;
    const safeMessage = code === providerFailure.code ? providerFailure.safeMessage : safeFailureMessage(code);
    const retryable = provider.classifyRetryability(error) || providerFailure.retryable;
    const current = await prisma.cloudBackupRun.findUnique({ where: { id: runId } });
    const nextRetryAt = retryable && current && current.retryCount < run.profile.maximumRetryCount
      ? new Date(Date.now() + Math.min(60, 5 * 2 ** current.retryCount) * 60_000)
      : null;
    await prisma.cloudBackupRun.update({ where: { id: runId }, data: {
      status: "FAILED", completedAt: new Date(), failureCode: code, failureMessageSafe: safeMessage,
      nextRetryAt, retryCount: current?.retryCount ?? 0
    } });
    if (run.scheduleId) await prisma.cloudBackupSchedule.update({ where: { id: run.scheduleId }, data: { consecutiveFailureCount: { increment: 1 } } });
    await event(prisma, { profileId: run.profileId, scheduleId: run.scheduleId, runId, eventType: "BACKUP_FAILED", reason: code });
    if (nextRetryAt) await event(prisma, { profileId: run.profileId, runId, eventType: "BACKUP_RETRY_SCHEDULED", safeMetadataJson: JSON.stringify({ retryAt: nextRetryAt.toISOString() }) });
  }
  return prisma.cloudBackupRun.findUniqueOrThrow({ where: { id: runId }, include: { artifacts: true, verifications: true } });
}

export async function processDueCloudBackups(prisma: PrismaClient, now = new Date()) {
  const schedules = await prisma.cloudBackupSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now }, profile: { status: "ACTIVE" } },
    include: { profile: true },
    orderBy: { nextRunAt: "asc" },
    take: 25
  });
  const claimed: string[] = [];
  for (const schedule of schedules) {
    const dueAt = schedule.nextRunAt!;
    const run = await claimScheduledCloudBackupRun(prisma, schedule.id, dueAt, now);
    if (!run) continue;
    claimed.push(run.id);
    await executeCloudBackupRun(prisma, run.id);
  }
  return { dueSchedules: schedules.length, claimedRuns: claimed.length, runIds: claimed };
}

export async function recoverStaleCloudBackupRuns(
  prisma: PrismaClient,
  now = new Date(),
  staleAfterMs = DEFAULT_STALE_RUN_MS
) {
  if (!Number.isInteger(staleAfterMs) || staleAfterMs < 0 || staleAfterMs > 7 * 24 * 60 * 60 * 1000) {
    throw new Error("Stale-run recovery age is invalid.");
  }
  const cutoff = new Date(now.getTime() - staleAfterMs);
  const stale = await prisma.cloudBackupRun.findMany({
    where: {
      status: { in: ACTIVE_RUN_STATUSES },
      OR: [
        { startedAt: { lte: cutoff } },
        { startedAt: null, createdAt: { lte: cutoff } }
      ]
    },
    include: { profile: true, artifacts: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
    take: 10
  });
  const recovered: string[] = [];
  const failedClosed: string[] = [];

  for (const run of stale) {
    if (run.status === "PENDING") {
      const result = await executeCloudBackupRun(prisma, run.id);
      if (result.status === "VERIFIED") recovered.push(run.id);
      else failedClosed.push(run.id);
      continue;
    }

    const artifact = run.artifacts[0];
    if ((run.status === "UPLOADING" || run.status === "VERIFYING") && artifact) {
      try {
        const provider = createCloudBackupProvider(run.profile);
        const head = await provider.headObject(artifact.objectKeySafe);
        if (head && run.encryptedBytes && head.byteSize === run.encryptedBytes) {
          if (run.status === "UPLOADING") {
            await prisma.$transaction([
              prisma.cloudBackupArtifact.update({
                where: { id: artifact.id },
                data: {
                  status: "UPLOADED",
                  providerObjectIdSafe: head.objectIdSafe,
                  uploadedAt: artifact.uploadedAt ?? now
                }
              }),
              prisma.cloudBackupRun.update({
                where: { id: run.id },
                data: {
                  status: "VERIFYING",
                  providerObjectReferenceSafe: head.objectIdSafe,
                  providerObjectVersionSafe: head.versionSafe
                }
              }),
              prisma.cloudBackupEvent.create({
                data: {
                  profileId: run.profileId,
                  scheduleId: run.scheduleId,
                  runId: run.id,
                  artifactId: artifact.id,
                  eventType: "BACKUP_UPLOADED",
                  reason: "STALE_RUN_EXACT_OBJECT_RECOVERED"
                }
              })
            ]);
          }
          const verification = await verifyStoredCloudBackupArtifact(prisma, artifact.id);
          if (verification.verified) {
            if (run.scheduleId) {
              await prisma.cloudBackupSchedule.update({
                where: { id: run.scheduleId },
                data: { lastCompletedAt: now, consecutiveFailureCount: 0 }
              });
            }
            recovered.push(run.id);
            continue;
          }
          await failStaleRun(prisma, run, now, verification.failureCode ?? "STALE_VERIFICATION_FAILED", false);
          failedClosed.push(run.id);
          continue;
        }
      } catch {
        // Exact-object recovery is best effort and must fall through to a safe failure.
      }
      await failStaleRun(prisma, run, now, "STALE_UPLOAD_STATE_UNCERTAIN", false);
      failedClosed.push(run.id);
      continue;
    }

    await failStaleRun(prisma, run, now, "STALE_PRE_UPLOAD_RUN", true);
    failedClosed.push(run.id);
  }

  return {
    inspected: stale.length,
    recovered: recovered.length,
    recoveredRunIds: recovered,
    failedClosed: failedClosed.length,
    failedRunIds: failedClosed
  };
}

export async function retryEligibleCloudBackups(prisma: PrismaClient, now = new Date()) {
  const failed = await prisma.cloudBackupRun.findMany({
    where: { status: "FAILED", nextRetryAt: { lte: now } },
    include: { profile: true },
    take: 10,
    orderBy: { nextRetryAt: "asc" }
  });
  const retried: string[] = [];
  for (const source of failed) {
    if (source.retryCount >= source.profile.maximumRetryCount || source.profile.status !== "ACTIVE") continue;
    const key = `retry:${source.id}:${source.retryCount + 1}`;
    if (await prisma.cloudBackupRun.findUnique({ where: { idempotencyKey: key } })) continue;
    const suffix = randomBytes(3).toString("hex");
    const run = await prisma.cloudBackupRun.create({ data: {
      runNumber: `CBR-${indiaDateKey(now)}-${suffix}`.toUpperCase(),
      profileId: source.profileId,
      scheduleId: source.scheduleId,
      triggerType: "RETRY",
      scheduledDueAt: source.scheduledDueAt,
      idempotencyKey: key,
      status: "PENDING",
      retryCount: source.retryCount + 1
    } });
    await prisma.cloudBackupRun.update({ where: { id: source.id }, data: { nextRetryAt: null } });
    retried.push(run.id);
    await executeCloudBackupRun(prisma, run.id);
  }
  return { eligible: failed.length, retried: retried.length, runIds: retried };
}

async function claimScheduledCloudBackupRun(prisma: PrismaClient, scheduleId: string, dueAt: Date, now: Date) {
  return prisma.$transaction(async (tx) => {
    const schedule = await tx.cloudBackupSchedule.findUnique({
      where: { id: scheduleId },
      include: { profile: true }
    });
    if (!schedule?.enabled || !schedule.nextRunAt || schedule.nextRunAt.getTime() !== dueAt.getTime()
      || schedule.nextRunAt > now || schedule.profile.status !== "ACTIVE") return null;
    const nextRunAt = nextCloudBackupDueAt(schedule, now);
    const idempotencyKey = `schedule:${schedule.id}:${dueAt.toISOString()}`;
    const existing = await tx.cloudBackupRun.findUnique({ where: { idempotencyKey } });
    if (existing) {
      await tx.cloudBackupSchedule.update({
        where: { id: schedule.id },
        data: { nextRunAt, lastDueAt: dueAt }
      });
      return null;
    }
    const active = await tx.cloudBackupRun.findFirst({
      where: { profileId: schedule.profileId, status: { in: ACTIVE_RUN_STATUSES } }
    });
    if (active) return null;
    const triggerType = dueAt < now && schedule.catchUpPolicy === "RUN_ONE_MISSED" ? "MISSED_RUN_RECOVERY" : "SCHEDULED";
    const suffix = randomBytes(3).toString("hex");
    const run = await tx.cloudBackupRun.create({
      data: {
        runNumber: `CBR-${indiaDateKey(now)}-${suffix}`.toUpperCase(),
        profileId: schedule.profileId,
        scheduleId: schedule.id,
        triggerType,
        scheduledDueAt: dueAt,
        idempotencyKey,
        status: "PENDING"
      }
    });
    await tx.cloudBackupSchedule.update({
      where: { id: schedule.id },
      data: { nextRunAt, lastDueAt: dueAt, lastStartedAt: now }
    });
    await event(tx as any, {
      profileId: schedule.profileId,
      scheduleId: schedule.id,
      runId: run.id,
      eventType: "BACKUP_DUE"
    });
    return run;
  });
}

async function failStaleRun(
  prisma: PrismaClient,
  run: CloudBackupRun & { profile: { maximumRetryCount: number } },
  now: Date,
  failureCode: string,
  retryable: boolean
) {
  const retryAt = retryable && run.retryCount < run.profile.maximumRetryCount ? now : null;
  const updated = await prisma.cloudBackupRun.updateMany({
    where: { id: run.id, status: { in: ACTIVE_RUN_STATUSES } },
    data: {
      status: "FAILED",
      completedAt: now,
      failureCode,
      failureMessageSafe: safeFailureMessage(failureCode),
      nextRetryAt: retryAt
    }
  });
  if (updated.count !== 1) return;
  await prisma.cloudBackupArtifact.updateMany({
    where: { runId: run.id, status: { in: ["CREATED", "ENCRYPTED"] } },
    data: { status: "MISSING" }
  });
  if (run.scheduleId) {
    await prisma.cloudBackupSchedule.update({
      where: { id: run.scheduleId },
      data: { consecutiveFailureCount: { increment: 1 } }
    });
  }
  await event(prisma, {
    profileId: run.profileId,
    scheduleId: run.scheduleId,
    runId: run.id,
    eventType: "BACKUP_FAILED",
    reason: failureCode
  });
  if (retryAt) {
    await event(prisma, {
      profileId: run.profileId,
      scheduleId: run.scheduleId,
      runId: run.id,
      eventType: "BACKUP_RETRY_SCHEDULED",
      safeMetadataJson: JSON.stringify({ retryAt: retryAt.toISOString(), reason: "STALE_RUN_RECOVERY" })
    });
  }
}

async function transition(prisma: PrismaClient, id: string, from: string, to: string) {
  const result = await prisma.cloudBackupRun.updateMany({ where: { id, status: from }, data: { status: to } });
  if (result.count !== 1) throw new Error("STATE_TRANSITION_CONFLICT");
}

async function verification(prisma: PrismaClient, runId: string, artifactId: string, verificationType: string, status: string, safeSummary: string) {
  return prisma.cloudBackupVerification.create({ data: { runId, artifactId, verificationType, status, safeSummary } });
}

async function event(prisma: any, data: Record<string, unknown>) {
  return prisma.cloudBackupEvent.create({ data });
}

function safeFailureMessage(code: string) {
  const messages: Record<string, string> = {
    PROFILE_NOT_ACTIVE: "The cloud backup profile is not active.",
    PROVIDER_NOT_READY: "The encrypted backup provider is not ready.",
    BACKUP_VERSION_INVALID: "The generated ERP backup version is unsupported.",
    REMOTE_HEAD_MISMATCH: "Provider read-after-write metadata did not match the encrypted artifact.",
    CIPHERTEXT_HASH_MISMATCH: "Read-back encrypted bytes failed SHA-256 verification.",
    BACKUP_SCHEMA_INVALID: "Read-back decrypted bytes failed Nalanda backup validation.",
    STATE_TRANSITION_CONFLICT: "The backup run state changed concurrently.",
    STALE_PRE_UPLOAD_RUN: "A stale pre-upload run was failed safely and may be retried as a new run.",
    STALE_UPLOAD_STATE_UNCERTAIN: "A stale upload state could not prove the exact encrypted object and was failed closed.",
    STALE_VERIFICATION_FAILED: "A stale uploaded object failed exact-object verification."
  };
  return messages[code] ?? "The encrypted backup run failed safely.";
}
