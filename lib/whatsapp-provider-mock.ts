import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  WhatsAppHealthResult,
  WhatsAppProvider,
  WhatsAppProviderSendResult,
  WhatsAppTemplateSendInput,
  WhatsAppWebhookStatus
} from "@/lib/whatsapp-provider";
import { hashWhatsAppPhone } from "@/lib/whatsapp-phone";
import { assertWebhookEventCount, securitySecret, webhookEventKey } from "@/lib/security-secrets";

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly mode = "MOCK" as const;

  async healthCheck(): Promise<WhatsAppHealthResult> {
    return {
      ok: true,
      status: "SUCCESS",
      message: "Deterministic mock provider is ready. No network request was made.",
      metadata: { provider: "META_CLOUD", mode: "MOCK", graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0" }
    };
  }

  async sendApprovedTemplate(input: WhatsAppTemplateSendInput): Promise<WhatsAppProviderSendResult> {
    const outcome = String(input.mockOutcome ?? process.env.WHATSAPP_MOCK_OUTCOME ?? "ACCEPTED").toUpperCase();
    const id = `wamid.mock.${createHash("sha256").update(input.requestFingerprint).digest("hex").slice(0, 24)}`;
    if (outcome === "RETRYABLE_FAILURE") return {
      accepted: false, providerMessageId: null, providerStatus: "failed", retryable: true,
      errorCategory: "TRANSIENT", errorCode: "MOCK_RETRYABLE", safeMessage: "Deterministic retryable mock failure."
    };
    if (outcome === "PERMANENT_FAILURE") return {
      accepted: false, providerMessageId: null, providerStatus: "failed", retryable: false,
      errorCategory: "PERMANENT_VALIDATION", errorCode: "MOCK_PERMANENT", safeMessage: "Deterministic permanent mock failure."
    };
    if (outcome === "PROVIDER_RATE_LIMIT") return {
      accepted: false, providerMessageId: null, providerStatus: "failed", retryable: true,
      errorCategory: "RATE_LIMIT", errorCode: "MOCK_429", safeMessage: "Deterministic mock provider rate limit."
    };
    return {
      accepted: true,
      providerMessageId: id,
      providerStatus: outcome === "HELD" ? "held_for_quality_assessment" : outcome === "PAUSED" ? "paused" : "accepted",
      retryable: false,
      safeMessage: "Accepted by deterministic mock provider."
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null) {
    if (!signature?.startsWith("sha256=")) return false;
    let secret: string;
    try { secret = securitySecret("WHATSAPP_MOCK_WEBHOOK_SECRET"); }
    catch { return false; }
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const actual = signature.slice(7);
    return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }

  parseDeliveryWebhook(payload: any): WhatsAppWebhookStatus[] {
    const statuses = payload?.entry?.flatMap((entry: any) =>
      entry?.changes?.flatMap((change: any) => change?.value?.statuses ?? []) ?? []
    ) ?? [];
    const inbound = payload?.entry?.flatMap((entry: any) =>
      entry?.changes?.flatMap((change: any) => change?.value?.messages ?? []) ?? []
    ) ?? [];
    const result = statuses.map((row: any) => statusRow(row));
    for (const message of inbound) {
      const text = String(message?.text?.body ?? "").trim().toUpperCase();
      if (["STOP", "UNSUBSCRIBE", "CANCEL"].includes(text)) {
        result.push({
          eventKey: webhookEventKey(`inbound:${String(message.id ?? createHash("sha256").update(JSON.stringify(message)).digest("hex"))}`),
          providerMessageId: null,
          status: "INBOUND_OPT_OUT" as const,
          timestamp: new Date(Number(message.timestamp ?? Date.now() / 1000) * 1000),
          retryable: false,
          phoneHash: message.from ? hashWhatsAppPhone(String(message.from).startsWith("+") ? String(message.from) : `+${message.from}`) : null,
          safeSummary: { kind: "INBOUND_OPT_OUT", keyword: text }
        });
      }
    }
    assertWebhookEventCount(result);
    return result;
  }
}

export function signMockWhatsAppWebhook(rawBody: string) {
  return `sha256=${createHmac("sha256", securitySecret("WHATSAPP_MOCK_WEBHOOK_SECRET")).update(rawBody).digest("hex")}`;
}

function statusRow(row: any): WhatsAppWebhookStatus {
  const raw = String(row?.status ?? "").toLowerCase();
  const mapped = raw === "sent" ? "SENT" : raw === "delivered" ? "DELIVERED" : raw === "read" ? "READ" : raw === "failed" ? "FAILED" : "UNKNOWN";
  const error = row?.errors?.[0];
  const retryable = mapped === "FAILED" && (/rate|temporar|timeout/i.test(String(error?.message ?? error?.title ?? "")) || ["130429", "131016"].includes(String(error?.code ?? "")));
  return {
    eventKey: webhookEventKey(`status:${String(row?.id ?? "unknown")}:${raw}:${String(row?.timestamp ?? "0")}`),
    providerMessageId: row?.id ? String(row.id) : null,
    status: mapped,
    timestamp: new Date(Number(row?.timestamp ?? Date.now() / 1000) * 1000),
    retryable,
    errorCategory: mapped === "FAILED" ? retryable ? "TRANSIENT" : "PERMANENT_VALIDATION" : null,
    errorCode: error?.code == null ? null : String(error.code),
    safeSummary: { status: raw, pricingCategory: row?.pricing?.category ?? null, pricingType: row?.pricing?.type ?? null }
  };
}
