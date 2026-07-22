import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { assertWebhookEventCount, securitySecret, webhookEventKey } from "@/lib/security-secrets";

export type SmsEmailChannel = "SMS" | "EMAIL";

export type ExternalSendResult = {
  accepted: boolean;
  status: "ACCEPTED" | "SENT" | "FAILED";
  providerMessageId: string | null;
  retryable: boolean;
  providerHttpStatus?: number | null;
  providerErrorCode?: string | null;
  safeMessage: string;
};

export type ProviderHealth = {
  ok: boolean;
  status: "SUCCESS" | "WARNING" | "FAILED";
  message: string;
  metadata: Record<string, string | null>;
};

export type ProviderWebhookEvent = {
  eventKey: string;
  providerMessageId: string | null;
  eventType: "DELIVERY_STATUS" | "BOUNCE" | "COMPLAINT" | "SUPPRESSION" | "UNKNOWN";
  mappedStatus: "SENT" | "DELIVERED" | "BOUNCED" | "COMPLAINED" | "SUPPRESSED" | "FAILED" | "UNKNOWN";
  retryable: boolean;
  safePayload: Record<string, unknown>;
};

export interface SmsProvider {
  readonly mode: "MOCK" | "LIVE";
  healthCheck(options?: { network?: boolean }): Promise<ProviderHealth>;
  sendApprovedTemplate(input: {
    to: string;
    renderedText: string;
    dltPrincipalEntityReference: string;
    dltHeader: string;
    dltTemplateId: string;
    requestFingerprint: string;
    mockOutcome?: string | null;
  }): Promise<ExternalSendResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseDeliveryWebhook(payload: unknown): ProviderWebhookEvent[];
}

export interface EmailProvider {
  readonly mode: "MOCK" | "LIVE";
  healthCheck(options?: { network?: boolean }): Promise<ProviderHealth>;
  sendPlainText(input: {
    to: string;
    from: string;
    replyTo?: string | null;
    subject: string;
    text: string;
    requestFingerprint: string;
    mockOutcome?: string | null;
  }): Promise<ExternalSendResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseDeliveryWebhook(payload: unknown): ProviderWebhookEvent[];
}

export class MockSmsProvider implements SmsProvider {
  readonly mode = "MOCK" as const;

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      status: "SUCCESS",
      message: "Deterministic MOCK SMS provider is ready. No network request was made.",
      metadata: { provider: "MOCK_SMS", mode: "MOCK" }
    };
  }

  async sendApprovedTemplate(input: Parameters<SmsProvider["sendApprovedTemplate"]>[0]) {
    return mockSend("sms", input.requestFingerprint, input.mockOutcome);
  }

  verifyWebhookSignature(rawBody: string, signature: string | null) {
    return verifyMockSignature(rawBody, signature);
  }

  parseDeliveryWebhook(payload: any) {
    return parseMockEvents(payload);
  }
}

export class MockEmailProvider implements EmailProvider {
  readonly mode = "MOCK" as const;

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      status: "SUCCESS",
      message: "Deterministic MOCK Email provider is ready. No network request was made.",
      metadata: { provider: "MOCK_EMAIL", mode: "MOCK" }
    };
  }

  async sendPlainText(input: Parameters<EmailProvider["sendPlainText"]>[0]) {
    return mockSend("email", input.requestFingerprint, input.mockOutcome);
  }

  verifyWebhookSignature(rawBody: string, signature: string | null) {
    return verifyMockSignature(rawBody, signature);
  }

  parseDeliveryWebhook(payload: any) {
    return parseMockEvents(payload);
  }
}

export class UnavailableLiveSmsProvider implements SmsProvider {
  readonly mode = "LIVE" as const;

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: false,
      status: "FAILED",
      message: "SMS provider selection required.",
      metadata: { provider: null, mode: "LIVE", networkRequest: "none" }
    };
  }

  async sendApprovedTemplate(): Promise<ExternalSendResult> {
    return {
      accepted: false,
      status: "FAILED",
      providerMessageId: null,
      retryable: false,
      providerErrorCode: "SMS_PROVIDER_REQUIRED",
      safeMessage: "SMS provider selection required. No network request was made."
    };
  }

  verifyWebhookSignature() { return false; }
  parseDeliveryWebhook() { return []; }
}

export class GmailApiEmailProvider implements EmailProvider {
  readonly mode = "LIVE" as const;

