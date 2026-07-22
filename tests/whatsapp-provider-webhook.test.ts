import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MockWhatsAppProvider, signMockWhatsAppWebhook } from "@/lib/whatsapp-provider-mock";
import { MetaCloudWhatsAppProvider } from "@/lib/whatsapp-provider-meta";
import { canAdvanceWhatsAppDelivery, whatsappDeliveryStatusData } from "@/lib/whatsapp-deliveries";
import { verifyWhatsAppWebhookChallenge } from "@/lib/whatsapp-webhooks";
import { classifyProviderError, redactWhatsAppText } from "@/lib/whatsapp-redaction";
import { securitySecret } from "@/lib/security-secrets";

describe("Prompt 19B deterministic provider", () => {
  const input = {
    to: "+919876543210", templateName: "school_update", languageCode: "en_US",
    parameters: [{ name: "school_name", value: "Nalanda" }], requestFingerprint: "stable-fingerprint",
    opaqueCallbackData: "delivery"
  };
  it("returns a stable fake provider message ID", async () => {
    const provider = new MockWhatsAppProvider();
    expect((await provider.sendApprovedTemplate(input)).providerMessageId).toBe((await provider.sendApprovedTemplate(input)).providerMessageId);
  });
  it("classifies configured retryable and permanent failures", async () => {
    const provider = new MockWhatsAppProvider();
    await expect(provider.sendApprovedTemplate({ ...input, mockOutcome: "RETRYABLE_FAILURE" })).resolves.toMatchObject({ accepted: false, retryable: true });
    await expect(provider.sendApprovedTemplate({ ...input, mockOutcome: "PERMANENT_FAILURE" })).resolves.toMatchObject({ accepted: false, retryable: false });
  });
  it("fails LIVE readiness safely when environment activation and credentials are absent", async () => {
    const names = [
      "WHATSAPP_LIVE_SENDING_ENABLED", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_PHONE_HASH_PEPPER"
    ] as const;
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    try {
      for (const name of names) delete process.env[name];
      const health = await new MetaCloudWhatsAppProvider().healthCheck({ network: true });
      expect(health).toMatchObject({ ok: false, status: "FAILED" });
      expect(JSON.stringify(health)).not.toContain("Bearer");
      expect(JSON.stringify(health.metadata)).not.toMatch(/accessToken|verifyToken|appSecret|phoneHashPepper/);
    } finally {
      for (const name of names) {
        if (previous[name] == null) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });
  it("verifies HMAC fixtures and rejects invalid signatures", () => {
    const raw = JSON.stringify({ entry: [] }), provider = new MockWhatsAppProvider();
    expect(provider.verifyWebhookSignature(raw, signMockWhatsAppWebhook(raw))).toBe(true);
    expect(provider.verifyWebhookSignature(raw, "sha256=bad")).toBe(false);
  });
  it("parses status progression and the minimal compliance opt-out keyword", () => {
    const provider = new MockWhatsAppProvider();
    const payload = { entry: [{ changes: [{ value: {
      statuses: [{ id: "wamid.mock.1", status: "delivered", timestamp: "1784304000" }],
      messages: [{ id: "inbound-1", from: "919876543210", timestamp: "1784304001", text: { body: "STOP" } }]
    } }] }] };
    expect(provider.parseDeliveryWebhook(payload).map((row) => row.status)).toEqual(["DELIVERED", "INBOUND_OPT_OUT"]);
  });
  it("does not regress READ and treats READ as delivered evidence", () => {
    expect(canAdvanceWhatsAppDelivery("READ", "DELIVERED")).toBe(false);
    expect(canAdvanceWhatsAppDelivery("SENT", "READ")).toBe(true);
    expect(whatsappDeliveryStatusData("READ", new Date("2026-07-17T00:00:00Z"))).toMatchObject({ status: "READ", deliveredAt: expect.any(Date), sentAt: expect.any(Date) });
  });
  it("recognises only the exact configured opt-out keywords, case-insensitively after trimming", () => {
    const provider = new MockWhatsAppProvider();
    const payload = { entry: [{ changes: [{ value: { messages: [
      { id: "inbound-stop", from: "919876543210", text: { body: " stop " } },
      { id: "inbound-unsubscribe", from: "919876543210", text: { body: "UnSubscribe" } },
      { id: "inbound-cancel", from: "919876543210", text: { body: "CANCEL" } },
      { id: "inbound-unknown", from: "919876543210", text: { body: "YES" } },
      { id: "inbound-old-extra", from: "919876543210", text: { body: "OPT OUT" } }
    ] } }] }] };
    expect(provider.parseDeliveryWebhook(payload).map((row) => row.safeSummary)).toEqual([
      { kind: "INBOUND_OPT_OUT", keyword: "STOP" },
      { kind: "INBOUND_OPT_OUT", keyword: "UNSUBSCRIBE" },
      { kind: "INBOUND_OPT_OUT", keyword: "CANCEL" }
    ]);
  });
});

describe("Prompt 19B webhook and redaction safety", () => {
  it("allows Meta to reach only the signed profile-scoped webhook before session authentication", () => {
    const middleware = readFileSync("middleware.ts", "utf8");
    expect(middleware).toContain('"/api/whatsapp/webhook/"');
    expect(middleware).not.toContain('"/api/whatsapp/"');
  });
  it("clears stale provider failure metadata after a retry succeeds", () => {
    const worker = readFileSync("lib/whatsapp-worker.ts", "utf8");
    const acceptedBranch = worker.slice(worker.indexOf('status: "ACCEPTED"'), worker.indexOf("} : {", worker.indexOf('status: "ACCEPTED"')));
    expect(acceptedBranch).toContain("providerErrorCategory: null");
    expect(acceptedBranch).toContain("providerErrorCode: null");
    expect(acceptedBranch).toContain("failureMessageSafe: null");
  });
  it("implements the official GET verification parameter names", () => {
    const params = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": securitySecret("WHATSAPP_MOCK_VERIFY_TOKEN"), "hub.challenge": "12345" });
    expect(verifyWhatsAppWebhookChallenge(params, "MOCK")).toBe("12345");
    params.set("hub.verify_token", "wrong");
    expect(() => verifyWhatsAppWebhookChallenge(params, "MOCK")).toThrow(/failed/);
  });
  it("redacts phone and credential-looking error text", () => {
    const value = redactWhatsAppText("authorization=BearerSecret recipient +919876543210");
    expect(value).not.toContain("BearerSecret");
    expect(value).not.toContain("+919876543210");
    expect(value).toContain("3210");
  });
  it("classifies rate, transient, and permanent validation failures", () => {
    expect(classifyProviderError("429", "rate limit")).toBe("RATE_LIMIT");
    expect(classifyProviderError("500", "server")).toBe("TRANSIENT");
    expect(classifyProviderError("131008", "template parameter missing")).toBe("PERMANENT_VALIDATION");
  });
});
