import type { PrismaClient } from "@prisma/client";
import { databaseTableExists } from "@/lib/database-capabilities";

export const NATIVE_APP_BACKUP_KEYS = ["nativeSessions", "nativeRefreshTokenHistory"] as const;
export type NativeAppBackupKey = (typeof NATIVE_APP_BACKUP_KEYS)[number];
export type NativeAppPolicyBackup = {
  formatVersion: 1;
  nativeApiVersion: 1;
  offlineSyncSchemaVersion: 1;
  minimumSupportedAppVersion: string;
  recommendedAppVersion: string;
  allowedScopes: string[];
  featureDefaultEnabled: false;
};
export type NativeAppBackup = Record<NativeAppBackupKey, Record<string, unknown>[]> & {
  nativeAppPolicy: NativeAppPolicyBackup;
};

type EntityResult = { created: number; updated: number; skipped: number; errors: string[] };
type RestoreResult = Record<NativeAppBackupKey, EntityResult> & { warnings: string[] };

const NATIVE_SCOPES = ["offline:context", "offline:reference", "offline:sync", "offline:own-conflicts"] as const;
const SESSION_FIELDS = new Set([
  "id", "publicSessionId", "userId", "deviceId", "roleAssignmentId", "accessTokenHash", "refreshTokenHash",
  "credentialVersion", "authorizationVersion", "scopesJson", "tokenVersion", "accessExpiresAt", "refreshExpiresAt",
  "absoluteExpiresAt", "lastSeenAt", "revokedAt", "revocationReason", "createdAt", "updatedAt"
]);
const HISTORY_FIELDS = new Set(["id", "sessionId", "refreshTokenHash", "tokenVersion", "status", "rotatedAt", "reusedAt"]);
const POLICY_FIELDS = new Set([
  "formatVersion", "nativeApiVersion", "offlineSyncSchemaVersion", "minimumSupportedAppVersion", "recommendedAppVersion",
  "allowedScopes", "featureDefaultEnabled"
]);
const SESSION_REQUIRED = [
  "id", "publicSessionId", "userId", "deviceId", "roleAssignmentId", "accessTokenHash", "refreshTokenHash",
  "credentialVersion", "authorizationVersion", "scopesJson", "tokenVersion", "accessExpiresAt", "refreshExpiresAt",
  "absoluteExpiresAt", "lastSeenAt", "createdAt", "updatedAt"
];
const HISTORY_REQUIRED = ["id", "sessionId", "refreshTokenHash", "tokenVersion", "status", "rotatedAt"];

export function currentNativeAppPolicy(environment: NodeJS.ProcessEnv = process.env): NativeAppPolicyBackup {
  return {
    formatVersion: 1,
    nativeApiVersion: 1,
    offlineSyncSchemaVersion: 1,
    minimumSupportedAppVersion: semver(environment.NALANDA_NATIVE_MINIMUM_APP_VERSION ?? "0.1.0", "NALANDA_NATIVE_MINIMUM_APP_VERSION"),
    recommendedAppVersion: semver(environment.NALANDA_NATIVE_RECOMMENDED_APP_VERSION ?? "0.1.0", "NALANDA_NATIVE_RECOMMENDED_APP_VERSION"),
    allowedScopes: [...NATIVE_SCOPES],
    featureDefaultEnabled: false
  };
}

export function emptyNativeAppBackup(environment: NodeJS.ProcessEnv = process.env): NativeAppBackup {
  return { nativeSessions: [], nativeRefreshTokenHistory: [], nativeAppPolicy: currentNativeAppPolicy(environment) };
}

export async function nativeAppSchemaAvailable(client: PrismaClient) {
  try {
    if (!(client as any).nativeSession?.findMany || !(client as any).nativeRefreshTokenHistory?.findMany) return false;
    const [sessions, history] = await Promise.all([
      databaseTableExists(client, "NativeSession"),
      databaseTableExists(client, "NativeRefreshTokenHistory")
    ]);
    return sessions && history;
  } catch {
    return false;
  }
}

