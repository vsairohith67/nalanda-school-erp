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
    const sentinels = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM Student WHERE admissionNo = 'QA-STUDENT-001' AND studentName = 'QA-STUDENT' AND phone1 = '0000000000') AS students,
        (SELECT COUNT(*) FROM User WHERE username LIKE 'qa-%' AND name LIKE 'QA-%' AND email LIKE '%@staging.example.invalid') AS users,
        (SELECT COUNT(*) FROM Guardian WHERE id = 'qa-staging-guardian' AND displayName = 'QA-PARENT' AND primaryMobile = '0000000000' AND email LIKE '%@staging.example.invalid') AS guardians,
        (SELECT COUNT(*) FROM StaffMember WHERE id = 'qa-staging-staff' AND fullName = 'QA-TEACHER' AND mobile = '0000000000' AND email LIKE '%@staging.example.invalid') AS staff
    `).get() as { students: number; users: number; guardians: number; staff: number };
    const roles = database.prepare(
      "SELECT role, COUNT(*) AS count FROM User GROUP BY role ORDER BY role"
    ).all() as Array<{ role: string; count: number }>;
    const roleCounts = new Map(roles.map((row) => [row.role, Number(row.count)]));

    if (migration?.name !== "20260722_clean_install_baseline") {
      throw new Error("STAGING_ACTIVE_MIGRATION_MISMATCH");
    }
    if (
      baseline.students !== 1 ||
      baseline.activeEnrollments !== 1 ||
      baseline.payments !== 0 ||
      baseline.collected !== 0 ||
      Number(sentinels.students) !== 1 ||
      Number(sentinels.users) !== 4 ||
      Number(sentinels.guardians) !== 1 ||
      Number(sentinels.staff) !== 1 ||
      roleCounts.get("DIRECTOR") !== 1 ||
      roleCounts.get("PRINCIPAL") !== 1 ||
      roleCounts.get("TEACHER") !== 1 ||
      roleCounts.get("PARENT") !== 1 ||
      roles.length !== 4
    ) {
      throw new Error("STAGING_SYNTHETIC_BASELINE_MISMATCH");
    }

    console.log(
      `Synthetic staging check passed: migration=${migration.name} users=4 students=1 activeEnrollments=1 guardians=1 staff=1 payments=0 collected=0`
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
