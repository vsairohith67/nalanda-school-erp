import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  buildSyntheticAcademicSnapshot,
  KG_INTELLECTUAL_HIERARCHY,
  NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
  REFINED_REPRESENTATIVE_PAGE_KINDS,
  renderR3EdgePack,
  renderR3VisualPack,
  renderRefinedSourceLockedPage,
  resolveReportSchoolIdentity,
  templateFamilyForMode,
  validateAcademicReportSnapshot,
  type AcademicReportSnapshot
} from "../lib/report-card-refined-source-lock";

const identity = resolveReportSchoolIdentity({
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  academicYear: "2026-27"
});

describe("NALANDA_LEGACY_REFINED source lock", () => {
  it("exposes only colour and monochrome production families", () => {
    expect(NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES).toEqual([
      "NALANDA_LEGACY_REFINED_COLOUR",
      "NALANDA_LEGACY_REFINED_MONOCHROME"
    ]);
    expect(templateFamilyForMode("COLOUR")).toBe("NALANDA_LEGACY_REFINED_COLOUR");
    expect(templateFamilyForMode("MONOCHROME")).toBe("NALANDA_LEGACY_REFINED_MONOCHROME");
  });

  it("uses approved settings and omits unconfigured identity claims", () => {
    expect(identity).toMatchObject({
      schoolName: "Nalanda Public School",
      addressLine1: "Nanalnagar, Mehdipatnam",
      city: "Hyderabad",
      motto: "Knowledge is Power",
      affiliationWording: null,
      recognitionWording: null,
      establishmentYear: null,
      logoPath: "/nalanda-logo-transparent.png"
    });
    expect(resolveReportSchoolIdentity({
      schoolName: "Nalanda Public School",
      addressLine1: "Nanalnagar, Mehdipatnam",
      city: "Hyderabad",
      academicYear: "2026-27"
    }, [{
      schoolIdentity: {
        affiliationWording: "Approved affiliation wording",
        recognitionWording: "Approved recognition wording",
        establishmentYear: "1972"
      }
    }])).toMatchObject({
      affiliationWording: "Approved affiliation wording",
      recognitionWording: "Approved recognition wording",
      establishmentYear: "1972"
    });
  });

  it("rejects conflicting approved identity wording", () => {
    expect(() => resolveReportSchoolIdentity({
      schoolName: "Nalanda Public School",
      addressLine1: "Nanalnagar, Mehdipatnam",
      city: "Hyderabad",
      academicYear: "2026-27"
    }, [
      { schoolIdentity: { affiliationWording: "Approved A" } },
      { schoolIdentity: { affiliationWording: "Approved B" } }
    ])).toThrow(/disagree/i);
  });

  it("renders the ten-page R3 review pack on exact A4 boxes", async () => {
    const document = await PDFDocument.load(await renderR3VisualPack(identity));
    expect(document.getPageCount()).toBe(10);
    for (const page of document.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
  }, 20_000);

  it("keeps edge cases in a separate eight-page A4 pack", async () => {
    const document = await PDFDocument.load(await renderR3EdgePack(identity));
    expect(document.getPageCount()).toBe(8);
    expect(REFINED_REPRESENTATIVE_PAGE_KINDS).toHaveLength(8);
    for (const page of document.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
  }, 20_000);

  it("renders each structure through the single refined family", async () => {
    for (const kind of REFINED_REPRESENTATIVE_PAGE_KINDS) {
      const document = await PDFDocument.load(
        await renderRefinedSourceLockedPage(kind, "COLOUR", false, identity)
      );
      expect(document.getPageCount()).toBe(1);
    }
  }, 20_000);

  it("retains the KG grouped hierarchy", () => {
    expect(KG_INTELLECTUAL_HIERARCHY.filter((row) => "section" in row && row.section).map((row) => row.label)).toEqual([
      "A. English",
      "B. Hindi",
      "C. Mathematics",
      "D. Environmental Study",
      "E. Drawing and Colouring",
      "F. Overall Grade"
    ]);
  });

  it("uses a dedicated grade column for grade-only subjects", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_II_SESSION");
    const gradeOnly = report.subjects.find((subject) => subject.key === "gkve");
    expect(gradeOnly).toMatchObject({ kind: "GRADE_ONLY", grade: "A1" });
  });

  it("keeps Class X Total (50) semantics mathematically correct", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION");
    expect(report.componentColumns.reduce((total, column) => total + column.maximum, 0)).toBe(50);
    for (const subject of report.subjects) {
      if (subject.kind === "MARKS" && subject.total.value != null) {
        expect(subject.total.maximum).toBe(50);
        expect(subject.total.value).toBeLessThanOrEqual(50);
      }
    }
  });

  it("contains no prohibited shortened parent-facing labels", async () => {
    const source = await readFile(path.resolve(process.cwd(), "lib", "report-card-refined-source-lock.ts"), "utf8");
    for (const prohibited of [
      "Internal Ass...",
      "Written Exa...",
      "CT T...",
      "Term...",
      "Ann...",
      "NOT ENTER...",
      "RAW_SUM",
      "WEIGHTED_NORMALIZED",
      "Configured component"
    ]) expect(source).not.toContain(prohibited);
    for (const kind of ["CLASS_II_SESSION", "CLASS_V_SESSION", "CLASS_VI_GROUPED", "CLASS_IX_COMBINED", "CLASS_X_CT_REVISION"] as const) {
      const report = buildSyntheticAcademicSnapshot(kind, true);
      expect(report.studentName.endsWith("...")).toBe(false);
      expect(report.guardianName.endsWith("...")).toBe(false);
      expect(report.subjects.some((subject) => subject.label.endsWith("..."))).toBe(false);
    }
  });
});