export async function loadNativeAppBackup(client: PrismaClient, environment: NodeJS.ProcessEnv = process.env): Promise<NativeAppBackup> {
  const [nativeSessions, nativeRefreshTokenHistory] = await Promise.all([
    client.nativeSession.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.nativeRefreshTokenHistory.findMany({ orderBy: [{ rotatedAt: "asc" }, { id: "asc" }] })
  ]);
  return { nativeSessions, nativeRefreshTokenHistory, nativeAppPolicy: currentNativeAppPolicy(environment) };
}

export function validateNativeAppBackupRows(root: Record<string, unknown>): NativeAppBackup {
  const nativeSessions = rows(root.nativeSessions, "nativeSessions", SESSION_FIELDS, SESSION_REQUIRED);
  const nativeRefreshTokenHistory = rows(root.nativeRefreshTokenHistory, "nativeRefreshTokenHistory", HISTORY_FIELDS, HISTORY_REQUIRED);
  const sessionIds = unique(nativeSessions, "nativeSessions", "id");
  unique(nativeSessions, "nativeSessions", "publicSessionId");
  unique(nativeSessions, "nativeSessions", "accessTokenHash");
  unique(nativeSessions, "nativeSessions", "refreshTokenHash");
  const deviceIds = new Set(rows(root.offlineSyncDevices, "offlineSyncDevices", new Set(["id"]), ["id"], true).map((row) => text(row.id)));

  for (const [index, row] of nativeSessions.entries()) {
    const prefix = `nativeSessions[${index}]`;
    if (!deviceIds.has(text(row.deviceId))) throw new Error(`${prefix}.deviceId does not match a backed-up device`);
    if (!/^[0-9a-f-]{36}$/i.test(text(row.publicSessionId))) throw new Error(`${prefix}.publicSessionId is invalid`);
    for (const field of ["accessTokenHash", "refreshTokenHash"]) hash(row[field], `${prefix}.${field}`);
    positiveInteger(row.credentialVersion, `${prefix}.credentialVersion`);
    positiveInteger(row.authorizationVersion, `${prefix}.authorizationVersion`);
    positiveInteger(row.tokenVersion, `${prefix}.tokenVersion`);
    const scopes = parseJsonArray(row.scopesJson, `${prefix}.scopesJson`);
    if (scopes.length !== NATIVE_SCOPES.length || new Set(scopes).size !== scopes.length || scopes.some((scope) => !NATIVE_SCOPES.includes(scope as (typeof NATIVE_SCOPES)[number]))) {
      throw new Error(`${prefix}.scopesJson is outside the approved native scope set`);
    }
    if ((row.revokedAt == null) !== (row.revocationReason == null)) throw new Error(`${prefix} must preserve revocation time and reason together`);
  }

  unique(nativeRefreshTokenHistory, "nativeRefreshTokenHistory", "id");
  unique(nativeRefreshTokenHistory, "nativeRefreshTokenHistory", "refreshTokenHash");
  for (const [index, row] of nativeRefreshTokenHistory.entries()) {
    const prefix = `nativeRefreshTokenHistory[${index}]`;
    if (!sessionIds.has(text(row.sessionId))) throw new Error(`${prefix}.sessionId does not match a backed-up native session`);
    hash(row.refreshTokenHash, `${prefix}.refreshTokenHash`);
    positiveInteger(row.tokenVersion, `${prefix}.tokenVersion`);
    if (!["ROTATED", "REUSED"].includes(text(row.status))) throw new Error(`${prefix}.status is unsupported`);
    if ((text(row.status) === "REUSED") !== (row.reusedAt != null)) throw new Error(`${prefix} must preserve reuse status and time together`);
  }

  return {
    nativeSessions,
    nativeRefreshTokenHistory,
    nativeAppPolicy: validateNativeAppPolicy(root.nativeAppPolicy)
  };
}

