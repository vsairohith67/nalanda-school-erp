import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { CafeteriaError, type CafeteriaActor } from "@/lib/cafeteria";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";
import { TransportError, type TransportActor } from "@/lib/transport";

export const OPTIONAL_OPERATIONS_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Cookie"
};

export function optionalOperationsJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: OPTIONAL_OPERATIONS_PRIVATE_HEADERS });
}

export function optionalOperationsApiError(error: unknown) {
  if (error instanceof TransportError || error instanceof CafeteriaError) return optionalOperationsJson({ error: error.message, code: error.code }, error.status);
  const authMessage = error instanceof Error && /Re-authentication|Authorization changed/.test(error.message) ? error.message : null;
  return optionalOperationsJson({ error: authMessage ?? "Unable to complete the optional Operations action.", code: authMessage ? "REAUTHENTICATION_REQUIRED" : "OPTIONAL_OPERATIONS_FAILED" }, authMessage ? 403 : 500);
}

export async function optionalOperationsActor(): Promise<
  | { actor: TransportActor & CafeteriaActor; response?: never }
  | { actor?: never; response: NextResponse }
> {
  const context = await getCurrentAuthContext();
  if (!context) return { response: optionalOperationsJson({ error: "Authentication required" }, 401) };
  if (context.user.mustChangePassword) return { response: optionalOperationsJson({ error: "Password change required." }, 403) };
  const permissions = await getCurrentUserEffectivePermissions();
  return { actor: { id: context.user.id, role: context.user.role, permissions } };
}

export async function parseOptionalOperationsJson(request: NextRequest) {
  if (!unsafeRequestOriginAllowed(request)) throw new TransportError("The request origin is not allowed.", 403, "OPTIONAL_OPERATIONS_ORIGIN_DENIED");
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new TransportError("Content type must be application/json.", 415, "OPTIONAL_OPERATIONS_CONTENT_TYPE_REQUIRED");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length && (!Number.isSafeInteger(length) || length < 0 || length > 64 * 1024)) throw new TransportError("The request body is too large.", 413, "OPTIONAL_OPERATIONS_PAYLOAD_TOO_LARGE");
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new TransportError("A JSON object is required.", 400, "OPTIONAL_OPERATIONS_INVALID_JSON");
    return body;
  } catch (error) {
    if (error instanceof TransportError) throw error;
    throw new TransportError("A valid JSON request body is required.", 400, "OPTIONAL_OPERATIONS_INVALID_JSON");
  }
}
