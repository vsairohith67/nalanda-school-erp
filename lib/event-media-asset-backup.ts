import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { unzipSync, zipSync } from "fflate";
import { CLOUD_BACKUP_MAX_PLAINTEXT_BYTES, decryptCloudBackup, encryptCloudBackup } from "@/lib/cloud-backup-container";
import { readEventMediaBytes } from "@/lib/event-media-files";

const FORMAT_VERSION = 42;
const MANIFEST_NAME = "manifest.json";
const MAX_ASSET_COUNT = 5_000;
export const EVENT_MEDIA_ASSET_BACKUP_MAX_TOTAL_BYTES = 240 * 1024 * 1024;

type ManifestFile = {
  assetPublicKey: string;
  albumPublicKey: string;
  kind: "ORIGINAL" | "THUMBNAIL";
  storageKey: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  entry: string;
};

type AssetManifest = {
  format: "NALANDA_EVENT_MEDIA_ASSETS_V1";
  createdAt: string;
  files: ManifestFile[];
};

export class EventMediaAssetBackupError extends Error {}

export async function createAndVerifyEventMediaAssetBackup(client: PrismaClient, input: {
  artifactPath: string;
  key: Buffer;
  keyVersion: string;
  restoreRoots: [string, string];
  createdAt?: Date;
  assetPublicKeys?: string[];
}) {
  if (input.key.length !== 32) throw new EventMediaAssetBackupError("Event Media asset backup requires a 32-byte encryption key.");
  const createdAt = input.createdAt ?? new Date();
  const requested = [...new Set(input.assetPublicKeys ?? [])];
  if (requested.length > MAX_ASSET_COUNT) throw new EventMediaAssetBackupError("Event Media asset backup exceeds the bounded asset count.");
  const assets = await client.eventMediaAsset.findMany({
    where: requested.length ? { publicKey: { in: requested } } : undefined,
    include: {
      album: { select: { publicKey: true } },
      derivatives: { where: { kind: "THUMBNAIL", status: "READY" }, orderBy: { createdAt: "asc" } }
    },
    orderBy: { publicKey: "asc" },
    take: MAX_ASSET_COUNT + 1
  });
  if (assets.length > MAX_ASSET_COUNT || (requested.length && assets.length !== requested.length)) throw new EventMediaAssetBackupError("Event Media asset backup selection is invalid or incomplete.");
  const entries: Record<string, Uint8Array> = {};
  const manifest: AssetManifest = { format: "NALANDA_EVENT_MEDIA_ASSETS_V1", createdAt: createdAt.toISOString(), files: [] };
  let totalBytes = 0;
  for (const asset of assets) {
    const files = [{ kind: "ORIGINAL" as const, storageKey: asset.originalStorageKey, mediaType: asset.originalMediaType, byteSize: asset.originalByteSize, sha256: asset.originalSha256 }, ...asset.derivatives.map((row) => ({ kind: "THUMBNAIL" as const, storageKey: row.storageKey!, mediaType: row.mediaType!, byteSize: row.byteSize!, sha256: row.sha256! }))];
    for (const file of files) {
      const bytes = await readEventMediaBytes(file.storageKey, file.sha256, file.byteSize);
      totalBytes += bytes.length;
      if (totalBytes > EVENT_MEDIA_ASSET_BACKUP_MAX_TOTAL_BYTES) throw new EventMediaAssetBackupError("Event Media asset backup exceeds the bounded byte limit.");
      if (entries[file.storageKey]) throw new EventMediaAssetBackupError("Event Media storage ownership is duplicated.");
      entries[file.storageKey] = bytes;
      manifest.files.push({ assetPublicKey: asset.publicKey, albumPublicKey: asset.album.publicKey, ...file, entry: file.storageKey });
    }
  }
  entries[MANIFEST_NAME] = Buffer.from(JSON.stringify(manifest), "utf8");
  const encrypted = await encryptCloudBackup(Buffer.from(zipSync(entries, { level: 9 })), { backupFormatVersion: FORMAT_VERSION, createdAt, encryptionKeyVersion: input.keyVersion, key: input.key });
  await mkdir(path.dirname(path.resolve(input.artifactPath)), { recursive: true });
  await writeFile(input.artifactPath, encrypted.bytes, { flag: "wx", mode: 0o600 });
  const persisted = await readFile(input.artifactPath);
  const artifactSha256 = sha256(persisted);
  const firstRestore = await restoreEventMediaAssetBackup(persisted, { key: input.key, targetRoot: input.restoreRoots[0] });
  const secondRestore = await restoreEventMediaAssetBackup(persisted, { key: input.key, targetRoot: input.restoreRoots[1] });
  if (firstRestore.fileDigest !== secondRestore.fileDigest || firstRestore.ownershipDigest !== secondRestore.ownershipDigest || firstRestore.fileCount !== manifest.files.length) throw new EventMediaAssetBackupError("The two isolated Event Media restores do not match.");
  if (assets.length) await client.$transaction(async (tx) => {
    for (const asset of assets) {
      const changed = await tx.eventMediaAsset.updateMany({ where: { id: asset.id, originalSha256: asset.originalSha256, originalByteSize: asset.originalByteSize }, data: { recoveryStatus: "VERIFIED", backupArtifactSha256: artifactSha256, backupKeyVersion: input.keyVersion, backupVerifiedAt: createdAt } });
      if (changed.count !== 1) throw new EventMediaAssetBackupError("An original asset changed while recovery proof was recorded.");
    }
  });
  return { artifactSha256, assetCount: assets.length, fileCount: manifest.files.length, totalBytes, encryptedBytes: persisted.length, firstRestore, secondRestore };
}