describe("frozen report snapshot reconciliation", () => {
  it.each([
    "CLASS_II_SESSION",
    "CLASS_V_SESSION",
    "CLASS_VI_GROUPED",
    "CLASS_IX_COMBINED",
    "CLASS_X_CT_REVISION"
  ] as const)("reconciles %s table, summary and chart values", (kind) => {
    expect(() => validateAcademicReportSnapshot(buildSyntheticAcademicSnapshot(kind))).not.toThrow();
  });

  it("rejects a component/table mismatch", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_II_SESSION"));
    const subject = report.subjects.find((row) => row.kind === "MARKS");
    if (!subject || subject.kind !== "MARKS") throw new Error("Fixture subject missing.");
    subject.total.value = Number(subject.total.value) + 1;
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/component values/i);
  });

  it("rejects an overall total mismatch", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_V_SESSION"));
    report.overall.value += 1;
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/overall total/i);
  });

  it("rejects a percentage mismatch", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_VI_GROUPED"));
    report.overall.percentage += 0.5;
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/percentage/i);
  });

  it("rejects a table/chart Student mismatch", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED"));
    report.chartPoints[0].studentPercentage += 1;
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/Chart Student value/i);
  });

  it("rejects class comparison values from another snapshot", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION"));
    report.chartPoints[0].classSnapshotId = "OTHER-SNAPSHOT";
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/frozen class snapshot/i);
  });

  it("rejects a weighted combined-result mismatch", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED"));
    const subject = report.subjects.find((row) => row.kind === "COMBINED");
    if (!subject || subject.kind !== "COMBINED") throw new Error("Combined fixture missing.");
    subject.combined.ctWeighted += 1;
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/weighted values/i);
  });

  it("validates combined results against the frozen scheme instead of a universal formula", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED"));
    if (!report.combinedScheme) throw new Error("Combined fixture scheme missing.");
    report.combinedScheme.ctWeight = 25;
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/weighted values/i);
  });
});

function clone(value: AcademicReportSnapshot) {
  return structuredClone(value);
}
