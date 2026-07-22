import {
  CloudBackupProviderError,
  type CloudBackupProvider,
  type CloudBackupProviderKind
} from "@/lib/cloud-backup-provider";

function disabled(kind: CloudBackupProviderKind, liveUseEnabled: boolean): CloudBackupProvider {
  const fail = () => {
    const detail = liveUseEnabled
      ? "LIVE activation remains blocked pending exact provider documentation, SDK, identity and deletion review."
      : "LIVE use is disabled.";
    throw new CloudBackupProviderError("LIVE_PROVIDER_DISABLED", `${kind} provider is unavailable. ${detail}`);
  };
  return {
    kind,
    mode: "LIVE_DISABLED",
    async healthCheck() {
      return { ready: false, safeMessage: `${kind} is disabled. No external network call was made.` };
    },
    async putObject() { return fail(); },
    async headObject() { return fail(); },
    async getObject() { return fail(); },
    async deleteObject() { return fail(); },
    async listObjectsBySafePrefix() { return fail(); },
    classifyRetryability() { return false; },
    redactError() {
      return { code: "LIVE_PROVIDER_DISABLED", safeMessage: `${kind} provider is disabled. No external network call was made.` };
    }
  };
}

export function createDisabledObjectStorageCloudBackupProvider(liveUseEnabled: boolean) {
  return disabled("OBJECT_STORAGE", liveUseEnabled);
}

export function createDisabledGoogleDriveCloudBackupProvider(liveUseEnabled: boolean) {
  return disabled("GOOGLE_DRIVE", liveUseEnabled);
}
