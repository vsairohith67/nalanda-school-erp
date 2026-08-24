import path from "node:path";
import { existsSync, readdirSync } from "node:fs";

export type DeploymentEnvironmentIssue = {
  code: string;
  variable: string;
  message: string;
};

export type DeploymentEnvironmentResult = {
  ok: boolean;
  environment: "staging" | "unknown";
  issues: DeploymentEnvironmentIssue[];
  paths: Record<string, string>;
};

const PLACEHOLDER = /(?:<[^>]+>|placeholder|change[-_ ]?me|replace[-_ ]?me|todo|example|dummy)/i;
const DEVELOPMENT_SECRET = /(?:local[-_ ]?only|non[-_ ]?production|devops|qasec|qa20|demo|test[-_ ]?secret|nalanda(?:director|admin|accountant|viewer)?@2026)/i;
const DATA_PATH_VARIABLES = [
  "FEE_REGISTER_OCR_STORAGE_DIR",
  "BACKUP_DIRECTORY",
  "CLOUD_BACKUP_LOCAL_FOLDER",
  "CLOUD_BACKUP_TEMP_DIR",
  "CLOUD_BACKUP_REHEARSAL_DIR"
] as const;
const REQUIRED_SECRETS = [
  "AUTH_SECRET",
  "AUTH_VERIFICATION_SECRET",
  "FIRST_RUN_BOOTSTRAP_TOKEN",
  "WHATSAPP_MOCK_WEBHOOK_SECRET",
  "WHATSAPP_MOCK_VERIFY_TOKEN",
  "WHATSAPP_PHONE_HASH_PEPPER",
  "SMS_EMAIL_MOCK_WEBHOOK_SECRET",
  "SMS_EMAIL_CONTACT_HASH_PEPPER",
  "AI_ASSISTANT_AUDIT_HASH_PEPPER",
  "NALANDA_PROXY_SHARED_SECRET"
] as const;
const SEED_PASSWORDS = [
  "SEED_DIRECTOR_PASSWORD",
  "SEED_ADMIN_PASSWORD",
  "SEED_ACCOUNTANT_PASSWORD",
  "SEED_VIEWER_PASSWORD"
] as const;
const WHATSAPP_LIVE_VALUES = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
] as const;
const EMAIL_LIVE_VALUES = [
  "GMAIL_OAUTH_CLIENT_ID",
  "GMAIL_OAUTH_CLIENT_SECRET",
  "GMAIL_OAUTH_REFRESH_TOKEN",
  "GMAIL_SENDER_EMAIL"
] as const;

function value(environment: NodeJS.ProcessEnv, name: string) {
  return environment[name]?.trim() ?? "";
}

function within(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function databasePath(databaseUrl: string, dataRoot: string) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?")) return null;
  const raw = databaseUrl.slice(5).trim();
  if (!raw) return null;
  return path.resolve(dataRoot, raw);
}

