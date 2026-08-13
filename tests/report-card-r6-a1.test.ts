import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  R5_IDENTITY_GRID_GEOMETRY,
  R5_SIGNATURE_GEOMETRY,
  R6_CHART_LEGEND_GEOMETRY,
  R6_CHART_SERIES,
  R6_DENSE_CHART_GEOMETRY,
  R6_DETAIL_MONOCHROME_SWATCHES,
  R6_DETAIL_PAGES,
  R6_HEADER_TYPOGRAPHY,
  R6_MONOCHROME_STUDENT_GREY,
  R6_PATTERN_GEOMETRY,
  R6_VISUAL_PAGES,
  chartTextBoxesOverlap,
  layoutChartNumericLabels,
  renderR6DetailChecks,
  renderR6VisualPack,
  resolveR6AcademicChartLayout,
  resolveReportSchoolIdentity,
  wrapR6HeaderText,
  type ChartPointSnapshot
} from "../lib/report-card-refined-source-lock";
import {
  inspectRenderedPatternSwatchRobustness,
  requireRenderedPdfPagesMonochrome,
  requireRenderedPdfWhiteBackground
} from "../lib/report-card-monochrome-validation";

const identity = resolveReportSchoolIdentity({
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  academicYear: "2026-27"
}, [{ schoolIdentity: { affiliationWording: "(Affiliated to CISCE, New Delhi, Estd. 1972)" } }]);

describe("R6 header emphasis and frozen geometry", () => {
  it("uses print-safe bold secondary lines without changing the approved identity grid", () => {
    expect(R6_HEADER_TYPOGRAPHY).toEqual({
      statusFontSizePt: 9.2,
      addressFontSizePt: 9.8,
      secondaryFontWeight: "BOLD"
    });
    expect(R5_IDENTITY_GRID_GEOMETRY.columnWidth * 4).toBe(R5_IDENTITY_GRID_GEOMETRY.width);
    expect(R5_IDENTITY_GRID_GEOMETRY.centreDividerX).toBe(R5_IDENTITY_GRID_GEOMETRY.left + R5_IDENTITY_GRID_GEOMETRY.width / 2);
    expect(R5_SIGNATURE_GEOMETRY.clearSigningHeightPt / 72 * 25.4).toBeCloseTo(18, 1);
  });

  it("wraps long configured status and address wording without inventing an affiliation claim", async () => {
    const measure = (value: string) => value.length * 4.7;
    const status = wrapR6HeaderText("(Affiliated to the Council for the Indian School Certificate Examinations, New Delhi, Estd. 1972)", 390, measure, 2);
    const address = wrapR6HeaderText("Nanalnagar, Mehdipatnam, Hyderabad, Telangana", 390, measure, 2);
    expect(status.join(" ")).toContain("Certificate Examinations");
    expect(status).toHaveLength(2);
    expect(address.join(" ")).toBe("Nanalnagar, Mehdipatnam, Hyderabad, Telangana");
    const source = await readFile(path.resolve(process.cwd(), "lib", "report-card-refined-source-lock.ts"), "utf8");
    expect(source).not.toContain("Affiliated to CISCE, New Delhi, Estd. 1972");
    expect(source).toContain("georgiab.ttf");
  });
});

describe("R6-A1 authoritative monochrome chart contract", () => {
  it("uses solid grey, diagonal slashes, and diamond lattice in the required series order", () => {
    expect(R6_CHART_SERIES).toEqual([
      { label: "Student Marks", monochromePattern: "SOLID_GREY" },
      { label: "Class Average", monochromePattern: "DIAGONAL" },
      { label: "High Score", monochromePattern: "DIAMOND_LATTICE" }
    ]);
    expect(R6_MONOCHROME_STUDENT_GREY).toBeGreaterThanOrEqual(0.5);
    expect(R6_MONOCHROME_STUDENT_GREY).toBeLessThanOrEqual(0.6);
    expect(R6_PATTERN_GEOMETRY.slashStrokeWidthPt).toBeGreaterThanOrEqual(0.5);
    expect(R6_PATTERN_GEOMETRY.diamondHorizontalSpacingPt).toBeGreaterThan(R6_PATTERN_GEOMETRY.diamondRadiusXPt * 2);
    expect(R6_CHART_LEGEND_GEOMETRY.normal.swatchWidthPt / 72 * 25.4).toBeCloseTo(14, 1);
    expect(R6_CHART_LEGEND_GEOMETRY.normal.swatchHeightPt / 72 * 25.4).toBeCloseTo(5, 1);
    expect(R6_CHART_LEGEND_GEOMETRY.normal.labelFontSizePt).toBeGreaterThanOrEqual(7);
    expect(R6_CHART_LEGEND_GEOMETRY.dense.labelFontSizePt).toBeGreaterThanOrEqual(6.5);
  });

  it("retains 7 pt collision-free numeric labels for close, equal and maximum values", () => {
    const scenarios = [[77.4, 77.5, 77.6], [94, 94, 94], [99.6, 100, 100]];
    for (const values of scenarios) {
      const inputs = values.map((value, index) => ({
        text: Number.isInteger(value) ? String(value) : value.toFixed(1),
        centerX: 40 + index * 9.5,
        barTopY: 70 + value / 10
      }));
      const labels = layoutChartNumericLabels(inputs, { left: 0, right: 120, bottom: 20, top: 130 }, 7, (text) => text.length * 3.8);
      expect(labels.every((label) => label.y >= label.barTopY + 2.9)).toBe(true);
      expect(overlapCount(labels)).toBe(0);
    }
  });
});

