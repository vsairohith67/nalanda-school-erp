import { describe, expect, it } from "vitest";
import {
  activeDraftDefault,
  calculateFreePeriodSummary,
  calculateWorkloadSummary,
  canPrintTimetable,
  classTimetableCsvRows,
  formatTimetableCsv,
  shapeClassTimetable,
  shapeTeacherTimetable,
  teacherTimetableCsvRows,
  type TimetablePrintSource
} from "../lib/timetable-print";

function source(): TimetablePrintSource {
  return {
    draft: { id: "d1", academicYear: "2026-27", name: "Generated Draft", status: "ACTIVE" },
    teachers: [
      { id: "t1", name: "Ms. Farheen", shortName: "MF", department: "English", isActive: true, maxPeriodsPerWeek: 2 },
      { id: "t2", name: "Mr. Arun", shortName: "MA", department: null, isActive: true, maxPeriodsPerWeek: 10 }
    ],
    subjects: [
      { id: "s1", name: "English, Language", shortName: "ENG" },
      { id: "s2", name: "Science", shortName: "SCI" }
    ],
    classSections: [
      { id: "c1", academicYear: "2026-27", displayName: "VI A", groupName: "VI-X", isActive: true },
      { id: "c2", academicYear: "2026-27", displayName: "VII A", groupName: "VI-X", isActive: true }
    ],
    templates: [
      { academicYear: "2026-27", groupName: "VI-X", dayOfWeek: "MONDAY", periodNumber: 1, label: "Period I", startTime: "09:00", endTime: "09:40", type: "TEACHING", isTeachingPeriod: true, sortOrder: 1 },
      { academicYear: "2026-27", groupName: "VI-X", dayOfWeek: "MONDAY", periodNumber: 2, label: "Period II", startTime: "09:40", endTime: "10:20", type: "TEACHING", isTeachingPeriod: true, sortOrder: 2 },
      { academicYear: "2026-27", groupName: "VI-X", dayOfWeek: "MONDAY", periodNumber: null, label: "Diary Period", startTime: "15:45", endTime: "16:00", type: "DIARY", isTeachingPeriod: false, sortOrder: 3 },
      { academicYear: "2026-27", groupName: "VI-X", dayOfWeek: "TUESDAY", periodNumber: 1, label: "Period I", startTime: "09:00", endTime: "09:40", type: "TEACHING", isTeachingPeriod: true, sortOrder: 1 }
    ],
    entries: [
      { id: "e1", classSectionId: "c1", dayOfWeek: "MONDAY", periodNumber: 1, teacherId: "t1", subjectId: "s1", label: "English", entryType: "TEACHING", isLocked: false },
      { id: "e2", classSectionId: "c2", dayOfWeek: "TUESDAY", periodNumber: 1, teacherId: "t1", subjectId: "s1", label: "English", entryType: "FIXED", isLocked: true },
      { id: "e3", classSectionId: "c1", dayOfWeek: "MONDAY", periodNumber: 2, teacherId: null, subjectId: null, label: "Games", entryType: "ACTIVITY", isLocked: false }
    ]
  };
}

describe("timetable print and export", () => {
  it("shapes class print rows with timing, teacher, activity, and diary labels", () => {
    const data = shapeClassTimetable(source(), "c1");
    expect(data?.days[0].cells[0]).toMatchObject({
      periodLabel: "Period I",
      timing: "09:00-09:40",
      subject: "English, Language",
      teacher: "MF"
    });
    expect(data?.days[0].cells[1]).toMatchObject({ entryType: "ACTIVITY", label: "Games" });
    expect(data?.days[0].scheduleLabels).toContain("Diary Period 15:45-16:00");
  });

  it("shapes teacher print rows and exposes practical free periods", () => {
    const data = shapeTeacherTimetable(source(), "t1");
    expect(data?.totalPeriods).toBe(2);
    expect(data?.dayLoads).toMatchObject({ MONDAY: 1, TUESDAY: 1 });
    expect(data?.days[0].cells.find((cell) => cell.periodNumber === 2)).toMatchObject({ isFree: true });
    expect(data?.days[1].cells.find((cell) => cell.periodNumber === 1)).toMatchObject({
      classSection: "VII A",
      subject: "English, Language",
      entryType: "FIXED"
    });
  });

  it("calculates assigned workload, remaining capacity, overload, and daily load", () => {
    const overloaded = source();
    overloaded.entries.push({
      id: "e4", classSectionId: "c1", dayOfWeek: "TUESDAY", periodNumber: 1,
      teacherId: "t1", subjectId: "s2", label: "Science", entryType: "SUBSTITUTION", isLocked: false
    });
    const row = calculateWorkloadSummary(overloaded).find((item) => item.teacherId === "t1");
    expect(row).toMatchObject({ assignedPeriods: 3, remainingCapacity: 0, overloaded: true });
    expect(row?.dayLoads.TUESDAY).toBe(2);
  });

  it("calculates teacher/day free periods and weekly totals", () => {
    const rows = calculateFreePeriodSummary(source()).filter((row) => row.teacherId === "t1");
    expect(rows.find((row) => row.dayOfWeek === "MONDAY")?.freePeriods).toEqual([2]);
    expect(rows.find((row) => row.dayOfWeek === "TUESDAY")?.freePeriods).toEqual([]);
    expect(rows[0].totalFreePeriods).toBeGreaterThanOrEqual(1);
  });

  it("formats class and teacher CSV with stable columns and escaped values", () => {
    const classRows = classTimetableCsvRows(source(), "c1");
    const teacherRows = teacherTimetableCsvRows(source(), "t1");
    const csv = formatTimetableCsv(classRows);
    expect(classRows[0]).toMatchObject({ classSection: "VI A", day: "Monday", teacher: "MF" });
    expect(teacherRows.some((row) => row.label === "Free")).toBe(true);
    expect(csv.startsWith("\uFEFFacademicYear,draft,status")).toBe(true);
    expect(csv).toContain("\"English, Language\"");
    expect(csv.endsWith("\n")).toBe(true);
  });

  it("defaults only to the active draft for the selected academic year", () => {
    const drafts = [
      { id: "old-active", academicYear: "2025-26", name: "Old", status: "ACTIVE" },
      { id: "draft", academicYear: "2026-27", name: "Draft", status: "DRAFT" },
      { id: "active", academicYear: "2026-27", name: "Approved", status: "ACTIVE" }
    ];
    expect(activeDraftDefault(drafts, "2026-27")).toBe("active");
    expect(activeDraftDefault(drafts, "2027-28")).toBe("");
  });

  it("limits timetable print and export to Director and Admin", () => {
    expect(canPrintTimetable("DIRECTOR")).toBe(true);
    expect(canPrintTimetable("ADMIN")).toBe(true);
    expect(canPrintTimetable("ACCOUNTANT")).toBe(false);
    expect(canPrintTimetable("VIEWER")).toBe(false);
  });
});
