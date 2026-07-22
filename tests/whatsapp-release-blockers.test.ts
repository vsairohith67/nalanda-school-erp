import { describe, expect, it } from "vitest";
import { loadWhatsAppReports, whatsappReportsCsv, whatsappReportsFilename } from "@/lib/whatsapp-reports";
import { assertWhatsAppLocalRateLimits } from "@/lib/whatsapp-worker";
import { MockWhatsAppProvider } from "@/lib/whatsapp-provider-mock";
import { approveWhatsAppBatch, overrideWhatsAppCostCap } from "@/lib/whatsapp-batches";
import { hashWhatsAppPhone } from "@/lib/whatsapp-phone";

function reportClient() {
  const now = new Date("2026-07-18T00:00:00.000Z");
  return {
    whatsAppIntegrationProfile: { findMany: async () => [{ id: "profile", profileCode: "QA19B", mode: "MOCK", status: "ACTIVE", costCapEnabled: true, maximumEstimatedBatchCostMinor: 10, costCapCurrency: "INR" }] },
    whatsAppConsent: { findMany: async () => [
      { id: "c1", subjectType: "GUARDIAN", guardianId: "g1", status: "OPTED_IN", expiresAt: null, createdAt: now },
      { id: "c2", subjectType: "STAFF", staffMemberId: "s1", status: "OPTED_OUT", expiresAt: null, createdAt: now }
    ] },
    guardian: { findMany: async () => [{ id: "g1", primaryMobile: "+919876543210" }, { id: "g2", primaryMobile: "" }] },
    staffMember: { findMany: async () => [{ id: "s1", mobile: "+919876543211" }, { id: "s2", mobile: "bad" }] },
    whatsAppConsentEvent: { findMany: async () => [{ eventType: "CONSENT_OPTED_OUT" }, { eventType: "CONSENT_INVALIDATED_PHONE_CHANGE" }] },
    whatsAppOutboundBatch: { findMany: async () => [{
      batchNumber: "=QA19B", status: "PARTIALLY_FAILED", estimatedCostMinor: 20, estimatedCostCurrency: "INR",
      estimateRateVersion: "RATE-1", emergencyOverride: false, totalCampaignRecipients: 4,
      totalEligibleContacts: 2, totalSkipped: 2, skipReasonCountsJson: JSON.stringify({ NO_PHONE: 1, NO_CONSENT: 1 }),
      createdAt: now, costCapOverrideSnapshotHash: "snapshot",
      integrationProfile: { profileCode: "QA19B", mode: "MOCK", status: "ACTIVE", costCapEnabled: true, maximumEstimatedBatchCostMinor: 10, costCapCurrency: "INR" },
      notificationCampaign: { category: "GENERAL" },
      templateMapping: { mappingCode: "QA19B_MAP", metaTemplateCategory: "UTILITY" }
    }] },
    whatsAppDelivery: {
      groupBy: async () => [
        { status: "READ", _count: { _all: 1 } }, { status: "FAILED", _count: { _all: 1 } },
        { status: "RETRY_PENDING", _count: { _all: 1 } }
      ],
      findMany: async () => [
        { status: "READ", attemptCount: 2, retryable: false, batch: { estimateRateVersion: "RATE-1", templateMapping: { metaTemplateCategory: "UTILITY" }, integrationProfile: { maximumRetryCount: 3 } } },
        { status: "FAILED", attemptCount: 3, retryable: false, batch: { estimateRateVersion: "RATE-1", templateMapping: { metaTemplateCategory: "UTILITY" }, integrationProfile: { maximumRetryCount: 3 } } }
      ]
    },
    whatsAppDeliveryAttempt: { findMany: async () => [
      { attemptNumber: 1, resultStatus: "RETRYABLE_FAILURE", retryable: true, errorCategory: "TRANSIENT" },
      { attemptNumber: 2, resultStatus: "ACCEPTED", retryable: false, errorCategory: null },
      { attemptNumber: 3, resultStatus: "PERMANENT_FAILURE", retryable: false, errorCategory: "PERMANENT_VALIDATION" }
    ] },
    whatsAppTemplateMapping: { groupBy: async () => [{ providerStatus: "APPROVED", status: "ACTIVE", _count: { _all: 1 } }] },
    whatsAppWebhookEvent: { findMany: async () => [
      { eventType: "MESSAGE_STATUS", mappedStatus: "READ", processingStatus: "PROCESSED", duplicateReceiptCount: 2 },
      { eventType: "MESSAGE_STATUS", mappedStatus: "UNKNOWN", processingStatus: "IGNORED", duplicateReceiptCount: 0 },
      { eventType: "OPT_OUT_SIGNAL", mappedStatus: "INBOUND_OPT_OUT", processingStatus: "PROCESSED", duplicateReceiptCount: 0 }
    ] },
    whatsAppOperationalEvent: { findMany: async () => [
      { eventType: "LOCAL_HOURLY_LIMIT_BLOCKED", occurrenceCount: 1 },
      { eventType: "LOCAL_DAILY_LIMIT_BLOCKED", occurrenceCount: 1 },
      { eventType: "PROVIDER_RATE_LIMIT_RECEIVED", occurrenceCount: 1 },
      { eventType: "COST_CAP_BLOCKED", occurrenceCount: 1 },
      { eventType: "COST_CAP_OVERRIDE_APPLIED", occurrenceCount: 1 },
      { eventType: "WEBHOOK_INVALID_SIGNATURE", occurrenceCount: 1 }
    ] },
    whatsAppRateReference: { findMany: async () => [{ rateVersion: "RATE-1", market: "India", templateCategory: "UTILITY", currency: "INR", ratePerDeliveredMessage: "0.115", sourceReviewDate: now, effectiveDate: now }] }
  };
}

