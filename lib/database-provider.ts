export type DatabaseProvider = "sqlite" | "postgresql";
export type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const CERTIFICATE_VALIDATING_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

function configured(environment: DatabaseEnvironment, name: string) {
  return String(environment[name] ?? "").trim();
}

function deploymentPostgresUrl(value: string, label: "DATABASE_URL" | "DIRECT_URL") {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label}_INVALID`);
  }
  const sslMode = (parsed.searchParams.get("sslmode") ?? "").toLowerCase();
  const sslAccept = (parsed.searchParams.get("sslaccept") ?? "").toLowerCase();
  if (!CERTIFICATE_VALIDATING_SSL_MODES.has(sslMode)) throw new Error("POSTGRESQL_DEPLOYMENT_TLS_REQUIRED");
  if (sslAccept !== "strict") throw new Error("POSTGRESQL_DEPLOYMENT_TLS_CERTIFICATE_VALIDATION_REQUIRED");
  return parsed;
}

function boundedPositiveInteger(url: URL, name: string, maximum: number, code: string) {
  const value = Number(url.searchParams.get(name));
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(code);
}

export function resolveDatabaseProvider(environment: DatabaseEnvironment = process.env): DatabaseProvider {
  const value = configured(environment, "DATABASE_PROVIDER").toLowerCase();
  if (!value) return "sqlite";
  if (value === "sqlite" || value === "postgresql") return value;
  throw new Error("DATABASE_PROVIDER_INVALID");
}

export function isSyntheticSqliteDeploymentOverride(environment: DatabaseEnvironment = process.env) {
  return configured(environment, "POSTGRES_READINESS_SQLITE_QA_OVERRIDE") === "SYNTHETIC_LOCAL_ONLY"
    && configured(environment, "NALANDA_LOCAL_REHEARSAL") === "true"
    && configured(environment, "QA20C_ISOLATED_DATABASE") === "true";
}

export function assertDatabaseProviderConfiguration(environment: DatabaseEnvironment = process.env) {
  const provider = resolveDatabaseProvider(environment);
  const databaseUrl = configured(environment, "DATABASE_URL");
  const directUrl = configured(environment, "DIRECT_URL");
  const deployment = (configured(environment, "DEPLOYMENT_ENVIRONMENT") || configured(environment, "NALANDA_ENVIRONMENT")).toLowerCase();

  if (databaseUrl) {
    const matches = provider === "sqlite" ? databaseUrl.startsWith("file:") : POSTGRES_URL.test(databaseUrl);
    if (!matches) throw new Error("DATABASE_PROVIDER_URL_MISMATCH");
  }
  if (directUrl && provider !== "postgresql") throw new Error("DIRECT_URL_PROVIDER_MISMATCH");
  if (provider === "postgresql" && directUrl && !POSTGRES_URL.test(directUrl)) throw new Error("DIRECT_URL_INVALID");
  if (["staging", "production"].includes(deployment)) {
    if (provider === "sqlite" && !isSyntheticSqliteDeploymentOverride(environment)) {
      throw new Error("SQLITE_DEPLOYMENT_ENVIRONMENT_FORBIDDEN");
    }
    if (provider === "postgresql" && (!POSTGRES_URL.test(databaseUrl) || !POSTGRES_URL.test(directUrl))) {
      throw new Error("POSTGRESQL_DEPLOYMENT_URLS_REQUIRED");
    }
    if (provider === "postgresql") {
      const runtime = deploymentPostgresUrl(databaseUrl, "DATABASE_URL");
      const migrator = deploymentPostgresUrl(directUrl, "DIRECT_URL");
      if (!runtime.username || !migrator.username || runtime.username === migrator.username) throw new Error("POSTGRESQL_DEPLOYMENT_DISTINCT_IDENTITIES_REQUIRED");
      boundedPositiveInteger(runtime, "connection_limit", 50, "POSTGRESQL_RUNTIME_CONNECTION_LIMIT_REQUIRED");
      boundedPositiveInteger(runtime, "pool_timeout", 60, "POSTGRESQL_RUNTIME_POOL_TIMEOUT_REQUIRED");
      boundedPositiveInteger(runtime, "connect_timeout", 30, "POSTGRESQL_RUNTIME_CONNECT_TIMEOUT_REQUIRED");
      boundedPositiveInteger(migrator, "connect_timeout", 30, "POSTGRESQL_MIGRATOR_CONNECT_TIMEOUT_REQUIRED");
    }
  }
  return { provider, deployment: deployment || "local", databaseUrlConfigured: Boolean(databaseUrl), directUrlConfigured: Boolean(directUrl) };
}

export function databaseProviderLabel(environment: DatabaseEnvironment = process.env) {
  return resolveDatabaseProvider(environment) === "postgresql" ? "PostgreSQL" : "SQLite";
}
