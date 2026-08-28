import { createHash } from "node:crypto";
import {
  CloudBackupProviderError,
  type CloudBackupObjectHead,
  type CloudBackupProvider,
  validateSafeObjectKey
} from "@/lib/cloud-backup-provider";
import { CLOUD_BACKUP_MAGIC } from "@/lib/cloud-backup-container";
import {
  configuredPrivateObjectStore,
  modulePrivateObjectKey,
  modulePrivateObjectPrefix,
  PrivateObjectStoreError
} from "@/lib/portable-runtime/private-object-store";

function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function mappedKey(objectKey: string) {
  return modulePrivateObjectKey("backups", validateSafeObjectKey(objectKey));
}

function head(objectKey: string, byteSize: number, version: string | null): CloudBackupObjectHead {
  const opaque = objectKey.split("/").at(-1)!.replace(".npsbackup", "");
  return { objectKey, objectIdSafe: `portable-${opaque}`, versionSafe: version, byteSize };
}

export function isRetryableS3PrivateObjectStoreError(error: unknown) {
  return error instanceof PrivateObjectStoreError && (error.status === 429 || error.status >= 500);
}

export function createS3CompatibleCloudBackupProvider(): CloudBackupProvider {
  const store = configuredPrivateObjectStore();
  if (store.kind !== "S3_COMPATIBLE") {
    throw new CloudBackupProviderError("OBJECT_STORAGE_NOT_CONFIGURED", "Private S3-compatible backup storage is not configured.");
  }
  return {
    kind: "OBJECT_STORAGE",
    mode: "PRIVATE_PORTABLE",
    async healthCheck() {
      const health = await store.healthCheck();
      return { ready: health.ready, safeMessage: health.ready ? "Encrypted private object backup destination is ready." : "Encrypted private object backup destination is unavailable." };
    },
    async putObject(objectKey, bytes) {
      validateSafeObjectKey(objectKey);
      if (!bytes.subarray(0, 8).equals(Buffer.from(CLOUD_BACKUP_MAGIC, "ascii"))) {
        throw new CloudBackupProviderError("PLAINTEXT_UPLOAD_BLOCKED", "The private object destination accepts only Nalanda encrypted backup containers.");
      }
      const object = await store.putPrivateObject({ key: mappedKey(objectKey), bytes, sha256: checksum(bytes), contentType: "application/octet-stream" });
      return head(objectKey, object.byteSize, object.version);
    },
    async headObject(objectKey) {
      const object = await store.statPrivateObject(mappedKey(objectKey));
      return object ? head(objectKey, object.byteSize, object.version) : null;
    },
    async getObject(objectKey) {
      return (await store.getPrivateObject(mappedKey(objectKey))).bytes;
    },
    async deleteObject(objectKey, versionSafe) {
      if (!versionSafe || !/^[A-Za-z0-9._-]{1,256}$/.test(versionSafe)) {
        throw new CloudBackupProviderError("OBJECT_VERSION_REQUIRED", "The exact encrypted backup object version is required for deletion.");
      }
      const result = await store.deleteGovernedObject(mappedKey(objectKey), versionSafe);
      return { deleted: result.deleted, alreadyMissing: !result.deleted };
    },
    async listObjectsBySafePrefix(prefix, limit) {
      if (!/^cloud-backup\/[a-z0-9]{0,32}$/.test(prefix) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new CloudBackupProviderError("LIST_INVALID", "Private backup list request is invalid.");
      }
      const rows = await store.listBoundedPrefix(modulePrivateObjectPrefix("backups", prefix || "cloud-backup"), limit);
      return rows.map((row) => {
        const original = row.key.replace(/^private\/backups\//, "");
        return head(original, row.byteSize, row.version);
      });
    },
    classifyRetryability(error) {
      return (error instanceof CloudBackupProviderError && error.retryable) || isRetryableS3PrivateObjectStoreError(error);
    },
    redactError(error) {
      return error instanceof CloudBackupProviderError
        ? { code: error.code, safeMessage: error.message }
        : error instanceof PrivateObjectStoreError
          ? { code: error.code, safeMessage: "The encrypted private backup destination operation failed." }
        : { code: "OBJECT_STORAGE_FAILURE", safeMessage: "The encrypted private backup destination operation failed." };
    }
  };
}
