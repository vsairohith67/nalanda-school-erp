import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { createCloudBackupProvider } from "../lib/cloud-backup-provider";
import { createCloudBackupProfile, setCloudBackupProfileStatus } from "../lib/cloud-backup-profiles";
import { hashPassword } from "../lib/password";

const PREFIX = "QA20C-";
const ROLE_USER_PREFIX = "qa20c-";
const ROLE_PASSWORD = "Qa20cBackup@2026";

async function main() {
  const command = (process.argv[2] ?? "inspect").toLowerCase();
  if (command === "setup") {
    await cleanup();
    const mock = await createCloudBackupProfile(prisma, {
      profileCode: "QA20C-MOCK",
      name: "QA20C deterministic mock",
      providerKind: "MOCK",
      destinationLabel: "Isolated process memory",
      encryptionKeyVersion: "V1"
    });
    const local = await createCloudBackupProfile(prisma, {
      profileCode: "QA20C-LOCAL",
      name: "QA20C encrypted local folder",
      providerKind: "LOCAL_FOLDER",
      destinationLabel: "Isolated QA recovery folder",
      encryptionKeyVersion: "V1"
    });
    await createCloudBackupProfile(prisma, {
      profileCode: "QA20C-OBJECT-STORAGE",
      name: "QA20C disabled object storage",
      providerKind: "OBJECT_STORAGE",
      destinationLabel: "LIVE disabled",
      encryptionKeyVersion: "V1"
    });
    await createCloudBackupProfile(prisma, {
      profileCode: "QA20C-GOOGLE-DRIVE",
      name: "QA20C disabled Google Drive",
      providerKind: "GOOGLE_DRIVE",
      destinationLabel: "LIVE disabled",
      encryptionKeyVersion: "V1"
    });
    await setCloudBackupProfileStatus(prisma, local.id, "activate");
    const dueAt = new Date(Date.now() - 60_000);
    const schedule = await prisma.cloudBackupSchedule.create({ data: {
      scheduleCode: "QA20C-DAILY-SCHEDULE",
      profileId: local.id,
      frequency: "DAILY",
      intervalCount: 1,
      hourOfDay: 2,
      minuteOfHour: 15,
      timezone: "Asia/Kolkata",
      enabled: true,
      catchUpPolicy: "RUN_ONE_MISSED",
      nextRunAt: dueAt
    } });
    await prisma.cloudBackupEvent.create({ data: {
      profileId: local.id,
      scheduleId: schedule.id,
      eventType: "SCHEDULE_CREATED",
      safeMetadataJson: JSON.stringify({ frequency: "DAILY", timezone: "Asia/Kolkata" })
    } });
    console.log(JSON.stringify({ created: true, activeProfile: local.profileCode, mockProfile: mock.profileCode, liveProfilesEnabled: false }, null, 2));
    return;
  }
  if (command === "cleanup") {
    console.log(JSON.stringify(await cleanup(), null, 2));
    return;
  }
  if (command === "pending") {
    const profile = await prisma.cloudBackupProfile.findUnique({ where: { profileCode: "QA20C-LOCAL" } });
    if (!profile || profile.status !== "ACTIVE") throw new Error("QA20C-LOCAL must be active.");
    const stamp = Date.now().toString(36).toUpperCase();
    const run = await prisma.cloudBackupRun.create({ data: {
      runNumber: `QA20C-PENDING-${stamp}`,
      profileId: profile.id,
      triggerType: "MANUAL",
      status: "PENDING",
      idempotencyKey: `qa20c:pending:${stamp}`
    } });
    await prisma.cloudBackupEvent.create({ data: {
      profileId: profile.id,
      runId: run.id,
      eventType: "BACKUP_DUE",
      safeMetadataJson: JSON.stringify({ purpose: "cancel-dialog-browser-qa" })
    } });
    console.log(JSON.stringify({ created: true, runNumber: run.runNumber }, null, 2));
    return;
  }
  if (command === "stale-pending") {
    const profile = await prisma.cloudBackupProfile.findUnique({ where: { profileCode: "QA20C-LOCAL" } });
    if (!profile || profile.status !== "ACTIVE") throw new Error("QA20C-LOCAL must be active.");
    const stamp = Date.now().toString(36).toUpperCase();
    const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const run = await prisma.cloudBackupRun.create({ data: {
      runNumber: `QA20C-STALE-PENDING-${stamp}`,
      profileId: profile.id,
      triggerType: "MANUAL",
      status: "PENDING",
      idempotencyKey: `qa20c:stale-pending:${stamp}`,
      createdAt,
      updatedAt: createdAt
    } });
    await prisma.cloudBackupSchedule.updateMany({ where: { profileId: profile.id }, data: { enabled: false } });
    await prisma.cloudBackupEvent.create({ data: {
      profileId: profile.id,
      runId: run.id,
      eventType: "BACKUP_DUE",
      reason: "QA20C_STALE_PENDING_RECOVERY"
    } });
    console.log(JSON.stringify({ created: true, runNumber: run.runNumber }, null, 2));
    return;
  }
  if (command === "stale-verify") {
    const profile = await prisma.cloudBackupProfile.findUnique({ where: { profileCode: "QA20C-LOCAL" } });
    if (!profile || profile.status !== "ACTIVE") throw new Error("QA20C-LOCAL must be active.");
    const run = await prisma.cloudBackupRun.findFirst({
      where: { profileId: profile.id, status: "VERIFIED", artifacts: { some: { status: "VERIFIED" } } },
      include: { artifacts: { where: { status: "VERIFIED" }, take: 1 } },
      orderBy: { completedAt: "desc" }
    });
    const artifact = run?.artifacts[0];
    if (!run || !artifact) throw new Error("A verified QA20C LOCAL_FOLDER artifact is required.");
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.cloudBackupSchedule.updateMany({ where: { profileId: profile.id }, data: { enabled: false } }),
      prisma.cloudBackupArtifact.update({ where: { id: artifact.id }, data: { status: "UPLOADED", verifiedAt: null } }),
      prisma.cloudBackupRun.update({ where: { id: run.id }, data: { status: "VERIFYING", startedAt, completedAt: null } })
    ]);
    console.log(JSON.stringify({ prepared: true, runNumber: run.runNumber, artifactId: artifact.id }, null, 2));
    return;
  }
  if (command === "stale-upload-missing") {
    const profile = await prisma.cloudBackupProfile.findUnique({ where: { profileCode: "QA20C-LOCAL" } });
    if (!profile || profile.status !== "ACTIVE") throw new Error("QA20C-LOCAL must be active.");
    const stamp = Date.now().toString(36).toUpperCase();
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const run = await prisma.cloudBackupRun.create({ data: {
      runNumber: `QA20C-STALE-UPLOAD-${stamp}`,
      profileId: profile.id,
      triggerType: "MANUAL",
      status: "UPLOADING",
      idempotencyKey: `qa20c:stale-upload:${stamp}`,
      startedAt,
      encryptedBytes: 999,
      encryptionKeyVersion: profile.encryptionKeyVersion,
      containerFormatVersion: profile.containerFormatVersion
    } });
    const artifactId = Date.now().toString(16).padEnd(26, "0").slice(0, 26);
    await prisma.cloudBackupArtifact.create({ data: {
      id: artifactId,
      runId: run.id,
      artifactType: "DATABASE_BACKUP",
      status: "ENCRYPTED",
      objectKeySafe: `cloud-backup/${run.id}/${artifactId}.npsbackup`,
      encryptionKeyVersion: profile.encryptionKeyVersion,
      plaintextSha256: "0".repeat(64),
      ciphertextSha256: "1".repeat(64),
      plaintextBytes: 1,
      compressedBytes: 1,
      ciphertextBytes: 1,
      privateAssetsIncluded: false,
      sourceCoverageJson: JSON.stringify({ databasePayload: "INCLUDED", privateAssetsStatus: "NOT_INCLUDED" })
    } });
    await prisma.cloudBackupSchedule.updateMany({ where: { profileId: profile.id }, data: { enabled: false } });
    console.log(JSON.stringify({ prepared: true, runNumber: run.runNumber, artifactId }, null, 2));
    return;
  }
  if (command === "roles") {
    await prisma.user.deleteMany({ where: { username: { startsWith: ROLE_USER_PREFIX } } });
    const passwordHash = await hashPassword(ROLE_PASSWORD);
    const roles = ["PRINCIPAL", "ADMIN", "VIEWER", "ACCOUNTANT", "TEACHER", "PARENT"];
    await prisma.user.createMany({ data: roles.map((role) => ({
      id: `qa20c-user-${role.toLowerCase()}`,
      name: `QA20C ${role}`,
      username: `${ROLE_USER_PREFIX}${role.toLowerCase()}`,
      passwordHash,
      role
    })) });
    console.log(JSON.stringify({
      created: roles.length,
      usernames: roles.map((role) => `${ROLE_USER_PREFIX}${role.toLowerCase()}`),
      passwordConfigured: true
    }, null, 2));
    return;
  }
  if (command === "inspect") {
    console.log(JSON.stringify(await inspect(), null, 2));
    return;
  }
  throw new Error("Use setup, pending, stale-pending, stale-verify, stale-upload-missing, roles, inspect, or cleanup.");
}

