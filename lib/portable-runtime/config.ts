import { readPortableSecret } from "@/lib/portable-runtime/secrets";

export type PortableCommand =
  | "web"
  | "migrate"
  | "migration-status"
  | "seed-synthetic"
  | "backup"
  | "backup-worker"
  | "backup-maintenance"
  | "backup-maintenance-plan"
  | "restore"
  | "maintenance-check"
  | "scheduled-job"
  | "health-probe";

export type PortableDeploymentEnvironment = "development" | "test" | "synthetic-staging" | "staging" | "production";
export type PortableObjectStoreProvider = "FILESYSTEM" | "S3_COMPATIBLE";
export type PortableBackupDestination = "LOCAL_FILESYSTEM" | "S3_COMPATIBLE_PRIVATE";

export type PortableConfigurationIssue = {
  code: string;
  variable: string;
  safeMessage: string;
};

export type PortableRuntimeConfiguration = {
  environment: PortableDeploymentEnvironment;
  command: PortableCommand;
  applicationOrigin: string;
  databaseProvider: "sqlite" | "postgresql";
  databaseUrl: string;
  directUrl: string;
  valkeyMode: "memory" | "distributed";
  valkeyUrl: string;
  objectStoreProvider: PortableObjectStoreProvider;
  objectStoreBucket: string;
  objectStoreEndpoint: string;
  objectStoreRegion: string;
  objectStoreForcePathStyle: boolean;
  backupDestination: PortableBackupDestination;
  trustedProxy: boolean;
  maintenanceMode: boolean;
  metricsEnabled: boolean;
  structuredLogging: boolean;
  nativeMinimumVersion: string;
  nativeAllowedOrigins: string[];
};

const COMMANDS = new Set<PortableCommand>([
  "web", "migrate", "migration-status", "seed-synthetic", "backup", "backup-worker", "backup-maintenance", "backup-maintenance-plan", "restore",
  "maintenance-check", "scheduled-job", "health-probe"
]);
const ENVIRONMENTS = new Set<PortableDeploymentEnvironment>(["development", "test", "synthetic-staging", "staging", "production"]);
const FALSE_ONLY_FEATURES = [
  "PUBLIC_ADMISSIONS_ENABLED",
  "OFFLINE_SYNC_ENABLED",
  "CROSS_PLATFORM_APPS_ENABLED",
  "TRANSPORT_ENABLED",
  "CAFETERIA_ENABLED",
  "EVENT_MEDIA_PUBLIC_PUBLISHING_ENABLED",
  "CLOUD_AI_ENABLED",
  "LIVE_PROVIDERS_ENABLED",
  "WHATSAPP_LIVE_SENDING_ENABLED",
  "SMS_EMAIL_SMS_LIVE_ENABLED",
  "SMS_EMAIL_EMAIL_LIVE_ENABLED"
] as const;

function value(environment: NodeJS.ProcessEnv, name: string) {
  return environment[name]?.trim() ?? "";
}

function exactBoolean(environment: NodeJS.ProcessEnv, name: string, fallback: boolean, issues: PortableConfigurationIssue[]) {
  const raw = value(environment, name);
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  issues.push({ code: "BOOLEAN_INVALID", variable: name, safeMessage: "Use exactly true or false." });
  return fallback;
}

function parseUrl(
  raw: string,
  name: string,
  allowedProtocols: ReadonlySet<string>,
  issues: PortableConfigurationIssue[]
) {
  try {
    const parsed = new URL(raw);
    if (!allowedProtocols.has(parsed.protocol)) throw new Error("protocol");
    return parsed;
  } catch {
    issues.push({ code: "URL_INVALID", variable: name, safeMessage: "A valid absolute URL with the required protocol is required." });
    return null;
  }
}

function requirePostgresTls(parsed: URL | null, variable: string, issues: PortableConfigurationIssue[]) {
  if (!parsed) return;
  const mode = parsed.searchParams.get("sslmode")?.toLowerCase();
  const accept = parsed.searchParams.get("sslaccept")?.toLowerCase();
  if (!new Set(["require", "verify-ca", "verify-full"]).has(mode ?? "") || accept !== "strict") {
    issues.push({ code: "POSTGRES_TLS_REQUIRED", variable, safeMessage: "Certificate-validating PostgreSQL TLS is required." });
  }
}

function secretPresent(name: Parameters<typeof readPortableSecret>[0], environment: NodeJS.ProcessEnv, issues: PortableConfigurationIssue[], minimum = 32) {
  try {
    const secret = readPortableSecret(name, environment, { required: true });
    if (secret.length < minimum) throw new Error("short");
    return true;
  } catch {
    issues.push({ code: "SECRET_REQUIRED", variable: name, safeMessage: "A mounted or injected server secret is required." });
    return false;
  }
}