describe("Prompt 19B aggregate reports and safe CSV", () => {
  it("calculates exact consent, skip, state, retry, webhook, rate and cap totals", async () => {
    const report = await loadWhatsAppReports(reportClient());
    expect(report.consentCoverage.GUARDIAN).toMatchObject({ eligibleSubjects: 2, optedIn: 1, missingPhone: 1, coveragePercentage: 50 });
    expect(report.consentCoverage.STAFF).toMatchObject({ optedOut: 1, invalidPhone: 1 });
    expect(report.skipReasonCounts).toMatchObject({ NO_PHONE: 1, NO_CONSENT: 1, RATE_LIMIT: 0 });
    expect(report.deliveryCounts).toMatchObject({ QUEUED: 1, READ: 1, FAILED: 1, CANCELLED: 0 });
    expect(report.attemptMetrics).toMatchObject({ retryableFailures: 1, permanentFailures: 1, retryAttempts: 2, deliveriesSucceedingAfterRetry: 1, deliveriesExhaustingRetryLimit: 1 });
    expect(report.controlMetrics).toMatchObject({ localHourlyLimitBlocks: 1, localDailyLimitBlocks: 1, providerRateLimitFailures: 1, costCapBlocks: 1, authorisedCostCapOverrides: 1 });
    expect(report.webhookCounts).toMatchObject({ received: 6, processed: 2, ignoredDuplicates: 2, invalidSignatures: 1, unknownProviderMessageIds: 1, optOutWebhookEvents: 1 });
    expect(report.batchesAboveConfiguredCap).toBe(1);
    expect(report.estimatedDeliveredMessageCostMinor).toBe(12);
  });
  it("exports only allowlisted aggregate fields with formula protection and India-local filename", async () => {
    const csv = whatsappReportsCsv(await loadWhatsAppReports(reportClient()));
    expect(csv).toContain("\"'=QA19B\"");
    expect(csv).toContain("Estimate only. Meta pricing");
    expect(csv).not.toContain("+919876543210");
    expect(csv).not.toMatch(/actorUserId|access.?token|app.?secret|verify.?token|primaryMobile|studentName/i);
    expect(whatsappReportsFilename(new Date("2026-07-18T00:00:00Z"))).toMatch(/^whatsapp-one-way-aggregate-\d{4}-\d{2}-\d{2}-IST\.csv$/);
  });
});

describe("Prompt 19B local/provider rate-limit separation", () => {
  it("persists one deduplicated hourly event with the India-local next-eligible time", async () => {
    const events: any[] = [];
    const db: any = {
      whatsAppDeliveryAttempt: { count: async () => 1 },
      whatsAppOperationalEvent: { upsert: async ({ where, create }: any) => {
        const existing = events.find((row) => row.eventKey === where.eventKey);
        if (existing) { existing.occurrenceCount++; return existing; }
        const row = { occurrenceCount: 1, ...create }; events.push(row); return row;
      } }
    };
    const profile = { id: "profile", hourlyMessageLimit: 1, dailyMessageLimit: 10 };
    const now = new Date("2026-07-18T00:15:00.000Z");
    await expect(assertWhatsAppLocalRateLimits(db, profile, "batch", now)).rejects.toThrow(/Hourly/);
    await expect(assertWhatsAppLocalRateLimits(db, profile, "batch", now)).rejects.toThrow(/Hourly/);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "LOCAL_HOURLY_LIMIT_BLOCKED", limitValue: 1, currentUsage: 1, occurrenceCount: 2 });
    expect(events[0].nextEligibleAt.toISOString()).toBe("2026-07-18T00:30:00.000Z");
  });
  it("keeps daily and provider rate limits distinct", async () => {
    const events: any[] = [];
    const db: any = {
      whatsAppDeliveryAttempt: { count: async ({ where }: any) => where.startedAt.gte.toISOString().endsWith("18:30:00.000Z") ? 2 : 0 },
      whatsAppOperationalEvent: { upsert: async ({ create }: any) => { events.push(create); return create; } }
    };
    await expect(assertWhatsAppLocalRateLimits(db, { id: "profile", hourlyMessageLimit: null, dailyMessageLimit: 2 }, "batch", new Date("2026-07-18T00:15:00Z"))).rejects.toThrow(/Daily/);
    expect(events[0].eventType).toBe("LOCAL_DAILY_LIMIT_BLOCKED");
    const provider = await new MockWhatsAppProvider().sendApprovedTemplate({
      to: "+919876543210", templateName: "qa", languageCode: "en_US", parameters: [],
      requestFingerprint: "qa19b-provider-rate", opaqueCallbackData: "delivery", mockOutcome: "PROVIDER_RATE_LIMIT"
    });
    expect(provider).toMatchObject({ accepted: false, retryable: true, errorCategory: "RATE_LIMIT", errorCode: "MOCK_429" });
  });
});

