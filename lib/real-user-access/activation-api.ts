import { NextRequest, NextResponse } from "next/server";
import { sessionCookieSecure } from "@/lib/session-token";
import { boundAuthEnvironment } from "@/lib/real-user-access/login-mfa";
import { assertBoundedJsonValue } from "@/lib/request-security";

export const ACTIVATION_COOKIE = "nalanda_activation";

export function activationToken(request: NextRequest) { return request.cookies.get(ACTIVATION_COOKIE)?.value ?? ""; }
export function activationEnvironment() { return boundAuthEnvironment(); }
export function activationJson(body: Record<string, unknown>, status = 200) { const response = NextResponse.json(body, { status }); response.headers.set("cache-control", "private, no-store"); response.headers.set("referrer-policy", "no-referrer"); response.headers.set("x-content-type-options", "nosniff"); return response; }
export function setActivationCookie(response: NextResponse, token: string) { response.cookies.set(ACTIVATION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: sessionCookieSecure(), path: "/api/auth/activation", maxAge: 30 * 60 }); }
export function clearActivationCookie(response: NextResponse) { response.cookies.set(ACTIVATION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: sessionCookieSecure(), path: "/api/auth/activation", maxAge: 0 }); }
export function activationFeatureUnavailable() { return activationJson({ error: "This capability is unavailable." }, 404); }
export async function readBoundedAccessJson(request: NextRequest, largeWebAuthnPayload = false) {
  const body = await request.json() as Record<string, unknown>;
  assertBoundedJsonValue(body, largeWebAuthnPayload
    ? { maximumArrayLength: 8, maximumStringLength: 16_384, maximumJsonNodes: 64 }
    : { maximumArrayLength: 50, maximumStringLength: 4_096, maximumJsonNodes: 256 });
  return body;
}
