import { NextResponse } from "next/server";
import { sessionCookieName, sessionCookieSecure } from "@/lib/session-token";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokeSessions } from "@/lib/auth-sessions";
import { logAuthSecurityEvent } from "@/lib/auth-security";

export async function POST() {
  const context = await getCurrentAuthContext();
  if (context) {
    await prisma.$transaction(async (tx) => {
      await revokeSessions(tx, {
        userId: context.user.id,
        sessionId: context.sessionId,
        reason: "LOGOUT"
      });
      await logAuthSecurityEvent(tx, {
        eventType: "SESSION_REVOKED",
        userId: context.user.id,
        actorUserId: context.user.id,
        subjectType: "AUTH_SESSION",
        subjectId: context.sessionId,
        details: { reason: "LOGOUT" }
      });
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    sameSite: "strict",
    secure: sessionCookieSecure(),
    path: "/",
    expires: new Date(0)
  });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
