import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { CommunicationChannel } from "@/lib/communication-types";

export type CommunicationSendRequest = {
  channel: CommunicationChannel;
  destination: string | null;
  destinationDigest: string | null;
  destinationMasked: string | null;
  idempotencyKey: string;
  contentHash: string;
  title: string;
  subject: string | null;
  body: string;
  actionPath: string | null;
  simulation?: SyntheticDeliveryOutcome;
};

export type SyntheticDeliveryOutcome =
  | "ACCEPTED"
  | "DELIVERED"
  | "TIMEOUT_BEFORE_ACCEPTANCE"
  | "TIMEOUT_AFTER_ACCEPTANCE"
  | "RATE_LIMIT"
  | "OUTAGE"
  | "INVALID_DESTINATION"
  | "HARD_BOUNCE"
  | "COMPLAINT";

export type CommunicationSendResult = {
  accepted: boolean;
  state: "ACCEPTED_BY_PROVIDER" | "DELIVERED" | "FAILED_RETRYABLE" | "FAILED_PERMANENT";
  providerMessageId: string | null;
  retryable: boolean;
  uncertain: boolean;
  retryAfterMs?: number;
  safeCode: string;
  safeMessage: string;
};

export type NormalizedCommunicationReceipt = {
  providerEventKey: string;
  providerMessageId: string | null;
  state: "SENT" | "DELIVERED" | "FAILED_PERMANENT";
  occurredAt: Date;
  evidenceHash: string;
  safeMetadata: Record<string, string>;
};

export interface CommunicationProviderAdapter {
  readonly kind: "DISABLED" | "LOCAL_SYNTHETIC_SINK";
  readonly networkCapable: false;
  validateConfiguration(): { ok: boolean; safeMessage: string };
  health(): Promise<{ ok: boolean; state: "HEALTHY" | "DISABLED" | "OUTAGE"; safeMessage: string }>;
  send(request: CommunicationSendRequest): Promise<CommunicationSendResult>;
  verifyWebhook(rawBody: string, timestamp: string, signature: string, secret: string): boolean;
  normalizeReceipt(payload: unknown): NormalizedCommunicationReceipt[];
  classifyError(value: unknown): { retryable: boolean; safeCode: string };
  estimateCost(request: CommunicationSendRequest): { units: number; costMinor: number; currency: "SYNTHETIC" };
  close(): Promise<void>;
}

export class DisabledCommunicationAdapter implements CommunicationProviderAdapter {
  readonly kind = "DISABLED" as const;
  readonly networkCapable = false as const;
  validateConfiguration() { return { ok: false, safeMessage: "Provider is disabled." }; }
  async health() { return { ok: false, state: "DISABLED" as const, safeMessage: "Provider is disabled." }; }
  async send(): Promise<CommunicationSendResult> {
    return { accepted: false, state: "FAILED_PERMANENT", providerMessageId: null, retryable: false, uncertain: false, safeCode: "PROVIDER_DISABLED", safeMessage: "Provider delivery is disabled." };
  }
  verifyWebhook() { return false; }
  normalizeReceipt() { return []; }
  classifyError() { return { retryable: false, safeCode: "PROVIDER_DISABLED" }; }
  estimateCost() { return { units: 0, costMinor: 0, currency: "SYNTHETIC" as const }; }
  async close() { /* no resources */ }
}

export class LocalSyntheticCommunicationSink implements CommunicationProviderAdapter {
  readonly kind = "LOCAL_SYNTHETIC_SINK" as const;
  readonly networkCapable = false as const;
  readonly captured: ReadonlyArray<Readonly<CommunicationSendRequest & { providerMessageId: string }>>;
  private readonly deliveries: Array<Readonly<CommunicationSendRequest & { providerMessageId: string }>>;

  constructor(existing: Array<Readonly<CommunicationSendRequest & { providerMessageId: string }>> = []) {
    this.deliveries = existing;
    this.captured = this.deliveries;
  }

  validateConfiguration() { return { ok: true, safeMessage: "Deterministic local synthetic sink is ready; network access is unavailable by design." }; }
  async health() { return { ok: true, state: "HEALTHY" as const, safeMessage: "Local synthetic sink is healthy; no network request was made." }; }

