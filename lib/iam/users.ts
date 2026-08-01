import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { validateNewPassword } from "@/lib/user-management";
import { maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";
import { logUserAction } from "@/lib/user-audit";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { getEffectivePermissions } from "@/lib/role-permissions";
import { roleDisplayLabel } from "@/lib/role-presentation";
import type { CanonicalPermission, Role } from "@/lib/permissions";
import { CRITICAL_SUPER_ADMIN_PERMISSIONS, SUPER_ADMIN_ONLY_PERMISSIONS } from "@/lib/iam/permission-governance";
import { previewUserEffectiveAccess } from "@/lib/iam/effective-access";
import {
  acquireLastSuperAdminLock,
  assertActorMayDelegate,
  assertActorPermission,
  bumpAuthorizationAndRevokeSessions,
  countActiveSuperAdmins,
  requireCriticalReauthentication,
  type IamActor
} from "@/lib/iam/security";
import {
  asCanonicalPermission,
  boundedText,
  expectedVersion,
  normalizeUsername,
  optionalBoundedText,
  optionalFutureDate,
  reasonText,
  rolesInput,
  overridesInput
} from "@/lib/iam/validation";

const MAX_TEMPORARY_PASSWORD_DAYS = 7;

export async function listNamedUsers(client: PrismaClient, input: { query?: string; status?: string; role?: string }) {
  const query = input.query?.trim().slice(0, 80) ?? "";
  const users = await client.user.findMany({
    where: {
      ...(input.status ? { lifecycleStatus: input.status } : {}),
      ...(query ? { OR: [{ name: { contains: query } }, { username: { contains: query } }, { designation: { contains: query } }] } : {}),
      ...(input.role ? { iamRoleAssignments: { some: { role: input.role, status: "ACTIVE" } } } : {})
    },
    select: {
      iamPublicKey: true,
      name: true,
      username: true,
      designation: true,
      lifecycleStatus: true,
      isActive: true,
      version: true,
      lastLoginAt: true,
      iamRoleAssignments: { where: { status: "ACTIVE" }, select: { role: true, validUntil: true }, orderBy: { createdAt: "asc" } },
      iamProfileAssignments: { where: { status: "ACTIVE" }, select: { profile: { select: { name: true, status: true } } } },
      _count: { select: { authSessions: { where: { revokedAt: null } }, iamPermissionOverrides: { where: { status: "ACTIVE" } } } }
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: 200
  });
  return users.filter((user) => user.iamPublicKey).map((user) => ({
    handle: user.iamPublicKey!,
    name: user.name,
    username: user.username,
    designation: user.designation,
    status: user.lifecycleStatus,
    active: user.isActive,
    version: user.version,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    roles: user.iamRoleAssignments.map((assignment) => ({ label: roleDisplayLabel(assignment.role), validUntil: assignment.validUntil?.toISOString() ?? null })),
    profiles: user.iamProfileAssignments.filter((assignment) => assignment.profile.status === "ACTIVE").map((assignment) => assignment.profile.name),
    activeSessions: user._count.authSessions,
    activeOverrides: user._count.iamPermissionOverrides
  }));
}

export async function createNamedUser(client: PrismaClient, actor: IamActor, input: Record<string, unknown>) {
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  await requireCriticalReauthentication(client, actor, String(input.reauthPassword ?? ""));
  const name = boundedText(input.name, "Display name", 2, 100);
  const username = normalizeUsername(input.username);
  const designation = optionalBoundedText(input.designation, "Designation", 100);
  const email = optionalBoundedText(input.email, "Email", 254)?.toLowerCase() ?? null;
  const reason = reasonText(input.reason);
  const roles = rolesInput(input.roles);
  const activationMethod = String(input.activationMethod ?? "PENDING");
  const temporaryPassword = String(input.temporaryPassword ?? "");
  const activateWithTemporaryPassword = activationMethod === "TEMPORARY_PASSWORD";
  if (actor.user.role === "COMPUTER_OPERATOR" && (roles.some((role) => !["PARENT", "VIEWER"].includes(role)) || activateWithTemporaryPassword)) {
    throw new Error("Computer Operators may create pending Parent or Viewer accounts only");
  }
  await assertRoleAssignmentDelegation(client, actor, roles);
  if (roles.includes("SUPER_ADMIN")) await assertSuperAdminGrantAllowed(client, actor);
  if (activateWithTemporaryPassword) validateNewPassword(temporaryPassword);
  const validUntil = optionalFutureDate(input.validUntil, "Role validity");
  const requestedTemporaryDays = Number(input.temporaryPasswordDays ?? 1);
  if (activateWithTemporaryPassword && (!Number.isInteger(requestedTemporaryDays) || requestedTemporaryDays < 1 || requestedTemporaryDays > MAX_TEMPORARY_PASSWORD_DAYS)) {
    throw new Error(`Temporary password validity must be 1-${MAX_TEMPORARY_PASSWORD_DAYS} days`);
  }
  const temporaryExpiresAt = activateWithTemporaryPassword
    ? new Date(Date.now() + requestedTemporaryDays * 86_400_000)
    : null;
  const staffKey = optionalBoundedText(input.staffHandle, "Staff link", 80);
  const guardianKey = optionalBoundedText(input.guardianHandle, "Guardian link", 80);
  if (roles.includes("TEACHER") && !staffKey) throw new Error("Teacher access requires an existing Staff link");
  if (roles.includes("PARENT") && !guardianKey) throw new Error("Parent access requires an existing Guardian link");
  const profileHandles = Array.isArray(input.profileHandles)
    ? [...new Set(input.profileHandles.map((value) => boundedText(value, "Permission profile", 10, 80)))].slice(0, 20)
    : [];
  const profiles = profileHandles.length ? await client.permissionProfile.findMany({
    where: { publicKey: { in: profileHandles }, status: "ACTIVE" },
    include: { entries: { where: { status: "ACTIVE", revokedAt: null } } }
  }) : [];
  if (profiles.length !== profileHandles.length) throw new Error("One or more permission profiles are unavailable");
  const overrides = overridesInput(input.overrides ?? []);
  if (overrides.some((entry) => SUPER_ADMIN_ONLY_PERMISSIONS.has(entry.permission))) throw new Error("Non-delegable permissions cannot be assigned as individual overrides");
  if (roles.includes("SUPER_ADMIN") && (
    profiles.some((profile) => profile.entries.some((entry) => entry.effect === "DENY" && CRITICAL_SUPER_ADMIN_PERMISSIONS.has(entry.permission as CanonicalPermission))) ||
    overrides.some((entry) => entry.effect === "DENY" && CRITICAL_SUPER_ADMIN_PERMISSIONS.has(entry.permission))
  )) throw new Error("Critical Super Admin access cannot be denied through a profile or individual override");
  if (actor.user.role !== "SUPER_ADMIN") {
    await assertActorMayDelegate(client, actor, [
      ...profiles.flatMap((profile) => profile.entries.filter((entry) => entry.effect === "ALLOW").map((entry) => entry.permission as CanonicalPermission)),
      ...overrides.filter((entry) => entry.effect === "ALLOW").map((entry) => entry.permission)
    ]);
  }

  return client.$transaction(async (tx) => {
    if (roles.includes("SUPER_ADMIN")) await acquireLastSuperAdminLock(tx);
    const [staff, guardian] = await Promise.all([
      staffKey ? tx.staffMember.findUnique({ where: { iamPublicKey: staffKey }, select: { id: true, userId: true, status: true } }) : null,
      guardianKey ? tx.guardian.findUnique({ where: { iamPublicKey: guardianKey }, select: { id: true, status: true, users: { select: { id: true } } } }) : null
    ]);
    if (staffKey && (!staff || staff.status.toUpperCase() !== "ACTIVE" || staff.userId)) throw new Error("The selected active Staff record is unavailable or already linked");
    if (guardianKey && (!guardian || guardian.status.toUpperCase() !== "ACTIVE" || guardian.users.length)) throw new Error("The selected active Guardian is unavailable or already linked");
    const passwordHash = await hashPassword(activateWithTemporaryPassword ? temporaryPassword : randomBytes(48).toString("base64url"));
    const now = new Date();
    const user = await tx.user.create({
      data: {
        iamPublicKey: randomUUID(),
        name,
        designation,
        username,
        email,
        passwordHash,
        role: roles[0],
        isActive: activateWithTemporaryPassword,
        lifecycleStatus: activateWithTemporaryPassword ? "ACTIVE" : "PENDING_ACTIVATION",
        mustChangePassword: activateWithTemporaryPassword,
        temporaryPasswordExpiresAt: temporaryExpiresAt,
        guardianId: guardian?.id ?? null,
        iamRoleAssignments: {
          create: roles.map((role) => ({
            publicKey: randomUUID(), role, reason, assignedByUserId: actor.user.id,
            validFrom: now, validUntil, activeKey: `${randomUUID()}:${role}`
          }))
        },
        authLoginAliases: {
          create: {
            type: "USERNAME",
            normalizedValue: normalizeAliasValue("USERNAME", username),
            displayMasked: maskAlias("USERNAME", username),
            status: "VERIFIED",
            isSchoolGoverned: true,
            verifiedAt: now
          }
        }
      },
      select: { id: true, iamPublicKey: true, name: true, username: true, designation: true, lifecycleStatus: true, version: true }
    });
    if (staff) await tx.staffMember.update({ where: { id: staff.id }, data: { userId: user.id } });
    for (const profile of profiles) {
      await tx.userPermissionProfileAssignment.create({
        data: { publicKey: randomUUID(), userId: user.id, profileId: profile.id, reason, assignedByUserId: actor.user.id, activeKey: `${user.id}:${profile.id}` }
      });
    }
    for (const entry of overrides) {
      await tx.userPermissionOverride.create({
        data: { publicKey: randomUUID(), userId: user.id, permission: entry.permission, effect: entry.effect, reason, createdByUserId: actor.user.id, activeKey: `${user.id}:${entry.permission}` }
      });
    }
    await logUserAction(tx, {
      action: "IAM_NAMED_USER_CREATED",
      actor: actor.user,
      targetUserId: user.id,
      details: { status: user.lifecycleStatus, roles: roles.map(roleDisplayLabel), designation: designation ?? "Not set", activationMethod: activateWithTemporaryPassword ? "Temporary password with forced change" : "Pending activation", reason }
    });
    return { handle: user.iamPublicKey!, name: user.name, username: user.username, designation: user.designation, status: user.lifecycleStatus, version: user.version };
  });
}

export async function getNamedUserDetail(client: PrismaClient, userKey: string) {
  const user = await client.user.findUnique({
    where: { iamPublicKey: userKey },
    include: {
      iamRoleAssignments: { orderBy: { createdAt: "desc" } },
      iamProfileAssignments: { include: { profile: true }, orderBy: { createdAt: "desc" } },
      iamPermissionOverrides: { orderBy: { createdAt: "desc" } },
      authSessions: { select: { revokedAt: true, expiresAt: true, deviceSummary: true, browserSummary: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
  if (!user) throw new Error("Named user not found");
  const history = await client.userAudit.findMany({
    where: { targetUserId: user.id, action: { startsWith: "IAM_" } },
    select: { action: true, actorName: true, detailsJson: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return {
    handle: user.iamPublicKey!,
    name: user.name,
    username: user.username,
    email: user.email,
    designation: user.designation,
    status: user.lifecycleStatus,
    active: user.isActive,
    version: user.version,
    mustChangePassword: user.mustChangePassword,
    roles: user.iamRoleAssignments.map((assignment) => ({ handle: assignment.publicKey, label: roleDisplayLabel(assignment.role), status: assignment.status, validFrom: assignment.validFrom.toISOString(), validUntil: assignment.validUntil?.toISOString() ?? null, endedAt: assignment.endedAt?.toISOString() ?? null, version: assignment.version })),
    profiles: user.iamProfileAssignments.map((assignment) => ({ handle: assignment.publicKey, name: assignment.profile.name, profileStatus: assignment.profile.status, status: assignment.status, validUntil: assignment.validUntil?.toISOString() ?? null, version: assignment.version })),
    overrides: user.iamPermissionOverrides.map((override) => ({ handle: override.publicKey, permission: override.permission, effect: override.effect, status: override.status, validUntil: override.validUntil?.toISOString() ?? null, version: override.version })),
    sessions: user.authSessions.map((session) => ({ status: session.revokedAt ? "Revoked" : session.expiresAt <= new Date() ? "Expired" : "Active", device: session.deviceSummary, browser: session.browserSummary, createdAt: session.createdAt.toISOString() })),
    history: history.map((event) => ({ action: event.action.replaceAll("_", " "), actor: event.actorName, details: safeAuditDetails(event.detailsJson), createdAt: event.createdAt.toISOString() }))
  };
}

export async function previewNamedUserAccess(client: PrismaClient, userKey: string, roleHandle?: string) {
  const user = await client.user.findUnique({ where: { iamPublicKey: userKey }, select: { id: true } });
  if (!user) throw new Error("Named user not found");
  const assignment = roleHandle
    ? await client.userRoleAssignment.findFirst({ where: { publicKey: roleHandle, userId: user.id, status: "ACTIVE" } })
    : await client.userRoleAssignment.findFirst({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!assignment) throw new Error("No active role assignment is available");
  const decisions = await previewUserEffectiveAccess(client, { userId: user.id, roleAssignmentId: assignment.id });
  return decisions.map((decision) => ({
    permission: decision.permission,
    allowed: decision.allowed,
    source: decision.source.replaceAll("_", " "),
    reason: decision.reason,
    profileNames: decision.profileNames,
    objectScopeRequired: decision.objectScopeRequired,
    delegability: decision.delegability?.replaceAll("_", " ") ?? null
  }));
}

export async function mutateNamedUser(client: PrismaClient, actor: IamActor, userKey: string, input: Record<string, unknown>) {
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  await requireCriticalReauthentication(client, actor, String(input.reauthPassword ?? ""));
  const action = boundedText(input.action, "Action", 3, 40);
  const reason = reasonText(input.reason);
  const version = expectedVersion(input.expectedVersion);
  const target = await client.user.findUnique({ where: { iamPublicKey: userKey }, include: { iamRoleAssignments: { where: { status: "ACTIVE" } } } });
  if (!target) throw new Error("Named user not found");
  assertManagementBoundary(actor, target.iamRoleAssignments.map((assignment) => assignment.role as Role));
  if (target.id === actor.user.id && !["UPDATE_IDENTITY"].includes(action)) throw new Error("Self-escalation and own critical-access changes are not allowed");

  if (action === "SUSPEND" || action === "REACTIVATE") {
    return changeLifecycle(client, actor, target, action, reason, version);
  }
  if (action === "ASSIGN_ROLE") {
    const roles = rolesInput([input.role]);
    await assertRoleAssignmentDelegation(client, actor, roles);
    if (roles[0] === "SUPER_ADMIN") await assertSuperAdminGrantAllowed(client, actor);
    return addRole(client, actor, target, roles[0], input, reason, version);
  }
  if (action === "END_ROLE") return endRole(client, actor, target, input, reason, version);
  if (action === "ASSIGN_PROFILE") return assignProfile(client, actor, target, input, reason, version);
  if (action === "END_PROFILE") return endProfile(client, actor, target, input, reason, version);
  if (action === "SET_OVERRIDE") return setOverride(client, actor, target, input, reason, version);
  if (action === "REVOKE_OVERRIDE") return revokeOverride(client, actor, target, input, reason, version);
  if (action === "UPDATE_IDENTITY") return updateIdentity(client, actor, target, input, reason, version);
  throw new Error("Unsupported named-user action");
}

async function changeLifecycle(client: PrismaClient, actor: IamActor, target: UserTarget, action: "SUSPEND" | "REACTIVATE", reason: string, version: number) {
  if (action === "SUSPEND" && target.lifecycleStatus !== "ACTIVE") throw new Error("Only an active user can be suspended");
  if (action === "REACTIVATE" && target.lifecycleStatus !== "SUSPENDED") throw new Error("Only a suspended user can be reactivated");
  return client.$transaction(async (tx) => {
    if (target.iamRoleAssignments.some((assignment) => assignment.role === "SUPER_ADMIN")) {
      await acquireLastSuperAdminLock(tx);
      if (action === "SUSPEND" && await countActiveSuperAdmins(tx) <= 1) throw new Error("The last active Super Admin cannot be suspended");
    }
    const activate = action === "REACTIVATE";
    const changed = await tx.user.updateMany({
      where: { id: target.id, version },
      data: { isActive: activate, lifecycleStatus: activate ? "ACTIVE" : "SUSPENDED", suspensionReason: activate ? null : reason, version: { increment: 1 }, authorizationVersion: { increment: 1 } }
    });
    if (changed.count !== 1) throw new Error("The user changed; refresh and try again");
    await tx.authSession.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: `IAM_USER_${action}` } });
    await logUserAction(tx, { action: `IAM_USER_${action === "SUSPEND" ? "SUSPENDED" : "REACTIVATED"}`, actor: actor.user, targetUserId: target.id, details: { reason } });
    return { success: true, status: activate ? "ACTIVE" : "SUSPENDED", version: version + 1 };
  });
}

async function addRole(client: PrismaClient, actor: IamActor, target: UserTarget, role: Role, input: Record<string, unknown>, reason: string, version: number) {
  const validUntil = optionalFutureDate(input.validUntil, "Role validity");
  return client.$transaction(async (tx) => {
    if (role === "SUPER_ADMIN") await acquireLastSuperAdminLock(tx);
    const current = await tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { version: true } });
    if (current.version !== version) throw new Error("The user changed; refresh and try again");
    if (role === "SUPER_ADMIN" && await hasCriticalSuperAdminDenial(tx, target.id)) {
      throw new Error("Resolve critical profile or individual denials before granting Super Admin");
    }
    if (await tx.userRoleAssignment.count({ where: { userId: target.id, role, status: "ACTIVE" } })) throw new Error("That base role is already active for this user");
    await tx.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: target.id, role, reason, assignedByUserId: actor.user.id, validUntil, activeKey: `${target.id}:${role}` } });
    await bumpAuthorizationAndRevokeSessions(tx, target.id, "IAM_ROLE_ASSIGNED");
    await logUserAction(tx, { action: "IAM_ROLE_ASSIGNED", actor: actor.user, targetUserId: target.id, details: { role: roleDisplayLabel(role), validUntil: validUntil?.toISOString() ?? null, reason } });
    return { success: true, version: version + 1 };
  });
}

async function endRole(client: PrismaClient, actor: IamActor, target: UserTarget, input: Record<string, unknown>, reason: string, version: number) {
  const handle = boundedText(input.assignmentHandle, "Role assignment", 10, 80);
  return client.$transaction(async (tx) => {
    const assignment = await tx.userRoleAssignment.findFirst({ where: { publicKey: handle, userId: target.id, status: "ACTIVE" } });
    if (!assignment) throw new Error("Active role assignment not found");
    if (assignment.role === "SUPER_ADMIN") {
      await acquireLastSuperAdminLock(tx);
      if (await countActiveSuperAdmins(tx) <= 1) throw new Error("The last active Super Admin role cannot be ended");
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { version: true } });
    if (user.version !== version) throw new Error("The user changed; refresh and try again");
    const remaining = await tx.userRoleAssignment.count({ where: { userId: target.id, status: "ACTIVE", id: { not: assignment.id } } });
    if (!remaining) throw new Error("A user must retain at least one active base role");
    const now = new Date();
    await tx.userRoleAssignment.update({ where: { id: assignment.id }, data: { status: "ENDED", endedAt: now, endedByUserId: actor.user.id, activeKey: null, reason, version: { increment: 1 }, contextVersion: { increment: 1 } } });
    await bumpAuthorizationAndRevokeSessions(tx, target.id, "IAM_ROLE_ENDED", now);
    await logUserAction(tx, { action: "IAM_ROLE_ENDED", actor: actor.user, targetUserId: target.id, details: { role: roleDisplayLabel(assignment.role), reason } });
    return { success: true, version: version + 1 };
  });
}

async function assignProfile(client: PrismaClient, actor: IamActor, target: UserTarget, input: Record<string, unknown>, reason: string, version: number) {
  await assertActorPermission(client, actor, "ASSIGN_PERMISSION_PROFILES");
  const handle = boundedText(input.profileHandle, "Permission profile", 10, 80);
  const profile = await client.permissionProfile.findUnique({ where: { publicKey: handle }, include: { entries: { where: { status: "ACTIVE", revokedAt: null } } } });
  if (!profile || profile.status !== "ACTIVE") throw new Error("Active permission profile not found");
  if (target.iamRoleAssignments.some((assignment) => assignment.role === "SUPER_ADMIN") && profile.entries.some((entry) => entry.effect === "DENY" && CRITICAL_SUPER_ADMIN_PERMISSIONS.has(entry.permission as CanonicalPermission))) {
    throw new Error("A profile cannot deny critical access to a Super Admin");
  }
  if (actor.user.role !== "SUPER_ADMIN") await assertActorMayDelegate(client, actor, profile.entries.filter((entry) => entry.effect === "ALLOW").map((entry) => entry.permission as CanonicalPermission));
  const validUntil = optionalFutureDate(input.validUntil, "Profile validity");
  return client.$transaction(async (tx) => {
    if ((await tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { version: true } })).version !== version) throw new Error("The user changed; refresh and try again");
    await tx.userPermissionProfileAssignment.create({ data: { publicKey: randomUUID(), userId: target.id, profileId: profile.id, reason, assignedByUserId: actor.user.id, validUntil, activeKey: `${target.id}:${profile.id}` } });
    await bumpAuthorizationAndRevokeSessions(tx, target.id, "IAM_PROFILE_ASSIGNED");
    await logUserAction(tx, { action: "IAM_PROFILE_ASSIGNED", actor: actor.user, targetUserId: target.id, details: { profileName: profile.name, validUntil: validUntil?.toISOString() ?? null, reason } });
    return { success: true, version: version + 1 };
  });
}