describe("Prompt 19B configurable estimated-cost cap", () => {
  function costCapClient() {
    const guardian = { id: "guardian", primaryMobile: "+919876543210", students: [] as any[] };
    const consent: any = { id: "consent", subjectType: "GUARDIAN", guardianId: "guardian", status: "OPTED_IN", phoneHash: hashWhatsAppPhone(guardian.primaryMobile), expiresAt: null, optedInAt: new Date() };
    const profile: any = { id: "profile", profileCode: "QA19B", status: "ACTIVE", mode: "MOCK", defaultCountryCode: "+91", costCapEnabled: true, maximumEstimatedBatchCostMinor: 1, costCapCurrency: "INR" };
    const mapping: any = { id: "mapping", integrationProfileId: "profile", status: "ACTIVE", providerStatus: "APPROVED", notificationCategory: "GENERAL", metaTemplateCategory: "UTILITY", metaTemplateName: "qa", metaTemplateLanguage: "en_US" };
    const campaign: any = {
      id: "campaign", campaignNumber: "QA19B-C", status: "PUBLISHED", publishedAt: new Date(), category: "GENERAL",
      recipients: [{ recipientContextJson: "{}", user: { id: "parent", role: "PARENT", guardian, staffMember: null } }]
    };
    const batch: any = {
      id: "batch", status: "PREVIEWED", integrationProfileId: "profile", integrationProfile: profile,
      notificationCampaignId: "campaign", templateMappingId: "mapping", notificationCampaignSnapshotJson: "{\"campaign\":\"QA19B\"}",
      templateMappingSnapshotJson: "{\"mapping\":\"QA19B\"}", createdByUserId: "creator", costCapOverrideSnapshotHash: null
    };
    const events: any[] = [];
    const db: any = {
      batch, guardian, consent, events,
      notificationCampaign: { findUnique: async () => campaign },
      whatsAppIntegrationProfile: { findUnique: async () => profile },
      whatsAppTemplateMapping: { findUnique: async () => mapping },
      whatsAppConsent: { findFirst: async ({ where }: any) => where.status === "OPTED_IN" && consent.phoneHash === where.phoneHash ? consent : consent },
      whatsAppRateReference: {
        upsert: async () => ({}),
        findFirst: async () => ({ ratePerDeliveredMessage: "0.115", currency: "INR", rateVersion: "RATE-1" })
      },
      whatsAppOutboundBatch: {
        findUnique: async () => batch,
        update: async ({ data }: any) => Object.assign(batch, data)
      },
      whatsAppOperationalEvent: { upsert: async ({ create }: any) => { events.push(create); return create; } },
      $transaction: async (callback: any) => callback(db)
    };
    return db;
  }
  const director = { id: "director", name: "Director", username: "director", email: null, role: "DIRECTOR" as const, guardianId: null };
  it("requires a reason and Director/Super Admin authority, then records one exact idempotent override", async () => {
    const db = costCapClient();
    await expect(overrideWhatsAppCostCap(db, "batch", { ...director, role: "ADMIN" }, "No")).rejects.toThrow(/Director or Super Admin/);
    await expect(overrideWhatsAppCostCap(db, "batch", director, "")).rejects.toThrow(/reason/);
    await overrideWhatsAppCostCap(db, "batch", director, "QA19B approved test ceiling");
    const hash = db.batch.costCapOverrideSnapshotHash;
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(db.batch).toMatchObject({ costCapOverrideEstimateMinor: 12, costCapOverrideLimitMinor: 1, costCapOverrideCurrency: "INR", costCapOverrideRateVersion: "RATE-1" });
    expect(db.events).toHaveLength(1);
    expect(db.events[0]).toMatchObject({ eventType: "COST_CAP_OVERRIDE_APPLIED", estimatedCostMinor: 12, costCapMinor: 1, snapshotHash: hash });
    await overrideWhatsAppCostCap(db, "batch", director, "Repeated");
    expect(db.events).toHaveLength(1);
  });
  it("invalidates an old override when the current estimate snapshot changes", async () => {
    const db = costCapClient();
    await overrideWhatsAppCostCap(db, "batch", director, "Exact current estimate");
    db.batch.status = "READY_FOR_APPROVAL";
    db.guardian.primaryMobile = "+919876543211";
    db.consent.phoneHash = hashWhatsAppPhone(db.guardian.primaryMobile);
    await expect(approveWhatsAppBatch(db, "batch", director, "QA")).rejects.toThrow(/exceeds the configured cap/);
    expect(db.events.some((row: any) => row.eventType === "COST_CAP_BLOCKED")).toBe(true);
  });
});
