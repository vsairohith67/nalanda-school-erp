import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type PrismaClient as PrismaClientType } from "@prisma/client";
import { createCloudBackupProvider } from "@/lib/cloud-backup-provider";
import { decryptCloudBackup, sha256 } from "@/lib/cloud-backup-container";
import { parseAndValidateBackup, type RestoreResult } from "@/lib/restore";
import { restoreValidatedBackup } from "@/lib/restore-database";
import { indiaDateKey } from "@/lib/cloud-backup-schedules";

export async function runCloudBackupRestoreRehearsal(
  prisma: PrismaClientType,
  artifactId: string,
  actorUserId?: string
) {
  const artifact = await prisma.cloudBackupArtifact.findUnique({
    where: { id: artifactId },
    include: { run: { include: { profile: true } } }
  });
  if (!artifact || artifact.status !== "VERIFIED" || artifact.run.status !== "VERIFIED") throw new Error("A VERIFIED encrypted backup artifact is required.");
  const rehearsal = await prisma.cloudBackupRestoreRehearsal.create({ data: {
    rehearsalNumber: `CBRH-${indiaDateKey(new Date())}-${artifact.id.slice(-6)}`.toUpperCase(),
    runId: artifact.runId,
    artifactId: artifact.id,
    status: "DOWNLOADING",
    startedAt: new Date(),
    createdByUserId: actorUserId
  } });
  await prisma.cloudBackupEvent.create({ data: {
    profileId: artifact.run.profileId, runId: artifact.runId, artifactId: artifact.id,
    rehearsalId: rehearsal.id, eventType: "RESTORE_REHEARSAL_STARTED", recordedByUserId: actorUserId
  } });
  const sourcePath = operationalDatabasePath();
  const tempRoot = rehearsalDatabaseRoot();
  const tempPath = path.join(tempRoot, `${rehearsal.id}.db`);
  let rehearsalClient: PrismaClient | null = null;
  try {
    const provider = createCloudBackupProvider(artifact.run.profile);
    const encrypted = await provider.getObject(artifact.objectKeySafe);
    await prisma.cloudBackupRestoreRehearsal.update({ where: { id: rehearsal.id }, data: { status: "DECRYPTING" } });
    const decrypted = await decryptCloudBackup(encrypted);
    if (decrypted.header.ciphertextSha256 !== artifact.ciphertextSha256 || decrypted.header.plaintextSha256 !== artifact.plaintextSha256) throw new Error("REHEARSAL_HASH_MISMATCH");
    await prisma.cloudBackupRestoreRehearsal.update({ where: { id: rehearsal.id }, data: { status: "VALIDATING" } });
    const backup = parseAndValidateBackup(decrypted.plaintext.toString("utf8"));
    if (backup.metadata.backupVersion !== 39) throw new Error("REHEARSAL_BACKUP_UNSUPPORTED");
    await mkdir(tempRoot, { recursive: true });
    await copyFile(sourcePath, tempPath);
    rehearsalClient = new PrismaClient({ datasources: { db: { url: `file:${tempPath.replaceAll("\\", "/")}` } } });
    const before = await rehearsalDigest(rehearsalClient);
    await prisma.cloudBackupRestoreRehearsal.update({ where: { id: rehearsal.id }, data: { status: "RESTORING_FIRST_PASS" } });
    // No operational-database writes are allowed between these two hashes.
    // Both restore passes execute only against the isolated copied database.
    const sourceBefore = sha256(await readFile(sourcePath));
    const first = await restoreValidatedBackup(rehearsalClient, backup, { id: actorUserId ?? "cloud-backup-rehearsal", name: "Isolated restore rehearsal" });
    assertRestoreHasNoErrors(first);
    const afterFirst = await rehearsalDigest(rehearsalClient);
    const second = await restoreValidatedBackup(rehearsalClient, backup, { id: actorUserId ?? "cloud-backup-rehearsal", name: "Isolated restore rehearsal" });
    assertRestoreHasNoErrors(second);
    const afterSecond = await rehearsalDigest(rehearsalClient);
    if (afterFirst.digest !== afterSecond.digest) throw new Error("REHEARSAL_NOT_IDEMPOTENT");
    await rehearsalClient.$disconnect();
    rehearsalClient = null;
    const sourceAfter = sha256(await readFile(sourcePath));
    if (sourceAfter !== sourceBefore) throw new Error("OPERATIONAL_DATABASE_CHANGED");
    await removeRehearsalFiles(tempPath);
    const completedAt = new Date();
    await prisma.cloudBackupRestoreRehearsal.update({ where: { id: rehearsal.id }, data: {
      status: "PASSED",
      backupVersion: backup.metadata.backupVersion,
      firstRestoreSummaryJson: JSON.stringify(safeRestoreSummary(first)),
      secondRestoreSummaryJson: JSON.stringify(safeRestoreSummary(second)),
      countDigestBefore: before.digest,
      countDigestAfterFirst: afterFirst.digest,
      countDigestAfterSecond: afterSecond.digest,
      sourceDatabaseUnchangedHash: sourceAfter,
      temporaryDatabaseRemoved: true,
      completedAt
    } });
    await prisma.cloudBackupEvent.create({ data: {
      profileId: artifact.run.profileId, runId: artifact.runId, artifactId: artifact.id,
      rehearsalId: rehearsal.id, eventType: "RESTORE_REHEARSAL_PASSED",
      safeMetadataJson: JSON.stringify({ repeatedRestoreIdempotent: true, temporaryDatabaseRemoved: true }),
      recordedByUserId: actorUserId
    } });
  } catch (error) {
    await rehearsalClient?.$disconnect().catch(() => undefined);
    await removeRehearsalFiles(tempPath);
    const failureCode = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "RESTORE_REHEARSAL_FAILED";
    await prisma.cloudBackupRestoreRehearsal.update({ where: { id: rehearsal.id }, data: {
      status: "FAILED", failureCode,
      failureMessageSafe: "The isolated restore rehearsal failed safely.",
      temporaryDatabaseRemoved: true,
      completedAt: new Date()
    } });
    await prisma.cloudBackupEvent.create({ data: {
      profileId: artifact.run.profileId, runId: artifact.runId, artifactId: artifact.id,
      rehearsalId: rehearsal.id, eventType: "RESTORE_REHEARSAL_FAILED", reason: failureCode,
      recordedByUserId: actorUserId
    } });
  }
  return prisma.cloudBackupRestoreRehearsal.findUniqueOrThrow({ where: { id: rehearsal.id } });
}