export function validateDeploymentEnvironment(
  environment: NodeJS.ProcessEnv,
  workspaceRoot = process.cwd()
): DeploymentEnvironmentResult {
  const issues: DeploymentEnvironmentIssue[] = [];
  const paths: Record<string, string> = {};
  const add = (code: string, variable: string, message: string) => issues.push({ code, variable, message });
  const deploymentEnvironment = value(environment, "NALANDA_ENVIRONMENT").toLowerCase();

  if (deploymentEnvironment !== "staging") {
    add("ENVIRONMENT_NOT_STAGING", "NALANDA_ENVIRONMENT", "Must be exactly staging.");
  }
  if (value(environment, "NODE_ENV") !== "production") {
    add("NODE_ENV_NOT_PRODUCTION", "NODE_ENV", "Staging must run the production build mode.");
  }

  const deploymentId = value(environment, "NALANDA_DEPLOYMENT_ID");
  if (!/^staging-[a-z0-9][a-z0-9._-]{2,80}$/i.test(deploymentId)) {
    add("DEPLOYMENT_ID_INVALID", "NALANDA_DEPLOYMENT_ID", "Must be a staging-prefixed non-secret release identifier.");
  }
  if (/\bprod(?:uction)?\b/i.test(deploymentId)) {
    add("ENVIRONMENT_IDENTIFIER_MIXED", "NALANDA_DEPLOYMENT_ID", "Production and staging identifiers must not be mixed.");
  }
  const pwaBuildVersion = value(environment, "NEXT_PUBLIC_PWA_BUILD_VERSION");
  if (!/^staging-[a-z0-9][a-z0-9._-]{2,80}$/i.test(pwaBuildVersion)) {
    add("PWA_BUILD_ID_INVALID", "NEXT_PUBLIC_PWA_BUILD_VERSION", "Must be a staging-prefixed non-secret release identifier.");
  }
  if (/\bprod(?:uction)?\b/i.test(pwaBuildVersion)) {
    add("ENVIRONMENT_IDENTIFIER_MIXED", "NEXT_PUBLIC_PWA_BUILD_VERSION", "Production and staging identifiers must not be mixed.");
  }

  const origin = value(environment, "APP_ORIGIN");
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") add("PUBLIC_URL_NOT_HTTPS", "APP_ORIGIN", "Staging public URL must use HTTPS.");
    if (!/(^|\.)staging[.-]/i.test(parsed.hostname) && !/^staging\./i.test(parsed.hostname)) {
      add("STAGING_HOSTNAME_REQUIRED", "APP_ORIGIN", "Staging origin must use an unmistakable staging hostname.");
    }
    if (/^(?:www\.)?nalandaps\.com$/i.test(parsed.hostname)) {
      add("PRODUCTION_HOSTNAME_REJECTED", "APP_ORIGIN", "The production hostname is not a staging identifier.");
    }
  } catch {
    add("PUBLIC_URL_INVALID", "APP_ORIGIN", "Staging origin must be a valid absolute HTTPS URL.");
  }
  const publicWebsiteUrl = value(environment, "PUBLIC_WEBSITE_URL");
  if (publicWebsiteUrl && publicWebsiteUrl !== origin) {
    add("PUBLIC_URL_MISMATCH", "PUBLIC_WEBSITE_URL", "Public website URL must match the staging application origin.");
  }
  if (value(environment, "PUBLIC_WEBSITE_INDEXING_ENABLED") !== "false") {
    add("INDEXING_NOT_DISABLED", "PUBLIC_WEBSITE_INDEXING_ENABLED", "Search indexing must be explicitly disabled in staging.");
  }

  for (const [name, expected] of [
    ["SESSION_COOKIE_SECURE", "true"],
    ["ENABLE_HSTS", "true"],
    ["ENABLE_HTTPS_UPGRADE", "true"],
    ["TRUST_PROXY_HEADERS", "true"],
    ["NALANDA_TRUSTED_PROXY_MODE", "authenticated-edge-v1"],
    ["NALANDA_REQUIRE_TRUSTED_PROXY", "true"]
  ] as const) {
    if (value(environment, name) !== expected) {
      add("SECURE_TRANSPORT_SETTING_REQUIRED", name, `Must be exactly ${expected}.`);
    }
  }
  if (!["x-forwarded-for", "x-real-ip", "cf-connecting-ip"].includes(value(environment, "NALANDA_CLIENT_IP_HEADER"))) {
    add("TRUSTED_CLIENT_IP_HEADER_INVALID", "NALANDA_CLIENT_IP_HEADER", "Choose one exact ingress-overwritten client IP header.");
  }

  const dataRootValue = value(environment, "STAGING_DATA_DIR");
  const dataRoot = dataRootValue ? path.resolve(dataRootValue) : "";
  const localRehearsal = value(environment, "NALANDA_LOCAL_REHEARSAL") === "true";
  const localRateLimitRehearsal = localRehearsal &&
    value(environment, "QA20C_ISOLATED_DATABASE") === "true" &&
    value(environment, "NALANDA_LOCAL_SECURITY_REHEARSAL") === "true" &&
    value(environment, "SECURITY_RATE_LIMIT_MODE") === "single-process-rehearsal";
  if (value(environment, "SECURITY_RATE_LIMIT_MODE") !== "distributed" && !localRateLimitRehearsal) {
    add("DISTRIBUTED_RATE_LIMIT_REQUIRED", "SECURITY_RATE_LIMIT_MODE", "Use an atomic distributed adapter, except in an explicit isolated local rehearsal.");
  }
  const releaseEnvFiles = existsSync(path.resolve(workspaceRoot))
    ? readdirSync(path.resolve(workspaceRoot), { withFileTypes: true })
      .filter((entry) => entry.isFile() && (entry.name === ".env" || (entry.name.startsWith(".env.") && entry.name !== ".env.example")))
      .map((entry) => entry.name)
    : [];
  if (!localRehearsal && releaseEnvFiles.length) {
    add(
      "RELEASE_ENV_FILE_REJECTED",
      ".env*",
      "Staging secrets must be injected by the host; release-local Next environment files are not allowed."
    );
  }
  if (!dataRootValue || !path.isAbsolute(dataRootValue)) {
    add("DATA_ROOT_NOT_ABSOLUTE", "STAGING_DATA_DIR", "Must be an absolute persistent-data directory.");
  } else {
    paths.STAGING_DATA_DIR = dataRoot;
    const workspace = path.resolve(workspaceRoot);
    const localRehearsalRoot = path.resolve(workspace, "tmp", "devops1c");
    const approvedLocalRoot = localRehearsal &&
      value(environment, "QA20C_ISOLATED_DATABASE") === "true" &&
      (dataRoot === localRehearsalRoot || within(localRehearsalRoot, dataRoot));
    if ((dataRoot === workspace || within(workspace, dataRoot)) && !approvedLocalRoot) {
      add("DATA_ROOT_INSIDE_RELEASE", "STAGING_DATA_DIR", "Persistent data must be separate from application releases.");
    }
  }

  const dbUrl = value(environment, "DATABASE_URL");
  const dbPath = dataRoot ? databasePath(dbUrl, dataRoot) : null;
  if (!dbPath) {
    add("DATABASE_URL_INVALID", "DATABASE_URL", "Must be a query-free SQLite file URL.");
  } else {
    paths.DATABASE_URL = dbPath;
    if (/([\\/]|^)dev\.db$/i.test(dbPath) || /prisma[\\/]dev\.db$/i.test(dbPath)) {
      add("OPERATIONAL_DATABASE_REJECTED", "DATABASE_URL", "prisma/dev.db and dev.db are never valid staging targets.");
    }
    if (dataRoot && !within(dataRoot, dbPath)) {
      add("DATABASE_PATH_ESCAPE", "DATABASE_URL", "Database path must resolve inside STAGING_DATA_DIR.");
    }
  }

  for (const name of DATA_PATH_VARIABLES) {
    const configured = value(environment, name);
    if (!configured || !path.isAbsolute(configured)) {
      add("PERSISTENT_PATH_NOT_ABSOLUTE", name, "Must be an absolute path inside STAGING_DATA_DIR.");
      continue;
    }
    const resolved = path.resolve(configured);
    paths[name] = resolved;
    if (dataRoot && !within(dataRoot, resolved)) {
      add("PERSISTENT_PATH_ESCAPE", name, "Must resolve inside STAGING_DATA_DIR.");
    }
  }

  for (const name of REQUIRED_SECRETS) {
    const configured = value(environment, name);
    if (!configured || configured.length < 32) {
      add("SECRET_MISSING_OR_SHORT", name, "A unique secret of at least 32 characters is required.");
    } else if (PLACEHOLDER.test(configured)) {
      add("PLACEHOLDER_SECRET_REJECTED", name, "Placeholder secret material is not allowed.");
    } else if (DEVELOPMENT_SECRET.test(configured)) {
      add("DEVELOPMENT_SECRET_REJECTED", name, "Development or QA secret material is not allowed in staging.");
    } else if (new Set(configured).size < 10) {
      add("LOW_ENTROPY_SECRET_REJECTED", name, "Secret material must have sufficient character diversity.");
    }
  }
  if (!value(environment, "SESSION_SECRET") && !value(environment, "AUTH_SECRET")) {
    add("SESSION_SIGNING_SECRET_MISSING", "AUTH_SECRET", "AUTH_SECRET or SESSION_SECRET is required.");
  }

  const encryptionKey = value(environment, "CLOUD_BACKUP_ENCRYPTION_KEY_V1");
  try {
    const decoded = Buffer.from(encryptionKey, "base64");
    if (
      !encryptionKey ||
      decoded.length !== 32 ||
      new Set(decoded).size < 16 ||
      decoded.toString("base64").replace(/=+$/, "") !== encryptionKey.replace(/=+$/, "")
    ) {
      throw new Error("invalid");
    }
  } catch {
    add("ENCRYPTION_KEY_INVALID", "CLOUD_BACKUP_ENCRYPTION_KEY_V1", "Must be canonical base64 encoding of exactly 32 random bytes.");
  }

  for (const name of SEED_PASSWORDS) {
    const configured = value(environment, name);
    if (!configured) continue;
    if (configured.length < 16 || PLACEHOLDER.test(configured) || DEVELOPMENT_SECRET.test(configured)) {
      add("DEFAULT_PASSWORD_REJECTED", name, "Seed passwords must be unique staging-only values and must not be documented defaults.");
    }
  }
  if (value(environment, "NALANDA_DEMO_SEED_OPT_IN") === "true") {
    add("DEMO_SEED_REJECTED", "NALANDA_DEMO_SEED_OPT_IN", "Demo seed defaults are disabled in staging.");
  }
  if (value(environment, "ALLOW_DEMO_USERS") === "true") {
    add("DEMO_USERS_REJECTED", "ALLOW_DEMO_USERS", "Demo user creation is disabled in staging and production.");
  }
  if (value(environment, "ALLOW_DEMO_BUSINESS_DATA") === "true") {
    add("DEMO_BUSINESS_DATA_REJECTED", "ALLOW_DEMO_BUSINESS_DATA", "Demo business seeding is disabled in staging and production.");
  }
  if (value(environment, "AUTH2B_DELIVERY_ADAPTER") !== "DISABLED") {
    add(
      "AUTH2B_DELIVERY_NOT_DISABLED",
      "AUTH2B_DELIVERY_ADAPTER",
      "AUTH-2B recovery delivery must remain disabled until a separately approved governed provider is configured."
    );
  }

  const liveFlags = [
    "WHATSAPP_LIVE_SENDING_ENABLED",
    "SMS_EMAIL_SMS_LIVE_ENABLED",
    "SMS_EMAIL_EMAIL_LIVE_ENABLED",
    "SMS_EMAIL_SUPERVISED_LIVE_ACTIVATION_ENABLED"
  ];
  for (const name of liveFlags) {
    if (value(environment, name) !== "false") {
      add("LIVE_PROVIDER_NOT_DISABLED", name, "Must be explicitly false for DEVOPS-1C staging.");
    }
  }
  for (const group of [WHATSAPP_LIVE_VALUES, EMAIL_LIVE_VALUES]) {
    const configured = group.filter((name) => Boolean(value(environment, name)));
    if (configured.length) {
      const missing = group.filter((name) => !value(environment, name));
      add(
        missing.length ? "PARTIAL_LIVE_PROVIDER_CONFIGURATION" : "LIVE_PROVIDER_CREDENTIALS_REJECTED",
        configured[0],
        "Live provider credentials do not belong in synthetic-only staging."
      );
    }
  }
  if (value(environment, "AI_ASSISTANT_LOCAL_ENDPOINT")) {
    add("LIVE_AI_ENDPOINT_REJECTED", "AI_ASSISTANT_LOCAL_ENDPOINT", "Only the deterministic MOCK AI provider is allowed.");
  }

  for (const name of ["DEBUG", "NEXT_PUBLIC_DEBUG", "NALANDA_DEBUG"]) {
    const configured = value(environment, name);
    if (configured && configured !== "false" && configured !== "0") {
      add("DANGEROUS_DEBUG_FLAG", name, "Debug mode must be disabled in staging.");
    }
  }
  if (/--inspect(?:-brk)?\b/i.test(value(environment, "NODE_OPTIONS"))) {
    add("NODE_INSPECTOR_REJECTED", "NODE_OPTIONS", "The Node inspector must not be enabled.");
  }
  if (/\bquery\b/i.test(value(environment, "PRISMA_LOG_LEVEL"))) {
    add("PRISMA_QUERY_LOG_REJECTED", "PRISMA_LOG_LEVEL", "Query logging can expose private data and is disabled.");
  }

  return {
    ok: issues.length === 0,
    environment: deploymentEnvironment === "staging" ? "staging" : "unknown",
    issues,
    paths
  };
}