  async send(request: CommunicationSendRequest): Promise<CommunicationSendResult> {
    assertSyntheticDestination(request.channel, request.destination);
    const providerMessageId = `synthetic.${createHash("sha256").update(`${request.channel}\u0000${request.idempotencyKey}\u0000${request.contentHash}`).digest("hex").slice(0, 32)}`;
    const prior = this.deliveries.find((row) => row.providerMessageId === providerMessageId);
    if (prior && prior.contentHash !== request.contentHash) throw new Error("COMMUNICATION_IDEMPOTENCY_CONTENT_MISMATCH");
    const outcome = request.simulation ?? "ACCEPTED";
    if (["ACCEPTED", "DELIVERED", "TIMEOUT_AFTER_ACCEPTANCE"].includes(outcome) && !prior) this.deliveries.push(Object.freeze({ ...request, providerMessageId }));
    if (outcome === "DELIVERED") return result(true, "DELIVERED", providerMessageId, false, false, "SYNTHETIC_DELIVERED", "Synthetic receipt confirms deterministic delivery.");
    if (outcome === "ACCEPTED") return result(true, "ACCEPTED_BY_PROVIDER", providerMessageId, false, false, "SYNTHETIC_ACCEPTED", "Synthetic provider accepted the item; human receipt is not claimed.");
    if (outcome === "TIMEOUT_AFTER_ACCEPTANCE") return result(false, "FAILED_RETRYABLE", providerMessageId, true, true, "SYNTHETIC_UNCERTAIN_ACCEPTANCE", "Synthetic timeout occurred after possible acceptance; reconcile before retry.");
    if (outcome === "TIMEOUT_BEFORE_ACCEPTANCE") return result(false, "FAILED_RETRYABLE", null, true, false, "SYNTHETIC_TIMEOUT", "Synthetic timeout occurred before acceptance.");
    if (outcome === "RATE_LIMIT") return { ...result(false, "FAILED_RETRYABLE", null, true, false, "SYNTHETIC_429", "Synthetic provider rate limit."), retryAfterMs: 60_000 };
    if (outcome === "OUTAGE") return result(false, "FAILED_RETRYABLE", null, true, false, "SYNTHETIC_OUTAGE", "Synthetic provider outage.");
    if (outcome === "HARD_BOUNCE") return result(false, "FAILED_PERMANENT", providerMessageId, false, false, "SYNTHETIC_HARD_BOUNCE", "Synthetic hard bounce invalidated this destination version.");
    if (outcome === "COMPLAINT") return result(false, "FAILED_PERMANENT", providerMessageId, false, false, "SYNTHETIC_COMPLAINT", "Synthetic complaint suppressed future optional delivery.");
    return result(false, "FAILED_PERMANENT", null, false, false, "SYNTHETIC_INVALID_DESTINATION", "Synthetic destination is invalid.");
  }

  verifyWebhook(rawBody: string, timestamp: string, signature: string, secret: string) {
    if (!/^\d{10,13}$/.test(timestamp) || !/^v1=[a-f0-9]{64}$/i.test(signature) || secret.length < 24) return false;
    const expected = `v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
  }

  normalizeReceipt(payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
    const root = payload as Record<string, unknown>;
    const events = Array.isArray(root.events) ? root.events.slice(0, 100) : [];
    return events.flatMap((value): NormalizedCommunicationReceipt[] => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const event = value as Record<string, unknown>;
      const eventKey = boundedToken(event.eventKey, 120), messageId = nullableToken(event.providerMessageId, 160);
      const state = String(event.state ?? "").toUpperCase();
      const occurredAt = new Date(String(event.occurredAt ?? ""));
      if (!eventKey || !["SENT", "DELIVERED", "FAILED_PERMANENT"].includes(state) || Number.isNaN(occurredAt.getTime())) return [];
      const safeMetadata = { source: "LOCAL_SYNTHETIC_SINK", outcome: state };
      return [{ providerEventKey: eventKey, providerMessageId: messageId, state: state as NormalizedCommunicationReceipt["state"], occurredAt, evidenceHash: createHash("sha256").update(JSON.stringify(event)).digest("hex"), safeMetadata }];
    });
  }

  classifyError(value: unknown) {
    const text = value instanceof Error ? value.message : String(value ?? "");
    return { retryable: /timeout|429|outage|temporar/i.test(text), safeCode: /429/.test(text) ? "RATE_LIMIT" : /timeout/i.test(text) ? "TIMEOUT" : "PROVIDER_FAILURE" };
  }

  estimateCost(request: CommunicationSendRequest) {
    const units = request.channel === "SMS" ? Math.max(1, Math.ceil(request.body.length / 67)) : request.channel === "IN_APP" ? 0 : 1;
    return { units, costMinor: units, currency: "SYNTHETIC" as const };
  }
  async close() { /* no resources */ }
}

export function createCommunicationAdapter(kind: unknown) {
  const value = String(kind ?? "DISABLED").trim().toUpperCase();
  if (value === "LOCAL_SYNTHETIC_SINK") return new LocalSyntheticCommunicationSink();
  if (value === "DISABLED") return new DisabledCommunicationAdapter();
  throw new Error("COMMUNICATION_PROVIDER_NOT_SELECTED");
}

export function assertSyntheticDestination(channel: CommunicationChannel, destination: string | null) {
  if (channel === "IN_APP") {
    if (destination !== null) throw new Error("IN_APP_DESTINATION_MUST_BE_SERVER_OWNED");
    return;
  }
  const value = String(destination ?? "").trim();
  if (channel === "EMAIL" && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.invalid$/i.test(value)) return;
  if (["SMS", "WHATSAPP", "NATIVE_PUSH"].includes(channel) && /^synthetic:(?:sms|whatsapp|push):[a-z0-9][a-z0-9_-]{2,80}$/i.test(value)) return;
  throw new Error("COMMUNICATION_SYNTHETIC_DESTINATION_REQUIRED");
}

export function signSyntheticCommunicationWebhook(rawBody: string, timestamp: string, secret: string) {
  if (secret.length < 24) throw new Error("COMMUNICATION_WEBHOOK_SECRET_REQUIRED");
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

function result(accepted: boolean, state: CommunicationSendResult["state"], providerMessageId: string | null, retryable: boolean, uncertain: boolean, safeCode: string, safeMessage: string): CommunicationSendResult {
  return { accepted, state, providerMessageId, retryable, uncertain, safeCode, safeMessage };
}
function boundedToken(value: unknown, max: number) { const text = String(value ?? "").trim(); return /^[A-Za-z0-9._:-]+$/.test(text) && text.length <= max ? text : null; }
function nullableToken(value: unknown, max: number) { if (value == null || value === "") return null; return boundedToken(value, max); }
