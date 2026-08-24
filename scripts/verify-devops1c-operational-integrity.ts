import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { businessBaseline } from "./migration-check-utils";

const expected = { baseline: { students: 0, activeEnrollments: 0, payments: 0, collected: 0 }, users: 4, roleAssignments: 4, activeSuperAdmins: 1, backupVersion: 43, operationalCheckDefinitions: 13 } as const;

function sha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase();
}

function main() {
  const workspace = process.cwd();
  const databasePath = path.join(workspace, "prisma", "dev.db");
  const schemaPath = path.join(workspace, "prisma", "schema.prisma");
  const stats = statSync(databasePath);
  const actual = {
    databaseHash: sha256(databasePath),
    databaseSize: stats.size,
    databaseMtimeUtc: stats.mtime.toISOString(),
    schemaHash: sha256(schemaPath),
    baseline: businessBaseline(databasePath)
  };
  const database = new DatabaseSync(databasePath, { readOnly: true });
  let migrationCount = 0;
  let quickCheck = "failed";
  let foreignKeyViolations = 0;
  let users = 0;
  let roleAssignments = 0;
  let activeSuperAdmins = 0;
  let operationalCheckDefinitions = 0;
  try {
    migrationCount = Number((database.prepare("SELECT COUNT(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL").get() as { count: number }).count);
    quickCheck = String(Object.values(database.prepare("PRAGMA quick_check").get() as Record<string, unknown>)[0] ?? "failed");
    foreignKeyViolations = database.prepare("PRAGMA foreign_key_check").all().length;
    users = Number((database.prepare("SELECT COUNT(*) AS count FROM User").get() as { count: number }).count);
    roleAssignments = Number((database.prepare("SELECT COUNT(*) AS count FROM UserRoleAssignment").get() as { count: number }).count);
    activeSuperAdmins = Number((database.prepare("SELECT COUNT(*) AS count FROM User WHERE role='SUPER_ADMIN' AND isActive=1 AND lifecycleStatus='ACTIVE'").get() as { count: number }).count);
    operationalCheckDefinitions = Number((database.prepare("SELECT COUNT(*) AS count FROM OperationalCheckDefinition").get() as { count: number }).count);
  } finally {
    database.close();
  }
  const backupSource = readFileSync(path.join(workspace, "lib", "backup.ts"), "utf8");
  const backupVersion = Number(backupSource.match(/backupVersion:\s*(\d+)/)?.[1] ?? 0);

  const failures = [
    JSON.stringify(actual.baseline) !== JSON.stringify(expected.baseline) && "businessBaseline",
    users !== expected.users && "protectedUsers",
    roleAssignments !== expected.roleAssignments && "protectedRoleAssignments",
    activeSuperAdmins !== expected.activeSuperAdmins && "activeSuperAdmins",
    quickCheck !== "ok" && "quickCheck",
    foreignKeyViolations !== 0 && "foreignKeyViolations",
    migrationCount < 17 && "migrationLedger",
    operationalCheckDefinitions !== expected.operationalCheckDefinitions && "operationalCheckDefinitions",
    backupVersion !== expected.backupVersion && "backupVersion"
  ].filter(Boolean);
  if (failures.length) {
    console.error(JSON.stringify({ result: "DEVOPS1C_OPERATIONAL_INTEGRITY_MISMATCH", failures, ...actual, migrationCount, quickCheck, foreignKeyViolations, users, roleAssignments, activeSuperAdmins, operationalCheckDefinitions, backupVersion }));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    result: "DEVOPS1C_OPERATIONAL_INTEGRITY_PASSED",
    ...actual,
    migrationCount,
    quickCheck,
    foreignKeyViolations,
    users,
    roleAssignments,
    activeSuperAdmins,
    operationalCheckDefinitions,
    backupVersion
  }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "DEVOPS1C_OPERATIONAL_INTEGRITY_FAILED");
  process.exitCode = 1;
}
