import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { validateNotificationBackupRows } from "../lib/notification-backup";
import { parseAndValidateBackup } from "../lib/restore";

function notificationRows() {
  return {
    notificationTemplates: [{ id: "template", templateCode: "QA19A-TEMPLATE", name: "QA", category: "GENERAL", defaultPriority: "NORMAL", titleTemplate: "QA title", bodyTemplate: "QA body", acknowledgmentRequired: false, status: "ACTIVE", versionNumber: 1 }],
    notificationCampaigns: [{ id: "campaign", campaignNumber: "QA19A-CAMPAIGN", templateId: "template", category: "GENERAL", priority: "NORMAL", title: "QA title", body: "QA body", audienceType: "CLASS_SECTION", audienceDefinitionJson: JSON.stringify({ academicYear: "2026-27", className: "VI", section: "A" }), audienceSnapshotJson: JSON.stringify({ summary: { resolvedUsers: 1 } }), templateSnapshotJson: JSON.stringify({ templateCode: "QA19A-TEMPLATE" }), channel: "IN_APP", status: "PUBLISHED", acknowledgmentRequired: true, totalResolvedUsers: 1, totalRecipientRows: 1, totalSkipped: 1, totalRead: 1, totalAcknowledged: 1, totalDismissed: 0, publishedAt: "2026-07-17T10:00:00.000Z" }],
    notificationRecipients: [{ id: "recipient", campaignId: "campaign", userId: "user", recipientRoleSnapshot: "PARENT", contextType: "GUARDIAN_STUDENT", recipientContextJson: JSON.stringify({ targetedChildren: [{ admissionNo: "QA19A-1", displayName: "QA Child", classSection: "VI-A" }] }), deliveryStatus: "ACKNOWLEDGED", availableAt: "2026-07-17T10:00:00.000Z", firstViewedAt: "2026-07-17T10:01:00.000Z", readAt: "2026-07-17T10:01:00.000Z", acknowledgedAt: "2026-07-17T10:02:00.000Z" }],
    notificationSkippedRecipients: [{ id: "skipped", campaignId: "campaign", targetType: "STUDENT", targetReferenceKey: "QA19A-2", reasonCode: "NO_ACTIVE_USER", safeContextJson: JSON.stringify({ classSection: "VI-A" }) }],
    notificationEvents: [{ id: "event", templateId: "template", campaignId: "campaign", recipientId: "recipient", eventType: "NOTIFICATION_ACKNOWLEDGED", eventDate: "2026-07-17T10:02:00.000Z" }]
  };
}
function backup() {
  return createBackupDocument({
    generatedAt: new Date("2026-07-17T10:03:00.000Z"), generatedBy: "QA19A",
    students: [], feeStructures: [], payments: [], paymentAudits: [],
    users: [{ id: "user", name: "Parent", username: "qa19a-parent", role: "PARENT", isActive: true, passwordHash: "never-export" }],
    ...notificationRows()
  });
}

describe("Prompt 19A backup version 30", () => {
  it("includes all five arrays and excludes passwords, actors, phone numbers, and emails", () => {
    const value = backup();
    expect(value.metadata.backupVersion).toBe(44);
    for (const key of Object.keys(notificationRows())) expect((value as any)[key]).toHaveLength(1);
    const text = JSON.stringify(value);
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("recordedByUserId");
    expect(text).not.toContain("phone");
    expect(text).not.toContain("emailAddress");
  });

  it("validates immutable campaign/template/recipient/user/event links and deduplication", () => {
    expect(() => validateNotificationBackupRows(notificationRows(), { userIds: new Set(["user"]) })).not.toThrow();
    const duplicate: any = notificationRows();
    duplicate.notificationRecipients.push({ ...duplicate.notificationRecipients[0], id: "recipient-2" });
    expect(() => validateNotificationBackupRows(duplicate, { userIds: new Set(["user"]) })).toThrow(/campaign\/user/);
    const broken: any = notificationRows();
    broken.notificationCampaigns[0].templateId = "missing";
    expect(() => validateNotificationBackupRows(broken, { userIds: new Set(["user"]) })).toThrow(/templateId/);
  });

  it("rejects contact or credential fields hidden inside recipient snapshots", () => {
    const unsafe: any = notificationRows();
    unsafe.notificationRecipients[0].recipientContextJson = JSON.stringify({ email: "parent@example.test" });
    expect(() => validateNotificationBackupRows(unsafe, { userIds: new Set(["user"]) })).toThrow(/forbidden contact/);
  });

  it("parses version-30 data and keeps version-29 backups compatible without notification arrays", () => {
    const current = parseAndValidateBackup(backup());
    expect(current.notificationCampaigns).toHaveLength(1);
    const old: any = backup();
    old.metadata.backupVersion = 29;
    for (const key of Object.keys(notificationRows())) {
      delete old[key];
      delete old.metadata.counts[key];
    }
    const parsed = parseAndValidateBackup(old);
    expect(parsed.notificationTemplates).toEqual([]);
    expect(parsed.notificationRecipients).toEqual([]);
  });

  it("rejects non-IN_APP backup channels", () => {
    const unsafe: any = notificationRows();
    unsafe.notificationCampaigns[0].channel = "EMAIL";
    expect(() => validateNotificationBackupRows(unsafe, { userIds: new Set(["user"]) })).toThrow(/IN_APP/);
  });
});
