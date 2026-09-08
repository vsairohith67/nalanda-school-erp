export const CURRENT_CLOUD_BACKUP_VERSION = 46;
export const SUPPORTED_STORED_CLOUD_BACKUP_VERSIONS = [43, 44, 45, CURRENT_CLOUD_BACKUP_VERSION] as const;

export function isSupportedStoredCloudBackupVersion(value: number | undefined) {
  return typeof value === "number" && (SUPPORTED_STORED_CLOUD_BACKUP_VERSIONS as readonly number[]).includes(value);
}
