import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixturePath = "docs/fixtures/report-card-families.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const architecture = readFileSync(
  "docs/EXAMINATION_REPORT_CARD_ARCHITECTURE_AND_GAP_AUDIT.md",
  "utf8",
);

describe("EXAM-RC-PLAN-1 architecture evidence", () => {
  it("keeps the fixture PII-free and explicitly non-executable", () => {
    const serialized = JSON.stringify(fixture);
    expect(fixture.fixturePurpose).toContain("PII-free");
    expect(fixture.fixturePurpose).toContain("not executable");
    for (const forbidden of [
      "studentName",
      "admissionNumber",
      "guardianName",
      "parentName",
      "mobileNumber",
      "emailAddress",
      "streetAddress",
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it("describes every directly observed and retained family with evidence state", () => {
    expect(fixture.families.map((family: { familyId: string }) => family.familyId)).toEqual([
      "KG_DEVELOPMENTAL_BOOKLET",
      "PRIMARY_10_40_SKILLS",
      "SECONDARY_10_40_GROUPED",
      "RETAINED_MULTI_EXAM_I_X",
    ]);
    expect(fixture.families.every((family: { evidenceStatus?: string }) => family.evidenceStatus)).toBe(true);
    expect(fixture.families.at(-1).evidenceStatus).toBe(
      "RETAINED_SUMMARY_REQUIRES_SOURCE_REVALIDATION",
    );
  });

  it("requires explicit entry states and preserves real zero semantics", () => {
    expect(fixture.entryStatesRequired).toEqual([
      "NOT_ENTERED",
      "PRESENT",
      "ABSENT",
      "NOT_APPLICABLE",
      "EXEMPT",
    ]);
    expect(architecture).toContain("`PRESENT` with numeric zero is valid");
    expect(architecture).toContain("never silently zero");
  });

  it("records the historical arithmetic defects instead of promoting them", () => {
    const primary = fixture.families.find(
      (family: { familyId: string }) => family.familyId === "PRIMARY_10_40_SKILLS",
    );
    const secondary = fixture.families.find(
      (family: { familyId: string }) => family.familyId === "SECONDARY_10_40_GROUPED",
    );
    expect(primary.historicalInconsistencies.join(" ")).toContain("0/0");
    expect(secondary.historicalInconsistencies.join(" ")).toContain("7.33/15.67/23.00");
    expect(architecture).toContain("EXAM_REPORT_ARCHITECTURE_REQUIRES_DECISIONS");
  });

  it("keeps both durable diagram sources linked from the architecture", () => {
    const highLevel = readFileSync("docs/diagrams/NALANDA_ERP_SYSTEM_ARCHITECTURE.mmd", "utf8");
    const workflow = readFileSync("docs/diagrams/EXAMINATION_REPORT_CARD_WORKFLOW.mmd", "utf8");
    expect(highLevel).toContain("Detailed phase board");
    expect(highLevel).toContain("Examinations and Report Cards");
    expect(workflow).toContain("Exact marks-entry assignments");
    expect(workflow).toContain("Immutable publication version");
    expect(architecture).toContain("docs/fixtures/report-card-families.json");
  });
});
