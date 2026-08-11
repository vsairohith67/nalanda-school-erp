import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  ALTERNATE_GRADE_SCALE,
  buildSyntheticAcademicSnapshot,
  gradeForScale,
  KG_INTELLECTUAL_HIERARCHY,
  NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
  R4_MINIMUM_FONT_SIZES,
  R4_VISUAL_PAGE_KINDS,
  renderR4EdgePack,
  renderR4VisualPack,
  resolveReportSchoolIdentity,
  resultStateCode,
  selectChartSubjects,
  STANDARD_GRADE_SCALE,
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

describe("R4 NALANDA_LEGACY_REFINED source lock", () => {
  it("keeps exactly one colour and one monochrome production variant", () => {
    expect(NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES).toEqual([
      "NALANDA_LEGACY_REFINED_COLOUR",
      "NALANDA_LEGACY_REFINED_MONOCHROME"
    ]);
    expect(templateFamilyForMode("COLOUR")).toBe("NALANDA_LEGACY_REFINED_COLOUR");
    expect(templateFamilyForMode("MONOCHROME")).toBe("NALANDA_LEGACY_REFINED_MONOCHROME");
  });

  it("retains approved identity and branding values", () => {
    expect(identity).toMatchObject({
      schoolName: "Nalanda Public School",
      addressLine1: "Nanalnagar, Mehdipatnam",
      city: "Hyderabad",
      motto: "Knowledge is Power",
      logoPath: "/nalanda-logo-transparent.png"
    });
  });

  it("restores separate Hindi and Mathematics KG rows", () => {
    const labels = KG_INTELLECTUAL_HIERARCHY.map((row) => row.label);
    expect(labels.slice(labels.indexOf("B. Hindi") + 1, labels.indexOf("C. Mathematics"))).toEqual([
      "Reading",
      "Recitation",
      "Written Work"
    ]);
    expect(labels.slice(labels.indexOf("C. Mathematics") + 1, labels.indexOf("D. Environmental Study"))).toEqual([
      "Recognition of Numbers",
      "Number Operations",
      "Written Work",
      "Dictation",
      "Home Assignment"
    ]);
  });

  it("disables academic subject Grade by default outside Class IX Combined", () => {
    for (const kind of ["CLASS_II_SESSION", "CLASS_V_SESSION", "CLASS_VI_GROUPED", "CLASS_X_CT_REVISION"] as const) {
      expect(buildSyntheticAcademicSnapshot(kind).showAcademicSubjectGrade).toBe(false);
    }
    expect(buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED").showAcademicSubjectGrade).toBe(true);
  });

  it("uses a dedicated stateful grade-only row", () => {
    const normal = buildSyntheticAcademicSnapshot("CLASS_II_SESSION").subjects.find((row) => row.kind === "GRADE_ONLY");
    const edge = buildSyntheticAcademicSnapshot("CLASS_II_SESSION", true).subjects.filter((row) => row.kind === "GRADE_ONLY");
    expect(normal).toMatchObject({ kind: "GRADE_ONLY", grade: "A1", state: "PRESENT" });
    expect(edge).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "EXEMPT", grade: null }),
      expect.objectContaining({ state: "NOT_APPLICABLE", grade: null })
    ]));
  });

  it("renders the eight-page R4 visual pack on exact A4 boxes", async () => {
    const document = await PDFDocument.load(await renderR4VisualPack(identity));
    expect(R4_VISUAL_PAGE_KINDS).toHaveLength(6);
    expect(document.getPageCount()).toBe(8);
    assertA4(document);
  }, 20_000);

  it("keeps long-name and result-state evidence in a separate four-page A4 pack", async () => {
    const document = await PDFDocument.load(await renderR4EdgePack(identity));
    expect(document.getPageCount()).toBe(4);
    assertA4(document);
  }, 20_000);

  it("enforces the stated minimum font sizes", () => {
    expect(R4_MINIMUM_FONT_SIZES).toEqual({
      normalTableBody: 6.5,
      denseClassIxTable: 6,
      identityValue: 7,
      chartLabel: 6,
      legend: 6.5
    });
  });

  it("uses only the synthetic not-for-issue footer", async () => {
    const source = await readFile(path.resolve(process.cwd(), "lib", "report-card-refined-source-lock.ts"), "utf8");
    expect(source).toContain("SYNTHETIC SAMPLE - NOT FOR ISSUE");
    expect(source).not.toContain("VISUAL REVIEW - SYNTHETIC DATA ONLY");
    expect(source).not.toContain("EDGE-CASE QA - SYNTHETIC DATA ONLY");
  });
});

describe("R4 grade-scale consistency and boundaries", () => {
  it.each([
    [90.00, "A2"],
    [90.01, "A2"],
    [90.50, "A2"],
    [90.99, "A2"],
    [91.00, "A1"]
  ])("maps standard-scale boundary %s to %s without pre-grade rounding", (percentage, expected) => {
    expect(gradeForScale(percentage, STANDARD_GRADE_SCALE)).toBe(expected);
  });

  it("maps the secondary 90.00 boundary to A+", () => {
    expect(gradeForScale(89.99, ALTERNATE_GRADE_SCALE)).toBe("A");
    expect(gradeForScale(90.00, ALTERNATE_GRADE_SCALE)).toBe("A+");
  });

  it("uses the A+/A/B/C/D/E/F scale consistently throughout Class X", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION");
    const allowed = new Set(report.gradeScale.bands.map((band) => band.label));
    expect(report.gradeScale.id).toBe(ALTERNATE_GRADE_SCALE.id);
    expect(report.gradeLegend.map((band) => band.grade)).toEqual(["A+", "A", "B", "C", "D", "E", "F"]);
    expect(report.overall.grade).toBe("A");
    for (const subject of report.subjects) {
      if (subject.kind !== "GRADE_ONLY") expect(allowed.has(subject.grade)).toBe(true);
    }
    expect(report.subjects.some((subject) => subject.kind !== "GRADE_ONLY" && ["A1", "A2"].includes(subject.grade))).toBe(false);
  });

  it("rejects a subject grade from another scale", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION"));
    const subject = report.subjects.find((row) => row.kind === "MARKS");
    if (!subject || subject.kind !== "MARKS") throw new Error("Fixture subject missing.");
    subject.grade = "A1";
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/report grade scale/i);
  });

  it("rejects a legend from another scale", () => {
    const report = clone(buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION"));
    report.gradeLegend[0].grade = "A1";
    expect(() => validateAcademicReportSnapshot(report)).toThrow(/legend/i);
  });
});

