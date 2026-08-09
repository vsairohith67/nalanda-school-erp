import { NextRequest, NextResponse } from "next/server";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";
import { OperationalWorkflowError } from "@/lib/operational-workflows";
import { technicalOperationsPrivateHeaders } from "@/lib/technical-operations";

const deepCheckRate = new Map<string, number[]>();

export function technicalOperationsJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: technicalOperationsPrivateHeaders() });
}

export function technicalOperationsError(error: unknown) {
  if (error instanceof OperationalWorkflowError) return technicalOperationsJson({ error: error.message, code: error.code }, error.status);
  if (error instanceof Error && error.message === "TECHNICAL_CHECK_RATE_LIMITED") return technicalOperationsJson({ error: "Deep health checks are rate limited. Try again shortly.", code: error.message }, 429);
  return technicalOperationsJson({ error: "The technical-operations action failed safely.", code: "TECHNICAL_OPERATIONS_FAILED" }, 500);
}

export async function parseTechnicalOperationsJson(request: NextRequest) {
  if (!unsafeRequestOriginAllowed(request)) throw new OperationalWorkflowError("The request origin is not allowed.", 403, "ORIGIN_DENIED");
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new OperationalWorkflowError("Content type must be application/json.", 415, "CONTENT_TYPE_REQUIRED");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length && (!Number.isSafeInteger(length) || length < 0 || length > 32 * 1024)) throw new OperationalWorkflowError("The request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
    return body as Record<string, unknown>;
  } catch {
    throw new OperationalWorkflowError("A valid JSON object is required.", 400, "INVALID_JSON");
  }
}

export function enforceDeepCheckRateLimit(actorUserId: string, now = Date.now()) {
  const recent = (deepCheckRate.get(actorUserId) ?? []).filter((value) => now - value < 5 * 60 * 1000);
  if (recent.length >= 2) throw new Error("TECHNICAL_CHECK_RATE_LIMITED");
  recent.push(now); deepCheckRate.set(actorUserId, recent);
}
