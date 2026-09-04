import { createHash } from "node:crypto";
import type { CommunicationProviderAdapter } from "@/lib/communication-adapters";
import { canApplyProviderState, type CommunicationOutboxState } from "@/lib/communication-types";
import { COMMUNICATION_WEBHOOK_MAX_BYTES } from "@/lib/communication-policy";

export class CommunicationWebhookError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}

export async function processCommunicationWebhook(client: any, input: {
  profileCode: string;
  channel: string;
  rawBody: string;
  contentType: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  adapter: CommunicationProviderAdapter;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!/^application\/json(?:\s*;|$)/i.test(input.contentType ?? "")) throw new CommunicationWebhookError("Unsupported content type.", 415, "CONTENT_TYPE_INVALID");
  if (Buffer.byteLength(input.rawBody, "utf8") > COMMUNICATION_WEBHOOK_MAX_BYTES) throw new CommunicationWebhookError("Webhook body is too large.", 413, "BODY_TOO_LARGE");
  if (!input.timestamp || !/^\d{10,13}$/.test(input.timestamp)) throw new CommunicationWebhookError("Webhook timestamp is invalid.", 401, "TIMESTAMP_INVALID");
  const timestampMs = input.timestamp.length === 10 ? Number(input.timestamp) * 1_000 : Number(input.timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now.getTime() - timestampMs) > 5 * 60_000) throw new CommunicationWebhookError("Webhook timestamp is outside the allowed window.", 401, "TIMESTAMP_STALE");
  if (!input.signature || !input.adapter.verifyWebhook(input.rawBody, input.timestamp, input.signature, input.secret)) throw new CommunicationWebhookError("Webhook signature verification failed.", 401, "SIGNATURE_INVALID");
  let payload: unknown;
  try { payload = JSON.parse(input.rawBody); } catch { throw new CommunicationWebhookError("Webhook JSON is invalid.", 400, "JSON_INVALID"); }
  const receipts = input.adapter.normalizeReceipt(payload);
  if (receipts.length > 100) throw new CommunicationWebhookError("Webhook event count is too large.", 413, "EVENT_COUNT_EXCEEDED");
  let processed = 0, duplicated = 0, unknown = 0, stale = 0;
  for (const receipt of receipts) {
    const scopedEventKey = createHash("sha256").update(`${input.profileCode}\u0000${receipt.providerEventKey}`).digest("hex");
    const existing = await client.communicationWebhookEvent.findUnique({ where: { providerEventKey: scopedEventKey } });
    if (existing) { await client.communicationWebhookEvent.update({ where: { id: existing.id }, data: { duplicateCount: { increment: 1 } } }); duplicated++; continue; }
    const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
    try {
      const outcome = await client.$transaction(async (tx: any) => {
        const replay = await tx.communicationWebhookEvent.findUnique({ where: { providerEventKey: scopedEventKey } });
        if (replay) {
          await tx.communicationWebhookEvent.update({ where: { id: replay.id }, data: { duplicateCount: { increment: 1 } } });
          return "DUPLICATE" as const;
        }
        const item = receipt.providerMessageId ? await tx.communicationOutboxItem.findFirst({ where: {
          providerMessageId: receipt.providerMessageId,
          providerProfileCode: input.profileCode,
          channel: input.channel
        } }) : null;
        let processingState = "IGNORED_UNKNOWN_MESSAGE";
        let outcome: "UNKNOWN" | "STALE" | "PROCESSED" = "UNKNOWN";
        if (item && canApplyProviderState(item.state as CommunicationOutboxState, receipt.state)) {
          const transition = await tx.communicationOutboxItem.updateMany({ where: { id: item.id, state: item.state, updatedAt: item.updatedAt }, data: {
            state: receipt.state,
            ...(receipt.state === "SENT" ? { sentAt: receipt.occurredAt } : {}),
            ...(receipt.state === "DELIVERED" ? { sentAt: item.sentAt ?? receipt.occurredAt, deliveredAt: receipt.occurredAt } : {}),
            ...(receipt.state === "FAILED_PERMANENT" ? { failedAt: receipt.occurredAt, lastSafeErrorCode: "PROVIDER_PERMANENT_FAILURE" } : {})
          } });
          if (transition.count === 1) {
            await tx.communicationDeliveryReceipt.create({ data: { outboxItemId: item.id, providerEventKey: scopedEventKey, providerMessageId: receipt.providerMessageId, state: receipt.state, occurredAt: receipt.occurredAt, evidenceHash: receipt.evidenceHash, safeMetadataJson: JSON.stringify(receipt.safeMetadata) } });
            processingState = "PROCESSED";
            outcome = "PROCESSED";
          } else {
            processingState = "IGNORED_STALE_OR_POLICY_TERMINAL";
            outcome = "STALE";
          }
        } else if (item) {
          processingState = "IGNORED_STALE_OR_POLICY_TERMINAL";
          outcome = "STALE";
        }
        await tx.communicationWebhookEvent.create({ data: { providerProfileCode: input.profileCode, providerEventKey: scopedEventKey, payloadHash, signatureVerified: true, timestampVerified: true, contentTypeVerified: true, processingState, safeMetadataJson: JSON.stringify({ state: receipt.state, matched: Boolean(item) }), receivedAt: now, processedAt: now } });
        return outcome;
      });
      if (outcome === "DUPLICATE") duplicated++;
      else if (outcome === "PROCESSED") processed++;
      else if (outcome === "STALE") stale++;
      else unknown++;
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      await client.communicationWebhookEvent.updateMany({ where: { providerEventKey: scopedEventKey }, data: { duplicateCount: { increment: 1 } } });
      duplicated++;
    }
  }
  return { received: receipts.length, processed, duplicated, unknown, stale };
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
