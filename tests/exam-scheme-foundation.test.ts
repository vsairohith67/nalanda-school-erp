import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXAM_ROUNDING_POLICY_V1,
  ExamConfigurationError,
  validateGradeBands,
  validateSchemeComponents
} from "../lib/exam-configurations";
import { can } from "../lib/permissions";

const component = (overrides: Record<string, unknown> = {}) => ({
  componentCode: "THEORY",
  name: "Theory",
  componentKind: "WRITTEN",
  displayOrder: 1,
  maximumMarks: "100",
  isRequired: true,
  ...overrides
});

describe("EXAM-RC-IMPL-1 scheme policy", () => {
  it("accepts explicit RAW_SUM without manufacturing a weighting", () => {
    const result = validateSchemeComponents("RAW_SUM", [
      component({ maximumMarks: "40" }),
      component({ componentCode: "INTERNAL", name: "Internal", componentKind: "INTERNAL", displayOrder: 2, maximumMarks: "10" })
    ]);
    expect(result.calculationMode).toBe("RAW_SUM");
    expect(EXAM_ROUNDING_POLICY_V1).toBe("RC05_V1_DECIMAL6_HALF_UP2");
    expect(result.components.map((row) => row.contributionWeight)).toEqual([null, null]);
  });

  it("requires weighted contributions to total exactly 100 percent", () => {
    expect(validateSchemeComponents("WEIGHTED_NORMALIZED", [
      component({ maximumMarks: "80", contributionWeight: "70" }),
      component({ componentCode: "PROJECT", name: "Project", componentKind: "PROJECT", displayOrder: 2, maximumMarks: "20", contributionWeight: "30" })
    ]).components).toHaveLength(2);
    expect(() => validateSchemeComponents("WEIGHTED_NORMALIZED", [
      component({ contributionWeight: "70" }),
      component({ componentCode: "PROJECT", name: "Project", componentKind: "PROJECT", displayOrder: 2, contributionWeight: "29" })
    ])).toThrow("exactly 100%");
  });

  it("rejects zero maxima, duplicate components, and RAW_SUM weights", () => {
    expect(() => validateSchemeComponents("RAW_SUM", [component({ maximumMarks: 0 })])).toThrow("greater than zero");
    expect(() => validateSchemeComponents("RAW_SUM", [component(), component({ displayOrder: 2 })])).toThrow("Duplicate component");
    expect(() => validateSchemeComponents("RAW_SUM", [component({ contributionWeight: 100 })])).toThrow("cannot carry contribution weights");
  });

  it("requires non-overlapping ordered grade bands", () => {
    expect(validateGradeBands([
      { gradeCode: "A", label: "Excellent", minimumPercentage: 80, maximumPercentage: 100, displayOrder: 1 },
      { gradeCode: "B", label: "Good", minimumPercentage: 60, maximumPercentage: 79.99, displayOrder: 2 }
    ])).toHaveLength(2);
    expect(() => validateGradeBands([
      { gradeCode: "A", label: "Excellent", minimumPercentage: 80, maximumPercentage: 100, displayOrder: 1 },
      { gradeCode: "B", label: "Good", minimumPercentage: 79, maximumPercentage: 90, displayOrder: 2 }
    ])).toThrow("must not overlap");
  });

  it("keeps activation with Principal and explicitly governed leadership", () => {
    expect(can("PRINCIPAL", "MANAGE_EXAM_CONFIGURATION")).toBe(true);
    expect(can("PRINCIPAL", "ACTIVATE_EXAM_SCHEMES")).toBe(true);
    expect(can("PRINCIPAL", "ASSIGN_EXAM_TEACHERS")).toBe(true);
    expect(can("TEACHER", "ACTIVATE_EXAM_SCHEMES")).toBe(false);
    expect(can("TEACHER", "PROPOSE_EXAM_SCHEMES")).toBe(false);
    expect(can("TEACHER", "VIEW_OWN_EXAM_ASSIGNMENTS")).toBe(true);
  });

  it("enforces exact timetable ownership and append-only lifecycle in service source", () => {
    const source = readFileSync("lib/exam-configurations.ts", "utf8");
    expect(source).toContain("No active Staff/timetable Teacher link exists");
    expect(source).toContain("The Teacher has no exact timetable assignment");
    expect(source).toContain("Assign one primary submitter before adding contributors");
    expect(source).toContain("already has a primary submitter");
    expect(source).toContain("SCHEME_VERSION_ACTIVATED_AND_FROZEN");
    expect(source).not.toMatch(/teacherExamAssignment\.delete|examinationSchemeVersion\.delete|examination\.delete/);
  });

  it("does not encode historical mark combinations as defaults", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const service = readFileSync("lib/exam-configurations.ts", "utf8");
    for (const historical of ["10+40", "20+80", "25+25"]) {
      expect(schema).not.toContain(historical);
      expect(service).not.toContain(historical);
    }
    expect(service).toContain('"RAW_SUM"');
    expect(service).toContain('"WEIGHTED_NORMALIZED"');
  });

  it("uses safe domain errors for invalid policy input", () => {
    try {
      validateSchemeComponents("UNSUPPORTED", [component()]);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ExamConfigurationError);
      expect((error as ExamConfigurationError).status).toBe(400);
    }
  });

  it("keeps the synthetic Browser login fail-closed before hydration", () => {
    const login = readFileSync("components/login-form.tsx", "utf8");
    expect(login).toContain('method="post"');
    expect(login).toContain('action="/api/auth/login"');
    expect(login).toContain('method: "POST"');
    const security = readFileSync("lib/request-security.ts", "utf8");
    expect(security).toContain('process.env.NODE_ENV === "development"');
    expect(security).toContain("'unsafe-eval'");
  });
});
