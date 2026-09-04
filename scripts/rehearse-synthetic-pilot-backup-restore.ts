import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { createAndVerifyEventMediaAssetBackup, restoreEventMediaAssetBackup } from "../lib/event-media-asset-backup";
import { hashPassword } from "../lib/password";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import { cleanupIsolatedDatabase, createEmptyIsolatedDatabase, databaseUrl, runPrisma } from "./migration-check-utils";

const workspace = path.resolve(".");
const fixtureRoot = path.join(workspace, "tmp", "synthetic-pilot-readiness-1a");
const sourcePath = path.join(fixtureRoot, "synthetic-pilot.db");
const rehearsalRoot = path.join(fixtureRoot, "backup-restore-rehearsal");
const evidencePath = path.join(fixtureRoot, "backup-restore-evidence.json");
const logicalBackupPath = path.join(rehearsalRoot, "synthetic-pilot-v45.json");
const assetBackupPath = path.join(rehearsalRoot, "synthetic-event-media.npsbackup");

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function assertBoundary() {
  invariant(process.env.SYNTHETIC_PILOT_OPT_IN === "true", "SYNTHETIC_PILOT_OPT_IN_REQUIRED");
  invariant(process.env.NALANDA_ENVIRONMENT === "TEST" && process.env.NODE_ENV !== "production", "SYNTHETIC_PILOT_ENVIRONMENT_REFUSED");
  invariant(existsSync(sourcePath), "SYNTHETIC_PILOT_SOURCE_MISSING");
  invariant(rehearsalRoot.startsWith(`${fixtureRoot}${path.sep}`), "SYNTHETIC_PILOT_REHEARSAL_SCOPE_REFUSED");
  const operational = process.env.NALANDA_OPERATIONAL_DATABASE_PATH?.trim();
  if (operational) invariant(path.resolve(operational).toLowerCase() !== path.resolve(sourcePath).toLowerCase(), "SYNTHETIC_PILOT_OPERATIONAL_DATABASE_REFUSED");
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function restoreErrors(result: Record<string, unknown>) {
  return Object.entries(result).flatMap(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const errors = (value as { errors?: unknown[] }).errors;
    return errors?.length ? [`${key}:${errors.join("|")}`] : [];
  });
}

async function snapshot(client: PrismaClient) {
  const [
    students, payments, paymentTotal, paymentAudits, attendanceRecords, staffAttendanceRecords,
    marks, markEvents, reportCards, reportVersions, reportEvents, supportRequests, parentMeetings,
    offlineDevices, offlineMutations, offlineEvents, nativeSessions, nativeRefreshHistory, eventMediaAssets
  ] = await Promise.all([
    client.student.count(),
    client.payment.count(),
    client.payment.aggregate({ _sum: { amountPaid: true }, where: { isCancelled: false, deletedAt: null } }),
    client.paymentAudit.count(),
    client.studentAttendanceRecord.count(),
    client.staffAttendanceRecord.count(),
    client.studentMark.count(),
    client.studentMarkEvent.count(),
    client.studentReportCard.count(),
    client.studentReportCardVersion.count(),
    client.studentReportCardEvent.count(),
    client.supportRequest.count(),
    client.parentMeeting.count(),
    client.offlineSyncDevice.count(),
    client.offlineSyncMutation.count(),
    client.offlineSyncEvent.count(),
    client.nativeSession.count(),
    client.nativeRefreshTokenHistory.count(),
    client.eventMediaAsset.count()
  ]);
  return {
    students,
    payments,
    collected: paymentTotal._sum.amountPaid?.toString() ?? "0",
    paymentAudits,
    attendanceRecords,
    staffAttendanceRecords,
    marks,
    markEvents,
    reportCards,
    reportVersions,
    reportEvents,
    supportRequests,
    parentMeetings,
    offlineDevices,
    offlineMutations,
    offlineEvents,
    nativeSessions,
    nativeRefreshHistory,
    eventMediaAssets
  };
}

