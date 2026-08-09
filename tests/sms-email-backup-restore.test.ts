import { describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import { validateSmsEmailBackupRows } from "@/lib/sms-email-backup";
import { smsEmailReportsCsv } from "@/lib/sms-email-reports";

const now = "2026-07-18T00:00:00.000Z";
function rows() {
  return {
    smsEmailIntegrationProfiles: [{ id: "profile", profileCode: "QA19C_MOCK", channel: "SMS", providerKind: "MOCK_SMS", displayName: "Mock SMS", mode: "MOCK", status: "ACTIVE", defaultCountryCode: "+91", timezone: "Asia/Kolkata", workerChunkSize: 25, maximumRetryCount: 3, liveSendingEnabled: false, costCapEnabled: false, costCapCurrency: "INR", spfStatus: "UNKNOWN", dkimStatus: "UNKNOWN", dmarcStatus: "UNKNOWN", senderAliasStatus: "UNKNOWN", createdAt: now, updatedAt: now }],
    smsEmailConsents: [{ id: "consent", channel: "SMS", subjectType: "GUARDIAN", guardianId: "guardian", staffMemberId: null, contactHash: "a".repeat(64), contactMasked: "+91 ******3210", status: "OPTED_IN", consentSource: "PAPER_FORM", consentWordingVersion: "v1", consentPurposeScope: "SCHOOL_OPERATIONAL_UPDATES", optedInAt: now, createdAt: now, updatedAt: now }],
    smsEmailConsentEvents: [{ id: "consent-event", consentId: "consent", eventType: "OPTED_IN", eventDate: now, newStatus: "OPTED_IN", createdAt: now }],
    smsEmailTemplateMappings: [{ id: "mapping", mappingCode: "QA19C_GENERAL", integrationProfileId: "profile", channel: "SMS", notificationCategory: "GENERAL", internalPurpose: "QA", status: "ACTIVE", providerStatus: "APPROVED", smsPrincipalEntityReference: "PE", smsHeader: "NALNDA", smsDltTemplateId: "DLT-1", smsTemplateCategory: "SERVICE", smsTemplateText: "{{notificationTitle}}", parameterDefinitionJson: "[\"notificationTitle\"]", createdAt: now, updatedAt: now }],
    smsEmailOutboundBatches: [{ id: "batch", batchNumber: "QA19C-BATCH", channel: "SMS", integrationProfileId: "profile", notificationCampaignId: "campaign", notificationCampaignSnapshotJson: "{}", templateMappingId: "mapping", templateSnapshotJson: "{}", profileSnapshotJson: "{}", readinessSnapshotJson: "{}", status: "COMPLETED", emergencyOverride: false, totalCampaignRecipients: 1, totalEligibleContacts: 1, totalSkipped: 0, totalQueued: 0, totalAccepted: 0, totalSent: 1, totalDelivered: 1, totalBounced: 0, totalComplained: 0, totalSuppressed: 0, totalFailed: 0, skipReasonCountsJson: "{}", createdAt: now, updatedAt: now }],
    smsEmailDeliveries: [{ id: "delivery", batchId: "batch", notificationRecipientId: "recipient", channel: "SMS", subjectType: "GUARDIAN", guardianId: "guardian", staffMemberId: null, contactHash: "a".repeat(64), contactMasked: "+91 ******3210", consentId: "consent", renderedParametersSnapshotJson: "{}", requestFingerprint: "b".repeat(64), providerMessageId: "sms.mock.safe", status: "DELIVERED", retryable: false, retryCount: 0, deliveredAt: now, createdAt: now, updatedAt: now }],
    smsEmailDeliveryAttempts: [{ id: "attempt", deliveryId: "delivery", attemptNumber: 1, providerMode: "MOCK", attemptedAt: now, requestFingerprint: "b".repeat(64), providerMessageId: "sms.mock.safe", result: "ACCEPTED", createdAt: now }],
    smsEmailWebhookEvents: [{ id: "webhook", integrationProfileId: "profile", deliveryId: "delivery", channel: "SMS", providerEventKey: "qa19c:event", providerMessageId: "sms.mock.safe", eventType: "DELIVERY_STATUS", mappedStatus: "DELIVERED", signatureVerified: true, receivedAt: now, processedAt: now, processingStatus: "PROCESSED", safePayloadJson: "{\"status\":\"DELIVERED\"}", duplicateCount: 0, createdAt: now }],
    smsEmailOperationalEvents: [{ id: "operation", integrationProfileId: "profile", batchId: "batch", eventKey: "qa19c:operation", eventType: "QUIET_HOURS_BLOCKED", safeReason: "Quiet hours", createdAt: now }],
    smsEmailSuppressions: [{ id: "suppression", channel: "SMS", subjectType: "GUARDIAN", guardianId: "guardian", staffMemberId: null, contactHash: "c".repeat(64), contactMasked: "+91 ******3210", reason: "HARD_BOUNCE", status: "ACTIVE", createdAt: now }],
    smsEmailCostRates: [{ id: "rate", integrationProfileId: "profile", channel: "SMS", providerKind: "MOCK_SMS", market: "India", messageCategory: "SERVICE", encodingType: "GSM_COMPATIBLE", currency: "INR", rateMinor: 10, unit: "SEGMENT", rateVersion: "QA19C-R1", effectiveFrom: now, sourceReviewDate: now, status: "ACTIVE", createdAt: now, updatedAt: now }]
  };
}
const refs = { guardianIds: new Set(["guardian"]), staffMemberIds: new Set(["staff"]), campaignIds: new Set(["campaign"]), notificationRecipientIds: new Set(["recipient"]) };

describe("Prompt 19C backup version 33 and aggregate reporting", () => {
  it("includes all eleven arrays and strips actor IDs without exporting credentials or full contacts", () => {
    const backup = createBackupDocument({
      generatedAt: new Date(now), generatedBy: "QA19C", students: [], feeStructures: [], payments: [],
      paymentAudits: [], users: [{ passwordHash: "must-not-export" }],
      ...rows(), smsEmailConsents: [{ ...rows().smsEmailConsents[0], collectedByUserId: "actor" }]
    });
    expect(backup.metadata.backupVersion).toBe(38);
    for (const key of Object.keys(rows())) expect((backup as any)[key]).toHaveLength(1);
    const json = JSON.stringify(backup);
    expect(json).not.toContain("must-not-export");
    expect(json).not.toContain("collectedByUserId");
    expect(json).not.toContain("9876543210");
  });

  it("validates exact ownership, immutable links, unique provider history and no credential fields", () => {
    expect(() => validateSmsEmailBackupRows(rows(), refs)).not.toThrow();
    const wrongOwner: any = rows(); wrongOwner.smsEmailConsents[0].guardianId = "unrelated";
    expect(() => validateSmsEmailBackupRows(wrongOwner, refs)).toThrow(/ownership link/);
    const duplicateProvider: any = rows(); duplicateProvider.smsEmailDeliveries.push({ ...duplicateProvider.smsEmailDeliveries[0], id: "delivery-2", requestFingerprint: "d".repeat(64) });
    expect(() => validateSmsEmailBackupRows(duplicateProvider, refs)).toThrow(/providerMessageId is duplicated/);
    const credential: any = rows(); credential.smsEmailIntegrationProfiles[0].oauthToken = "secret";
    expect(() => validateSmsEmailBackupRows(credential, refs)).toThrow(/unsupported field|credential field/);
  });

  it("keeps version 32 backups compatible when Prompt 19C arrays are absent", () => {
    const old: any = createBackupDocument({ generatedAt: new Date(now), generatedBy: "QA", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [] });
    old.metadata.backupVersion = 32;
    for (const key of Object.keys(rows())) { delete old[key]; delete old.metadata.counts[key]; }
    const parsed = parseAndValidateBackup(old);
    expect(parsed.smsEmailIntegrationProfiles).toEqual([]);
    expect(parsed.smsEmailWebhookEvents).toEqual([]);
    expect(parsed.smsEmailSuppressions).toEqual([]);
  });

  it("exports aggregate CSV only and neutralises spreadsheet formulas", () => {
    const report: any = {
      profiles: [{ profileCode: "=unsafe", channel: "EMAIL", mode: "MOCK", status: "ACTIVE", spfStatus: "UNKNOWN", dkimStatus: "UNKNOWN", dmarcStatus: "UNKNOWN", senderAliasStatus: "UNKNOWN" }],
      consents: [], suppressions: [], batches: [], deliveries: [], attempts: [], webhooks: [], events: [], mappings: [],
      skipReasonCounts: { NO_CONSENT: 2 },
      totals: { campaignRecipients: 3, eligible: 1, skipped: 2, smsSegments: 0, estimatedCostMinor: 0 }
    };
    const csv = smsEmailReportsCsv(report);
    expect(csv).toContain("'=unsafe");
    expect(csv).toContain("Aggregate/estimate only");
    expect(csv).not.toContain("parent@example.com");
    expect(csv).not.toContain("+919876543210");
  });
});
