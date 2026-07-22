import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_BODY_LIMIT_BYTES = 5 * 1024 * 1024;
const OCR_PAGE_BODY_LIMIT_BYTES = 26 * 1024 * 1024;

export function isUnsafeMethod(method: string) {
  return !SAFE_METHODS.has(method.toUpperCase());
}

export function isProviderWebhookPath(pathname: string) {
  return pathname.startsWith("/api/whatsapp/webhook/") ||
    pathname.startsWith("/api/sms-email/webhook/");
}

export function requestBodyLimitBytes(pathname: string) {
  return /^\/api\/fee-register-ocr\/batches\/[^/]+\/pages$/.test(pathname)
    ? OCR_PAGE_BODY_LIMIT_BYTES
    : DEFAULT_BODY_LIMIT_BYTES;
}

type BodyLimitedRequest = Pick<NextRequest, "body" | "clone" | "headers" | "method" | "nextUrl">;

export async function requestBodyTooLarge(request: BodyLimitedRequest) {
  if (!isUnsafeMethod(request.method)) return false;
  const raw = request.headers.get("content-length")?.trim();
  const limit = requestBodyLimitBytes(request.nextUrl.pathname);
  if (raw) {
    if (!/^\d{1,12}$/.test(raw)) return true;
    const length = Number(raw);
    return !Number.isSafeInteger(length) || length > limit;
  }

  const clone = request.clone();
  if (!clone.body) return false;
  const reader = clone.body.getReader();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      total += value.byteLength;
      if (total > limit) {
        void reader.cancel();
        return true;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function unsafeRequestOriginAllowed(
  request: Pick<NextRequest, "headers" | "method" | "nextUrl">,
  configuredOrigin = process.env.APP_ORIGIN?.trim()
) {
  if (!isUnsafeMethod(request.method)) return true;
  if (isProviderWebhookPath(request.nextUrl.pathname)) return true;
  const expectedOrigins = configuredOrigin
    ? new Set([normalizedOrigin(configuredOrigin)])
    : requestOrigins(request);

  const origin = request.headers.get("origin")?.trim();
  if (origin) return validOrigin(origin, expectedOrigins);

  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      return expectedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";

  // Non-browser workers and signed provider callbacks may omit browser metadata.
  return true;
}

export function contentSecurityPolicy(nonce: string, enableUpgrade = process.env.ENABLE_HTTPS_UPGRADE === "true") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(enableUpgrade ? ["upgrade-insecure-requests"] : [])
  ].join("; ");
}

function validOrigin(value: string, expectedOrigins: Set<string>) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return expectedOrigins.has(parsed.origin);
  } catch {
    return false;
  }
}

function requestOrigins(
  request: Pick<NextRequest, "headers" | "nextUrl">,
  trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true"
) {
  const origins = new Set([request.nextUrl.origin]);
  const host = trustProxyHeaders
    ? request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    : null;
  const protocol = trustProxyHeaders
    ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim()
    : null;
  if (host && (protocol === "http" || protocol === "https")) origins.add(`${protocol}://${host}`);
  return origins;
}

function normalizedOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid:";
  }
}
