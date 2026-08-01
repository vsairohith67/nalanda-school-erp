import type { Prisma, PrismaClient } from "@prisma/client";
import { PERMISSIONS, isRole, normalizePermission, type CanonicalPermission, type Role } from "@/lib/permissions";
import { getEffectivePermissions } from "@/lib/role-permissions";
import { immutablePermissionDenial, OBJECT_SCOPED_PERMISSIONS, permissionDelegability } from "@/lib/iam/permission-governance";

type IamClient = PrismaClient | Prisma.TransactionClient;

export type PermissionDecisionSource =
  | "ACCOUNT"
  | "SESSION"
  | "ROLE_ASSIGNMENT"
  | "SYSTEM_RESTRICTION"
  | "OBJECT_SCOPE"
  | "USER_DENY"
  | "PROFILE_DENY"
  | "USER_ALLOW"
  | "PROFILE_ALLOW"
  | "BASE_ROLE"
  | "DEFAULT_DENY";

export type EffectivePermissionDecision = {
  permission: CanonicalPermission | null;
  allowed: boolean;
  source: PermissionDecisionSource;
  reason: string;
  role: Role | null;
  roleLabel: string | null;
  profileNames: string[];
  objectScopeRequired: boolean;
  delegability: ReturnType<typeof permissionDelegability> | null;
};

export type AuthorizationSnapshot = Awaited<ReturnType<typeof loadAuthorizationSnapshot>>;

export async function loadAuthorizationSnapshot(client: IamClient, input: {
  userId: string;
  sessionId?: string | null;
  roleAssignmentId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const user = await client.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      isActive: true,
      lifecycleStatus: true,
      authorizationVersion: true,
      designation: true
    }
  });
  const session = input.sessionId
    ? await client.authSession.findUnique({ where: { id: input.sessionId } })
    : null;
  const selectedAssignmentId = input.roleAssignmentId ?? session?.activeRoleAssignmentId ?? null;
  const roleAssignment = selectedAssignmentId
    ? await client.userRoleAssignment.findFirst({
        where: { id: selectedAssignmentId, userId: input.userId }
      })
    : null;
  const [profileAssignments, overrides] = user
    ? await Promise.all([
        client.userPermissionProfileAssignment.findMany({
          where: {
            userId: input.userId,
            status: "ACTIVE",
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            profile: { status: "ACTIVE" }
          },
          include: { profile: { include: { entries: true } } },
          orderBy: { createdAt: "asc" }
        }),
        client.userPermissionOverride.findMany({
          where: {
            userId: input.userId,
            status: "ACTIVE",
            revokedAt: null,
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }]
          },
          orderBy: { createdAt: "asc" }
        })
      ])
    : [[], []];
  const basePermissions = roleAssignment && isRole(roleAssignment.role)
    ? await getEffectivePermissions(client, roleAssignment.role)
    : new Set<CanonicalPermission>();
  return {
    now,
    user,
    session,
    sessionRequested: Boolean(input.sessionId),
    selectedAssignmentId,
    roleAssignment,
    profileAssignments,
    overrides,
    basePermissions
  };
}

export async function evaluateEffectivePermission(client: IamClient, input: {
  userId: string;
  sessionId?: string | null;
  roleAssignmentId?: string | null;
  permission: string;
  objectScopeSatisfied?: boolean;
  now?: Date;
}) {
  const snapshot = await loadAuthorizationSnapshot(client, input);
  return evaluatePermissionFromSnapshot(client, snapshot, input.permission, input.objectScopeSatisfied);
}

