import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_LAYOUT_VARIANTS,
  CANONICAL_REPORT_TEMPLATE_FAMILIES,
  canonicalFamilyForClassName
} from "../lib/report-card-canonical-templates";
import {
  buildCanonicalReportCardTemplate,
  validatePrintSettings,
  validateTemplateDefinition
} from "../lib/report-card-templates";
import { syntheticReportSpecimens } from "../lib/report-card-synthetic-specimens";
import { renderReportPdf } from "../lib/report-pdf";

const source = (file: string) => readFileSync(file, "utf8");

describe("REPORT-PRINT-ACCEPT-1A canonical template policy", () => {
  it("defines the five canonical families and every governed variant", () => {
    expect(CANONICAL_REPORT_TEMPLATE_FAMILIES).toEqual([
      "KG_DEVELOPMENTAL_BOOKLET",
      "LOWER_PRIMARY_I_II",
      "UPPER_PRIMARY_III_V",
      "MIDDLE_VI_VIII_GROUPED",
      "SECONDARY_IX_X"
    ]);
    expect(CANONICAL_LAYOUT_VARIANTS).toMatchObject({
      KG_DEVELOPMENTAL_BOOKLET: ["DEVELOPMENTAL_BOOKLET"],
      LOWER_PRIMARY_I_II: ["CT", "SESSION", "COMBINED"],
      UPPER_PRIMARY_III_V: ["CT", "SESSION", "COMBINED"],
      MIDDLE_VI_VIII_GROUPED: ["CT", "SESSION", "COMBINED"],
      SECONDARY_IX_X: ["CT", "SESSION", "REVISION", "PREBOARD", "COMBINED"]
    });
  });

  it("maps KG through Class X without making a template active", () => {
    expect(canonicalFamilyForClassName("UKG")).toBe("KG_DEVELOPMENTAL_BOOKLET");
    expect(canonicalFamilyForClassName("II")).toBe("LOWER_PRIMARY_I_II");
    expect(canonicalFamilyForClassName("V")).toBe("UPPER_PRIMARY_III_V");
    expect(canonicalFamilyForClassName("VIII")).toBe("MIDDLE_VI_VIII_GROUPED");
    expect(canonicalFamilyForClassName("X")).toBe("SECONDARY_IX_X");
    expect(source("lib/report-card-canonical-templates.ts")).not.toContain("status: \"ACTIVE\"");
  });

  it("keeps calculations out of canonical template definitions", () => {
    for (const family of CANONICAL_REPORT_TEMPLATE_FAMILIES) {
      for (const variant of CANONICAL_LAYOUT_VARIANTS[family]) {
        const definition = buildCanonicalReportCardTemplate(family, variant, {
          combinedSourceApprovalReference: variant === "COMBINED" ? "SYNTHETIC-APPROVAL" : undefined
        });
        const serialized = JSON.stringify(definition).toLowerCase();
        expect(serialized).not.toContain("componentmax");
        expect(serialized).not.toContain("componentweight");
        expect(serialized).not.toContain("10+40");
        expect(serialized).not.toContain("20+80");
        expect(serialized).not.toContain("25+25");
        expect(validateTemplateDefinition(definition.type, definition)).toMatchObject({
          canonicalFamily: family,
          layoutVariant: variant,
          denominatorPolicy: "FROZEN_RESULT_SNAPSHOT"
        });
      }
    }
  });

  it("requires exact A4, 100 percent scale and readable configured text", () => {
    expect(validatePrintSettings({ pageSize: "A4", orientation: "PORTRAIT", marginMm: 9, minimumFontSizePt: 8.5, scalePercent: 100 }))
      .toMatchObject({ pageSize: "A4", scalePercent: 100 });
    expect(() => validatePrintSettings({ pageSize: "LETTER", scalePercent: 100 })).toThrow(/A4/);
    expect(() => validatePrintSettings({ pageSize: "A4", scalePercent: 95 })).toThrow(/100/);
    expect(() => validatePrintSettings({ pageSize: "A4", scalePercent: 100, minimumFontSizePt: 7 })).toThrow(/Minimum/);
  });

  it("keeps zero, absent, exempt, not applicable and not entered distinct in calibration data", () => {
    const states = syntheticReportSpecimens()[2].report.content.papers
      .flatMap((paper) => paper.components.map((component) => component.state));
    expect(new Set(states)).toEqual(new Set(["PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE", "NOT_ENTERED"]));
    const zero = syntheticReportSpecimens()[2].report.content.papers
      .flatMap((paper) => paper.components)
      .find((component) => component.state === "PRESENT" && component.obtained === "0.00");
    expect(zero).toBeTruthy();
  });
});

describe("REPORT-PRINT-ACCEPT-1A PDF proof", () => {
  it("renders every distinct structure as valid A4 in colour and monochrome", async () => {
    const specimens = syntheticReportSpecimens();
    expect(specimens).toHaveLength(26);
    for (const specimen of specimens) {
      const bytes = await renderReportPdf(specimen.report, specimen.mode);
      expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBeGreaterThan(0);
      if (specimen.family === "KG_DEVELOPMENTAL_BOOKLET") expect(document.getPageCount()).toBe(10);
      for (const page of document.getPages()) {
        const { width, height } = page.getSize();
        const portrait = Math.abs(width - 595.28) < 0.75 && Math.abs(height - 841.89) < 0.75;
        const landscape = Math.abs(width - 841.89) < 0.75 && Math.abs(height - 595.28) < 0.75;
        expect(portrait || landscape).toBe(true);
      }
    }
  }, 60_000);

  it("is deterministic and gives monochrome charts independent patterns plus numeric labels", async () => {
    const specimen = syntheticReportSpecimens().find((row) => row.family === "SECONDARY_IX_X" && row.mode === "MONOCHROME")!;
    const first = await renderReportPdf(specimen.report, specimen.mode);
    const second = await renderReportPdf(specimen.report, specimen.mode);
    expect(first.equals(second)).toBe(true);
    const renderer = source("lib/report-pdf.ts");
    expect(renderer).toContain('pattern: "SOLID"');
    expect(renderer).toContain('pattern: "DIAGONAL"');
    expect(renderer).toContain('pattern: "HORIZONTAL"');
    expect(renderer).toContain("toFixed");
  }, 15_000);

  it("keeps the generated pack private and Git-ignored", () => {
    expect(source("scripts/generate-report-print-accept1a-pack.ts")).toContain('.codex", "report-print-accept-1a", "print-pack"');
    expect(source("scripts/generate-report-print-accept1a-pack.ts")).toContain("sourceFilesIncluded: false");
    expect(source(".gitignore")).toContain(".codex");
  });
});
