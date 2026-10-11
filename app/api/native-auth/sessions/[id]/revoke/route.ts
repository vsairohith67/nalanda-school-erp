import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/session-token";
import { nativeAuthResponse, NativeAuthError, parseBoundedNativeJson } from "@/lib/native-app/auth";
import { revokeGovernedNativeSession } from "@/lib/native-app/session-governance";
import { requestBodyTooLarge, unsafeRequestOriginAllowed } from "@/lib/request-security";

// Normal web-authenticated mutation. Deliberately NOT in middleware's native
// bearer/CSRF exception set. Existing native.auth rate and body limits apply.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!unsafeRequestOriginAllowed(request)) throw new NativeAuthError("REQUEST_ORIGIN_DENIED", 403);
    if (await requestBodyTooLarge(request)) throw new NativeAuthError("REQUEST_SIZE_INVALID", 413);
    const input = await parseBoundedNativeJson(request);
    const result = await revokeGovernedNativeSession(prisma, (await cookies()).get(SESSION_COOKIE)?.value, (await params).id, input);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    // Unknown storage/audit failures are failures, never a success receipt; no
    // raw body, reason, credential or database error leaves the handler.
    return nativeAuthResponse(error instanceof NativeAuthError ? error : new NativeAuthError("NATIVE_SESSION_REVOCATION_FAILED", 500));
  }
}