export async function restoreEventMediaAssetBackup(container: Buffer, input: { key: Buffer; targetRoot: string }) {
  const decrypted = await decryptCloudBackup(container, { key: input.key, maximumPlaintextBytes: CLOUD_BACKUP_MAX_PLAINTEXT_BYTES });
  let archive: Record<string, Uint8Array>;
  try { archive = unzipSync(decrypted.plaintext); } catch { throw new EventMediaAssetBackupError("The decrypted Event Media asset archive is malformed."); }
  const manifestBytes = archive[MANIFEST_NAME];
  if (!manifestBytes) throw new EventMediaAssetBackupError("The encrypted Event Media asset manifest is missing.");
  let manifest: AssetManifest;
  try { manifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8")); } catch { throw new EventMediaAssetBackupError("The encrypted Event Media asset manifest is invalid."); }
  validateManifest(manifest, archive);
  const root = path.resolve(input.targetRoot);
  const rootStat = await lstat(root).catch(() => null);
  if (rootStat?.isSymbolicLink() || (rootStat && !rootStat.isDirectory())) throw new EventMediaAssetBackupError("The isolated Event Media restore target is unsafe.");
  await mkdir(root, { recursive: true });
  const fileDigest = createHash("sha256"), ownershipDigest = createHash("sha256");
  let idempotent = true;
  for (const file of manifest.files) {
    const bytes = Buffer.from(archive[file.entry]);
    if (bytes.length !== file.byteSize || sha256(bytes) !== file.sha256) throw new EventMediaAssetBackupError("A restored Event Media file failed exact byte verification.");
    const target = safeRestorePath(root, file.entry);
    await mkdir(path.dirname(target), { recursive: true });
    const current = await readFile(target).catch(() => null);
    if (current) {
      if (current.length !== bytes.length || sha256(current) !== file.sha256) throw new EventMediaAssetBackupError("The isolated Event Media restore target contains a conflicting file.");
    } else {
      await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
      idempotent = false;
    }
    fileDigest.update(file.entry).update(file.sha256).update(String(file.byteSize));
    ownershipDigest.update(file.assetPublicKey).update(file.albumPublicKey).update(file.kind);
  }
  return { fileCount: manifest.files.length, manifestSha256: sha256(manifestBytes), fileDigest: fileDigest.digest("hex"), ownershipDigest: ownershipDigest.digest("hex"), idempotent };
}

function validateManifest(manifest: AssetManifest, archive: Record<string, Uint8Array>) {
  if (!manifest || manifest.format !== "NALANDA_EVENT_MEDIA_ASSETS_V1" || !Array.isArray(manifest.files) || manifest.files.length > MAX_ASSET_COUNT * 2 || !validIso(manifest.createdAt)) throw new EventMediaAssetBackupError("The encrypted Event Media asset manifest is unsupported.");
  const keys = Object.keys(archive).sort(), expected = [MANIFEST_NAME, ...manifest.files.map((row) => row.entry)].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new EventMediaAssetBackupError("The encrypted Event Media asset archive contains unexpected entries.");
  const entries = new Set<string>();
  let total = 0;
  for (const file of manifest.files) {
    const original = file.kind === "ORIGINAL" && /^original\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(file.entry) && ["image/png", "image/jpeg", "image/webp"].includes(file.mediaType);
    const derivative = file.kind === "THUMBNAIL" && /^derivative\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.jpg$/.test(file.entry) && file.mediaType === "image/jpeg";
    if ((!original && !derivative) || file.storageKey !== file.entry || entries.has(file.entry) || !validPublicKey(file.assetPublicKey) || !validPublicKey(file.albumPublicKey) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.byteSize) || file.byteSize < 1 || !archive[file.entry]) throw new EventMediaAssetBackupError("The encrypted Event Media asset manifest contains an invalid entry.");
    entries.add(file.entry); total += file.byteSize;
  }
  if (total > EVENT_MEDIA_ASSET_BACKUP_MAX_TOTAL_BYTES) throw new EventMediaAssetBackupError("The encrypted Event Media asset manifest exceeds the byte limit.");
}

function safeRestorePath(root: string, entry: string) { const target = path.resolve(root, ...entry.split("/")); if (!target.startsWith(`${root}${path.sep}`)) throw new EventMediaAssetBackupError("The encrypted Event Media asset archive contains a traversal path."); return target; }
function validPublicKey(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value); }
function validIso(value: unknown) { return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }
function sha256(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
