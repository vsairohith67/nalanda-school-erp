import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixturePath = "docs/fixtures/report-card-families.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const policyFixturePath = "docs/fixtures/exam-report-policy-v1.json";
const policyFixture = JSON.parse(readFileSync(policyFixturePath, "utf8"));
const architecture = readFileSync(
  "docs/EXAMINATION_REPORT_CARD_ARCHITECTURE_AND_GAP_AUDIT.md",
  "utf8",
);
const decisionRegister = readFileSync(
  "docs/EXAM_REPORT_CARD_LEADERSHIP_DECISION_REGISTER.md",
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

describe("EXAM-RC-DECISIONS-APPROVAL-V2 policy freeze", () => {
  const expectedDecisionIds = Array.from(
    { length: 40 },
    (_, index) => `RC-${String(index + 1).padStart(2, "0")}`,
  );
  const customDecisionIds = ["RC-02", "RC-09", "RC-17", "RC-21", "RC-24", "RC-31"];

  it("freezes exactly one approved selection for RC-01 through RC-40", () => {
    const ids = policyFixture.decisions.map((decision: { id: string }) => decision.id);
    expect(policyFixture.policyId).toBe("EXAM_REPORT_POLICY_V1");
    expect(policyFixture.version).toBe(1);
    expect(policyFixture.status).toBe("APPROVED");
    expect(ids).toEqual(expectedDecisionIds);
    expect(new Set(ids).size).toBe(40);
    expect(
      policyFixture.decisions.filter(
        (decision: { selection: string }) => decision.selection === "OPTION_A",
      ),
    ).toHaveLength(34);
    expect(
      policyFixture.decisions
        .filter((decision: { selection: string }) => decision.selection === "CUSTOM")
        .map((decision: { id: string }) => decision.id),
    ).toEqual(customDecisionIds);
  });

  it("keeps the copyable register manifest aligned with the policy fixture", () => {
    const manifest = decisionRegister
      .slice(
        decisionRegister.indexOf("## 7. Approved policy-version-1 selection manifest"),
        decisionRegister.indexOf("## 8. Policy-version-1 calculation and authority contract"),
      )
      .match(/^RC-\d{2}=(OPTION_A|CUSTOM)\b/gm);

    expect(manifest).not.toBeNull();
    expect(manifest).toHaveLength(40);
    expect(
      manifest?.map((line: string) => {
        const [id, selection] = line.split("=");
        return { id, selection };
      }),
    ).toEqual(
      policyFixture.decisions.map((decision: { id: string; selection: string }) => ({
        id: decision.id,
        selection: decision.selection,
      })),
    );
  });

  it("requires an explicit calculation mode and validates normalized weights", () => {
    expect(policyFixture.calculationModes.requiredSelection).toBe(true);
    expect(policyFixture.calculationModes.RAW_SUM.componentContribution).toBe("obtainedMarks");
    expect(policyFixture.calculationModes.WEIGHTED_NORMALIZED.componentContribution).toBe(
      "(obtainedMarks / componentMaximumMarks) * componentWeight",
    );
    expect(policyFixture.calculationModes.WEIGHTED_NORMALIZED.weightTotalPercent).toBe(100);
    expect(policyFixture.calculationModes.validation).toContain(
      "WEIGHTS_TOTAL_100_WHEN_WEIGHTED",
    );
    expect(policyFixture.calculationModes.validation).toContain(
      "RC_05_DECIMAL_AND_ROUNDING_POLICY",
    );
  });

  it("does not promote historical marks structures or combined weights to defaults", () => {
    const marksStructure = policyFixture.decisions.find(
      (decision: { id: string }) => decision.id === "RC-02",
    );
    const combinedResult = policyFixture.decisions.find(
      (decision: { id: string }) => decision.id === "RC-09",
    );

    expect(marksStructure.policy.universalDefault).toBeNull();
    expect(combinedResult.policy.universalDefault).toBeNull();
    expect(policyFixture.globalGuards).toContain("There is no fixed school-wide marks structure.");
    expect(policyFixture.globalGuards).toContain(
      "There is no universal combined-result weighting.",
    );
    expect(policyFixture.historicalExamplesOnly).toEqual([
      "10 + 40",
      "20 + 80",
      "25 + 25",
      "10% + 10% + 10% + 20% + 50%",
    ]);
  });

  it("captures every supplied custom policy without narrowing its configuration scope", () => {
    const policies = Object.fromEntries(
      policyFixture.decisions
        .filter((decision: { selection: string }) => decision.selection === "CUSTOM")
        .map((decision: { id: string; policy: object }) => [decision.id, decision.policy]),
    );

    expect(policies["RC-02"]).toMatchObject({
      schemeKey: ["academicYear", "examination", "class"],
      orderedComponents: true,
      allowedComponentKinds: [
        "INTERNAL",
        "WRITTEN",
        "PRACTICAL",
        "ORAL",
        "PROJECT",
        "OTHER_APPROVED",
      ],
      componentMaximumRequired: true,
      componentContributionWeightOptional: true,
      subjectOrPaperOverride: "EXPLICIT_PRINCIPAL_APPROVAL_REQUIRED",
      sectionException: "PRINCIPAL_REASON_AND_AUDIT_REQUIRED",
    });
    expect(policies["RC-09"]).toMatchObject({
      schemeKey: ["academicYear", "class", "combinedResultScheme"],
      sourceExaminations: "PRINCIPAL_SELECTED_LOCKED_EXAMINATIONS",
      weightTotalPercent: 100,
      previewBeforeActivation: true,
      missingOrUnlockedSource: "BLOCK",
      changeAfterMarksEntryBegins: "NEW_GOVERNED_VERSION_REQUIRED",
      publishedHistory: "IMMUTABLE",
    });
    expect(policies["RC-17"]).toEqual({
      defaultRange: "ACADEMIC_YEAR_START_THROUGH_EXAMINATION_CLOSING_DATE",
      attendanceSource: "LOCKED_ATTENDANCE_ONLY",
      specialExamRange: "PRINCIPAL_GOVERNED_CUSTOM_RANGE",
    });
    expect(policies["RC-21"]).toEqual({
      configurationScope: "CLASS_AND_EXAM_SCHEME",
      defaultMode: "GRADE_ONLY_EXCLUDED",
      explicitApprovalModes: ["NUMERIC_INCLUDED", "NUMERIC_EXCLUDED"],
    });
    expect(policies["RC-24"]).toMatchObject({
      finalReportSpaces: [
        "CLASS_TEACHER",
        "PRINCIPAL",
        "PARENT_OR_GUARDIAN",
        "DIRECTOR",
      ],
      interimDirectorSpace: "CONFIGURABLE_OMISSION",
      signatureControl: "GOVERNED_APPROVAL_STATUS_AND_PHYSICAL_SPACES",
      uploadedSignatureImages: "NOT_UNCONTROLLED",
    });
    expect(policies["RC-31"]).toEqual({
      normalReport: "A4_PORTRAIT",
      wideCombinedReport: ["A4_LANDSCAPE", "READABLE_MULTI_PAGE_PORTRAIT"],
      minimumFontSize: "APPROVED_MINIMUM_MUST_BE_PRESERVED",
    });
  });

  it("freezes authority at Principal activation and preserves published history", () => {
    expect(policyFixture.workflowAuthority.teacher).toBe(
      "MAY_PROPOSE_ONLY_FOR_ASSIGNED_SUBJECTS",
    );
    expect(policyFixture.workflowAuthority.principal).toBe(
      "REVIEWS_AND_ACTIVATES_FINAL_CLASS_EXAM_SCHEME",
    );
    expect(policyFixture.workflowAuthority.superAdmin).toBe(
      "EXPLICIT_PERMISSION_AND_AUDIT_REASON_REQUIRED",
    );
    expect(policyFixture.workflowAuthority.freezePoint).toBe(
      "MARKS_ENTRY_OPEN_FOR_SCHEME_VERSION",
    );
    expect(policyFixture.globalGuards).toContain(
      "Old published reports and their calculation snapshots remain unchanged.",
    );
  });

  it("keeps architecture and diagrams aligned with the approved configurable policy", () => {
    const highLevel = readFileSync("docs/diagrams/NALANDA_ERP_SYSTEM_ARCHITECTURE.mmd", "utf8");
    const workflow = readFileSync("docs/diagrams/EXAMINATION_REPORT_CARD_WORKFLOW.mmd", "utf8");

    for (const source of [architecture, decisionRegister, workflow]) {
      expect(source).toContain("RAW_SUM");
      expect(source).toContain("WEIGHTED_NORMALIZED");
    }
    expect(highLevel).toContain("no universal marks structure or combined weighting");
    expect(workflow).toContain("Assigned Teacher proposal");
    expect(workflow).toContain("Principal review + activation");
    expect(workflow).toContain("combined weights total 100%");
    expect(workflow).toContain("old publication unchanged");
  });
});
