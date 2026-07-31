import { describe, expect, it } from "vitest";
import { createBackupDocument, serializeBackup } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";

const at = "2026-07-31T12:00:00.000Z";

describe("AUTH-2B backup boundary", () => {
  it("preserves security evidence while excluding credential material", () => {
    const backup = createBackupDocument({
      generatedAt: new Date(at), generatedBy: "AUTH2BQA",
      students: [], feeStructures: [], payments: [], paymentAudits: [],
      users: [{ id: "user-1", name: "QA", username: "auth2bqa", role: "SUPER_ADMIN", isActive: true }],
      authSecurity: {
        aliases: [{ id: "alias-1", userId: "user-1", type: "WORK_EMAIL", normalizedValue: "qa@example.test", displayMasked: "q***@e***.test", status: "VERIFIED", isSchoolGoverned: false, version: 1, createdAt: at, updatedAt: at }],
        verificationHistory: [{ id: "verify-1", aliasId: "alias-1", userId: "user-1", purpose: "VERIFY_LOGIN_ALIAS", codeHash: "never-back-up", credentialVersion: 1, attempts: 1, maxAttempts: 5, expiresAt: at, usedAt: at, createdAt: at }],
        resetHistory: [{ id: "reset-1", aliasId: "alias-1", userId: "user-1", channelType: "WORK_EMAIL", purpose: "PASSWORD_RESET", tokenHash: "never-back-up", credentialVersion: 1, attempts: 0, maxAttempts: 5, expiresAt: at, invalidatedAt: at, invalidationReason: "NEWER_RESET", createdAt: at }],
        sessions: [{ id: "session-1", userId: "user-1", tokenHash: "never-back-up", credentialVersion: 1, createdAt: at, lastSeenAt: at, expiresAt: at, revokedAt: at, revocationReason: "LOGOUT", deviceSummary: "Desktop", browserSummary: "Browser", networkEvidenceMasked: "net:abcd", version: 1 }],
        events: [{ id: "event-1", userId: "user-1", actorUserId: "user-1", eventType: "PASSWORD_RESET_COMPLETED", subjectType: "USER", subjectId: "user-1", detailsJson: "{\"sessionsRevoked\":true}", createdAt: at }]
      }
    });
    const serialized = serializeBackup(backup);
    expect(serialized).not.toContain("never-back-up");
    expect(serialized).not.toMatch(/(?:codeHash|tokenHash)/);
    const validated = parseAndValidateBackup(serialized);
    expect(validated.authSecurity.aliases).toHaveLength(1);
    expect(validated.authSecurity.verificationHistory).toHaveLength(1);
    expect(validated.authSecurity.resetHistory).toHaveLength(1);
    expect(validated.authSecurity.sessions).toHaveLength(1);
    expect(validated.authSecurity.events).toHaveLength(1);
  });

  it("rejects secret-bearing or cross-user auth rows", () => {
    const base = {
      metadata: { appName: "Nalanda Fee Control", academicYear: "2026-27", generatedAt: at, generatedBy: "AUTH2BQA", backupVersion: 37 },
      students: [], feeStructures: [], payments: [], paymentAudits: [],
      users: [{ id: "user-1", username: "auth2bqa" }], receiptNotes: []
    };
    expect(() => parseAndValidateBackup({ ...base, authSecurity: { aliases: [], verificationHistory: [], resetHistory: [], sessions: [{ id: "s", userId: "user-1", tokenHash: "secret" }], events: [] } }))
      .toThrow("tokenHash is not supported");
    expect(() => parseAndValidateBackup({ ...base, authSecurity: { aliases: [{ id: "a", userId: "other", type: "WORK_EMAIL", normalizedValue: "qa@example.test", displayMasked: "q***", status: "VERIFIED", isSchoolGoverned: false, version: 1 }], verificationHistory: [], resetHistory: [], sessions: [], events: [] } }))
      .toThrow("does not match a backup user");
  });
});
