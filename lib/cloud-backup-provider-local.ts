import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CloudBackupProviderError,
  type CloudBackupObjectHead,
  type CloudBackupProvider,
  validateSafeObjectKey
} from "@/lib/cloud-backup-provider";
import { CLOUD_BACKUP_MAGIC } from "@/lib/cloud-backup-container";

export function localCloudBackupRoot() {
  const configured = process.env.CLOUD_BACKUP_LOCAL_FOLDER?.trim();
  if (!configured) {
    throw new CloudBackupProviderError("LOCAL_FOLDER_NOT_CONFIGURED", "LOCAL_FOLDER destination is not configured in the server environment.");
  }
  const root = path.resolve(configured);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) {
    throw new CloudBackupProviderError("LOCAL_FOLDER_PUBLIC", "LOCAL_FOLDER destination must not be inside public.");
  }
  return root;
}

export function createLocalFolderCloudBackupProvider(_timeoutMs = 30000): CloudBackupProvider {
  return {
    kind: "LOCAL_FOLDER",
    mode: "QA",
    async healthCheck() {
      await safeRoot();
      return { ready: true, safeMessage: "Encrypted LOCAL_FOLDER destination is ready. No external network is used." };
    },
    async putObject(objectKey, bytes) {
      validateSafeObjectKey(objectKey);
      if (!bytes.subarray(0, 8).equals(Buffer.from(CLOUD_BACKUP_MAGIC, "ascii"))) {
        throw new CloudBackupProviderError("PLAINTEXT_UPLOAD_BLOCKED", "LOCAL_FOLDER accepts only Nalanda encrypted backup containers.");
      }
      const root = await safeRoot();
      const target = safeObjectPath(root, objectKey);
      await mkdir(path.dirname(target), { recursive: true });
      await assertDirectoryChain(root, path.dirname(target));
      const existing = await safeExistingFile(root, target);
      if (existing) {
        const current = await readFile(existing);
        if (!current.equals(bytes)) throw new CloudBackupProviderError("OBJECT_COLLISION", "Encrypted backup object identity already contains different bytes.");
        return objectHead(objectKey, current.length);
      }
      const temporary = `${target}.${randomUUID().replaceAll("-", "")}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
        await rename(temporary, target);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
      return objectHead(objectKey, bytes.length);
    },
    async headObject(objectKey) {
      validateSafeObjectKey(objectKey);
      const root = await safeRoot();
      const target = safeObjectPath(root, objectKey);
      const existing = await safeExistingFile(root, target);
      if (!existing) return null;
      const stat = await lstat(existing);
      return objectHead(objectKey, stat.size);
    },
    async getObject(objectKey) {
      validateSafeObjectKey(objectKey);
      const root = await safeRoot();
      const target = safeObjectPath(root, objectKey);
      const existing = await safeExistingFile(root, target);
      if (!existing) throw new CloudBackupProviderError("OBJECT_MISSING", "Encrypted LOCAL_FOLDER object is missing.");
      return readFile(existing);
    },
    async deleteObject(objectKey) {
      validateSafeObjectKey(objectKey);
      const root = await safeRoot();
      const target = safeObjectPath(root, objectKey);
      const existing = await safeExistingFile(root, target);
      if (!existing) return { deleted: false, alreadyMissing: true };
      await unlink(existing);
      return { deleted: true, alreadyMissing: false };
    },
    async listObjectsBySafePrefix(prefix, limit) {
      if (!/^cloud-backup\/[a-z0-9]{0,32}$/.test(prefix) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new CloudBackupProviderError("LIST_INVALID", "LOCAL_FOLDER list request is invalid.");
      }
      // Provider-wide discovery is deliberately not implemented in the first release.
      // Retention always operates on exact object identities stored in Prisma.
      return [];
    },
    classifyRetryability(error) {
      return error instanceof CloudBackupProviderError && error.retryable;
    },
    redactError(error) {
      return error instanceof CloudBackupProviderError
        ? { code: error.code, safeMessage: error.message }
        : { code: "LOCAL_FOLDER_FAILURE", safeMessage: "Encrypted LOCAL_FOLDER operation failed." };
    }
  };
}

async function safeRoot() {
  const configured = localCloudBackupRoot();
  await mkdir(configured, { recursive: true });
  const stat = await lstat(configured);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new CloudBackupProviderError("LOCAL_FOLDER_UNSAFE", "LOCAL_FOLDER destination root is unsafe.");
  }
  return realpath(configured);
}

function safeObjectPath(root: string, objectKey: string) {
  const target = path.resolve(root, ...objectKey.split("/"));
  assertWithin(root, target);
  return target;
}

async function safeExistingFile(root: string, target: string) {
  const stat = await lstat(target).catch(() => null);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new CloudBackupProviderError("LOCAL_FOLDER_UNSAFE", "LOCAL_FOLDER object entry is unsafe.");
  }
  const resolved = await realpath(target);
  assertWithin(root, resolved);
  return resolved;
}

async function assertDirectoryChain(root: string, directory: string) {
  assertWithinOrEqual(root, directory);
  let current = directory;
  while (current !== root) {
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new CloudBackupProviderError("LOCAL_FOLDER_UNSAFE", "LOCAL_FOLDER directory chain contains an unsafe entry.");
    }
    current = path.dirname(current);
  }
}

function assertWithin(root: string, target: string) {
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new CloudBackupProviderError("LOCAL_FOLDER_TRAVERSAL", "LOCAL_FOLDER object escaped the configured root.");
  }
}

function assertWithinOrEqual(root: string, target: string) {
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new CloudBackupProviderError("LOCAL_FOLDER_TRAVERSAL", "LOCAL_FOLDER directory escaped the configured root.");
  }
}

function objectHead(objectKey: string, byteSize: number): CloudBackupObjectHead {
  const opaque = objectKey.split("/").at(-1)!.replace(".npsbackup", "");
  return { objectKey, objectIdSafe: `local-${opaque}`, versionSafe: null, byteSize };
}
