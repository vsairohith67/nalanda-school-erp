import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { acquireLastSuperAdminLock, assertActorPermission, countActiveSuperAdmins, type IamActor } from "@/lib/iam/security";
import { consumeStepUpGrant } from "@/lib/real-user-access/step-up";

export async function expireTemporaryAccess(client: PrismaClient, now = new Date(), limit = 100) {
  const roles = await client.userRoleAssignment.findMany({ where: { status: "ACTIVE", validUntil: { lte: now } }, orderBy: { validUntil: "asc" }, take: Math.max(1, Math.min(500, limit)) });
  const profiles = await client.userPermissionProfileAssignment.findMany({ where: { status: "ACTIVE", validUntil: { lte: now } }, orderBy: { validUntil: "asc" }, take: Math.max(1, Math.min(500, limit)) });
  const affected = new Set([...roles.map((row) => row.userId), ...profiles.map((row) => row.userId)]);
  await client.$transaction(async (tx) => {
    for (const row of roles) await tx.userRoleAssignment.updateMany({ where: { id: row.id, status: "ACTIVE", validUntil: { lte: now } }, data: { status: "EXPIRED", endedAt: now, activeKey: null, version: { increment: 1 }, contextVersion: { increment: 1 } } });
    for (const row of profiles) await tx.userPermissionProfileAssignment.updateMany({ where: { id: row.id, status: "ACTIVE", validUntil: { lte: now } }, data: { status: "EXPIRED", endedAt: now, activeKey: null, version: { increment: 1 } } });
    for (const userId of affected) {
      await tx.user.update({ where: { id: userId }, data: { authorizationVersion: { increment: 1 }, version: { increment: 1 } } });
      await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revocationReason: "TEMPORARY_ACCESS_EXPIRED" } });
      await tx.nativeSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revocationReason: "TEMPORARY_ACCESS_EXPIRED" } });
      await logAuthSecurityEvent(tx, { eventType: "TEMPORARY_ACCESS_EXPIRED", userId, subjectType: "USER", subjectId: userId, details: { roleAssignments: roles.filter((row) => row.userId === userId).length, profileAssignments: profiles.filter((row) => row.userId === userId).length } });
    }
  });
  return { affectedUsers: affected.size, expiredRoles: roles.length, expiredProfiles: profiles.length };
}

export async function decideAccessCertification(client: PrismaClient, actor: IamActor, input: { certificationKey: string; decision: "RETAIN" | "MODIFY" | "REVOKE"; reason: string; stepUpToken: string; environment: string }, env: NodeJS.ProcessEnv = process.env) {
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  const reason = boundedReason(input.reason);
  if (!await consumeStepUpGrant(client, { stepUpToken: input.stepUpToken, userId: actor.user.id, sessionId: actor.sessionId, action: "ACCESS_CERTIFICATION_DECIDE", environment: input.environment }, env)) throw new Error("ACCESS_CERTIFICATION_STEP_UP_REQUIRED");
  const row = await client.accessCertification.findUnique({ where: { publicKey: input.certificationKey }, include: { user: { include: { iamRoleAssignments: { where: { status: "ACTIVE" } } } } } });
  if (!row || row.status !== "REVIEW_DUE" || row.userId === actor.user.id) throw new Error("ACCESS_CERTIFICATION_NOT_DECIDABLE");
  if (input.decision === "REVOKE") { await offboardUserInternal(client, row.userId, actor.user.id, reason, new Date()); }
  const now = new Date(), nextReviewAt = input.decision === "RETAIN" ? new Date(now.getTime() + 90 * 86_400_000) : null;
  await client.accessCertification.update({ where: { id: row.id }, data: { status: input.decision === "MODIFY" ? "CHANGES_REQUIRED" : "DECIDED", startedAt: row.startedAt ?? now, decidedAt: now, reviewerUserId: actor.user.id, decision: input.decision, reason, nextReviewAt } });
  if (nextReviewAt) await client.accessCertification.create({ data: { userId: row.userId, accessRequestId: row.accessRequestId, dueAt: nextReviewAt, scopeSnapshotJson: JSON.stringify({ roles: row.user.iamRoleAssignments.map((entry) => ({ role: entry.role, validUntil: entry.validUntil })) }) } });
  return { success: true, decision: input.decision, nextReviewAt };
}

