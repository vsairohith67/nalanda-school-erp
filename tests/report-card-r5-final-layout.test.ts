import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  ALTERNATE_GRADE_SCALE,
  FINAL_ACADEMIC_PAGE_SPECS,
  R4_MINIMUM_FONT_SIZES,
  R5_CHART_SERIES,
  R5_COSCHOLASTIC_LEGEND,
  R5_IDENTITY_LABELS,
  R5_MAX_PARENT_FACING_DECIMALS,
  R5_SIGNATURE_GEOMETRY,
  R5_VISUAL_PAGES,
  STANDARD_GRADE_SCALE,
  approvedSchoolStatusLine,
  balanceRowHeightTotals,
  buildFinalAcademicSnapshot,
  chartTextBoxesOverlap,
  displayedOverallPercentage,
  displayedOverallTotal,
  displayedSubjectTotalValue,
  formatChartNumericValues,
  formatParentFacingNumber,
  gradeForScale,
  gradeLegendForScale,
  layoutChartNumericLabels,
  renderR5EdgePack,
  renderR5VisualPack,
  resolveReportSchoolIdentity,
  validateDisplayedReportReconciliation
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
});

describe("R5 Classes I-X scope and structural parity", () => {
  it("contains only the ten approved academic review specimens and no KG page", () => {
    expect(R5_VISUAL_PAGES).toEqual([
      { specimenId: "I-II-SESSION", mode: "COLOUR" },
      { specimenId: "I-II-COMBINED", mode: "COLOUR" },
      { specimenId: "III-V-SESSION", mode: "COLOUR" },
      { specimenId: "VI-VIII-GROUPED", mode: "COLOUR" },
      { specimenId: "IX-X-COMBINED", mode: "COLOUR" },
      { specimenId: "IX-X-REVISION", mode: "COLOUR" },
      { specimenId: "I-II-SESSION", mode: "MONOCHROME" },
      { specimenId: "VI-VIII-GROUPED", mode: "MONOCHROME" },
      { specimenId: "IX-X-COMBINED", mode: "MONOCHROME" },
      { specimenId: "IX-X-REVISION", mode: "MONOCHROME" }
    ]);
    expect(R5_VISUAL_PAGES.every((page) => !page.specimenId.startsWith("KG"))).toBe(true);
  });

  it("renders exact A4 geometry and stable page counts for both review packs", async () => {
    const visual = await PDFDocument.load(await renderR5VisualPack(identity));
    const edge = await PDFDocument.load(await renderR5EdgePack(identity));
    expect(visual.getPageCount()).toBe(10);
    expect(edge.getPageCount()).toBe(6);
    for (const page of [...visual.getPages(), ...edge.getPages()]) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
      expect(page.getCropBox()).toMatchObject({ x: 0, y: 0 });
    }
  }, 30_000);

  it("uses identical physical signature geometry in both modes", () => {
    expect(R5_SIGNATURE_GEOMETRY.clearSigningHeightPt / 72 * 25.4).toBeCloseTo(18, 1);
    expect(R5_SIGNATURE_GEOMETRY.width / 4).toBeCloseTo(130.32, 1);
    expect(R5_SIGNATURE_GEOMETRY.lineY).toBeGreaterThan(R5_SIGNATURE_GEOMETRY.labelY);
    expect(R5_SIGNATURE_GEOMETRY.labelY).toBeGreaterThan(R5_SIGNATURE_GEOMETRY.footerY);
  });

  it("balances marks and co-scholastic table heights without filler", () => {
    const primary = balanceRowHeightTotals(Array(7).fill(18), Array(10).fill(18));
    const grouped = balanceRowHeightTotals(Array(15).fill(12), Array(10).fill(12));
    expect(sum(primary.left)).toBeCloseTo(sum(primary.right), 5);
    expect(sum(grouped.left)).toBeCloseTo(sum(grouped.right), 5);
    expect(primary.target).toBe(180);
    expect(grouped.target).toBe(180);
  });
});

