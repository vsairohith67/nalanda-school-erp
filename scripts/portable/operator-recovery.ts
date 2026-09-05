import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createManualCloudBackupRun, executeCloudBackupRun } from "../../lib/cloud-backup-worker";
import { verifyStoredCloudBackupArtifact } from "../../lib/cloud-backup-verification";
import { createCloudBackupProvider } from "../../lib/cloud-backup-provider";
import { decryptCloudBackup } from "../../lib/cloud-backup-container";
import { parseAndValidateBackup } from "../../lib/restore";
import { restoreValidatedBackup } from "../../lib/restore-database";
import { hydratePortableRuntimeSecrets, readPortableSecret } from "../../lib/portable-runtime/secrets";

async function main() {
  if (process.env.NALANDA_SYNTHETIC_STAGING !== "true" || process.env.PORTABLE_OPERATOR_CI !== "true") throw new Error("SYNTHETIC_RECOVERY_ONLY");
  hydratePortableRuntimeSecrets();
  const sourceUrl = new URL(readPortableSecret("DATABASE_URL", process.env, { required: true }));
  if (sourceUrl.protocol !== "postgresql:" || sourceUrl.hostname !== "postgres" || sourceUrl.pathname !== "/nalanda_portable_synthetic") throw new Error("SYNTHETIC_DATABASE_REQUIRED");
  const source = new PrismaClient();
  const direct = readPortableSecret("DIRECT_URL", process.env, { required: true });
  const url = new URL(direct);
  if (url.protocol !== "postgresql:" || url.hostname !== "postgres" || url.pathname !== "/nalanda_portable_synthetic") throw new Error("SYNTHETIC_DATABASE_REQUIRED");
  const migrator = new PrismaClient({ datasourceUrl: direct });
  try {
    const profile = await source.cloudBackupProfile.findUnique({ where: { profileCode: "PORTABLE-SYNTHETIC-S3" } });
    if (!profile || profile.status !== "ACTIVE" || profile.providerKind !== "OBJECT_STORAGE") throw new Error("EXPLICIT_SYNTHETIC_PROFILE_REQUIRED");
    if (process.argv[2] === "backup") {
      const operationId = process.argv[3];
      if (!/^[a-f0-9]{16}$/.test(operationId ?? "")) throw new Error("BACKUP_OPERATION_INVALID");
      const run = await createManualCloudBackupRun(source, profile.id, "portable-synthetic-director");
      let result = await executeCloudBackupRun(source, run.id);
      const deadline = Date.now() + 10 * 60_000;
      while (!["VERIFIED", "FAILED"].includes(result.status) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const polled = await source.cloudBackupRun.findUnique({ where: { id: run.id } });
        if (!polled) throw new Error("BACKUP_RUN_MISSING");
        result = polled;
      }
      if (result.status !== "VERIFIED") throw new Error("BACKUP_NOT_VERIFIED");
      const artifact = await source.cloudBackupArtifact.findFirst({ where: { runId: run.id, status: "VERIFIED" } });
      if (!artifact || !(await verifyStoredCloudBackupArtifact(source, artifact.id)).verified) throw new Error("BACKUP_READBACK_FAILED");
      console.log(JSON.stringify({ state: "VERIFIED", operationId, id: artifact.id, ciphertextSha256: artifact.ciphertextSha256, backupVersion: 45 }));
      return;
    }
    const [command, id, hash, operationId] = process.argv.slice(2);
    if (command !== "restore" || !/^[a-z0-9-]{8,64}$/.test(id ?? "") || !/^[a-f0-9]{64}$/.test(hash ?? "") || !/^[a-f0-9]{16}$/.test(operationId ?? "")) throw new Error("RESTORE_INPUT_INVALID");
    const artifact = await source.cloudBackupArtifact.findUnique({ where: { id }, include: { run: true } });
    if (!artifact || artifact.run.profileId !== profile.id || artifact.ciphertextSha256 !== hash || artifact.privateAssetsIncluded || !(await verifyStoredCloudBackupArtifact(source, id)).verified) throw new Error("RESTORE_ARTIFACT_INVALID");
    const decrypted = await decryptCloudBackup(await createCloudBackupProvider(profile).getObject(artifact.objectKeySafe));
    if (decrypted.header.ciphertextSha256 !== hash || decrypted.header.plaintextSha256 !== artifact.plaintextSha256) throw new Error("RESTORE_EXACT_BYTES_MISMATCH");
    const backup = parseAndValidateBackup(decrypted.plaintext.toString("utf8"));
    if (backup.metadata.backupVersion !== 45) throw new Error("RESTORE_VERSION_INVALID");
    const schema = `portable_restore_${operationId}`;
    // CREATE without IF NOT EXISTS is the empty-target reservation. Never clear an existing schema.
    await migrator.$executeRawUnsafe(`CREATE SCHEMA "${schema}" AUTHORIZATION nalanda_migrator`);
    url.searchParams.set("schema", schema);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], {
        env: { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() }, stdio: "ignore", windowsHide: true });
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("RESTORE_MIGRATION_TIMEOUT")); }, 15 * 60_000);
      child.once("error", () => { clearTimeout(timer); reject(new Error("RESTORE_MIGRATION_FAILED")); });
      child.once("exit", code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error("RESTORE_MIGRATION_FAILED")); });
    });
    const client = new PrismaClient({ datasourceUrl: url.toString() });
    try {
      await client.user.create({ data: { id: "portable-synthetic-director", name: "Synthetic recovery actor", username: `restore-${operationId}`, passwordHash: randomBytes(32).toString("hex"), role: "DIRECTOR", isActive: false, mustChangePassword: true } });
      const restored = await restoreValidatedBackup(client, backup, { id: "portable-synthetic-director", name: "Synthetic recovery actor" });
      const errors = Object.values(restored).flatMap(r => r && typeof r === "object" && "errors" in r ? (r as { errors: string[] }).errors : []);
      if (errors.length) throw new Error("RESTORE_ERRORS");
      console.log(JSON.stringify({ state: "RESTORED", operationId, ciphertextSha256: hash, backupVersion: 45, emptyTargetReserved: true, existingDataOverwritten: false }));
    } finally { await client.$disconnect(); }
    // Preserve the restored schema, including on partial failure. CI teardown owns its volume.
  } finally { await source.$disconnect(); await migrator.$disconnect(); }
}
main().catch(() => { console.error("OPERATOR_RECOVERY_FAILED"); process.exitCode = 1; });