async function provisionIdentityOwners(target: PrismaClient, users: Array<Record<string, unknown>>) {
  const passwordHash = await hashPassword(`SYNPILOT-RESTORE-${randomBytes(16).toString("hex")}!`);
  for (const [index, user] of users.entries()) {
    const username = String(user.username ?? "").trim();
    const role = String(user.role ?? "VIEWER").trim();
    invariant(username && /^[A-Z_]+$/.test(role), `SYNTHETIC_PILOT_RESTORE_IDENTITY_INVALID_${index}`);
    await target.user.create({
      data: {
        id: `synpilot-restore-user-${String(index).padStart(2, "0")}`,
        name: `Synthetic Restore Identity ${index + 1}`,
        username,
        email: `restore-${index}@example.test`,
        passwordHash,
        role,
        isActive: user.isActive !== false,
        lifecycleStatus: user.isActive === false ? "SUSPENDED" : "ACTIVE",
        mustChangePassword: true
      }
    });
  }
}

async function main() {
  assertBoundary();
  if (existsSync(rehearsalRoot)) rmSync(rehearsalRoot, { recursive: true, force: true });
  mkdirSync(rehearsalRoot, { recursive: true });
  process.env.EVENT_MEDIA_PRIVATE_STORAGE_ROOT = path.join(fixtureRoot, "private-media");

  const totalStarted = performance.now();
  const source = new PrismaClient({ datasourceUrl: `file:${sourcePath.replaceAll("\\", "/")}` });
  const assetKey = randomBytes(32);
  let targetPath: string | null = null;
  let success = false;
  try {
    const assetStarted = performance.now();
    const assetProof = await createAndVerifyEventMediaAssetBackup(source, {
      artifactPath: assetBackupPath,
      key: assetKey,
      keyVersion: "V91",
      restoreRoots: [path.join(rehearsalRoot, "asset-restore-a"), path.join(rehearsalRoot, "asset-restore-b")]
    });
    const assetBackupMs = Math.round(performance.now() - assetStarted);
    invariant(assetProof.assetCount === 1 && assetProof.fileCount === 1, "SYNTHETIC_PILOT_PRIVATE_ASSET_COUNT_MISMATCH");
    invariant(assetProof.firstRestore.fileDigest === assetProof.secondRestore.fileDigest, "SYNTHETIC_PILOT_PRIVATE_ASSET_DOUBLE_RESTORE_MISMATCH");
    let wrongKeyRefused = false;
    try {
      await restoreEventMediaAssetBackup(readFileSync(assetBackupPath), { key: randomBytes(32), targetRoot: path.join(rehearsalRoot, "wrong-key") });
    } catch {
      wrongKeyRefused = true;
    }
    invariant(wrongKeyRefused, "SYNTHETIC_PILOT_PRIVATE_ASSET_WRONG_KEY_ACCEPTED");

    const backupStarted = performance.now();
    const generated = await generateFullBackup(source, { generatedBy: "SYNTHETIC-PILOT-READINESS-1A isolated rehearsal" });
    const serialized = serializeBackup(generated);
    writeFileSync(logicalBackupPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    const logicalBackupMs = Math.round(performance.now() - backupStarted);
    invariant(!/passwordHash|SYNPILOT-[A-Z0-9_-]+-[a-f0-9]{20,}!/i.test(serialized), "SYNTHETIC_PILOT_BACKUP_SECRET_DETECTED");
    const backup = parseAndValidateBackup(JSON.parse(serialized));
    invariant(backup.metadata.backupVersion === 45, "SYNTHETIC_PILOT_BACKUP_VERSION_CHANGED");
    const sourceSnapshot = await snapshot(source);
    invariant(sourceSnapshot.students === 800 && sourceSnapshot.payments === 801 && sourceSnapshot.nativeSessions === 1 && sourceSnapshot.eventMediaAssets === 1, "SYNTHETIC_PILOT_SOURCE_RECONCILIATION_FAILED");
    invariant(sourceSnapshot.markEvents + sourceSnapshot.reportVersions + sourceSnapshot.reportEvents > 0, "SYNTHETIC_PILOT_IMMUTABLE_HISTORY_MISSING");

    targetPath = createEmptyIsolatedDatabase("restore", "synthetic-pilot-v45");
    const migrationStarted = performance.now();
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], targetPath);
    const migrationMs = Math.round(performance.now() - migrationStarted);
    const target = new PrismaClient({ datasourceUrl: databaseUrl(targetPath) });
    try {
      await provisionIdentityOwners(target, backup.users as Array<Record<string, unknown>>);
      const actor = await target.user.findFirstOrThrow({ where: { username: "synpilot-super-admin" }, select: { id: true, name: true } });
      const firstStarted = performance.now();
      const first = await restoreValidatedBackup(target, backup, actor);
      const firstRestoreMs = Math.round(performance.now() - firstStarted);
      const firstErrors = restoreErrors(first as unknown as Record<string, unknown>);
      invariant(firstErrors.length === 0, `SYNTHETIC_PILOT_FIRST_RESTORE_ERRORS:${firstErrors.join(";")}`);
      const firstSnapshot = await snapshot(target);

      const secondStarted = performance.now();
      const second = await restoreValidatedBackup(target, backup, actor);
      const secondRestoreMs = Math.round(performance.now() - secondStarted);
      const secondErrors = restoreErrors(second as unknown as Record<string, unknown>);
      invariant(secondErrors.length === 0, `SYNTHETIC_PILOT_SECOND_RESTORE_ERRORS:${secondErrors.join(";")}`);
      const secondSnapshot = await snapshot(target);
      invariant(JSON.stringify(firstSnapshot) === JSON.stringify(secondSnapshot), "SYNTHETIC_PILOT_DOUBLE_RESTORE_NOT_IDEMPOTENT");
      invariant(JSON.stringify(sourceSnapshot) === JSON.stringify(firstSnapshot), "SYNTHETIC_PILOT_RESTORED_COUNTS_OR_TOTALS_MISMATCH");
      const restoredNative = await target.nativeSession.findUniqueOrThrow({ where: { id: "synpilot-native-session" }, select: { revokedAt: true, revocationReason: true } });
      invariant(restoredNative.revokedAt && restoredNative.revocationReason === "RESTORED_CREDENTIAL_REQUIRES_REAUTHORIZATION", "SYNTHETIC_PILOT_NATIVE_SESSION_REACTIVATED");
      invariant(await target.user.count() === backup.users.length, "SYNTHETIC_PILOT_RESTORE_IMPORTED_LOGIN_USERS");

      const evidence = {
        verdict: "SYNTHETIC_PILOT_BACKUP_RESTORE_PASSED",
        synthetic: true,
        backupVersion: 45,
        logicalBackupSha256: sha256(serialized),
        encryptedAssetSha256: assetProof.artifactSha256,
        encryptedAssetWrongKeyRefused: wrongKeyRefused,
        privateFilesRestoredTwice: assetProof.fileCount,
        source: sourceSnapshot,
        restored: secondSnapshot,
        nativeSessionRestoredRevoked: true,
        timingsMs: { logicalBackup: logicalBackupMs, schemaMigration: migrationMs, firstRestore: firstRestoreMs, idempotentSecondRestore: secondRestoreMs, privateAssetBackupAndTwoRestores: assetBackupMs, total: Math.round(performance.now() - totalStarted) },
        timingDisclaimer: "Local synthetic rehearsal measurement; not a production SLA."
      };
      writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      console.log(JSON.stringify(evidence));
      success = true;
    } finally {
      await target.$disconnect();
    }
  } finally {
    await source.$disconnect();
    if (targetPath) cleanupIsolatedDatabase(targetPath);
    if (success && existsSync(rehearsalRoot)) rmSync(rehearsalRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "SYNTHETIC_PILOT_BACKUP_RESTORE_FAILED");
  process.exitCode = 1;
});
