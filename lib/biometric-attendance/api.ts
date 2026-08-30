import { NextResponse } from "next/server";

export const BIOMETRIC_PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" } as const;

export async function parseBiometricApiJson(request: Request, maxBytes = 64 * 1024) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new BiometricApiError("BIOMETRIC_BODY_TOO_LARGE", 413);
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new BiometricApiError("BIOMETRIC_BODY_TOO_LARGE", 413);
  try { return JSON.parse(text) as unknown; } catch { throw new BiometricApiError("BIOMETRIC_JSON_INVALID", 400); }
}

export class BiometricApiError extends Error { constructor(public code: string, public status: number) { super(code); } }

export function biometricJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: BIOMETRIC_PRIVATE_HEADERS }); }

export function biometricApiError(error: unknown) {
  const explicit = error instanceof BiometricApiError ? error : null;
  const message = error instanceof Error ? error.message : "BIOMETRIC_REQUEST_FAILED";
  const code = explicit?.code ?? (/^BIOMETRIC_[A-Z0-9_:.-]+$/.test(message) ? message : "BIOMETRIC_REQUEST_FAILED");
  const conflict = /(CONFLICT|DUAL_CONTROL|LOCKED|REPLAY|STATE_INVALID|UNCHANGED|REQUIRES_CORRECTION)/.test(code);
  return biometricJson({ error: "Unable to complete the biometric attendance action.", code }, explicit?.status ?? (conflict ? 409 : code.endsWith("NOT_FOUND") ? 404 : 400));
}
