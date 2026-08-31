import type { NextRequest } from "next/server";
import { trustedProxyRequest } from "@/lib/trusted-client";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_BODY_LIMIT_BYTES = 5 * 1024 * 1024;
const OCR_PAGE_BODY_LIMIT_BYTES = 26 * 1024 * 1024;
const STUDENT_ATTENDANCE_BODY_LIMIT_BYTES = 512 * 1024;
const EXAM_MARKS_BODY_LIMIT_BYTES = 512 * 1024;
const EXAM_TIMETABLE_BODY_LIMIT_BYTES = 128 * 1024;
const AUTH_BODY_LIMIT_BYTES = 16 * 1024;
const IAM_BODY_LIMIT_BYTES = 64 * 1024;
const PAYSLIP_PDF_BODY_LIMIT_BYTES = 12 * 1024 * 1024;
const PUBLIC_SUPPORT_BODY_LIMIT_BYTES = 3 * 1024 * 1024;
const SUPPORT_ATTACHMENT_BODY_LIMIT_BYTES = 6 * 1024 * 1024;
const EVENT_MEDIA_MULTIPART_BODY_LIMIT_BYTES = 16 * 1024 * 1024;
const IMPORT_BODY_LIMIT_BYTES = 8 * 1024 * 1024;
const SEARCH_AI_BODY_LIMIT_BYTES = 32 * 1024;
const PDF_JOB_BODY_LIMIT_BYTES = 128 * 1024;
const OFFLINE_SYNC_BODY_LIMIT_BYTES = 512 * 1024;
const NATIVE_AUTH_BODY_LIMIT_BYTES = 32 * 1024;
const BIOMETRIC_INGEST_BODY_LIMIT_BYTES = 256 * 1024;
const OCR_UPLOAD_BODY_LIMIT_BYTES = 26 * 1024 * 1024;
const OCR_WORKER_RESULT_BODY_LIMIT_BYTES = 51 * 1024 * 1024;
const OCR_WORKER_RASTER_BODY_LIMIT_BYTES = 3 * 1024 * 1024;

export const SECURITY_RESOURCE_BUDGETS = {
  maximumJsonBytes: DEFAULT_BODY_LIMIT_BYTES,
  maximumArrayLength: 2_000,
  maximumObjectKeys: 200,
  maximumStringLength: 20_000,
  maximumJsonDepth: 12,
  maximumJsonNodes: 100_000,
  maximumPaginationSize: 250,
  maximumExportRows: 10_000,
  maximumImportRows: 2_000,
  maximumDateRangeDays: 366,
  maximumBatchOperations: 2_000,
  outboundRequestTimeoutMs: 30_000,
  boundedRetryCount: 3
} as const;

export function isUnsafeMethod(method: string) {
  return !SAFE_METHODS.has(method.toUpperCase());
}

export function isProviderWebhookPath(pathname: string) {
  return pathname.startsWith("/api/whatsapp/webhook/") ||
    pathname.startsWith("/api/sms-email/webhook/");
}

export function requestBodyLimitBytes(pathname: string) {
  if (pathname === "/api/biometric/ingest") return BIOMETRIC_INGEST_BODY_LIMIT_BYTES;
  if (pathname === "/api/ocr/documents") return OCR_UPLOAD_BODY_LIMIT_BYTES;
  if (/^\/api\/internal\/ocr\/worker\/jobs\/[^/]+\/result$/.test(pathname)) return OCR_WORKER_RESULT_BODY_LIMIT_BYTES;
  if (/^\/api\/internal\/ocr\/worker\/jobs\/[^/]+\/rasters\/[^/]+$/.test(pathname)) return OCR_WORKER_RASTER_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/native-auth/") || pathname.startsWith("/api/native/")) return NATIVE_AUTH_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/offline-sync/")) return OFFLINE_SYNC_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/auth/")) return AUTH_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/iam/")) return IAM_BODY_LIMIT_BYTES;
  if (pathname === "/api/super-admin/search" || pathname === "/api/super-admin/ai" || pathname.startsWith("/api/ai-assistant/")) return SEARCH_AI_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/report-cards/pdf-jobs")) return PDF_JOB_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/import/") || /\/import(?:\/|$)/i.test(pathname)) return IMPORT_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/public/support/")) return PUBLIC_SUPPORT_BODY_LIMIT_BYTES;
  if (/^\/api\/(?:my-support|parent\/support|support)\/[^/]+\/attachments$/.test(pathname)) return SUPPORT_ATTACHMENT_BODY_LIMIT_BYTES;
  if (/^\/api\/event-media\/albums\/[^/]+\/assets$/.test(pathname)) return EVENT_MEDIA_MULTIPART_BODY_LIMIT_BYTES;
  if (/^\/api\/payslip-requests\/[^/]+\/documents$/.test(pathname)) return PAYSLIP_PDF_BODY_LIMIT_BYTES;
  if (/^\/api\/fee-register-ocr\/batches\/[^/]+\/pages$/.test(pathname)) return OCR_PAGE_BODY_LIMIT_BYTES;
  if (pathname === "/api/attendance/students") return STUDENT_ATTENDANCE_BODY_LIMIT_BYTES;
  if (pathname.startsWith("/api/exam-marks") || pathname.startsWith("/api/exam-moderation")) {
    return EXAM_MARKS_BODY_LIMIT_BYTES;
  }
  if (pathname.startsWith("/api/exam-timetables")) return EXAM_TIMETABLE_BODY_LIMIT_BYTES;
  return DEFAULT_BODY_LIMIT_BYTES;
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

