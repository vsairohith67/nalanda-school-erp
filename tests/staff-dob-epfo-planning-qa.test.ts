import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const planning = read("docs/STAFF_DOB_EPFO_EPS_REMINDER_PLANNING.md");
const access = read("docs/STAFF_EPFO_DATA_PRIVACY_AND_ACCESS_MATRIX.md");
const checklist = read("docs/STAFF_EPFO_COMPLIANCE_CHECKLIST_DRAFT.md");
const decision = read("docs/STAFF_DOB_EPFO_22A_DECISION_RECORD.md");
const report = read("docs/STAFF_DOB_EPFO_22A_QA_REPORT.md");

describe("Prompt 22A-QA planning completeness", () => {
  it("uses dated official authorities and preserves professional uncertainty", () => {
    expect(planning).toContain("reviewed on 2026-07-20");
    expect(planning).toContain("No unofficial blog");
    for (const officialDomain of [
      "indiacode.nic.in",
      "epfo.gov.in",
      "epfindia.gov.in",
      "labour.gov.in",
      "pib.gov.in",
      "meity.gov.in",
    ]) {
      expect(planning).toContain(officialDomain);
    }
    expect(planning.toLowerCase()).toContain("qualified labour-law review");
    expect(planning).toContain("fresh dated professional review");
    expect(report).toContain("No unofficial blog was used as authority");
  });

  it("keeps age 58 a human EPS review trigger with no automatic action or claim", () => {
    expect(planning).toContain("Age 58 is relevant to EPS superannuation-pension administration");
    expect(planning).toContain("It is not, by itself, an ERP instruction to end employment");
    expect(planning).toContain("Review EPFO/EPS records and obtain professional guidance.");
    expect(planning).toContain("It creates no EPFO claim, submits no claim");
    for (const forbiddenInstruction of [
      "Retire this employee",
      "Terminate employment",
      "Pension is guaranteed",
      "Stop EPS contribution automatically",
    ]) {
      expect(planning).toContain(forbiddenInstruction);
    }
  });

  it("classifies every proposed field and omits full UAN and prohibited identifiers", () => {
    const fieldClassifications: Record<string, string> = {
      dateOfBirth: "REQUIRED",
      dobSource: "REQUIRED",
      dobVerificationStatus: "REQUIRED",
      dobVerifiedAt: "REQUIRED",
      dobVerifiedByUserId: "REQUIRED",
      dobCorrectionStatus: "REQUIRED",
      dobCorrectionReason: "OPTIONAL",
      employmentStartDate: "OMIT",
      employmentEndDate: "DEFER_TO_LATER_PHASE",
      epfoCoverageStatus: "REQUIRED",
      epfoReviewStatus: "REQUIRED",
      epfJoiningDate: "OPTIONAL",
      epsMembershipStatus: "OPTIONAL",
      uanAvailable: "OMIT",
      uanLast4: "OPTIONAL",
      eNominationStatus: "OPTIONAL",
      kycProfileStatus: "OPTIONAL",
      lastComplianceReviewedAt: "REQUIRED",
      nextComplianceReviewAt: "OPTIONAL",
      complianceNotesSafe: "OPTIONAL",
    };
    for (const [field, classification] of Object.entries(fieldClassifications)) {
      const row = planning.split(/\r?\n/).find((line) => line.includes(`\`${field}\``));
      expect(row, field).toBeDefined();
      expect(row, field).toContain(`| ${classification} |`);
    }
    expect(planning).toContain("| Full UAN | OMIT |");
    expect(planning).toContain("A boolean loses `UNKNOWN` and `NOT_CONFIRMED`");
    expect(planning).toContain("Aadhaar authentication data and portal sessions are always prohibited");
    expect(planning).toContain("Preserve unknown, unverified, conflicting and correction-pending as distinct states");
  });

  it("treats each role separately and defaults reminders to Director only", () => {
    for (const role of [
      "Super Admin",
      "Director",
      "Principal",
      "Accountant",
      "Admin",
      "Teacher/Staff",
      "Viewer",
      "Parent",
      "Public/unauthenticated",
    ]) {
      expect(access).toContain(`| ${role} |`);
    }
    expect(access).toContain("| Director | A | A | A | A | A | A | A | - | A |");
    expect(access).toContain("Accountant access is opt-in assignment");
    expect(access).toContain("Admin can prepare DOB/correction records but cannot verify them by default");
    expect(access).toContain("Viewer” must never receive exact DOB or identifier data");
    expect(access).toContain("Own-view access is deferred");
  });

  it("covers privacy, retention, backup, masking, audit and prohibited surfaces", () => {
    for (const required of [
      "## Purpose notice and Staff rights",
      "## Access logging and immutable history",
      "## Retention and end-of-employment plan",
      "## Backup and recovery",
      "Public website",
      "PWA/offline",
      "AI Assistant",
      "Communications",
      "No broad DOB/UAN CSV",
      "| Screenshots |",
      "| Print |",
    ]) {
      expect(access).toContain(required);
    }
    expect(access).toContain("mask identifier");
    expect(access).toContain("encrypt before any off-device upload");
  });

  it("defines deterministic reminders, correction recalculation and no automation", () => {
    for (const window of ["365 days", "180 days", "90 days", "30 days", "Date reached", "Overdue"]) {
      expect(planning).toContain(window);
    }
    expect(planning).toContain("India-calendar utility");
    expect(planning).toContain("29 February");
    expect(planning).toContain("Acknowledgement must not mean legal completion");
    expect(planning).toContain("Snooze requires a bounded future date and reason");
    expect(planning).toContain("invalidates/recalculates future reminder dates");
    expect(planning).toContain("No email, WhatsApp, SMS, push");
  });

  it("keeps the checklist human-reviewed, evidenced and non-certifying", () => {
    expect(checklist).toContain("does not prove statutory compliance");
    for (const required of [
      "evidence reference",
      "corrective action",
      "professional guidance",
      "next review date",
      "append-only",
      "Director review",
    ]) {
      expect(checklist.toLowerCase()).toContain(required.toLowerCase());
    }
  });

  it("keeps phases separate and proves no runtime implementation", () => {
    expect(planning).toContain("### Prompt 22B");
    expect(planning).toContain("### Prompt 22C");
    expect(planning).toContain("### Prompt 22D");
    expect(planning).toContain("or automate EPFO");

    const schema = read("prisma/schema.prisma");
    const staffStart = schema.indexOf("model StaffMember {");
    const staff = schema.slice(staffStart, schema.indexOf("\nmodel ", staffStart + 1));
    expect(staff).not.toMatch(/\b(dateOfBirth|dobSource|dobVerificationStatus|epfoCoverageStatus|epsMembershipStatus|uanLast4)\b/);
    expect(read("lib/backup.ts")).toContain("backupVersion: 38");
    expect(existsSync("app/staff-epfo")).toBe(false);
    expect(existsSync("app/api/staff-epfo")).toBe(false);
    expect(existsSync("app/epfo-age58")).toBe(false);
    expect(existsSync("app/api/epfo-age58")).toBe(false);
  });

  it("publishes the conditional QA decision and retains every external gate", () => {
    expect(report).toContain("Prompt 22A status: fully cleared for planning and governance");
    expect(report).toContain("Release result: `PROMPT_22A_CLEARED_BUT_22B_CONDITIONAL`");
    expect(report).toContain("1,419 tests across 156 files passed");
    expect(report).toContain("211/211 static pages");
    expect(report).toContain("nalanda-fee-control-backup-2026-07-20-11-32.json");
    expect(report).toContain("Prompt 22B is not yet safe to begin coding or real-data work");
    expect(report).not.toContain("FINAL_VERIFICATION_PLACEHOLDER");
    expect(decision).toContain("## Conditions before Prompt 22B coding");
    expect(decision).toContain("## Unresolved professional questions");
    expect(read("docs/INDEX.md")).toContain("STAFF_DOB_EPFO_22A_QA_REPORT.md");
  });
});
