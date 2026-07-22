import { assertSchemaEquivalent, cleanupIsolatedDatabase, createEmptyIsolatedDatabase, runPrisma } from "./migration-check-utils";

export async function runMigrationSchemaEquivalenceCheck() {
  const databasePath = createEmptyIsolatedDatabase("empty-db", "schema-check");
  let success = false;
  try {
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
    const result = assertSchemaEquivalent(databasePath);
    success = true;
    console.log(`Schema equivalence passed: models=${result.models} tables=${result.tables} indexes=${result.indexes} foreignKeys=${result.foreignKeys}`);
    console.log(`Canonical schema fingerprint: ${result.fingerprint}`);
    return result;
  } finally {
    if (success) cleanupIsolatedDatabase(databasePath);
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/migration-schema-equivalence.ts")) {
  runMigrationSchemaEquivalenceCheck().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration schema check failed");
    process.exitCode = 1;
  });
}
