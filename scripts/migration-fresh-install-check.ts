import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import {
  assertSchemaEquivalent,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  runPnpm,
  runPrisma
} from "./migration-check-utils";

const SYNTHETIC_SEED_ENV = {
  NODE_ENV: "development" as const,
  SEED_DIRECTOR_PASSWORD: "DEVOPS1B-local-only-Director-2026!",
  SEED_ADMIN_PASSWORD: "DEVOPS1B-local-only-Admin-2026!",
  SEED_ACCOUNTANT_PASSWORD: "DEVOPS1B-local-only-Accountant-2026!",
  SEED_VIEWER_PASSWORD: "DEVOPS1B-local-only-Viewer-2026!"
};

export async function runMigrationFreshInstallCheck() {
  const databasePath = createEmptyIsolatedDatabase("empty-db", "fresh-check");
  let success = false;
  try {
    runPrisma(["generate", "--schema", "prisma/schema.prisma"], databasePath);
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
    const status = runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"], databasePath);
    if (!/database schema is up to date/i.test(status.combined)) throw new Error("MIGRATION_STATUS_NOT_CLEAN");
    const schema = assertSchemaEquivalent(databasePath);
    runPnpm(["db:seed"], databasePath, {
      ...SYNTHETIC_SEED_ENV,
      ALLOW_DEMO_USERS: "true",
      DEMO_USER_DATABASE_ROOT: path.dirname(databasePath),
      ALLOW_DEMO_BUSINESS_DATA: "true",
      DEMO_BUSINESS_DATA_ROOT: path.dirname(databasePath)
    });
    const lifecycle = runPnpm(["lifecycle:backfill"], databasePath, SYNTHETIC_SEED_ENV);
    if (!/No data changed/.test(lifecycle.combined)) throw new Error("LIFECYCLE_BACKFILL_NOT_DRY");

    const db = new DatabaseSync(databasePath, { readOnly: true });
    const users = Number((db.prepare("SELECT COUNT(*) AS value FROM User").get() as { value: number }).value);
    const students = Number((db.prepare("SELECT COUNT(*) AS value FROM Student").get() as { value: number }).value);
    const migrations = Number((db.prepare("SELECT COUNT(*) AS value FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL").get() as { value: number }).value);
    db.close();
    if (users !== 4 || students !== 8 || migrations !== 3) throw new Error("SYNTHETIC_BOOTSTRAP_COUNTS_INVALID");
    success = true;
    console.log(`Fresh migration check passed: migrations=${migrations} models=${schema.models} tables=${schema.tables}`);
    console.log(`Synthetic bootstrap passed: users=${users} students=${students}; lifecycle backfill remained dry-run.`);
    console.log(`Canonical schema fingerprint: ${schema.fingerprint}`);
    return { databasePath, schema, users, students, migrations };
  } finally {
    if (success) cleanupIsolatedDatabase(databasePath);
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/migration-fresh-install-check.ts")) {
  runMigrationFreshInstallCheck().catch((error) => {
    console.error(error instanceof Error ? error.message : "Fresh migration check failed");
    process.exitCode = 1;
  });
}