async function endProfile(client: PrismaClient, actor: IamActor, target: UserTarget, input: Record<string, unknown>, reason: string, version: number) {
  await assertActorPermission(client, actor, "ASSIGN_PERMISSION_PROFILES");
  const handle = boundedText(input.assignmentHandle, "Profile assignment", 10, 80);
  return client.$transaction(async (tx) => {
    if ((await tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { version: true } })).version !== version) throw new Error("The user changed; refresh and try again");
    const assignment = await tx.userPermissionProfileAssignment.findFirst({ where: { publicKey: handle, userId: target.id, status: "ACTIVE" }, include: { profile: true } });
    if (!assignment) throw new Error("Active profile assignment not found");
    const now = new Date();
    await tx.userPermissionProfileAssignment.update({ where: { id: assignment.id }, data: { status: "ENDED", endedAt: now, endedByUserId: actor.user.id, activeKey: null, reason, version: { increment: 1 } } });
    await bumpAuthorizationAndRevokeSessions(tx, target.id, "IAM_PROFILE_ENDED", now);
    await logUserAction(tx, { action: "IAM_PROFILE_ENDED", actor: actor.user, targetUserId: target.id, details: { profileName: assignment.profile.name, reason } });
    return { success: true, version: version + 1 };
  });
}

async function setOverride(client: PrismaClient, actor: IamActor, target: UserTarget, input: Record<string, unknown>, reason: string, version: number) {
  await assertActorPermission(client, actor, "MANAGE_USER_PERMISSION_OVERRIDES");
  const permission = asCanonicalPermission(input.permission);
  const effect = String(input.effect ?? "");
  if (!["ALLOW", "DENY"].includes(effect)) throw new Error("Override effect is invalid");
  if (SUPER_ADMIN_ONLY_PERMISSIONS.has(permission)) throw new Error(`${permission} cannot be changed by an individual override`);
  if (
    effect === "DENY" &&
    target.iamRoleAssignments.some((assignment) => assignment.role === "SUPER_ADMIN") &&
    CRITICAL_SUPER_ADMIN_PERMISSIONS.has(permission)
  ) throw new Error("Critical Super Admin access cannot be denied");
  if (effect === "ALLOW" && actor.user.role !== "SUPER_ADMIN") await assertActorMayDelegate(client, actor, [permission]);
  const validUntil = optionalFutureDate(input.validUntil, "Override validity");
  return client.$transaction(async (tx) => {
    if ((await tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { version: true } })).version !== version) throw new Error("The user changed; refresh and try again");
    const previous = await tx.userPermissionOverride.findFirst({ where: { userId: target.id, permission, status: "ACTIVE" } });
    const now = new Date();
    if (previous) await tx.userPermissionOverride.update({ where: { id: previous.id }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actor.user.id, activeKey: null, version: { increment: 1 } } });
    await tx.userPermissionOverride.create({ data: { publicKey: randomUUID(), userId: target.id, permission, effect, reason, createdByUserId: actor.user.id, validUntil, supersedesId: previous?.id ?? null, activeKey: `${target.id}:${permission}` } });
    await bumpAuthorizationAndRevokeSessions(tx, target.id, "IAM_PERMISSION_OVERRIDE_CHANGED", now);
    await logUserAction(tx, { action: "IAM_PERMISSION_OVERRIDE_SET", actor: actor.user, targetUserId: target.id, details: { permission, effect, validUntil: validUntil?.toISOString() ?? null, source: "Individual override", reason } });
    return { success: true, version: version + 1 };
  });
}

