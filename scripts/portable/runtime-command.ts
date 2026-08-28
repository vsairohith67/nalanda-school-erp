import { spawn } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertPortableRuntimeConfiguration, type PortableCommand } from "@/lib/portable-runtime/config";
import { hydratePortableRuntimeSecrets } from "@/lib/portable-runtime/secrets";
import { portableLog } from "@/lib/portable-runtime/observability";

const command = (process.argv[2] || process.env.NALANDA_IMAGE_COMMAND || "web") as PortableCommand;
hydratePortableRuntimeSecrets();
const configuration = assertPortableRuntimeConfiguration(process.env, command);

function runNode(entry: string, args: string[] = []) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { stdio: "inherit", env: process.env, windowsHide: true });
    let terminating = false;
    const terminate = (signal: NodeJS.Signals) => {
      if (terminating) return;
      terminating = true;
      child.kill(signal);
      const timeout = setTimeout(() => child.kill("SIGKILL"), Number(process.env.PORTABLE_SHUTDOWN_TIMEOUT_MS || 20_000));
      timeout.unref();
    };
    process.once("SIGTERM", () => terminate("SIGTERM"));
    process.once("SIGINT", () => terminate("SIGINT"));
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`PORTABLE_CHILD_EXIT:${signal || code || "unknown"}`));
    });
  });
}

async function withMigrationLock(operation: (client: PrismaClient) => Promise<void>) {
  const client = new PrismaClient({ datasourceUrl: configuration.directUrl });
  try {
    await client.$transaction(async (transaction) => {
      const lock = await transaction.$queryRawUnsafe<Array<{ acquired: boolean }>>(
        "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired",
        "nalanda-portable-staging-migration-v1"
      );
      if (!lock[0]?.acquired) throw new Error("PORTABLE_MIGRATION_LOCK_CONTENDED");
      await operation(client);
    }, { maxWait: 10_000, timeout: 15 * 60_000 });
  } finally { await client.$disconnect(); }
}

async function applyRuntimeGrants(client: PrismaClient) {
  const role = process.env.POSTGRES_RUNTIME_ROLE?.trim() || "nalanda_runtime";
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(role)) throw new Error("POSTGRES_RUNTIME_ROLE_INVALID");
  const quoted = `"${role}"`;
  const databaseRows = await client.$queryRawUnsafe<Array<{ name: string }>>("SELECT current_database() AS name");
  const databaseName = databaseRows[0]?.name;
  if (!databaseName || !/^[a-z][a-z0-9_]{2,62}$/.test(databaseName)) throw new Error("POSTGRES_DATABASE_NAME_INVALID");
  await client.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO ${quoted}`);
  await client.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${quoted}`);
  await client.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quoted}`);
  await client.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quoted}`);
  await client.$executeRawUnsafe(`REVOKE ALL ON TABLE "_prisma_migrations" FROM ${quoted}`);
  await client.$executeRawUnsafe(`GRANT SELECT ON TABLE "_prisma_migrations" TO ${quoted}`);
  await client.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoted}`);
  await client.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${quoted}`);
}