export type ReleaseSettingClass =
  | "REQUIRED_SECRET"
  | "REQUIRED_NON_SECRET"
  | "OPTIONAL_DISABLED_PROVIDER"
  | "BUILD_TIME_PUBLIC"
  | "RUNTIME_PRIVATE"
  | "STAGING_ONLY"
  | "PRODUCTION_ONLY";

export const RELEASE_ENVIRONMENT_CONTRACT = [
  { name: "NALANDA_ENVIRONMENT", classification: "REQUIRED_NON_SECRET" },
  { name: "NALANDA_RELEASE_ID", classification: "REQUIRED_NON_SECRET" },
  { name: "NALANDA_RELEASE_CHANNEL", classification: "REQUIRED_NON_SECRET" },
  { name: "APP_ORIGIN", classification: "REQUIRED_NON_SECRET" },
  { name: "DATABASE_URL", classification: "RUNTIME_PRIVATE" },
  { name: "PRIVATE_STORAGE_ROOT", classification: "RUNTIME_PRIVATE" },
  { name: "BACKUP_DIRECTORY", classification: "RUNTIME_PRIVATE" },
  { name: "AUTH_SECRET", classification: "REQUIRED_SECRET" },
  { name: "CLOUD_BACKUP_ENCRYPTION_KEY_V1", classification: "REQUIRED_SECRET" },
  { name: "NEXT_PUBLIC_PWA_BUILD_VERSION", classification: "BUILD_TIME_PUBLIC" },
  { name: "NALANDA_STAGING_BANNER", classification: "STAGING_ONLY" },
  { name: "NALANDA_PRODUCTION_APPROVAL_ID", classification: "PRODUCTION_ONLY" },
  { name: "LIVE_PROVIDERS_ENABLED", classification: "OPTIONAL_DISABLED_PROVIDER" }
] as const satisfies ReadonlyArray<{ name: string; classification: ReleaseSettingClass }>;

