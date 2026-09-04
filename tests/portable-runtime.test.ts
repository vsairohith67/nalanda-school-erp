import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isRetryableS3PrivateObjectStoreError } from "@/lib/cloud-backup-provider-s3";
import { PrivateObjectStoreError } from "@/lib/portable-runtime/private-object-store";
import type Valkey from "iovalkey";
import { validatePortableRuntimeConfiguration } from "../lib/portable-runtime/config";
import { readPortableSecret } from "../lib/portable-runtime/secrets";
import {
  createFileSystemPrivateObjectStore,
  modulePrivateObjectKey,
  validatePrivateObjectKey
} from "../lib/portable-runtime/private-object-store";
import { createValkeyRateLimitStore } from "../lib/portable-runtime/valkey-rate-limit-store";
import { enforceOperationRateLimit } from "../lib/security-resilience";
import { withPostgresJobLock } from "../lib/portable-runtime/job-lock";

function syntheticEnvironment(): NodeJS.ProcessEnv {
  const secret = "synthetic-portable-secret-value-with-48-characters-123456";
  return {
    NODE_ENV: "production",
    NALANDA_ENVIRONMENT: "synthetic-staging",
    NALANDA_SYNTHETIC_STAGING: "true",
    APP_ORIGIN: "https://portable-staging.localhost:8443",
    DATABASE_PROVIDER: "postgresql",
    DATABASE_URL: "postgresql://nalanda_runtime:synthetic@postgres:5432/nalanda_portable_synthetic?connection_limit=20&pool_timeout=20&connect_timeout=10",
    VALKEY_MODE: "distributed",
    VALKEY_URL: "redis://:synthetic@valkey:6379/0",
    PRIVATE_OBJECT_STORAGE_PROVIDER: "S3_COMPATIBLE",
    S3_ENDPOINT: "http://object-store:9000",
    S3_REGION: "us-east-1",
    S3_PRIVATE_BUCKET: "nalanda-portable-synthetic-private",
    S3_FORCE_PATH_STYLE: "true",
    S3_ACCESS_KEY_ID: "synthetic-access",
    S3_SECRET_ACCESS_KEY: secret,
    PORTABLE_BACKUP_DESTINATION: "S3_COMPATIBLE_PRIVATE",
    AUTH_SECRET: secret,
    AUTH_VERIFICATION_SECRET: `${secret}-verification`,
    CLOUD_BACKUP_ENCRYPTION_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
    NALANDA_PROXY_SHARED_SECRET: `${secret}-proxy`,
    PORTABLE_INTERNAL_HEALTH_TOKEN: `${secret}-health`,
    TRUST_PROXY_HEADERS: "true",
    PORTABLE_METRICS_ENABLED: "true",
    PORTABLE_STRUCTURED_LOGGING: "true",
    NALANDA_MINIMUM_NATIVE_CLIENT: "0.1.0",
    NALANDA_NATIVE_ALLOWED_ORIGINS: "nalanda://auth,https://portable-staging.localhost:8443",
    AI_ASSISTANT_PROVIDER: "DISABLED",
    PUBLIC_ADMISSIONS_ENABLED: "false",
    OFFLINE_SYNC_ENABLED: "false",
    CROSS_PLATFORM_APPS_ENABLED: "false",
    TRANSPORT_ENABLED: "false",
    CAFETERIA_ENABLED: "false",
    EVENT_MEDIA_PUBLIC_PUBLISHING_ENABLED: "false",
    CLOUD_AI_ENABLED: "false",
    LIVE_PROVIDERS_ENABLED: "false",
    WHATSAPP_LIVE_SENDING_ENABLED: "false",
    SMS_EMAIL_SMS_LIVE_ENABLED: "false",
    SMS_EMAIL_EMAIL_LIVE_ENABLED: "false"
  };
}

