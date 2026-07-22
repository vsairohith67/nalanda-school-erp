import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cloudBackupReportCsv } from "../lib/cloud-backup-reports";

describe("cloud backup aggregate reports and CSV", () => {
  it("exports an explicit aggregate allowlist and neutralises spreadsheet formulas", () => {
    const csv = cloudBackupReportCsv({
      generatedAt: "=HYPERLINK(\"https://example.invalid\")",
      profilesByModeStatus: {},
      schedules: { enabled: 1, disabled: 0, overdue: 1 },
      runsByStatus: { VERIFIED: 2 },
      runsByTrigger: { MANUAL: 2 },
      successfulUploads: 2,
      verifiedBackups: 2,
      restoreRehearsals: { PASSED: 1 },
      latestVerifiedAgeHours: 1,
      averageDurationMs: 100,
      averageEncryptedBytes: 200,
      averageCompressionRatio: 0.5,
      retryCount: 0,
      consecutiveFailures: 0,
      keyVersions: { V1: 2 },
      prunedArtifacts: 0,
      privateAssetCoverage: "NOT_INCLUDED",
      providerDistinction: { MOCK: 1, LOCAL_FOLDER: 1, LIVE_DISABLED: 2 }
    });

    expect(csv).toContain(`"'=HYPERLINK(""https://example.invalid"")"`);
    for (const column of [
      "verified_backups", "successful_uploads", "average_encrypted_bytes",
      "private_asset_coverage", "mock_profiles", "local_folder_profiles", "live_disabled_profiles"
    ]) expect(csv).toContain(column);
    expect(csv).not.toMatch(/student|parent|staff|actor.?id|object.?url|absolute.?path|credential|access.?token|encryption.?key/i);
  });

  it("uses an India-local filename and private no-store response headers", () => {
    const route = readFileSync("app/api/cloud-backup/reports/export/route.ts", "utf8");
    expect(route).toContain("cloud-backup-recovery-report-");
    expect(route).toContain("indiaDateKey(new Date()).slice(0, 10)");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('requireApiPermission("EXPORT_CLOUD_BACKUP_REPORTS")');
  });
});
