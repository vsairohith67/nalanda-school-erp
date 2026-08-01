import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { isRole } from "@/lib/permissions";
import { roleDisplayLabel } from "@/lib/role-presentation";
import { logUserAction } from "@/lib/user-audit";

type ContextClient = PrismaClient | Prisma.TransactionClient;

function contextSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Session security is not configured");
  return secret;
}

function opaqueHandle(purpose: "ROLE" | "CHILD", userId: string, authorizationVersion: number, privateKey: string, contextVersion: number) {
  return createHmac("sha256", contextSecret())
    .update(`IAM1A|${purpose}|${userId}|${authorizationVersion}|${contextVersion}|${privateKey}`)
    .digest("base64url");
}

function handleMatches(actual: string, expected: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(actual) || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function listRoleContexts(client: ContextClient, input: { userId: string; sessionId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const [user, session, assignments] = await Promise.all([
    client.user.findUnique({ where: { id: input.userId }, select: { authorizationVersion: true, designation: true, isActive: true, lifecycleStatus: true } }),
    client.authSession.findFirst({ where: { id: input.sessionId, userId: input.userId } }),
    client.userRoleAssignment.findMany({
      where: {
        userId: input.userId,
        status: "ACTIVE",
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }]
      },
      orderBy: [{ createdAt: "asc" }],
      take: 12
    })
  ]);
  if (!user || !user.isActive || user.lifecycleStatus !== "ACTIVE" || !session || session.revokedAt || session.expiresAt <= now || session.authorizationVersion !== user.authorizationVersion) {
    throw new Error("The current session is no longer valid");
  }
  const contexts = assignments.filter((assignment) => isRole(assignment.role)).map((assignment) => ({
    handle: opaqueHandle("ROLE", input.userId, user.authorizationVersion, assignment.publicKey, assignment.contextVersion),
    label: roleDisplayLabel(assignment.role),
    designation: user.designation,
    active: assignment.id === session.activeRoleAssignmentId,
    validUntil: assignment.validUntil?.toISOString() ?? null
  }));
  return { contexts, contextVersion: session.contextVersion, pickerRequired: contexts.length > 1 };
}

export async function switchRoleContext(client: PrismaClient, input: {
  userId: string;
  sessionId: string;
  handle: string;
  expectedVersion: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return client.$transaction(async (tx) => {
    const [user, session, assignments] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, isActive: true, lifecycleStatus: true, authorizationVersion: true, guardianId: true } }),
      tx.authSession.findFirst({ where: { id: input.sessionId, userId: input.userId } }),
      tx.userRoleAssignment.findMany({
        where: { userId: input.userId, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
        take: 12
      })
    ]);
    if (!user || !user.isActive || user.lifecycleStatus !== "ACTIVE" || !session || session.revokedAt || session.expiresAt <= now || session.authorizationVersion !== user.authorizationVersion) {
      throw new Error("The current session is no longer valid");
    }
    if (session.contextVersion !== input.expectedVersion) throw new Error("The active context changed; refresh and try again");
    const assignment = assignments.find((candidate) => handleMatches(
      input.handle,
      opaqueHandle("ROLE", user.id, user.authorizationVersion, candidate.publicKey, candidate.contextVersion)
    ));
    if (!assignment || !isRole(assignment.role)) throw new Error("The selected role context is unavailable");
    let activeChildLinkId: string | null = null;
    if (assignment.role === "PARENT" && user.guardianId) {
      const links = await tx.studentGuardian.findMany({ where: { guardianId: user.guardianId }, select: { id: true }, take: 2 });
      activeChildLinkId = links.length === 1 ? links[0].id : null;
    }
    const changed = await tx.authSession.updateMany({
      where: { id: session.id, userId: user.id, contextVersion: input.expectedVersion, revokedAt: null },
      data: {
        activeRoleAssignmentId: assignment.id,
        activeChildLinkId,
        contextVersion: { increment: 1 },
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw new Error("The active context changed; refresh and try again");
    await logUserAction(tx, {
      action: "IAM_ROLE_CONTEXT_SWITCHED",
      actor: { id: user.id, name: user.name },
      targetUserId: user.id,
      details: { role: roleDisplayLabel(assignment.role), selectedChildContext: Boolean(activeChildLinkId) }
    });
    return { role: roleDisplayLabel(assignment.role), contextVersion: input.expectedVersion + 1 };
  });
}

