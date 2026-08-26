import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateReleaseEnvironmentContract } from "@/lib/deployment-environment";
import { evaluateClientUpdate, publicClientVersionContract } from "@/lib/release-client-version";
import { evaluateReleaseFeatureFlag, releaseFeatureFlags } from "@/lib/release-feature-flags";
import { activeMigrationManifest, createReleaseManifest, verifyReleaseManifest } from "@/lib/release-manifest";
import { buildReleasePackage, verifyReleasePackage } from "@/lib/release-package";
import { acquireReleaseLock, appendReleaseAudit, assertReleasePhaseAllowed, createReleaseCandidate, readReleaseCandidate, releaseDiskProbe, releaseLock, verifyReleaseAudit, writeReleaseCandidate } from "@/lib/release-state";

const roots: string[] = [];
function temporaryRoot(label: string) { const root = mkdtempSync(path.join(os.tmpdir(), `RELEASEOPS1A-${label}-`)); roots.push(root); return root; }
function file(root: string, relative: string, value: string | Buffer) { const target = path.join(root, relative); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, value); }
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

function sourceFixture() {
  const root = temporaryRoot("source");
  file(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  file(root, "package.json", '{"name":"fixture","version":"1.0.0"}\n');
  file(root, "prisma/schema.prisma", "generator client { provider = \"prisma-client-js\" }\ndatasource db { provider = \"sqlite\" url = env(\"DATABASE_URL\") }\n");
  file(root, "prisma/migrations/20260810000000_additive/migration.sql", "CREATE TABLE ReleaseFixture (id TEXT PRIMARY KEY);\n");
  file(root, "prisma/migrations/migration_lock.toml", 'provider = "sqlite"\n');
  file(root, "prisma/postgresql/schema.prisma", "generator client { provider = \"prisma-client-js\" }\ndatasource db { provider = \"postgresql\" url = env(\"DATABASE_URL\") directUrl = env(\"DIRECT_URL\") }\n");
  file(root, "prisma/postgresql/migrations/20260826000000_baseline/migration.sql", "CREATE TABLE \"ReleaseFixture\" (id TEXT PRIMARY KEY);\n");
  file(root, "public/icon.png", Buffer.from([1, 2, 3]));
  file(root, ".next/standalone/server.js", 'console.log("fixture")\n');
  file(root, ".next/static/chunks/app.js", "self.fixture=true;\n");
  file(root, "deploy/staging/Caddyfile.example", "https://staging.example.invalid { reverse_proxy 127.0.0.1:3000 }\n");
  file(root, "config/release-feature-flags.json", "[]\n");
  return root;
}

describe("release manifest and package", () => {
  it("creates a bounded authoritative manifest with migration and public-asset checksums", () => {
    const root = sourceFixture();
    const manifest = createReleaseManifest({ workspaceRoot: root, releaseId: "release-test-1", releaseChannel: "TEST", environment: "TEST", gitCommitSha: "a".repeat(40), previousKnownGoodRelease: "known-good-1", backupFormatVersion: 41, sourceDateEpoch: "1786320000" });
    expect(verifyReleaseManifest(manifest)).toEqual(manifest);
    expect(manifest.appliedMigrations).toEqual(activeMigrationManifest(root));
    expect(manifest.publicStaticAssets).toHaveLength(1);
    expect(manifest.releaseArtifactSha256).toBeNull();
  });

  it("packages standalone output reproducibly and rejects package tampering", () => {
    const root = sourceFixture(), output = temporaryRoot("artifact");
    const first = buildReleasePackage({ workspaceRoot: root, outputRoot: output, releaseId: "release-test-2", releaseChannel: "TEST", environment: "TEST", gitCommitSha: "b".repeat(40), previousKnownGoodRelease: "known-good-1", backupFormatVersion: 41, sourceDateEpoch: "1786320000" });
    const second = buildReleasePackage({ workspaceRoot: root, outputRoot: temporaryRoot("artifact-repeat"), releaseId: "release-test-2", releaseChannel: "TEST", environment: "TEST", gitCommitSha: "b".repeat(40), previousKnownGoodRelease: "known-good-1", backupFormatVersion: 41, sourceDateEpoch: "1786320000" });
    expect(second.report.archiveSha256).toBe(first.report.archiveSha256);
    const verified = verifyReleasePackage({ archiveBytes: readFileSync(first.archivePath), expectedArchiveSha256: first.report.archiveSha256 });
    expect(verified.valid).toBe(true);
    expect(verified.manifest.releaseArtifactSha256).toBe(first.report.payloadSha256);
    const corrupted = Buffer.from(readFileSync(first.archivePath)); corrupted[Math.floor(corrupted.length / 2)] ^= 0xff;
    expect(() => verifyReleasePackage({ archiveBytes: corrupted, expectedArchiveSha256: first.report.archiveSha256 })).toThrow("RELEASE_ARCHIVE_HASH_MISMATCH");
    const previousEpoch = process.env.SOURCE_DATE_EPOCH;
    delete process.env.SOURCE_DATE_EPOCH;
    try {
      expect(() => createReleaseManifest({ workspaceRoot: root, releaseId: "release-test-missing-time", releaseChannel: "TEST", environment: "TEST", gitCommitSha: "b".repeat(40), previousKnownGoodRelease: "known-good-1", backupFormatVersion: 41 })).toThrow("RELEASE_SOURCE_DATE_EPOCH_REQUIRED");
    } finally {
      if (previousEpoch === undefined) delete process.env.SOURCE_DATE_EPOCH;
      else process.env.SOURCE_DATE_EPOCH = previousEpoch;
    }
  });

  it("refuses secret-like and private paths inside the standalone package", () => {
    const root = sourceFixture(); file(root, ".next/standalone/.env.production", "AUTH_SECRET=should-not-ship\n");
    expect(() => buildReleasePackage({ workspaceRoot: root, outputRoot: temporaryRoot("blocked"), releaseId: "release-test-3", releaseChannel: "TEST", environment: "TEST", gitCommitSha: "c".repeat(40), previousKnownGoodRelease: "known-good-1", backupFormatVersion: 41, sourceDateEpoch: "1786320000" })).toThrow("RELEASE_PACKAGE_PRIVATE_PATH_REFUSED");
  });

  it("distinguishes the compiled backup API route from forbidden backup artifacts", () => {
    const allowed = sourceFixture();
    file(allowed, ".next/standalone/.next/server/app/api/backup/route/app-build-manifest.json", "{}\n");
    expect(() => buildReleasePackage({ workspaceRoot: allowed, outputRoot: temporaryRoot("backup-route"), releaseId: "release-test-4", releaseChannel: "TEST", environment: "TEST", gitCommitSha: "e".repeat(40), previousKnownGoodRelease: "known-good-1", backupFormatVersion: 41, sourceDateEpoch: "1786320000" })).not.toThrow();
    const blocked = sourceFixture();
    file(blocked, ".next/standalone/backups/operational.backup", "private backup bytes\n");
    expect(() => buildReleasePackage({ workspaceRoot: blocked, outputRoot: temporaryRoot("backup-blocked"), releaseId: "release-test-5", releaseChannel: "TEST", environment: "TEST", gitCommitSha: "f".repeat(40), previousKnownGoodRelease: "known-good-1", backupFormatVersion: 41, sourceDateEpoch: "1786320000" })).toThrow("RELEASE_PACKAGE_PRIVATE_PATH_REFUSED");
  });
});

describe("release environment and feature gates", () => {
  it("accepts an isolated synthetic staging contract and rejects shared roots and unsafe production shape", () => {
    const root = temporaryRoot("env"), external = temporaryRoot("external");
    const valid: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      NALANDA_ENVIRONMENT: "STAGING", NALANDA_RELEASE_ID: "staging-release-1", NALANDA_RELEASE_CHANNEL: "STAGING", NEXT_PUBLIC_PWA_BUILD_VERSION: "staging-release-1",
      APP_ORIGIN: "https://staging.example.invalid", SESSION_COOKIE_SECURE: "true", DEBUG: "false", LIVE_PROVIDERS_ENABLED: "false", DATABASE_PROVIDER: "postgresql", DATABASE_URL: "postgresql://pooler.example.invalid/staging", DIRECT_URL: "postgresql://direct.example.invalid/staging",
      NALANDA_TRUSTED_PROXY_MODE: "authenticated-edge-v1", NALANDA_REQUIRE_TRUSTED_PROXY: "true", SECURITY_RATE_LIMIT_MODE: "distributed",
      PRIVATE_STORAGE_ROOT: path.join(external, "private"), BACKUP_DIRECTORY: path.join(external, "backups"), AUTH_SECRET: "A9b8C7d6E5f4G3h2I1j0K9l8M7n6O5p4",
      CLOUD_BACKUP_ENCRYPTION_KEY_V1: "Q2xlYXJlZFN0YWdpbmdLZXlGb3JUZXN0c09ubHkh", NALANDA_STAGING_BANNER: "true", PUBLIC_WEBSITE_INDEXING_ENABLED: "false"
    };
    expect(validateReleaseEnvironmentContract(valid, root).ok).toBe(true);
    expect(validateReleaseEnvironmentContract({ ...valid, SESSION_COOKIE_SECURE: "false", DATABASE_URL: "file:./dev.db", NALANDA_STAGING_DATABASE_URL: "file:C:/same/db.sqlite", NALANDA_PRODUCTION_DATABASE_URL: "file:C:/same/db.sqlite" }, root).issues.map((row) => row.code)).toEqual(expect.arrayContaining(["INSECURE_COOKIE_REJECTED", "OPERATIONAL_DEV_DB_REJECTED", "ENVIRONMENT_DATABASE_SHARED"]));
  });

  it("keeps risky flags server-side, versioned and fail-closed", () => {
    expect(releaseFeatureFlags().every((flag) => !flag.defaultState && flag.history.length > 0)).toBe(true);
    expect(evaluateReleaseFeatureFlag({ key: "online-payments", environment: "PRODUCTION", role: "SUPER_ADMIN", expectedVersion: 1 }).reason).toBe("DEFAULT_OFF");
    expect(evaluateReleaseFeatureFlag({ key: "online-payments", environment: "PRODUCTION", role: "SUPER_ADMIN", expectedVersion: 0 }).reason).toBe("STALE_FLAG_VERSION");
    expect(evaluateReleaseFeatureFlag({ key: "unknown", environment: "PRODUCTION", role: "SUPER_ADMIN", expectedVersion: 1 }).reason).toBe("UNKNOWN_FLAG");
  });
});

