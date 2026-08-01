import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { verifyPassword } from "@/lib/password";
import { SUPER_ADMIN_ONLY_PERMISSIONS } from "@/lib/iam/permission-governance";
import type { CanonicalPermission } from "@/lib/permissions";

export type IamActor = { user: AuthUser; sessionId: string };
export type IamTransaction = Prisma.TransactionClient;

export async function assertActorPermission(
  client: PrismaClient | Prisma.TransactionClient,
  actor: IamActor,
  permission: CanonicalPermission
) {
  const decision = await evaluateEffectivePermission(client, {
    userId: actor.user.id,
    sessionId: actor.sessionId,
    roleAssignmentId: actor.user.roleAssignmentId,
    permission
  });
  if (!decision.allowed) throw new Error("You do not have permission for this IAM action");
  return decision;
}

export async function requireCriticalReauthentication(
  client: PrismaClient | Prisma.TransactionClient,
  actor: IamActor,
  password: string
) {
  if (!password || password.length > 1024) throw new Error("Re-authentication is required");
  const account = await client.user.findFirst({
    where: { id: actor.user.id, isActive: true, lifecycleStatus: "ACTIVE" },
    select: { passwordHash: true, authorizationVersion: true }
  });
  if (!account || !await verifyPassword(password, account.passwordHash)) {
    throw new Error("Re-authentication failed");
  }
  if (account.authorizationVersion !== actor.user.authorizationVersion) {
    throw new Error("Authorization changed; sign in again");
  }
}

export async function assertActorMayDelegate(
  client: PrismaClient | Prisma.TransactionClient,
  actor: IamActor,
  permissions: Iterable<CanonicalPermission>
) {
  await assertActorPermission(client, actor, "DELEGATE_IAM_ACCESS");
  for (const permission of new Set(permissions)) {
    if (SUPER_ADMIN_ONLY_PERMISSIONS.has(permission)) {
      throw new Error(`${permission} is non-delegable`);
    }
    const decision = await evaluateEffectivePermission(client, {
      userId: actor.user.id,
      sessionId: actor.sessionId,
      roleAssignmentId: actor.user.roleAssignmentId,
      permission
    });
    if (!decision.allowed) throw new Error("An actor cannot delegate authority they do not possess");
  }
}

export async function bumpAuthorizationAndRevokeSessions(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: string,
  now = new Date()
) {
  await tx.user.update({
    where: { id: userId },
    data: { authorizationVersion: { increment: 1 }, version: { increment: 1 } }
  });
  await tx.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revocationReason: reason }
  });
}

export async function acquireLastSuperAdminLock(tx: Prisma.TransactionClient) {
  const lock = await tx.iamSafetyLock.findUnique({
    where: { key: "LAST_SUPER_ADMIN" },
    select: { version: true }
  });
  if (!lock) throw new Error("IAM safety lock is unavailable");
  const changed = await tx.iamSafetyLock.updateMany({
    where: { key: "LAST_SUPER_ADMIN", version: lock.version },
    data: { version: { increment: 1 } }
  });
  if (changed.count !== 1) throw new Error("The Super Admin safety state changed; refresh and try again");
}

export async function countActiveSuperAdmins(tx: Prisma.TransactionClient, now = new Date()) {
  return tx.userRoleAssignment.count({
    where: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      user: { isActive: true, lifecycleStatus: "ACTIVE" }
    }
  });
}