export async function listChildContexts(client: ContextClient, input: { userId: string; sessionId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const [user, session] = await Promise.all([
    client.user.findUnique({ where: { id: input.userId }, select: { guardianId: true, authorizationVersion: true } }),
    client.authSession.findFirst({ where: { id: input.sessionId, userId: input.userId } })
  ]);
  if (!user?.guardianId || !session || session.revokedAt || session.expiresAt <= now || session.authorizationVersion !== user.authorizationVersion) {
    throw new Error("Parent child context is unavailable");
  }
  const assignment = session.activeRoleAssignmentId
    ? await client.userRoleAssignment.findFirst({ where: { id: session.activeRoleAssignmentId, userId: input.userId, role: "PARENT", status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } })
    : null;
  if (!assignment) throw new Error("Switch to the Parent context before choosing a child");
  const links = await client.studentGuardian.findMany({
    where: { guardianId: user.guardianId },
    include: { student: { select: { admissionNo: true, studentName: true, className: true, section: true, status: true } } },
    orderBy: { student: { studentName: "asc" } },
    take: 20
  });
  const selected = session.activeChildLinkId && links.some((link) => link.id === session.activeChildLinkId)
    ? session.activeChildLinkId
    : links.length === 1 ? links[0].id : null;
  return {
    children: links.map((link) => ({
      handle: opaqueHandle("CHILD", input.userId, user.authorizationVersion, link.id, session.contextVersion),
      name: link.student.studentName,
      admissionNo: link.student.admissionNo,
      className: link.student.className,
      section: link.student.section,
      status: link.student.status,
      active: link.id === selected
    })),
    contextVersion: session.contextVersion,
    pickerRequired: links.length > 1
  };
}

export async function switchChildContext(client: PrismaClient, input: {
  userId: string;
  sessionId: string;
  handle: string;
  expectedVersion: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return client.$transaction(async (tx) => {
    const [user, session] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, guardianId: true, authorizationVersion: true } }),
      tx.authSession.findFirst({ where: { id: input.sessionId, userId: input.userId } })
    ]);
    if (!user?.guardianId || !session || session.revokedAt || session.expiresAt <= now || session.contextVersion !== input.expectedVersion || session.authorizationVersion !== user.authorizationVersion) {
      throw new Error("Parent child context is no longer valid");
    }
    const assignment = session.activeRoleAssignmentId
      ? await tx.userRoleAssignment.findFirst({ where: { id: session.activeRoleAssignmentId, userId: user.id, role: "PARENT", status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } })
      : null;
    if (!assignment) throw new Error("Switch to the Parent context before choosing a child");
    const links = await tx.studentGuardian.findMany({ where: { guardianId: user.guardianId }, select: { id: true }, take: 20 });
    const selected = links.find((link) => handleMatches(
      input.handle,
      opaqueHandle("CHILD", user.id, user.authorizationVersion, link.id, session.contextVersion)
    ));
    if (!selected) throw new Error("The selected child is not linked to this Parent account");
    const changed = await tx.authSession.updateMany({
      where: { id: session.id, userId: user.id, contextVersion: input.expectedVersion, revokedAt: null },
      data: { activeChildLinkId: selected.id, contextVersion: { increment: 1 }, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw new Error("Parent child context changed; refresh and try again");
    await logUserAction(tx, {
      action: "IAM_CHILD_CONTEXT_SWITCHED",
      actor: { id: user.id, name: user.name },
      targetUserId: user.id,
      details: { linkedChildSelected: true }
    });
    return { contextVersion: input.expectedVersion + 1 };
  });
}
