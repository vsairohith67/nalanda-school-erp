import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { isRole } from "@/lib/permissions";
import {
  assertCanAssignRole,
  assertCanManageUser,
  assertDirectorDeactivationAllowed,
  assertSuperAdminSafetyAllowed,
  SAFE_USER_SELECT
} from "@/lib/user-management";
import { logUserAction } from "@/lib/user-audit";
import { maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { randomUUID } from "node:crypto";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_USERS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing || !isRole(existing.role)) return null;
      assertCanManageUser(auth.user.role, existing.role);
      const expectedUpdatedAt = requiredExpectedUpdatedAt(body.expectedUpdatedAt);
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new Error("User record changed; refresh and try again");
      }

      const role = String(body.role ?? existing.role);
      if (!isRole(role)) throw new Error("A valid role is required");
      assertCanAssignRole(auth.user.role, role);
      const isActive = body.isActive === undefined ? existing.isActive : body.isActive === true;
      const deactivationReason = existing.isActive && !isActive
        ? requiredDeactivationReason(body.reason)
        : null;
      const [activeDirectorCount, activeSuperAdminCount] = await Promise.all([
        tx.user.count({ where: { role: "DIRECTOR", isActive: true } }),
        tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true } })
      ]);
      assertDirectorDeactivationAllowed({
        targetRole: existing.role,
        targetIsActive: existing.isActive,
        nextIsActive: isActive,
        nextRole: role,
        activeDirectorCount
      });
      assertSuperAdminSafetyAllowed({
        actorUserId: auth.user.id,
        targetUserId: existing.id,
        targetRole: existing.role,
        targetIsActive: existing.isActive,
        nextIsActive: isActive,
        nextRole: role,
        activeSuperAdminCount
      });

      const name = requiredText(body.name ?? existing.name, "Name");
      const username = normalizeAliasValue("USERNAME", requiredText(body.username ?? existing.username, "Username"));
      const email = optionalText(body.email)?.toLowerCase() ?? null;
      const usernameChanged = normalizeAliasValue("USERNAME", existing.username) !== username;
      const accountSecurityChanged = existing.role !== role || existing.isActive !== isActive || usernameChanged;
      const changed = await tx.user.updateMany({
        where: {
          id,
          updatedAt: existing.updatedAt,
          role: existing.role,
          isActive: existing.isActive
        },
        data: {
          name,
          username,
          email,
          role,
          isActive,
          ...(accountSecurityChanged ? { credentialVersion: { increment: 1 } } : {})
        }
      });
      if (changed.count !== 1) throw new Error("User record changed; refresh and try again");
      const usernameAlias = await tx.authLoginAlias.findFirst({ where: { userId: id, type: "USERNAME", status: "VERIFIED", removedAt: null } });
      if (usernameAlias) {
        if (usernameAlias.normalizedValue !== username) {
          const now = new Date();
          await tx.authLoginAlias.update({
            where: { id: usernameAlias.id },
            data: { status: "REMOVED", removedAt: now, version: { increment: 1 } }
          });
          await tx.authVerificationChallenge.updateMany({
            where: { aliasId: usernameAlias.id, usedAt: null, invalidatedAt: null },
            data: { invalidatedAt: now }
          });
          await tx.authPasswordResetToken.updateMany({
            where: { aliasId: usernameAlias.id, usedAt: null, invalidatedAt: null },
            data: { invalidatedAt: now, invalidationReason: "ALIAS_REPLACED" }
          });
          await tx.authLoginAlias.create({
            data: {
              id: randomUUID(),
              userId: id,
              type: "USERNAME",
              normalizedValue: username,
              displayMasked: maskAlias("USERNAME", username),
              status: "VERIFIED",
              isSchoolGoverned: true,
              verifiedAt: now
            }
          });
          await logAuthSecurityEvent(tx, {
            eventType: "LOGIN_ALIAS_REPLACED_BY_ADMIN",
            userId: id,
            actorUserId: auth.user.id,
            subjectType: "LOGIN_ALIAS",
            subjectId: usernameAlias.id,
            details: { aliasType: "USERNAME" }
          });
        }
      } else {
        await tx.authLoginAlias.create({
          data: {
            id: randomUUID(),
            userId: id,
            type: "USERNAME",
            normalizedValue: username,
            displayMasked: maskAlias("USERNAME", username),
            status: "VERIFIED",
            isSchoolGoverned: true,
            verifiedAt: new Date()
          }
        });
      }
      if (accountSecurityChanged) {
        const now = new Date();
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: existing.isActive !== isActive
              ? "ACCOUNT_STATUS_CHANGED"
              : usernameChanged
                ? "LOGIN_IDENTIFIER_CHANGED"
                : "ROLE_CHANGED"
          }
        });
        await tx.authPasswordResetToken.updateMany({
          where: { userId: id, usedAt: null, invalidatedAt: null },
          data: { invalidatedAt: now, invalidationReason: "ACCOUNT_SECURITY_CHANGED" }
        });
        await tx.authVerificationChallenge.updateMany({
          where: { userId: id, usedAt: null, invalidatedAt: null },
          data: { invalidatedAt: now }
        });
        await logAuthSecurityEvent(tx, {
          eventType: existing.isActive !== isActive ? "ACCOUNT_STATUS_CHANGED" : "ACCOUNT_ROLE_CHANGED",
          userId: id,
          actorUserId: auth.user.id,
          subjectType: "USER",
          subjectId: id,
          details: { sessionsRevoked: true }
        });
      }
      const result = await tx.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
      if (!result) throw new Error("User not found");
      if (existing.role !== role) {
        await logUserAction(tx, {
          action: "USER_ROLE_CHANGED",
          actor: auth.user,
          targetUserId: id,
          details: { from: existing.role, to: role }
        });
      }
      if (existing.isActive !== isActive) {
        await logUserAction(tx, {
          action: isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
          actor: auth.user,
          targetUserId: id,
          details: isActive
            ? { role }
            : { role: existing.role, reason: deactivationReason }
        });
      }
      if (
        existing.name !== name ||
        existing.username !== username ||
        (existing.email ?? "") !== (email ?? "")
      ) {
        await logUserAction(tx, {
          action: "USER_PROFILE_UPDATED",
          actor: auth.user,
          targetUserId: id,
          details: { username }
        });
      }
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    const message = safeClientError(error, "Unable to update user");
    return NextResponse.json(
      { error: message.includes("Unique constraint") ? "Username or email is already in use" : message },
      { status: 400 }
    );
  }
}

function requiredText(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function optionalText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function requiredExpectedUpdatedAt(value: unknown) {
  const raw = requiredText(value, "Expected user version");
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Expected user version is invalid");
  return parsed;
}

function requiredDeactivationReason(value: unknown) {
  const result = requiredText(value, "Deactivation reason");
  if (result.length < 12 || result.length > 500) {
    throw new Error("Deactivation reason must be between 12 and 500 characters");
  }
  if (/[<>]/.test(result)) throw new Error("Deactivation reason contains unsupported characters");
  return result;
}
