import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  chartTextBoxesOverlap,
  formatChartNumericValues,
  layoutChartNumericLabels,
  renderRefinedSourceLockedPage,
  resolveChartCategoryLayout,
  resolveChartDisplayText,
  wrapCompleteChartLabel,
  type ChartPointSnapshot
} from "../lib/report-card-refined-source-lock";

const measure = (value: string) => Array.from(value).length;

describe("R4.2 complete chart-label contract", () => {
  it("preserves ordinary, paper, computer, and multilingual labels without hidden word loss", () => {
    const labels = [
      "Mathematics",
      "English Paper 1",
      "English Paper 2",
      "Computer Applications and Information Technology",
      "Hindi हिन्दी पर्यावरण"
    ];
    for (const label of labels) {
      const wrapped = wrapCompleteChartLabel(label, 25, measure, 3);
      expect(wrapped.complete).toBe(true);
      expect(wrapped.lines.length).toBeLessThanOrEqual(3);
      expect(wrapped.lines.join(" ")).toBe(label);
    }
  });

  it("wraps the complete long Mathematics label over exactly three lines", () => {
    const label = "Mathematics with Advanced Applications and Projects";
    const wrapped = wrapCompleteChartLabel(label, 24, measure, 3);
    expect(wrapped).toMatchObject({ complete: true, sourceText: label });
    expect(wrapped.lines).toEqual([
      "Mathematics with",
      "Advanced Applications",
      "and Projects"
    ]);
    expect(wrapped.lines.join(" ")).toBe(label);
  });

  it("uses only a positive-version configured chartDisplayLabel", () => {
    const configured = point("Computer Applications and Information Technology", {
      value: "Computer Applications",
      configurationVersion: 4
    });
    expect(resolveChartDisplayText(configured)).toBe("Computer Applications");
    expect(() => resolveChartDisplayText(point("Computer Applications", {
      value: "Computers",
      configurationVersion: 0
    }))).toThrow(/positive version/i);
  });

  it("omits a category with a visible-scope outcome when three complete lines cannot fit", () => {
    const ordinary = point("English", null, "english");
    const tooLong = point("Mathematics with Advanced Applications and Projects", null, "math");
    const result = resolveChartCategoryLayout([ordinary, tooLong], 28, measure, 3);
    expect(result.categories.map((item) => item.point.subjectKey)).toEqual(["english"]);
    expect(result.omitted.map((item) => item.subjectLabel)).toEqual([
      "Mathematics with Advanced Applications and Projects"
    ]);
  });

  it("rejects ellipses instead of silently discarding chart-label words", () => {
    expect(() => resolveChartDisplayText(point("Internal Ass..."))).toThrow(/ellipses/i);
    expect(() => wrapCompleteChartLabel("Computer…", 30, measure, 3)).toThrow(/ellipses/i);
  });
});

describe("R4.2 collision-safe chart values", () => {
  it("uses print-friendly decimals without unnecessary trailing zeroes", () => {
    expect(formatChartNumericValues([94, 76.4, 77.48])).toEqual(["94", "76.4", "77.5"]);
    expect(formatChartNumericValues([77.43, 77.44, 100])).toEqual(["77.4", "77.4", "100"]);
  });

  it("stagger-places nearly equal, equal-high, decimal, and 100 labels without collisions", () => {
    const inputs = [
      { text: "77.44", centerX: 40, barTopY: 91 },
      { text: "77.48", centerX: 46, barTopY: 91.1 },
      { text: "77.5", centerX: 52, barTopY: 91.2 },
      { text: "94", centerX: 92, barTopY: 108 },
      { text: "94", centerX: 98, barTopY: 108 },
      { text: "100", centerX: 144, barTopY: 119 }
    ];
    const bounds = { left: 0, right: 180, bottom: 20, top: 120 };
    const placements = layoutChartNumericLabels(inputs, bounds, 6, (text) => text.length * 3.2);
    expect(placements).toHaveLength(inputs.length);
    for (const placement of placements) {
      expect(placement.x).toBeGreaterThanOrEqual(bounds.left);
      expect(placement.x + placement.width).toBeLessThanOrEqual(bounds.right);
      expect(placement.y).toBeGreaterThanOrEqual(bounds.bottom);
      expect(placement.y + placement.height).toBeLessThanOrEqual(bounds.top);
    }
    expect(pairwiseOverlapCount(placements)).toBe(0);
  });

  it("supports a narrow ten-category Class IX chart in colour and monochrome geometry", () => {
    const inputs = Array.from({ length: 10 }, (_, category) =>
      [76.4, 77.48, category === 9 ? 100 : 94].map((value, series) => ({
        text: formatChartNumericValues([76.4, 77.48, category === 9 ? 100 : 94])[series],
        centerX: 15 + category * 38 + series * 6,
        barTopY: 30 + value
      }))
    ).flat();
    for (const mode of ["COLOUR", "MONOCHROME"] as const) {
      const placements = layoutChartNumericLabels(inputs, { left: 0, right: 400, bottom: 20, top: 135 }, 6, (text) => text.length * 3.1);
      expect(pairwiseOverlapCount(placements), mode).toBe(0);
    }
  });

  it("renders the corrected dense chart as one valid A4 page in both modes", async () => {
    for (const mode of ["COLOUR", "MONOCHROME"] as const) {
      const bytes = await renderRefinedSourceLockedPage("CLASS_IX_COMBINED", mode, true);
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBe(1);
      expect(document.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
      expect(document.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
    }
  }, 20_000);
});

function point(
  subjectLabel: string,
  chartDisplayLabel: ChartPointSnapshot["chartDisplayLabel"] = null,
  subjectKey = "subject"
): ChartPointSnapshot {
  return {
    subjectKey,
    subjectLabel,
    chartDisplayLabel,
    studentPercentage: 77.48,
    classAveragePercentage: 76.4,
    highScorePercentage: 94,
    classSnapshotId: "SYNTHETIC-CLASS-SNAPSHOT"
  };
}

function pairwiseOverlapCount(boxes: Array<{ x: number; y: number; width: number; height: number }>) {
  let count = 0;
  boxes.forEach((left, leftIndex) => boxes.slice(leftIndex + 1).forEach((right) => {
    if (chartTextBoxesOverlap(left, right)) count += 1;
  }));
  return count;
}
