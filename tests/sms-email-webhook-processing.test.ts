import { describe, expect, it } from "vitest";
import { signMockSmsEmailWebhook } from "@/lib/sms-email-provider";
import {
  processSmsEmailWebhook,
  safeSmsEmailWebhookFixture,
  SmsEmailWebhookSignatureError
} from "@/lib/sms-email-webhooks";
import { refreshSmsEmailBatch } from "@/lib/sms-email-worker";

function memoryClient() {
  const deliveries = new Map<string, any>([
    ["email.mock.message-1", {
      id: "delivery-1", batchId: "batch-1", providerMessageId: "email.mock.message-1",
      channel: "EMAIL", subjectType: "GUARDIAN", guardianId: "guardian-1",
      staffMemberId: null, contactHash: "a".repeat(64), contactMasked: "q***@example.invalid",
      status: "ACCEPTED", retryable: false
    }]
  ]);
  const webhookRows = new Map<string, any>();
  const suppressions: any[] = [];
  const findDelivery = (where: any) => [...deliveries.values()].find((row) =>
    where.id ? row.id === where.id : row.providerMessageId === where.providerMessageId
  ) ?? null;
  const tx: any = {
    smsEmailDelivery: {
      findUnique: async ({ where }: any) => findDelivery(where),
      update: async ({ where, data }: any) => {
        const row = findDelivery(where);
        if (!row) throw new Error("Delivery not found");
        Object.assign(row, data);
        return row;
      },
      updateMany: async () => ({ count: 0 })
    },
    smsEmailSuppression: {
      findFirst: async ({ where }: any) => suppressions.find((row) =>
        row.channel === where.channel && row.contactHash === where.contactHash && row.status === "ACTIVE"
      ) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `suppression-${suppressions.length + 1}`, status: "ACTIVE", ...data };
        suppressions.push(row);
        return row;
      }
    },
    smsEmailWebhookEvent: {
      create: async ({ data }: any) => {
        const row = { id: `webhook-${webhookRows.size + 1}`, duplicateCount: 0, ...data };
        webhookRows.set(row.providerEventKey, row);
        return row;
      }
    }
  };
  const client: any = {
    smsEmailIntegrationProfile: {
      findUnique: async () => ({ id: "profile-1", profileCode: "QA19C_MOCK_EMAIL", channel: "EMAIL", mode: "MOCK" })
    },
    smsEmailWebhookEvent: {
      findUnique: async ({ where }: any) => webhookRows.get(where.providerEventKey) ?? null,
      update: async ({ where, data }: any) => {
        const row = [...webhookRows.values()].find((item) => item.id === where.id);
        row.duplicateCount += data.duplicateCount.increment;
        return row;
      }
    },
    smsEmailDelivery: {
      groupBy: async () => {
        const counts = new Map<string, number>();
        for (const row of deliveries.values()) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        return [...counts].map(([status, count]) => ({ status, _count: { _all: count } }));
      }
    },
    smsEmailOutboundBatch: { update: async ({ data }: any) => data },
    $transaction: async (callback: any) => callback(tx)
  };
  return { client, deliveries, webhookRows, suppressions };
}

async function post(client: any, payload: any) {
  const raw = JSON.stringify(payload);
  return processSmsEmailWebhook(client, "QA19C_MOCK_EMAIL", raw, signMockSmsEmailWebhook(raw));
}

describe("Prompt 19C signed delivery webhook processing", () => {
  it("does not report a batch with bounce, complaint or suppression outcomes as completed", async () => {
    const updates: any[] = [];
    const client: any = {
      smsEmailDelivery: {
        groupBy: async () => [
          { status: "DELIVERED", _count: { _all: 2 } },
          { status: "BOUNCED", _count: { _all: 1 } }
        ]
      },
      smsEmailOutboundBatch: {
        update: async ({ data }: any) => { updates.push(data); return data; }
      }
    };
    await refreshSmsEmailBatch(client, "batch-1");
    expect(updates[0]).toMatchObject({
      status: "PARTIALLY_FAILED", totalDelivered: 2, totalBounced: 1, totalQueued: 0
    });
  });

  it("rejects invalid signatures before storing an event", async () => {
    const { client, webhookRows } = memoryClient();
    await expect(processSmsEmailWebhook(
      client, "QA19C_MOCK_EMAIL", JSON.stringify({ events: [] }), "sha256=bad"
    )).rejects.toBeInstanceOf(SmsEmailWebhookSignatureError);
    expect(webhookRows.size).toBe(0);
  });

  it("handles replay, unknown IDs and monotonic provider-evidence transitions without inbound storage", async () => {
    const { client, deliveries, webhookRows } = memoryClient();
    const delivered = safeSmsEmailWebhookFixture("EMAIL", "email.mock.message-1", "DELIVERED", "event-delivered");
    expect(await post(client, delivered)).toMatchObject({
      processed: 1, duplicate: 0, unknown: 0, inboundMessagesStored: 0, automaticReplies: 0
    });
    expect(deliveries.get("email.mock.message-1").status).toBe("DELIVERED");

    expect(await post(client, delivered)).toMatchObject({ processed: 0, duplicate: 1, unknown: 0 });
    expect(webhookRows.get("event-delivered").duplicateCount).toBe(1);

    await post(client, safeSmsEmailWebhookFixture("EMAIL", "email.mock.message-1", "SENT", "event-late-sent"));
    expect(deliveries.get("email.mock.message-1").status).toBe("DELIVERED");

    const unknownPayload = {
      events: [{
        eventKey: "event-unknown", providerMessageId: "email.mock.unknown",
        status: "DELIVERED", body: "must never be retained"
      }]
    };
    expect(await post(client, unknownPayload)).toMatchObject({ processed: 1, duplicate: 0, unknown: 1 });
    expect(webhookRows.get("event-unknown").processingStatus).toBe("IGNORED");
    expect(webhookRows.get("event-unknown").safePayloadJson).not.toContain("must never be retained");
  });

  it("creates a privacy-safe suppression on hard bounce and blocks a later lower-ranked delivery event", async () => {
    const { client, deliveries, suppressions } = memoryClient();
    await post(client, safeSmsEmailWebhookFixture("EMAIL", "email.mock.message-1", "BOUNCED", "event-bounce"));
    expect(deliveries.get("email.mock.message-1").status).toBe("BOUNCED");
    expect(suppressions).toHaveLength(1);
    expect(suppressions[0]).toMatchObject({
      reason: "HARD_BOUNCE", contactMasked: "q***@example.invalid", status: "ACTIVE"
    });
    expect(JSON.stringify(suppressions[0])).not.toContain("qa19c.parent@example.invalid");

    await post(client, safeSmsEmailWebhookFixture("EMAIL", "email.mock.message-1", "DELIVERED", "event-after-bounce"));
    expect(deliveries.get("email.mock.message-1").status).toBe("BOUNCED");
  });
});
