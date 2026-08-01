import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPermissionProfile, listPermissionProfiles } from "@/lib/iam/profiles";
import { safeClientError } from "@/lib/client-errors";

export async function GET() {
  const auth = await requireApiPermission("VIEW_IAM_ACCESS");
  if (auth.response) return auth.response;
  return privateJson({ profiles: await listPermissionProfiles(prisma) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_PERMISSION_PROFILES");
  if (auth.response) return auth.response;
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    return privateJson({ profile: await createPermissionProfile(prisma, { user: context.user, sessionId: context.sessionId }, body) }, 201);
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to create the permission profile") }, 400);
  }
}

function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
