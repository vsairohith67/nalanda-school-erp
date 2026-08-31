import { createHmac, timingSafeEqual } from "node:crypto";
import { OcrScanningError, sha256 } from "@/lib/ocr-scanning/contracts";

export const OCR_WORKER_AUTH_HEADERS = Object.freeze({
  workerId: "x-nalanda-ocr-worker-id",
  timestamp: "x-nalanda-ocr-timestamp",
  nonce: "x-nalanda-ocr-nonce",
  bodySha256: "x-nalanda-ocr-body-sha256",
  signature: "x-nalanda-ocr-signature"
});

const WORKER_ID = /^[a-z][a-z0-9.-]{2,63}$/;
const NONCE = /^[A-Za-z0-9_-]{32,100}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_CLOCK_SKEW_MS = 30_000;

function workerSecret(environment: NodeJS.ProcessEnv) {
  const value = environment.OCR_WORKER_HMAC_SECRET?.trim();
  if (!value || Buffer.byteLength(value, "utf8") < 32) throw new OcrScanningError("OCR_WORKER_SECRET_UNAVAILABLE", 503);
  return value;
}

function canonical(input: { method: string; pathname: string; workerId: string; timestamp: string; nonce: string; bodySha256: string }) {
  return ["nalanda-ocr-worker-v1", input.method.toUpperCase(), input.pathname, input.workerId, input.timestamp, input.nonce, input.bodySha256].join("\n");
}

function signature(secret: string, input: Parameters<typeof canonical>[0]) {
  return createHmac("sha256", secret).update(canonical(input)).digest("hex");
}

export function signOcrWorkerRequest(input: {
  method: string;
  pathname: string;
  workerId: string;
  timestamp: number;
  nonce: string;
  body: Uint8Array;
  environment?: NodeJS.ProcessEnv;
}) {
  if (!WORKER_ID.test(input.workerId) || !NONCE.test(input.nonce)) throw new OcrScanningError("OCR_WORKER_IDENTITY_INVALID");
  const bodySha256 = sha256(input.body);
  const timestamp = String(input.timestamp);
  const signed = signature(workerSecret(input.environment ?? process.env), {
    method: input.method,
    pathname: input.pathname,
    workerId: input.workerId,
    timestamp,
    nonce: input.nonce,
    bodySha256
  });
  return {
    [OCR_WORKER_AUTH_HEADERS.workerId]: input.workerId,
    [OCR_WORKER_AUTH_HEADERS.timestamp]: timestamp,
    [OCR_WORKER_AUTH_HEADERS.nonce]: input.nonce,
    [OCR_WORKER_AUTH_HEADERS.bodySha256]: bodySha256,
    [OCR_WORKER_AUTH_HEADERS.signature]: signed
  };
}

export function verifyOcrWorkerRequest(input: {
  request: Request;
  body: Uint8Array;
  now?: number;
  environment?: NodeJS.ProcessEnv;
}) {
  const workerId = input.request.headers.get(OCR_WORKER_AUTH_HEADERS.workerId) ?? "";
  const timestamp = input.request.headers.get(OCR_WORKER_AUTH_HEADERS.timestamp) ?? "";
  const nonce = input.request.headers.get(OCR_WORKER_AUTH_HEADERS.nonce) ?? "";
  const declaredBodySha256 = input.request.headers.get(OCR_WORKER_AUTH_HEADERS.bodySha256) ?? "";
  const suppliedSignature = input.request.headers.get(OCR_WORKER_AUTH_HEADERS.signature) ?? "";
  const time = Number(timestamp);
  if (!WORKER_ID.test(workerId) || !NONCE.test(nonce) || !Number.isSafeInteger(time) || !SHA256.test(declaredBodySha256) || !SHA256.test(suppliedSignature)) {
    throw new OcrScanningError("OCR_WORKER_AUTH_INVALID", 401);
  }
  if (Math.abs((input.now ?? Date.now()) - time) > MAX_CLOCK_SKEW_MS) throw new OcrScanningError("OCR_WORKER_AUTH_EXPIRED", 401);
  const observedBodySha256 = sha256(input.body);
  if (observedBodySha256 !== declaredBodySha256) throw new OcrScanningError("OCR_WORKER_BODY_INTEGRITY_FAILED", 401);
  const pathname = new URL(input.request.url).pathname;
  const expected = signature(workerSecret(input.environment ?? process.env), {
    method: input.request.method,
    pathname,
    workerId,
    timestamp,
    nonce,
    bodySha256: observedBodySha256
  });
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(suppliedSignature, "hex"))) {
    throw new OcrScanningError("OCR_WORKER_AUTH_INVALID", 401);
  }
  return { workerId, nonceHash: sha256(nonce), timestamp: new Date(time), bodySha256: observedBodySha256 };
}
