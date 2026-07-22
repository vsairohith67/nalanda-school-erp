import {
  CloudBackupProviderError,
  type CloudBackupObjectHead,
  type CloudBackupProvider,
  type CloudBackupProviderOutcome,
  validateSafeObjectKey
} from "@/lib/cloud-backup-provider";

const storage = new Map<string, Buffer>();
let configuredOutcome: CloudBackupProviderOutcome | null = null;

export function configureMockCloudBackupOutcome(outcome: CloudBackupProviderOutcome | null) {
  configuredOutcome = outcome;
}

export function resetMockCloudBackupStorage() {
  storage.clear();
  configuredOutcome = null;
}

export function mockCloudBackupObjectCount() {
  return storage.size;
}

export function createMockCloudBackupProvider(): CloudBackupProvider {
  const outcome = () => configuredOutcome ?? (process.env.CLOUD_BACKUP_MOCK_OUTCOME as CloudBackupProviderOutcome | undefined) ?? "SUCCESS";
  const head = (objectKey: string, bytes: Buffer): CloudBackupObjectHead => ({
    objectKey,
    objectIdSafe: `mock-${objectKey.split("/")[2].replace(".npsbackup", "")}`,
    versionSafe: "mock-v1",
    byteSize: bytes.length
  });
  return {
    kind: "MOCK",
    mode: "QA",
    async healthCheck() {
      return { ready: true, safeMessage: "Deterministic in-process MOCK storage is ready. No external network is used." };
    },
    async putObject(objectKey, bytes) {
      validateSafeObjectKey(objectKey);
      if (outcome() === "TIMEOUT") throw new CloudBackupProviderError("PROVIDER_TIMEOUT", "MOCK provider request timed out.", true);
      if (outcome() === "TRANSIENT_UPLOAD_FAILURE") throw new CloudBackupProviderError("UPLOAD_TRANSIENT", "MOCK provider transient upload failure.", true);
      if (outcome() === "PERMANENT_UPLOAD_FAILURE") throw new CloudBackupProviderError("UPLOAD_REJECTED", "MOCK provider permanently rejected the upload.");
      if (!storage.has(objectKey)) storage.set(objectKey, Buffer.from(bytes));
      return head(objectKey, storage.get(objectKey)!);
    },
    async headObject(objectKey) {
      validateSafeObjectKey(objectKey);
      if (outcome() === "OBJECT_MISSING") return null;
      const bytes = storage.get(objectKey);
      return bytes ? head(objectKey, bytes) : null;
    },
    async getObject(objectKey) {
      validateSafeObjectKey(objectKey);
      if (outcome() === "TIMEOUT") throw new CloudBackupProviderError("PROVIDER_TIMEOUT", "MOCK provider read timed out.", true);
      if (outcome() === "OBJECT_MISSING") throw new CloudBackupProviderError("OBJECT_MISSING", "MOCK encrypted object is missing.");
      const original = storage.get(objectKey);
      if (!original) throw new CloudBackupProviderError("OBJECT_MISSING", "MOCK encrypted object is missing.");
      if (outcome() === "TRUNCATED_READBACK") return Buffer.from(original.subarray(0, Math.max(1, original.length - 13)));
      if (outcome() === "CORRUPT_CIPHERTEXT") {
        const corrupt = Buffer.from(original);
        corrupt[corrupt.length - 1] ^= 0xff;
        return corrupt;
      }
      return Buffer.from(original);
    },
    async deleteObject(objectKey) {
      validateSafeObjectKey(objectKey);
      if (outcome() === "DELETE_FAILURE") throw new CloudBackupProviderError("DELETE_FAILED", "MOCK provider delete failed.", true);
      const deleted = storage.delete(objectKey);
      return { deleted, alreadyMissing: !deleted };
    },
    async listObjectsBySafePrefix(prefix, limit) {
      if (!/^cloud-backup\/[a-z0-9]{0,32}$/.test(prefix) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new CloudBackupProviderError("LIST_INVALID", "MOCK provider list request is invalid.");
      }
      return [...storage.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .slice(0, limit)
        .map(([key, bytes]) => head(key, bytes));
    },
    classifyRetryability(error) {
      return error instanceof CloudBackupProviderError && error.retryable;
    },
    redactError(error) {
      return error instanceof CloudBackupProviderError
        ? { code: error.code, safeMessage: error.message }
        : { code: "MOCK_FAILURE", safeMessage: "MOCK provider operation failed." };
    }
  };
}