async function revokeOverride(client: PrismaClient, actor: IamActor, target: UserTarget, input: Record<string, unknown>, reason: string, version: number) {
  await assertActorPermission(client, actor, "MANAGE_USER_PERMISSION_OVERRIDES");
  const handle = boundedText(input.overrideHandle, "Individual override", 10, 80);
  return client.$transaction(async (tx) => {
    if ((await tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { version: true } })).version !== version) throw new Error("The user changed; refresh and try again");
    const row = await tx.userPermissionOverride.findFirst({ where: { publicKey: handle, userId: target.id, status: "ACTIVE" } });
    if (!row) throw new Error("Active individual override not found");
    const now = new Date();
    await tx.userPermissionOverride.update({ where: { id: row.id }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actor.user.id, activeKey: null, reason, version: { increment: 1 } } });
    await bumpAuthorizationAndRevokeSessions(tx, target.id, "IAM_PERMISSION_OVERRIDE_REVOKED", now);
    await logUserAction(tx, { action: "IAM_PERMISSION_OVERRIDE_REVOKED", actor: actor.user, targetUserId: target.id, details: { permission: row.permission, effect: row.effect, reason } });
    return { success: true, version: version + 1 };
  });
}

async function updateIdentity(client: PrismaClient, actor: IamActor, target: UserTarget, input: Record<string, unknown>, reason: string, version: number) {
  const name = boundedText(input.name, "Display name", 2, 100);
  const designation = optionalBoundedText(input.designation, "Designation", 100);
  const username = input.username === undefined ? target.username : normalizeUsername(input.username);
  const email = input.email === undefined ? target.email : optionalBoundedText(input.email, "Email", 254)?.toLowerCase() ?? null;
  const usernameChanged = normalizeAliasValue("USERNAME", target.username) !== normalizeAliasValue("USERNAME", username);
  return client.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: target.id, version },
      data: {
        name,
        designation,
        username,
        email,
        version: { increment: 1 },
        ...(usernameChanged ? { credentialVersion: { increment: 1 }, authorizationVersion: { increment: 1 } } : {})
      }
    });
    if (changed.count !== 1) throw new Error("The user changed; refresh and try again");
    if (usernameChanged) {
      const now = new Date();
      const existingAlias = await tx.authLoginAlias.findFirst({ where: { userId: target.id, type: "USERNAME", status: "VERIFIED", removedAt: null } });
      if (existingAlias) {
        await tx.authLoginAlias.update({ where: { id: existingAlias.id }, data: { status: "REMOVED", removedAt: now, version: { increment: 1 } } });
        await tx.authVerificationChallenge.updateMany({ where: { aliasId: existingAlias.id, usedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
        await tx.authPasswordResetToken.updateMany({ where: { aliasId: existingAlias.id, usedAt: null, invalidatedAt: null }, data: { invalidatedAt: now, invalidationReason: "ALIAS_REPLACED" } });
      }
      await tx.authLoginAlias.create({ data: { id: randomUUID(), userId: target.id, type: "USERNAME", normalizedValue: normalizeAliasValue("USERNAME", username), displayMasked: maskAlias("USERNAME", username), status: "VERIFIED", isSchoolGoverned: true, verifiedAt: now } });
      await tx.authSession.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now, revocationReason: "LOGIN_IDENTIFIER_CHANGED" } });
      await logAuthSecurityEvent(tx, { eventType: "LOGIN_ALIAS_REPLACED_BY_ADMIN", userId: target.id, actorUserId: actor.user.id, subjectType: "USER", subjectId: target.id, details: { aliasType: "USERNAME", sessionsRevoked: true } });
    }
    await logUserAction(tx, { action: "IAM_USER_IDENTITY_UPDATED", actor: actor.user, targetUserId: target.id, details: { designation: designation ?? "Not set", usernameChanged, reason } });
    return { success: true, version: version + 1 };
  });
}