describe("R6 adaptive dense chart and evidence packs", () => {
  it("selects normal, dense one-row, and two-row layouts deterministically", () => {
    const measure = (value: string) => value.length * 3.1;
    expect(resolveR6AcademicChartLayout(points(6), 500, measure)).toMatchObject({ mode: "NORMAL_ACADEMIC_CHART", rows: 1 });
    expect(resolveR6AcademicChartLayout(points(8), 500, measure)).toMatchObject({ mode: "DENSE_ACADEMIC_CHART", rows: 1 });
    const ten = resolveR6AcademicChartLayout(points(10), 500, measure);
    expect(ten).toMatchObject({ mode: "DENSE_ACADEMIC_CHART", rows: 2, compactGradeLegend: true });
    expect(ten.categoryRows.map((row) => row.length)).toEqual([5, 5]);
    expect(R6_DENSE_CHART_GEOMETRY.numericLabelFontSizePt).toBeGreaterThanOrEqual(7);
    expect(R6_DENSE_CHART_GEOMETRY.subjectLabelFontSizePt).toBeGreaterThanOrEqual(6);
    expect(R6_DENSE_CHART_GEOMETRY.compactGradeLegendFontSizePt).toBeGreaterThanOrEqual(6);
  });

  it("renders the required 8-page visual and 12-page detail packs as deterministic A4 PDFs", async () => {
    expect(R6_VISUAL_PAGES).toHaveLength(8);
    expect(R6_DETAIL_PAGES).toHaveLength(12);
    const [visual, visualRepeat, detail, detailRepeat] = await Promise.all([
      renderR6VisualPack(identity), renderR6VisualPack(identity), renderR6DetailChecks(identity), renderR6DetailChecks(identity)
    ]);
    expect(visual.equals(visualRepeat)).toBe(true);
    expect(detail.equals(detailRepeat)).toBe(true);
    const visualPdf = await PDFDocument.load(visual);
    const detailPdf = await PDFDocument.load(detail);
    expect(visualPdf.getPageCount()).toBe(8);
    expect(detailPdf.getPageCount()).toBe(12);
    for (const page of [...visualPdf.getPages(), ...detailPdf.getPages()]) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
    await expect(requireRenderedPdfWhiteBackground(visual, [1, 2, 3, 4, 5, 6, 7, 8])).resolves.toHaveLength(8);
    await expect(requireRenderedPdfWhiteBackground(detail, Array.from({ length: 12 }, (_, index) => index + 1))).resolves.toHaveLength(12);
    await expect(requireRenderedPdfPagesMonochrome(visual, [5, 6, 7, 8], 2)).resolves.toHaveLength(4);
    await expect(requireRenderedPdfPagesMonochrome(detail, [2, 5, 6], 2)).resolves.toHaveLength(3);
    const robustness = await inspectRenderedPatternSwatchRobustness(detail, R6_DETAIL_MONOCHROME_SWATCHES.page, R6_DETAIL_MONOCHROME_SWATCHES.boxes, 0.72);
    expect(robustness.maximumPairSimilarity).toBeLessThan(0.72);
    expect(robustness.darkPixelRatios.find((item) => item.series === "Student Marks")?.ratio).toBeGreaterThanOrEqual(0.75);
    expect(robustness.darkPixelRatios.find((item) => item.series === "Class Average")?.ratio).toBeGreaterThan(0.03);
    expect(robustness.darkPixelRatios.find((item) => item.series === "High Score")?.ratio).toBeGreaterThan(0.03);
  }, 180_000);
});

function points(count: number): ChartPointSnapshot[] {
  return Array.from({ length: count }, (_, index) => ({
    subjectKey: `subject-${index + 1}`,
    subjectLabel: index === count - 1 && count >= 8 ? "Computer Applications and Information Technology" : `Subject ${index + 1}`,
    chartDisplayLabel: index === count - 1 && count >= 8 ? { value: "Computer Applications", configurationVersion: 1 } : null,
    studentPercentage: 77.5,
    classAveragePercentage: 76.8,
    highScorePercentage: 94,
    classSnapshotId: "SYNTHETIC-CLASS-SNAPSHOT"
  }));
}

function overlapCount(boxes: Array<{ x: number; y: number; width: number; height: number }>) {
  let count = 0;
  boxes.forEach((left, index) => boxes.slice(index + 1).forEach((right) => {
    if (chartTextBoxesOverlap(left, right, 2.5)) count += 1;
  }));
  return count;
}