export async function evaluatePermissionFromSnapshot(
  client: IamClient,
  snapshot: AuthorizationSnapshot,
  rawPermission: string,
  objectScopeSatisfied?: boolean
): Promise<EffectivePermissionDecision> {
  const permission = normalizePermission(rawPermission);
  const role = snapshot.roleAssignment?.role as Role | undefined;
  const base = {
    permission,
    role: role ?? null,
    roleLabel: role ? role.replaceAll("_", " ") : null,
    profileNames: [] as string[],
    objectScopeRequired: Boolean(permission && OBJECT_SCOPED_PERMISSIONS.has(permission)),
    delegability: permission ? permissionDelegability(permission) : null
  };
  const deny = (source: PermissionDecisionSource, reason: string): EffectivePermissionDecision => ({
    ...base,
    allowed: false,
    source,
    reason
  });
  const allow = (source: PermissionDecisionSource, reason: string, profileNames: string[] = []): EffectivePermissionDecision => ({
    ...base,
    allowed: true,
    source,
    reason,
    profileNames
  });

  if (!snapshot.user || !snapshot.user.isActive || snapshot.user.lifecycleStatus !== "ACTIVE") {
    return deny("ACCOUNT", "The account is inactive, suspended or pending activation.");
  }
  if (snapshot.sessionRequested && !snapshot.session) {
    return deny("SESSION", "The requested session does not exist or is no longer available.");
  }
  if (snapshot.session) {
    if (
      snapshot.session.userId !== snapshot.user.id ||
      snapshot.session.revokedAt ||
      snapshot.session.expiresAt <= snapshot.now ||
      snapshot.session.authorizationVersion !== snapshot.user.authorizationVersion ||
      snapshot.session.activeRoleAssignmentId !== snapshot.selectedAssignmentId
    ) return deny("SESSION", "The session is revoked, expired or stale.");
  }
  if (
    !snapshot.roleAssignment ||
    snapshot.roleAssignment.status !== "ACTIVE" ||
    snapshot.roleAssignment.validFrom > snapshot.now ||
    (snapshot.roleAssignment.validUntil && snapshot.roleAssignment.validUntil <= snapshot.now)
  ) return deny("ROLE_ASSIGNMENT", "The selected role assignment is inactive or expired.");
  if (!permission) return deny("DEFAULT_DENY", "Unknown permissions always default to deny.");
  const immutableDenial = immutablePermissionDenial(role!, permission);
  if (immutableDenial) return deny("SYSTEM_RESTRICTION", immutableDenial);
  if (OBJECT_SCOPED_PERMISSIONS.has(permission) && objectScopeSatisfied === false) {
    return deny("OBJECT_SCOPE", "The exact object-scope resolver denied this record or relationship.");
  }

  const userEntries = snapshot.overrides.filter((entry) => entry.permission === permission);
  if (userEntries.some((entry) => entry.effect === "DENY")) {
    return deny("USER_DENY", "An explicit individual denial overrides every grant source.");
  }
  const validProfileEntries = snapshot.profileAssignments.flatMap((assignment) =>
    assignment.profile.entries
      .filter((entry) =>
        entry.permission === permission &&
        entry.status === "ACTIVE" &&
        !entry.revokedAt &&
        entry.validFrom <= snapshot.now &&
        (!entry.validUntil || entry.validUntil > snapshot.now)
      )
      .map((entry) => ({ entry, profileName: assignment.profile.name }))
  );
  const profileDenials = validProfileEntries.filter(({ entry }) => entry.effect === "DENY");
  if (profileDenials.length) {
    const names = [...new Set(profileDenials.map((row) => row.profileName))];
    return { ...deny("PROFILE_DENY", "A denial in an assigned profile overrides individual, profile and base-role grants."), profileNames: names };
  }
  if (userEntries.some((entry) => entry.effect === "ALLOW")) {
    return allow("USER_ALLOW", scopeSuffix(permission, "An explicit individual grant allows this permission."));
  }
  const profileAllows = validProfileEntries.filter(({ entry }) => entry.effect === "ALLOW");
  if (profileAllows.length) {
    const names = [...new Set(profileAllows.map((row) => row.profileName))];
    return allow("PROFILE_ALLOW", scopeSuffix(permission, "An assigned profile allows this permission."), names);
  }
  if (snapshot.basePermissions.has(permission)) {
    return allow("BASE_ROLE", scopeSuffix(permission, "The active base-role permission allows this action."));
  }
  return deny("DEFAULT_DENY", "No active grant source allows this permission.");
}

export async function getUserEffectivePermissions(client: IamClient, input: {
  userId: string;
  sessionId?: string | null;
  roleAssignmentId?: string | null;
  now?: Date;
}) {
  const snapshot = await loadAuthorizationSnapshot(client, input);
  const decisions = await Promise.all(PERMISSIONS.map((permission) =>
    evaluatePermissionFromSnapshot(client, snapshot, permission)
  ));
  return new Set<CanonicalPermission>(
    decisions.filter((decision) => decision.allowed && decision.permission).map((decision) => decision.permission!)
  );
}

export async function previewUserEffectiveAccess(client: IamClient, input: {
  userId: string;
  roleAssignmentId: string;
  now?: Date;
}) {
  const snapshot = await loadAuthorizationSnapshot(client, input);
  return Promise.all(PERMISSIONS.map((permission) =>
    evaluatePermissionFromSnapshot(client, snapshot, permission)
  ));
}

function scopeSuffix(permission: CanonicalPermission, reason: string) {
  return OBJECT_SCOPED_PERMISSIONS.has(permission)
    ? `${reason} Exact object scope is still mandatory and cannot be bypassed.`
    : reason;
}
