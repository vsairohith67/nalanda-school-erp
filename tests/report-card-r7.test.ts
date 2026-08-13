import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  R5_IDENTITY_GRID_GEOMETRY,
  R6_MONOCHROME_STUDENT_GREY,
  R7_DETAIL_MONOCHROME_SWATCHES,
  R7_DETAIL_PAGES,
  R7_HEADER_TYPOGRAPHY,
  R7_PATTERN_GEOMETRY,
  R7_SIGNATURE_GEOMETRY,
  R7_SUMMARY_CARD_GEOMETRY,
  R7_VISUAL_PAGES,
  assertApprovedReportSchoolStatusForPublication,
  buildSyntheticAcademicSnapshot,
  renderR7DetailChecks,
  renderR7VisualPack,
  resolveReportSchoolIdentity,
  r7SummaryMetrics
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

describe("R7 measured header and frozen identity baseline", () => {
  it("uses exact 12 pt and 11 pt bold secondary header lines", () => {
    expect(R7_HEADER_TYPOGRAPHY).toEqual({ statusFontSizePt: 12, addressFontSizePt: 11, secondaryFontWeight: "BOLD" });
    expect(R5_IDENTITY_GRID_GEOMETRY.centreDividerX).toBe(R5_IDENTITY_GRID_GEOMETRY.left + R5_IDENTITY_GRID_GEOMETRY.width / 2);
    expect(R5_IDENTITY_GRID_GEOMETRY.columnWidth * 4).toBe(R5_IDENTITY_GRID_GEOMETRY.width);
  });

  it("fails publication closed when approved status wording is absent", () => {
    expect(assertApprovedReportSchoolStatusForPublication(identity)).toContain("CISCE");
    expect(() => assertApprovedReportSchoolStatusForPublication({ ...identity, affiliationWording: null })).toThrow(/publication blocked/i);
  });
});

describe("R7 result summary, attendance and signing geometry", () => {
  it("balances three, four and five enabled summary-card variants", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_II_SESSION", false);
    expect(r7SummaryMetrics(report).map((item) => item.label)).toEqual(["Total", "Percentage", "Grade", "Grade Point", "Rank"]);
    report.overall.rank = null;
    expect(r7SummaryMetrics(report)).toHaveLength(4);
    report.overall.gradePoint = null;
    expect(r7SummaryMetrics(report)).toHaveLength(3);
    expect(R7_SUMMARY_CARD_GEOMETRY.labelFontSizePt).toBeGreaterThanOrEqual(6.5);
    expect(R7_SUMMARY_CARD_GEOMETRY.valueFontSizePt).toBeGreaterThanOrEqual(8);
    expect(R7_SUMMARY_CARD_GEOMETRY.attendanceWidthRatio).toBeCloseTo(0.45, 2);
  });

  it("keeps signing clearance in the approved 10-13 mm range with print-safe lines", () => {
    const clearanceMm = R7_SIGNATURE_GEOMETRY.clearSigningHeightPt / 72 * 25.4;
    const lineToLabelMm = (R7_SIGNATURE_GEOMETRY.lineY - R7_SIGNATURE_GEOMETRY.labelY) / 72 * 25.4;
    const lineLengthMm = (R7_SIGNATURE_GEOMETRY.width / 4 - R7_SIGNATURE_GEOMETRY.linePaddingPt * 2) / 72 * 25.4;
    expect(clearanceMm).toBeGreaterThanOrEqual(10);
    expect(clearanceMm).toBeLessThanOrEqual(13);
    expect(lineToLabelMm).toBeGreaterThanOrEqual(4);
    expect(lineToLabelMm).toBeLessThanOrEqual(5);
    expect(lineLengthMm).toBeGreaterThanOrEqual(42);
    expect(lineLengthMm).toBeLessThanOrEqual(48);
  });
});

