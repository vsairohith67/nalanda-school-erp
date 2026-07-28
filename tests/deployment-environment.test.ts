import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  formatDeploymentEnvironmentResult,
  validateDeploymentEnvironment
} from "../lib/deployment-environment";

const workspace = process.cwd();

function validEnvironment(): NodeJS.ProcessEnv {
  const data = path.join(workspace, "tmp", "devops1c", "validator", "data");
  const child = (name: string) => path.join(data, name);
  return {
    NODE_ENV: "production",
    NALANDA_ENVIRONMENT: "staging",
    NALANDA_DEPLOYMENT_ID: "staging-validator-20260723",
    NEXT_PUBLIC_PWA_BUILD_VERSION: "staging-validator-20260723",
    NALANDA_LOCAL_REHEARSAL: "true",
    QA20C_ISOLATED_DATABASE: "true",
    APP_ORIGIN: "https://staging.localhost",
    PUBLIC_WEBSITE_URL: "https://staging.localhost",
    PUBLIC_WEBSITE_INDEXING_ENABLED: "false",
    SESSION_COOKIE_SECURE: "true",
    ENABLE_HSTS: "true",
    ENABLE_HTTPS_UPGRADE: "true",
    TRUST_PROXY_HEADERS: "true",
    NALANDA_TRUSTED_PROXY_MODE: "single-hop-sanitized",
    STAGING_DATA_DIR: data,
    DATABASE_URL: `file:${child("database/staging.db").replaceAll("\\", "/")}`,
    FEE_REGISTER_OCR_STORAGE_DIR: child("private/ocr"),
    BACKUP_DIRECTORY: child("backups/json"),
    CLOUD_BACKUP_LOCAL_FOLDER: child("backups/encrypted"),
    CLOUD_BACKUP_TEMP_DIR: child("tmp/cloud-backup"),
    CLOUD_BACKUP_REHEARSAL_DIR: child("tmp/restore-rehearsal"),
    AUTH_SECRET: "unique-staging-auth-material-91f67bda-a7d5-4c65",
    FIRST_RUN_BOOTSTRAP_TOKEN: "unique-staging-bootstrap-72ec8567-7454-49aa",
    WHATSAPP_MOCK_WEBHOOK_SECRET: "unique-staging-wa-hook-1d093694-d402-448a",
    WHATSAPP_MOCK_VERIFY_TOKEN: "unique-staging-wa-verify-38baaf79-a31b-4f04",
    WHATSAPP_PHONE_HASH_PEPPER: "unique-staging-wa-pepper-9630e42a-27c7-465d",
    SMS_EMAIL_MOCK_WEBHOOK_SECRET: "unique-staging-mail-hook-0cbf6c53-bf13-474c",
    SMS_EMAIL_CONTACT_HASH_PEPPER: "unique-staging-contact-pepper-36a94e36-bd7a",
    AI_ASSISTANT_AUDIT_HASH_PEPPER: "unique-staging-ai-pepper-9787049b-ca5b-407e",
    CLOUD_BACKUP_ENCRYPTION_KEY_V1: Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString("base64"),
    WHATSAPP_LIVE_SENDING_ENABLED: "false",
    SMS_EMAIL_SMS_LIVE_ENABLED: "false",
    SMS_EMAIL_EMAIL_LIVE_ENABLED: "false",
    SMS_EMAIL_SUPERVISED_LIVE_ACTIVATION_ENABLED: "false",
    DEBUG: "false",
    NEXT_PUBLIC_DEBUG: "false",
    NALANDA_DEBUG: "false"
  };
}

function codes(environment: NodeJS.ProcessEnv) {
  return validateDeploymentEnvironment(environment, workspace).issues.map((issue) => issue.code);
}

