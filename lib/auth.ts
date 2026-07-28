import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRole, type Permission, type Role } from "@/lib/permissions";
import { hasRolePermission } from "@/lib/role-permissions";
import {
  SESSION_COOKIE,
  sessionAccountStateMatches,
  verifySessionToken
} from "@/lib/session-token";
import { isFirstRunRequired } from "@/lib/setup";

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: Role;
  guardianId: string | null;
};

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies();
  const payload = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      guardianId: true,
      isActive: true,
      passwordHash: true
    }
  });
  if (
    !user ||
    !isRole(user.role) ||
    !(await sessionAccountStateMatches(payload, {
      isActive: user.isActive,
      role: user.role,
      passwordHash: user.passwordHash
    }))
  ) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    guardianId: user.guardianId
  };
});

export async function requireUser() {
  if (await isFirstRunRequired(prisma)) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (user.role === "VIEWER" && permission === "VIEW_LIBRARY_STOCK_VERIFICATION") redirect("/unauthorized");
  if (!(await hasRolePermission(prisma, user.role, permission))) redirect("/unauthorized");
  return user;
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
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }), user: null };
  }
  if (user.role === "VIEWER" && permission === "VIEW_LIBRARY_STOCK_VERIFICATION") {
    return { response: NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 }), user: null };
  }
  if (!(await hasRolePermission(prisma, user.role, permission))) {
    return { response: NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 }), user: null };
  }
  return { response: null, user };
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
