import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertWebhookEventCount,
  securitySecret,
  webhookEventKey
} from "@/lib/security-secrets";
import { hashWhatsAppPhone } from "@/lib/whatsapp-phone";
import { hashSmsEmailContact } from "@/lib/sms-email-contact-hash";
import { processWhatsAppWebhook } from "@/lib/whatsapp-webhooks";
import { processWhatsAppQueue } from "@/lib/whatsapp-worker";
import { MockWhatsAppProvider } from "@/lib/whatsapp-provider-mock";
import {
  processSmsEmailQueue,
  revalidateSmsEmailDelivery,
  recoverStaleSmsEmailClaims,
  renderApprovedSmsEmailDelivery
} from "@/lib/sms-email-worker";
import {
  hashAiAuditContent,
  parseAiAuditLimit,
  purgeExpiredAiAssistantAudits
} from "@/lib/ai-assistant-audit";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  WHATSAPP_PHONE_HASH_PEPPER: process.env.WHATSAPP_PHONE_HASH_PEPPER,
  SMS_EMAIL_CONTACT_HASH_PEPPER: process.env.SMS_EMAIL_CONTACT_HASH_PEPPER,
  AI_ASSISTANT_AUDIT_HASH_PEPPER: process.env.AI_ASSISTANT_AUDIT_HASH_PEPPER
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value == null) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("security secret and webhook boundaries", () => {
  it("requires configured high-entropy secrets in production", () => {
    expect(() => securitySecret("WHATSAPP_MOCK_WEBHOOK_SECRET", { NODE_ENV: "production" })).toThrow(/required in production/i);
    expect(() => securitySecret("SMS_EMAIL_MOCK_WEBHOOK_SECRET", {
      NODE_ENV: "production",
      SMS_EMAIL_MOCK_WEBHOOK_SECRET: "short"
    })).toThrow(/at least 32/i);
    expect(securitySecret("WHATSAPP_MOCK_VERIFY_TOKEN", {
      NODE_ENV: "production",
      WHATSAPP_MOCK_VERIFY_TOKEN: "a-configured-production-verify-token-1234"
    })).toBe("a-configured-production-verify-token-1234");
  });

  it("rejects webhook arrays above 100 and oversized event keys", () => {
    expect(() => assertWebhookEventCount(Array.from({ length: 101 }))).toThrow(/count exceeds/i);
    expect(() => webhookEventKey("x".repeat(201))).toThrow(/key is invalid/i);
    expect(webhookEventKey("provider-event-1")).toBe("provider-event-1");
    const statuses = Array.from({ length: 101 }, (_, index) => ({
      id: `wamid-${index}`,
      status: "delivered",
      timestamp: "1784304000"
    }));
    expect(() => new MockWhatsAppProvider().parseDeliveryWebhook({
      entry: [{ changes: [{ value: { statuses } }] }]
    })).toThrow(/count exceeds/i);
  });

  it("aggregates unique invalid WhatsApp signatures into one profile/hour key", async () => {
    const keys: string[] = [];
    const client: any = {
      whatsAppIntegrationProfile: {
        findUnique: async () => ({ id: "profile", mode: "MOCK" })
      },
      whatsAppOperationalEvent: {
        upsert: async ({ where }: any) => {
          keys.push(where.eventKey);
          return {};
        }
      }
    };
    await expect(processWhatsAppWebhook(client, "profile", "{\"one\":1}", null)).rejects.toThrow(/signature/i);
    await expect(processWhatsAppWebhook(client, "profile", "{\"two\":2}", null)).rejects.toThrow(/signature/i);
    expect(new Set(keys).size).toBe(1);
  });
});

