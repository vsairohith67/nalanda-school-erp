import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  buildChartPointsFromCohort,
  buildSyntheticAcademicSnapshot,
  buildSyntheticCohortRecords,
  calculateCohortStatistics,
  calculateSubjectGroupResult,
  GROUP_RESULT_NOTE,
  renderR41EdgePack,
  renderR41VisualPack,
  renderRefinedSourceLockedPage,
  resolveReportSchoolIdentity,
  selectChartSubjects,
  SYNTHETIC_GROUP_FORMULA,
  validateAcademicReportSnapshot,
  type AcademicReportSnapshot,
  type CohortResultRecord,
  type CombinedMarksSubject,
  type SubjectGroupFormulaSnapshot,
  type SubjectGroupMemberResult
} from "../lib/report-card-refined-source-lock";
import {
  inspectRgbPixels,
  requireRenderedPdfPagesMonochrome
} from "../lib/report-card-monochrome-validation";

const identity = resolveReportSchoolIdentity({
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  academicYear: "2026-27"
});

describe("R4.1 configured subject-group formulas", () => {
  it("derives every Class IX Average row from its visible members", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED");
    const groups = report.subjects.filter(
      (subject): subject is CombinedMarksSubject => subject.kind === "COMBINED" && subject.groupFormula != null
    );
    expect(groups.map((group) => group.label)).toEqual([
      "English Average",
      "Science Average",
      "Social Average"
    ]);
    for (const group of groups) {
      const members = group.aggregateOf.map((key) => {
        const member = report.subjects.find((subject) => subject.key === key);
        if (!member || member.kind !== "COMBINED") throw new Error("Group member missing.");
        return member;
      });
      expect(group.total.value).toBe(round2(mean(members.map((member) => member.total.value))));
      expect(group.total.maximum).toBe(round2(mean(members.map((member) => member.total.maximum))));
      for (const field of [
        "ct1", "ia1", "ct2", "ia2", "ct3", "ia3", "ctWeighted",
        "terminalRaw", "terminalWeighted", "annualRaw", "annualWeighted", "gradePoint"
      ] as const) {
        expect(group.combined[field]).toBe(round2(mean(members.map((member) => member.combined[field]))));
      }
    }
  });

  it("reconciles the corrected Class IX display, summary, grade point, and rank basis", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED");
    expect(report.overall).toMatchObject({
      value: 484.07,
      maximum: 600,
      percentage: 80.68,
      grade: "B1",
      gradePoint: 7.25,
      rankBasisPercentage: 80.68
    });
    expect(() => validateAcademicReportSnapshot(report)).not.toThrow();
  });

  it("applies the frozen state and zero handling instead of inventing group values", () => {
    const members = new Map<string, SubjectGroupMemberResult>([
      ["zero", { key: "zero", maximum: 100, value: 0, state: "PRESENT" }],
      ["present", { key: "present", maximum: 100, value: 80, state: "PRESENT" }],
      ["absent", { key: "absent", maximum: 100, value: null, state: "ABSENT" }],
      ["exempt", { key: "exempt", maximum: 100, value: null, state: "EXEMPT" }],
      ["na", { key: "na", maximum: 100, value: null, state: "NOT_APPLICABLE" }],
      ["ne", { key: "ne", maximum: 100, value: null, state: "NOT_ENTERED" }]
    ]);
    expect(calculateSubjectGroupResult(SYNTHETIC_GROUP_FORMULA, ["zero", "present"], members)).toMatchObject({ value: 40, state: "PRESENT" });
    expect(calculateSubjectGroupResult(SYNTHETIC_GROUP_FORMULA, ["present", "absent"], members)).toMatchObject({ value: 40, state: "PRESENT" });
    expect(calculateSubjectGroupResult(SYNTHETIC_GROUP_FORMULA, ["present", "exempt", "na"], members)).toMatchObject({ value: 80, state: "PRESENT" });
    expect(calculateSubjectGroupResult(SYNTHETIC_GROUP_FORMULA, ["present", "ne"], members)).toMatchObject({ value: null, state: "NOT_ENTERED" });
    expect(calculateSubjectGroupResult(SYNTHETIC_GROUP_FORMULA, ["present", "missing"], members)).toMatchObject({ value: null, state: "NOT_ENTERED" });
  });

  it("supports a configured weighted group result with an accurate label", () => {
    const formula: SubjectGroupFormulaSnapshot = {
      ...SYNTHETIC_GROUP_FORMULA,
      kind: "WEIGHTED_MEAN",
      label: "Weighted Group Result",
      memberWeights: { paper1: 1, paper2: 3 }
    };
    const result = calculateSubjectGroupResult(formula, ["paper1", "paper2"], new Map([
      ["paper1", { key: "paper1", maximum: 100, value: 40, state: "PRESENT" as const }],
      ["paper2", { key: "paper2", maximum: 100, value: 80, state: "PRESENT" as const }]
    ]));
    expect(formula.label).toBe("Weighted Group Result");
    expect(result.value).toBe(70);
  });

  it("uses the approved plain-language note only when grouped rows exist", () => {
    expect(GROUP_RESULT_NOTE).toBe("Shaded group-result rows are used in the overall total. Individual papers are shown for detailed reference.");
    expect(buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED").subjects.some((subject) => subject.aggregateOf.length > 0)).toBe(true);
    expect(buildSyntheticAcademicSnapshot("CLASS_II_SESSION").subjects.some((subject) => subject.aggregateOf.length > 0)).toBe(false);
  });
});

