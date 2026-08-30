import { BIOMETRIC_BODY_MAX_BYTES, validateBiometricEnvelope } from "@/lib/biometric-attendance/contracts";
import { requireBiometricAttendanceForApi } from "@/lib/biometric-attendance/feature-flag";
import { ingestBiometricBatch } from "@/lib/biometric-attendance/ingestion";
import { biometricTrustResponse, verifyBiometricRequest } from "@/lib/biometric-attendance/trust";
import { trustedProxyRequest } from "@/lib/trusted-client";

export const runtime = "nodejs";

function transportIsSecure(request: Request) {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  if (trustedProxyRequest(request.headers) && request.headers.get("x-forwarded-proto")?.trim().toLowerCase() === "https") return true;
  return process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

export async function POST(request: Request) {
  const unavailable = requireBiometricAttendanceForApi(); if (unavailable) return unavailable;
  try {
    if (!transportIsSecure(request)) throw new Error("BIOMETRIC_TLS_REQUIRED");
    if (!String(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new Error("BIOMETRIC_CONTENT_TYPE_INVALID");
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declared) && declared > BIOMETRIC_BODY_MAX_BYTES) return Response.json({ error: "Biometric batch is too large.", code: "BIOMETRIC_BODY_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "private, no-store" } });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > BIOMETRIC_BODY_MAX_BYTES) return Response.json({ error: "Biometric batch is too large.", code: "BIOMETRIC_BODY_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "private, no-store" } });
    const verified = await verifyBiometricRequest(request, rawBody);
    const envelope = validateBiometricEnvelope(JSON.parse(rawBody));
    return Response.json(await ingestBiometricBatch({ envelope, rawBody, verified }), { status: 202, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "x-nalanda-biometric-bridge-id" } });
  } catch (error) { return biometricTrustResponse(error); }
}
