import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNamedUser, listNamedUsers } from "@/lib/iam/users";
import { safeClientError } from "@/lib/client-errors";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_IAM_ACCESS");
  if (auth.response) return auth.response;
  const params = request.nextUrl.searchParams;
  return privateJson({ users: await listNamedUsers(prisma, { query: params.get("q") ?? undefined, status: params.get("status") ?? undefined, role: params.get("role") ?? undefined }) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_IAM_USERS");
  if (auth.response) return auth.response;
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    return privateJson({ user: await createNamedUser(prisma, { user: context.user, sessionId: context.sessionId }, body) }, 201);
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to create the named user") }, 400);
  }
}

function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