export async function restoreNativeAppBackup(
  client: PrismaClient,
  backup: NativeAppBackup,
  maps: { users: Map<string, string> },
  result: RestoreResult
) {
  const restoredSessions = new Set<string>();
  for (const [index, row] of backup.nativeSessions.entries()) {
    try {
      const id = text(row.id);
      const publicSessionId = text(row.publicSessionId);
      const userId = maps.users.get(text(row.userId));
      if (!userId) {
        result.nativeSessions.skipped += 1;
        result.warnings.push(`Native session ${index + 1} was skipped because its exact user identity is unavailable.`);
        continue;
      }
      const existing = await client.nativeSession.findFirst({ where: { OR: [{ id }, { publicSessionId }, { accessTokenHash: text(row.accessTokenHash) }, { refreshTokenHash: text(row.refreshTokenHash) }] } });
      if (existing) {
        if (existing.id === id && existing.publicSessionId === publicSessionId && existing.userId === userId && existing.accessTokenHash === text(row.accessTokenHash) && existing.refreshTokenHash === text(row.refreshTokenHash) && existing.deviceId === text(row.deviceId) && existing.roleAssignmentId === text(row.roleAssignmentId)) {
          if (row.revokedAt != null && existing.revokedAt == null) {
            await client.nativeSession.update({ where: { id }, data: { revokedAt: new Date(String(row.revokedAt)), revocationReason: text(row.revocationReason) } });
            result.nativeSessions.updated += 1;
          } else {
            result.nativeSessions.skipped += 1;
          }
          restoredSessions.add(id);
        } else {
          throw new Error("native session identity collision");
        }
        continue;
      }
      const deviceId = text(row.deviceId);
      const roleAssignmentId = text(row.roleAssignmentId);
      const [device, assignment] = await Promise.all([
        client.offlineSyncDevice.findUnique({ where: { id: deviceId }, select: { id: true, userId: true } }),
        client.userRoleAssignment.findUnique({ where: { id: roleAssignmentId }, select: { id: true, userId: true } })
      ]);
      if (!device || device.userId !== userId || !assignment || assignment.userId !== userId) {
        result.nativeSessions.skipped += 1;
        result.warnings.push(`Native session ${index + 1} was skipped because its exact device or role binding is unavailable.`);
        continue;
      }
      const restoredRevokedAt = row.revokedAt ?? row.updatedAt;
      const restoredRevocationReason = row.revocationReason ?? "RESTORED_CREDENTIAL_REQUIRES_REAUTHORIZATION";
      await client.nativeSession.create({
        data: {
          ...dates(row, ["accessExpiresAt", "refreshExpiresAt", "absoluteExpiresAt", "lastSeenAt", "revokedAt", "createdAt", "updatedAt"]),
          userId,
          deviceId,
          roleAssignmentId,
          revokedAt: new Date(String(restoredRevokedAt)),
          revocationReason: text(restoredRevocationReason)
        }
      } as never);
      restoredSessions.add(id);
      result.nativeSessions.created += 1;
    } catch (error) {
      result.nativeSessions.errors.push(errorText("Native session", index, error));
    }
  }

  for (const [index, row] of backup.nativeRefreshTokenHistory.entries()) {
    try {
      const id = text(row.id);
      const sessionId = text(row.sessionId);
      if (!restoredSessions.has(sessionId)) {
        result.nativeRefreshTokenHistory.skipped += 1;
        continue;
      }
      const existing = await client.nativeRefreshTokenHistory.findFirst({ where: { OR: [{ id }, { refreshTokenHash: text(row.refreshTokenHash) }] } });
      if (existing) {
        if (existing.id !== id || existing.refreshTokenHash !== text(row.refreshTokenHash) || existing.sessionId !== sessionId) throw new Error("native refresh-history identity collision");
        if (text(row.status) === "REUSED" && existing.status !== "REUSED") {
          await client.nativeRefreshTokenHistory.update({ where: { id }, data: { status: "REUSED", reusedAt: new Date(String(row.reusedAt)) } });
          result.nativeRefreshTokenHistory.updated += 1;
        } else {
          result.nativeRefreshTokenHistory.skipped += 1;
        }
        continue;
      }
      await client.nativeRefreshTokenHistory.create({ data: dates(row, ["rotatedAt", "reusedAt"]) } as never);
      result.nativeRefreshTokenHistory.created += 1;
    } catch (error) {
      result.nativeRefreshTokenHistory.errors.push(errorText("Native refresh history", index, error));
    }
  }
  result.warnings.push(
    `Native app policy snapshot ${backup.nativeAppPolicy.minimumSupportedAppVersion}/${backup.nativeAppPolicy.recommendedAppVersion} was validated; deployment configuration remains authoritative and cannot be lowered by restore.`
  );
  result.warnings.push("Restored native sessions are always revoked and require fresh browser authorization; restore can never reactivate an access or refresh credential.");
  result.warnings.push("Raw authorization codes, raw access/refresh tokens, device private keys, local content keys and local encrypted databases are intentionally excluded from backup and restore.");
}

