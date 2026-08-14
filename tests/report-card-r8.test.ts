import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  R8_CHART_GEOMETRY,
  R8_DETAIL_PAGES,
  R8_FINAL_REVIEW_PAGES,
  R8_PHYSICAL_SPECIMENS,
  R8_SIGNATURE_GEOMETRY,
  R8_SUMMARY_GEOMETRY,
  R8_TABLE_GEOMETRY,
  buildSyntheticAcademicSnapshot,
  r8ChartRowSlotHeight,
  r8SummaryMetrics,
  r8TraitGradeEntries,
  renderR8DetailChecks,
  renderR8FinalDigitalReview,
  renderR8PhysicalAcceptancePack,
  resolveR6AcademicChartLayout,
  resolveR8ChartLayout,
  resolveR8MarksTableLayout,
  resolveR8SummaryWidths,
  resolveReportSchoolIdentity,
  validateAcademicReportSnapshot
} from "../lib/report-card-refined-source-lock";
import {
  requireRenderedPdfPagesMonochrome,
  requireRenderedPdfWhiteBackground
} from "../lib/report-card-monochrome-validation";

const identity = resolveReportSchoolIdentity({
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  academicYear: "2026-27"
}, [{ schoolIdentity: { affiliationWording: "(Affiliated to CISCE, New Delhi, Estd. 1972)" } }]);

describe("R8 single-line dynamic result summary", () => {
  it("measures balanced three, four and five-cell variants without wrapping or hidden metrics", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_II_SESSION", false);
    for (const count of [5, 4, 3]) {
      const variant = structuredClone(report);
      if (count < 5) variant.overall.rank = null;
      if (count < 4) variant.overall.gradePoint = null;
      const metrics = r8SummaryMetrics(variant);
      expect(metrics).toHaveLength(count);
      expect(metrics.every((metric) => metric.text === `${metric.label}: ${metric.value}`)).toBe(true);
      const widths = resolveR8SummaryWidths(metrics, 521.28, (text) => text.length * 4.1);
      expect(widths).toHaveLength(count);
      expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(521.28, 6);
      metrics.forEach((metric, index) => expect(widths[index]).toBeGreaterThanOrEqual(metric.text.length * 4.1 + R8_SUMMARY_GEOMETRY.horizontalPaddingPt - 0.01));
    }
    expect(R8_SUMMARY_GEOMETRY.fontSizePt).toBeGreaterThanOrEqual(7.5);
    expect(R8_SUMMARY_GEOMETRY.attendanceWidthRatio).toBeGreaterThanOrEqual(0.42);
    expect(R8_SUMMARY_GEOMETRY.attendanceWidthRatio).toBeLessThanOrEqual(0.45);
  });
});

