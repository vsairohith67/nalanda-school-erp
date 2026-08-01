import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { CanonicalPermission } from "@/lib/permissions";
import { CRITICAL_SUPER_ADMIN_PERMISSIONS } from "@/lib/iam/permission-governance";
import { logUserAction } from "@/lib/user-audit";
import {
  assertActorMayDelegate,
  assertActorPermission,
  bumpAuthorizationAndRevokeSessions,
  requireCriticalReauthentication,
  type IamActor
} from "@/lib/iam/security";
import {
  boundedText,
  expectedVersion,
  normalizedProfileName,
  optionalBoundedText,
  profileEntriesInput,
  reasonText
} from "@/lib/iam/validation";

export async function createPermissionProfile(client: PrismaClient, actor: IamActor, input: Record<string, unknown>) {
  await assertActorPermission(client, actor, "MANAGE_PERMISSION_PROFILES");
  await requireCriticalReauthentication(client, actor, String(input.reauthPassword ?? ""));
  const name = boundedText(input.name, "Profile name", 3, 80);
  const description = optionalBoundedText(input.description, "Description", 300);
  const reason = reasonText(input.reason);
  const entries = profileEntriesInput(input.entries);
  if (actor.user.role !== "SUPER_ADMIN") {
    await assertActorMayDelegate(client, actor, entries.filter((entry) => entry.effect === "ALLOW").map((entry) => entry.permission));
  }
  return client.$transaction(async (tx) => {
    const profile = await tx.permissionProfile.create({
      data: {
        publicKey: randomUUID(),
        name,
        normalizedName: normalizedProfileName(name),
        description,
        status: "ACTIVE",
        version: 1,
        createdByUserId: actor.user.id,
        updatedByUserId: actor.user.id,
        entries: {
          create: entries.map((entry) => ({
            permission: entry.permission,
            effect: entry.effect,
            reason,
            createdByUserId: actor.user.id,
            activeKey: `${randomUUID()}:${entry.permission}`
          }))
        }
      },
      include: { entries: true }
    });
    await tx.permissionProfileVersion.create({
      data: {
        profileId: profile.id,
        versionNumber: 1,
        snapshotJson: profileSnapshot(profile),
        reason,
        createdByUserId: actor.user.id
      }
    });
    await logUserAction(tx, {
      action: "IAM_PERMISSION_PROFILE_CREATED",
      actor: actor.user,
      details: { profileName: profile.name, version: profile.version, allowCount: entries.filter((entry) => entry.effect === "ALLOW").length, denyCount: entries.filter((entry) => entry.effect === "DENY").length, reason }
    });
    return serializeProfile(profile, 0);
  });
}

export async function clonePermissionProfile(client: PrismaClient, actor: IamActor, profileKey: string, input: Record<string, unknown>) {
  await assertActorPermission(client, actor, "MANAGE_PERMISSION_PROFILES");
  const source = await client.permissionProfile.findUnique({ where: { publicKey: profileKey }, include: { entries: true } });
  if (!source) throw new Error("Permission profile not found");
  const entries = source.entries.filter((entry) => entry.status === "ACTIVE" && !entry.revokedAt).map((entry) => ({ permission: entry.permission, effect: entry.effect }));
  return createPermissionProfile(client, actor, {
    ...input,
    name: input.name ?? `${source.name} Copy`,
    description: input.description ?? source.description,
    entries
  });
}

export async function updatePermissionProfile(client: PrismaClient, actor: IamActor, profileKey: string, input: Record<string, unknown>) {
  await assertActorPermission(client, actor, "MANAGE_PERMISSION_PROFILES");
  await requireCriticalReauthentication(client, actor, String(input.reauthPassword ?? ""));
  const nextVersion = expectedVersion(input.expectedVersion);
  const name = boundedText(input.name, "Profile name", 3, 80);
  const description = optionalBoundedText(input.description, "Description", 300);
  const reason = reasonText(input.reason);
  const entries = profileEntriesInput(input.entries);
  const criticalDenials = entries.filter((entry) => entry.effect === "DENY" && CRITICAL_SUPER_ADMIN_PERMISSIONS.has(entry.permission));
  if (actor.user.role !== "SUPER_ADMIN") {
    await assertActorMayDelegate(client, actor, entries.filter((entry) => entry.effect === "ALLOW").map((entry) => entry.permission));
  }
  return client.$transaction(async (tx) => {
    const current = await tx.permissionProfile.findUnique({ where: { publicKey: profileKey }, include: { entries: true } });
    if (!current || current.status !== "ACTIVE") throw new Error("Active permission profile not found");
    if (current.version !== nextVersion) throw new Error("The profile changed; refresh and review affected users");
    const affectedAssignments = await tx.userPermissionProfileAssignment.findMany({
      where: { profileId: current.id, status: "ACTIVE" },
      select: { userId: true }
    });
    const affectedUserIds = [...new Set(affectedAssignments.map((assignment) => assignment.userId))];
    if (criticalDenials.length && affectedUserIds.length) {
      const now = new Date();
      const affectedSuperAdmins = await tx.userRoleAssignment.count({
        where: {
          userId: { in: affectedUserIds },
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          user: { isActive: true, lifecycleStatus: "ACTIVE" }
        }
      });
      if (affectedSuperAdmins) throw new Error("A shared profile cannot deny critical access to an active Super Admin");
    }
    if (affectedUserIds.length && input.impactAcknowledged !== true) {
      throw new Error(`${affectedUserIds.length} user(s) are affected; review and acknowledge the shared-profile impact`);
    }
    const changed = await tx.permissionProfile.updateMany({
      where: { id: current.id, version: nextVersion, status: "ACTIVE" },
      data: { name, normalizedName: normalizedProfileName(name), description, version: { increment: 1 }, updatedByUserId: actor.user.id }
    });
    if (changed.count !== 1) throw new Error("The profile changed; refresh and try again");
    const now = new Date();
    await tx.permissionProfileEntry.updateMany({
      where: { profileId: current.id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now, revokedByUserId: actor.user.id, activeKey: null, version: { increment: 1 } }
    });
    for (const entry of entries) {
      await tx.permissionProfileEntry.create({
        data: {
          profileId: current.id,
          permission: entry.permission,
          effect: entry.effect,
          reason,
          createdByUserId: actor.user.id,
          supersedesId: current.entries.find((existing) => existing.permission === entry.permission && existing.status === "ACTIVE")?.id ?? null,
          activeKey: `${current.id}:${entry.permission}`
        }
      });
    }
    const updated = await tx.permissionProfile.findUniqueOrThrow({ where: { id: current.id }, include: { entries: true } });
    await tx.permissionProfileVersion.create({
      data: { profileId: current.id, versionNumber: updated.version, snapshotJson: profileSnapshot(updated), reason, createdByUserId: actor.user.id }
    });
    for (const userId of affectedUserIds) await bumpAuthorizationAndRevokeSessions(tx, userId, "IAM_PROFILE_CHANGED", now);
    await logUserAction(tx, {
      action: "IAM_PERMISSION_PROFILE_VERSIONED",
      actor: actor.user,
      details: { profileName: updated.name, version: updated.version, affectedUsers: affectedUserIds.length, reason }
    });
    return serializeProfile(updated, affectedUserIds.length);
  });
}

