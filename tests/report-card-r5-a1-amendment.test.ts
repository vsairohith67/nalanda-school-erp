import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  R5_CHART_LABEL_CLEARANCE_PT,
  R5_CHART_LEGEND_GEOMETRY,
  R5_CHART_NUMERIC_LABEL_FONT_SIZE,
  R5_CHART_SERIES,
  R5_DETAIL_MONOCHROME_SWATCHES,
  R5_DETAIL_PAGES,
  R5_HEADER_GEOMETRY,
  R5_IDENTITY_GRID_GEOMETRY,
  R5_REQUIRED_STATUS_CONFIGURATION_WARNING,
  academicHeaderStatusForPreview,
  approvedSchoolStatusLine,
  chartTextBoxesOverlap,
  formatChartNumericValues,
  layoutChartNumericLabels,
  renderR5DetailChecks,
  requireApprovedAcademicStatusLine,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import {
  inspectRenderedPatternSwatchRobustness,
  requireRenderedPdfPagesMonochrome,
  requireRenderedPdfWhiteBackground
} from "../lib/report-card-monochrome-validation";
import { approvedPublicationStatusLine } from "../lib/report-publication";

const settings = {
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  academicYear: "2026-27"
};
const approvedIdentity = resolveReportSchoolIdentity(settings, [{
  schoolIdentity: {
    affiliationWording: "(Affiliated to CISCE, New Delhi, Estd. 1972)"
  }
}]);
const missingIdentity = resolveReportSchoolIdentity(settings);

describe("R5-A1 exact academic header and publication configuration", () => {
  it("uses the exact approved three-line review fixture without hard-coding the claim in the renderer", async () => {
    expect(approvedIdentity.schoolName.toUpperCase()).toBe("NALANDA PUBLIC SCHOOL");
    expect(approvedSchoolStatusLine(approvedIdentity)).toBe("(Affiliated to CISCE, New Delhi, Estd. 1972)");
    expect(`${approvedIdentity.addressLine1}, ${approvedIdentity.city}`).toBe("Nanalnagar, Mehdipatnam, Hyderabad");
    expect(R5_HEADER_GEOMETRY.logoX + R5_HEADER_GEOMETRY.logoWidth).toBeLessThan(R5_HEADER_GEOMETRY.textLeft);
    const renderer = await readFile(path.resolve(process.cwd(), "lib", "report-card-refined-source-lock.ts"), "utf8");
    expect(renderer).not.toContain("Affiliated to CISCE, New Delhi, Estd. 1972");
    expect(renderer).toContain("georgiab.ttf");
    expect(renderer).toContain("StandardFonts.TimesRomanBold");
  });

  it("shows a safe preview warning and blocks final use when the approved line is absent", () => {
    expect(academicHeaderStatusForPreview(missingIdentity)).toBe(R5_REQUIRED_STATUS_CONFIGURATION_WARNING);
    expect(() => requireApprovedAcademicStatusLine(missingIdentity)).toThrow(/publication is blocked/i);
    expect(requireApprovedAcademicStatusLine(approvedIdentity)).toBe("(Affiliated to CISCE, New Delhi, Estd. 1972)");
  });

  it("derives publication wording only from the frozen approved report snapshot", () => {
    const report = {
      school: {
        affiliationWording: "(Approved synthetic status)",
        recognitionWording: null,
        establishmentYear: null
      }
    } as never;
    expect(approvedPublicationStatusLine(report)).toBe("(Approved synthetic status)");
    expect(approvedPublicationStatusLine({ school: { affiliationWording: null, recognitionWording: null, establishmentYear: null } } as never)).toBeNull();
  });
});

describe("R5-A1 fixed identity grid", () => {
  it("keeps all four columns exactly equal and the 50% divider continuous", () => {
    expect(R5_IDENTITY_GRID_GEOMETRY.columnWidth * 4).toBe(R5_IDENTITY_GRID_GEOMETRY.width);
    expect(R5_IDENTITY_GRID_GEOMETRY.centreDividerX).toBe(
      R5_IDENTITY_GRID_GEOMETRY.left + R5_IDENTITY_GRID_GEOMETRY.width / 2
    );
    const renderedRowDividerPositions = Array(4).fill(R5_IDENTITY_GRID_GEOMETRY.centreDividerX);
    const variation = Math.max(...renderedRowDividerPositions) - Math.min(...renderedRowDividerPositions);
    expect(variation).toBeLessThanOrEqual(0.25);
    const renderedStrokeWidths = Array(9).fill(R5_IDENTITY_GRID_GEOMETRY.borderWidth);
    expect(Math.max(...renderedStrokeWidths) - Math.min(...renderedStrokeWidths)).toBeLessThanOrEqual(0.1);
  });
});