describe("R8 academic-table-first adaptive layout", () => {
  it("keeps primary normal and activates dense priority with one-cell personality grades for VI-X", () => {
    const primary = resolveR8MarksTableLayout(buildSyntheticAcademicSnapshot("CLASS_II_SESSION", false));
    const middleReport = buildSyntheticAcademicSnapshot("CLASS_VI_GROUPED", false);
    const middle = resolveR8MarksTableLayout(middleReport);
    const secondary = resolveR8MarksTableLayout(buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION", false));
    const combined = resolveR8MarksTableLayout(buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED", false));
    expect(primary.mode).toBe("NORMAL_MARKS_TABLE");
    expect(middle).toMatchObject({ mode: "DENSE_MARKS_TABLE_PRIORITY", combineTraitAndGrade: true, academicWidthRatio: 0.74 });
    expect(secondary).toMatchObject({ mode: "DENSE_MARKS_TABLE_PRIORITY", combineTraitAndGrade: true });
    expect(combined).toMatchObject({ mode: "DENSE_MARKS_TABLE_PRIORITY", combineTraitAndGrade: false });
    const entries = r8TraitGradeEntries(middleReport);
    expect(entries).toContainEqual({ canonicalTrait: "Dress and Cleanliness", grade: "G", displayText: "Dress and Cleanliness: G" });
    expect(entries.every((entry) => !entry.displayText.includes("\n"))).toBe(true);
    expect(R8_TABLE_GEOMETRY.primary.minimumRowHeightPt / 72 * 25.4).toBeGreaterThanOrEqual(5.2);
    expect(R8_TABLE_GEOMETRY.grouped.minimumRowHeightPt / 72 * 25.4).toBeGreaterThanOrEqual(4.69);
    expect(R8_TABLE_GEOMETRY.combined.minimumRowHeightPt / 72 * 25.4).toBeGreaterThanOrEqual(4.19);
  });

  it("uses normal, compact and compact-dense chart governance without sacrificing the two-row minimum", () => {
    for (const report of [
      buildSyntheticAcademicSnapshot("CLASS_II_SESSION", false),
      buildSyntheticAcademicSnapshot("CLASS_VI_GROUPED", false),
      buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED", false),
      buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION", false)
    ]) {
      const base = resolveR6AcademicChartLayout(report.chartPoints, 493.28, (text) => text.length * 3.2);
      const layout = resolveR8ChartLayout(report, resolveR8MarksTableLayout(report), base);
      if (report.classSection === "II-A") expect(layout.footprintMode).toBe("NORMAL_CHART");
      else expect(layout.footprintMode).toBe("COMPACT_DENSE_CHART");
      if (report.layout === "COMBINED") {
        expect(layout.rows).toBe(2);
        expect(r8ChartRowSlotHeight(207, layout)).toBeGreaterThanOrEqual(R8_CHART_GEOMETRY.minimumTwoRowSlotHeightPt);
      } else expect(layout.rows).toBe(1);
    }
  });
});

describe("R8 physical signing and governed report correctness", () => {
  it("reserves 15-16 mm for all four equal signing columns", () => {
    const clearanceMm = R8_SIGNATURE_GEOMETRY.clearSigningHeightPt / 72 * 25.4;
    const lineToLabelMm = (R8_SIGNATURE_GEOMETRY.lineY - R8_SIGNATURE_GEOMETRY.labelY) / 72 * 25.4;
    expect(clearanceMm).toBeGreaterThanOrEqual(15);
    expect(clearanceMm).toBeLessThanOrEqual(16);
    expect(lineToLabelMm).toBeGreaterThanOrEqual(4);
    expect(lineToLabelMm).toBeLessThanOrEqual(5);
    expect(R8_SIGNATURE_GEOMETRY.width / 4).toBeCloseTo(130.32, 1);
  });

  it("preserves displayed-total, group-result and cohort invariants", () => {
    for (const kind of ["CLASS_II_SESSION", "CLASS_VI_GROUPED", "CLASS_IX_COMBINED", "CLASS_X_CT_REVISION"] as const) {
      expect(() => validateAcademicReportSnapshot(buildSyntheticAcademicSnapshot(kind, false))).not.toThrow();
    }
  });
});

describe("R8 deterministic review and paused physical packs", () => {
  it("renders exact A4 review/detail and Classes I-X-only colour/true-monochrome packs", async () => {
    expect(R8_FINAL_REVIEW_PAGES).toHaveLength(8);
    expect(R8_DETAIL_PAGES).toHaveLength(6);
    expect(R8_PHYSICAL_SPECIMENS).toHaveLength(8);
    expect(R8_PHYSICAL_SPECIMENS.every((item) => !item.classFamily.includes("KG"))).toBe(true);
    const [review, detail, colour, monochrome] = await Promise.all([
      renderR8FinalDigitalReview(identity),
      renderR8DetailChecks(identity),
      renderR8PhysicalAcceptancePack("COLOUR", identity),
      renderR8PhysicalAcceptancePack("MONOCHROME", identity)
    ]);
    const pdfs = await Promise.all([review, detail, colour, monochrome].map((bytes) => PDFDocument.load(bytes)));
    expect(pdfs.map((pdf) => pdf.getPageCount())).toEqual([8, 6, 8, 8]);
    for (const pdf of pdfs) for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
      expect(page.node.Contents()).toBeTruthy();
    }
    await expect(requireRenderedPdfWhiteBackground(review, [1, 2, 3, 4, 5, 6, 7, 8])).resolves.toHaveLength(8);
    await expect(requireRenderedPdfWhiteBackground(colour, [1, 2, 3, 4, 5, 6, 7, 8])).resolves.toHaveLength(8);
    await expect(requireRenderedPdfWhiteBackground(monochrome, [1, 2, 3, 4, 5, 6, 7, 8])).resolves.toHaveLength(8);
    await expect(requireRenderedPdfPagesMonochrome(review, [2, 4, 6, 8], 2)).resolves.toHaveLength(4);
    await expect(requireRenderedPdfPagesMonochrome(monochrome, [1, 2, 3, 4, 5, 6, 7, 8], 2)).resolves.toHaveLength(8);
    expect(review.equals(await renderR8FinalDigitalReview(identity))).toBe(true);
  }, 240_000);

  it("wires the production academic PDF path to R8 summary and 15 mm signing geometry", async () => {
    const source = await readFile(path.resolve(process.cwd(), "lib", "report-pdf.ts"), "utf8");
    expect(source).toContain("resolveR8SummaryWidths");
    expect(source).toContain("R8_SIGNATURE_GEOMETRY.clearSigningHeightPt");
    expect(source).toContain("`${metric.label}: ${metric.value}`");
    expect(source).not.toContain("R7_SIGNATURE_GEOMETRY.clearSigningHeightPt");
  });
});
