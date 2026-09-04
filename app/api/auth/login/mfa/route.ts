import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { createPersistedSession } from "@/lib/auth-sessions";
import { SESSION_MAX_AGE_SECONDS, sessionCookieName, sessionCookieSecure } from "@/lib/session-token";
import { defaultPathForRole } from "@/lib/navigation";
import { isRole } from "@/lib/permissions";
import { boundAuthEnvironment, completeLoginMfaChallenge } from "@/lib/real-user-access/login-mfa";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

const GENERIC_ERROR = "We couldn’t complete that sign-in.";

export async function POST(request: NextRequest) {
  if (!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE)) return json({ error: GENERIC_ERROR }, 404);
  try {
    const body = await request.json() as Record<string, unknown>;
    assertBoundedJsonValue(body, { maximumArrayLength: 8, maximumStringLength: 16_384, maximumJsonNodes: 64 });
    const factor = String(body.factor ?? "") as "TOTP" | "RECOVERY_CODE" | "WEBAUTHN";
    if (!(["TOTP", "RECOVERY_CODE", "WEBAUTHN"] as const).includes(factor)) return json({ error: GENERIC_ERROR }, 400);
    const factorResponse = factor === "WEBAUTHN" ? body.response as AuthenticationResponseJSON : String(body.response ?? "");
    const result = await completeLoginMfaChallenge(prisma, { challengeToken: String(body.challengeToken ?? ""), environment: boundAuthEnvironment(), factor, response: factorResponse });
    if (!result.verified || !result.user || !isRole(result.user.role)) return json({ error: GENERIC_ERROR }, 401);
    const user = result.user;
    const session = await prisma.$transaction(async (tx) => createPersistedSession(tx, user, request.headers, new Date()));
    const response = NextResponse.json({ user: { name: user.name, username: user.username }, homePath: defaultPathForRole(user.role), mustChangePassword: user.mustChangePassword });
    response.cookies.set(sessionCookieName(), session.cookieValue, { httpOnly: true, sameSite: "strict", secure: sessionCookieSecure(), path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
    response.headers.set("cache-control", "private, no-store");
    return response;
  } catch {
    return json({ error: GENERIC_ERROR }, 400);
  }
}

function json(body: Record<string, unknown>, status: number) { const response = NextResponse.json(body, { status }); response.headers.set("cache-control", "private, no-store"); return response; }