describe("release lock, audit, candidate and client contract", () => {
  it("blocks release transitions until every prerequisite gate is resolved", () => {
    const candidate = createReleaseCandidate({ releaseId: "release-gates-1", environment: "STAGING", expectedCurrentRelease: "known-good-1", expectedTargetRelease: "release-gates-1", previousKnownGoodRelease: "known-good-1", migrationClassification: "NONE" });
    expect(() => assertReleasePhaseAllowed(candidate, "enter-maintenance")).toThrow("RELEASE_REQUIRED_GATES_INCOMPLETE");
    for (const gate of candidate.gates) { gate.status = "PASSED"; gate.evidenceSafe = "Synthetic governed QA evidence."; gate.checkedAt = new Date(0).toISOString(); }
    expect(() => assertReleasePhaseAllowed(candidate, "enter-maintenance")).toThrow("RELEASE_ROLLBACK_OWNER_REQUIRED");
    candidate.rollback = { ...candidate.rollback, ready: true, owner: "operator-one", deadline: "2099-01-01T00:00:00.000Z" };
    expect(() => assertReleasePhaseAllowed(candidate, "enter-maintenance")).not.toThrow();
    candidate.maintenance.active = true;
    expect(() => assertReleasePhaseAllowed(candidate, "complete")).toThrow("RELEASE_PHASE_SEQUENCE_INVALID");
    candidate.phase = "smoke-test";
    expect(() => assertReleasePhaseAllowed(candidate, "complete")).toThrow("RELEASE_SWITCH_NOT_RECORDED");
    candidate.pointOfNoReturnReached = true;
    expect(() => assertReleasePhaseAllowed(candidate, "complete")).not.toThrow();
  });

  it("enforces one durable owner and verifies the append-only hash chain", () => {
    const root = temporaryRoot("state");
    acquireReleaseLock({ root, owner: "operator-one", session: "session-one", environment: "STAGING", releaseId: "release-lock-1" });
    expect(() => acquireReleaseLock({ root, owner: "operator-two", session: "session-two", environment: "STAGING", releaseId: "release-lock-2" })).toThrow("RELEASE_LOCK_HELD");
    appendReleaseAudit(root, { releaseId: "release-lock-1", environment: "STAGING", phase: "prepare", eventType: "FIXTURE_VERIFIED", actor: "operator-one", summarySafe: "Synthetic fixture verified without private data." });
    expect(verifyReleaseAudit(root)).toMatchObject({ valid: true, events: 2 });
    releaseLock({ root, owner: "operator-one", session: "session-one", releaseId: "release-lock-1" });
    expect(verifyReleaseAudit(root)).toMatchObject({ valid: true, events: 3 });
  });

  it("persists resumable candidate state without private infrastructure metadata", () => {
    const root = temporaryRoot("candidate"), state = createReleaseCandidate({ releaseId: "release-state-1", environment: "STAGING", expectedCurrentRelease: "known-good-1", expectedTargetRelease: "target-1", previousKnownGoodRelease: "known-good-1", migrationClassification: "ADDITIVE_BACKWARD_COMPATIBLE" });
    writeReleaseCandidate(root, state);
    expect(readReleaseCandidate(root)).toMatchObject({ releaseId: "release-state-1", status: "DRAFT", pointOfNoReturnReached: false });
    expect(readFileSync(path.join(root, "candidate.json"), "utf8")).not.toMatch(/password|databaseHash|backupPath/i);
  });

  it("classifies injected low-space probes without exhausting the real disk", () => {
    const root = temporaryRoot("disk");
    expect(releaseDiskProbe(root, 900 * 1024 ** 2).status).toBe("CRITICAL");
    expect(releaseDiskProbe(root, 2 * 1024 ** 3).status).toBe("WARNING");
    expect(releaseDiskProbe(root, 8 * 1024 ** 3).status).toBe("HEALTHY");
  });

  it("evaluates all six client states without exposing internal release detail", () => {
    expect(evaluateClientUpdate({ clientBuildId: "2.0.0", serverBuildId: "2.0.0", minimumSupportedClientVersion: "1.0.0", severity: "AVAILABLE" })).toBe("CURRENT");
    expect(evaluateClientUpdate({ clientBuildId: "1.0.0", serverBuildId: "2.0.0", minimumSupportedClientVersion: "1.0.0", severity: "AVAILABLE" })).toBe("UPDATE_AVAILABLE");
    expect(evaluateClientUpdate({ clientBuildId: "1.0.0", serverBuildId: "2.0.0", minimumSupportedClientVersion: "1.0.0", severity: "RECOMMENDED" })).toBe("UPDATE_RECOMMENDED");
    expect(evaluateClientUpdate({ clientBuildId: "0.9.0", serverBuildId: "2.0.0", minimumSupportedClientVersion: "1.0.0", severity: "REQUIRED" })).toBe("UPDATE_REQUIRED");
    expect(evaluateClientUpdate({ clientBuildId: "0.9.0", serverBuildId: "2.0.0", minimumSupportedClientVersion: "1.0.0", severity: "CRITICAL" })).toBe("INCOMPATIBLE");
    expect(evaluateClientUpdate({ clientBuildId: null, serverBuildId: "2.0.0", minimumSupportedClientVersion: "1.0.0", severity: "AVAILABLE" })).toBe("UNKNOWN");
    const publicValue = publicClientVersionContract({ NODE_ENV: "production", NALANDA_RELEASE_ID: "release-public-1", NEXT_PUBLIC_PWA_BUILD_VERSION: "release-public-1", NALANDA_MINIMUM_WEB_CLIENT: "1.0.0", NALANDA_CLIENT_UPDATE_SEVERITY: "AVAILABLE", NALANDA_RELEASE_DATE: "2026-08-10T00:00:00.000Z" }, "NONE");
    expect(Object.keys(publicValue).sort()).toEqual(["clientBuildId", "contractVersion", "maintenanceState", "minimumSupportedClientVersion", "releaseDate", "releaseId", "updateSeverity"].sort());
  });
});