async function cleanup() {
  const profiles = await prisma.cloudBackupProfile.findMany({
    where: { profileCode: { startsWith: PREFIX } },
    include: { runs: { include: { artifacts: true } } }
  });
  const objectResults: Array<{ provider: string; deleted: boolean; alreadyMissing: boolean }> = [];
  for (const profile of profiles) {
    if (!profile.profileCode.startsWith(PREFIX)) throw new Error("QA20C cleanup scope changed unexpectedly.");
    const provider = createCloudBackupProvider(profile);
    for (const artifact of profile.runs.flatMap((run) => run.artifacts)) {
      const result = await provider.deleteObject(artifact.objectKeySafe).catch(() => ({ deleted: false, alreadyMissing: false }));
      objectResults.push({ provider: profile.providerKind, ...result });
    }
  }
  const profileIds = profiles.map((profile) => profile.id);
  if (profileIds.length) {
    const runIds = (await prisma.cloudBackupRun.findMany({ where: { profileId: { in: profileIds } }, select: { id: true } })).map((row) => row.id);
    const artifactIds = runIds.length
      ? (await prisma.cloudBackupArtifact.findMany({ where: { runId: { in: runIds } }, select: { id: true } })).map((row) => row.id)
      : [];
    await prisma.$transaction([
      prisma.cloudBackupEvent.deleteMany({ where: { OR: [
        { profileId: { in: profileIds } },
        ...(runIds.length ? [{ runId: { in: runIds } }] : []),
        ...(artifactIds.length ? [{ artifactId: { in: artifactIds } }] : [])
      ] } }),
      ...(artifactIds.length ? [prisma.cloudBackupRestoreRehearsal.deleteMany({ where: { artifactId: { in: artifactIds } } })] : []),
      ...(artifactIds.length ? [prisma.cloudBackupVerification.deleteMany({ where: { artifactId: { in: artifactIds } } })] : []),
      ...(artifactIds.length ? [prisma.cloudBackupArtifact.deleteMany({ where: { id: { in: artifactIds } } })] : []),
      ...(runIds.length ? [prisma.cloudBackupRun.deleteMany({ where: { id: { in: runIds } } })] : []),
      prisma.cloudBackupSchedule.deleteMany({ where: { profileId: { in: profileIds } } }),
      prisma.cloudBackupRetentionPolicy.deleteMany({ where: { profileId: { in: profileIds } } }),
      prisma.cloudBackupProfile.deleteMany({ where: { id: { in: profileIds } } })
    ]);
  }
  await prisma.user.deleteMany({ where: { username: { startsWith: ROLE_USER_PREFIX } } });
  await removeExactQaFolder();
  return { removedProfiles: profileIds.length, providerObjects: objectResults, remaining: await inspect() };
}