describe("R4.1 cohort and chart invariants", () => {
  it("calculates below-high, equal-high, maximum, one-Student, and decimal cohorts", () => {
    expect(stats([72, 91])?.highScorePercentage).toBe(91);
    expect(stats([91, 91])?.highScorePercentage).toBe(91);
    expect(stats([100, 78])?.highScorePercentage).toBe(100);
    expect(stats([83.25])).toEqual({ classAveragePercentage: 83.25, highScorePercentage: 83.25, validRecordCount: 1 });
    expect(stats([72.35, 80.15])).toEqual({ classAveragePercentage: 76.25, highScorePercentage: 80.15, validRecordCount: 2 });
  });

  it("excludes absent and not-entered records and returns unavailable for no valid cohort", () => {
    const records: CohortResultRecord[] = [
      cohort("valid", 82, "PRESENT"),
      cohort("absent", null, "ABSENT"),
      cohort("not-entered", null, "NOT_ENTERED")
    ];
    expect(calculateCohortStatistics("subject", records)).toEqual({ classAveragePercentage: 82, highScorePercentage: 82, validRecordCount: 1 });
    expect(calculateCohortStatistics("subject", records.slice(1))).toBeNull();
  });

  it("keeps every Class X Student value at or below its cohort high score", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION");
    for (const point of report.chartPoints) {
      expect(point.studentPercentage).toBeGreaterThanOrEqual(0);
      expect(point.studentPercentage).toBeLessThanOrEqual(point.highScorePercentage);
      expect(point.classAveragePercentage).toBeLessThanOrEqual(point.highScorePercentage);
      expect(point.highScorePercentage).toBeLessThanOrEqual(100);
    }
    for (const key of ["biology", "computer"]) {
      const point = report.chartPoints.find((candidate) => candidate.subjectKey === key);
      expect(point?.highScorePercentage).toBeGreaterThanOrEqual(point?.studentPercentage ?? 101);
    }
  });

  it("builds leaf and grouped chart snapshots from their matching cohort datasets", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED");
    const leafCohort = buildSyntheticCohortRecords(report.subjects, "LEGACY_LEAF_SUBJECTS");
    const leaf = buildChartPointsFromCohort(report.subjects, "LEGACY_LEAF_SUBJECTS", report.classSnapshotId, leafCohort);
    expect(leaf.some((point) => point.subjectLabel.endsWith("Average"))).toBe(false);
    const groupCohort = buildSyntheticCohortRecords(report.subjects, "GROUP_SUMMARY");
    const grouped = buildChartPointsFromCohort(report.subjects, "GROUP_SUMMARY", report.classSnapshotId, groupCohort);
    expect(grouped.some((point) => point.subjectLabel === "Science Average")).toBe(true);
    expect(grouped.some((point) => point.subjectLabel === "Physics")).toBe(false);
    expect(selectChartSubjects(report.subjects, "GROUP_SUMMARY")).toHaveLength(grouped.length);
  });

  it("rejects a chart where the Student exceeds the cohort high score", () => {
    const report = structuredClone(buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION")) as AcademicReportSnapshot;
    report.chartPoints[0].highScorePercentage = report.chartPoints[0].studentPercentage - 0.01;
    report.subjects.find((subject) => subject.key === report.chartPoints[0].subjectKey)!.highScorePercentage = report.chartPoints[0].highScorePercentage;
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/comparison values are invalid/i);
  });
});

describe("R4.1 true monochrome and micro-packs", () => {
  it("preserves official-logo dimensions when deriving grayscale", async () => {
    const source = await readFile(path.resolve(process.cwd(), "public", "nalanda-logo-transparent.png"));
    const original = await sharp(source).metadata();
    const grayscale = await sharp(await sharp(source).grayscale().png().toBuffer()).metadata();
    expect({ width: grayscale.width, height: grayscale.height }).toEqual({ width: original.width, height: original.height });
  });

  it("renders only four A4 pages in each R4.1 review pack", async () => {
    for (const bytes of [await renderR41VisualPack(identity), await renderR41EdgePack(identity)]) {
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBe(4);
      for (const page of document.getPages()) {
        expect(page.getWidth()).toBeCloseTo(595.28, 1);
        expect(page.getHeight()).toBeCloseTo(841.89, 1);
      }
    }
  }, 60_000);

  it("finds chromatic pixels while accepting antialiased grayscale tolerance", () => {
    expect(inspectRgbPixels(Uint8Array.from([40, 41, 40, 100, 100, 100]), 3, 2).chromaticPixels).toBe(0);
    expect(inspectRgbPixels(Uint8Array.from([20, 80, 20]), 3, 2).chromaticPixels).toBe(1);
  });

  it("raster-inspects every R4.1 monochrome specimen as neutral grayscale", async () => {
    const classII = await renderRefinedSourceLockedPage("CLASS_II_SESSION", "MONOCHROME");
    const classIX = await renderRefinedSourceLockedPage("CLASS_IX_COMBINED", "MONOCHROME");
    for (const bytes of [classII, classIX]) {
      const inspection = await requireRenderedPdfPagesMonochrome(bytes, [1], 2);
      expect(inspection).toHaveLength(1);
      expect(inspection[0].chromaticPixels).toBe(0);
      expect(inspection[0].maximumChannelDifference).toBeLessThanOrEqual(2);
    }
  }, 30_000);
});

function cohort(studentKey: string, value: number | null, state: CohortResultRecord["state"]): CohortResultRecord {
  return { studentKey, subjectKey: "subject", maximum: 100, value, state };
}

function stats(values: number[]) {
  return calculateCohortStatistics("subject", values.map((value, index) => cohort("student-" + index, value, "PRESENT")));
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
