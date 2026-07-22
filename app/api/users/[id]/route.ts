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

      const role = String(body.role ?? existing.role);
      if (!isRole(role)) throw new Error("A valid role is required");
      assertCanAssignRole(auth.user.role, role);
      const isActive = body.isActive === undefined ? existing.isActive : body.isActive === true;
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
      const username = requiredText(body.username ?? existing.username, "Username").toLowerCase();
      const email = optionalText(body.email)?.toLowerCase() ?? null;
      const result = await tx.user.update({
        where: { id },
        data: { name, username, email, role, isActive },
        select: SAFE_USER_SELECT
      });
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
          details: { username }
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
