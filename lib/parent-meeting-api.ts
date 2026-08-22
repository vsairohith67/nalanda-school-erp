import { NextResponse } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { ParentMeetingError } from "@/lib/parent-meetings";
import type { Permission, Role } from "@/lib/permissions";

export const PARENT_MEETING_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Cookie"
} as const;

export async function requireParentMeetingApiActor(permission: Permission, roles?: Role[]) {
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return { response: auth.response, actor: null };
  const context = await getCurrentAuthContext();
  if (!context || context.user.id !== auth.user.id || (roles && !roles.includes(context.user.role))) {
    return { response: parentMeetingJson({ error: "The requested Parent meeting record is unavailable." }, 404), actor: null };
  }
  return { response: null, actor: { user: context.user, sessionId: context.sessionId } };
}

export function parentMeetingJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PARENT_MEETING_PRIVATE_HEADERS });
}

export function parentMeetingApiError(error: unknown) {
  if (error instanceof ParentMeetingError) return parentMeetingJson({ error: error.message, code: error.code }, error.status);
  console.error("PARENT_MEETING_SAFE_ERROR", error instanceof Error ? error.message : "UNKNOWN");
  return parentMeetingJson({ error: "The Parent meeting request could not be completed safely.", code: "PARENT_MEETING_INTERNAL_ERROR" }, 500);
}

export async function parseParentMeetingJson(request: Request) {
  try { return await request.json(); }
  catch { throw new ParentMeetingError("A valid JSON request is required.", 400, "PARENT_MEETING_JSON_INVALID"); }
}
