import { createHash } from "node:crypto";
import { redactWhatsAppText } from "@/lib/whatsapp-redaction";

export const WHATSAPP_OPERATIONAL_EVENT_TYPES = [
  "LOCAL_HOURLY_LIMIT_BLOCKED",
  "LOCAL_DAILY_LIMIT_BLOCKED",
  "PROVIDER_RATE_LIMIT_RECEIVED",
  "EMERGENCY_OVERRIDE_USED",
  "QUIET_HOURS_BLOCKED",
  "COST_CAP_BLOCKED",
  "COST_CAP_OVERRIDE_APPLIED",
  "WEBHOOK_INVALID_SIGNATURE",
  "WEBHOOK_PROCESSING_FAILED"
] as const;

export async function recordWhatsAppOperationalEvent(client: any, data: {
  integrationProfileId: string;
  batchId?: string | null;
  eventKey: string;
  eventType: typeof WHATSAPP_OPERATIONAL_EVENT_TYPES[number];
  limitValue?: number | null;
  currentUsage?: number | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  nextEligibleAt?: Date | null;
  retryAfterSeconds?: number | null;
  safeReason?: string | null;
  estimatedCostMinor?: number | null;
  costCapMinor?: number | null;
  currency?: string | null;
  rateVersion?: string | null;
  snapshotHash?: string | null;
  recordedByUserId?: string | null;
}) {
  const safe = {
    ...data,
    batchId: data.batchId ?? null,
    safeReason: data.safeReason ? redactWhatsAppText(data.safeReason).slice(0, 500) : null,
    lastOccurredAt: new Date()
  };
  return client.whatsAppOperationalEvent.upsert({
    where: { eventKey: data.eventKey },
    update: { occurrenceCount: { increment: 1 }, lastOccurredAt: safe.lastOccurredAt },
    create: safe
  });
}

export function operationalEventKey(parts: Array<string | number | Date | null | undefined>) {
  return createHash("sha256").update(parts.map((part) => part instanceof Date ? part.toISOString() : String(part ?? "")).join("|")).digest("hex");
}

export function indiaLimitPeriod(now: Date, kind: "HOUR" | "DAY") {
  const offsetMs = 330 * 60_000;
  const localMs = now.getTime() + offsetMs;
  const size = kind === "HOUR" ? 60 * 60_000 : 24 * 60 * 60_000;
  const startLocal = Math.floor(localMs / size) * size;
  return {
    start: new Date(startLocal - offsetMs),
    end: new Date(startLocal + size - offsetMs)
  };
}
