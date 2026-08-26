import { describe, expect, it } from "vitest";
import {
  assertDatabaseProviderConfiguration,
  isSyntheticSqliteDeploymentOverride,
  resolveDatabaseProvider
} from "@/lib/database-provider";

describe("database provider contract", () => {
  it("keeps the committed and missing-value default on SQLite", () => {
    expect(resolveDatabaseProvider({})).toBe("sqlite");
    expect(assertDatabaseProviderConfiguration({ DATABASE_URL: "file:./synthetic.db" }).provider).toBe("sqlite");
  });

  it("rejects unknown providers and provider/URL mismatches", () => {
    expect(() => resolveDatabaseProvider({ DATABASE_PROVIDER: "mysql" })).toThrowError("DATABASE_PROVIDER_INVALID");
    expect(() => assertDatabaseProviderConfiguration({ DATABASE_PROVIDER: "postgresql", DATABASE_URL: "file:./synthetic.db" })).toThrowError("DATABASE_PROVIDER_URL_MISMATCH");
    expect(() => assertDatabaseProviderConfiguration({ DATABASE_PROVIDER: "sqlite", DATABASE_URL: "postgresql://localhost/synthetic" })).toThrowError("DATABASE_PROVIDER_URL_MISMATCH");
  });

  it("requires PostgreSQL and both URLs for staging and production", () => {
    expect(() => assertDatabaseProviderConfiguration({ DEPLOYMENT_ENVIRONMENT: "staging", DATABASE_URL: "file:./synthetic.db" })).toThrowError("SQLITE_DEPLOYMENT_ENVIRONMENT_FORBIDDEN");
    expect(() => assertDatabaseProviderConfiguration({ DATABASE_PROVIDER: "postgresql", DEPLOYMENT_ENVIRONMENT: "production", DATABASE_URL: "postgresql://localhost/runtime" })).toThrowError("POSTGRESQL_DEPLOYMENT_URLS_REQUIRED");
    expect(() => assertDatabaseProviderConfiguration({ DATABASE_PROVIDER: "postgresql", DEPLOYMENT_ENVIRONMENT: "staging", DATABASE_URL: "postgresql://runtime_user@pooler/runtime", DIRECT_URL: "postgresql://migrator_user@direct/migrate" })).toThrowError("POSTGRESQL_DEPLOYMENT_TLS_REQUIRED");
    expect(() => assertDatabaseProviderConfiguration({ DATABASE_PROVIDER: "postgresql", DEPLOYMENT_ENVIRONMENT: "staging", DATABASE_URL: "postgresql://runtime_user@pooler/runtime?sslmode=require&sslaccept=accept_invalid_certs&connection_limit=5&pool_timeout=10&connect_timeout=10", DIRECT_URL: "postgresql://migrator_user@direct/migrate?sslmode=require&sslaccept=strict&connect_timeout=10" })).toThrowError("POSTGRESQL_DEPLOYMENT_TLS_CERTIFICATE_VALIDATION_REQUIRED");
    expect(assertDatabaseProviderConfiguration({ DATABASE_PROVIDER: "postgresql", DEPLOYMENT_ENVIRONMENT: "staging", DATABASE_URL: "postgresql://runtime_user@pooler/runtime?sslmode=require&sslaccept=strict&connection_limit=5&pool_timeout=10&connect_timeout=10", DIRECT_URL: "postgresql://migrator_user@direct/migrate?sslmode=require&sslaccept=strict&connect_timeout=10" }).provider).toBe("postgresql");
    expect(() => assertDatabaseProviderConfiguration({ DATABASE_PROVIDER: "postgresql", DEPLOYMENT_ENVIRONMENT: "production", DATABASE_URL: "postgresql://shared@pooler/runtime?sslmode=require&sslaccept=strict&connection_limit=5&pool_timeout=10&connect_timeout=10", DIRECT_URL: "postgresql://shared@direct/migrate?sslmode=require&sslaccept=strict&connect_timeout=10" })).toThrowError("POSTGRESQL_DEPLOYMENT_DISTINCT_IDENTITIES_REQUIRED");
  });

  it("allows only the explicit server-side synthetic SQLite rehearsal override", () => {
    const environment = {
      DEPLOYMENT_ENVIRONMENT: "staging",
      DATABASE_URL: "file:./tmp/synthetic.db",
      POSTGRES_READINESS_SQLITE_QA_OVERRIDE: "SYNTHETIC_LOCAL_ONLY",
      NALANDA_LOCAL_REHEARSAL: "true",
      QA20C_ISOLATED_DATABASE: "true"
    };
    expect(isSyntheticSqliteDeploymentOverride(environment)).toBe(true);
    expect(assertDatabaseProviderConfiguration(environment).provider).toBe("sqlite");
  });
});
