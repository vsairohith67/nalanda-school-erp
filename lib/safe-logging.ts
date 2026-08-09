import { createHash } from "node:crypto";

export const OPERATIONAL_LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as const;
export type OperationalLogLevel = (typeof OPERATIONAL_LOG_LEVELS)[number];

const REJECTED_KEY = /(?:password|passphrase|hash|secret|token|cookie|csrf|authorization|api[-_]?key|database[-_]?url|payment[-_ ]?(?:reference|ref)|guardian|contact|mobile|phone|email|address|salary|mark|complaint|document|filename|file[-_]?name|path|qr|gate|payload|body|header|ip(?:address)?)/i;
const WINDOWS_OR_UNIX_PATH = /(?:[a-z]:\\[^\s]+|\/(?:home|users?|var|tmp|private|srv)\/[^\s]+)/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const LONG_SECRET = /\b[A-Za-z0-9_-]{24,}\b/g;

export type SafeOperationalLogEntry = {
  timestamp: string;
  level: OperationalLogLevel;
  eventName: string;
  correlationId: string;
  component: string;
  environment: string;
  errorFingerprint: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export function safeErrorFingerprint(error: unknown, component = "unknown") {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error ?? "unknown");
  const normalized = redactText(message).toLowerCase().replace(/\d+/g, "#").slice(0, 240);
  return createHash("sha256").update(`${safeCode(component)}:${safeCode(name)}:${normalized}`).digest("hex").slice(0, 20);
}

export function safeCorrelationId(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return /^[A-Za-z0-9._-]{8,80}$/.test(normalized)
    ? normalized
    : `ops-${createHash("sha256").update(normalized || `${Date.now()}`).digest("hex").slice(0, 16)}`;
}

export function safeOperationalMetadata(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>).slice(0, 32)) {
    const key = safeCode(rawKey).slice(0, 64);
    if (!key || REJECTED_KEY.test(rawKey)) continue;
    if (rawValue == null || typeof rawValue === "boolean") result[key] = rawValue as boolean | null;
    else if (typeof rawValue === "number" && Number.isFinite(rawValue)) result[key] = rawValue;
    else if (typeof rawValue === "string") result[key] = redactText(rawValue).slice(0, 180);
  }
  return result;
}

export function createSafeOperationalLogEntry(input: {
  level: OperationalLogLevel;
  eventName: string;
  correlationId?: string | null;
  component: string;
  environment?: string | null;
  error?: unknown;
  metadata?: unknown;
  now?: Date;
}): SafeOperationalLogEntry {
  if (!OPERATIONAL_LOG_LEVELS.includes(input.level)) throw new Error("OPERATIONAL_LOG_LEVEL_INVALID");
  return {
    timestamp: (input.now ?? new Date()).toISOString(),
    level: input.level,
    eventName: safeCode(input.eventName).slice(0, 80) || "operational.event",
    correlationId: safeCorrelationId(input.correlationId),
    component: safeCode(input.component).slice(0, 80) || "unknown",
    environment: safeCode(input.environment || process.env.NALANDA_ENVIRONMENT || process.env.NODE_ENV || "unknown").slice(0, 40),
    errorFingerprint: input.error == null ? null : safeErrorFingerprint(input.error, input.component),
    metadata: safeOperationalMetadata(input.metadata)
  };
}

export function stringifySafeOperationalLog(input: Parameters<typeof createSafeOperationalLogEntry>[0]) {
  return JSON.stringify(createSafeOperationalLogEntry(input));
}

export function redactText(value: string) {
  return value
    .replace(BEARER, "[REDACTED]")
    .replace(EMAIL, "[REDACTED]")
    .replace(IPV4, "[REDACTED]")
    .replace(PHONE, "[REDACTED]")
    .replace(WINDOWS_OR_UNIX_PATH, "[REDACTED]")
    .replace(LONG_SECRET, "[REDACTED]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim();
}

function safeCode(value: string) {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
