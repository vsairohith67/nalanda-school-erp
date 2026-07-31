export type AuthBackupRecord = Record<string, unknown>;

export type AuthSecurityBackup = {
  aliases: AuthBackupRecord[];
  verificationHistory: AuthBackupRecord[];
  resetHistory: AuthBackupRecord[];
  sessions: AuthBackupRecord[];
  events: AuthBackupRecord[];
};

const AUTH_SECURITY_KEYS = new Set(["aliases", "verificationHistory", "resetHistory", "sessions", "events"]);
const ALIAS_KEYS = new Set(["id", "userId", "type", "normalizedValue", "displayMasked", "status", "isSchoolGoverned", "admissionStudentId", "verifiedAt", "removedAt", "version", "createdAt", "updatedAt"]);
const VERIFICATION_KEYS = new Set(["id", "aliasId", "userId", "purpose", "credentialVersion", "attempts", "maxAttempts", "expiresAt", "usedAt", "invalidatedAt", "createdAt"]);
const RESET_KEYS = new Set(["id", "userId", "aliasId", "channelType", "purpose", "credentialVersion", "attempts", "maxAttempts", "expiresAt", "usedAt", "invalidatedAt", "invalidationReason", "createdAt"]);
const SESSION_KEYS = new Set(["id", "userId", "credentialVersion", "createdAt", "lastSeenAt", "expiresAt", "revokedAt", "revocationReason", "deviceSummary", "browserSummary", "networkEvidenceMasked", "version"]);
const EVENT_KEYS = new Set(["id", "userId", "actorUserId", "eventType", "subjectType", "subjectId", "detailsJson", "createdAt"]);

export function createAuthSecurityBackup(input?: Partial<Record<keyof AuthSecurityBackup, readonly object[]>>): AuthSecurityBackup {
  return {
    aliases: sanitizeRows(input?.aliases, ALIAS_KEYS),
    verificationHistory: sanitizeRows(input?.verificationHistory, VERIFICATION_KEYS),
    resetHistory: sanitizeRows(input?.resetHistory, RESET_KEYS),
    sessions: sanitizeRows(input?.sessions, SESSION_KEYS),
    events: sanitizeRows(input?.events, EVENT_KEYS)
  };
}

export function validateAuthSecurityBackup(
  input: unknown,
  references: { userIds: Set<string>; studentIds: Set<string> }
): AuthSecurityBackup {
  if (input === undefined) return createAuthSecurityBackup();
  const root = record(input, "authSecurity");
  rejectUnknown(root, AUTH_SECURITY_KEYS, "authSecurity");
  const aliases = rows(root.aliases, "authSecurity.aliases", ALIAS_KEYS);
  const aliasIds = new Set<string>();
  const normalizedValues = new Set<string>();
  for (const [index, row] of aliases.entries()) {
    const prefix = `authSecurity.aliases[${index}]`;
    const id = text(row.id, `${prefix}.id`);
    const userId = text(row.userId, `${prefix}.userId`);
    const normalizedValue = text(row.normalizedValue, `${prefix}.normalizedValue`);
    if (aliasIds.has(id) || normalizedValues.has(normalizedValue)) throw new Error(`${prefix} duplicates an alias identity or normalized value`);
    if (!references.userIds.has(userId)) throw new Error(`${prefix}.userId does not match a backup user`);
    if (row.admissionStudentId != null && !references.studentIds.has(text(row.admissionStudentId, `${prefix}.admissionStudentId`))) {
      throw new Error(`${prefix}.admissionStudentId does not match a backup student`);
    }
    if (!["USERNAME", "WORK_EMAIL", "PERSONAL_EMAIL", "MOBILE", "ADMISSION_NUMBER"].includes(text(row.type, `${prefix}.type`))) throw new Error(`${prefix}.type is unsupported`);
    if (!["PENDING", "VERIFIED", "REMOVED"].includes(text(row.status, `${prefix}.status`))) throw new Error(`${prefix}.status is unsupported`);
    if (typeof row.isSchoolGoverned !== "boolean") throw new Error(`${prefix}.isSchoolGoverned must be a boolean`);
    positiveInteger(row.version, `${prefix}.version`);
    aliasIds.add(id);
    normalizedValues.add(normalizedValue);
  }
  const verificationHistory = historyRows(root.verificationHistory, "authSecurity.verificationHistory", VERIFICATION_KEYS, aliasIds, references.userIds);
  const resetHistory = historyRows(root.resetHistory, "authSecurity.resetHistory", RESET_KEYS, aliasIds, references.userIds);
  const sessions = rows(root.sessions, "authSecurity.sessions", SESSION_KEYS);
  uniqueRows(sessions, "authSecurity.sessions", (row, prefix) => {
    if (!references.userIds.has(text(row.userId, `${prefix}.userId`))) throw new Error(`${prefix}.userId does not match a backup user`);
    positiveInteger(row.credentialVersion, `${prefix}.credentialVersion`);
    positiveInteger(row.version, `${prefix}.version`);
  });
  const events = rows(root.events, "authSecurity.events", EVENT_KEYS);
  uniqueRows(events, "authSecurity.events", (row, prefix) => {
    if (row.userId != null && !references.userIds.has(text(row.userId, `${prefix}.userId`))) throw new Error(`${prefix}.userId does not match a backup user`);
    if (row.actorUserId != null && !references.userIds.has(text(row.actorUserId, `${prefix}.actorUserId`))) throw new Error(`${prefix}.actorUserId does not match a backup user`);
    text(row.eventType, `${prefix}.eventType`);
  });
  return { aliases, verificationHistory, resetHistory, sessions, events };
}

