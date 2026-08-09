import { describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { validateWhatsAppBackupRows } from "@/lib/whatsapp-backup";
import { parseAndValidateBackup } from "@/lib/restore";

function rows() {
  const now = "2026-07-17T00:00:00.000Z";
  return {
    whatsAppIntegrationProfiles: [{ id: "profile", profileCode: "QA19B_MOCK", displayName: "QA19B Mock", provider: "META_CLOUD", mode: "MOCK", status: "ACTIVE", graphApiVersion: "v25.0", defaultCountryCode: "+91", timezone: "Asia/Kolkata", maximumRetryCount: 3, workerChunkSize: 25, liveSendingEnabled: false, createdAt: now, updatedAt: now }],
    whatsAppConsents: [{ id: "consent", subjectType: "GUARDIAN", guardianId: "guardian", staffMemberId: null, channel: "WHATSAPP", phoneHash: "a".repeat(64), phoneLast4: "3210", countryCode: "+91", status: "OPTED_IN", consentSource: "PAPER_FORM", consentWordingVersion: "v1", consentPurposeScope: "SCHOOL_OPERATIONAL_UPDATES", optedInAt: now, createdAt: now, updatedAt: now }],
    whatsAppConsentEvents: [{ id: "consent-event", consentId: "consent", eventType: "CONSENT_OPTED_IN", eventDate: now, newStatus: "OPTED_IN", createdAt: now }],
    whatsAppTemplateMappings: [{ id: "mapping", mappingCode: "QA19B_GENERAL", integrationProfileId: "profile", notificationCategory: "GENERAL", internalPurpose: "QA", metaTemplateName: "qa19b_general", metaTemplateLanguage: "en_US", metaTemplateCategory: "UTILITY", providerStatus: "APPROVED", parameterDefinitionJson: "[]", status: "ACTIVE", createdAt: now, updatedAt: now }],
    whatsAppOutboundBatches: [{ id: "batch", batchNumber: "QA19B-BATCH", integrationProfileId: "profile", notificationCampaignId: "campaign", notificationCampaignSnapshotJson: "{}", templateMappingId: "mapping", templateMappingSnapshotJson: "{}", status: "COMPLETED", emergencyOverride: false, totalCampaignRecipients: 1, totalEligibleContacts: 1, totalSkipped: 0, totalQueued: 0, totalAccepted: 0, totalSent: 0, totalDelivered: 1, totalRead: 0, totalFailed: 0, totalOptedOut: 0, totalUnknown: 0, createdAt: now, updatedAt: now }],
    whatsAppDeliveries: [{ id: "delivery", batchId: "batch", notificationRecipientId: "recipient", subjectType: "GUARDIAN", subjectReferenceId: "guardian", safeDisplayLabel: "Parent/Guardian", safeContextJson: "{}", phoneHash: "a".repeat(64), phoneLast4: "3210", countryCode: "+91", consentId: "consent", templateNameSnapshot: "qa19b_general", templateLanguageSnapshot: "en_US", templateCategorySnapshot: "UTILITY", renderedParametersJson: "[]", requestFingerprint: "b".repeat(64), providerMessageId: "wamid.mock.safe", status: "DELIVERED", retryable: false, attemptCount: 1, deliveredAt: now, createdAt: now, updatedAt: now }],
    whatsAppDeliveryAttempts: [{ id: "attempt", deliveryId: "delivery", attemptNumber: 1, requestFingerprint: "b".repeat(64), providerMessageId: "wamid.mock.safe", resultStatus: "ACCEPTED", retryable: false, startedAt: now, completedAt: now, createdAt: now }],
    whatsAppWebhookEvents: [{ id: "webhook", integrationProfileId: "profile", eventKey: "status:wamid.mock.safe:delivered:1", payloadHash: "c".repeat(64), providerMessageId: "wamid.mock.safe", deliveryId: "delivery", eventType: "MESSAGE_STATUS", mappedStatus: "DELIVERED", signatureValid: true, processingStatus: "PROCESSED", safeSummaryJson: "{\"status\":\"delivered\"}", receivedAt: now, processedAt: now, createdAt: now }],
    whatsAppOperationalEvents: [{ id: "operation", integrationProfileId: "profile", batchId: "batch", eventKey: "local-hourly-profile-batch", eventType: "LOCAL_HOURLY_LIMIT_BLOCKED", limitValue: 1, currentUsage: 1, periodStart: now, periodEnd: "2026-07-17T01:00:00.000Z", nextEligibleAt: "2026-07-17T01:00:00.000Z", safeReason: "Local hourly limit reached", occurrenceCount: 1, lastOccurredAt: now, createdAt: now }],
    whatsAppRateReferences: [{ id: "rate", integrationProfileId: "profile", rateVersion: "META-INR-2026-07-01", market: "India", countryCallingCode: "+91", templateCategory: "UTILITY", currency: "INR", ratePerDeliveredMessage: "0.115", effectiveDate: now, sourceReviewDate: now, sourceUrl: "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing", status: "ACTIVE", createdAt: now, updatedAt: now }]
  };
}
const refs = { guardianIds: new Set(["guardian"]), staffMemberIds: new Set(["staff"]), campaignIds: new Set(["campaign"]), notificationRecipientIds: new Set(["recipient"]) };

describe("Prompt 19B recovery backup version 33", () => {
  it("includes all ten arrays and strips actor IDs", () => {
    const backup = createBackupDocument({ generatedAt: new Date(), generatedBy: "QA19B", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...rows(), whatsAppConsents: [{ ...rows().whatsAppConsents[0], collectedByUserId: "actor" }] });
    expect(backup.metadata.backupVersion).toBe(38);
    for (const key of Object.keys(rows())) expect((backup as any)[key]).toHaveLength(1);
    expect(JSON.stringify(backup)).not.toContain("collectedByUserId");
    expect(JSON.stringify(backup)).not.toContain("accessToken");
  });
  it("validates ownership, immutable links, provider IDs, and webhook attachment", () => {
    expect(() => validateWhatsAppBackupRows(rows(), refs)).not.toThrow();
    const broken: any = rows(); broken.whatsAppConsents[0].guardianId = "unrelated";
    expect(() => validateWhatsAppBackupRows(broken, refs)).toThrow(/Guardian link/);
    const wrongWebhook: any = rows(); wrongWebhook.whatsAppWebhookEvents[0].providerMessageId = "other";
    expect(() => validateWhatsAppBackupRows(wrongWebhook, refs)).toThrow(/belongs to another delivery/);
  });
  it("rejects credentials and full E.164 phone values in WhatsApp arrays", () => {
    const secret: any = rows(); secret.whatsAppIntegrationProfiles[0].lastHealthCheckMessage = "access_token=secret";
    expect(() => validateWhatsAppBackupRows(secret, refs)).toThrow(/credential/);
    const phone: any = rows(); phone.whatsAppDeliveries[0].safeContextJson = JSON.stringify({ value: "+919876543210" });
    expect(() => validateWhatsAppBackupRows(phone, refs)).toThrow(/E.164/);
  });
  it("keeps version 30 backups compatible when WhatsApp arrays are absent", () => {
    const old: any = createBackupDocument({ generatedAt: new Date(), generatedBy: "QA", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [] });
    old.metadata.backupVersion = 30;
    for (const key of Object.keys(rows())) { delete old[key]; delete old.metadata.counts[key]; }
    const parsed = parseAndValidateBackup(old);
    expect(parsed.whatsAppIntegrationProfiles).toEqual([]);
    expect(parsed.whatsAppWebhookEvents).toEqual([]);
  });
  it("keeps version 31 backups compatible when operational events are absent", () => {
    const old: any = createBackupDocument({ generatedAt: new Date(), generatedBy: "QA", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [] });
    old.metadata.backupVersion = 31;
    delete old.whatsAppOperationalEvents;
    delete old.metadata.counts.whatsAppOperationalEvents;
    const parsed = parseAndValidateBackup(old);
    expect(parsed.whatsAppOperationalEvents).toEqual([]);
    expect(parsed.whatsAppIntegrationProfiles).toEqual([]);
  });
});
