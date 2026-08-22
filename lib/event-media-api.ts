import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requireApiPermission, requirePermission } from "@/lib/auth";
import { EventMediaError } from "@/lib/event-media";
import { EventMediaFileError } from "@/lib/event-media-files";
import type { Permission, Role } from "@/lib/permissions";

export const EVENT_MEDIA_PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } as const;
const EVENT_MEDIA_MANAGEMENT_ROLES = new Set<Role>(["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"]);

export function isEventMediaManagementRole(role: Role) {
  return EVENT_MEDIA_MANAGEMENT_ROLES.has(role);
}

export async function requireEventMediaManagementPermission(permission: Permission) {
  const user = await requirePermission(permission);
  if (!isEventMediaManagementRole(user.role)) redirect("/unauthorized");
  return user;
}

export async function requireEventMediaManagementApiPermission(permission: Permission) {
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth;
  if (!isEventMediaManagementRole(auth.user.role)) {
    return {
      response: NextResponse.json({ error: "Event Media management is restricted to authorised school leadership." }, { status: 403, headers: EVENT_MEDIA_PRIVATE_HEADERS }),
      user: null
    };
  }
  return auth;
}

export function eventMediaApiFailure(error: unknown) {
  if (error instanceof EventMediaError || error instanceof EventMediaFileError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: EVENT_MEDIA_PRIVATE_HEADERS });
  }
  console.error("EVENT_MEDIA_SAFE_ERROR", error instanceof Error ? error.message : "UNKNOWN");
  return NextResponse.json({ error: "Event Media could not complete the request.", code: "EVENT_MEDIA_INTERNAL_ERROR" }, { status: 500, headers: EVENT_MEDIA_PRIVATE_HEADERS });
}
