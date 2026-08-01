import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { archivePermissionProfile, clonePermissionProfile, updatePermissionProfile } from "@/lib/iam/profiles";
import { safeClientError } from "@/lib/client-errors";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const auth = await requireApiPermission("MANAGE_PERMISSION_PROFILES");
  if (auth.response) return auth.response;
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "UPDATE");
    const actor = { user: context.user, sessionId: context.sessionId };
    const handle = (await params).handle;
    const profile = action === "CLONE"
      ? await clonePermissionProfile(prisma, actor, handle, body)
      : action === "ARCHIVE"
        ? await archivePermissionProfile(prisma, actor, handle, body)
        : await updatePermissionProfile(prisma, actor, handle, body);
    return privateJson({ profile });
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to change the permission profile") }, 409);
  }
}

function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
