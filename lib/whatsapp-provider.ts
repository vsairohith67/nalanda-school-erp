export type WhatsAppTemplateSendInput = {
  to: string;
  templateName: string;
  languageCode: string;
  parameters: Array<{ name?: string; value: string }>;
  requestFingerprint: string;
  opaqueCallbackData: string;
  mockOutcome?: string | null;
};

export type WhatsAppProviderSendResult = {
  accepted: boolean;
  providerMessageId: string | null;
  providerStatus: "accepted" | "held_for_quality_assessment" | "paused" | "failed";
  retryable: boolean;
  errorCategory?: string;
  errorCode?: string | null;
  safeMessage: string;
};

export type WhatsAppWebhookStatus = {
  eventKey: string;
  providerMessageId: string | null;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED" | "INBOUND_OPT_OUT" | "UNKNOWN";
  timestamp: Date;
  retryable: boolean;
  errorCategory?: string | null;
  errorCode?: string | null;
  phoneHash?: string | null;
  safeSummary: Record<string, unknown>;
};

export type WhatsAppHealthResult = {
  ok: boolean;
  status: "SUCCESS" | "FAILED";
  message: string;
  metadata: Record<string, string | null>;
};

export interface WhatsAppProvider {
  readonly mode: "MOCK" | "LIVE";
  healthCheck(options?: { network?: boolean }): Promise<WhatsAppHealthResult>;
  sendApprovedTemplate(input: WhatsAppTemplateSendInput): Promise<WhatsAppProviderSendResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseDeliveryWebhook(payload: unknown): WhatsAppWebhookStatus[];
}

export function createWhatsAppProvider(mode: string): WhatsAppProvider {
  return mode === "LIVE" ? new MetaCloudWhatsAppProvider() : new MockWhatsAppProvider();
}
import { MetaCloudWhatsAppProvider } from "@/lib/whatsapp-provider-meta";
import { MockWhatsAppProvider } from "@/lib/whatsapp-provider-mock";