async function inspect() {
  const profiles = await prisma.cloudBackupProfile.findMany({
    where: { profileCode: { startsWith: PREFIX } },
    select: { id: true }
  });
  const profileIds = profiles.map((row) => row.id);
  const runs = profileIds.length
    ? await prisma.cloudBackupRun.findMany({
        where: { profileId: { in: profileIds } },
        select: { id: true, failureCode: true, updatedAt: true }
      })
    : [];
  const runIds = runs.map((row) => row.id);
  const latestFailureCode = runs
    .filter((row) => row.failureCode)
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0]?.failureCode ?? null;
  return {
    profiles: profileIds.length,
    schedules: profileIds.length ? await prisma.cloudBackupSchedule.count({ where: { profileId: { in: profileIds } } }) : 0,
    policies: profileIds.length ? await prisma.cloudBackupRetentionPolicy.count({ where: { profileId: { in: profileIds } } }) : 0,
    runs: runIds.length,
    artifacts: runIds.length ? await prisma.cloudBackupArtifact.count({ where: { runId: { in: runIds } } }) : 0,
    verifications: runIds.length ? await prisma.cloudBackupVerification.count({ where: { runId: { in: runIds } } }) : 0,
    rehearsals: runIds.length ? await prisma.cloudBackupRestoreRehearsal.count({ where: { runId: { in: runIds } } }) : 0,
    events: profileIds.length ? await prisma.cloudBackupEvent.count({ where: { profileId: { in: profileIds } } }) : 0,
    roleUsers: await prisma.user.count({ where: { username: { startsWith: ROLE_USER_PREFIX } } }),
    latestFailureCode
  };
}

async function removeExactQaFolder() {
  const configured = process.env.CLOUD_BACKUP_LOCAL_FOLDER?.trim();
  if (!configured) return;
  const root = path.resolve(configured);
  const expected = process.env.QA20C_ISOLATED_DATABASE === "true"
    ? path.resolve(process.env.QA20C_ISOLATED_ROOT || "", "provider")
    : path.resolve(process.cwd(), "data", "qa20c-provider");
  if (root !== expected) throw new Error("QA20C cleanup refuses to remove a non-standard provider folder.");
  await rm(root, { recursive: true, force: true });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "QA20C fixture command failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
