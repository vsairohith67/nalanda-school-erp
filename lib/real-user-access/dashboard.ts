import type { PrismaClient } from "@prisma/client";

export async function realUserAccessDashboard(client: PrismaClient, now = new Date()) {
  const [statusRows, mfaReady, trainingPending, reviewDue, expiredTemporary, activeSessions, nativeSessions, offlineDevices, requests] = await Promise.all([
    client.userAccessRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    client.mfaAuthenticator.count({ where: { status: "ACTIVE", verifiedAt: { not: null }, revokedAt: null } }),
    client.userTrainingAcknowledgement.count({ where: { status: { notIn: ["COMPLETED", "WAIVED"] } } }),
    client.accessCertification.count({ where: { status: "REVIEW_DUE", dueAt: { lte: now } } }),
    client.userRoleAssignment.count({ where: { status: "ACTIVE", validUntil: { lte: now } } }),
    client.authSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    client.nativeSession.count({ where: { revokedAt: null, absoluteExpiresAt: { gt: now }, refreshExpiresAt: { gt: now } } }),
    client.offlineSyncDevice.count({ where: { status: "ACTIVE", revokedAt: null } }),
    client.userAccessRequest.findMany({ select: { publicKey: true, requestedName: true, personType: true, requestedRolesJson: true, status: true, mfaRequired: true, trainingRequirementsJson: true, conflictWarningsJson: true, requestedValidUntil: true, reviewDueAt: true, createdAt: true, candidateUser: { select: { lifecycleStatus: true, isActive: true, mfaAuthenticators: { where: { status: "ACTIVE", revokedAt: null }, select: { type: true } }, trainingAcknowledgements: { select: { status: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  const counts = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));
  return {
    generatedAt: now.toISOString(),
    aggregates: { prospective: (counts.PREPARED ?? 0) + (counts.AWAITING_APPROVAL ?? 0), pendingApproval: counts.AWAITING_APPROVAL ?? 0, invitationReady: counts.APPROVED_FOR_INVITATION ?? 0, invitations: (counts.INVITATION_CREATED ?? 0) + (counts.INVITATION_SENT ?? 0), activationPending: (counts.ACTIVATION_PENDING ?? 0) + (counts.MFA_ENROLMENT_PENDING ?? 0) + (counts.TRAINING_PENDING ?? 0), active: counts.ACTIVE ?? 0, suspended: counts.SUSPENDED ?? 0, disabled: counts.DISABLED ?? 0, mfaReady, trainingPending, reviewDue, expiredTemporary, activeSessions, nativeSessions, offlineDevices },
    requests: requests.map((row) => ({ requestKey: row.publicKey, name: row.requestedName, personType: row.personType, roles: safeList(row.requestedRolesJson), status: row.status, mfa: row.candidateUser?.mfaAuthenticators.map((entry) => entry.type) ?? [], mfaRequired: row.mfaRequired, trainingRequired: safeList(row.trainingRequirementsJson).length, trainingPending: row.candidateUser?.trainingAcknowledgements.filter((entry) => !["COMPLETED", "WAIVED"].includes(entry.status)).length ?? 0, warnings: safeList(row.conflictWarningsJson), validUntil: row.requestedValidUntil?.toISOString() ?? null, reviewDueAt: row.reviewDueAt?.toISOString() ?? null, accountState: row.candidateUser ? { lifecycle: row.candidateUser.lifecycleStatus, active: row.candidateUser.isActive } : null }))
  };
}

function safeList(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []; } catch { return []; } }
