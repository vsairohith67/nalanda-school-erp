import { NextResponse, type NextRequest } from "next/server";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";
import { parseUniversalSearchRequest, UniversalSearchError } from "@/lib/universal-search";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { ResourceGuardError } from "@/lib/resource-guard";

export const UNIVERSAL_SEARCH_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Vary": "Cookie"
} as const;

export function universalSearchJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: UNIVERSAL_SEARCH_PRIVATE_HEADERS });
}

export async function parseUniversalSearchBody(request: NextRequest) {
  if (!unsafeRequestOriginAllowed(request)) {
    throw new UniversalSearchError("The request origin is not allowed.", 403, "UNIVERSAL_SEARCH_ORIGIN_DENIED");
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new UniversalSearchError("Content type must be application/json.", 415, "UNIVERSAL_SEARCH_CONTENT_TYPE_REQUIRED");
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength && (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > 16_000)) {
    throw new UniversalSearchError("Search request is too large.", 413, "UNIVERSAL_SEARCH_REQUEST_SIZE");
  }
  const raw = await request.text();
  if (!raw || raw.length > 16_000) throw new UniversalSearchError("Search request is missing or too large.", 413, "UNIVERSAL_SEARCH_REQUEST_SIZE");
  try {
    const parsed = JSON.parse(raw);
    // Search currently exposes 23 governed source identifiers. Keep room for
    // bounded source growth without rejecting the application's own select-all
    // request, while remaining far below the global JSON array ceiling.
    assertBoundedJsonValue(parsed, { maximumArrayLength: 32, maximumStringLength: 2_000, maximumJsonNodes: 200 });
    return parseUniversalSearchRequest(parsed);
  } catch (error) {
    if (error instanceof UniversalSearchError) throw error;
    throw new UniversalSearchError("Search request must be valid JSON.", 400, "UNIVERSAL_SEARCH_JSON_INVALID");
  }
}

export function universalSearchError(error: unknown) {
  if (error instanceof ResourceGuardError) {
    const response = universalSearchJson({ error: error.message, code: error.code }, error.status);
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
  if (error instanceof UniversalSearchError) {
    return universalSearchJson({ error: error.message, code: error.code }, error.status);
  }
  return universalSearchJson({ error: "Universal Search is temporarily unavailable.", code: "UNIVERSAL_SEARCH_UNAVAILABLE" }, 500);
}
