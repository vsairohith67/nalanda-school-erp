import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "@/lib/permissions";
import { createBackupDocument } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";

const onboardingPermissions = [
  "DOWNLOAD_ONBOARDING_TEMPLATE", "UPLOAD_ONBOARDING_WORKBOOK", "VALIDATE_ONBOARDING_BATCH",
  "RESOLVE_ONBOARDING_CONFLICT", "APPROVE_ONBOARDING_BATCH", "EXECUTE_ONBOARDING_BATCH",
  "VIEW_ONBOARDING_AUDIT", "ROLLBACK_ONBOARDING_BATCH", "MANAGE_IMPORT_REFERENCE_EXPORT"
] as const;

describe("governed onboarding permissions and recovery", () => {
  it("uses exact default role boundaries", () => {
    for (const permission of onboardingPermissions) expect(PERMISSIONS).toContain(permission);
    for (const role of ["SUPER_ADMIN", "DIRECTOR"] as const) for (const permission of onboardingPermissions) expect(can(role, permission)).toBe(true);
    expect(can("PRINCIPAL", "APPROVE_ONBOARDING_BATCH")).toBe(true);
    expect(can("PRINCIPAL", "EXECUTE_ONBOARDING_BATCH")).toBe(false);
    expect(can("PRINCIPAL", "ROLLBACK_ONBOARDING_BATCH")).toBe(false);
    for (const role of ["ADMIN", "COMPUTER_OPERATOR"] as const) {
      expect(can(role, "UPLOAD_ONBOARDING_WORKBOOK")).toBe(true);
      expect(can(role, "VALIDATE_ONBOARDING_BATCH")).toBe(true);
      expect(can(role, "APPROVE_ONBOARDING_BATCH")).toBe(false);
      expect(can(role, "EXECUTE_ONBOARDING_BATCH")).toBe(false);
    }
    for (const role of ["ACCOUNTANT", "TEACHER", "PARENT", "VIEWER"] as const) for (const permission of onboardingPermissions) expect(can(role, permission)).toBe(false);
  });

  it("keeps every state-changing API on POST and behind its exact permission", () => {
    const routes = [
      ["validate", "VALIDATE_ONBOARDING_BATCH"], ["approve", "APPROVE_ONBOARDING_BATCH"],
      ["execute", "EXECUTE_ONBOARDING_BATCH"], ["rollback", "ROLLBACK_ONBOARDING_BATCH"]
    ] as const;
    for (const [route, permission] of routes) {
      const source = readFileSync(`app/api/onboarding/batches/[publicKey]/${route}/route.ts`, "utf8");
      expect(source).toContain(`requireApiPermission("${permission}")`);
      expect(source).toContain("export async function POST");
      expect(source).not.toContain("export async function GET");
    }
    expect(readFileSync("lib/onboarding-types.ts", "utf8")).toContain('"cache-control": "private, no-store');
    expect(readFileSync("lib/pwa-cache-policy.ts", "utf8")).not.toMatch(/onboarding/i);
    expect(readFileSync("lib/public-website-routing.ts", "utf8")).toContain('"/onboarding"');
  });

  it("backs up privacy-safe lineage without raw workbook content or actor reasons", () => {
    const now = "2026-08-10T12:00:00.000Z";
    const backup = createBackupDocument({
      generatedAt: new Date(now), generatedBy: "IMPORT-1A QA", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [],
      onboardingBatches: [{
        id: "batch-1", publicKey: "00000000-0000-4000-8000-000000000001", bundleType: "COMBINED", mode: "CREATE_AND_LINK", status: "COMPLETED", version: 4,
        uploadedByUserId: "private-actor", originalFileNameHash: "f".repeat(64), storageKey: "source/private.xlsx", workbookSha256: "a".repeat(64), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: 1234,
        templateVersion: "1.0", schemaVersion: "IMPORT-1A-2026-08-10", planVersion: 1, planSummaryJson: JSON.stringify({ blockingErrorCount: 0, issues: [{ code: "PHONE_INVALID", severity: "BLOCKING_ERROR", sheet: "Guardians", row: 2, column: "Mobile", submittedValue: "9876543210" }], resolutions: { "GUA-001": { decision: "LINK_EXISTING", reason: "Private operator note" } } }),
        approvedByUserId: "private-approver", approvalReason: "Private approval reason", executionResultJson: JSON.stringify({ students: 1 }), purgeAfter: now, createdAt: now, updatedAt: now
      }],
      onboardingRowOutcomes: [{ id: "outcome-1", batchId: "batch-1", entityType: "STUDENT", sheetName: "Students", sourceRowNumber: 2, importRowKey: "STU-001", action: "CREATE", status: "COMPLETED", targetRecordId: "student-private", issueCodesJson: "[]", createdAt: now }],
      onboardingAuditEvents: [{ id: "audit-1", batchId: "batch-1", sequence: 1, eventType: "EXECUTED", previousStatus: "APPROVED", newStatus: "COMPLETED", actorUserId: "private-actor", reasonSafe: "Private execution reason", evidenceHash: "b".repeat(64), occurredAt: now }]
    });
    const serialized = JSON.stringify(backup);
    expect(backup.metadata.backupVersion).toBe(42);
    expect(serialized).not.toContain("source/private.xlsx");
    expect(serialized).not.toContain("9876543210");
    expect(serialized).not.toContain("Private operator note");
    expect(serialized).not.toContain("Private approval reason");
    expect(serialized).not.toContain("student-private");
    const validated = parseAndValidateBackup(backup);
    expect(validated.onboardingBatches).toHaveLength(1);
    expect(validated.onboardingRowOutcomes[0].targetRecordId).toMatch(/^[a-f0-9]{64}$/);
  });
});
