import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  formatDeploymentEnvironmentResult,
  validateDeploymentEnvironment
} from "../lib/deployment-environment";
import { businessBaseline } from "./migration-check-utils";

function sqlitePath(databaseUrl: string, dataRoot: string) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?")) {
    throw new Error("STAGING_DATABASE_URL_INVALID");
  }
  return path.resolve(dataRoot, databaseUrl.slice(5));
}

function main() {
  const validation = validateDeploymentEnvironment(process.env);
  if (!validation.ok) throw new Error(formatDeploymentEnvironmentResult(validation));

  const dataRoot = path.resolve(process.env.STAGING_DATA_DIR!);
  const databasePath = sqlitePath(process.env.DATABASE_URL!, dataRoot);
  const baseline = businessBaseline(databasePath);
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const migration = database.prepare(
      "SELECT migration_name AS name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC LIMIT 1"
    ).get() as { name?: string } | undefined;
    const sentinels = database.prepare(
      "SELECT (SELECT COUNT(*) FROM Student WHERE admissionNo LIKE 'STG-%') AS students, (SELECT COUNT(*) FROM User WHERE username LIKE 'stg-%') AS users"
    ).get() as { students: number; users: number };

    if (migration?.name !== "20260722_clean_install_baseline") {
      throw new Error("STAGING_ACTIVE_MIGRATION_MISMATCH");
    }
    if (
      baseline.students !== 1 ||
      baseline.activeEnrollments !== 1 ||
      baseline.payments !== 0 ||
      baseline.collected !== 0 ||
      Number(sentinels.students) !== 1 ||
      Number(sentinels.users) !== 1
    ) {
      throw new Error("STAGING_SYNTHETIC_BASELINE_MISMATCH");
    }

    console.log(
      `Synthetic staging check passed: migration=${migration.name} students=1 activeEnrollments=1 payments=0 collected=0`
    );
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "STAGING_SYNTHETIC_CHECK_FAILED");
  process.exitCode = 1;
}
