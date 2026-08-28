import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { certificateReportsCsv } from "@/lib/certificate-reports";
import { csvCell } from "@/lib/expenses";
import { reportCardRowsCsv } from "@/lib/report-card-reports";
import { smsEmailReportsCsv } from "@/lib/sms-email-reports";

type Surface = {
  id: string;
  sourcePath: string;
  classification: "BULK_EXPORT" | "NOT_A_BULK_EXPORT";
  permission: string;
  objectScope: string;
  boundedBehavior: string;
  csvFormulaSafe: boolean | null;
  noStore: boolean;
  featureFlag: string | null;
};

function manifest() {
  return JSON.parse(readFileSync("tools/release-evidence/bulk-export-contracts.json", "utf8")) as {
    discovery: { discoveredCount: number; bulkExportCount: number; notBulkExportCount: number };
    bulkExportFlag: { key: string; currentMappedSurfaceCount: number; committedDefaultState: boolean; committedRolloutPercentage: number };
    surfaces: Surface[];
  };
}

describe("bulk export governance", () => {
  it("discovers and structurally validates every current export-like API surface", () => {
    const output = execFileSync(process.execPath, ["tools/release-evidence/bulk-export-governance.mjs"], { cwd: process.cwd(), encoding: "utf8" });
    expect(JSON.parse(output)).toEqual({
      schemaVersion: 1,
      status: "PASS",
      discoveredCount: 60,
      bulkExportCount: 40,
      notBulkExportCount: 20,
      bulkExportFlagMappedSurfaceCount: 0,
      errors: []
    });
  }, 15_000);

  it("requires an explicit governance decision for every discovered source", () => {
    const contract = manifest();
    expect(contract.surfaces).toHaveLength(contract.discovery.discoveredCount);
    expect(new Set(contract.surfaces.map((surface) => surface.sourcePath)).size).toBe(contract.surfaces.length);
    expect(contract.surfaces.filter((surface) => surface.classification === "BULK_EXPORT")).toHaveLength(contract.discovery.bulkExportCount);
    expect(contract.surfaces.filter((surface) => surface.classification === "NOT_A_BULK_EXPORT")).toHaveLength(contract.discovery.notBulkExportCount);
    for (const surface of contract.surfaces.filter((entry) => entry.classification === "BULK_EXPORT")) {
      expect(surface.permission, surface.id).not.toMatch(/^(?:NONE|PUBLIC|UNKNOWN)$/);
      expect(surface.objectScope.length, surface.id).toBeGreaterThan(10);
      expect(surface.boundedBehavior.length, surface.id).toBeGreaterThan(10);
      expect(surface.noStore, surface.id).toBe(true);
    }
  });

  it("classifies bulk-exports as the real default-off switch for future new surfaces, with none currently mapped", () => {
    const contract = manifest();
    expect(contract.bulkExportFlag).toMatchObject({
      key: "bulk-exports",
      currentMappedSurfaceCount: 0,
      committedDefaultState: false,
      committedRolloutPercentage: 0
    });
    expect(contract.surfaces.filter((surface) => surface.featureFlag === "bulk-exports")).toEqual([]);
  });

  it("neutralises spreadsheet formula prefixes in representative high-risk exports", () => {
    for (const value of ["=cmd|' /C calc'!A0", "+SUM(1,1)", "-2+3", "@IMPORTDATA(example)", "\t=1+1", "\r=1+1"]) {
      expect(csvCell(value), value).toContain("'");
      const reportCard = reportCardRowsCsv([{ batchNumber: value }]);
      expect(reportCard, value).toContain("'");
      const certificate = certificateReportsCsv([{ requestNumber: value }]);
      expect(certificate, value).toContain("'");
    }
    const sms = smsEmailReportsCsv({
      generatedAt: new Date(0),
      profiles: [{ channel: "SMS", profileCode: "=FORMULA", spfStatus: "NA", dkimStatus: "NA", dmarcStatus: "NA", senderAliasStatus: "NA", mode: "DISABLED", status: "INACTIVE" }],
      consents: [], suppressions: [], batches: [], deliveries: [], attempts: [], webhooks: [], events: [], mappings: [], skipReasonCounts: {},
      totals: { campaignRecipients: 0, eligible: 0, skipped: 0, smsSegments: 0, estimatedCostMinor: 0 }
    } as never);
    expect(sms).toContain("'=FORMULA");
  });

  it("does not expose client-selected hidden fields or unprotected cached bulk responses", () => {
    const contract = manifest();
    for (const surface of contract.surfaces.filter((entry) => entry.classification === "BULK_EXPORT")) {
      const source = readFileSync(surface.sourcePath, "utf8");
      expect(source, surface.id).not.toMatch(/(?:get|has)\(["'](?:fields?|select|include)["']\)/);
      expect(source, surface.id).toMatch(/requireApi|requireAcademicReportAccess|optionalOperationsActor|parentMeetingApiAuth|auth\.|auth=|auth\s*=/);
      expect(source, surface.id).toMatch(/no-store|PRIVATE_HEADERS|privateFinanceJson/i);
    }
  });
});