describe("R7 authoritative filled-diamond monochrome contract", () => {
  it("uses medium grey, spaced slashes and filled diamonds at governed measurements", async () => {
    expect(R6_MONOCHROME_STUDENT_GREY).toBeGreaterThanOrEqual(0.5);
    expect(R6_MONOCHROME_STUDENT_GREY).toBeLessThanOrEqual(0.6);
    expect(R7_PATTERN_GEOMETRY.slashSpacingPt / 72 * 25.4).toBeGreaterThanOrEqual(2.2);
    expect(R7_PATTERN_GEOMETRY.slashSpacingPt / 72 * 25.4).toBeLessThanOrEqual(2.8);
    expect(R7_PATTERN_GEOMETRY.slashStrokeWidthPt).toBeGreaterThanOrEqual(0.5);
    expect(R7_PATTERN_GEOMETRY.slashStrokeWidthPt).toBeLessThanOrEqual(0.7);
    expect(R7_PATTERN_GEOMETRY.diamondRadiusXPt * 2 / 72 * 25.4).toBeGreaterThanOrEqual(0.8);
    expect(R7_PATTERN_GEOMETRY.diamondRadiusXPt * 2 / 72 * 25.4).toBeLessThanOrEqual(1.1);
    const source = await readFile(path.resolve(process.cwd(), "lib", "report-card-refined-source-lock.ts"), "utf8");
    const r7PatternSource = source.slice(source.indexOf("if (version === \"R7\")"), source.indexOf("function chartSeries"));
    expect(r7PatternSource).toContain("drawSvgPath");
    expect(r7PatternSource).toContain("color: ink");
    expect(r7PatternSource).not.toContain("fill=\"none\"");
    expect(r7PatternSource).not.toContain("drawEllipse");
  });

  it("renders deterministic A4 R7 review packs with robust true-monochrome patterns", async () => {
    expect(R7_VISUAL_PAGES).toHaveLength(8);
    expect(R7_DETAIL_PAGES).toHaveLength(14);
    const visual = await renderR7VisualPack(identity);
    const detail = await renderR7DetailChecks(identity);
    expect(visual.equals(await renderR7VisualPack(identity))).toBe(true);
    expect(detail.equals(await renderR7DetailChecks(identity))).toBe(true);
    const [visualPdf, detailPdf] = await Promise.all([PDFDocument.load(visual), PDFDocument.load(detail)]);
    expect(visualPdf.getPageCount()).toBe(8);
    expect(detailPdf.getPageCount()).toBe(14);
    for (const page of [...visualPdf.getPages(), ...detailPdf.getPages()]) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
      expect(page.node.Contents()).toBeTruthy();
    }
    await expect(requireRenderedPdfWhiteBackground(visual, [1, 2, 3, 4, 5, 6, 7, 8])).resolves.toHaveLength(8);
    await expect(requireRenderedPdfWhiteBackground(detail, Array.from({ length: 14 }, (_, index) => index + 1))).resolves.toHaveLength(14);
    await expect(requireRenderedPdfPagesMonochrome(visual, [5, 6, 7, 8], 2)).resolves.toHaveLength(4);
    await expect(requireRenderedPdfPagesMonochrome(detail, [2, 9, 10, 11, 12], 2)).resolves.toHaveLength(5);
    const robustness = await inspectRenderedPatternSwatchRobustness(detail, R7_DETAIL_MONOCHROME_SWATCHES.page, R7_DETAIL_MONOCHROME_SWATCHES.boxes, 0.72);
    expect(robustness.maximumPairSimilarity).toBeLessThan(0.72);
    expect(robustness.darkPixelRatios.find((item) => item.series === "Student Marks")?.ratio).toBeGreaterThanOrEqual(0.75);
    expect(robustness.darkPixelRatios.find((item) => item.series === "Class Average")?.ratio).toBeGreaterThan(0.03);
    expect(robustness.darkPixelRatios.find((item) => item.series === "High Score")?.ratio).toBeGreaterThan(0.03);
  }, 240_000);
});