function operationalDatabasePath() {
  const url = process.env.DATABASE_URL?.trim() || "file:./dev.db";
  if (!url.startsWith("file:") || url.includes("?")) throw new Error("OPERATIONAL_DATABASE_PATH_UNSUPPORTED");
  const value = url.slice(5);
  const resolved = path.resolve(process.cwd(), "prisma", value);
  const expectedRoot = path.resolve(process.cwd());
  if (!resolved.startsWith(`${expectedRoot}${path.sep}`)) throw new Error("OPERATIONAL_DATABASE_PATH_UNSAFE");
  return resolved;
}

function rehearsalDatabaseRoot() {
  const configured = process.env.CLOUD_BACKUP_REHEARSAL_DIR?.trim();
  const root = path.resolve(configured || path.join(process.cwd(), "data", "cloud-backup-rehearsal"));
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("REHEARSAL_DATABASE_PATH_UNSAFE");
  }
  return root;
}

async function rehearsalDigest(prisma: PrismaClientType) {
  const counts = {
    students: await prisma.student.count(),
    enrollments: await prisma.academicYearEnrollment.count(),
    payments: await prisma.payment.count(),
    users: await prisma.user.count(),
    profiles: await prisma.cloudBackupProfile.count(),
    schedules: await prisma.cloudBackupSchedule.count(),
    policies: await prisma.cloudBackupRetentionPolicy.count(),
    runs: await prisma.cloudBackupRun.count(),
    artifacts: await prisma.cloudBackupArtifact.count(),
    verifications: await prisma.cloudBackupVerification.count(),
    rehearsals: await prisma.cloudBackupRestoreRehearsal.count(),
    events: await prisma.cloudBackupEvent.count()
  };
  return { counts, digest: createHash("sha256").update(JSON.stringify(counts)).digest("hex") };
}

function safeRestoreSummary(result: RestoreResult) {
  let created = 0, updated = 0, skipped = 0, errors = 0;
  for (const value of Object.values(result)) {
    if (!value || typeof value !== "object" || !("created" in value)) continue;
    const row = value as { created: number; updated: number; skipped: number; errors: string[] };
    created += row.created; updated += row.updated; skipped += row.skipped; errors += row.errors.length;
  }
  return { created, updated, skipped, errors, warningCount: result.warnings.length };
}

function assertRestoreHasNoErrors(result: RestoreResult) {
  const summary = safeRestoreSummary(result);
  if (summary.errors) throw new Error("REHEARSAL_RESTORE_ERRORS");
}

async function removeRehearsalFiles(tempPath: string) {
  await Promise.all([
    rm(tempPath, { force: true }),
    rm(`${tempPath}-journal`, { force: true }),
    rm(`${tempPath}-wal`, { force: true }),
    rm(`${tempPath}-shm`, { force: true })
  ]);
}