export type ReleaseEnvironmentContractResult = {
  ok: boolean;
  environment: "DEVELOPMENT" | "TEST" | "PREVIEW" | "STAGING" | "PRODUCTION" | "UNKNOWN";
  issues: DeploymentEnvironmentIssue[];
  classifications: typeof RELEASE_ENVIRONMENT_CONTRACT;
};

export function validateReleaseEnvironmentContract(environment: NodeJS.ProcessEnv, workspaceRoot = process.cwd()): ReleaseEnvironmentContractResult {
  const issues: DeploymentEnvironmentIssue[] = [];
  const add = (code: string, variable: string, message: string) => issues.push({ code, variable, message });
  const rawEnvironment = value(environment, "NALANDA_ENVIRONMENT").toUpperCase();
  const allowed = ["DEVELOPMENT", "TEST", "PREVIEW", "STAGING", "PRODUCTION"] as const;
  const releaseEnvironment = (allowed as readonly string[]).includes(rawEnvironment) ? rawEnvironment as typeof allowed[number] : "UNKNOWN";
  if (releaseEnvironment === "UNKNOWN") add("RELEASE_ENVIRONMENT_INVALID", "NALANDA_ENVIRONMENT", "Use DEVELOPMENT, TEST, PREVIEW, STAGING or PRODUCTION.");

  const releaseId = value(environment, "NALANDA_RELEASE_ID");
  const releaseChannel = value(environment, "NALANDA_RELEASE_CHANNEL");
  const pwaBuild = value(environment, "NEXT_PUBLIC_PWA_BUILD_VERSION");
  for (const [name, configured] of [["NALANDA_RELEASE_ID", releaseId], ["NALANDA_RELEASE_CHANNEL", releaseChannel], ["NEXT_PUBLIC_PWA_BUILD_VERSION", pwaBuild]] as const) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$/.test(configured)) add("RELEASE_IDENTIFIER_INVALID", name, "Use a bounded non-secret release identifier.");
    if (PLACEHOLDER.test(configured)) add("PLACEHOLDER_REJECTED", name, "Placeholder release metadata is not allowed.");
  }
  if (releaseId && pwaBuild && releaseId !== pwaBuild) add("MIXED_RELEASE_IDENTIFIERS", "NEXT_PUBLIC_PWA_BUILD_VERSION", "Release and PWA build identifiers must match.");

  const productionShaped = releaseEnvironment === "STAGING" || releaseEnvironment === "PRODUCTION";
  const origin = value(environment, "APP_ORIGIN");
  try {
    const parsed = new URL(origin);
    if (productionShaped && parsed.protocol !== "https:") add("RELEASE_ORIGIN_NOT_HTTPS", "APP_ORIGIN", "Staging and production require HTTPS.");
    if (releaseEnvironment === "STAGING" && !/(^|[.-])staging([.-]|$)/i.test(parsed.hostname) && !/^localhost$|^127\.0\.0\.1$/.test(parsed.hostname)) add("STAGING_ORIGIN_AMBIGUOUS", "APP_ORIGIN", "Staging must use an unmistakable staging or loopback host.");
  } catch {
    add("RELEASE_ORIGIN_INVALID", "APP_ORIGIN", "APP_ORIGIN must be an absolute URL.");
  }

  if (productionShaped && value(environment, "SESSION_COOKIE_SECURE") !== "true") add("INSECURE_COOKIE_REJECTED", "SESSION_COOKIE_SECURE", "Secure cookies are mandatory.");
  if (productionShaped && value(environment, "NALANDA_TRUSTED_PROXY_MODE") !== "authenticated-edge-v1") add("TRUSTED_PROXY_MODE_REQUIRED", "NALANDA_TRUSTED_PROXY_MODE", "Staging and production require authenticated edge identity.");
  if (productionShaped && value(environment, "NALANDA_REQUIRE_TRUSTED_PROXY") !== "true") add("TRUSTED_PROXY_REQUIRED", "NALANDA_REQUIRE_TRUSTED_PROXY", "Direct origin requests must fail closed.");
  if (productionShaped && value(environment, "SECURITY_RATE_LIMIT_MODE") !== "distributed") add("DISTRIBUTED_RATE_LIMIT_REQUIRED", "SECURITY_RATE_LIMIT_MODE", "Production-shaped environments require an atomic distributed rate-limit adapter.");
  if (value(environment, "DEBUG") === "true" || value(environment, "NEXT_PUBLIC_DEBUG") === "true") add("DEBUG_MODE_REJECTED", "DEBUG", "Debug mode is prohibited in release-shaped environments.");
  if (value(environment, "LIVE_PROVIDERS_ENABLED") !== "false") add("LIVE_PROVIDER_MODE_REJECTED", "LIVE_PROVIDERS_ENABLED", "Provider mode must remain explicitly disabled until separately approved.");

  const database = value(environment, "DATABASE_URL");
  if (!database.startsWith("file:") || database.includes("?")) add("RELEASE_DATABASE_URL_INVALID", "DATABASE_URL", "Use a query-free SQLite file URL.");
  if (/(?:^|[\\/])(?:prisma[\\/])?dev\.db$/i.test(database.slice(5))) add("OPERATIONAL_DEV_DB_REJECTED", "DATABASE_URL", "Operational dev.db cannot be used by any release environment.");
  const roots = ["PRIVATE_STORAGE_ROOT", "BACKUP_DIRECTORY"].map((name) => [name, value(environment, name)] as const);
  for (const [name, configured] of roots) {
    if (!configured || !path.isAbsolute(configured)) add("RELEASE_PATH_NOT_ABSOLUTE", name, "Use an absolute environment-specific path.");
    else {
      const relative = path.relative(path.resolve(workspaceRoot), path.resolve(configured));
      if (productionShaped && (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)))) add("RELEASE_PATH_INSIDE_SOURCE", name, "Runtime data must be outside the release source tree.");
    }
  }
  const stagingDatabase = value(environment, "NALANDA_STAGING_DATABASE_URL");
  const productionDatabase = value(environment, "NALANDA_PRODUCTION_DATABASE_URL");
  if (stagingDatabase && productionDatabase && path.resolve(stagingDatabase.replace(/^file:/, "")) === path.resolve(productionDatabase.replace(/^file:/, ""))) add("ENVIRONMENT_DATABASE_SHARED", "DATABASE_URL", "Staging and production must not share a database.");
  const stagingStorage = value(environment, "NALANDA_STAGING_STORAGE_ROOT");
  const productionStorage = value(environment, "NALANDA_PRODUCTION_STORAGE_ROOT");
  if (stagingStorage && productionStorage && path.resolve(stagingStorage) === path.resolve(productionStorage)) add("ENVIRONMENT_STORAGE_SHARED", "PRIVATE_STORAGE_ROOT", "Staging and production must not share private storage.");

  if (productionShaped) {
    for (const name of ["AUTH_SECRET", "CLOUD_BACKUP_ENCRYPTION_KEY_V1"] as const) {
      const configured = value(environment, name);
      if (configured.length < 32 || PLACEHOLDER.test(configured) || DEVELOPMENT_SECRET.test(configured)) add("RELEASE_SECRET_INVALID", name, "A unique non-placeholder runtime secret is required.");
    }
  }
  if (releaseEnvironment === "STAGING" && value(environment, "NALANDA_STAGING_BANNER") !== "true") add("STAGING_BANNER_REQUIRED", "NALANDA_STAGING_BANNER", "Staging must display the staging banner.");
  if (releaseEnvironment === "STAGING" && value(environment, "PUBLIC_WEBSITE_INDEXING_ENABLED") !== "false") add("STAGING_INDEXING_REJECTED", "PUBLIC_WEBSITE_INDEXING_ENABLED", "Staging must refuse crawlers and indexing.");

  const providerGroups = [WHATSAPP_LIVE_VALUES, EMAIL_LIVE_VALUES];
  for (const group of providerGroups) {
    const configured = group.filter((name) => Boolean(value(environment, name)));
    if (configured.length && configured.length !== group.length) add("PARTIAL_PROVIDER_CONFIGURATION", configured[0], "Partial provider configuration is prohibited.");
    if (configured.length && value(environment, "LIVE_PROVIDERS_ENABLED") !== "true") add("DISABLED_PROVIDER_SECRET_REJECTED", configured[0], "Do not inject live provider credentials while providers are disabled.");
  }

  return { ok: issues.length === 0, environment: releaseEnvironment, issues, classifications: RELEASE_ENVIRONMENT_CONTRACT };
}

export function formatDeploymentEnvironmentResult(result: DeploymentEnvironmentResult) {
  if (result.ok) {
    return "Deployment environment check passed: staging contract is complete; secret values were not printed.";
  }
  return [
    `Deployment environment check failed with ${result.issues.length} safe issue(s). Secret values were not printed.`,
    ...result.issues.map((issue) => `- ${issue.code} [${issue.variable}]: ${issue.message}`)
  ].join("\n");
}
