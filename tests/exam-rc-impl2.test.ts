import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVED_ENTRY_STATE_POLICY_V1,
  EXAM_CALCULATION_FORMULA_V1
} from "../lib/exam-calculations-v2";
import {
  GOVERNED_MARK_ENTRY_STATES,
  GOVERNED_SHEET_STATUSES
} from "../lib/exam-marks";
import { can, RECOMMENDED_ROLE_PERMISSIONS } from "../lib/permissions";

const root = path.resolve(__dirname, "..");
const source = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("EXAM-RC-IMPL-2 governance contract", () => {
  it("keeps all approved mark states distinct and blocks NOT_ENTERED calculation", () => {
    expect(GOVERNED_MARK_ENTRY_STATES).toEqual([
      "NOT_ENTERED",
      "PRESENT",
      "ABSENT",
      "NOT_APPLICABLE",
      "EXEMPT"
    ]);
    expect(APPROVED_ENTRY_STATE_POLICY_V1).toEqual({
      NOT_ENTERED: "BLOCK",
      PRESENT: "USE_MARK",
      ABSENT: "ZERO",
      EXEMPT: "EXCLUDE",
      NOT_APPLICABLE: "EXCLUDE"
    });
    expect(EXAM_CALCULATION_FORMULA_V1).toBe("RC_CALC_V1_PAPER_NORMALIZED");
  });

  it("preserves the governed lifecycle and exact role permissions", () => {
    expect(GOVERNED_SHEET_STATUSES).toEqual([
      "NOT_STARTED",
      "DRAFT",
      "VALIDATION_FAILED",
      "READY_TO_SUBMIT",
      "SUBMITTED",
      "REOPEN_REQUESTED",
      "REOPENED",
      "RESUBMITTED",
      "MODERATED",
      "LOCKED"
    ]);
    expect(can("TEACHER", "ENTER_ASSIGNED_EXAM_MARKS")).toBe(true);
    expect(can("TEACHER", "MODERATE_EXAM_MARKS")).toBe(false);
    expect(can("PRINCIPAL", "MODERATE_EXAM_MARKS")).toBe(true);
    expect(can("PRINCIPAL", "LOCK_EXAM_CALCULATIONS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.has("INTERVENE_EXAM_MARKS")).toBe(true);
  });

  it("uses one additive migration and reuses the existing examination audit ledger", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/20260730_teacher_marks_moderation_calculation/migration.sql");
    expect(schema).toContain("model ExamMarkSheet");
    expect(schema).toContain("model ExamMarkEntry");
    expect(schema).toContain("model StudentResultSnapshot");
    expect(schema).not.toContain("model ExamCalculationRun");
    expect(schema).not.toContain("model ExamMarkSheetVersion");
    expect(migration).toContain('ALTER TABLE "ExaminationSchemeAudit" ADD COLUMN "eventKey"');
    expect(migration).toContain('CREATE TABLE "ExamMarkSheet"');
    expect(migration).toContain('CREATE TABLE "StudentResultSnapshot"');
    expect(migration).not.toMatch(/\bDROP TABLE\b/i);
  });

  it("gates Teacher and Principal endpoints and never uses native dialogs", () => {
    const teacherPage = source("app/teacher/marks/page.tsx");
    const principalPage = source("app/exams/moderation/page.tsx");
    const teacherUi = source("components/governed-mark-entry-grid.tsx");
    const principalUi = source("components/exam-moderation-dashboard.tsx");
    expect(teacherPage).toContain('requireRolePermission("VIEW_OWN_EXAM_MARKS", "TEACHER")');
    expect(principalPage).toContain('requirePermission("VIEW_EXAM_MODERATION")');
    for (const ui of [teacherUi, principalUi]) {
      expect(ui).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
      expect(ui).toContain('role="dialog"');
      expect(ui).toContain('aria-modal="true"');
    }
  });

  it("bounds marks payloads and applies private no-store responses", () => {
    expect(source("lib/request-security.ts")).toContain("EXAM_MARKS_BODY_LIMIT_BYTES");
    expect(source("lib/exam-marks-api.ts")).toContain('"Cache-Control": "private, no-store"');
    expect(source("lib/exam-marks.ts")).toContain("rowsValue.length > 200");
    expect(source("lib/exam-marks.ts")).toContain("EXPECTED_VERSION_CONFLICT");
  });

  it("keeps calculation fingerprints stable across moderation lock metadata", () => {
    const calculation = source("lib/exam-calculations-v2.ts");
    const sourceMaterial = calculation.slice(
      calculation.indexOf("function sourceMaterial"),
      calculation.indexOf("type ComponentResult")
    );
    expect(sourceMaterial).toContain("sheetVersionId: version.id");
    expect(sourceMaterial).toContain("rowVersion: entry.rowVersion");
    expect(sourceMaterial).not.toContain("optimisticVersion");
    expect(source("components/exam-moderation-dashboard.tsx")).not.toContain(".toLocaleString()");
  });
});
