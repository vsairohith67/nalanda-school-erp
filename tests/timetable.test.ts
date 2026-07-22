import { describe, expect, it } from "vitest";
import {
  allowsConsecutivePeriods,
  classSectionKey,
  defaultPeriodTemplates,
  teacherWeeklyLoads,
  validateSubjectInput,
  validateTeacherInput,
  validateTimetableFoundation,
  validateDraftTimetable
} from "../lib/timetable";

describe("timetable master data validation", () => {
  it("validates teacher names, codes, and positive workload", () => {
    expect(validateTeacherInput({ name: "  Rani Sharma ", shortName: " rs ", maxPeriodsPerWeek: "30" })).toMatchObject({
      name: "Rani Sharma", shortName: "RS", maxPeriodsPerWeek: 30
    });
    expect(() => validateTeacherInput({ name: "", shortName: "RS", maxPeriodsPerWeek: 30 })).toThrow("Teacher name is required");
    expect(() => validateTeacherInput({ name: "Rani", shortName: "RS", maxPeriodsPerWeek: 0 })).toThrow("positive whole number");
  });

  it("validates subject names and defaults consecutive periods to false", () => {
    expect(validateSubjectInput({ name: "Mathematics", shortName: " math " })).toMatchObject({
      name: "Mathematics", shortName: "MATH", allowConsecutivePeriods: false
    });
    expect(() => validateSubjectInput({ name: "", shortName: "M" })).toThrow("Subject name is required");
  });

  it("builds a stable class-section uniqueness key", () => {
    expect(classSectionKey("2026-27", "vi", " a ")).toBe("2026-27|VI|A");
  });

  it("totals assignment workload per teacher and detects overload", () => {
    const assignments = [
      { teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 18 },
      { teacherId: "t1", subjectId: "s2", classSectionId: "c2", periodsPerWeek: 14 }
    ];
    expect(teacherWeeklyLoads(assignments).get("t1")).toBe(32);
    const warnings = validateTimetableFoundation({
      teachers: [{ id: "t1", name: "Teacher One", isActive: true, maxPeriodsPerWeek: 30 }],
      subjects: [{ id: "s1", name: "Math", isActive: true }, { id: "s2", name: "Science", isActive: true }],
      classSections: [{ id: "c1", displayName: "VI A", isActive: true }, { id: "c2", displayName: "VII A", isActive: true }],
      assignments
    });
    expect(warnings.some((warning) => warning.code === "TEACHER_OVERLOAD")).toBe(true);
  });

  it("warns when inactive teachers or subjects are assigned", () => {
    const warnings = validateTimetableFoundation({
      teachers: [{ id: "t1", name: "Teacher One", isActive: false, maxPeriodsPerWeek: 30 }],
      subjects: [{ id: "s1", name: "Math", isActive: false }],
      classSections: [{ id: "c1", displayName: "VI A", isActive: true }],
      assignments: [{ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 5 }]
    });
    expect(warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(["INACTIVE_TEACHER", "INACTIVE_SUBJECT"]));
  });

  it("warns when an active class section has no workload", () => {
    const warnings = validateTimetableFoundation({
      teachers: [], subjects: [],
      classSections: [{ id: "c1", displayName: "VIII B", isActive: true }],
      assignments: []
    });
    expect(warnings.some((warning) => warning.code === "CLASS_WITHOUT_WORKLOAD")).toBe(true);
  });

  it("uses the no-consecutive subject rule unless an assignment overrides it", () => {
    expect(allowsConsecutivePeriods(false, null)).toBe(false);
    expect(allowsConsecutivePeriods(false, true)).toBe(true);
    expect(allowsConsecutivePeriods(true, false)).toBe(false);
  });

  it("detects fixed-period and unavailable-teacher conflicts", () => {
    const warnings = validateTimetableFoundation({
      teachers: [{ id: "t1", name: "Teacher One", isActive: true, maxPeriodsPerWeek: 30 }],
      subjects: [], classSections: [], assignments: [],
      unavailability: [{ teacherId: "t1", dayOfWeek: "MONDAY", periodNumber: 2 }],
      fixedPeriods: [
        { id: "f1", teacherId: "t1", dayOfWeek: "MONDAY", periodNumber: 2 },
        { id: "f2", teacherId: "t1", dayOfWeek: "MONDAY", periodNumber: 2 }
      ]
    });
    expect(warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(["FIXED_PERIOD_CONFLICT", "TEACHER_UNAVAILABLE_CONFLICT"]));
  });
});

