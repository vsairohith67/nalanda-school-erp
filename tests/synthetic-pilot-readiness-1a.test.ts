import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertSyntheticPilotRoleAccessMatrixIntegrity, buildSyntheticPilotRoleAccessMatrix, SYNTHETIC_PILOT_CRITICAL_SURFACES } from "@/config/synthetic-pilot-role-access-matrix";
import { MARKS_DELEGATION_PERMISSIONS } from "@/lib/academic-integrity";
import { releaseFeatureFlags } from "@/lib/release-feature-flags";
import { SYNTHETIC_PILOT_DATASET_PLAN, SYNTHETIC_PILOT_DIMENSIONS, reconcileDailyCash } from "@/lib/synthetic-pilot-readiness";

describe("SYNTHETIC-PILOT-READINESS-1A acceptance contracts", () => {
  it("defines the governed synthetic school scale without operational records", () => {
    expect(SYNTHETIC_PILOT_DATASET_PLAN).toMatchObject({ students: 800, guardians: 1_200, staff: 80, teachingStaff: 45, operationalDataUsed: false });
    expect(SYNTHETIC_PILOT_DATASET_PLAN.academicYears).toEqual(["2025-26", "2026-27"]);
    expect(SYNTHETIC_PILOT_DATASET_PLAN.classes).toHaveLength(10);
    expect(SYNTHETIC_PILOT_DATASET_PLAN.sections).toEqual(["A", "B", "C", "D"]);
  });

  it("reconciles cash in integer paise and exposes any closing difference", () => {
    expect(reconcileDailyCash({ openingBalancePaise: 500_000, cashFeeCollectionsPaise: 1_250_000, cashMiscIncomePaise: 150_000, cashExpensesPaise: 230_000, actualClosingPaise: 1_670_000 })).toMatchObject({ expectedClosingPaise: 1_670_000, differencePaise: 0, reconciled: true });
    expect(reconcileDailyCash({ openingBalancePaise: 500_000, cashFeeCollectionsPaise: 1_250_000, cashMiscIncomePaise: 150_000, cashExpensesPaise: 230_000, actualClosingPaise: 1_669_900 })).toMatchObject({ differencePaise: -100, reconciled: false });
    expect(() => reconcileDailyCash({ openingBalancePaise: 0.5, cashFeeCollectionsPaise: 0, cashMiscIncomePaise: 0, cashExpensesPaise: 0 })).toThrow();
  });

  it("derives all base roles and the exact marks profile from server permissions", () => {
    const matrix = buildSyntheticPilotRoleAccessMatrix();
    expect(matrix.generatedFromServerPermissions).toBe(true);
    expect(matrix.roles).toHaveLength(12);
    const teacher = matrix.roles.find((role) => role.role === "TEACHER")!;
    for (const permission of ["ENTER_MARKS", "SUBMIT_MARKS", "ENTER_ASSIGNED_EXAM_MARKS", "ISSUE_REPORT_CARDS"]) expect(teacher.allowedPermissions).not.toContain(permission);
    const marksOperator = matrix.roles.find((role) => role.role === "MARKS_ENTRY_OPERATOR")!;
    expect(marksOperator.allowedPermissions).toEqual(MARKS_DELEGATION_PERMISSIONS);
    for (const permission of ["MANAGE_IAM_USERS", "MODERATE_EXAM_MARKS", "ISSUE_REPORT_CARDS"]) expect(marksOperator.allowedPermissions).not.toContain(permission);
    expect(SYNTHETIC_PILOT_CRITICAL_SURFACES).toHaveLength(10);
    const reportIssue = SYNTHETIC_PILOT_CRITICAL_SURFACES.find((surface) => surface.id === "report-issue")!;
    expect(reportIssue.allowedRoles).toEqual(["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"]);
    expect(assertSyntheticPilotRoleAccessMatrixIntegrity()).toEqual(matrix);
  });

  it("keeps optional, offline, native, provider and real-data flags off at zero rollout", () => {
    for (const flag of releaseFeatureFlags()) {
      expect(flag.defaultState, flag.key).toBe(false);
      expect(flag.rolloutPercentage, flag.key).toBe(0);
    }
  });

  it("tracks separate scorecard dimensions instead of a fake compliance percentage", () => {
    expect(SYNTHETIC_PILOT_DIMENSIONS).toHaveLength(13);
    expect(new Set(SYNTHETIC_PILOT_DIMENSIONS).size).toBe(SYNTHETIC_PILOT_DIMENSIONS.length);
  });

  it("ships every required pilot runbook and preserves OCR and biometric boundaries", () => {
    const paths = [
      "docs/SYNTHETIC_PILOT_READINESS.md", "docs/SYNTHETIC_SCHOOL_DAY_RUNBOOK.md", "docs/ACCOUNTANT_DAILY_CLOSING_RUNBOOK.md",
      "docs/REPORT_CARD_RELEASE_RUNBOOK.md", "docs/SUPPORT_TRIAGE_RUNBOOK.md", "docs/SECURITY_INCIDENT_FIRST_30_MINUTES.md",
      "docs/MONTH_END_SCHOOL_MANAGEMENT_CHECKLIST.md", "docs/ROLE_TRAINING_GUIDES.md", "docs/PILOT_QUICK_REFERENCE_SHEETS.md",
      "docs/PILOT_ROLE_ACCESS_MATRIX.md", "docs/PILOT_GO_NO_GO_GATES.md", "docs/REAL_DATA_ONBOARDING_PRECHECK.md",
      "docs/PILOT_CUTOVER_ROLLBACK_PLAN.md", "docs/SYNTHETIC_PILOT_DEFECT_REGISTER.md", "docs/evidence/SYNTHETIC_PILOT_READINESS_1A_CLEARANCE.md"
    ];
    for (const path of paths) expect(existsSync(path), path).toBe(true);
    const readiness = readFileSync("docs/SYNTHETIC_PILOT_READINESS.md", "utf8");
    expect(readiness).toContain("OCR_AND_SCANNING — NOT YET SOFTWARE-CLEARED");
    expect(readiness).toContain("BIOMETRIC-STAFF-ATTENDANCE-1A");
    expect(readiness).toContain("REAL USERS — NOT ACTIVATED");
  });
});
