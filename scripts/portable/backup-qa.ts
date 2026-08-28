import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createManualCloudBackupRun, executeCloudBackupRun } from "@/lib/cloud-backup-worker";
import { verifyStoredCloudBackupArtifact } from "@/lib/cloud-backup-verification";
import { createCloudBackupProvider } from "@/lib/cloud-backup-provider";
import { decryptCloudBackup } from "@/lib/cloud-backup-container";
import { parseAndValidateBackup } from "@/lib/restore";
import { restoreValidatedBackup } from "@/lib/restore-database";
import { hydratePortableRuntimeSecrets, readPortableSecret } from "@/lib/portable-runtime/secrets";

hydratePortableRuntimeSecrets();
process.env.DATABASE_PROVIDER = "postgresql";
const source = new PrismaClient();
const directUrl = readPortableSecret("DIRECT_URL", process.env, { required: true });
const migrator = new PrismaClient({ datasourceUrl: directUrl });

function parsedDirectUrl() {
  try {
    const value = new URL(directUrl);
    if (!new Set(["postgres:", "postgresql:"]).has(value.protocol)) throw new Error("protocol");
    return value;
  } catch {
    throw new Error("PORTABLE_RESTORE_DIRECT_URL_INVALID");
  }
}

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function waitForWorkerRun(runId: string) {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const run = await source.cloudBackupRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error("PORTABLE_BACKUP_RUN_MISSING");
    if (run.status === "VERIFIED" || run.status === "FAILED") return run;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("PORTABLE_BACKUP_WORKER_TIMEOUT");
}

function runMigrations(databaseUrl: string) {
  const cli = path.resolve("node_modules", "prisma", "build", "index.js");
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl }
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("PORTABLE_RESTORE_MIGRATION_FAILED")));
  });
}

async function restoreTwice(backup: ReturnType<typeof parseAndValidateBackup>, schema: string) {
  if (!/^portable_restore_[a-f0-9]{16}$/.test(schema)) throw new Error("PORTABLE_RESTORE_SCHEMA_INVALID");
  await migrator.$executeRawUnsafe(`CREATE SCHEMA "${schema}" AUTHORIZATION nalanda_migrator`);
  const url = parsedDirectUrl();
  url.searchParams.set("schema", schema);
  const restoreUrl = url.toString();
  try {
    await runMigrations(restoreUrl);
    const client = new PrismaClient({ datasourceUrl: restoreUrl });
    try {
      await client.user.create({ data: {
        id: "portable-synthetic-director",
        name: "Portable synthetic restore rehearsal",
        username: `portable-restore-${schema}`,
        passwordHash: randomBytes(32).toString("hex"),
        role: "DIRECTOR",
        isActive: false,
        mustChangePassword: true
      } });
      const first = await restoreValidatedBackup(client, backup, { id: "portable-synthetic-director", name: "Portable synthetic restore rehearsal" });
      const firstErrors = Object.values(first).flatMap((entry) => entry && typeof entry === "object" && "errors" in entry ? (entry as { errors: string[] }).errors : []);
      if (firstErrors.length) console.error(JSON.stringify({ code: "PORTABLE_FIRST_RESTORE_ERRORS", count: firstErrors.length, syntheticErrors: firstErrors.slice(0, 25) }));
      invariant(firstErrors.length === 0, "PORTABLE_FIRST_RESTORE_ERRORS");
      const afterFirst = {
        students: await client.student.count(),
        payments: await client.payment.count(),
        users: await client.user.count(),
        meetings: await client.parentMeeting.count(),
        offlineMutations: await client.offlineSyncMutation.count()
      };
      const second = await restoreValidatedBackup(client, backup, { id: "portable-synthetic-director", name: "Portable synthetic restore rehearsal" });
      const secondErrors = Object.values(second).flatMap((entry) => entry && typeof entry === "object" && "errors" in entry ? (entry as { errors: string[] }).errors : []);
      if (secondErrors.length) console.error(JSON.stringify({ code: "PORTABLE_SECOND_RESTORE_ERRORS", count: secondErrors.length, syntheticErrors: secondErrors.slice(0, 25) }));
      invariant(secondErrors.length === 0, "PORTABLE_SECOND_RESTORE_ERRORS");
      const afterSecond = {
        students: await client.student.count(),
        payments: await client.payment.count(),
        users: await client.user.count(),
        meetings: await client.parentMeeting.count(),
        offlineMutations: await client.offlineSyncMutation.count()
      };
      invariant(JSON.stringify(afterFirst) === JSON.stringify(afterSecond), "PORTABLE_RESTORE_NOT_IDEMPOTENT");
      return afterSecond;
    } finally { await client.$disconnect(); }
  } finally {
    await migrator.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}

try {
  const profile = await source.cloudBackupProfile.findUnique({ where: { profileCode: "PORTABLE-SYNTHETIC-S3" } });
  invariant(profile?.status === "ACTIVE" && profile.providerKind === "OBJECT_STORAGE" && profile.liveUseEnabled, "PORTABLE_BACKUP_PROFILE_NOT_ACTIVE");
  const started = Date.now();
  const run = await createManualCloudBackupRun(source, profile.id, "portable-synthetic-director");
  const completed = process.env.PORTABLE_BACKUP_WORKER_MANAGED === "true"
    ? await waitForWorkerRun(run.id)
    : await executeCloudBackupRun(source, run.id);
  invariant(completed.status === "VERIFIED", "PORTABLE_BACKUP_NOT_VERIFIED");
  const completedWithArtifacts = await source.cloudBackupRun.findUnique({
    where: { id: completed.id },
    include: { artifacts: { orderBy: { createdAt: "desc" }, take: 1 } }
  });
  const artifact = completedWithArtifacts?.artifacts[0];
  invariant(artifact?.status === "VERIFIED" && artifact.privateAssetsIncluded === false, "PORTABLE_BACKUP_ARTIFACT_INVALID");
  const verification = await verifyStoredCloudBackupArtifact(source, artifact.id);
  invariant(verification.verified, "PORTABLE_BACKUP_READBACK_FAILED");
  const provider = createCloudBackupProvider(profile);
  const encrypted = await provider.getObject(artifact.objectKeySafe);
  const decrypted = await decryptCloudBackup(encrypted);
  const backup = parseAndValidateBackup(decrypted.plaintext.toString("utf8"));
  const backupDurationMs = Date.now() - started;

  const restoreStarted = Date.now();
  const first = await restoreTwice(backup, `portable_restore_${randomBytes(8).toString("hex")}`);
  const second = await restoreTwice(backup, `portable_restore_${randomBytes(8).toString("hex")}`);
  invariant(JSON.stringify(first) === JSON.stringify(second), "PORTABLE_INDEPENDENT_RESTORE_MISMATCH");
  const restoreDurationMs = Date.now() - restoreStarted;
  console.log(JSON.stringify({
    result: "PORTABLE_BACKUP_QA_PASSED",
    backupVersion: backup.metadata.backupVersion,
    encrypted: true,
    destination: "S3_COMPATIBLE_PRIVATE",
    remoteReadbackVerified: true,
    restorePasses: 4,
    independentRestoreTargets: 2,
    counts: second,
    timings: { backupDurationMs, restoreDurationMs },
    realData: false
  }));
} catch (error) {
  const safeCode = error instanceof Error && /^PORTABLE_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "PORTABLE_BACKUP_QA_FAILED";
  console.error(safeCode);
  process.exitCode = 1;
} finally {
  await Promise.all([source.$disconnect(), migrator.$disconnect()]);
}
