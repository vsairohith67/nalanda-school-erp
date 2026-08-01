import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listChildContexts, switchChildContext } from "@/lib/iam/contexts";
import { safeClientError } from "@/lib/client-errors";

export async function GET() {
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    return privateJson(await listChildContexts(prisma, {
      userId: context.user.id,
      sessionId: context.sessionId
    }));
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Child context is unavailable") }, 403);
  }
}

export async function POST(request: NextRequest) {
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    const handle = String(body.handle ?? "");
    const expectedVersion = Number(body.expectedVersion);
    if (handle.length !== 43 || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      return privateJson({ error: "The selected child context is invalid" }, 400);
    }
    return privateJson(await switchChildContext(prisma, {
      userId: context.user.id,
      sessionId: context.sessionId,
      handle,
      expectedVersion
    }));
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to switch child context") }, 409);
  }
}

function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