describe("versioned contact and audit hashes", () => {
  it("uses keyed versioned contact hashes and fails closed without production peppers", () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.WHATSAPP_PHONE_HASH_PEPPER;
    delete process.env.SMS_EMAIL_CONTACT_HASH_PEPPER;
    expect(() => hashWhatsAppPhone("+919876543210")).toThrow(/required in production/i);
    expect(() => hashSmsEmailContact("EMAIL", "parent@example.com")).toThrow(/required in production/i);

    process.env.WHATSAPP_PHONE_HASH_PEPPER = "whatsapp-production-pepper-value-123456";
    process.env.SMS_EMAIL_CONTACT_HASH_PEPPER = "sms-email-production-pepper-value-123456";
    const phoneHash = hashWhatsAppPhone("+919876543210");
    expect(phoneHash).toMatch(/^[a-f0-9]{64}$/);
    expect(phoneHash).not.toBe(createHash("sha256").update("nalanda-whatsapp-phone-v1|+919876543210").digest("hex"));
  });

  it("bounds audit limits and requires a keyed production audit hash", () => {
    expect(parseAiAuditLimit(null)).toBe(100);
    expect(parseAiAuditLimit("0")).toBe(1);
    expect(parseAiAuditLimit("999")).toBe(250);
    for (const value of ["-1", "1.5", "NaN"]) expect(() => parseAiAuditLimit(value)).toThrow("INVALID_AUDIT_LIMIT");

    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.AI_ASSISTANT_AUDIT_HASH_PEPPER;
    expect(() => hashAiAuditContent("common question")).toThrow(/required in production/i);
    process.env.AI_ASSISTANT_AUDIT_HASH_PEPPER = "ai-audit-production-pepper-value-123456";
    expect(hashAiAuditContent("common question")).not.toBe(createHash("sha256").update("common question").digest("hex"));
  });

  it("purges expired audit children before their parent rows", async () => {
    const order: string[] = [];
    const client: any = {
      aiAssistantQueryAudit: {
        findMany: async () => [{ id: "expired-1" }],
        deleteMany: ({ where }: any) => {
          order.push(`audits:${where.id.in.join(",")}`);
          return Promise.resolve({ count: 1 });
        }
      },
      aiAssistantSafetyEvent: {
        deleteMany: ({ where }: any) => {
          order.push(`events:${where.queryAuditId.in.join(",")}`);
          return Promise.resolve({ count: 1 });
        }
      },
      $transaction: async (operations: Promise<any>[]) => Promise.all(operations)
    };
    await expect(purgeExpiredAiAssistantAudits(client)).resolves.toBe(1);
    expect(order).toEqual(["events:expired-1", "audits:expired-1"]);
  });
});

