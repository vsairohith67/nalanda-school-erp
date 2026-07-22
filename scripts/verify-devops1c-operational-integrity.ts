import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { businessBaseline } from "./migration-check-utils";

const expected = {
  databaseHash: "1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392",
  databaseSize: 4_771_840,
  databaseMtimeUtc: "2026-07-19T13:21:15.353Z",
  schemaHash: "B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00",
  migrationHash: "E6D467206CFA536487C8C63882D13BA489C0235BE74E9E076423323A511C3025",
  baseline: { students: 8, activeEnrollments: 8, payments: 19, collected: 99_100 },
  backupVersion: 37
} as const;

function sha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase();
}

function main() {
  const workspace = process.cwd();
  const databasePath = path.join(workspace, "prisma", "dev.db");
  const schemaPath = path.join(workspace, "prisma", "schema.prisma");
  const migrationPath = path.join(workspace, "prisma", "migrations", "20260722_clean_install_baseline", "migration.sql");
  const stats = statSync(databasePath);
  const actual = {
    databaseHash: sha256(databasePath),
    databaseSize: stats.size,
    databaseMtimeUtc: stats.mtime.toISOString(),
    schemaHash: sha256(schemaPath),
    migrationHash: sha256(migrationPath),
    baseline: businessBaseline(databasePath)
  };
  const database = new DatabaseSync(databasePath, { readOnly: true });
  let migrationMetadataTables = 0;
  try {
    migrationMetadataTables = Number((database.prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'"
    ).get() as { count: number }).count);
  } finally {
    database.close();
  }
  const backupSource = readFileSync(path.join(workspace, "lib", "backup.ts"), "utf8");
  const backupVersion = Number(backupSource.match(/backupVersion:\s*(\d+)/)?.[1] ?? 0);

  const failures = [
    actual.databaseHash !== expected.databaseHash && "databaseHash",
    actual.databaseSize !== expected.databaseSize && "databaseSize",
    actual.databaseMtimeUtc !== expected.databaseMtimeUtc && "databaseMtimeUtc",
    actual.schemaHash !== expected.schemaHash && "schemaHash",
    actual.migrationHash !== expected.migrationHash && "migrationHash",
    JSON.stringify(actual.baseline) !== JSON.stringify(expected.baseline) && "businessBaseline",
    migrationMetadataTables !== 0 && "migrationMetadataTables",
    backupVersion !== expected.backupVersion && "backupVersion"
  ].filter(Boolean);
  if (failures.length) {
    console.error(JSON.stringify({ result: "DEVOPS1C_OPERATIONAL_INTEGRITY_MISMATCH", failures, ...actual, migrationMetadataTables, backupVersion }));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    result: "DEVOPS1C_OPERATIONAL_INTEGRITY_PASSED",
    ...actual,
    migrationMetadataTables,
    activeMigration: "20260722_clean_install_baseline",
    backupVersion
  }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "DEVOPS1C_OPERATIONAL_INTEGRITY_FAILED");
  process.exitCode = 1;
}
