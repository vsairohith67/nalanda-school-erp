import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";

const cloudKeys = [
  "cloudBackupProfiles",
  "cloudBackupSchedules",
  "cloudBackupRetentionPolicies",
  "cloudBackupRuns",
  "cloudBackupArtifacts",
  "cloudBackupVerifications",
  "cloudBackupRestoreRehearsals",
  "cloudBackupEvents"
] as const;

function emptyBackup() {
  return createBackupDocument({
    generatedAt: new Date("2026-07-19T05:00:00.000Z"),
    generatedBy: "QA20C",
    students: [],
    feeStructures: [],
    payments: [],
    paymentAudits: [],
    users: [{ id: "user-1", username: "qa20c", role: "DIRECTOR", passwordHash: "must-never-export" }]
  });
}

describe("cloud backup metadata backup and restore", () => {
  it("uses version 37, contains all eight arrays, and excludes secrets", () => {
    const backup = emptyBackup();
    expect(backup.metadata.backupVersion).toBe(41);
    for (const key of cloudKeys) {
      expect(backup[key]).toEqual([]);
      expect(backup.metadata.counts[key]).toBe(0);
    }
    expect(JSON.stringify(backup)).not.toContain("passwordHash");
    expect(JSON.stringify(backup)).not.toContain("must-never-export");
  });

  it("accepts version 35 with no cloud metadata arrays", () => {
    const backup = emptyBackup() as Record<string, any>;
    backup.metadata.backupVersion = 35;
    for (const key of cloudKeys) {
      delete backup[key];
      delete backup.metadata.counts[key];
    }
    const parsed = parseAndValidateBackup(backup);
    for (const key of cloudKeys) expect(parsed[key]).toEqual([]);
  });

  it("rejects future versions and forbidden credential/key fields", () => {
    const future = emptyBackup() as Record<string, any>;
    future.metadata.backupVersion = 42;
    expect(() => parseAndValidateBackup(future)).toThrow("unsupported");

    const secret = emptyBackup() as Record<string, any>;
    secret.cloudBackupProfiles = [{
      id: "profile-1",
      profileCode: "QA20C",
      providerKind: "MOCK",
      status: "PAUSED",
      encryptionKeyVersion: "V1",
      credentials: "forbidden"
    }];
    secret.metadata.counts.cloudBackupProfiles = 1;
    expect(() => parseAndValidateBackup(secret)).toThrow("forbidden");
  });
});
