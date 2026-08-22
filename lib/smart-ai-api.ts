import { NextResponse, type NextRequest } from "next/server";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";
import { SMART_AI_LIMITS } from "@/lib/smart-ai-contract";
import { parseSmartAiRequest, SmartAiError } from "@/lib/smart-ai-safety";

export const SMART_AI_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Vary": "Cookie"
} as const;

export function smartAiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: SMART_AI_PRIVATE_HEADERS });
}
export async function parseSmartAiBody(request: NextRequest) {
  if (!unsafeRequestOriginAllowed(request)) {
    throw new SmartAiError("The request origin is not allowed.", 403, "SMART_AI_ORIGIN_DENIED");
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new SmartAiError("Content type must be application/json.", 415, "SMART_AI_CONTENT_TYPE_REQUIRED");
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength && (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > SMART_AI_LIMITS.maximumRequestBytes)) {
    throw new SmartAiError("Smart AI request is too large.", 413, "SMART_AI_REQUEST_SIZE");
  }
  const raw = await request.text();
  if (!raw || raw.length > SMART_AI_LIMITS.maximumRequestBytes) {
    throw new SmartAiError("Smart AI request is missing or too large.", 413, "SMART_AI_REQUEST_SIZE");
  }
  try {
    return parseSmartAiRequest(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SmartAiError) throw error;
    throw new SmartAiError("Smart AI request must be valid JSON.", 400, "SMART_AI_JSON_INVALID");
  }
}

export function smartAiError(error: unknown) {
  if (error instanceof SmartAiError) return smartAiJson({ error: error.message, code: error.code }, error.status);
  return smartAiJson({ error: "Smart AI failed safely. No school record was changed.", code: "SMART_AI_UNAVAILABLE" }, 500);
}
