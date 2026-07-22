import { createHash } from "node:crypto";
import { createWhatsAppProvider } from "@/lib/whatsapp-provider";
import { canAdvanceWhatsAppDelivery, refreshWhatsAppBatchCounts, whatsappDeliveryStatusData } from "@/lib/whatsapp-deliveries";
import { operationalEventKey, recordWhatsAppOperationalEvent } from "@/lib/whatsapp-operational-events";
import { assertWebhookEventCount, securitySecret, webhookEventKey } from "@/lib/security-secrets";

export function verifyWhatsAppWebhookChallenge(params: URLSearchParams, mode: string) {
  const challenge = params.get("hub.challenge");
  const verifyToken = params.get("hub.verify_token");
  const expected = mode === "LIVE"
    ? process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    : securitySecret("WHATSAPP_MOCK_VERIFY_TOKEN");
  if (params.get("hub.mode") !== "subscribe" || !challenge || !expected || verifyToken !== expected) {
    throw new Error("Webhook verification failed.");
  }
  return challenge;
}

export async function processWhatsAppWebhook(client: any, profileId: string, rawBody: string, signature: string | null) {
  const profile = await client.whatsAppIntegrationProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("WhatsApp integration profile was not found.");
  const provider = createWhatsAppProvider(profile.mode);
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    const bucket = new Date().toISOString().slice(0, 13);
    await recordWhatsAppOperationalEvent(client, {
      integrationProfileId: profile.id,
      eventKey: operationalEventKey(["WEBHOOK_INVALID_SIGNATURE", profile.id, bucket]),
      eventType: "WEBHOOK_INVALID_SIGNATURE",
      safeReason: "Webhook signature validation failed."
    });
    throw new WhatsAppWebhookSignatureError();
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody); }
  catch { throw new Error("Webhook body is not valid JSON."); }
  const statuses = provider.parseDeliveryWebhook(payload);
  assertWebhookEventCount(statuses);
  let processed = 0, duplicate = 0, unknown = 0;
  const batchIds = new Set<string>();
  for (const status of statuses) {
    status.eventKey = webhookEventKey(status.eventKey);
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const existing = await client.whatsAppWebhookEvent.findUnique({ where: { eventKey: status.eventKey } });
    if (existing) {
      await client.whatsAppWebhookEvent.update({ where: { id: existing.id }, data: { duplicateReceiptCount: { increment: 1 } } });
      duplicate += 1;
      continue;
    }
    await client.$transaction(async (tx: any) => {
      const delivery = status.providerMessageId
        ? await tx.whatsAppDelivery.findUnique({ where: { providerMessageId: status.providerMessageId } })
        : null;
      if (status.status === "INBOUND_OPT_OUT" && status.phoneHash) {
        const consents = await tx.whatsAppConsent.findMany({ where: { phoneHash: status.phoneHash, status: "OPTED_IN" } });
        for (const consent of consents) {
          await tx.whatsAppConsent.update({ where: { id: consent.id }, data: { status: "OPTED_OUT", optedOutAt: status.timestamp } });
          await tx.whatsAppConsentEvent.create({ data: {
            consentId: consent.id, eventType: "CONSENT_OPTED_OUT", previousStatus: "OPTED_IN",
            newStatus: "OPTED_OUT", reason: "Recognised WhatsApp inbound opt-out keyword"
          } });
          await tx.whatsAppDelivery.updateMany({
            where: { consentId: consent.id, status: { in: ["SCHEDULED", "QUEUED", "RETRY_PENDING", "SENDING"] } },
            data: { status: "OPTED_OUT", optedOutAt: status.timestamp, nextAttemptAt: null, retryable: false }
          });
        }
      } else if (delivery && canAdvanceWhatsAppDelivery(delivery.status, status.status)) {
        await tx.whatsAppDelivery.update({ where: { id: delivery.id }, data: {
          ...whatsappDeliveryStatusData(status.status, status.timestamp),
          retryable: status.status === "FAILED" && status.retryable,
          providerErrorCategory: status.errorCategory ?? null,
          providerErrorCode: status.errorCode ?? null
        } });
        batchIds.add(delivery.batchId);
      }
      await tx.whatsAppWebhookEvent.create({ data: {
        integrationProfileId: profile.id,
        eventKey: status.eventKey,
        payloadHash,
        providerMessageId: status.providerMessageId,
        deliveryId: delivery?.id ?? null,
        eventType: status.status === "INBOUND_OPT_OUT" ? "OPT_OUT_SIGNAL" : status.status === "UNKNOWN" ? "UNKNOWN" : "MESSAGE_STATUS",
        mappedStatus: status.status,
        signatureValid: true,
        processingStatus: delivery || status.status === "INBOUND_OPT_OUT" ? "PROCESSED" : "IGNORED",
        safeSummaryJson: JSON.stringify(status.safeSummary),
        processedAt: new Date()
      } });
      if (!delivery && status.status !== "INBOUND_OPT_OUT") unknown += 1;
    });
    processed += 1;
  }
  for (const batchId of batchIds) await refreshWhatsAppBatchCounts(client, batchId);
  return { processed, duplicate, unknown, automaticReplies: 0 };
}

export class WhatsAppWebhookSignatureError extends Error {
  readonly status = 401;
  constructor() { super("Webhook signature is invalid."); }
}