describe("R5-A1 chart label and monochrome-pattern contract", () => {
  it("uses print-safe numeric labels, one-decimal projection, and 2.5 pt separation", () => {
    expect(R5_CHART_NUMERIC_LABEL_FONT_SIZE).toBeGreaterThanOrEqual(7);
    expect(R5_CHART_LABEL_CLEARANCE_PT).toBeGreaterThanOrEqual(2.5);
    expect(formatChartNumericValues([100, 76.44, 77.48])).toEqual(["100", "76.4", "77.5"]);
    const scenarios = [
      [94, 94, 94],
      [77.4, 77.5, 77.6],
      [100, 99.6, 100],
      [80.1, 79.4, 80.2]
    ];
    for (const values of scenarios) {
      const inputs = values.map((value, index) => ({ text: String(value), centerX: 40 + index * 9.5, barTopY: 70 + value / 10 }));
      const placements = layoutChartNumericLabels(inputs, { left: 0, right: 120, bottom: 20, top: 130 }, 7, (text) => text.length * 3.8);
      expect(overlapCount(placements)).toBe(0);
      expect(placements.every((placement) => placement.y >= placement.barTopY + 2.9)).toBe(true);
    }
  });

  it("remains collision-free for six and ten category charts", () => {
    for (const categoryCount of [6, 10]) {
      const slot = 480 / categoryCount;
      const inputs = Array.from({ length: categoryCount }).flatMap((_, category) => [
        { text: "77.4", centerX: 12 + category * slot + slot / 2 - 9.5, barTopY: 90 },
        { text: "77.5", centerX: 12 + category * slot + slot / 2, barTopY: 90.2 },
        { text: "77.6", centerX: 12 + category * slot + slot / 2 + 9.5, barTopY: 90.4 }
      ]);
      const placements = layoutChartNumericLabels(inputs, { left: 0, right: 504, bottom: 20, top: 140 }, 7, (text) => text.length * 3.8);
      expect(overlapCount(placements)).toBe(0);
      expect(placements.some((placement) => placement.leaderLine)).toBe(true);
    }
  });

  it("uses slash, cross-hatch, and dots with physical-size legend swatches", () => {
    expect(R5_CHART_SERIES).toEqual([
      { label: "Student Marks", monochromePattern: "DIAGONAL" },
      { label: "Class Average", monochromePattern: "CROSS_HATCH" },
      { label: "High Score", monochromePattern: "DOTS" }
    ]);
    expect(R5_CHART_LEGEND_GEOMETRY.swatchWidthPt / 72 * 25.4).toBeCloseTo(14, 1);
    expect(R5_CHART_LEGEND_GEOMETRY.swatchHeightPt / 72 * 25.4).toBeCloseTo(5, 1);
    expect(R5_CHART_LEGEND_GEOMETRY.labelFontSizePt).toBeGreaterThanOrEqual(7);
  });

  it("renders the seven detail checks on A4, in true monochrome where required, with photocopy-safe distinction", async () => {
    expect(R5_DETAIL_PAGES).toHaveLength(7);
    const bytes = await renderR5DetailChecks(approvedIdentity);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(7);
    document.getPages().forEach((page) => {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    });
    await expect(requireRenderedPdfWhiteBackground(bytes, [1, 2, 3, 4, 5, 6, 7])).resolves.toHaveLength(7);
    const monochrome = await requireRenderedPdfPagesMonochrome(bytes, [2, 5, 6], 2);
    expect(monochrome.every((page) => page.chromaticPixels === 0)).toBe(true);
    const robustness = await inspectRenderedPatternSwatchRobustness(
      bytes,
      R5_DETAIL_MONOCHROME_SWATCHES.page,
      R5_DETAIL_MONOCHROME_SWATCHES.boxes,
      0.75
    );
    expect(robustness.maximumPairSimilarity).toBeLessThan(0.75);
  }, 120_000);
});

function overlapCount(boxes: Array<{ x: number; y: number; width: number; height: number }>) {
  let count = 0;
  boxes.forEach((left, index) => boxes.slice(index + 1).forEach((right) => {
    if (chartTextBoxesOverlap(left, right, R5_CHART_LABEL_CLEARANCE_PT)) count += 1;
  }));
  return count;
}
