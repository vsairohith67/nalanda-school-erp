export type SecurityResilienceEvent =
  | "RATE_LIMIT_HIT"
  | "AUTHENTICATION_ABUSE"
  | "QUEUE_SATURATION"
  | "OPERATION_TIMEOUT"
  | "CIRCUIT_BREAKER"
  | "EXCESSIVE_EXPORT_IMPORT"
  | "BLOCKED_UPLOAD"
  | "AUTHORIZATION_DENIAL"
  | "PROVIDER_UNAVAILABLE"
  | "EDGE_ORIGIN_MISMATCH";

const SAFE_METADATA_KEYS = new Set([
  "policy", "operation", "status", "reason", "actorHash", "sourceHash",
  "retryAfterSeconds", "active", "queued", "failureCount", "routeFamily"
]);

export function emitSecurityResilienceEvent(
  event: SecurityResilienceEvent,
  metadata: Record<string, string | number | boolean | null | undefined> = {}
) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key) || value === undefined) continue;
    safe[key] = typeof value === "string" ? neutralize(value).slice(0, 120) : value;
  }
  console.warn(JSON.stringify({ event: `SECURITY_RESILIENCE_${event}`, ...safe }));
}

export async function securityActorHash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nalanda-security-actor:${value}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function neutralize(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ");
}
