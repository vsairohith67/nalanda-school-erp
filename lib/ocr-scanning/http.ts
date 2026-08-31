import { NextResponse } from "next/server";
import type { OcrContextType } from "@/lib/ocr-scanning/contracts";
import { OcrScanningError } from "@/lib/ocr-scanning/contracts";
import { requireOcrContextAction, type OcrAction } from "@/lib/ocr-scanning/authorization";
import { enforceOperationRateLimit } from "@/lib/security-resilience";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { readBoundedOcrRequestBody } from "@/lib/ocr-scanning/request-body";

export const OCR_PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Vary": "Cookie"
});

export function ocrJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: OCR_PRIVATE_HEADERS });
}

export function ocrError(error: unknown) {
  if (error instanceof OcrScanningError) return ocrJson({ error: error.message, code: error.code }, error.status);
  console.error("OCR_SCANNING_REQUEST_FAILED", error instanceof Error ? error.name : "UnknownError");
  return ocrJson({ error: "The OCR request failed safely.", code: "OCR_REQUEST_FAILED" }, 500);
}

export async function authorizeOcr(contextType: OcrContextType, action: OcrAction) {
  const auth = await requireOcrContextAction(contextType, action);
  return {
    response: auth.response ?? undefined,
    user: auth.user
  } as { response: Response | undefined; user: import("@/lib/auth").AuthUser | null };
}

export async function enforceOcrRateLimit(pathname: string, method: string, user: import("@/lib/auth").AuthUser, extra?: { document?: string; operation?: string }) {
  const account = extra?.document ? `${user.id}:${extra.document}` : user.id;
  const decision = await enforceOperationRateLimit(pathname, method, { account, role: user.role, session: extra?.operation }, { dimensions: ["account", "role", "session", "endpoint", "operationCost"] });
  if (decision.allowed) return undefined;
  return ocrJson({ error: decision.code === "RATE_LIMITED" ? "Too many OCR requests. Try again later." : "OCR request protection is unavailable.", code: decision.code }, decision.status);
}

export function boundedPositiveInteger(value: unknown, minimum: number, maximum: number, code: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new OcrScanningError(code);
  return number;
}

export async function ocrJsonBody(request: Request, maximumBytes = 32 * 1024) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new OcrScanningError("OCR_JSON_REQUIRED", 415);
  const bytes = await readBoundedOcrRequestBody(request, maximumBytes);
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch { throw new OcrScanningError("OCR_JSON_INVALID"); }
  assertBoundedJsonValue(value, { maximumArrayLength: 100, maximumStringLength: 4_000, maximumJsonNodes: 1_000 });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OcrScanningError("OCR_JSON_OBJECT_REQUIRED");
  return value as Record<string, unknown>;
}
