import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRole, type Permission, type Role } from "@/lib/permissions";
import { hasRolePermission } from "@/lib/role-permissions";
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
  role: Role;
  guardianId: string | null;
};

export const getCurrentAuthContext = cache(async (): Promise<{ user: AuthUser; sessionId: string } | null> => {
  const cookieStore = await cookies();
  const session = await resolvePersistedSession(prisma, cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || !isRole(session.user.role)) return null;
  return { sessionId: session.id, user: {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    email: session.user.email,
    role: session.user.role,
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