export async function archivePermissionProfile(client: PrismaClient, actor: IamActor, profileKey: string, input: Record<string, unknown>) {
  await assertActorPermission(client, actor, "MANAGE_PERMISSION_PROFILES");
  await requireCriticalReauthentication(client, actor, String(input.reauthPassword ?? ""));
  const version = expectedVersion(input.expectedVersion);
  const reason = reasonText(input.reason);
  return client.$transaction(async (tx) => {
    const profile = await tx.permissionProfile.findUnique({ where: { publicKey: profileKey } });
    if (!profile || profile.status !== "ACTIVE") throw new Error("Active permission profile not found");
    const assignments = await tx.userPermissionProfileAssignment.findMany({ where: { profileId: profile.id, status: "ACTIVE" }, select: { userId: true } });
    const userIds = [...new Set(assignments.map((assignment) => assignment.userId))];
    if (userIds.length && input.impactAcknowledged !== true) throw new Error(`${userIds.length} user(s) are affected; acknowledge the archive impact`);
    const now = new Date();
    const changed = await tx.permissionProfile.updateMany({
      where: { id: profile.id, version, status: "ACTIVE" },
      data: { status: "ARCHIVED", archivedAt: now, version: { increment: 1 }, updatedByUserId: actor.user.id }
    });
    if (changed.count !== 1) throw new Error("The profile changed; refresh and try again");
    for (const userId of userIds) await bumpAuthorizationAndRevokeSessions(tx, userId, "IAM_PROFILE_ARCHIVED", now);
    const archived = await tx.permissionProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { entries: true } });
    await tx.permissionProfileVersion.create({
      data: { profileId: profile.id, versionNumber: archived.version, snapshotJson: profileSnapshot(archived), reason, createdByUserId: actor.user.id }
    });
    await logUserAction(tx, { action: "IAM_PERMISSION_PROFILE_ARCHIVED", actor: actor.user, details: { profileName: profile.name, affectedUsers: userIds.length, reason } });
    return serializeProfile(archived, userIds.length);
  });
}

export async function listPermissionProfiles(client: PrismaClient) {
  const profiles = await client.permissionProfile.findMany({
    include: {
      entries: { where: { status: "ACTIVE", revokedAt: null }, orderBy: { permission: "asc" } },
      _count: { select: { assignments: { where: { status: "ACTIVE" } } } }
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 200
  });
  return profiles.map((profile) => serializeProfile(profile, profile._count.assignments));
}

function profileSnapshot(profile: { name: string; description: string | null; status: string; version: number; entries: Array<{ permission: string; effect: string; status: string; revokedAt: Date | null }> }) {
  return JSON.stringify({
    name: profile.name,
    description: profile.description,
    status: profile.status,
    version: profile.version,
    entries: profile.entries.filter((entry) => entry.status === "ACTIVE" && !entry.revokedAt).map((entry) => ({ permission: entry.permission, effect: entry.effect })).sort((a, b) => a.permission.localeCompare(b.permission))
  });
}

function serializeProfile(profile: { publicKey: string; name: string; description: string | null; status: string; version: number; updatedAt: Date; entries: Array<{ permission: string; effect: string; status: string; revokedAt: Date | null }> }, affectedUsers: number) {
  return {
    handle: profile.publicKey,
    name: profile.name,
    description: profile.description,
    status: profile.status,
    version: profile.version,
    updatedAt: profile.updatedAt.toISOString(),
    affectedUsers,
    entries: profile.entries.filter((entry) => entry.status === "ACTIVE" && !entry.revokedAt).map((entry) => ({ permission: entry.permission, effect: entry.effect as "ALLOW" | "DENY" }))
  };
}
