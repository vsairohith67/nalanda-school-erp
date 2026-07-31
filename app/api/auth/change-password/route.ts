import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { validateOwnPasswordChange } from "@/lib/password-control";
import { logUserAction } from "@/lib/user-audit";
import { sessionCookieName, sessionCookieSecure } from "@/lib/session-token";
import { createPersistedSession } from "@/lib/auth-sessions";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-token";

export async function POST(request: NextRequest) {
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  const user = context.user;
  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    const account = await prisma.user.findUnique({ where: { id: user.id } });
    if (!account) return privateJson({ error: "User account not found" }, 404);
    await validateOwnPasswordChange({
      currentPassword,
      storedHash: account.passwordHash,
      newPassword,
      confirmPassword
    });
    const nextPasswordHash = await hashPassword(newPassword);
    const rotated = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: user.id, credentialVersion: account.credentialVersion, isActive: true },
        data: { passwordHash: nextPasswordHash, credentialVersion: { increment: 1 } }
      });
      if (changed.count !== 1) throw new Error("Account security changed; refresh and try again");
      const now = new Date();
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revocationReason: "PASSWORD_CHANGED" }
      });
      await tx.authPasswordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now, invalidationReason: "PASSWORD_CHANGED" }
      });
      await tx.authVerificationChallenge.updateMany({
        where: { userId: user.id, usedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now }
      });
      const token = await createPersistedSession(tx, {
        id: user.id,
        credentialVersion: account.credentialVersion + 1
      }, request.headers, now);
      await logUserAction(tx, {
        action: "OWN_PASSWORD_CHANGED",
        actor: user,
        targetUserId: user.id
      });
      await logAuthSecurityEvent(tx, {
        eventType: "PASSWORD_CHANGED",
        userId: user.id,
        actorUserId: user.id,
        subjectType: "AUTH_SESSION",
        subjectId: token.sessionId,
        details: { sessionsRevoked: true, sessionRotated: true }
      });
      return token;
    });
    const response = privateJson({
      success: true,
      message: "Password updated. Other sessions were signed out."
    }, 200);
    response.cookies.set(sessionCookieName(), rotated.cookieValue, {
      httpOnly: true,
      sameSite: "strict",
      secure: sessionCookieSecure(),
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    return response;
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to change password") }, 400);
  }
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
