import { NextResponse } from "next/server";
import { OcrScanningError } from "@/lib/ocr-scanning/contracts";
import { verifyOcrWorkerRequest } from "@/lib/ocr-scanning/worker-auth";
import { readBoundedOcrRequestBody } from "@/lib/ocr-scanning/request-body";

export const OCR_WORKER_PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Vary": "x-nalanda-ocr-worker-id"
});

export function workerJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: OCR_WORKER_PRIVATE_HEADERS });
}

export function workerError(error: unknown) {
  if (error instanceof OcrScanningError) return workerJson({ error: "OCR worker request rejected.", code: error.code }, error.status);
  console.error("OCR_WORKER_REQUEST_FAILED", error instanceof Error ? error.name : "UnknownError");
  return workerJson({ error: "OCR worker request failed safely.", code: "OCR_WORKER_REQUEST_FAILED" }, 500);
}

export async function verifiedWorkerBytes(request: Request, maximumBytes: number) {
  const bytes = await readBoundedOcrRequestBody(request, maximumBytes, "OCR_WORKER_BODY_TOO_LARGE");
  return { bytes, verified: verifyOcrWorkerRequest({ request, body: bytes }) };
}

export async function verifiedWorkerJson(request: Request, maximumBytes: number) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new OcrScanningError("OCR_WORKER_JSON_REQUIRED", 415);
  const { bytes, verified } = await verifiedWorkerBytes(request, maximumBytes);
  let body: unknown;
  try { body = JSON.parse(bytes.toString("utf8")); }
  catch { throw new OcrScanningError("OCR_WORKER_JSON_INVALID"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new OcrScanningError("OCR_WORKER_JSON_OBJECT_REQUIRED");
  return { body: body as Record<string, unknown>, verified };
}

export function workerLeaseToken(value: unknown) {
  const token = String(value ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) throw new OcrScanningError("OCR_JOB_LEASE_INVALID", 409);
  return token;
}