export function validatePortableRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
  requestedCommand = value(environment, "NALANDA_IMAGE_COMMAND") || "web"
) {
  const issues: PortableConfigurationIssue[] = [];
  const normalizedEnvironment = (value(environment, "NALANDA_ENVIRONMENT") || value(environment, "DEPLOYMENT_ENVIRONMENT") || "development").toLowerCase();
  const environmentName = ENVIRONMENTS.has(normalizedEnvironment as PortableDeploymentEnvironment)
    ? normalizedEnvironment as PortableDeploymentEnvironment
    : "development";
  if (!ENVIRONMENTS.has(normalizedEnvironment as PortableDeploymentEnvironment)) {
    issues.push({ code: "ENVIRONMENT_INVALID", variable: "NALANDA_ENVIRONMENT", safeMessage: "The deployment environment is not recognized." });
  }
  const command = COMMANDS.has(requestedCommand as PortableCommand) ? requestedCommand as PortableCommand : "web";
  if (!COMMANDS.has(requestedCommand as PortableCommand)) {
    issues.push({ code: "COMMAND_INVALID", variable: "NALANDA_IMAGE_COMMAND", safeMessage: "The image command is not recognized." });
  }
  const governed = new Set<PortableDeploymentEnvironment>(["synthetic-staging", "staging", "production"]).has(environmentName);
  const remote = environmentName === "staging" || environmentName === "production";
  const isBackupWorker = command === "backup-worker" || command === "backup-maintenance" || command === "backup-maintenance-plan";
  const isMaintenancePlan = command === "backup-maintenance-plan";
  const needsBackupEncryption = new Set<PortableCommand>(["backup", "backup-worker", "restore"]).has(command);
  const applicationOrigin = value(environment, "APP_ORIGIN");
  const origin = parseUrl(applicationOrigin, "APP_ORIGIN", new Set(remote ? ["https:"] : ["http:", "https:"]), issues);
  if (remote && origin && ["localhost", "127.0.0.1", "::1"].includes(origin.hostname)) {
    issues.push({ code: "REMOTE_ORIGIN_LOOPBACK", variable: "APP_ORIGIN", safeMessage: "Remote staging and production require an approved non-loopback HTTPS origin." });
  }

  const databaseProvider = (value(environment, "DATABASE_PROVIDER") || "sqlite").toLowerCase() === "postgresql" ? "postgresql" : "sqlite";
  if (!new Set(["sqlite", "postgresql"]).has((value(environment, "DATABASE_PROVIDER") || "sqlite").toLowerCase())) {
    issues.push({ code: "DATABASE_PROVIDER_INVALID", variable: "DATABASE_PROVIDER", safeMessage: "Use exactly sqlite or postgresql." });
  }
  if (governed && databaseProvider !== "postgresql") {
    issues.push({ code: "POSTGRES_REQUIRED", variable: "DATABASE_PROVIDER", safeMessage: "Portable staging and production require PostgreSQL." });
  }
  const needsDirect = command === "migrate" || command === "migration-status";
  let databaseUrl = "";
  let directUrl = "";
  try { databaseUrl = readPortableSecret("DATABASE_URL", environment, { required: true }); }
  catch { issues.push({ code: "DATABASE_URL_REQUIRED", variable: "DATABASE_URL", safeMessage: "A mounted or injected database URL is required." }); }
  if (needsDirect) {
    try { directUrl = readPortableSecret("DIRECT_URL", environment, { required: true }); }
    catch { issues.push({ code: "DIRECT_URL_REQUIRED", variable: "DIRECT_URL", safeMessage: "A mounted or injected migrator URL is required." }); }
  } else {
    try { directUrl = readPortableSecret("DIRECT_URL", environment); }
    catch { issues.push({ code: "DIRECT_URL_INVALID", variable: "DIRECT_URL", safeMessage: "The migrator URL secret source is invalid." }); }
  }
  const database = parseUrl(databaseUrl, "DATABASE_URL", new Set(databaseProvider === "postgresql" ? ["postgres:", "postgresql:"] : ["file:"]), issues);
  const direct = needsDirect ? parseUrl(directUrl, "DIRECT_URL", new Set(["postgres:", "postgresql:"]), issues) : null;
  if (remote && databaseProvider === "postgresql") {
    requirePostgresTls(database, "DATABASE_URL", issues);
    if (needsDirect) requirePostgresTls(direct, "DIRECT_URL", issues);
  }
  if (needsDirect && database && direct && database.username === direct.username) {
    issues.push({ code: "DATABASE_IDENTITIES_NOT_SEPARATE", variable: "DIRECT_URL", safeMessage: "Runtime and migrator database identities must be distinct." });
  }
  if (command === "web" && directUrl) {
    issues.push({ code: "WEB_DIRECT_URL_FORBIDDEN", variable: "DIRECT_URL", safeMessage: "The web runtime must not receive the migrator URL." });
  }

  const valkeyModeRaw = (value(environment, "VALKEY_MODE") || (governed ? "distributed" : "memory")).toLowerCase();
  const valkeyMode = valkeyModeRaw === "distributed" ? "distributed" : "memory";
  if (!new Set(["memory", "distributed"]).has(valkeyModeRaw)) {
    issues.push({ code: "VALKEY_MODE_INVALID", variable: "VALKEY_MODE", safeMessage: "Use exactly memory or distributed." });
  }
  if (governed && !isBackupWorker && valkeyMode !== "distributed") {
    issues.push({ code: "DISTRIBUTED_VALKEY_REQUIRED", variable: "VALKEY_MODE", safeMessage: "Portable staging and production require the distributed Valkey adapter." });
  }
  let valkeyUrl = "";
  if (valkeyMode === "distributed") {
    try { valkeyUrl = readPortableSecret("VALKEY_URL", environment, { required: true }); }
    catch { issues.push({ code: "VALKEY_URL_REQUIRED", variable: "VALKEY_URL", safeMessage: "A mounted or injected Valkey URL is required." }); }
    const valkey = parseUrl(valkeyUrl, "VALKEY_URL", new Set(["redis:", "rediss:", "valkey:", "valkeys:"]), issues);
    if (remote && valkey && !new Set(["rediss:", "valkeys:"]).has(valkey.protocol)) {
      issues.push({ code: "VALKEY_TLS_REQUIRED", variable: "VALKEY_URL", safeMessage: "Remote staging and production require Valkey TLS." });
    }
  }

  const objectStoreRaw = (value(environment, "PRIVATE_OBJECT_STORAGE_PROVIDER") || "FILESYSTEM").toUpperCase();
  const objectStoreProvider = objectStoreRaw === "S3_COMPATIBLE" ? "S3_COMPATIBLE" : "FILESYSTEM";
  if (!new Set(["FILESYSTEM", "S3_COMPATIBLE"]).has(objectStoreRaw)) {
    issues.push({ code: "OBJECT_STORE_PROVIDER_INVALID", variable: "PRIVATE_OBJECT_STORAGE_PROVIDER", safeMessage: "Use exactly FILESYSTEM or S3_COMPATIBLE." });
  }
  if (governed && !isMaintenancePlan && objectStoreProvider !== "S3_COMPATIBLE") {
    issues.push({ code: "DURABLE_OBJECT_STORE_REQUIRED", variable: "PRIVATE_OBJECT_STORAGE_PROVIDER", safeMessage: "Portable staging and production cannot use the container filesystem for durable private objects." });
  }
  const objectStoreBucket = value(environment, "S3_PRIVATE_BUCKET");
  const objectStoreEndpoint = value(environment, "S3_ENDPOINT");
  const objectStoreRegion = value(environment, "S3_REGION");
  if (objectStoreProvider === "S3_COMPATIBLE") {
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(objectStoreBucket)) {
      issues.push({ code: "OBJECT_BUCKET_INVALID", variable: "S3_PRIVATE_BUCKET", safeMessage: "A fixed private bucket name is required." });
    }
    const endpoint = parseUrl(objectStoreEndpoint, "S3_ENDPOINT", new Set(remote ? ["https:"] : ["http:", "https:"]), issues);
    if (remote && endpoint && endpoint.username) {
      issues.push({ code: "OBJECT_ENDPOINT_CREDENTIALS_FORBIDDEN", variable: "S3_ENDPOINT", safeMessage: "Credentials must not be embedded in the object-storage endpoint." });
    }
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(objectStoreRegion)) {
      issues.push({ code: "OBJECT_REGION_INVALID", variable: "S3_REGION", safeMessage: "A fixed S3-compatible region identifier is required." });
    }
    secretPresent("S3_ACCESS_KEY_ID", environment, issues, 3);
    secretPresent("S3_SECRET_ACCESS_KEY", environment, issues, 16);
  }

  const backupRaw = (value(environment, "PORTABLE_BACKUP_DESTINATION") || "LOCAL_FILESYSTEM").toUpperCase();
  const backupDestination = backupRaw === "S3_COMPATIBLE_PRIVATE" ? "S3_COMPATIBLE_PRIVATE" : "LOCAL_FILESYSTEM";
  if (!new Set(["LOCAL_FILESYSTEM", "S3_COMPATIBLE_PRIVATE"]).has(backupRaw)) {
    issues.push({ code: "BACKUP_DESTINATION_INVALID", variable: "PORTABLE_BACKUP_DESTINATION", safeMessage: "The backup destination is not recognized." });
  }
  if (remote && backupDestination !== "S3_COMPATIBLE_PRIVATE") {
    issues.push({ code: "REMOTE_BACKUP_DESTINATION_REQUIRED", variable: "PORTABLE_BACKUP_DESTINATION", safeMessage: "Remote staging and production require an encrypted private off-host backup destination." });
  }

  const trustedProxy = exactBoolean(environment, "TRUST_PROXY_HEADERS", false, issues);
  if (governed && !isBackupWorker && !trustedProxy) issues.push({ code: "TRUSTED_PROXY_REQUIRED", variable: "TRUST_PROXY_HEADERS", safeMessage: "Governed web deployments require an explicitly authenticated proxy boundary." });
  const maintenanceMode = exactBoolean(environment, "NALANDA_MAINTENANCE_MODE", false, issues);
  const metricsEnabled = exactBoolean(environment, "PORTABLE_METRICS_ENABLED", governed, issues);
  const structuredLogging = exactBoolean(environment, "PORTABLE_STRUCTURED_LOGGING", governed, issues);
  const nativeMinimumVersion = value(environment, "NALANDA_MINIMUM_NATIVE_CLIENT") || "0.0.0";
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(nativeMinimumVersion)) {
    issues.push({ code: "NATIVE_VERSION_INVALID", variable: "NALANDA_MINIMUM_NATIVE_CLIENT", safeMessage: "A semantic native-client minimum version is required." });
  }
  const nativeAllowedOrigins = value(environment, "NALANDA_NATIVE_ALLOWED_ORIGINS").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (governed && !isBackupWorker && nativeAllowedOrigins.length === 0) {
    issues.push({ code: "NATIVE_ORIGINS_REQUIRED", variable: "NALANDA_NATIVE_ALLOWED_ORIGINS", safeMessage: "Allowed native origins must be explicit." });
  }

  if (governed) {
    if (needsBackupEncryption) secretPresent("CLOUD_BACKUP_ENCRYPTION_KEY_V1", environment, issues, 32);
    if (!isBackupWorker) {
      secretPresent("AUTH_SECRET", environment, issues);
      secretPresent("AUTH_VERIFICATION_SECRET", environment, issues);
      secretPresent("NALANDA_PROXY_SHARED_SECRET", environment, issues);
      secretPresent("PORTABLE_INTERNAL_HEALTH_TOKEN", environment, issues);
    }
    for (const feature of FALSE_ONLY_FEATURES) {
      const configured = value(environment, feature);
      if (configured && configured !== "false" && configured !== "0") {
        issues.push({ code: "DEFAULT_OFF_FEATURE_ENABLED", variable: feature, safeMessage: "Operational feature activation is outside this release." });
      }
    }
    if (value(environment, "AI_ASSISTANT_PROVIDER") && value(environment, "AI_ASSISTANT_PROVIDER") !== "DISABLED") {
      issues.push({ code: "CLOUD_AI_FORBIDDEN", variable: "AI_ASSISTANT_PROVIDER", safeMessage: "Cloud AI remains disabled in the portable foundation." });
    }
  }

  const configuration: PortableRuntimeConfiguration = {
    environment: environmentName,
    command,
    applicationOrigin,
    databaseProvider,
    databaseUrl,
    directUrl,
    valkeyMode,
    valkeyUrl,
    objectStoreProvider,
    objectStoreBucket,
    objectStoreEndpoint,
    objectStoreRegion,
    objectStoreForcePathStyle: exactBoolean(environment, "S3_FORCE_PATH_STYLE", false, issues),
    backupDestination,
    trustedProxy,
    maintenanceMode,
    metricsEnabled,
    structuredLogging,
    nativeMinimumVersion,
    nativeAllowedOrigins
  };
  return { ok: issues.length === 0, configuration, issues };
}

export function assertPortableRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
  command?: PortableCommand
) {
  const result = validatePortableRuntimeConfiguration(environment, command);
  if (!result.ok) {
    const codes = [...new Set(result.issues.map((issue) => issue.code))].sort().join(",");
    throw new Error(`PORTABLE_RUNTIME_CONFIGURATION_INVALID:${codes}`);
  }
  return result.configuration;
}
