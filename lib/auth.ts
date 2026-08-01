import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRole, type Permission, type Role } from "@/lib/permissions";
import { evaluateEffectivePermission, getUserEffectivePermissions } from "@/lib/iam/effective-access";
import {
  SESSION_COOKIE
} from "@/lib/session-token";
import { resolvePersistedSession } from "@/lib/auth-sessions";
import { isFirstRunRequired } from "@/lib/setup";

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  designation: string | null;
  role: Role;
  roleAssignmentId: string;
  authorizationVersion: number;
  mustChangePassword: boolean;
  guardianId: string | null;
};

export const getCurrentAuthContext = cache(async (): Promise<{ user: AuthUser; sessionId: string } | null> => {
  const cookieStore = await cookies();
  const session = await resolvePersistedSession(prisma, cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || !isRole(session.activeRoleAssignment.role)) return null;
  return { sessionId: session.id, user: {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    email: session.user.email,
    designation: session.user.designation,
    role: session.activeRoleAssignment.role,
    roleAssignmentId: session.activeRoleAssignment.id,
    authorizationVersion: session.user.authorizationVersion,
    mustChangePassword: session.user.mustChangePassword,
    guardianId: session.user.guardianId
  } };
});

export async function getCurrentUser(): Promise<AuthUser | null> {
  return (await getCurrentAuthContext())?.user ?? null;
}

export async function requireUser() {
  if (await isFirstRunRequired(prisma)) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export async function requirePermission(permission: Permission) {
  if (await isFirstRunRequired(prisma)) redirect("/setup");
  const context = await getCurrentAuthContext();
  if (!context) redirect("/login");
  if (context.user.mustChangePassword) redirect("/change-password");
  const decision = await evaluateEffectivePermission(prisma, {
    userId: context.user.id,
    sessionId: context.sessionId,
    roleAssignmentId: context.user.roleAssignmentId,
    permission
  });
  if (!decision.allowed) redirect("/unauthorized");
  return context.user;
}

export async function requireRolePermission(permission: Permission, requiredRole: Role) {
  const user = await requirePermission(permission);
  if (user.role !== requiredRole) redirect("/unauthorized");
  return user;
}

export async function requireApiPermission(permission: Permission) {
  if (await isFirstRunRequired(prisma)) {
    return {
      response: NextResponse.json(
        { error: "First-run setup is required before using this API", setupRequired: true },
        { status: 503 }
      ),
      user: null
    };
  }
  const context = await getCurrentAuthContext();
  if (!context) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }), user: null };
  }
  if (context.user.mustChangePassword) {
    return { response: NextResponse.json({ error: "Password change required", passwordChangeRequired: true }, { status: 403 }), user: null };
  }
  const decision = await evaluateEffectivePermission(prisma, {
    userId: context.user.id,
    sessionId: context.sessionId,
    roleAssignmentId: context.user.roleAssignmentId,
    permission
  });
  if (!decision.allowed) {
    return { response: NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 }), user: null };
  }
  return { response: null, user: context.user };
}

export async function hasUserPermission(user: AuthUser, permission: Permission | string) {
  const context = await getCurrentAuthContext();
  if (!context || context.user.id !== user.id || context.user.roleAssignmentId !== user.roleAssignmentId) return false;
  return (await evaluateEffectivePermission(prisma, {
    userId: user.id,
    sessionId: context.sessionId,
    roleAssignmentId: user.roleAssignmentId,
    permission
  })).allowed;
}

export async function getCurrentUserEffectivePermissions() {
  const context = await getCurrentAuthContext();
  if (!context) return new Set<import("@/lib/permissions").CanonicalPermission>();
  return getUserEffectivePermissions(prisma, {
    userId: context.user.id,
    sessionId: context.sessionId,
    roleAssignmentId: context.user.roleAssignmentId
  });
}

export async function requireApiRolePermission(permission: Permission, requiredRole: Role) {
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth;
  if (auth.user.role !== requiredRole) {
    return {
      response: NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 }),
      user: null
    };
  }
  return auth;
}