describe("manual timetable draft validation", () => {
  const teachers = [
    { id: "t1", name: "Ms. Farheen", isActive: true, maxPeriodsPerWeek: 2, maxPeriodsPerDay: 1 },
    { id: "t2", name: "Mr. Arun", isActive: true, maxPeriodsPerWeek: 10, maxPeriodsPerDay: 5 }
  ];
  const subjects = [
    { id: "s1", name: "English", isActive: true, allowConsecutivePeriods: false },
    { id: "s2", name: "Science", isActive: true, allowConsecutivePeriods: true }
  ];
  const classSections = [
    { id: "c1", displayName: "VI A", isActive: true },
    { id: "c2", displayName: "VII A", isActive: true }
  ];
  const assignments = [
    { id: "a1", classSectionId: "c1", teacherId: "t1", subjectId: "s1", periodsPerWeek: 1, allowConsecutiveOverride: null },
    { id: "a2", classSectionId: "c2", teacherId: "t1", subjectId: "s1", periodsPerWeek: 2, allowConsecutiveOverride: null }
  ];
  const entry = (overrides: Record<string, unknown> = {}) => ({
    id: "e1", academicYear: "2026-27", classSectionId: "c1", dayOfWeek: "MONDAY",
    periodNumber: 1, assignmentId: "a1", teacherId: "t1", subjectId: "s1",
    entryType: "TEACHING", ...overrides
  });

  it("detects teacher double-booking", () => {
    const issues = validateDraftTimetable({
      teachers, subjects, classSections, assignments,
      entries: [entry(), entry({ id: "e2", classSectionId: "c2", assignmentId: "a2" })]
    });
    expect(issues.some((row) => row.code === "TEACHER_DOUBLE_BOOKED" && row.severity === "error")).toBe(true);
  });

  it("detects teacher unavailability and fixed-period conflicts", () => {
    const issues = validateDraftTimetable({
      teachers, subjects, classSections, assignments, entries: [entry({ teacherId: "t2", subjectId: "s2" })],
      unavailability: [{ teacherId: "t2", dayOfWeek: "MONDAY", periodNumber: 1 }],
      fixedPeriods: [{ classSectionId: "c1", teacherId: "t1", subjectId: "s1", dayOfWeek: "MONDAY", periodNumber: 1 }]
    });
    expect(issues.map((row) => row.code)).toEqual(expect.arrayContaining(["TEACHER_UNAVAILABLE", "FIXED_PERIOD_CONFLICT"]));
  });

  it("warns about consecutive subjects and assignment overuse", () => {
    const issues = validateDraftTimetable({
      teachers, subjects, classSections, assignments,
      entries: [entry(), entry({ id: "e2", periodNumber: 2 })]
    });
    expect(issues.map((row) => row.code)).toEqual(expect.arrayContaining(["CONSECUTIVE_SUBJECT", "ASSIGNMENT_OVERUSED"]));
  });

  it("warns about assignment underuse", () => {
    const issues = validateDraftTimetable({ teachers, subjects, classSections, assignments, entries: [] });
    expect(issues.filter((row) => row.code === "ASSIGNMENT_UNDERUSED")).toHaveLength(2);
  });
});

describe("2026-27 period template defaults", () => {
  it("contains editable group defaults and the Friday half-day override", () => {
    const templates = defaultPeriodTemplates();
    expect(new Set(templates.map((row) => row.groupName))).toEqual(new Set(["LKG", "UKG", "I-V", "VI-X", "FRIDAY"]));
    expect(templates.find((row) => row.groupName === "VI-X" && row.label === "Diary Period")).toMatchObject({ startTime: "15:45", endTime: "16:00" });
    expect(templates.find((row) => row.groupName === "FRIDAY" && row.label === "Period V / Closing")).toMatchObject({ endTime: "12:25" });
    expect(templates.every((row) => row.isDefault)).toBe(true);
  });
});
