import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  BASELINE_MIGRATION,
  OPERATIONAL_DATABASE,
  assertSchemaEquivalent,
  assertIsolatedDatabasePath,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseDataSnapshot,
  fileSha256,
  runPrisma,
  schemaFingerprint
} from "./migration-check-utils";

function baselineApplied(databasePath: string) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const table = db.prepare("SELECT COUNT(*) AS value FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'").get() as { value: number };
    if (!table.value) return false;
    const row = db.prepare("SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name=?").get(BASELINE_MIGRATION) as {finished_at:unknown;rolled_back_at:unknown} | undefined;
    return Boolean(row?.finished_at) && row?.rolled_back_at == null;
  } finally {
    db.close();
  }
}

function onboard(databasePath: string) {
  if (!baselineApplied(databasePath)) {
    runPrisma(["migrate", "resolve", "--applied", BASELINE_MIGRATION, "--schema", "prisma/schema.prisma"], databasePath);
  }
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
  const status = runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"], databasePath);
  if (!/database schema is up to date/i.test(status.combined)) throw new Error("COPIED_DATABASE_STATUS_NOT_CLEAN");
}

export async function runExistingDatabaseRehearsal(sourcePath = OPERATIONAL_DATABASE) {
  const source = path.resolve(sourcePath);
  if (!existsSync(source)) throw new Error("EXISTING_DATABASE_SOURCE_MISSING");
  const destination = createEmptyIsolatedDatabase("operational-copy", "existing-db-check");
  let success = false;
  try {
    assertIsolatedDatabasePath(destination);
    copyFileSync(source, destination);
    const sourceHashBefore = fileSha256(source);
    if (fileSha256(destination) !== sourceHashBefore) throw new Error("OPERATIONAL_COPY_HASH_MISMATCH");
    assertSchemaEquivalent(destination);
    const before = {
      schema: schemaFingerprint(destination),
      data: databaseDataSnapshot(destination),
      business: businessBaseline(destination)
    };
    onboard(destination);
    const afterFirst = {
      schema: schemaFingerprint(destination),
      data: databaseDataSnapshot(destination),
      business: businessBaseline(destination)
    };
    onboard(destination);
    const afterSecond = {
      schema: schemaFingerprint(destination),
      data: databaseDataSnapshot(destination),
      business: businessBaseline(destination)
    };
    if (JSON.stringify(before) !== JSON.stringify(afterFirst) || JSON.stringify(afterFirst) !== JSON.stringify(afterSecond)) {
      throw new Error("APPLICATION_DATA_OR_SCHEMA_CHANGED_DURING_ONBOARDING");
    }
    if (fileSha256(source) !== sourceHashBefore) throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_REHEARSAL");
    success = true;
    console.log(`Existing database onboarding passed twice: applicationTables=${Object.keys(before.data.counts).length}`);
    console.log(`Business baseline preserved: students=${before.business.students} activeEnrollments=${before.business.activeEnrollments} payments=${before.business.payments} collected=${before.business.collected}`);
    console.log(`Application schema fingerprint: ${before.schema}`);
    console.log(`Business data digest: ${before.data.digest}`);
    return { sourceHash: sourceHashBefore, ...before };
  } finally {
    if (success) cleanupIsolatedDatabase(destination);
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/migration-existing-db-rehearsal.ts")) {
  const run = async () => {
    if (!process.argv.includes("--synthetic")) return runExistingDatabaseRehearsal();
    const source = createEmptyIsolatedDatabase("operational-copy", "synthetic-unbaselined-source");
    try {
      runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], source);
      const db = new DatabaseSync(source);
      db.exec("DROP TABLE _prisma_migrations");
      db.close();
      return await runExistingDatabaseRehearsal(source);
    } finally {
      cleanupIsolatedDatabase(source);
    }
  };
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "Existing database rehearsal failed");
    process.exitCode = 1;
  });
}