function validateNativeAppPolicy(value: unknown): NativeAppPolicyBackup {
  if (value === undefined) return currentNativeAppPolicy({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("nativeAppPolicy must be an object");
  const row = value as Record<string, unknown>;
  for (const key of Object.keys(row)) if (!POLICY_FIELDS.has(key)) throw new Error(`nativeAppPolicy.${key} is unsupported`);
  if (row.formatVersion !== 1 || row.nativeApiVersion !== 1 || row.offlineSyncSchemaVersion !== 1 || row.featureDefaultEnabled !== false) throw new Error("nativeAppPolicy changes a fixed foundation invariant");
  const scopes = row.allowedScopes;
  if (!Array.isArray(scopes) || scopes.length !== NATIVE_SCOPES.length || new Set(scopes).size !== scopes.length || scopes.some((scope) => typeof scope !== "string" || !NATIVE_SCOPES.includes(scope as (typeof NATIVE_SCOPES)[number]))) throw new Error("nativeAppPolicy.allowedScopes is invalid");
  return {
    formatVersion: 1,
    nativeApiVersion: 1,
    offlineSyncSchemaVersion: 1,
    minimumSupportedAppVersion: semver(row.minimumSupportedAppVersion, "nativeAppPolicy.minimumSupportedAppVersion"),
    recommendedAppVersion: semver(row.recommendedAppVersion, "nativeAppPolicy.recommendedAppVersion"),
    allowedScopes: [...NATIVE_SCOPES],
    featureDefaultEnabled: false
  };
}

function rows(value: unknown, label: string, allowed: Set<string>, required: string[], allowExtra = false) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${label} must be a bounded array`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label}[${index}] must be an object`);
    const row = item as Record<string, unknown>;
    if (!allowExtra) for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`${label}[${index}].${key} is unsupported`);
    for (const key of required) if (row[key] === undefined || row[key] === null || row[key] === "") throw new Error(`${label}[${index}].${key} is required`);
    return row;
  });
}

function unique(items: Record<string, unknown>[], label: string, field: string) {
  const values = new Set<string>();
  items.forEach((row, index) => {
    const value = text(row[field]);
    if (!value || values.has(value)) throw new Error(`${label}[${index}].${field} is missing or duplicated`);
    values.add(value);
  });
  return values;
}

function parseJsonArray(value: unknown, label: string) {
  if (typeof value !== "string" || value.length > 2_000) throw new Error(`${label} is invalid`);
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new Error();
    return parsed as string[];
  } catch {
    throw new Error(`${label} is invalid`);
  }
}

function semver(value: unknown, label: string) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) throw new Error(`${label} is invalid`);
  return normalized;
}

function hash(value: unknown, label: string) { if (!/^[a-f0-9]{64}$/.test(text(value))) throw new Error(`${label} is invalid`); }
function positiveInteger(value: unknown, label: string) { if (!Number.isInteger(value) || Number(value) < 1) throw new Error(`${label} must be a positive integer`); }
function text(value: unknown) { return String(value ?? "").trim(); }
function dates(row: Record<string, unknown>, fields: string[]) { const value = { ...row }; for (const field of fields) if (value[field]) value[field] = new Date(String(value[field])); return value; }
function errorText(label: string, index: number, error: unknown) { return `${label} ${index + 1}: ${error instanceof Error ? error.message : "Unknown restore error"}`; }