export async function requestJsonBudgetIssue(request: BodyLimitedRequest) {
  if (!isUnsafeMethod(request.method)) return null;
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") return null;
  try {
    const value = await request.clone().json();
    assertBoundedJsonValue(value);
    return null;
  } catch (error) {
    if (error instanceof Error && /^JSON_(?:NODE|DEPTH|STRING|ARRAY|OBJECT_KEY|KEY)_LIMIT_EXCEEDED$/.test(error.message)) {
      return "JSON request complexity exceeds the safe server limit.";
    }
    // Syntax and domain validation stay with the route so existing controlled
    // error contracts are preserved.
    return null;
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
  // All other cookie-authenticated or public browser mutations fail closed.
  // Future mobile/sync clients require a separate authenticated protocol.
  return false;
}

export function assertBoundedJsonValue(
  value: unknown,
  overrides: Partial<Record<keyof typeof SECURITY_RESOURCE_BUDGETS, number>> = {}
) {
  const limits = { ...SECURITY_RESOURCE_BUDGETS, ...overrides };
  let nodes = 0;
  const visit = (current: unknown, depth: number) => {
    nodes += 1;
    if (nodes > limits.maximumJsonNodes) throw new Error("JSON_NODE_LIMIT_EXCEEDED");
    if (depth > limits.maximumJsonDepth) throw new Error("JSON_DEPTH_LIMIT_EXCEEDED");
    if (typeof current === "string" && current.length > limits.maximumStringLength) throw new Error("JSON_STRING_LIMIT_EXCEEDED");
    if (Array.isArray(current)) {
      if (current.length > limits.maximumArrayLength) throw new Error("JSON_ARRAY_LIMIT_EXCEEDED");
      current.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (current && typeof current === "object") {
      const entries = Object.entries(current as Record<string, unknown>);
      if (entries.length > limits.maximumObjectKeys) throw new Error("JSON_OBJECT_KEY_LIMIT_EXCEEDED");
      entries.forEach(([key, item]) => {
        if (key.length > 200) throw new Error("JSON_KEY_LIMIT_EXCEEDED");
        visit(item, depth + 1);
      });
    }
  };
  visit(value, 0);
  return value;
}

export function requestQueryBudgetIssue(url: Pick<URL, "pathname" | "searchParams">) {
  for (const name of ["pageSize", "perPage", "page_size"]) {
    const raw = url.searchParams.get(name);
    if (raw === null) continue;
    if (!/^\d{1,6}$/.test(raw) || Number(raw) < 1 || Number(raw) > SECURITY_RESOURCE_BUDGETS.maximumPaginationSize) {
      return "Pagination size exceeds the safe server limit.";
    }
  }
  for (const [startName, endName] of [["from", "to"], ["startDate", "endDate"], ["dateFrom", "dateTo"]] as const) {
    const start = url.searchParams.get(startName);
    const end = url.searchParams.get(endName);
    if (!start || !end) continue;
    const from = isoDate(start);
    const to = isoDate(end);
    if (from === null || to === null || to < from || (to - from) / 86_400_000 > SECURITY_RESOURCE_BUDGETS.maximumDateRangeDays) {
      return "Date range exceeds the safe server limit.";
    }
  }
  return null;
}

export function contentSecurityPolicy(nonce: string, enableUpgrade = process.env.ENABLE_HTTPS_UPGRADE === "true") {
  const developmentEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentEval}`,
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

export function applicationOrigin(
  request: Pick<NextRequest, "nextUrl">,
  configuredOrigin = process.env.APP_ORIGIN?.trim()
) {
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {}
  }
  return request.nextUrl.origin;
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
  trustProxyHeaders = trustedProxyRequest(request.headers)
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

function isoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizedOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid:";
  }
}
