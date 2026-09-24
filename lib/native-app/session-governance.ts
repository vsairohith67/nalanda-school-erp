import type { PrismaClient } from "@prisma/client";
import { resolvePersistedSession } from "@/lib/auth-sessions";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { consumeStepUpGrant } from "@/lib/real-user-access/step-up";
import { boundAuthEnvironment } from "@/lib/real-user-access/login-mfa";
import { withDatabaseRetry } from "@/lib/database-retry";
import { nativeAppEnabled } from "./feature-flag";
import { NativeAuthError } from "./auth";

const publicId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const NATIVE_ADMIN_REVOCATION_EVENT = "NATIVE_SESSION_ADMIN_REVOKED";
/** Full UUID, not a truncated hash: the existing grant binds this exact action,
 * target, web session, actor and deployment environment. */
export function nativeSessionRevocationAction(sessionId: string) {
  if (!publicId.test(sessionId)) throw new NativeAuthError("NATIVE_SESSION_TARGET_INVALID");
  return `NATIVE_SESSION_REVOKE_${sessionId.replaceAll("-", "").toUpperCase()}`;
}
export function parseNativeSessionRevocation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new NativeAuthError("REVOCATION_INPUT_INVALID");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "reason,stepUpToken" || typeof row.reason !== "string" || typeof row.stepUpToken !== "string") throw new NativeAuthError("REVOCATION_INPUT_INVALID");
  // Auth-security audit details have a 160-character bound. Do not log the raw
  // request or accept control characters in a governed human reason.
  const reason = row.reason.trim();
  if (reason.length < 4 || reason.length > 160 || /[\x00-\x1f\x7f]/.test(reason) || row.stepUpToken.length > 200) throw new NativeAuthError("REVOCATION_INPUT_INVALID");
  return { reason, stepUpToken: row.stepUpToken };
}

/** The credential is the actual web-session cookie, never a caller-supplied
 * actor/role/session ID. Resolve and re-authorize inside every transaction,
 * including retries and already-revoked targets. This installation's serving
 * database is its school/environment boundary; no external database is selected.
 * Already-authorized in-flight requests and local offline data are unaffected. */
export async function revokeGovernedNativeSession(client: PrismaClient, sessionCookie: string | undefined, sessionId: string, value: unknown) {
  if (!nativeAppEnabled()) throw new NativeAuthError("NATIVE_APP_UNAVAILABLE", 404);
  const action = nativeSessionRevocationAction(sessionId), input = parseNativeSessionRevocation(value);
  return withDatabaseRetry(() => client.$transaction(async tx => {
    const now = new Date();
    const actor = await resolvePersistedSession(tx, sessionCookie, now);
    if (!actor) throw new NativeAuthError("AUTHENTICATION_REQUIRED", 401);
    if (actor.user.mustChangePassword || actor.activeRoleAssignment.role !== "SUPER_ADMIN" || !(await evaluateEffectivePermission(tx, { userId: actor.userId, sessionId: actor.id, roleAssignmentId: actor.activeRoleAssignment.id, permission: "MANAGE_OFFLINE_SYNC_DEVICES", now })).allowed) throw new NativeAuthError("NATIVE_SESSION_GOVERNANCE_DENIED", 403);
    if (!await consumeStepUpGrant(tx, { ...input, userId: actor.userId, sessionId: actor.id, action, environment: boundAuthEnvironment(), now })) throw new NativeAuthError("STEP_UP_REQUIRED", 403);
    const target = await tx.nativeSession.findUnique({ where: { publicSessionId: sessionId }, select: { id: true, userId: true, deviceId: true, roleAssignmentId: true, revokedAt: true, device: { select: { userId: true } } } });
    const assignment = target && await tx.userRoleAssignment.findFirst({ where: { id: target.roleAssignmentId, userId: target.userId }, select: { id: true } });
    if (!target || target.device.userId !== target.userId || !assignment) throw new NativeAuthError("NATIVE_SESSION_NOT_FOUND", 404);
    if (target.revokedAt) return { status: "ALREADY_REVOKED" as const };
    const changed = await tx.nativeSession.updateMany({ where: { id: target.id, userId: target.userId, deviceId: target.deviceId, revokedAt: null }, data: { revokedAt: now, revocationReason: input.reason } });
    if (changed.count !== 1) throw new NativeAuthError("NATIVE_SESSION_CHANGED", 409);
    await logAuthSecurityEvent(tx, { eventType: NATIVE_ADMIN_REVOCATION_EVENT, userId: target.userId, actorUserId: actor.userId, subjectType: "NATIVE_SESSION", subjectId: sessionId, details: { reason: input.reason, actingSessionId: actor.id, operationId: input.stepUpToken.split(".")[0], outcome: "REVOKED", revokedAt: now.toISOString() } });
    return { status: "REVOKED" as const };
  }, { isolationLevel: "Serializable" }));
}
