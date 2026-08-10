import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import packageJson from "../package.json";
import type { ReleaseAsset, ReleaseEnvironment, ReleaseManifestDocument, ReleaseMigration } from "@/lib/release-operations-types";

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$/;

export function sha256Bytes(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256File(file: string) {
  return sha256Bytes(readFileSync(file));
}

function walkFiles(root: string, base = root): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(root, entry.name);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`RELEASE_SYMLINK_REFUSED:${path.relative(base, absolute)}`);
    if (entry.isDirectory()) result.push(...walkFiles(absolute, base));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

export function publicAssetManifest(workspaceRoot: string): ReleaseAsset[] {
  const root = path.join(workspaceRoot, "public");
  return walkFiles(root).map((absolute) => ({
    path: path.relative(workspaceRoot, absolute).replaceAll(path.sep, "/"),
    bytes: lstatSync(absolute).size,
    sha256: sha256File(absolute)
  }));
}

export function activeMigrationManifest(workspaceRoot: string): ReleaseMigration[] {
  const root = path.join(workspaceRoot, "prisma", "migrations");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const sql = path.join(root, entry.name, "migration.sql");
      if (!existsSync(sql)) throw new Error(`RELEASE_MIGRATION_SQL_MISSING:${entry.name}`);
      return { name: entry.name, sha256: sha256File(sql) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function stableTimestamp() {
  const epoch = process.env.SOURCE_DATE_EPOCH?.trim();
  if (epoch && /^\d{1,14}$/.test(epoch)) return new Date(Number(epoch) * 1000).toISOString();
  return new Date().toISOString();
}

function safeVersion(value: string, label: string) {
  const result = value.trim();
  if (!SAFE_ID.test(result)) throw new Error(`RELEASE_${label}_INVALID`);
  return result;
}

export function createReleaseManifest(input: {
  workspaceRoot: string;
  releaseId: string;
  releaseChannel: string;
  environment: ReleaseEnvironment;
  gitCommitSha: string;
  gitTag?: string | null;
  previousKnownGoodRelease: string;
  backupFormatVersion: number;
  artifactSha256?: string | null;
  featureFlagSnapshotSha256?: string;
}): ReleaseManifestDocument {
  const lockfile = path.join(input.workspaceRoot, "pnpm-lock.yaml");
  const schema = path.join(input.workspaceRoot, "prisma", "schema.prisma");
  const flags = path.join(input.workspaceRoot, "config", "release-feature-flags.json");
  if (!existsSync(lockfile) || !existsSync(schema)) throw new Error("RELEASE_SOURCE_CONTRACT_MISSING");
  const migrations = activeMigrationManifest(input.workspaceRoot);
  const schemaHash = sha256File(schema);
  const migrationFingerprint = migrations.map((row) => `${row.name}:${row.sha256}`).join("\n");
  const releaseId = safeVersion(input.releaseId, "ID");
  const applicationVersion = safeVersion(String(packageJson.version), "APPLICATION_VERSION");
  const pwaBuildId = safeVersion(process.env.NEXT_PUBLIC_PWA_BUILD_VERSION || releaseId, "PWA_BUILD_ID");
  const buildId = safeVersion(process.env.NALANDA_BUILD_ID || releaseId, "BUILD_ID");
  const packageManager = String((packageJson as { packageManager?: string }).packageManager || "pnpm@unknown");
  const featureHash = input.featureFlagSnapshotSha256 || (existsSync(flags) ? sha256File(flags) : sha256Bytes("[]"));
  return {
    contractVersion: 1,
    releaseId,
    applicationVersion,
    releaseChannel: safeVersion(input.releaseChannel, "CHANNEL"),
    gitCommitSha: input.gitCommitSha.toLowerCase(),
    gitTag: input.gitTag ? safeVersion(input.gitTag, "TAG") : null,
    buildId,
    buildTimestamp: stableTimestamp(),
    nodeVersion: process.version,
    packageManagerVersion: packageManager,
    lockfileSha256: sha256File(lockfile),
    prismaSchemaSha256: schemaHash,
    appliedMigrations: migrations,
    applicationSchemaFingerprint: sha256Bytes(`${schemaHash}\n${migrationFingerprint}`),
    backupFormatVersion: input.backupFormatVersion,
    publicStaticAssets: publicAssetManifest(input.workspaceRoot),
    pwaBuildId,
    privateAssetSchemaVersion: "nalanda-private-assets-v1",
    compatibilityContractVersion: "nalanda-client-v1",
    minimumSupportedWebClient: safeVersion(process.env.NALANDA_MINIMUM_WEB_CLIENT || applicationVersion, "MINIMUM_CLIENT"),
    featureFlagSnapshotSha256: featureHash,
    environment: input.environment,
    releaseArtifactSha256: input.artifactSha256 ?? null,
    previousKnownGoodRelease: safeVersion(input.previousKnownGoodRelease, "PREVIOUS_RELEASE")
  };
}

export function verifyReleaseManifest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("RELEASE_MANIFEST_INVALID");
  const manifest = value as ReleaseManifestDocument;
  for (const field of ["releaseId", "applicationVersion", "releaseChannel", "buildId", "pwaBuildId", "privateAssetSchemaVersion", "compatibilityContractVersion", "minimumSupportedWebClient", "previousKnownGoodRelease"] as const) {
    if (!SAFE_ID.test(String(manifest[field] ?? ""))) throw new Error(`RELEASE_MANIFEST_FIELD_INVALID:${field}`);
  }
  for (const field of ["lockfileSha256", "prismaSchemaSha256", "applicationSchemaFingerprint", "featureFlagSnapshotSha256"] as const) {
    if (!SHA256.test(String(manifest[field] ?? ""))) throw new Error(`RELEASE_MANIFEST_HASH_INVALID:${field}`);
  }
  if (manifest.releaseArtifactSha256 !== null && !SHA256.test(String(manifest.releaseArtifactSha256 ?? ""))) throw new Error("RELEASE_MANIFEST_HASH_INVALID:releaseArtifactSha256");
  if (!/^[a-f0-9]{40}$/.test(String(manifest.gitCommitSha ?? ""))) throw new Error("RELEASE_MANIFEST_GIT_COMMIT_INVALID");
  if (!Number.isInteger(manifest.backupFormatVersion) || manifest.backupFormatVersion < 1) throw new Error("RELEASE_MANIFEST_BACKUP_VERSION_INVALID");
  if (!Array.isArray(manifest.appliedMigrations) || !manifest.appliedMigrations.length) throw new Error("RELEASE_MANIFEST_MIGRATIONS_MISSING");
  for (const row of manifest.appliedMigrations) if (!SAFE_ID.test(row.name) || !SHA256.test(row.sha256)) throw new Error("RELEASE_MANIFEST_MIGRATION_INVALID");
  if (!Array.isArray(manifest.publicStaticAssets)) throw new Error("RELEASE_MANIFEST_ASSET_LIST_INVALID");
  for (const row of manifest.publicStaticAssets) {
    if (!row.path.startsWith("public/") || row.path.includes("..") || !SHA256.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes < 0) throw new Error("RELEASE_MANIFEST_ASSET_INVALID");
  }
  return manifest;
}

export function stableManifestJson(manifest: ReleaseManifestDocument) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