describe("staging deployment environment validation", () => {
  it("accepts the isolated synthetic rehearsal contract", () => {
    expect(validateDeploymentEnvironment(validEnvironment(), workspace)).toMatchObject({ ok: true, environment: "staging" });
  });

  it("rejects prisma/dev.db and other dev.db targets", () => {
    const environment = validEnvironment();
    environment.DATABASE_URL = "file:./prisma/dev.db";
    expect(codes(environment)).toContain("OPERATIONAL_DATABASE_REJECTED");
  });

  it("rejects demo business-data opt-in in the release environment", () => {
    const environment = validEnvironment();
    environment.ALLOW_DEMO_BUSINESS_DATA = "true";
    expect(codes(environment)).toContain("DEMO_BUSINESS_DATA_REJECTED");
  });

  it("rejects an HTTP staging URL", () => {
    const environment = validEnvironment();
    environment.APP_ORIGIN = "http://staging.localhost";
    environment.PUBLIC_WEBSITE_URL = environment.APP_ORIGIN;
    expect(codes(environment)).toContain("PUBLIC_URL_NOT_HTTPS");
  });

  it("rejects placeholder and development secrets", () => {
    const placeholder = validEnvironment();
    placeholder.AUTH_SECRET = "<generate-locally-at-least-32-random-characters>";
    expect(codes(placeholder)).toContain("PLACEHOLDER_SECRET_REJECTED");
    const development = validEnvironment();
    development.AUTH_SECRET = "DEVOPS1B-local-only-secret-with-more-than-32-characters";
    expect(codes(development)).toContain("DEVELOPMENT_SECRET_REJECTED");
  });

  it("rejects insecure cookies and disabled trusted-proxy sanitization", () => {
    const environment = validEnvironment();
    environment.SESSION_COOKIE_SECURE = "false";
    environment.NALANDA_TRUSTED_PROXY_MODE = "disabled";
    expect(codes(environment).filter((code) => code === "SECURE_TRANSPORT_SETTING_REQUIRED")).toHaveLength(2);
  });

  it("rejects production mixing in the public PWA build identifier", () => {
    const environment = validEnvironment();
    environment.NEXT_PUBLIC_PWA_BUILD_VERSION = "staging-production-release";
    expect(codes(environment)).toContain("ENVIRONMENT_IDENTIFIER_MIXED");
  });

  it("rejects every release-local Next environment file outside local rehearsal", () => {
    const release = mkdtempSync(path.join(tmpdir(), "nalanda-staging-release-"));
    try {
      writeFileSync(path.join(release, ".env.production"), "AUTH_SECRET=not-printed\n", "utf8");
      const environment = validEnvironment();
      environment.NALANDA_LOCAL_REHEARSAL = "false";
      expect(validateDeploymentEnvironment(environment, release).issues.map((issue) => issue.code)).toContain("RELEASE_ENV_FILE_REJECTED");
    } finally {
      rmSync(release, { recursive: true, force: true });
    }
  });

  it("rejects database and persistent-path escapes", () => {
    const environment = validEnvironment();
    environment.DATABASE_URL = `file:${path.join(workspace, "tmp", "escaped.db").replaceAll("\\", "/")}`;
    environment.BACKUP_DIRECTORY = path.join(workspace, "tmp", "escaped-backups");
    expect(codes(environment)).toEqual(expect.arrayContaining(["DATABASE_PATH_ESCAPE", "PERSISTENT_PATH_ESCAPE"]));
  });

  it("rejects partial and complete live-provider credentials", () => {
    const partial = validEnvironment();
    partial.GMAIL_OAUTH_CLIENT_ID = "configured-client-id";
    expect(codes(partial)).toContain("PARTIAL_LIVE_PROVIDER_CONFIGURATION");
    const enabled = validEnvironment();
    enabled.WHATSAPP_LIVE_SENDING_ENABLED = "true";
    expect(codes(enabled)).toContain("LIVE_PROVIDER_NOT_DISABLED");
  });

  it("rejects production/staging identifier mixing and dangerous debug modes", () => {
    const environment = validEnvironment();
    environment.NALANDA_DEPLOYMENT_ID = "staging-production-20260723";
    environment.NODE_OPTIONS = "--inspect=0.0.0.0:9229";
    environment.PRISMA_LOG_LEVEL = "query";
    expect(codes(environment)).toEqual(expect.arrayContaining([
      "ENVIRONMENT_IDENTIFIER_MIXED",
      "NODE_INSPECTOR_REJECTED",
      "PRISMA_QUERY_LOG_REJECTED"
    ]));
  });

  it("rejects missing or malformed encryption keys", () => {
    const environment = validEnvironment();
    environment.CLOUD_BACKUP_ENCRYPTION_KEY_V1 = "not-base64";
    expect(codes(environment)).toContain("ENCRYPTION_KEY_INVALID");
  });

  it("rejects low-entropy secret and encryption-key material", () => {
    const environment = validEnvironment();
    environment.AUTH_SECRET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    environment.CLOUD_BACKUP_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 0).toString("base64");
    expect(codes(environment)).toEqual(expect.arrayContaining(["LOW_ENTROPY_SECRET_REJECTED", "ENCRYPTION_KEY_INVALID"]));
  });

  it("never includes secret values in formatted output", () => {
    const environment = validEnvironment();
    const secret = "<placeholder-secret-value-that-must-never-appear>";
    environment.AUTH_SECRET = secret;
    const output = formatDeploymentEnvironmentResult(validateDeploymentEnvironment(environment, workspace));
    expect(output).not.toContain(secret);
    expect(output).toContain("Secret values were not printed");
  });

  it("exposes a non-mutating, no-store deployment health response", async () => {
    const previous = process.env.NALANDA_DEPLOYMENT_ID;
    process.env.NALANDA_DEPLOYMENT_ID = "staging-health-20260723";
    try {
      const { GET } = await import("../app/api/deployment-health/route");
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({
        status: "ok",
        service: "nalanda-erp",
        release: "staging-health-20260723"
      });
    } finally {
      if (previous === undefined) delete process.env.NALANDA_DEPLOYMENT_ID;
      else process.env.NALANDA_DEPLOYMENT_ID = previous;
    }
  });
});