async function assertRoleAssignmentDelegation(client: PrismaClient, actor: IamActor, roles: Role[]) {
  for (const role of roles) {
    if (role === "SUPER_ADMIN") continue;
    if (actor.user.role === "SUPER_ADMIN") continue;
    const permissions = await getEffectivePermissions(client, role);
    await assertActorMayDelegate(client, actor, permissions);
  }
}

async function assertSuperAdminGrantAllowed(client: PrismaClient, actor: IamActor) {
  if (actor.user.role !== "SUPER_ADMIN") throw new Error("Only an active Super Admin may grant Super Admin");
  await assertActorPermission(client, actor, "GRANT_SUPER_ADMIN");
}

async function hasCriticalSuperAdminDenial(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
  const critical = [...CRITICAL_SUPER_ADMIN_PERMISSIONS];
  const [individual, profile] = await Promise.all([
    tx.userPermissionOverride.findFirst({
      where: { userId, permission: { in: critical }, effect: "DENY", status: "ACTIVE", revokedAt: null, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      select: { id: true }
    }),
    tx.userPermissionProfileAssignment.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        profile: {
          status: "ACTIVE",
          entries: { some: { permission: { in: critical }, effect: "DENY", status: "ACTIVE", revokedAt: null, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } }
        }
      },
      select: { id: true }
    })
  ]);
  return Boolean(individual || profile);
}