describe("PORTABLE-STAGING-FOUNDATION-1A runtime contracts", () => {
  it("pins readiness to the latest PostgreSQL migration", async () => {
    const compose = await readFile(path.resolve("deploy/portable/compose.yml"), "utf8");
    const migrations = (await readdir(path.resolve("prisma/postgresql/migrations"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(migrations.at(-1)).toBeTruthy();
    expect(compose).toContain(`PORTABLE_EXPECTED_POSTGRES_MIGRATION: ${migrations.at(-1)}`);
  });

  it("isolates backup-prefix credentials in a dedicated queue worker", async () => {
    const compose = await readFile(path.resolve("deploy/portable/compose.yml"), "utf8");
    const route = await readFile(path.resolve("app/api/cloud-backup/runs/route.ts"), "utf8");
    expect(compose).toContain("backup-worker:");
    expect(compose).toContain("S3_ACCESS_KEY_ID_FILE: /run/secrets/s3_backup_access_key_id");
    expect(compose).toContain("networks: [backup-data]");
    const worker = compose.slice(compose.indexOf("  backup-worker:"), compose.indexOf("  web-1:"));
    expect(worker).not.toContain("- auth_secret");
    expect(worker).not.toContain("- proxy_shared_secret");
    expect(worker).not.toContain("- internal_health_token");
    expect(route).toContain("requiresPortableBackupWorker(profile)");
    expect(route).toContain("queued: true");
  });

  it("accepts the explicit synthetic stack and does not require DIRECT_URL in web replicas", () => {
    const result = validatePortableRuntimeConfiguration(syntheticEnvironment(), "web");
    expect(result.issues).toEqual([]);
    expect(result.configuration).toMatchObject({
      environment: "synthetic-staging",
      databaseProvider: "postgresql",
      valkeyMode: "distributed",
      objectStoreProvider: "S3_COMPATIBLE"
    });
  });

  it("fails remote staging closed without PostgreSQL/Valkey/object-store TLS and separate migration identity", () => {
    const environment = syntheticEnvironment();
    Object.assign(environment, {
      NALANDA_ENVIRONMENT: "staging",
      APP_ORIGIN: "https://staging.example.test",
      DIRECT_URL: environment.DATABASE_URL,
      VALKEY_URL: "redis://valkey.internal:6379/0",
      S3_ENDPOINT: "http://objects.internal:9000"
    });
    const result = validatePortableRuntimeConfiguration(environment, "migrate");
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "POSTGRES_TLS_REQUIRED",
      "DATABASE_IDENTITIES_NOT_SEPARATE",
      "VALKEY_TLS_REQUIRED",
      "URL_INVALID"
    ]));
  });

  it("reads only one mounted secret source beneath the approved secret root", async () => {
    const base = path.resolve("tmp", "portable-staging");
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, "secret-test-"));
    try {
      const secretFile = path.join(root, "auth_secret");
      await writeFile(secretFile, "synthetic-mounted-secret-with-sufficient-length\n", { mode: 0o600 });
      const environment: NodeJS.ProcessEnv = {
        NODE_ENV: "test",
        NALANDA_SYNTHETIC_STAGING: "true",
        PORTABLE_SYNTHETIC_SECRET_ROOT: root,
        AUTH_SECRET_FILE: secretFile
      };
      expect(readPortableSecret("AUTH_SECRET", environment, { required: true })).toBe("synthetic-mounted-secret-with-sufficient-length");
      expect(() => readPortableSecret("AUTH_SECRET", { ...environment, AUTH_SECRET: "ambiguous" }, { required: true })).toThrow("SECRET_SOURCE_AMBIGUOUS");
      expect(() => readPortableSecret("AUTH_SECRET", { ...environment, AUTH_SECRET_FILE: path.resolve("package.json") }, { required: true })).toThrow("SECRET_FILE_OUTSIDE_MOUNT_ROOT");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("stores private objects atomically with opaque keys and checksum verification", async () => {
    const base = path.resolve("tmp", "portable-staging");
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, "object-test-"));
    const store = createFileSystemPrivateObjectStore(root);
    const key = modulePrivateObjectKey("classwork", "aa/bb/11111111-2222-4333-8444-555555555555.pdf");
    const bytes = Buffer.from("unmistakably synthetic private attachment");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    try {
      await expect(store.putPrivateObject({ key, bytes, sha256, contentType: "application/pdf" })).resolves.toMatchObject({ key, byteSize: bytes.length, sha256 });
      await expect(store.getPrivateObject(key, 1024)).resolves.toMatchObject({ bytes });
      await expect(store.verifyChecksum(key, sha256)).resolves.toBe(true);
      expect(await readFile(path.join(root, ...key.split("/")), "utf8")).toBe(bytes.toString());
      expect(() => validatePrivateObjectKey("private/classwork/student-name.pdf")).toThrow("PRIVATE_OBJECT_KEY_NOT_OPAQUE");
      expect(() => modulePrivateObjectKey("classwork", "../escape.pdf")).toThrow("MODULE_STORAGE_KEY_INVALID");
    } finally { store.close(); await rm(root, { recursive: true, force: true }); }
  });

  it("retries only transient S3-compatible private backup failures", () => {
    expect(isRetryableS3PrivateObjectStoreError(new PrivateObjectStoreError("S3_UPLOAD_FAILED", 503))).toBe(true);
    expect(isRetryableS3PrivateObjectStoreError(new PrivateObjectStoreError("S3_THROTTLED", 429))).toBe(true);
    expect(isRetryableS3PrivateObjectStoreError(new PrivateObjectStoreError("PRIVATE_OBJECT_NOT_FOUND", 404))).toBe(false);
    expect(isRetryableS3PrivateObjectStoreError(new PrivateObjectStoreError("PRIVATE_OBJECT_CHECKSUM_MISMATCH", 409))).toBe(false);
  });

  it("keeps the synthetic S3 application identity out of bucket control-plane mutations", async () => {
    const policy = JSON.parse(await readFile(path.resolve("deploy", "portable", "minio-app-policy.json"), "utf8"));
    const actions = policy.Statement.flatMap((statement: { Action: string[] }) => statement.Action);
    expect(actions).not.toEqual(expect.arrayContaining([
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:PutBucketPolicy",
      "s3:PutBucketVersioning"
    ]));
    expect(policy.Statement.flatMap((statement: { Resource: string[] }) => statement.Resource)
      .every((resource: string) => resource.startsWith("arn:aws:s3:::nalanda-portable-synthetic-private"))).toBe(true);
    expect(JSON.stringify(policy)).not.toContain("private/backups/");
    const backupPolicy = JSON.parse(await readFile(path.resolve("deploy", "portable", "minio-backup-policy.json"), "utf8"));
    expect(JSON.stringify(backupPolicy)).toContain("private/backups/*");
    expect(JSON.stringify(backupPolicy)).not.toContain("private/admissions/*");
  });

  it("uses one atomic multi-key Valkey script and keeps raw actors out of keys", async () => {
    const calls: unknown[][] = [];
    const fake = {
      status: "ready",
      on() { return this; },
      async eval(...args: unknown[]) { calls.push(args); return [1, 0]; },
      async ping() { return "PONG"; },
      async quit() { return "OK"; },
      disconnect() {}
    } as unknown as Valkey;
    const store = createValkeyRateLimitStore({ NODE_ENV: "test" }, { client: fake });
    const decision = await enforceOperationRateLimit(
      "/api/auth/login",
      "POST",
      { ip: "192.0.2.10", account: "student@example.invalid", session: "raw-session-secret" },
      { store }
    );
    expect(decision.allowed).toBe(true);
    expect(calls).toHaveLength(1);
    const serialized = JSON.stringify(calls[0]);
    expect(serialized).toContain("ZREMRANGEBYSCORE");
    expect(serialized).toContain("ZADD");
    expect(serialized).toContain("{nalanda-rate-limit}:v1:");
    expect(serialized).not.toContain("student@example.invalid");
    expect(serialized).not.toContain("raw-session-secret");
    await store.close();
  });

  it("shares one Valkey readiness wait across concurrent cold-start calls", async () => {
    class FakeValkey extends EventEmitter {
      status = "wait";
      connectCalls = 0;
      async connect() {
        this.connectCalls += 1;
        this.status = "connecting";
        await new Promise<void>((resolve) => setTimeout(() => {
          this.status = "ready";
          this.emit("ready");
          resolve();
        }, 10));
      }
      async ping() { return "PONG"; }
      async quit() { return "OK"; }
      disconnect() { this.status = "end"; }
    }
    const fake = new FakeValkey();
    const store = createValkeyRateLimitStore({ NODE_ENV: "test" }, { client: fake as unknown as Valkey });
    const checks = Array.from({ length: 100 }, () => store.healthCheck());
    await Promise.resolve();
    expect(fake.connectCalls).toBe(1);
    expect(fake.listenerCount("ready")).toBeLessThanOrEqual(1);
    expect(fake.listenerCount("end")).toBeLessThanOrEqual(1);
    await expect(Promise.all(checks)).resolves.toEqual(Array.from({ length: 100 }, () => ({
      ready: true,
      state: "ready",
      safeCode: "VALKEY_READY"
    })));
    await store.close();
  });

  it("holds a PostgreSQL transaction advisory lock around one scheduled job", async () => {
    const events: string[] = [];
    const transaction = { async $queryRawUnsafe() { events.push("lock"); return [{ acquired: true }]; } };
    const client = {
      async $transaction(operation: (tx: typeof transaction) => Promise<unknown>) { events.push("transaction"); return operation(transaction); }
    };
    const previous = process.env.DATABASE_PROVIDER;
    process.env.DATABASE_PROVIDER = "postgresql";
    try {
      const result = await withPostgresJobLock(client as never, "support-sla-check", async () => { events.push("job"); return "done"; });
      expect(result).toMatchObject({ acquired: true, result: "done" });
      expect(events).toEqual(["transaction", "lock", "job"]);
    } finally {
      if (previous === undefined) delete process.env.DATABASE_PROVIDER;
      else process.env.DATABASE_PROVIDER = previous;
    }
  });
});