  async healthCheck(options: { network?: boolean } = {}): Promise<ProviderHealth> {
    const missing = gmailEnvironmentMissing();
    if (process.env.SMS_EMAIL_EMAIL_LIVE_ENABLED !== "true") {
      return healthFailure("Email LIVE sending is disabled by the environment feature flag.", missing);
    }
    if (missing.length) return healthFailure("Gmail API OAuth configuration is incomplete.", missing);
    if (!options.network) {
      return {
        ok: true,
        status: "WARNING",
        message: "Gmail API environment configuration is present. A supervised network health check is still required.",
        metadata: { provider: "GMAIL_API", mode: "LIVE", scope: "gmail.send", networkChecked: "false" }
      };
    }
    try {
      await gmailAccessToken();
      return {
        ok: true,
        status: "SUCCESS",
        message: "Gmail API OAuth token health check succeeded. This does not prove inbox delivery.",
        metadata: { provider: "GMAIL_API", mode: "LIVE", scope: "gmail.send", networkChecked: "true" }
      };
    } catch (error) {
      return healthFailure(safeProviderError(error, "Gmail API health check failed."), []);
    }
  }

  async sendPlainText(input: Parameters<EmailProvider["sendPlainText"]>[0]): Promise<ExternalSendResult> {
    if (process.env.SMS_EMAIL_EMAIL_LIVE_ENABLED !== "true") {
      return failed("LIVE_SENDING_DISABLED", "Email LIVE sending is disabled.", false);
    }
    const missing = gmailEnvironmentMissing();
    if (missing.length) return failed("GMAIL_CONFIG_MISSING", "Gmail API OAuth configuration is incomplete.", false);
    try {
      const sender = requiredHeaderAddress(input.from, "From");
      const to = requiredHeaderAddress(input.to, "To");
      const replyTo = input.replyTo ? requiredHeaderAddress(input.replyTo, "Reply-To") : null;
      const subject = headerValue(input.subject, "Subject", 180);
      const body = safePlainText(input.text);
      const mime = [
        `From: ${sender}`,
        `To: ${to}`,
        ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
        `Subject: ${encodeSubject(subject)}`,
        `Message-ID: <${input.requestFingerprint}@nalandaps.com>`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        body
      ].join("\r\n");
      const accessToken = await gmailAccessToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const userId = encodeURIComponent(process.env.GMAIL_SENDER_EMAIL!.trim());
      try {
        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }),
          signal: controller.signal
        });
        const value = await response.json().catch(() => ({})) as any;
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          return {
            accepted: false,
            status: "FAILED",
            providerMessageId: null,
            retryable,
            providerHttpStatus: response.status,
            providerErrorCode: safeCode(value?.error?.status ?? value?.error?.code),
            safeMessage: retryable ? "Gmail API temporarily rejected the request." : "Gmail API rejected the request."
          };
        }
        return {
          accepted: true,
          status: "ACCEPTED",
          providerMessageId: typeof value?.id === "string" ? value.id : null,
          retryable: false,
          providerHttpStatus: response.status,
          safeMessage: "Accepted by Gmail API. Final inbox delivery is not proven."
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      return failed("GMAIL_REQUEST_FAILED", safeProviderError(error, "Gmail API request failed."), true);
    }
  }

  verifyWebhookSignature() { return false; }
  parseDeliveryWebhook() { return []; }
}

export function createSmsProvider(mode: string): SmsProvider {
  return mode === "LIVE" ? new UnavailableLiveSmsProvider() : new MockSmsProvider();
}

export function createEmailProvider(mode: string): EmailProvider {
  return mode === "LIVE" ? new GmailApiEmailProvider() : new MockEmailProvider();
}

export function signMockSmsEmailWebhook(rawBody: string) {
  return `sha256=${createHmac("sha256", securitySecret("SMS_EMAIL_MOCK_WEBHOOK_SECRET")).update(rawBody).digest("hex")}`;
}

function mockSend(kind: string, fingerprint: string, requested: string | null | undefined): ExternalSendResult {
  const outcome = String(requested ?? "ACCEPTED").toUpperCase();
  if (["RETRYABLE_FAILURE", "PROVIDER_RATE_LIMIT"].includes(outcome)) {
    return failed(outcome === "PROVIDER_RATE_LIMIT" ? "MOCK_429" : "MOCK_RETRYABLE", "Deterministic retryable MOCK failure.", true);
  }
  if (["PERMANENT_FAILURE", "HARD_BOUNCE", "COMPLAINT", "SUPPRESSED"].includes(outcome)) {
    return failed(`MOCK_${outcome}`, "Deterministic permanent MOCK failure.", false);
  }
  return {
    accepted: true,
    status: kind === "email" ? "ACCEPTED" : "SENT",
    providerMessageId: `${kind}.mock.${createHash("sha256").update(fingerprint).digest("hex").slice(0, 24)}`,
    retryable: false,
    providerHttpStatus: 202,
    safeMessage: `Accepted by deterministic MOCK ${kind.toUpperCase()} provider.`
  };
}

