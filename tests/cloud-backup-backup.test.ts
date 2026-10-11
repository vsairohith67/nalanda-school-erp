import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createBackupDocument } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { isSupportedStoredCloudBackupVersion } from "../lib/cloud-backup-versions";

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
  it("uses version 48, contains all eight arrays, and excludes secrets", () => {
    const backup = emptyBackup();
    expect(backup.metadata.backupVersion).toBe(48);
    for (const key of cloudKeys) {
      expect(backup[key]).toEqual([]);
      expect(backup.metadata.counts[key]).toBe(0);
    }
    expect(JSON.stringify(backup)).not.toContain("passwordHash");
    expect(JSON.stringify(backup)).not.toContain("must-never-export");
  });

  it("rejects unadmitted version 35 instead of treating a relabelled payload as compatible", () => {
    const backup = emptyBackup() as Record<string, any>;
    backup.metadata.backupVersion = 35;
    for (const key of cloudKeys) {
      delete backup[key];
      delete backup.metadata.counts[key];
    }
    expect(() => parseAndValidateBackup(backup)).toThrow("BACKUP_SOURCE_CONTRACT_UNSUPPORTED");
  });

  it("admits only explicitly adapted v45-v48 cloud artifacts, retaining older history without verification clearance", () => {
    const prior = emptyBackup() as Record<string, any>;
    prior.metadata.backupVersion = 43;
    for (const key of ["offlineSyncDevices", "offlineSyncMutations", "offlineSyncEvents", "offlineSyncConflictReviews"]) {
      delete prior[key];
      delete prior.metadata.counts[key];
    }
    expect(() => parseAndValidateBackup(prior)).toThrow("BACKUP_SOURCE_CONTRACT_UNSUPPORTED");
    expect(isSupportedStoredCloudBackupVersion(43)).toBe(false);
    expect(isSupportedStoredCloudBackupVersion(44)).toBe(false);
    expect(isSupportedStoredCloudBackupVersion(45)).toBe(true);
    expect(isSupportedStoredCloudBackupVersion(42)).toBe(false);
    const verification = readFileSync("lib/cloud-backup-verification.ts", "utf8");
    const rehearsal = readFileSync("lib/cloud-backup-rehearsal.ts", "utf8");
    expect(verification).toContain("isSupportedStoredCloudBackupVersion");
    expect(verification).toContain("backupVersion: backup.metadata.backupVersion");
    expect(rehearsal).toContain("isSupportedStoredCloudBackupVersion");
    expect(verification).not.toContain("backup.metadata.backupVersion !== 44");
    expect(rehearsal).not.toContain("backup.metadata.backupVersion !== 44");
  });

  it("rejects future versions and forbidden credential/key fields", () => {
    const future = emptyBackup() as Record<string, any>;
    future.metadata.backupVersion = 49;
    expect(() => parseAndValidateBackup(future)).toThrow("BACKUP_SOURCE_CONTRACT_UNSUPPORTED");

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
