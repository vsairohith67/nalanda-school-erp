import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNamedUserDetail, mutateNamedUser } from "@/lib/iam/users";
import { safeClientError } from "@/lib/client-errors";

export async function GET(_: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const auth = await requireApiPermission("VIEW_IAM_ACCESS");
  if (auth.response) return auth.response;
  try {
    return privateJson({ user: await getNamedUserDetail(prisma, (await params).handle) });
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Named user not found") }, 404);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const auth = await requireApiPermission("MANAGE_IAM_USERS");
  if (auth.response) return auth.response;
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    return privateJson(await mutateNamedUser(prisma, { user: context.user, sessionId: context.sessionId }, (await params).handle, body));
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to change named-user access") }, 409);
  }
}

function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
