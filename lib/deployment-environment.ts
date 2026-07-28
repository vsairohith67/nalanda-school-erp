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
  "FIRST_RUN_BOOTSTRAP_TOKEN",
  "WHATSAPP_MOCK_WEBHOOK_SECRET",
  "WHATSAPP_MOCK_VERIFY_TOKEN",
  "WHATSAPP_PHONE_HASH_PEPPER",
  "SMS_EMAIL_MOCK_WEBHOOK_SECRET",
  "SMS_EMAIL_CONTACT_HASH_PEPPER",
  "AI_ASSISTANT_AUDIT_HASH_PEPPER"
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
  const deploymentEnvironment = value(environment, "NALANDA_ENVIRONMENT");

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
    ["NALANDA_TRUSTED_PROXY_MODE", "single-hop-sanitized"]
  ] as const) {
    if (value(environment, name) !== expected) {
      add("SECURE_TRANSPORT_SETTING_REQUIRED", name, `Must be exactly ${expected}.`);
    }
  }

  const dataRootValue = value(environment, "STAGING_DATA_DIR");
  const dataRoot = dataRootValue ? path.resolve(dataRootValue) : "";
  const localRehearsal = value(environment, "NALANDA_LOCAL_REHEARSAL") === "true";
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
  if (value(environment, "ALLOW_DEMO_BUSINESS_DATA") === "true") {
    add("DEMO_BUSINESS_DATA_REJECTED", "ALLOW_DEMO_BUSINESS_DATA", "Demo business seeding is disabled in staging and production.");
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

export function formatDeploymentEnvironmentResult(result: DeploymentEnvironmentResult) {
  if (result.ok) {
    return "Deployment environment check passed: staging contract is complete; secret values were not printed.";
  }
  return [
    `Deployment environment check failed with ${result.issues.length} safe issue(s). Secret values were not printed.`,
    ...result.issues.map((issue) => `- ${issue.code} [${issue.variable}]: ${issue.message}`)
  ].join("\n");
}
