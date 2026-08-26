import type { NextRequest } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { authorizeNativeRequest, NativeAuthError, nativeAuthResponse } from "@/lib/native-app/auth";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  try {
    if (!unsafeRequestOriginAllowed(request)) throw new NativeAuthError("ORIGIN_DENIED", 403);
    const context = await getCurrentAuthContext();
    if (!context) throw new NativeAuthError("BROWSER_AUTHENTICATION_REQUIRED", 401);
    const form = await request.formData();
    const result = await authorizeNativeRequest({
      requestId: String(form.get("request") ?? ""),
      state: String(form.get("state") ?? ""),
      challenge: String(form.get("challenge") ?? ""),
      proof: String(form.get("proof") ?? ""),
      user: context.user,
      webSessionId: context.sessionId
    });
    if (result.status === "AUTHORIZED") return new Response(null, { status: 303, headers: { Location: result.redirectUrl, "Cache-Control": "private, no-store" } });
    return new Response(null, { status: 303, headers: { Location: "/native/authorize/result?status=device-approval-required", "Cache-Control": "private, no-store" } });
  } catch (error) { return nativeAuthResponse(error); }
}
