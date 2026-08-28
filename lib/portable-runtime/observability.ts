import { createHash } from "node:crypto";

type SafeLogLevel = "debug" | "info" | "warn" | "error";
type SafeLogFields = Record<string, string | number | boolean | null | undefined>;

const SAFE_FIELD = /^(?:service|requestId|routeCategory|status|durationMs|safeCode|deploymentVersion|replicaId|rateLimitEvent|dependencyState|command|jobId|result)$/;
const FORBIDDEN = /(?:password|secret|token|cookie|authorization|database|valkey|redis|bucket|objectKey|student|parent|guardian|marks|payment|salary|prompt|privateNote)/i;
const counters = new Map<string, number>();
const globalState = globalThis as typeof globalThis & { __nalandaPortableMetrics?: Map<string, number> };
const metricStore = globalState.__nalandaPortableMetrics ??= counters;

function bounded(value: unknown, maximum = 240) {
  return String(value ?? "").replace(/[\r\n\u0000-\u001f]/g, " ").slice(0, maximum);
}

export function portableLog(level: SafeLogLevel, safeCode: string, fields: SafeLogFields = {}) {
  if (process.env.PORTABLE_STRUCTURED_LOGGING !== "true" && process.env.NODE_ENV !== "production") return;
  const safe: SafeLogFields = {};
  for (const [key, raw] of Object.entries(fields)) {
    if (!SAFE_FIELD.test(key) || FORBIDDEN.test(key) || raw === undefined) continue;
    safe[key] = typeof raw === "string" ? bounded(raw) : raw;
  }
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "nalanda-erp",
    safeCode: bounded(safeCode, 80),
    deploymentVersion: bounded(process.env.NALANDA_DEPLOYMENT_ID || "local", 100),
    replicaId: bounded(process.env.NALANDA_REPLICA_ID || "single", 100),
    ...safe
  };
  const line = JSON.stringify(entry).slice(0, 4_096);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function incrementPortableMetric(name: string, value = 1) {
  if (!/^nalanda_(?:requests|http_4xx|http_5xx|rate_limit_429|rate_limit_503|valkey_unavailable|object_store_errors|backup_success|backup_failure|job_lock_contention|offline_sync_accepted|offline_sync_conflict|offline_sync_rejected)_total$/.test(name)) {
    throw new Error("PORTABLE_METRIC_NAME_INVALID");
  }
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) throw new Error("PORTABLE_METRIC_VALUE_INVALID");
  metricStore.set(name, (metricStore.get(name) ?? 0) + value);
}

export function portableMetricsText() {
  const lines = ["# Nalanda provider-neutral privacy-safe counters"];
  for (const [name, value] of [...metricStore.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`# TYPE ${name} counter`, `${name} ${value}`);
  }
  lines.push("# EOF");
  return `${lines.join("\n")}\n`;
}

export function safeRequestFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}
