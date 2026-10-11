export const CURRENT_CLOUD_BACKUP_VERSION = 48;
export const SUPPORTED_STORED_CLOUD_BACKUP_VERSIONS = [45, 46, 47, CURRENT_CLOUD_BACKUP_VERSION] as const;

export function isSupportedStoredCloudBackupVersion(value: number | undefined) {
  return typeof value === "number" && (SUPPORTED_STORED_CLOUD_BACKUP_VERSIONS as readonly number[]).includes(value);
}
