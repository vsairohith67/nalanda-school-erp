import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { safeClientError } from "@/lib/client-errors";
import { sessionCookieName, sessionCookieSecure } from "@/lib/session-token";

export async function POST(request: NextRequest) {
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const now = new Date();
    let currentRevoked = false;
    let revokedCount = 0;
    await prisma.$transaction(async (tx) => {
      if (action === "revoke-one") {
        const sessionId = boundedId(body.sessionId);
        const expectedVersion = expectedVersionValue(body.expectedVersion);
        const changed = await tx.authSession.updateMany({
          where: { id: sessionId, userId: context.user.id, version: expectedVersion, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now, revocationReason: "USER_REVOKED", version: { increment: 1 } }
        });
        if (changed.count !== 1) throw new Error("Session changed; refresh and try again");
        revokedCount = changed.count;
        currentRevoked = sessionId === context.sessionId;
        await logAuthSecurityEvent(tx, {
          eventType: "SESSION_REVOKED",
          userId: context.user.id,
          actorUserId: context.user.id,
          subjectType: "AUTH_SESSION",
          subjectId: sessionId,
          details: { reason: "USER_REVOKED" }
        });
        return;
      }
      if (action === "revoke-others") {
        const changed = await tx.authSession.updateMany({
          where: { userId: context.user.id, id: { not: context.sessionId }, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now, revocationReason: "LOGOUT_OTHER_SESSIONS", version: { increment: 1 } }
        });
        revokedCount = changed.count;
      } else if (action === "revoke-all") {
        if (body.confirmCurrentSession !== true) throw new Error("Confirm that the current session will also be signed out");
        const changed = await tx.authSession.updateMany({
          where: { userId: context.user.id, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now, revocationReason: "LOGOUT_ALL_SESSIONS", version: { increment: 1 } }
        });
        revokedCount = changed.count;
        currentRevoked = true;
      } else {
        throw new Error("Unsupported session action");
      }
      await logAuthSecurityEvent(tx, {
        eventType: action === "revoke-all" ? "ALL_SESSIONS_REVOKED" : "OTHER_SESSIONS_REVOKED",
        userId: context.user.id,
        actorUserId: context.user.id,
        subjectType: "AUTH_SESSION",
        details: { revokedCount }
      });
    });
    const response = privateJson({ success: true, revokedCount, currentRevoked }, 200);
    if (currentRevoked) response.cookies.set(sessionCookieName(), "", {
      httpOnly: true, sameSite: "strict", secure: sessionCookieSecure(), path: "/", expires: new Date(0)
    });
    return response;
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to update sessions") }, 400);
  }
}

function boundedId(value: unknown) {
  const result = String(value ?? "").trim();
  if (!result || result.length > 80) throw new Error("Session is invalid");
  return result;
}
function expectedVersionValue(value: unknown) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) throw new Error("Expected session version is invalid");
  return result;
}
function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