export async function offboardUser(client: PrismaClient, actor: IamActor, input: { userHandle: string; reason: string; stepUpToken: string; environment: string }, env: NodeJS.ProcessEnv = process.env) {
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  if (!await consumeStepUpGrant(client, { stepUpToken: input.stepUpToken, userId: actor.user.id, sessionId: actor.sessionId, action: "USER_OFFBOARD", environment: input.environment }, env)) throw new Error("USER_OFFBOARD_STEP_UP_REQUIRED");
  const user = await client.user.findUnique({ where: { iamPublicKey: input.userHandle }, include: { iamRoleAssignments: { where: { status: "ACTIVE" } } } });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.id === actor.user.id) throw new Error("SELF_OFFBOARD_REFUSED");
  await offboardUserInternal(client, user.id, actor.user.id, boundedReason(input.reason), new Date());
  return { success: true, state: "DISABLED" as const };
}

export async function requestMfaRecovery(client: PrismaClient, actor: IamActor, input: { userId: string; factorType: "TOTP" | "WEBAUTHN"; reason: string }) {
  if (actor.user.id !== input.userId) await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  const row = await client.mfaRecoveryRequest.create({ data: { userId: input.userId, factorType: input.factorType, reason: boundedReason(input.reason), requestedByUserId: actor.user.id, evidenceJson: "[]" } });
  await logAuthSecurityEvent(client, { eventType: "MFA_RECOVERY_REQUESTED", userId: input.userId, actorUserId: actor.user.id, subjectType: "MFA_RECOVERY_REQUEST", subjectId: row.publicKey, details: { factorType: input.factorType } });
  return { requestKey: row.publicKey, status: row.status };
}

export async function reviewMfaRecovery(client: PrismaClient, actor: IamActor, input: { requestKey: string; evidence: string }) {
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  const row = await client.mfaRecoveryRequest.findUnique({ where: { publicKey: input.requestKey } });
  if (!row || row.status !== "REQUESTED" || row.requestedByUserId === actor.user.id || row.userId === actor.user.id) throw new Error("MFA_RECOVERY_REVIEW_SEPARATION_REQUIRED");
  const evidence = boundedReason(input.evidence);
  const changed = await client.mfaRecoveryRequest.updateMany({
    where: { id: row.id, status: "REQUESTED", reviewedByUserId: null, approvedByUserId: null },
    data: { status: "REVIEWED", reviewedByUserId: actor.user.id, evidenceJson: JSON.stringify([{ type: "HUMAN_REVIEW", note: evidence, reviewedAt: new Date().toISOString() }]) }
  });
  if (changed.count !== 1) throw new Error("MFA_RECOVERY_REVIEW_ALREADY_DECIDED");
  await logAuthSecurityEvent(client, { eventType: "MFA_RECOVERY_REVIEWED", userId: row.userId, actorUserId: actor.user.id, subjectType: "MFA_RECOVERY_REQUEST", subjectId: row.publicKey, details: { factorType: row.factorType } });
  return { success: true, status: "REVIEWED" as const };
}