describe("R5 header, identity, legend, and font contracts", () => {
  it("omits an absent school-status line and combines only configured approved wording", () => {
    expect(approvedSchoolStatusLine(identity)).toBeNull();
    const configured = resolveReportSchoolIdentity({
      schoolName: "Nalanda Public School",
      addressLine1: "Nanalnagar, Mehdipatnam",
      city: "Hyderabad",
      academicYear: "2026-27"
    }, [{ schoolIdentity: { recognitionWording: "Approved recognition wording", establishmentYear: "2004" } }]);
    expect(approvedSchoolStatusLine(configured)).toBe("Approved recognition wording  •  Established 2004");
  });

  it("uses the exact five identity labels with distinct Class/Section and Roll cells", () => {
    expect(R5_IDENTITY_LABELS).toEqual([
      "Student Name", "Parent / Guardian", "Admission No. #", "Class / Section", "Roll Number"
    ]);
    expect(R5_IDENTITY_LABELS).not.toContain("Admission Number");
  });

  it("uses one full-width G/S/N definition without awkward stacking", () => {
    expect(R5_COSCHOLASTIC_LEGEND).toBe("G — Good     S — Satisfactory     N — Needs Improvement");
    expect(R5_COSCHOLASTIC_LEGEND).not.toContain("Needs / Improvement");
    expect(R4_MINIMUM_FONT_SIZES.legend).toBeGreaterThanOrEqual(6.5);
    expect(R4_MINIMUM_FONT_SIZES.identityValue).toBeGreaterThanOrEqual(7);
  });

  it("contains no hard-coded affiliation claim or legacy identity label in the renderer", async () => {
    const source = await readFile(path.resolve(process.cwd(), "lib", "report-card-refined-source-lock.ts"), "utf8");
    expect(source).not.toMatch(/Affiliated to CBSE|CBSE Affiliation No/i);
    expect(source).not.toContain('"Admission Number"');
    expect(source).toContain("SYNTHETIC SAMPLE — NOT FOR ISSUE");
  });

  it("embeds Georgia Bold for the school name with approved embedded body fonts", async () => {
    const pdf = await renderR5VisualPack(identity);
    const source = pdf.toString("latin1");
    expect(source).toMatch(/\/BaseFont \/Georgia-Bold-/);
    expect(source).toMatch(/\/BaseFont \/ArialMT-/);
    expect(source).toMatch(/\/BaseFont \/Arial-BoldMT-/);
  }, 30_000);
});

describe("R5 deterministic one-decimal display projection", () => {
  it.each([
    [43.75, "43.8"],
    [82.75, "82.8"],
    [78.83, "78.8"],
    [484.07, "484.1"],
    [80.68, "80.7"],
    [7.25, "7.3"],
    [94, "94"]
  ])("formats %s as %s", (value, expected) => {
    expect(R5_MAX_PARENT_FACING_DECIMALS).toBe(1);
    expect(formatParentFacingNumber(value)).toBe(expected);
  });

  it("reconciles displayed components, subject totals, overall total, and percentage for every configured layout", () => {
    for (const specimen of FINAL_ACADEMIC_PAGE_SPECS) {
      const report = buildFinalAcademicSnapshot(specimen);
      expect(() => validateDisplayedReportReconciliation(report)).not.toThrow();
      const contributing = report.subjects.flatMap((subject) => {
        if (!subject.includeInOverall || subject.kind === "GRADE_ONLY") return [];
        const value = displayedSubjectTotalValue(subject, report);
        return value == null ? [] : [value];
      });
      expect(displayedOverallTotal(report)).toBeCloseTo(Number(sum(contributing).toFixed(1)), 5);
      expect(displayedOverallPercentage(report)).toBeCloseTo(Number((displayedOverallTotal(report) / report.overall.maximum * 100).toFixed(1)), 5);
    }
  });

  it("keeps Class IX 484.07 internal while displaying a reconciled 484.1 and 80.7%", () => {
    const report = buildFinalAcademicSnapshot(FINAL_ACADEMIC_PAGE_SPECS.find((page) => page.specimenId === "IX-X-COMBINED")!);
    expect(report.overall.value).toBe(484.07);
    expect(displayedOverallTotal(report)).toBe(484.1);
    expect(displayedOverallPercentage(report)).toBe(80.7);
    expect(formatParentFacingNumber(report.overall.gradePoint!)).toBe("7.3");
  });
});

