import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  WhatsAppHealthResult,
  WhatsAppProvider,
  WhatsAppProviderSendResult,
  WhatsAppTemplateSendInput,
  WhatsAppWebhookStatus
} from "@/lib/whatsapp-provider";
import { safeProviderError, isRetryableProviderError } from "@/lib/whatsapp-redaction";
import { MockWhatsAppProvider } from "@/lib/whatsapp-provider-mock";

export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  readonly mode = "LIVE" as const;

  async healthCheck(options: { network?: boolean } = {}): Promise<WhatsAppHealthResult> {
    const config = liveConfig();
    const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
    if (process.env.WHATSAPP_LIVE_SENDING_ENABLED !== "true") missing.push("WHATSAPP_LIVE_SENDING_ENABLED=true");
    if (!/^v\d+\.\d+$/.test(config.graphApiVersion)) missing.push("valid WHATSAPP_GRAPH_API_VERSION");
    if (missing.length) return {
      ok: false, status: "FAILED", message: `Live environment is incomplete: ${missing.join(", ")}.`,
      metadata: publicMetadata(config)
    };
    if (!options.network) return { ok: true, status: "SUCCESS", message: "Environment-backed live configuration is complete.", metadata: publicMetadata(config) };
    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${config.accessToken}` }, signal: AbortSignal.timeout(10_000), cache: "no-store" }
      );
      if (!response.ok) throw Object.assign(new Error(`Meta health check returned HTTP ${response.status}`), { status: response.status });
      return { ok: true, status: "SUCCESS", message: "Meta Cloud API configuration health check passed.", metadata: publicMetadata(config) };
    } catch (error) {
      const safe = safeProviderError(error);
      return { ok: false, status: "FAILED", message: safe.message, metadata: publicMetadata(config) };
    }
  }

  async sendApprovedTemplate(input: WhatsAppTemplateSendInput): Promise<WhatsAppProviderSendResult> {
    const health = await this.healthCheck();
    if (!health.ok) return { accepted: false, providerMessageId: null, providerStatus: "failed", retryable: false, errorCategory: "CONFIGURATION", safeMessage: health.message };
    const config = liveConfig();
    const named = input.parameters.some((row) => row.name);
    const parameters = input.parameters.map((row) => ({
      type: "text",
      ...(named && row.name ? { parameter_name: row.name } : {}),
      text: row.value
    }));
    try {
      const response = await fetch(`https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to,
          type: "template",
          biz_opaque_callback_data: input.opaqueCallbackData,
          template: {
            name: input.templateName,
            language: { code: input.languageCode },
            components: parameters.length ? [{ type: "body", parameters }] : []
          }
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = Object.assign(new Error(body?.error?.message ?? `Meta send returned HTTP ${response.status}`), { code: body?.error?.code ?? response.status });
        throw error;
      }
      const message = body?.messages?.[0];
      const providerStatus = ["accepted", "held_for_quality_assessment", "paused"].includes(message?.message_status)
        ? message.message_status : "accepted";
      return {
        accepted: providerStatus !== "paused",
        providerMessageId: message?.id ? String(message.id) : null,
        providerStatus,
        retryable: providerStatus === "paused",
        safeMessage: providerStatus === "paused" ? "Provider paused message delivery." : "Accepted by Meta Cloud API."
      };
    } catch (error) {
      const safe = safeProviderError(error);
      return {
        accepted: false, providerMessageId: null, providerStatus: "failed",
        retryable: isRetryableProviderError(safe.category), errorCategory: safe.category,
        errorCode: safe.code, safeMessage: safe.message
      };
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string | null) {
    const secret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!secret || !signature?.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const actual = signature.slice(7);
    return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }

  parseDeliveryWebhook(payload: unknown): WhatsAppWebhookStatus[] {
    return new MockWhatsAppProvider().parseDeliveryWebhook(payload);
  }
}

function liveConfig() {
  return {
    graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION?.trim() ?? "v25.0",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "",
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim() ?? "",
    phoneHashPepper: process.env.WHATSAPP_PHONE_HASH_PEPPER?.trim() ?? ""
  };
}

function publicMetadata(config: ReturnType<typeof liveConfig>) {
  return {
    provider: "META_CLOUD",
    mode: "LIVE",
    graphApiVersion: config.graphApiVersion,
    businessAccountConfigured: config.businessAccountId ? "yes" : "no",
    phoneNumberConfigured: config.phoneNumberId ? "yes" : "no"
  };
}
