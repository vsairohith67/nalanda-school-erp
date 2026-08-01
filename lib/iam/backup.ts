import { isRole, normalizePermission } from "@/lib/permissions";

export type IamBackupRecord = Record<string, unknown>;
export type IamAccessBackup = {
  userStates: IamBackupRecord[];
  roleAssignments: IamBackupRecord[];
  profiles: IamBackupRecord[];
  profileEntries: IamBackupRecord[];
  profileVersions: IamBackupRecord[];
  profileAssignments: IamBackupRecord[];
  overrides: IamBackupRecord[];
  audits: IamBackupRecord[];
};

const ROOT_KEYS = new Set<keyof IamAccessBackup>(["userStates", "roleAssignments", "profiles", "profileEntries", "profileVersions", "profileAssignments", "overrides", "audits"]);
const KEYS: Record<keyof IamAccessBackup, Set<string>> = {
  userStates: new Set(["userId", "iamPublicKey", "designation", "lifecycleStatus", "isActive", "authorizationVersion", "mustChangePassword", "temporaryPasswordExpiresAt", "suspensionReason", "version"]),
  roleAssignments: new Set(["id", "publicKey", "userId", "role", "status", "validFrom", "validUntil", "reason", "assignedByUserId", "endedByUserId", "endedAt", "version", "contextVersion", "activeKey", "createdAt", "updatedAt"]),
  profiles: new Set(["id", "publicKey", "name", "normalizedName", "description", "status", "version", "createdByUserId", "updatedByUserId", "archivedAt", "createdAt", "updatedAt"]),
  profileEntries: new Set(["id", "profileId", "permission", "effect", "status", "validFrom", "validUntil", "reason", "createdByUserId", "revokedByUserId", "revokedAt", "supersedesId", "version", "activeKey", "createdAt"]),
  profileVersions: new Set(["id", "profileId", "versionNumber", "snapshotJson", "reason", "createdByUserId", "createdAt"]),
  profileAssignments: new Set(["id", "publicKey", "userId", "profileId", "status", "validFrom", "validUntil", "reason", "assignedByUserId", "endedByUserId", "endedAt", "version", "activeKey", "createdAt", "updatedAt"]),
  overrides: new Set(["id", "publicKey", "userId", "permission", "effect", "status", "validFrom", "validUntil", "reason", "createdByUserId", "revokedByUserId", "revokedAt", "supersedesId", "version", "activeKey", "createdAt"]),
  audits: new Set(["id", "action", "actorUserId", "actorName", "targetUserId", "detailsJson", "createdAt"])
};

export function createIamAccessBackup(input?: Partial<Record<keyof IamAccessBackup, readonly object[]>>): IamAccessBackup {
  return Object.fromEntries([...ROOT_KEYS].map((key) => [key, sanitizeRows(input?.[key], KEYS[key])])) as IamAccessBackup;
}

export function iamAccessRecordCount(value: IamAccessBackup) {
  return Object.values(value).reduce((total, rows) => total + rows.length, 0);
}

export function validateIamAccessBackup(input: unknown, userIds: Set<string>): IamAccessBackup {
  if (input === undefined) return createIamAccessBackup();
  const root = record(input, "iamAccess");
  rejectUnknown(root, ROOT_KEYS as Set<string>, "iamAccess");
  const value = Object.fromEntries([...ROOT_KEYS].map((key) => [key, rows(root[key], `iamAccess.${key}`, KEYS[key])])) as IamAccessBackup;
  const profileIds = uniqueIds(value.profiles, "iamAccess.profiles");
  const roleIds = uniqueIds(value.roleAssignments, "iamAccess.roleAssignments");
  void roleIds;
  uniqueIds(value.profileEntries, "iamAccess.profileEntries");
  uniqueIds(value.profileVersions, "iamAccess.profileVersions");
  uniqueIds(value.profileAssignments, "iamAccess.profileAssignments");
  uniqueIds(value.overrides, "iamAccess.overrides");
  uniqueIds(value.audits, "iamAccess.audits");
  for (const [index, row] of value.userStates.entries()) requireUser(row.userId, userIds, `iamAccess.userStates[${index}].userId`);
  for (const [index, row] of value.roleAssignments.entries()) {
    const prefix = `iamAccess.roleAssignments[${index}]`;
    requireUser(row.userId, userIds, `${prefix}.userId`);
    if (!isRole(text(row.role, `${prefix}.role`))) throw new Error(`${prefix}.role is unsupported`);
    if (!["ACTIVE", "ENDED", "REVOKED"].includes(text(row.status, `${prefix}.status`))) throw new Error(`${prefix}.status is unsupported`);
  }
  for (const group of [value.profileEntries, value.profileVersions]) for (const [index, row] of group.entries()) if (!profileIds.has(text(row.profileId, `iamAccess profile row ${index}.profileId`))) throw new Error("IAM profile row does not match a backup profile");
  for (const [index, row] of value.profileAssignments.entries()) {
    requireUser(row.userId, userIds, `iamAccess.profileAssignments[${index}].userId`);
    if (!profileIds.has(text(row.profileId, `iamAccess.profileAssignments[${index}].profileId`))) throw new Error("IAM profile assignment does not match a backup profile");
  }
  for (const group of [value.profileEntries, value.overrides]) for (const [index, row] of group.entries()) {
    const permission = normalizePermission(text(row.permission, `iamAccess permission row ${index}`));
    if (!permission) throw new Error("IAM backup contains an unknown permission");
    if (!["ALLOW", "DENY"].includes(text(row.effect, `iamAccess effect row ${index}`))) throw new Error("IAM backup contains an invalid permission effect");
    if (group === value.overrides) requireUser(row.userId, userIds, `iamAccess.overrides[${index}].userId`);
  }
  for (const [index, row] of value.audits.entries()) {
    if (!text(row.action, `iamAccess.audits[${index}].action`).startsWith("IAM_")) throw new Error("IAM backup audit is outside the IAM namespace");
    requireUser(row.actorUserId, userIds, `iamAccess.audits[${index}].actorUserId`);
    if (row.targetUserId != null) requireUser(row.targetUserId, userIds, `iamAccess.audits[${index}].targetUserId`);
  }
  if (/passwordHash|tokenHash|codeHash|secret/i.test(JSON.stringify(value))) throw new Error("IAM backup contains prohibited credential material");
  return value;
}

function sanitizeRows(input: readonly object[] | undefined, allowed: Set<string>) { return (input ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)))); }
function rows(input: unknown, label: string, allowed: Set<string>) { if (input === undefined) return []; if (!Array.isArray(input) || input.length > 100_000) throw new Error(`${label} must be a bounded array`); return input.map((row, index) => { const value = record(row, `${label}[${index}]`); rejectUnknown(value, allowed, `${label}[${index}]`); return value; }); }
function record(input: unknown, label: string): IamBackupRecord { if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be an object`); return input as IamBackupRecord; }
function rejectUnknown(row: IamBackupRecord, allowed: Set<string>, label: string) { for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`${label}.${key} is not supported`); }
function text(value: unknown, label: string) { if (typeof value !== "string" || !value.trim() || value.length > 10_000) throw new Error(`${label} is invalid`); return value; }
function uniqueIds(value: IamBackupRecord[], label: string) { const ids = new Set<string>(); value.forEach((row, index) => { const id = text(row.id, `${label}[${index}].id`); if (ids.has(id)) throw new Error(`${label}[${index}].id is duplicated`); ids.add(id); }); return ids; }
function requireUser(value: unknown, userIds: Set<string>, label: string) { if (!userIds.has(text(value, label))) throw new Error(`${label} does not match a backup user`); }