async function applyBackupGrants(client: PrismaClient) {
  const role = process.env.POSTGRES_BACKUP_ROLE?.trim() || "nalanda_backup";
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(role)) throw new Error("POSTGRES_BACKUP_ROLE_INVALID");
  const quoted = `"${role}"`;
  const databaseRows = await client.$queryRawUnsafe<Array<{ name: string }>>("SELECT current_database() AS name");
  const databaseName = databaseRows[0]?.name;
  if (!databaseName || !/^[a-z][a-z0-9_]{2,62}$/.test(databaseName)) throw new Error("POSTGRES_DATABASE_NAME_INVALID");
  await client.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO ${quoted}`);
  await client.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${quoted}`);
  await client.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${quoted}`);
  for (const table of [
    "CloudBackupRun", "CloudBackupArtifact", "CloudBackupVerification",
    "CloudBackupEvent", "CloudBackupSchedule"
  ]) {
    await client.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON TABLE "${table}" TO ${quoted}`);
  }
  await client.$executeRawUnsafe(`REVOKE ALL ON TABLE "_prisma_migrations" FROM ${quoted}`);
  await client.$executeRawUnsafe(`GRANT SELECT ON TABLE "_prisma_migrations" TO ${quoted}`);
  await client.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${quoted}`);

  const maintenanceRole = process.env.POSTGRES_BACKUP_MAINTENANCE_ROLE?.trim() || "nalanda_backup_maintenance";
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(maintenanceRole)) throw new Error("POSTGRES_BACKUP_MAINTENANCE_ROLE_INVALID");
  const maintenanceQuoted = `"${maintenanceRole}"`;
  await client.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO ${maintenanceQuoted}`);
  await client.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${maintenanceQuoted}`);
  await client.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${maintenanceQuoted}`);
  for (const table of [
    "CloudBackupProfile", "CloudBackupRetentionPolicy", "CloudBackupRun",
    "CloudBackupArtifact", "CloudBackupRestoreRehearsal", "CloudBackupEvent"
  ]) {
    await client.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON TABLE "${table}" TO ${maintenanceQuoted}`);
  }
  await client.$executeRawUnsafe(`REVOKE ALL ON TABLE "_prisma_migrations" FROM ${maintenanceQuoted}`);
  await client.$executeRawUnsafe(`GRANT SELECT ON TABLE "_prisma_migrations" TO ${maintenanceQuoted}`);
}

async function migration(action: "deploy" | "status") {
  if (configuration.databaseProvider !== "postgresql") throw new Error("PORTABLE_MIGRATION_REQUIRES_POSTGRESQL");
  const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
  if (action === "status") return runNode(prismaCli, ["migrate", "status", "--schema", "prisma/postgresql/schema.prisma"]);
  await withMigrationLock(async (client) => {
    await runNode(prismaCli, ["migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"]);
    await applyRuntimeGrants(client);
    await applyBackupGrants(client);
  });
}

async function healthProbe() {
  const target = process.env.PORTABLE_HEALTH_URL || "http://127.0.0.1:3000/api/health/ready";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(target, { signal: controller.signal, redirect: "error", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("PORTABLE_HEALTH_NOT_READY");
  } finally { clearTimeout(timeout); }
}

async function main() {
  portableLog("info", "PORTABLE_COMMAND_START", { command });
  switch (command) {
    case "web":
      await runNode(path.resolve("server.js"));
      return;
    case "migrate":
      await migration("deploy");
      return;
    case "migration-status":
      await migration("status");
      return;
    case "seed-synthetic":
      await runNode(path.resolve("dist/portable/seed-synthetic.mjs"));
      return;
    case "backup":
      await runNode(path.resolve("dist/portable/cloud-backup-command.mjs"), ["run-now"]);
      return;
    case "backup-worker":
      await runNode(path.resolve("dist/portable/backup-worker.mjs"));
      return;
    case "backup-maintenance":
      await runNode(path.resolve("dist/portable/retention-maintenance.mjs"), ["apply"]);
      return;
    case "backup-maintenance-plan":
      await runNode(path.resolve("dist/portable/retention-maintenance.mjs"), ["plan"]);
      return;
    case "restore":
      await runNode(path.resolve("dist/portable/cloud-backup-command.mjs"), ["rehearse"]);
      return;
    case "scheduled-job":
      await runNode(path.resolve("dist/portable/scheduled-job.mjs"), process.argv.slice(3));
      return;
    case "health-probe":
    case "maintenance-check":
      await healthProbe();
      return;
    default:
      throw new Error("PORTABLE_IMAGE_COMMAND_INVALID");
  }
}

main().catch((error) => {
  portableLog("error", "PORTABLE_COMMAND_FAILED", { command, result: error instanceof Error ? error.message.split(":", 1)[0] : "UNKNOWN" });
  process.exitCode = 1;
});
