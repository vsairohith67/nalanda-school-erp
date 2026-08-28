import { prisma } from "@/lib/prisma";
import { validatePortableRuntimeConfiguration } from "@/lib/portable-runtime/config";
import { configuredPrivateObjectStore } from "@/lib/portable-runtime/private-object-store";
import { configuredRateLimitStore } from "@/lib/security-resilience";

type HealthState = "ready" | "unavailable" | "not-required";
type DependencyHealth = { state: HealthState; safeCode: string };

async function databaseHealth(): Promise<DependencyHealth> {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    if ((process.env.DATABASE_PROVIDER || "sqlite").toLowerCase() === "postgresql") {
      const expected = process.env.PORTABLE_EXPECTED_POSTGRES_MIGRATION?.trim();
      if (expected) {
        const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
          'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL ORDER BY "finished_at" DESC LIMIT 1'
        );
        if (rows[0]?.migration_name !== expected) return { state: "unavailable", safeCode: "MIGRATION_MISMATCH" };
      }
    }
    return { state: "ready", safeCode: "DATABASE_READY" };
  } catch {
    return { state: "unavailable", safeCode: "DATABASE_UNAVAILABLE" };
  }
}

async function valkeyHealth(): Promise<DependencyHealth> {
  if ((process.env.VALKEY_MODE || "memory").toLowerCase() !== "distributed") return { state: "not-required", safeCode: "VALKEY_NOT_REQUIRED" };
  const store = configuredRateLimitStore(process.env) as { healthCheck?: () => Promise<{ ready: boolean }> } | null;
  if (!store?.healthCheck) return { state: "unavailable", safeCode: "VALKEY_UNAVAILABLE" };
  try { return (await store.healthCheck()).ready ? { state: "ready", safeCode: "VALKEY_READY" } : { state: "unavailable", safeCode: "VALKEY_UNAVAILABLE" }; }
  catch { return { state: "unavailable", safeCode: "VALKEY_UNAVAILABLE" }; }
}

async function objectStoreHealth(): Promise<DependencyHealth> {
  try {
    const result = await configuredPrivateObjectStore().healthCheck();
    return result.ready ? { state: "ready", safeCode: result.safeCode } : { state: "unavailable", safeCode: result.safeCode };
  } catch {
    return { state: "unavailable", safeCode: "OBJECT_STORE_UNAVAILABLE" };
  }
}

export async function portableReadiness() {
  const configuration = validatePortableRuntimeConfiguration(process.env, "web");
  const [database, valkey, objectStore] = await Promise.all([databaseHealth(), valkeyHealth(), objectStoreHealth()]);
  const maintenance = process.env.NALANDA_MAINTENANCE_MODE === "true";
  const ready = configuration.ok && !maintenance && [database, valkey, objectStore].every((dependency) => dependency.state !== "unavailable");
  return {
    ready,
    maintenance,
    safeCode: ready ? "PORTABLE_RUNTIME_READY" : maintenance ? "MAINTENANCE_ACTIVE" : "PORTABLE_RUNTIME_NOT_READY",
    dependencies: { database, valkey, objectStore },
    configuration: { ok: configuration.ok, issueCodes: [...new Set(configuration.issues.map((issue) => issue.code))].sort() }
  };
}
