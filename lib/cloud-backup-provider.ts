import type { CloudBackupProfile } from "@prisma/client";
import { createMockCloudBackupProvider } from "@/lib/cloud-backup-provider-mock";
import { createLocalFolderCloudBackupProvider } from "@/lib/cloud-backup-provider-local";
import {
  createDisabledGoogleDriveCloudBackupProvider,
  createDisabledObjectStorageCloudBackupProvider
} from "@/lib/cloud-backup-provider-disabled";

export type CloudBackupProviderKind = "MOCK" | "LOCAL_FOLDER" | "OBJECT_STORAGE" | "GOOGLE_DRIVE";
export type CloudBackupProviderOutcome =
  | "SUCCESS"
  | "TRANSIENT_UPLOAD_FAILURE"
  | "PERMANENT_UPLOAD_FAILURE"
  | "TRUNCATED_READBACK"
  | "CORRUPT_CIPHERTEXT"
  | "OBJECT_MISSING"
  | "TIMEOUT"
  | "DELETE_FAILURE";

export type CloudBackupObjectHead = {
  objectKey: string;
  objectIdSafe: string;
  versionSafe: string | null;
  byteSize: number;
};

export interface CloudBackupProvider {
  readonly kind: CloudBackupProviderKind;
  readonly mode: "QA" | "LIVE_DISABLED";
  healthCheck(): Promise<{ ready: boolean; safeMessage: string }>;
  putObject(objectKey: string, bytes: Buffer): Promise<CloudBackupObjectHead>;
  headObject(objectKey: string): Promise<CloudBackupObjectHead | null>;
  getObject(objectKey: string): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<{ deleted: boolean; alreadyMissing: boolean }>;
  listObjectsBySafePrefix(prefix: string, limit: number): Promise<CloudBackupObjectHead[]>;
  classifyRetryability(error: unknown): boolean;
  redactError(error: unknown): { code: string; safeMessage: string };
}

export class CloudBackupProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "CloudBackupProviderError";
  }
}

export function createCloudBackupProvider(
  profile: Pick<CloudBackupProfile, "providerKind" | "liveUseEnabled" | "requestTimeoutMs">
): CloudBackupProvider {
  switch (profile.providerKind as CloudBackupProviderKind) {
    case "MOCK":
      return createMockCloudBackupProvider();
    case "LOCAL_FOLDER":
      return createLocalFolderCloudBackupProvider(profile.requestTimeoutMs);
    case "OBJECT_STORAGE":
      return createDisabledObjectStorageCloudBackupProvider(profile.liveUseEnabled);
    case "GOOGLE_DRIVE":
      return createDisabledGoogleDriveCloudBackupProvider(profile.liveUseEnabled);
    default:
      throw new CloudBackupProviderError("PROVIDER_UNSUPPORTED", "Cloud backup provider kind is unsupported.");
  }
}

export function validateSafeObjectKey(objectKey: string) {
  if (!/^cloud-backup\/[a-z0-9]{20,32}\/[a-z0-9]{20,32}\.npsbackup$/.test(objectKey)) {
    throw new CloudBackupProviderError("OBJECT_KEY_INVALID", "Encrypted backup object identity is invalid.");
  }
  return objectKey;
}

export function safeProviderError(error: unknown) {
  if (error instanceof CloudBackupProviderError) {
    return { code: error.code, safeMessage: error.message, retryable: error.retryable };
  }
  return { code: "PROVIDER_FAILURE", safeMessage: "The encrypted backup provider operation failed.", retryable: false };
}
