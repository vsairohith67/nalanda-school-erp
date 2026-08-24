import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isRole } from "@/lib/permissions";
import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookieName,
  sessionCookieSecure
} from "@/lib/session-token";
import { createPersistedSession } from "@/lib/auth-sessions";
import { resolveLoginIdentifier } from "@/lib/auth-identifiers";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { isFirstRunRequired } from "@/lib/setup";
import { defaultPathForRole } from "@/lib/navigation";
import {
  checkLoginRateLimit,
  clearLoginAccountFailures,
  loginRequestSource,
  recordLoginFailure
} from "@/lib/auth-rate-limit";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { emitSecurityResilienceEvent } from "@/lib/security-observability";

const dummyPasswordHash = hashPassword("invalid-login-placeholder");
const GENERIC_LOGIN_ERROR = "We couldn’t sign you in with those details.";

export async function POST(request: NextRequest) {
  try {
    if (await isFirstRunRequired(prisma)) {
      return NextResponse.json(
        { error: "First-run setup is required before sign-in", setupRequired: true },
        { status: 409 }
      );
    }
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return privateJson({ error: GENERIC_LOGIN_ERROR }, 415);
    }
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      assertBoundedJsonValue(body, { maximumArrayLength: 4, maximumStringLength: 1_024, maximumJsonNodes: 20 });
    } catch {
      return privateJson({ error: GENERIC_LOGIN_ERROR }, 400);
    }
    const identifier = String(body.identifier ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!identifier || !password) {
      return privateJson({ error: GENERIC_LOGIN_ERROR }, 400);
    }
    if (identifier.length > 254 || password.length > 1024) {
      return privateJson({ error: GENERIC_LOGIN_ERROR }, 401);
    }

    const source = loginRequestSource(request.headers);
    const before = await checkLoginRateLimit({ identifier, source });
    if (!before.allowed) {
      console.warn(`AUTH_LOGIN_RATE_LIMIT account=${before.accountHash} source=${before.sourceHash}`);
      emitSecurityResilienceEvent("AUTHENTICATION_ABUSE", { actorHash: before.accountHash, sourceHash: before.sourceHash, status: 429 });
      await recordLoginSecurityEvent("LOGIN_RATE_LIMITED", null, before.accountHash, { blocked: true });
      return rateLimitResponse(before.retryAfterSeconds);
    }

    const resolved = await resolveLoginIdentifier(prisma, identifier);
    const user = resolved.kind === "resolved" ? resolved.user : null;
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? await dummyPasswordHash);

    if (
      !user || !user.isActive || user.lifecycleStatus !== "ACTIVE" || !isRole(user.role) || !passwordMatches ||
      Boolean(user.mustChangePassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= new Date())
    ) {
      const failure = await recordLoginFailure({ identifier, source });
      console.warn(`AUTH_LOGIN_FAILURE account=${failure.accountHash} source=${failure.sourceHash}`);
      emitSecurityResilienceEvent("AUTHENTICATION_ABUSE", { actorHash: failure.accountHash, sourceHash: failure.sourceHash, status: failure.blocked ? 429 : 401 });
      await recordLoginSecurityEvent(
        user && (!user.isActive || user.lifecycleStatus !== "ACTIVE") ? "DISABLED_ACCOUNT_LOGIN_ATTEMPT" : failure.blocked ? "LOGIN_RATE_LIMITED" : "LOGIN_FAILED",
        user?.id ?? null,
        failure.accountHash,
        { blocked: failure.blocked }
      );
      if (failure.blocked) return rateLimitResponse(failure.retryAfterSeconds);
      return privateJson({ error: GENERIC_LOGIN_ERROR }, 401);
    }

    await clearLoginAccountFailures(identifier);
    const token = await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
      const created = await createPersistedSession(tx, user, request.headers, now);
      await logAuthSecurityEvent(tx, {
        eventType: "LOGIN_SUCCEEDED",
        userId: user.id,
        actorUserId: user.id,
        subjectType: "AUTH_SESSION",
        subjectId: created.sessionId,
        details: { aliasType: resolved.kind === "resolved" ? resolved.alias.type : "UNKNOWN" }
      });
      return created;
    });
    const response = NextResponse.json({
      user: { name: user.name, username: user.username },
      homePath: defaultPathForRole(user.role),
      mustChangePassword: user.mustChangePassword
    });
    response.cookies.set(sessionCookieName(), token.cookieValue, {
      httpOnly: true,
      sameSite: "strict",
      secure: sessionCookieSecure(),
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    response.headers.set("cache-control", "private, no-store");
    return response;
  } catch (error) {
    void error;
    return privateJson({ error: GENERIC_LOGIN_ERROR }, 500);
  }
}

async function recordLoginSecurityEvent(eventType: string, userId: string | null, accountFingerprint: string, details: Record<string, boolean>) {
  try {
    await logAuthSecurityEvent(prisma, { eventType, userId, subjectType: "LOGIN_ACCOUNT_FINGERPRINT", subjectId: accountFingerprint, details });
  } catch {
    // Authentication remains fail-closed even if private audit persistence is unavailable.
  }
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}

function rateLimitResponse(retryAfterSeconds: number) {
  const response = privateJson({ error: GENERIC_LOGIN_ERROR }, 429);
  response.headers.set("retry-after", String(Math.max(1, retryAfterSeconds)));
  return response;
}
