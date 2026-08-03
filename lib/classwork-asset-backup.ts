import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { unzipSync, zipSync } from "fflate";
import { decryptCloudBackup, encryptCloudBackup } from "@/lib/cloud-backup-container";
import { readClassworkFile } from "@/lib/classwork-files";

const FORMAT_VERSION = 37;
const MANIFEST_NAME = "manifest.json";
const MAX_ASSET_COUNT = 5_000;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

type AssetManifest = {
  format: "NALANDA_CLASSWORK_ASSETS_V1";
  createdAt: string;
  assets: Array<{
    publicKey: string;
    storageKey: string;
    safeDisplayName: string;
    mediaType: string;
    extension: string;
    byteSize: number;
    sha256: string;
    width: number | null;
    height: number | null;
    createdByUserId: string;
    createdAt: string;
    ownerType: "ITEM_VERSION" | "SUBMISSION_VERSION";
    itemPublicKey: string;
    itemVersionPublicKey: string;
    itemVersionNumber: number;
    submissionPublicKey: string | null;
    submissionVersionPublicKey: string | null;
    submissionVersionNumber: number | null;
    entry: string;
  }>;
};

export class ClassworkAssetBackupError extends Error {}

export async function createAndVerifyClassworkAssetBackup(client: PrismaClient, input: {
  artifactPath: string;
  key: Buffer;
  keyVersion: string;
  restoreRoots: [string, string];
  createdAt?: Date;
  attachmentPublicKeys?: string[];
}) {
  const createdAt = input.createdAt ?? new Date();
  const requestedKeys = [...new Set(input.attachmentPublicKeys ?? [])];
  if (requestedKeys.length > MAX_ASSET_COUNT) throw new ClassworkAssetBackupError("Classwork asset backup exceeds the bounded file count.");
  const attachments = await client.classworkAttachment.findMany({
    where: requestedKeys.length ? { publicKey: { in: requestedKeys } } : undefined,
    include: {
      itemVersion: { select: { publicKey: true, versionNumber: true, item: { select: { publicKey: true } } } },
      submissionVersion: { select: { publicKey: true, versionNumber: true, submission: { select: { publicKey: true, item: { select: { publicKey: true } } } }, itemVersion: { select: { publicKey: true, versionNumber: true } } } }
    },
    orderBy: { publicKey: "asc" },
    take: MAX_ASSET_COUNT + 1
  });
  if (attachments.length > MAX_ASSET_COUNT) throw new ClassworkAssetBackupError("Classwork asset backup exceeds the bounded file count.");
  if (requestedKeys.length && attachments.length !== requestedKeys.length) throw new ClassworkAssetBackupError("A requested classwork attachment is missing from the encrypted backup set.");
  const entries: Record<string, Uint8Array> = {};
  let total = 0;
  const manifest: AssetManifest = { format: "NALANDA_CLASSWORK_ASSETS_V1", createdAt: createdAt.toISOString(), assets: [] };
  for (const attachment of attachments) {
    if (Boolean(attachment.itemVersion) === Boolean(attachment.submissionVersion)) throw new ClassworkAssetBackupError("A classwork attachment must have exactly one version owner.");
    const bytes = await readClassworkFile(attachment.storageKey, attachment.sha256);
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) throw new ClassworkAssetBackupError("Classwork asset backup exceeds the bounded byte limit.");
    const entry = attachment.storageKey;
    entries[entry] = bytes;
    const itemVersion = attachment.itemVersion ?? attachment.submissionVersion!.itemVersion;
    manifest.assets.push({
      publicKey: attachment.publicKey,
      storageKey: attachment.storageKey,
      safeDisplayName: attachment.safeDisplayName,
      mediaType: attachment.mediaType,
      extension: attachment.extension,
      byteSize: attachment.byteSize,
      sha256: attachment.sha256,
      width: attachment.width,
      height: attachment.height,
      createdByUserId: attachment.createdByUserId,
      createdAt: attachment.createdAt.toISOString(),
      ownerType: attachment.itemVersion ? "ITEM_VERSION" : "SUBMISSION_VERSION",
      itemPublicKey: attachment.itemVersion?.item.publicKey ?? attachment.submissionVersion!.submission.item.publicKey,
      itemVersionPublicKey: itemVersion.publicKey,
      itemVersionNumber: itemVersion.versionNumber,
      submissionPublicKey: attachment.submissionVersion?.submission.publicKey ?? null,
      submissionVersionPublicKey: attachment.submissionVersion?.publicKey ?? null,
      submissionVersionNumber: attachment.submissionVersion?.versionNumber ?? null,
      entry
    });
  }
  entries[MANIFEST_NAME] = Buffer.from(JSON.stringify(manifest), "utf8");
  const plaintext = Buffer.from(zipSync(entries, { level: 9 }));
  const encrypted = await encryptCloudBackup(plaintext, { backupFormatVersion: FORMAT_VERSION, createdAt, encryptionKeyVersion: input.keyVersion, key: input.key });
  await mkdir(path.dirname(path.resolve(input.artifactPath)), { recursive: true });
  await writeFile(input.artifactPath, encrypted.bytes, { flag: "wx", mode: 0o600 });
  const persisted = await readFile(input.artifactPath);
  const artifactSha256 = sha256(persisted);
  const first = await restoreClassworkAssetBackup(persisted, { key: input.key, targetRoot: input.restoreRoots[0] });
  const second = await restoreClassworkAssetBackup(persisted, { key: input.key, targetRoot: input.restoreRoots[1] });
  if (first.manifestSha256 !== second.manifestSha256 || first.assetDigest !== second.assetDigest || first.ownershipDigest !== second.ownershipDigest || first.assetCount !== attachments.length) throw new ClassworkAssetBackupError("The two isolated attachment restores do not match.");
  if (attachments.length) await client.$transaction(async (tx) => {
    for (const attachment of attachments) {
      const changed = await tx.classworkAttachment.updateMany({ where: { id: attachment.id, sha256: attachment.sha256, byteSize: attachment.byteSize }, data: { recoveryStatus: "VERIFIED", backupArtifactSha256: artifactSha256, backupKeyVersion: input.keyVersion, backupVerifiedAt: createdAt } });
      if (changed.count !== 1) throw new ClassworkAssetBackupError("An attachment changed while recovery proof was recorded.");
    }
  });
  return { artifactSha256, assetCount: attachments.length, totalBytes: total, firstRestore: first, secondRestore: second, encryptedBytes: persisted.length };
}

