import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { buildExamReports, examReportsFilename } from "@/lib/exam-reports";
import { applyApprovedCorrection, eligibleStudents } from "@/lib/marks";
import { RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";
import { marksError } from "@/lib/marks-api";

describe("Prompt 17B QA hardening", () => {
  it("masks Prisma uniqueness internals from API responses", () => {
    const error = new Prisma.PrismaClientKnownRequestError("raw prisma invocation", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["examCode"] }
    });
    expect(marksError(error)).toEqual({
      message: "A record with the same unique details already exists.",
      status: 409
    });
  });

  it("treats an intentionally sectionless assessment as class-wide", async () => {
    const whereRows: unknown[] = [];
    const fake = { academicYearEnrollment: { findMany: async ({ where }: any) => { whereRows.push(where); return []; } } };
    await eligibleStudents(fake as never, { academicYear: "2026-27", className: "VI", section: "" });
    await eligibleStudents(fake as never, { academicYear: "2026-27", className: "VI", section: "A" });
    expect(whereRows[0]).not.toHaveProperty("section");
    expect(whereRows[1]).toMatchObject({ section: "A" });
  });

  it("blocks controlled correction after the exam is cancelled", async () => {
    const expected = new Date("2026-07-16T00:00:00.000Z");
    const fake: any = {
      $transaction: (work: any) => work(fake),
      examAssessment: {
        findUnique: async () => ({
          id: "assessment-1",
          entryStatus: "APPROVED",
          updatedAt: expected,
          maxMarks: new Prisma.Decimal(100),
          examCycle: { status: "CANCELLED" },
          marks: []
        })
      }
    };
    await expect(applyApprovedCorrection(
      fake,
      "assessment-1",
      { admissionNumber: "A1", marksObtained: "10", entryStatus: "PRESENT" },
      expected,
      "QA correction",
      { id: "u1", name: "QA" }
    )).rejects.toThrow(/cancelled/);
  });

  it("reports configuration gaps and exact result distribution", async () => {
    const assessmentBase = {
      id: "a1",
      academicYear: "2026-27",
      className: "VI",
      section: "A",
      subjectName: "Mathematics",
      componentName: "Theory",
      assessmentType: "THEORY",
      entryStatus: "APPROVED",
      maxMarks: new Prisma.Decimal(100),
      passMarks: new Prisma.Decimal(40),
      examCycle: { examCode: "QA17B-REPORT", name: "QA Report", status: "APPROVED" },
      marks: [
        { entryStatus: "PRESENT", marksObtained: new Prisma.Decimal(50) },
        { entryStatus: "PRESENT", marksObtained: new Prisma.Decimal(39) },
        { entryStatus: "ABSENT", marksObtained: null },
        { entryStatus: "EXEMPT", marksObtained: null },
        { entryStatus: "NOT_APPLICABLE", marksObtained: null }
      ],
      events: [{ eventType: "CORRECTION_APPLIED" }]
    };
    const fake: any = {
      examAssessment: { findMany: async () => [
        assessmentBase,
        {
          ...assessmentBase,
          id: "a2",
          section: "",
          subjectName: "Art",
          componentName: "Main",
          passMarks: null,
          marks: [{ entryStatus: "PRESENT", marksObtained: new Prisma.Decimal(10) }],
          events: []
        }
      ] },
      examCycle: { findMany: async () => [
        { examCode: "QA17B-REPORT", name: "QA Report", status: "APPROVED", _count: { assessments: 2 } },
        { examCode: "QA17B-GAP", name: "QA Gap", status: "CANCELLED", _count: { assessments: 0 } }
      ] },
      academicYearEnrollment: { count: async ({ where }: any) => where.section ? 6 : 2 }
    };
    const report = await buildExamReports(fake, { broad: true, staffLabel: null, targets: [], reason: null });
    expect(report.totals).toMatchObject({ exams: 2, assessments: 2, eligibleEntries: 8, entered: 6, missing: 2 });
    expect(report.configuration).toMatchObject({ complete: 1, incomplete: 1 });
    expect(report.resultDistribution).toEqual({ passed: 1, failed: 1, presentWithoutPassMarks: 1, absent: 1, exempt: 1, notApplicable: 1 });
    expect(report.rows[0]).toMatchObject({ average: "44.5", highest: "50", lowest: "39", passed: 1, failed: 1, correctionCount: 1 });
    expect(report.cancelled).toEqual([expect.objectContaining({ examCode: "QA17B-GAP", examStatus: "CANCELLED", assessmentStatus: "—" })]);

    const masked = await buildExamReports(fake, { broad: true, staffLabel: null, targets: [], reason: null }, {}, true);
    expect(masked.rows.every((row: any) => row.examCode === "Masked")).toBe(true);
    expect(masked.cancelled.every((row: any) => row.examCode === "Masked")).toBe(true);
  });

  it("uses the required explicit correction label and no native dialogs", () => {
    const source = readFileSync("components/mark-entry-grid.tsx", "utf8");
    expect(source).toContain("Apply Marks Correction");
    expect(source).not.toContain("Apply Audited Correction");
    expect(source).not.toMatch(/window\.(alert|confirm|prompt)/);
  });

  it("has no hard-delete route for exams, assessments, marks, or events", () => {
    for (const file of [
      "app/api/exams/route.ts",
      "app/api/exams/[id]/route.ts",
      "app/api/exams/[id]/assessments/route.ts",
      "app/api/exams/[id]/assessments/[assessmentId]/route.ts",
      "app/api/marks/entry/[assessmentId]/route.ts"
    ]) expect(readFileSync(file, "utf8")).not.toMatch(/export\s+async\s+function\s+DELETE/);
  });

  it("keeps Admin non-approving by default and Principal approval/lock documented in defaults", () => {
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("MANAGE_EXAMS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("APPROVE_MARKS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("LOCK_EXAMS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL.has("APPROVE_MARKS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL.has("LOCK_EXAMS")).toBe(true);
  });

  it("uses a formula-safe report filename", () => {
    expect(examReportsFilename(new Date("2026-07-16T12:00:00.000Z"))).toBe("exam-marks-report-2026-07-16.csv");
    expect(examReportsFilename()).toMatch(/^exam-marks-report-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
