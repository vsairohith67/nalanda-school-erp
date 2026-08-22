import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  FINAL_ACADEMIC_PAGE_SPECS,
  FINAL_KG_PAGE_SPECS,
  buildFinalAcademicSnapshot,
  renderFinalSourceLockedPack,
  renderPhysicalAcceptancePack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";

const identity = resolveReportSchoolIdentity({
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  academicYear: "2026-27"
});

describe("R4.2 final source-locked pack", () => {
  it("covers the exact ten-page KG order and every requested academic variant", () => {
    expect(FINAL_KG_PAGE_SPECS.map((page) => page.title)).toEqual([
      "Cover",
      "Student Profile",
      "Instructions",
      "Intellectual Skills",
      "English Development",
      "Hindi and Number Work",
      "EVS, Rhymes and Story",
      "Personality, Attendance and Growth",
      "Comments and Promotion",
      "Back Cover"
    ]);
    expect(FINAL_ACADEMIC_PAGE_SPECS.map((page) => page.specimenId)).toEqual([
      "I-II-CT", "I-II-SESSION", "I-II-COMBINED",
      "III-V-CT", "III-V-SESSION", "III-V-COMBINED",
      "VI-VIII-CT", "VI-VIII-SESSION", "VI-VIII-GROUPED", "VI-VIII-COMBINED",
      "IX-X-CT", "IX-X-SESSION", "IX-X-REVISION", "IX-X-PREBOARD", "IX-X-COMBINED"
    ]);
  });

  it("keeps component maxima, group rows, totals, grades, and chart snapshots frozen per specimen", () => {
    for (const specimen of FINAL_ACADEMIC_PAGE_SPECS) {
      const report = buildFinalAcademicSnapshot(specimen);
      expect(report.summarySnapshotId).toBe(report.snapshotId);
      expect(report.chartPoints.every((point) => point.classSnapshotId === report.classSnapshotId)).toBe(true);
      expect(report.chartPoints.every((point) => point.studentPercentage <= point.highScorePercentage)).toBe(true);
      expect(report.subjects.every((subject) => !/\.\.\.|…/.test(subject.label))).toBe(true);
      if (specimen.componentProfile === "CT") {
        expect(report.componentColumns.map((column) => column.maximum)).toEqual([10, 40]);
      }
      if (specimen.componentProfile === "SESSION") {
        expect(report.componentColumns.map((column) => column.maximum)).toEqual([20, 80]);
      }
      if (specimen.componentProfile === "COMBINED_STANDARD") {
        expect(report.componentColumns.map((column) => column.maximum)).toEqual([50, 100]);
      }
    }
  });

  it("renders deterministic 25-page full packs on exact A4 boxes", async () => {
    for (const mode of ["COLOUR", "MONOCHROME"] as const) {
      const first = await renderFinalSourceLockedPack(mode, identity);
      const second = await renderFinalSourceLockedPack(mode, identity);
      expect(first.equals(second)).toBe(true);
      await expectA4(first, 25);
    }
  }, 120_000);

  it("renders minimal 18-page physical packs without omitting a distinct structure", async () => {
    const physicalIds = FINAL_ACADEMIC_PAGE_SPECS.filter((page) => page.physicalInclude).map((page) => page.specimenId);
    expect(physicalIds).toEqual([
      "I-II-SESSION", "I-II-COMBINED", "III-V-SESSION", "III-V-COMBINED",
      "VI-VIII-GROUPED", "VI-VIII-COMBINED", "IX-X-REVISION", "IX-X-COMBINED"
    ]);
    for (const mode of ["COLOUR", "MONOCHROME"] as const) {
      await expectA4(await renderPhysicalAcceptancePack(mode, identity), 18);
    }
  }, 30_000);
});

async function expectA4(bytes: Buffer, pages: number) {
  const document = await PDFDocument.load(bytes);
  expect(document.getPageCount()).toBe(pages);
  document.getPages().forEach((page) => {
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
    expect(page.node.Contents()).toBeTruthy();
  });
}
