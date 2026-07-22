type Row = Record<string, unknown>;

const PROVIDERS = new Set(["MOCK", "LOCAL_FOLDER", "OBJECT_STORAGE", "GOOGLE_DRIVE"]);
const PROFILE_STATUSES = new Set(["DRAFT", "CONFIGURED", "ACTIVE", "PAUSED", "DISABLED"]);
const RUN_STATUSES = new Set(["PENDING", "CREATING_BACKUP", "VALIDATING", "COMPRESSING", "ENCRYPTING", "UPLOADING", "VERIFYING", "VERIFIED", "FAILED", "CANCELLED"]);
const ARTIFACT_STATUSES = new Set(["CREATED", "ENCRYPTED", "UPLOADED", "VERIFIED", "CORRUPT", "MISSING", "PRUNED"]);
const SHA256 = /^[a-f0-9]{64}$/;
const KEY_VERSION = /^V[1-9][0-9]{0,2}$/;
const FORBIDDEN_KEY = /^(credential|credentials|secret|token|accessToken|refreshToken|encryptionKey|objectBody|decryptedPayload|absolutePath)$/i;

export function validateCloudBackupBackupRows(root: Record<string, unknown>) {
  const cloudBackupProfiles = rows(root.cloudBackupProfiles, "cloudBackupProfiles");
  const cloudBackupSchedules = rows(root.cloudBackupSchedules, "cloudBackupSchedules");
  const cloudBackupRetentionPolicies = rows(root.cloudBackupRetentionPolicies, "cloudBackupRetentionPolicies");
  const cloudBackupRuns = rows(root.cloudBackupRuns, "cloudBackupRuns");
  const cloudBackupArtifacts = rows(root.cloudBackupArtifacts, "cloudBackupArtifacts");
  const cloudBackupVerifications = rows(root.cloudBackupVerifications, "cloudBackupVerifications");
  const cloudBackupRestoreRehearsals = rows(root.cloudBackupRestoreRehearsals, "cloudBackupRestoreRehearsals");
  const cloudBackupEvents = rows(root.cloudBackupEvents, "cloudBackupEvents");

  const profileIds = unique(cloudBackupProfiles, "profileCode", "cloud backup profile");
  cloudBackupProfiles.forEach((row, index) => {
    required(row.id, `cloudBackupProfiles[${index}].id`);
    if (!PROVIDERS.has(required(row.providerKind, `cloudBackupProfiles[${index}].providerKind`))) throw new Error(`cloudBackupProfiles[${index}].providerKind is unsupported`);
    if (!PROFILE_STATUSES.has(required(row.status, `cloudBackupProfiles[${index}].status`))) throw new Error(`cloudBackupProfiles[${index}].status is unsupported`);
    keyVersion(row.encryptionKeyVersion, `cloudBackupProfiles[${index}].encryptionKeyVersion`);
  });

  const scheduleIds = unique(cloudBackupSchedules, "scheduleCode", "cloud backup schedule");
  cloudBackupSchedules.forEach((row, index) => {
    link(row.profileId, profileIds, `cloudBackupSchedules[${index}].profileId`);
    if (!["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "MANUAL_ONLY"].includes(required(row.frequency, `cloudBackupSchedules[${index}].frequency`))) throw new Error(`cloudBackupSchedules[${index}].frequency is unsupported`);
    if (row.timezone !== "Asia/Kolkata") throw new Error(`cloudBackupSchedules[${index}].timezone is unsupported`);
  });

  unique(cloudBackupRetentionPolicies, "policyCode", "cloud backup retention policy");
  cloudBackupRetentionPolicies.forEach((row, index) => {
    link(row.profileId, profileIds, `cloudBackupRetentionPolicies[${index}].profileId`);
    if (integer(row.keepLatestVerifiedCount, 2) < 2 || integer(row.minimumVerifiedCopies, 2) < 2) throw new Error(`cloudBackupRetentionPolicies[${index}] weakens minimum verified-copy protection`);
  });

  const runIds = unique(cloudBackupRuns, "runNumber", "cloud backup run");
  const idempotency = new Set<string>();
  cloudBackupRuns.forEach((row, index) => {
    link(row.profileId, profileIds, `cloudBackupRuns[${index}].profileId`);
    if (row.scheduleId != null) link(row.scheduleId, scheduleIds, `cloudBackupRuns[${index}].scheduleId`);
    if (!RUN_STATUSES.has(required(row.status, `cloudBackupRuns[${index}].status`))) throw new Error(`cloudBackupRuns[${index}].status is unsupported`);
    const key = required(row.idempotencyKey, `cloudBackupRuns[${index}].idempotencyKey`);
    if (idempotency.has(key)) throw new Error("cloudBackupRuns duplicates an idempotency key");
    idempotency.add(key);
    optionalHash(row.sourcePlaintextSha256, `cloudBackupRuns[${index}].sourcePlaintextSha256`);
    optionalHash(row.ciphertextSha256, `cloudBackupRuns[${index}].ciphertextSha256`);
    if (row.encryptionKeyVersion != null) keyVersion(row.encryptionKeyVersion, `cloudBackupRuns[${index}].encryptionKeyVersion`);
  });

  const artifactIds = unique(cloudBackupArtifacts, "objectKeySafe", "cloud backup artifact");
  cloudBackupArtifacts.forEach((row, index) => {
    link(row.runId, runIds, `cloudBackupArtifacts[${index}].runId`);
    if (row.artifactType !== "DATABASE_BACKUP") throw new Error(`cloudBackupArtifacts[${index}].artifactType is unsupported`);
    if (!ARTIFACT_STATUSES.has(required(row.status, `cloudBackupArtifacts[${index}].status`))) throw new Error(`cloudBackupArtifacts[${index}].status is unsupported`);
    keyVersion(row.encryptionKeyVersion, `cloudBackupArtifacts[${index}].encryptionKeyVersion`);
    hash(row.plaintextSha256, `cloudBackupArtifacts[${index}].plaintextSha256`);
    hash(row.ciphertextSha256, `cloudBackupArtifacts[${index}].ciphertextSha256`);
    const coverage = required(row.sourceCoverageJson, `cloudBackupArtifacts[${index}].sourceCoverageJson`);
    try { JSON.parse(coverage); } catch { throw new Error(`cloudBackupArtifacts[${index}].sourceCoverageJson is invalid`); }
  });

  uniqueIds(cloudBackupVerifications, "cloud backup verification");
  cloudBackupVerifications.forEach((row, index) => {
    link(row.runId, runIds, `cloudBackupVerifications[${index}].runId`);
    link(row.artifactId, artifactIds, `cloudBackupVerifications[${index}].artifactId`);
  });
  const rehearsalIds = unique(cloudBackupRestoreRehearsals, "rehearsalNumber", "cloud backup restore rehearsal");
  cloudBackupRestoreRehearsals.forEach((row, index) => {
    link(row.runId, runIds, `cloudBackupRestoreRehearsals[${index}].runId`);
    link(row.artifactId, artifactIds, `cloudBackupRestoreRehearsals[${index}].artifactId`);
  });
  uniqueIds(cloudBackupEvents, "cloud backup event");
  cloudBackupEvents.forEach((row, index) => {
    if (row.profileId != null) link(row.profileId, profileIds, `cloudBackupEvents[${index}].profileId`);
    if (row.scheduleId != null) link(row.scheduleId, scheduleIds, `cloudBackupEvents[${index}].scheduleId`);
    if (row.runId != null) link(row.runId, runIds, `cloudBackupEvents[${index}].runId`);
    if (row.artifactId != null) link(row.artifactId, artifactIds, `cloudBackupEvents[${index}].artifactId`);
    if (row.rehearsalId != null) link(row.rehearsalId, rehearsalIds, `cloudBackupEvents[${index}].rehearsalId`);
  });

  return {
    cloudBackupProfiles,
    cloudBackupSchedules,
    cloudBackupRetentionPolicies,
    cloudBackupRuns,
    cloudBackupArtifacts,
    cloudBackupVerifications,
    cloudBackupRestoreRehearsals,
    cloudBackupEvents
  };
}

function rows(value: unknown, label: string): Row[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${label} must be a bounded array`);
  return value.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}[${index}] must be an object`);
    const row = value as Row;
    if (Object.keys(row).some((key) => FORBIDDEN_KEY.test(key))) throw new Error(`${label}[${index}] contains a forbidden secret or payload field`);
    return row;
  });
}