function assertManagementBoundary(actor: IamActor, targetRoles: Role[]) {
  if (actor.user.role === "SUPER_ADMIN") return;
  if (targetRoles.includes("SUPER_ADMIN")) throw new Error("Only a Super Admin may manage another Super Admin");
  const permitted: Partial<Record<Role, Role[]>> = {
    DIRECTOR: ["PRINCIPAL", "ADMIN", "ACCOUNTANT", "COMPUTER_OPERATOR", "TEACHER", "PARENT", "VIEWER"],
    PRINCIPAL: ["COMPUTER_OPERATOR", "TEACHER", "PARENT", "VIEWER"],
    ADMIN: ["ACCOUNTANT", "COMPUTER_OPERATOR", "TEACHER", "PARENT", "VIEWER"],
    COMPUTER_OPERATOR: ["PARENT", "VIEWER"]
  };
  if (targetRoles.some((role) => !(permitted[actor.user.role] ?? []).includes(role))) throw new Error("The target user is outside your delegated administration boundary");
}

function safeAuditDetails(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    for (const key of Object.keys(parsed)) if (/id|hash|token|password|credential/i.test(key)) delete parsed[key];
    return parsed;
  } catch {
    return null;
  }
}

type UserTarget = Prisma.UserGetPayload<{ include: { iamRoleAssignments: true } }>;