describe("external queue recovery and immutable approval state", () => {
  it("marks ambiguous stale SMS/email sends non-retryable for reconciliation", async () => {
    let recoveryData: any;
    const client: any = {
      smsEmailDelivery: {
        updateMany: async ({ data }: any) => {
          recoveryData = data;
          return { count: 1 };
        }
      },
      smsEmailIntegrationProfile: { findMany: async () => [] }
    };
    await expect(recoverStaleSmsEmailClaims(client)).resolves.toBe(1);
    expect(recoveryData).toMatchObject({
      status: "FAILED",
      retryable: false,
      nextRetryAt: null,
      failureCategory: "NEEDS_RECONCILIATION",
      failureCode: "STALE_SEND_OUTCOME_UNKNOWN"
    });
  });

  it("marks ambiguous stale WhatsApp sends non-retryable for reconciliation", async () => {
    const updates: any[] = [];
    const client: any = {
      whatsAppDelivery: {
        updateMany: async ({ data }: any) => {
          updates.push(data);
          return { count: updates.length === 1 ? 1 : 0 };
        },
        findMany: async () => []
      }
    };
    await expect(processWhatsAppQueue(client)).resolves.toMatchObject({ recoveredStale: 1 });
    expect(updates[0]).toMatchObject({
      status: "FAILED",
      retryable: false,
      nextAttemptAt: null,
      providerErrorCategory: "NEEDS_RECONCILIATION",
      providerErrorCode: "STALE_SEND_OUTCOME_UNKNOWN"
    });
  });

  it("renders only immutable approved SMS/email snapshots", () => {
    const template = {
      mappingCode: "QA19C_EMAIL",
      channel: "EMAIL",
      emailSenderAlias: "school@example.com",
      emailSubjectTemplate: "{{notificationTitle}}",
      emailTextTemplate: "{{notificationBody}}",
      parameterDefinitionJson: "[\"notificationTitle\",\"notificationBody\"]"
    };
    const campaign = {
      campaignNumber: "NC-1",
      title: "Approved title",
      body: "Approved body"
    };
    const expectedParameters = {
      notificationTitle: "Approved title",
      notificationBody: "Approved body"
    };
    const delivery = {
      safeContextJson: "{}",
      renderedSubject: "Approved title",
      renderedParametersSnapshotJson: JSON.stringify(expectedParameters),
      batch: {
        templateSnapshotJson: JSON.stringify(template),
        notificationCampaignSnapshotJson: JSON.stringify(campaign),
        templateMapping: { ...template, emailTextTemplate: "Changed after approval" },
        notificationCampaign: { ...campaign, body: "Changed after approval" }
      }
    };
    expect(renderApprovedSmsEmailDelivery(delivery)).toMatchObject({
      subject: "Approved title",
      body: "Approved body",
      parameters: expectedParameters
    });
  });

  it("revalidates current campaign and template eligibility at send time", async () => {
    const base: any = {
      contactHash: "a".repeat(64),
      subjectType: "GUARDIAN",
      guardianId: "guardian",
      consent: { status: "OPTED_IN", contactHash: "a".repeat(64), expiresAt: null },
      batch: {
        status: "QUEUED",
        integrationProfile: { status: "ACTIVE", mode: "MOCK", liveSendingEnabled: false },
        templateMapping: { status: "ACTIVE", providerStatus: "APPROVED" },
        notificationCampaign: { status: "PUBLISHED", publishedAt: new Date() },
        templateSnapshotJson: "{}",
        notificationCampaignSnapshotJson: "{}"
      }
    };
    await expect(revalidateSmsEmailDelivery({}, {
      ...base,
      batch: { ...base.batch, templateMapping: { status: "INACTIVE", providerStatus: "APPROVED" } }
    })).rejects.toThrow(/no longer active and approved/i);
    await expect(revalidateSmsEmailDelivery({}, {
      ...base,
      batch: { ...base.batch, notificationCampaign: { status: "WITHDRAWN", publishedAt: new Date() } }
    })).rejects.toThrow(/no longer published/i);
  });

  it("blocks overlapping process-local queue runs", async () => {
    let releaseFirst!: () => void;
    const blocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstCall = true;
    const client: any = {
      smsEmailDelivery: {
        updateMany: async () => {
          if (firstCall) {
            firstCall = false;
            await blocked;
          }
          return { count: 0 };
        },
        findMany: async () => []
      }
    };
    const first = processSmsEmailQueue(client);
    await Promise.resolve();
    await expect(processSmsEmailQueue(client)).rejects.toThrow("SMS_EMAIL_QUEUE_PROCESSOR_BUSY");
    releaseFirst();
    await expect(first).resolves.toMatchObject({ inspected: 0, processed: 0 });
  });

  it("also blocks overlapping process-local WhatsApp queue runs", async () => {
    let releaseFirst!: () => void;
    const blocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstCall = true;
    const client: any = {
      whatsAppDelivery: {
        updateMany: async () => {
          if (firstCall) {
            firstCall = false;
            await blocked;
          }
          return { count: 0 };
        },
        findMany: async () => []
      }
    };
    const first = processWhatsAppQueue(client);
    await Promise.resolve();
    await expect(processWhatsAppQueue(client)).rejects.toThrow("WHATSAPP_QUEUE_PROCESSOR_BUSY");
    releaseFirst();
    await expect(first).resolves.toMatchObject({ recoveredStale: 0, claimed: 0 });
  });
});

describe("direct AI document search control path", () => {
  it("uses the per-user limiter, audit writer, and guaranteed release", () => {
    const route = readFileSync("app/api/ai-assistant/documents/search/route.ts", "utf8");
    expect(route).toContain("beginAiRequest(auth.user.id)");
    expect(route).toContain("createAiAssistantAudit");
    expect(route).toContain("release?.()");
    const auditRoute = readFileSync("app/api/ai-assistant/audit/route.ts", "utf8");
    expect(auditRoute).toContain("unexpiredAiAuditWhere(now)");
  });
});