export async function restoreClassworkAssetBackup(container: Buffer, input: { key: Buffer; targetRoot: string }) {
  const decrypted = await decryptCloudBackup(container, { key: input.key, maximumPlaintextBytes: MAX_TOTAL_BYTES + 10 * 1024 * 1024 });
  let archive: Record<string, Uint8Array>;
  try { archive = unzipSync(decrypted.plaintext); } catch { throw new ClassworkAssetBackupError("The decrypted classwork asset archive is malformed."); }
  const manifestBytes = archive[MANIFEST_NAME];
  if (!manifestBytes) throw new ClassworkAssetBackupError("The encrypted classwork asset manifest is missing.");
  let manifest: AssetManifest;
  try { manifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8")); } catch { throw new ClassworkAssetBackupError("The encrypted classwork asset manifest is invalid."); }
  validateManifest(manifest, archive);
  const root = path.resolve(input.targetRoot);
  const rootStat = await lstat(root).catch(() => null);
  if (rootStat?.isSymbolicLink() || (rootStat && !rootStat.isDirectory())) throw new ClassworkAssetBackupError("The isolated restore target is unsafe.");
  await mkdir(root, { recursive: true });
  const digest = createHash("sha256");
  const ownershipDigest = createHash("sha256");
  let idempotent = true;
  for (const asset of manifest.assets) {
    const target = safeRestorePath(root, asset.entry);
    const bytes = Buffer.from(archive[asset.entry]);
    if (bytes.length !== asset.byteSize || sha256(bytes) !== asset.sha256) throw new ClassworkAssetBackupError("A restored attachment failed byte/hash verification.");
    await mkdir(path.dirname(target), { recursive: true });
    const current = await readFile(target).catch(() => null);
    if (current) {
      if (current.length !== bytes.length || sha256(current) !== asset.sha256) throw new ClassworkAssetBackupError("The isolated restore target contains a conflicting attachment.");
    } else {
      await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
      idempotent = false;
    }
    digest.update(asset.publicKey).update(asset.sha256).update(String(asset.byteSize));
    ownershipDigest.update(asset.ownerType).update(asset.itemPublicKey).update(asset.itemVersionPublicKey).update(String(asset.itemVersionNumber)).update(asset.submissionPublicKey ?? "").update(asset.submissionVersionPublicKey ?? "").update(String(asset.submissionVersionNumber ?? ""));
  }
  return { assetCount: manifest.assets.length, manifestSha256: sha256(manifestBytes), assetDigest: digest.digest("hex"), ownershipDigest: ownershipDigest.digest("hex"), idempotent };
}

function validateManifest(manifest: AssetManifest, archive: Record<string, Uint8Array>) {
  if (!manifest || manifest.format !== "NALANDA_CLASSWORK_ASSETS_V1" || !Array.isArray(manifest.assets) || manifest.assets.length > MAX_ASSET_COUNT || new Date(manifest.createdAt).toISOString() !== manifest.createdAt) throw new ClassworkAssetBackupError("The encrypted classwork asset manifest is unsupported.");
  const keys = Object.keys(archive).sort();
  const expected = [MANIFEST_NAME, ...manifest.assets.map((row) => row.entry)].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new ClassworkAssetBackupError("The encrypted classwork asset archive contains unexpected entries.");
  const publicKeys = new Set<string>();
  let total = 0;
  for (const row of manifest.assets) {
    const ownerValid = row.ownerType === "ITEM_VERSION"
      ? row.submissionPublicKey === null && row.submissionVersionPublicKey === null && row.submissionVersionNumber === null
      : row.ownerType === "SUBMISSION_VERSION" && validPublicKey(row.submissionPublicKey) && validPublicKey(row.submissionVersionPublicKey) && Number.isSafeInteger(row.submissionVersionNumber) && Number(row.submissionVersionNumber) > 0;
    const dimensionsValid = (row.width === null && row.height === null) || (Number.isSafeInteger(row.width) && Number(row.width) > 0 && Number.isSafeInteger(row.height) && Number(row.height) > 0);
    const metadataValid = /^Private attachment\.(?:pdf|png|jpg|webp)$/.test(row.safeDisplayName) && ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(row.mediaType) && [".pdf", ".png", ".jpg", ".webp"].includes(row.extension) && validPublicKey(row.itemPublicKey) && validPublicKey(row.itemVersionPublicKey) && Number.isSafeInteger(row.itemVersionNumber) && row.itemVersionNumber > 0 && validPublicKey(row.createdByUserId) && validIso(row.createdAt);
    if (!validPublicKey(row.publicKey) || publicKeys.has(row.publicKey) || !/^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.(?:pdf|png|jpg|webp)$/.test(row.entry) || row.entry !== row.storageKey || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.byteSize) || row.byteSize < 1 || !ownerValid || !dimensionsValid || !metadataValid) throw new ClassworkAssetBackupError("The encrypted classwork asset manifest contains an invalid entry.");
    publicKeys.add(row.publicKey);
    total += row.byteSize;
  }
  if (total > MAX_TOTAL_BYTES) throw new ClassworkAssetBackupError("The encrypted classwork asset manifest exceeds the byte limit.");
}

function validPublicKey(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value); }
function validIso(value: unknown) { return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }

function safeRestorePath(root: string, entry: string) {
  const target = path.resolve(root, ...entry.split("/"));
  if (!target.startsWith(`${root}${path.sep}`)) throw new ClassworkAssetBackupError("The encrypted classwork asset archive contains a traversal path.");
  return target;
}

function sha256(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
