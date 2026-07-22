import { createHash } from "node:crypto";
import { createEmailProvider, createSmsProvider } from "@/lib/sms-email-provider";
import { refreshSmsEmailBatch } from "@/lib/sms-email-worker";
import { assertWebhookEventCount, webhookEventKey } from "@/lib/security-secrets";

const RANK: Record<string, number> = {
  QUEUED: 0, SENDING: 1, ACCEPTED: 2, SENT: 3, DELIVERED: 4,
  FAILED: 4, BOUNCED: 5, COMPLAINED: 6, SUPPRESSED: 7, CANCELLED: 8
};

export async function processSmsEmailWebhook(client: any, profileCode: string, rawBody: string, signature: string | null) {
  const profile = await client.smsEmailIntegrationProfile.findUnique({ where: { profileCode } });
  if (!profile) throw new Error("SMS/Email integration profile was not found.");
  const provider = profile.channel === "SMS" ? createSmsProvider(profile.mode) : createEmailProvider(profile.mode);
  if (!provider.verifyWebhookSignature(rawBody, signature)) throw new SmsEmailWebhookSignatureError();
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { throw new Error("Webhook body is not valid JSON."); }
  const events = provider.parseDeliveryWebhook(payload);
  assertWebhookEventCount(events);
  let processed = 0, duplicate = 0, unknown = 0;
  const batchIds = new Set<string>();
  for (const event of events) {
    event.eventKey = webhookEventKey(event.eventKey);
    const existing = await client.smsEmailWebhookEvent.findUnique({ where: { providerEventKey: event.eventKey } });
    if (existing) {
      await client.smsEmailWebhookEvent.update({ where: { id: existing.id }, data: { duplicateCount: { increment: 1 } } });
      duplicate++;
      continue;
    }
    await client.$transaction(async (tx: any) => {
      const delivery = event.providerMessageId ? await tx.smsEmailDelivery.findUnique({ where: { providerMessageId: event.providerMessageId } }) : null;
      if (delivery && delivery.channel !== profile.channel) throw new Error("Webhook channel does not match delivery.");
      if (delivery && canAdvance(delivery.status, event.mappedStatus)) {
        const update = statusData(event.mappedStatus);
        await tx.smsEmailDelivery.update({ where: { id: delivery.id }, data: {
          ...update, retryable: event.mappedStatus === "FAILED" && event.retryable,
          nextRetryAt: event.mappedStatus === "FAILED" && event.retryable ? new Date(Date.now() + 5 * 60_000) : null
        } });
        if (["BOUNCED", "COMPLAINED", "SUPPRESSED"].includes(event.mappedStatus)) {
          const subjectWhere = delivery.subjectType === "GUARDIAN" ? { guardianId: delivery.guardianId } : { staffMemberId: delivery.staffMemberId };
          const reason = event.mappedStatus === "BOUNCED" ? "HARD_BOUNCE" : event.mappedStatus === "COMPLAINED" ? "COMPLAINT" : "PROVIDER_SUPPRESSION";
          const active = await tx.smsEmailSuppression.findFirst({ where: { channel: delivery.channel, contactHash: delivery.contactHash, status: "ACTIVE", ...subjectWhere } });
          if (!active) await tx.smsEmailSuppression.create({ data: {
            channel: delivery.channel, subjectType: delivery.subjectType, ...subjectWhere,
            contactHash: delivery.contactHash, contactMasked: delivery.contactMasked,
            reason, providerReference: event.providerMessageId
          } });
          await tx.smsEmailDelivery.updateMany({
            where: { id: { not: delivery.id }, channel: delivery.channel, contactHash: delivery.contactHash, status: { in: ["QUEUED", "SENDING", "FAILED"] } },
            data: { status: "SUPPRESSED", suppressedAt: new Date(), retryable: false, nextRetryAt: null }
          });
        }
        batchIds.add(delivery.batchId);
      }
      await tx.smsEmailWebhookEvent.create({ data: {
        integrationProfileId: profile.id, deliveryId: delivery?.id ?? null, channel: profile.channel,
        providerEventKey: event.eventKey, providerMessageId: event.providerMessageId,
        eventType: event.eventType, mappedStatus: event.mappedStatus, signatureVerified: true,
        processedAt: new Date(), processingStatus: delivery ? "PROCESSED" : "IGNORED",
        safePayloadJson: JSON.stringify(event.safePayload)
      } });
      if (!delivery) unknown++;
    });
    processed++;
  }
  for (const id of batchIds) await refreshSmsEmailBatch(client, id);
  return { processed, duplicate, unknown, inboundMessagesStored: 0, automaticReplies: 0 };
}

export function safeSmsEmailWebhookFixture(channel: "SMS" | "EMAIL", providerMessageId: string, status: string, eventKey?: string) {
  const mapped = status.toUpperCase();
  if (!["SENT", "DELIVERED", "BOUNCED", "COMPLAINED", "SUPPRESSED", "FAILED"].includes(mapped)) throw new Error("Unsupported MOCK webhook status.");
  return {
    events: [{
      eventKey: eventKey ?? `qa19c:${channel}:${providerMessageId}:${mapped}`,
      providerMessageId,
      status: mapped,
      reasonCode: mapped === "BOUNCED" ? "MOCK_HARD_BOUNCE" : mapped === "COMPLAINED" ? "MOCK_COMPLAINT" : null
    }]
  };
}

function canAdvance(current: string, next: string) {
  if (["CANCELLED", "COMPLAINED", "SUPPRESSED"].includes(current)) return false;
  return (RANK[next] ?? -1) >= (RANK[current] ?? 0);
}
function statusData(status: string) {
  const now = new Date();
  if (status === "SENT") return { status, sentAt: now };
  if (status === "DELIVERED") return { status, deliveredAt: now };
  if (status === "BOUNCED") return { status, bouncedAt: now, failedAt: now, retryable: false, failureCategory: "PERMANENT" };
  if (status === "COMPLAINED") return { status, complainedAt: now, retryable: false };
  if (status === "SUPPRESSED") return { status, suppressedAt: now, retryable: false };
  if (status === "FAILED") return { status, failedAt: now };
  return { status: "UNKNOWN" };
}

export class SmsEmailWebhookSignatureError extends Error {
  readonly status = 401;
  constructor() { super("Webhook signature is invalid."); }
}

export function safeWebhookPayloadHash(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}