export function authSecurityRecordCount(value: AuthSecurityBackup) {
  return value.aliases.length + value.verificationHistory.length + value.resetHistory.length + value.sessions.length + value.events.length;
}

function sanitizeRows(input: readonly object[] | undefined, allowed: Set<string>) {
  return (input ?? []).map((value) => Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key))));
}

function historyRows(input: unknown, label: string, allowed: Set<string>, aliasIds: Set<string>, userIds: Set<string>) {
  const value = rows(input, label, allowed);
  uniqueRows(value, label, (row, prefix) => {
    if (!aliasIds.has(text(row.aliasId, `${prefix}.aliasId`))) throw new Error(`${prefix}.aliasId does not match a backup alias`);
    if (!userIds.has(text(row.userId, `${prefix}.userId`))) throw new Error(`${prefix}.userId does not match a backup user`);
    positiveInteger(row.credentialVersion, `${prefix}.credentialVersion`);
    nonNegativeInteger(row.attempts, `${prefix}.attempts`);
    positiveInteger(row.maxAttempts, `${prefix}.maxAttempts`);
  });
  return value;
}

function uniqueRows(value: AuthBackupRecord[], label: string, validate: (row: AuthBackupRecord, prefix: string) => void) {
  const ids = new Set<string>();
  value.forEach((row, index) => {
    const prefix = `${label}[${index}]`;
    const id = text(row.id, `${prefix}.id`);
    if (ids.has(id)) throw new Error(`${prefix}.id is duplicated`);
    ids.add(id);
    validate(row, prefix);
  });
}

function rows(input: unknown, label: string, allowed: Set<string>) {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 100_000) throw new Error(`${label} must be a bounded array`);
  return input.map((value, index) => {
    const row = record(value, `${label}[${index}]`);
    rejectUnknown(row, allowed, `${label}[${index}]`);
    return row;
  });
}

function record(input: unknown, label: string): AuthBackupRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be an object`);
  return input as AuthBackupRecord;
}

function rejectUnknown(row: AuthBackupRecord, allowed: Set<string>, label: string) {
  for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`${label}.${key} is not supported`);
}

function text(input: unknown, label: string) {
  if (typeof input !== "string" || !input.trim() || input.length > 500) throw new Error(`${label} is invalid`);
  return input;
}

function positiveInteger(input: unknown, label: string) {
  if (!Number.isInteger(input) || Number(input) < 1) throw new Error(`${label} must be a positive integer`);
}

function nonNegativeInteger(input: unknown, label: string) {
  if (!Number.isInteger(input) || Number(input) < 0) throw new Error(`${label} must be a non-negative integer`);
}
