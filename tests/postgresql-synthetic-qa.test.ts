import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertSyntheticPostgresQa, assertSyntheticSqliteTransfer } from "@/scripts/postgres/synthetic-qa";

const optIn = { POSTGRES_READINESS_SYNTHETIC_QA: "1", NODE_ENV: "test", NALANDA_ENVIRONMENT: "TEST" };

describe("PostgreSQL readiness synthetic QA guard", () => {
  it("accepts only an explicit local disposable PostgreSQL target", () => {
    expect(assertSyntheticPostgresQa({ ...optIn, DATABASE_PROVIDER: "postgresql", DATABASE_URL: "postgresql://synthetic@127.0.0.1:55432/nalanda_pgqa" })).toMatchObject({ host: "127.0.0.1", databaseName: "nalanda_pgqa" });
    expect(() => assertSyntheticPostgresQa({ DATABASE_PROVIDER: "postgresql", DATABASE_URL: "postgresql://synthetic@127.0.0.1/nalanda_pgqa" })).toThrow("POSTGRES_READINESS_SYNTHETIC_QA_OPT_IN_REQUIRED");
    expect(() => assertSyntheticPostgresQa({ ...optIn, DATABASE_PROVIDER: "postgresql", DATABASE_URL: "postgresql://synthetic@db.example.invalid/nalanda_pgqa" })).toThrow("POSTGRES_READINESS_SYNTHETIC_QA_LOOPBACK_REQUIRED");
    expect(() => assertSyntheticPostgresQa({ ...optIn, NODE_ENV: "production", DATABASE_PROVIDER: "postgresql", DATABASE_URL: "postgresql://synthetic@127.0.0.1/nalanda_pgqa" })).toThrow("POSTGRES_READINESS_SYNTHETIC_QA_PRODUCTION_FORBIDDEN");
    expect(() => assertSyntheticPostgresQa({ ...optIn, DATABASE_PROVIDER: "postgresql", DATABASE_URL: "postgresql://synthetic@127.0.0.1/nalanda" })).toThrow("POSTGRES_READINESS_SYNTHETIC_QA_DATABASE_NAME_REQUIRED");
  });

  it("accepts a synthetic SQLite source only under the workspace tmp directory", () => {
    const workspace = path.resolve("C:/synthetic-postgres-readiness-workspace");
    expect(assertSyntheticSqliteTransfer({ ...optIn, DATABASE_PROVIDER: "sqlite", DATABASE_URL: "file:../tmp/postgres-ci/sqlite.db" }, workspace).databasePath).toBe(path.resolve(workspace, "tmp/postgres-ci/sqlite.db"));
    expect(() => assertSyntheticSqliteTransfer({ ...optIn, DATABASE_PROVIDER: "sqlite", DATABASE_URL: "file:../operational.db" }, workspace)).toThrow("POSTGRES_READINESS_SYNTHETIC_QA_SQLITE_TMP_REQUIRED");
  });
});