function unique(values: Row[], naturalKey: string, label: string) {
  const ids = uniqueIds(values, label);
  const naturals = new Set<string>();
  values.forEach((row, index) => {
    const value = required(row[naturalKey], `${label}[${index}].${naturalKey}`);
    if (naturals.has(value)) throw new Error(`${label} duplicates ${naturalKey}`);
    naturals.add(value);
  });
  return ids;
}

function uniqueIds(values: Row[], label: string) {
  const ids = new Set<string>();
  values.forEach((row, index) => {
    const id = required(row.id, `${label}[${index}].id`);
    if (ids.has(id)) throw new Error(`${label} duplicates id`);
    ids.add(id);
  });
  return ids;
}

function link(value: unknown, ids: Set<string>, label: string) {
  if (!ids.has(required(value, label))) throw new Error(`${label} does not match a backup record`);
}

function required(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 1000) throw new Error(`${label} is invalid`);
  return value;
}

function integer(value: unknown, fallback: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error("Cloud backup integer is invalid");
  return number;
}

function hash(value: unknown, label: string) {
  if (!SHA256.test(required(value, label))) throw new Error(`${label} is invalid`);
}

function optionalHash(value: unknown, label: string) {
  if (value != null) hash(value, label);
}

function keyVersion(value: unknown, label: string) {
  if (!KEY_VERSION.test(required(value, label))) throw new Error(`${label} is invalid`);
}
