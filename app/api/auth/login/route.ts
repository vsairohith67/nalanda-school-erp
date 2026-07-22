import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isRole } from "@/lib/permissions";
import {
  createSessionCredentialTag,
  createSessionToken,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieName,
  sessionCookieSecure
} from "@/lib/session-token";
import { isFirstRunRequired } from "@/lib/setup";
import {
  checkLoginRateLimit,
  clearLoginAccountFailures,
  loginRequestSource,
  recordLoginFailure
} from "@/lib/auth-rate-limit";

const dummyPasswordHash = hashPassword("invalid-login-placeholder");

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
      return privateJson({ error: "A JSON request body is required" }, 415);
    }
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return privateJson({ error: "The sign-in request is malformed" }, 400);
    }
    const identifier = String(body.identifier ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!identifier || !password) {
      return privateJson({ error: "Username/email and password are required" }, 400);
    }
    if (identifier.length > 254 || password.length > 1024) {
      return privateJson({ error: "Invalid username/email or password" }, 401);
    }

    const source = loginRequestSource(request.headers);
    const before = await checkLoginRateLimit({ identifier, source });
    if (!before.allowed) {
      console.warn(`AUTH_LOGIN_RATE_LIMIT account=${before.accountHash} source=${before.sourceHash}`);
      return rateLimitResponse(before.retryAfterSeconds);
    }

    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ username: identifier }, { email: identifier }]
      }
    });
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? await dummyPasswordHash);

    if (!user || !isRole(user.role) || !passwordMatches) {
      const failure = await recordLoginFailure({ identifier, source });
      console.warn(`AUTH_LOGIN_FAILURE account=${failure.accountHash} source=${failure.sourceHash}`);
      if (failure.blocked) return rateLimitResponse(failure.retryAfterSeconds);
      return privateJson({ error: "Invalid username/email or password" }, 401);
    }

    await clearLoginAccountFailures(identifier);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = await createSessionToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      credentialTag: await createSessionCredentialTag(user.id, user.passwordHash)
    });
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, username: user.username, role: user.role }
    });
    response.cookies.set(sessionCookieName(), token, {
      httpOnly: true,
      sameSite: "strict",
      secure: sessionCookieSecure(),
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    response.headers.set("cache-control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error && error.message.includes("SECRET")
      ? "Server authentication is not configured. Set AUTH_SECRET or SESSION_SECRET and restart the app."
      : "Unable to sign in";
    return privateJson({ error: message }, 500);
  }
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}

function rateLimitResponse(retryAfterSeconds: number) {
  const response = privateJson({ error: "Unable to sign in. Please try again later." }, 429);
  response.headers.set("retry-after", String(Math.max(1, retryAfterSeconds)));
  return response;
}
