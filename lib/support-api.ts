import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";
import { getCurrentUserEffectivePermissions } from "@/lib/auth";
import { SupportError } from "@/lib/support";
import { SupportFileError } from "@/lib/support-files";

export const SUPPORT_PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };

export function supportJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: SUPPORT_PRIVATE_HEADERS }); }
export function supportApiError(error: unknown) {
  if (error instanceof SupportError || error instanceof SupportFileError) return supportJson({ error: error.message, code: error.code }, error.status);
  return supportJson({ error: "Unable to complete the support request." }, 500);
}

export async function supportActor(user: AuthUser) {
  return { id: user.id, name: user.name, role: user.role, roleAssignmentId: user.roleAssignmentId, permissions: await getCurrentUserEffectivePermissions() };
}

export async function parseJsonBody(request: Request) {
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new SupportError("Content type must be application/json.", 415);
  try { return await request.json(); } catch { throw new SupportError("A valid JSON request body is required."); }
}