export async function approveMfaRecovery(client: PrismaClient, actor: IamActor, input: { requestKey: string; stepUpToken: string; environment: string }, env: NodeJS.ProcessEnv = process.env) {
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  const row = await client.mfaRecoveryRequest.findUnique({ where: { publicKey: input.requestKey } });
  if (!row || row.status !== "REVIEWED" || !row.reviewedByUserId || row.requestedByUserId === actor.user.id || row.userId === actor.user.id || row.reviewedByUserId === actor.user.id) throw new Error("MFA_RECOVERY_APPROVAL_SEPARATION_REQUIRED");
  if (!await consumeStepUpGrant(client, { stepUpToken: input.stepUpToken, userId: actor.user.id, sessionId: actor.sessionId, action: "MFA_RECOVERY_APPROVE", environment: input.environment }, env)) throw new Error("MFA_RECOVERY_STEP_UP_REQUIRED");
  const now = new Date();
  await client.$transaction(async (tx) => {
    const targetIsSuperAdmin = await tx.userRoleAssignment.count({ where: { userId: row.userId, role: "SUPER_ADMIN", status: "ACTIVE" } }) > 0;
    if (targetIsSuperAdmin) { await acquireLastSuperAdminLock(tx); if (await countActiveSuperAdmins(tx) <= 1) throw new Error("LAST_SUPER_ADMIN_MFA_RECOVERY_REFUSED"); }
    const changed = await tx.mfaRecoveryRequest.updateMany({ where: { id: row.id, status: "REVIEWED", reviewedByUserId: row.reviewedByUserId, approvedByUserId: null }, data: { status: "APPROVED", approvedByUserId: actor.user.id, decidedAt: now } });
    if (changed.count !== 1) throw new Error("MFA_RECOVERY_APPROVAL_ALREADY_DECIDED");
    await tx.mfaAuthenticator.updateMany({ where: { userId: row.userId, type: row.factorType, status: "ACTIVE", revokedAt: null }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actor.user.id, revocationReason: "GOVERNED_MFA_RECOVERY", version: { increment: 1 } } });
    await tx.mfaRecoveryCode.updateMany({ where: { userId: row.userId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
    await tx.authSession.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now, revocationReason: "MFA_RECOVERY" } });
    await tx.nativeSession.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now, revocationReason: "MFA_RECOVERY" } });
    await tx.offlineSyncDevice.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actor.user.id, revocationReason: "MFA_RECOVERY" } });
    await tx.user.update({ where: { id: row.userId }, data: { lifecycleStatus: "LOCKED", isActive: false, credentialVersion: { increment: 1 }, authorizationVersion: { increment: 1 }, version: { increment: 1 } } });
    await logAuthSecurityEvent(tx, { eventType: "MFA_RECOVERY_APPROVED", userId: row.userId, actorUserId: actor.user.id, subjectType: "MFA_RECOVERY_REQUEST", subjectId: row.publicKey, details: { factorType: row.factorType } });
  });
  return { success: true, state: "LOCKED_PENDING_REENROLMENT" as const };
}

async function offboardUserInternal(client: PrismaClient, userId: string, actorUserId: string, reason: string, now: Date) {
  await client.$transaction(async (tx) => {
    const targetIsSuperAdmin = await tx.userRoleAssignment.count({ where: { userId, role: "SUPER_ADMIN", status: "ACTIVE" } }) > 0;
    if (targetIsSuperAdmin) { await acquireLastSuperAdminLock(tx); if (await countActiveSuperAdmins(tx) <= 1) throw new Error("LAST_SUPER_ADMIN_OFFBOARD_REFUSED"); }
    await tx.user.update({ where: { id: userId }, data: { isActive: false, lifecycleStatus: "DISABLED", suspensionReason: reason, credentialVersion: { increment: 1 }, authorizationVersion: { increment: 1 }, version: { increment: 1 } } });
    await tx.userRoleAssignment.updateMany({ where: { userId, status: { in: ["ACTIVE", "PENDING"] } }, data: { status: "ENDED", endedAt: now, endedByUserId: actorUserId, activeKey: null, version: { increment: 1 }, contextVersion: { increment: 1 } } });
    await tx.userPermissionProfileAssignment.updateMany({ where: { userId, status: { in: ["ACTIVE", "PENDING"] } }, data: { status: "ENDED", endedAt: now, endedByUserId: actorUserId, activeKey: null, version: { increment: 1 } } });
    await tx.userPermissionOverride.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actorUserId, activeKey: null, version: { increment: 1 } } });
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revocationReason: "USER_OFFBOARDED" } });
    await tx.nativeSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revocationReason: "USER_OFFBOARDED" } });
    await tx.offlineSyncDevice.updateMany({ where: { userId, revokedAt: null }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actorUserId, revocationReason: "USER_OFFBOARDED" } });
    await tx.mfaAuthenticator.updateMany({ where: { userId, revokedAt: null }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actorUserId, revocationReason: "USER_OFFBOARDED", version: { increment: 1 } } });
    await tx.mfaRecoveryCode.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
    await tx.userInvitation.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { status: "REVOKED", revokedAt: now, revocationReason: "USER_OFFBOARDED" } });
    await tx.userActivationSession.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: now, revocationReason: "USER_OFFBOARDED" } });
    await tx.mfaChallenge.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    await tx.stepUpGrant.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    await logAuthSecurityEvent(tx, { eventType: "USER_OFFBOARDED", userId, actorUserId, subjectType: "USER", subjectId: userId, details: { retainedAudit: true, state: "DISABLED" } });
  });
}

function boundedReason(value: string) { const reason = value.trim(); if (reason.length < 8 || reason.length > 500) throw new Error("GOVERNANCE_REASON_REQUIRED"); return reason; }