describe("R5 exact grade legend and chart legibility", () => {
  it("derives concise non-overlapping bands from the frozen scale thresholds", () => {
    expect(gradeLegendForScale(STANDARD_GRADE_SCALE)).toEqual([
      { range: "91–100", grade: "A1" },
      { range: "81–<91", grade: "A2" },
      { range: "71–<81", grade: "B1" },
      { range: "61–<71", grade: "B2" },
      { range: "51–<61", grade: "C1" },
      { range: "41–<51", grade: "C2" },
      { range: "35–<41", grade: "D" },
      { range: "0–<35", grade: "E" }
    ]);
    expect(gradeLegendForScale(ALTERNATE_GRADE_SCALE)[1]).toEqual({ range: "80–<90", grade: "A" });
    expect(gradeForScale(90.999999, STANDARD_GRADE_SCALE)).toBe("A2");
    expect(gradeForScale(91, STANDARD_GRADE_SCALE)).toBe("A1");
  });

  it("uses solid, diagonal, and cross-hatch monochrome series", () => {
    expect(R5_CHART_SERIES).toEqual([
      { label: "Student Marks", monochromePattern: "SOLID" },
      { label: "Class Average", monochromePattern: "DIAGONAL" },
      { label: "High Score", monochromePattern: "CROSS_HATCH" }
    ]);
  });

  it("keeps close values to one decimal and collision-free in colour and monochrome", () => {
    const text = formatChartNumericValues([77.43, 77.44, 77.48]);
    expect(text).toEqual(["77.4", "77.4", "77.5"]);
    for (const mode of ["COLOUR", "MONOCHROME"] as const) {
      const placements = layoutChartNumericLabels(
        text.map((value, index) => ({ text: value, centerX: 40 + index * 6, barTopY: 90 + index * 0.1 })),
        { left: 0, right: 100, bottom: 20, top: 120 },
        6,
        (value) => value.length * 3.1
      );
      expect(pairwiseOverlapCount(placements), mode).toBe(0);
    }
  });
});

describe("R5 rendered colour and true-monochrome evidence", () => {
  it("paints every configured canvas/background sample pure white", async () => {
    const visual = await renderR5VisualPack(identity);
    const edge = await renderR5EdgePack(identity);
    expect(await requireRenderedPdfWhiteBackground(visual, Array.from({ length: 10 }, (_, index) => index + 1))).toHaveLength(10);
    expect(await requireRenderedPdfWhiteBackground(edge, Array.from({ length: 6 }, (_, index) => index + 1))).toHaveLength(6);
  }, 90_000);

  it("keeps every R5 monochrome specimen truly neutral", async () => {
    const visual = await renderR5VisualPack(identity);
    const edge = await renderR5EdgePack(identity);
    const visualChecks = await requireRenderedPdfPagesMonochrome(visual, [7, 8, 9, 10], 2);
    const edgeChecks = await requireRenderedPdfPagesMonochrome(edge, [5, 6], 2);
    expect([...visualChecks, ...edgeChecks].every((check) => check.chromaticPixels === 0)).toBe(true);
  }, 90_000);
});

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function pairwiseOverlapCount(boxes: Array<{ x: number; y: number; width: number; height: number }>) {
  let count = 0;
  boxes.forEach((left, leftIndex) => boxes.slice(leftIndex + 1).forEach((right) => {
    if (chartTextBoxesOverlap(left, right)) count += 1;
  }));
  return count;
}