describe("R4 displayed-number reconciliation", () => {
  it("makes the displayed Class IX contributing-row sum equal the displayed overall total", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED");
    const displayedRowSum = round2(report.subjects
      .flatMap((subject) => subject.includeInOverall && subject.kind !== "GRADE_ONLY"
        ? [Number(subject.total.value)]
        : [])
      .reduce((total, value) => total + value, 0));
    expect(displayedRowSum).toBe(484.96);
    expect(report.overall.value).toBe(displayedRowSum);
    expect(report.overall.percentage).toBe(round2(displayedRowSum / report.overall.maximum * 100));
    expect(report.overall.rankBasisPercentage).toBe(report.overall.percentage);
  });

  it("keeps every chart Student value on the displayed subject total", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED");
    for (const point of report.chartPoints) {
      const subject = report.subjects.find((row) => row.key === point.subjectKey);
      if (!subject || subject.kind === "GRADE_ONLY") throw new Error("Chart subject missing.");
      expect(point.studentPercentage).toBe(round2(Number(subject.total.value) / subject.total.maximum * 100));
      expect(point.classSnapshotId).toBe(report.classSnapshotId);
    }
  });

  it("rejects component, overall, percentage, rank-basis and chart mismatches", () => {
    const component = clone(buildSyntheticAcademicSnapshot("CLASS_II_SESSION"));
    const subject = component.subjects.find((row) => row.kind === "MARKS");
    if (!subject || subject.kind !== "MARKS") throw new Error("Fixture subject missing.");
    subject.total.value = Number(subject.total.value) + 1;
    expect(() => validateAcademicReportSnapshot(component)).toThrow(/component values/i);

    const overall = clone(buildSyntheticAcademicSnapshot("CLASS_VI_GROUPED"));
    overall.overall.value += 0.01;
    expect(() => validateAcademicReportSnapshot(overall)).toThrow(/overall total/i);

    const percentage = clone(buildSyntheticAcademicSnapshot("CLASS_VI_GROUPED"));
    percentage.overall.percentage += 0.01;
    expect(() => validateAcademicReportSnapshot(percentage)).toThrow(/percentage/i);

    const rankBasis = clone(buildSyntheticAcademicSnapshot("CLASS_X_CT_REVISION"));
    rankBasis.overall.rankBasisPercentage += 0.01;
    expect(() => validateAcademicReportSnapshot(rankBasis)).toThrow(/rank basis/i);

    const chart = clone(buildSyntheticAcademicSnapshot("CLASS_IX_COMBINED"));
    chart.chartPoints[0].studentPercentage += 0.01;
    expect(() => validateAcademicReportSnapshot(chart)).toThrow(/Chart Student value/i);
  });
});

describe("R4 chart-row and result-state policies", () => {
  it.each(["CLASS_VI_GROUPED", "CLASS_IX_COMBINED", "CLASS_X_CT_REVISION"] as const)(
    "uses leaf subjects without aggregate duplication for %s",
    (kind) => {
      const report = buildSyntheticAcademicSnapshot(kind);
      expect(report.chartPolicy).toBe("LEGACY_LEAF_SUBJECTS");
      expect(report.chartPoints.some((point) => /Average$/.test(point.subjectLabel))).toBe(false);
      expect(report.chartPoints.some((point) => point.subjectLabel === "English Paper 1")).toBe(true);
      expect(report.chartPoints.some((point) => point.subjectLabel === "English Paper 2")).toBe(true);
    }
  );

  it("supports GROUP_SUMMARY only when explicitly selected", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_VI_GROUPED");
    const summaryRows = selectChartSubjects(report.subjects, "GROUP_SUMMARY");
    expect(summaryRows.some((row) => row.label === "English Average")).toBe(true);
    expect(summaryRows.some((row) => row.label === "English Paper 1")).toBe(false);
  });

  it("maps every result state to an indivisible compact code", () => {
    expect(resultStateCode("ABSENT")).toBe("AB");
    expect(resultStateCode("EXEMPT")).toBe("EX");
    expect(resultStateCode("NOT_ENTERED")).toBe("NE");
    expect(resultStateCode("NOT_APPLICABLE")).toBe("NA");
  });

  it("includes AB, EX, NE and NA in the edge snapshot", () => {
    const report = buildSyntheticAcademicSnapshot("CLASS_II_SESSION", true);
    const states = new Set<string>();
    for (const subject of report.subjects) {
      if (subject.kind === "MARKS") {
        subject.components.forEach((component) => states.add(resultStateCode(component.state)));
      } else if (subject.kind === "GRADE_ONLY") states.add(resultStateCode(subject.state));
    }
    expect([...states]).toEqual(expect.arrayContaining(["AB", "EX", "NE", "NA"]));
  });
});

function assertA4(document: PDFDocument) {
  for (const page of document.getPages()) {
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
  }
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clone(value: AcademicReportSnapshot) {
  return structuredClone(value);
}