function parseMockEvents(payload: any): ProviderWebhookEvent[] {
  const rows = Array.isArray(payload?.events) ? payload.events : [];
  assertWebhookEventCount(rows);
  return rows.map((row: any, index: number) => {
    const mapped = String(row?.status ?? "UNKNOWN").toUpperCase();
    const allowed = ["SENT", "DELIVERED", "BOUNCED", "COMPLAINED", "SUPPRESSED", "FAILED"].includes(mapped)
      ? mapped as ProviderWebhookEvent["mappedStatus"] : "UNKNOWN";
    return {
      eventKey: webhookEventKey(row?.eventKey ?? `mock:${row?.providerMessageId ?? "unknown"}:${mapped}:${index}`),
      providerMessageId: typeof row?.providerMessageId === "string" ? row.providerMessageId : null,
      eventType: allowed === "BOUNCED" ? "BOUNCE" : allowed === "COMPLAINED" ? "COMPLAINT"
        : allowed === "SUPPRESSED" ? "SUPPRESSION" : allowed === "UNKNOWN" ? "UNKNOWN" : "DELIVERY_STATUS",
      mappedStatus: allowed,
      retryable: allowed === "FAILED" && Boolean(row?.retryable),
      safePayload: { status: allowed, reasonCode: safeCode(row?.reasonCode) }
    };
  });
}

function verifyMockSignature(rawBody: string, signature: string | null) {
  if (!signature?.startsWith("sha256=")) return false;
  let secret: string;
  try { secret = securitySecret("SMS_EMAIL_MOCK_WEBHOOK_SECRET"); }
  catch { return false; }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = signature.slice(7);
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

async function gmailAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_OAUTH_CLIENT_ID!.trim(),
      client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!.trim(),
      refresh_token: process.env.GMAIL_OAUTH_REFRESH_TOKEN!.trim(),
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(10_000)
  });
  const value = await response.json().catch(() => ({})) as any;
  if (!response.ok || typeof value?.access_token !== "string") throw new Error("OAuth token exchange was rejected.");
  return value.access_token as string;
}

function gmailEnvironmentMissing(): string[] {
  return [
    ["SMS_EMAIL_CONTACT_HASH_PEPPER", process.env.SMS_EMAIL_CONTACT_HASH_PEPPER],
    ["GMAIL_OAUTH_CLIENT_ID", process.env.GMAIL_OAUTH_CLIENT_ID],
    ["GMAIL_OAUTH_CLIENT_SECRET", process.env.GMAIL_OAUTH_CLIENT_SECRET],
    ["GMAIL_OAUTH_REFRESH_TOKEN", process.env.GMAIL_OAUTH_REFRESH_TOKEN],
    ["GMAIL_SENDER_EMAIL", process.env.GMAIL_SENDER_EMAIL]
  ].filter(([, value]) => !String(value ?? "").trim()).map(([name]) => String(name));
}

function healthFailure(message: string, missing: string[]): ProviderHealth {
  return { ok: false, status: "FAILED", message, metadata: { provider: "GMAIL_API", mode: "LIVE", missing: missing.join(",") || null } };
}
function failed(code: string, message: string, retryable: boolean): ExternalSendResult {
  return { accepted: false, status: "FAILED", providerMessageId: null, retryable, providerErrorCode: code, safeMessage: message };
}
function requiredHeaderAddress(value: string, label: string) {
  const text = headerValue(value, label, 320);
  if (!/^[^<>,\s@]+@[^<>,\s@]+\.[^<>,\s@]+$/.test(text)) throw new Error(`${label} email address is invalid.`);
  return text;
}
function headerValue(value: string, label: string, max: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max || /[\r\n]/.test(text)) throw new Error(`${label} is invalid.`);
  return text;
}
function safePlainText(value: string) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (!text || text.length > 10_000 || /<\/?[A-Za-z][^>]*>/.test(text) || /\bhttps?:\/\/\S+/i.test(text)) {
    throw new Error("Email body must be safe plain text without HTML or external links.");
  }
  return text;
}
function encodeSubject(value: string) {
  return /[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=` : value;
}
function safeCode(value: unknown) {
  const text = String(value ?? "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  return text || null;
}
function safeProviderError(error: unknown, fallback: string) {
  const text = error instanceof Error ? error.message : fallback;
  return /(token|secret|credential|authorization|bearer)/i.test(text) ? fallback : text.slice(0, 240);
}
