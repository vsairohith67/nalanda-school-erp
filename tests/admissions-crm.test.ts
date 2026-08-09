import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import { AdmissionError, admissionReportCsv, validatePublicEnquiry } from "@/lib/admissions";
import { RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("Prompt 23H admissions CRM governance", () => {
  it("accepts only the minimal public-enquiry contract", () => {
    const accepted = validatePublicEnquiry({ guardianName: "ADMIT23H Guardian", contactMethod: "PHONE", contactValue: "+91 90000 00000", desiredAcademicYear: "2027-28", desiredClass: "I", childName: "ADMIT23H Child", enquirySource: "WEBSITE", message: "Please share the governed next step.", privacyNoticeVersion: "ADMIT-PRIVACY-DRAFT-1", consentVersion: "ADMIT-CONSENT-DRAFT-1", consent: true, honeypot: "", requestKey: "ADMIT23H-REQUEST-0001" });
    expect(accepted.contactValue).toBe("919000000000");
    for (const prohibited of ["address", "latitude", "longitude", "aadhaar", "pan", "medical", "payment", "photo", "marks"]) {
      expect(() => validatePublicEnquiry({ ...accepted, [prohibited]: "forbidden" })).toThrow(AdmissionError);
    }
  });

  it("keeps Accountant denied and Viewer aggregate-only by default", () => {
    expect([...RECOMMENDED_ROLE_PERMISSIONS.ACCOUNTANT].some((permission) => permission.includes("ADMISSION"))).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_ADMISSION_REPORTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_ADMISSIONS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("REVIEW_ADMISSION_APPLICATIONS")).toBe(true);
  });

  it("uses effective IAM for exports and preserves Roman-numeral class labels", () => {
    expect(source("app/api/admissions/reports/route.ts")).toContain("canExport: exportDecision.allowed");
    const reports = source("components/admissions-reports.tsx");
    expect(reports).toContain("data.canExport ?");
    expect(reports).toContain("/^[ivx]+$/i");
  });

  it("exports only aggregate, formula-safe cells", () => {
    const csv = admissionReportCsv({ suppressedMinimumGroupSize: 3, classDemand: [{ label: "=I", count: "Suppressed" }], sourceFunnel: [{ label: "+WEBSITE", count: 3 }], enquiryStages: [], applicationStages: [], conversionTotal: 1, averageStageDurationHours: [], staffRanking: null });
    expect(csv).toContain("'=I");
    expect(csv).toContain("'+WEBSITE");
    expect(csv).not.toMatch(/guardian|document path|actorUserId|staff ranking/i);
  });

  it("includes every admissions collection in backup version 38 without raw invitation tokens", () => {
    const backup = createBackupDocument({ generatedAt: new Date("2026-08-03T12:00:00.000Z"), generatedBy: "ADMIT23H", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], admissionCycles: [{ id: "cycle-1" }], admissionApplications: [{ id: "app-1", invitationTokenHash: "a".repeat(64) }] });
    expect(backup.metadata.backupVersion).toBe(38);
    expect(backup.metadata.counts.admissionCycles).toBe(1);
    const parsed = parseAndValidateBackup(backup);
    expect(parsed.admissionApplications[0].invitationTokenHash).toBe("a".repeat(64));
    expect(JSON.stringify(parsed)).not.toContain("invitationToken\"");
  });

  it("uses POST/PATCH for mutations and private no-store responses", () => {
    expect(source("middleware.ts")).toContain('"/api/public/admissions/"');
    const routes = ["app/api/public/admissions/enquiries/route.ts", "app/api/public/admissions/application/route.ts", "app/api/admissions/applications/[publicKey]/convert/route.ts"];
    for (const route of routes) expect(source(route)).not.toMatch(/export async function (DELETE|PUT)\b/);
    expect(source("lib/admissions-api.ts")).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(source("app/api/public/admissions/enquiries/route.ts")).toContain("GENERIC");
  });

  it("locks immutable decisions, conversions, versions and audit events in the migration", () => {
    const migration = source("prisma/migrations/20260803193000_admissions_enquiry_crm/migration.sql");
    for (const trigger of ["AdmissionDecision_no_update", "AdmissionDecision_no_delete", "AdmissionConversion_no_update", "AdmissionConversion_no_delete", "AdmissionApplicationVersion_no_update", "AdmissionDuplicateResolution_no_update", "AdmissionEvent_no_update", "AdmissionEvent_no_delete"]) expect(migration).toContain(trigger);
  });
});
