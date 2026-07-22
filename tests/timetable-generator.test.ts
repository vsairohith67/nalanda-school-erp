import { describe, expect, it, vi } from "vitest";
import {
  defaultGeneratorSettings,
  generateTimetable,
  generatedDraftCreateData,
  saveGeneratedTimetableDraft,
  type GeneratorInput
} from "../lib/timetable-generator";

function template(dayOfWeek: string, periodNumber: number, groupName = dayOfWeek === "FRIDAY" ? "FRIDAY" : "VI-X") {
  return {
    academicYear: "2026-27",
    groupName,
    dayOfWeek,
    periodNumber,
    isTeachingPeriod: true,
    sortOrder: periodNumber
  };
}

function generatorInput(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  const settings = defaultGeneratorSettings("2026-27");
  return {
    settings,
    teachers: [
      { id: "t1", name: "Teacher One", isActive: true, maxPeriodsPerWeek: 20, maxPeriodsPerDay: 4 },
      { id: "t2", name: "Teacher Two", isActive: true, maxPeriodsPerWeek: 20, maxPeriodsPerDay: 4 }
    ],
    subjects: [
      { id: "s1", name: "Mathematics", isActive: true, allowConsecutivePeriods: false },
      { id: "s2", name: "Science", isActive: true, allowConsecutivePeriods: false }
    ],
    classSections: [
      { id: "c1", academicYear: "2026-27", displayName: "VI A", groupName: "VI-X", isActive: true },
      { id: "c2", academicYear: "2026-27", displayName: "VII A", groupName: "VI-X", isActive: true }
    ],
    assignments: [
      { id: "a1", academicYear: "2026-27", classSectionId: "c1", teacherId: "t1", subjectId: "s1", periodsPerWeek: 2 },
      { id: "a2", academicYear: "2026-27", classSectionId: "c2", teacherId: "t2", subjectId: "s2", periodsPerWeek: 2 }
    ],
    templates: [
      template("MONDAY", 1),
      template("MONDAY", 2),
      template("TUESDAY", 1),
      template("TUESDAY", 2),
      template("FRIDAY", 1)
    ],
    unavailability: [],
    fixedPeriods: [],
    baseDraft: null,
    generatedAt: new Date(2026, 5, 19, 10, 30),
    ...overrides
  };
}

describe("automatic timetable generator", () => {
  it("places all required periods for simple valid data", () => {
    const result = generateTimetable(generatorInput());
    expect(result.summary.totalRequiredPeriods).toBe(4);
    expect(result.summary.placedPeriods).toBe(4);
    expect(result.summary.unresolvedPeriods).toBe(0);
    expect(result.generatedDraftName).toBe("Generated Timetable - 2026-06-19 10:30");
  });

  it("compacts empty-period warnings and does not report no-workload classes as complete", () => {
    const result = generateTimetable(generatorInput({ assignments: [] }));
    expect(result.validation.warnings.filter((row) => row.code === "EMPTY_TEACHING_PERIOD")).toHaveLength(2);
    expect(result.classCompletion.every((row) => row.completionPercentage === 0)).toBe(true);
  });

  it("avoids teacher double-booking across class sections", () => {
    const input = generatorInput({
      teachers: [{ id: "t1", name: "Teacher One", isActive: true, maxPeriodsPerWeek: 20, maxPeriodsPerDay: 4 }],
      assignments: [
        { id: "a1", academicYear: "2026-27", classSectionId: "c1", teacherId: "t1", subjectId: "s1", periodsPerWeek: 1 },
        { id: "a2", academicYear: "2026-27", classSectionId: "c2", teacherId: "t1", subjectId: "s2", periodsPerWeek: 1 }
      ],
      templates: [template("FRIDAY", 1)]
    });
    const result = generateTimetable(input);
    expect(result.entries).toHaveLength(1);
    expect(result.summary.unresolvedPeriods).toBe(1);
    expect(result.validation.errors.some((row) => row.code === "TEACHER_DOUBLE_BOOKED")).toBe(false);
  });

  it("avoids teacher unavailable periods", () => {
    const result = generateTimetable(generatorInput({
      assignments: [
        { id: "a1", academicYear: "2026-27", classSectionId: "c1", teacherId: "t1", subjectId: "s1", periodsPerWeek: 1 }
      ],
      unavailability: [{ teacherId: "t1", dayOfWeek: "MONDAY", periodNumber: 1 }]
    }));
    expect(result.entries.some((row) =>
      row.teacherId === "t1" && row.dayOfWeek === "MONDAY" && row.periodNumber === 1
    )).toBe(false);
    expect(result.validation.errors.some((row) => row.code === "TEACHER_UNAVAILABLE")).toBe(false);
  });

  it("preserves a locked base draft entry", () => {
    const lockedEntry = {
      id: "entry-locked",
      academicYear: "2026-27",
      classSectionId: "c1",
      dayOfWeek: "MONDAY",
      periodNumber: 1,
      assignmentId: "a1",
      teacherId: "t1",
      subjectId: "s1",
      label: "Mathematics",
      entryType: "TEACHING",
      isLocked: true,
      notes: "Principal choice"
    };
    const result = generateTimetable(generatorInput({
      settings: { ...defaultGeneratorSettings("2026-27"), baseDraftId: "draft-base" },
      baseDraft: {
        id: "draft-base",
        academicYear: "2026-27",
        name: "Manual Base",
        status: "ACTIVE",
        entries: [lockedEntry]
      }
    }));
    expect(result.entries).toContainEqual(expect.objectContaining({
      classSectionId: "c1",
      dayOfWeek: "MONDAY",
      periodNumber: 1,
      assignmentId: "a1",
      isLocked: true,
      notes: "Principal choice"
    }));
  });

  it("uses locked entries in other base-draft classes to avoid teacher conflicts", () => {
    const result = generateTimetable(generatorInput({
      settings: {
        ...defaultGeneratorSettings("2026-27"),
        scope: "CLASS",
        classSectionId: "c1",
        baseDraftId: "draft-base"
      },
      assignments: [
        { id: "a1", academicYear: "2026-27", classSectionId: "c1", teacherId: "t1", subjectId: "s1", periodsPerWeek: 1 },
        { id: "a2", academicYear: "2026-27", classSectionId: "c2", teacherId: "t1", subjectId: "s2", periodsPerWeek: 1 }
      ],
      baseDraft: {
        id: "draft-base",
        academicYear: "2026-27",
        name: "Manual Base",
        status: "DRAFT",
        entries: [{
          academicYear: "2026-27",
          classSectionId: "c2",
          dayOfWeek: "MONDAY",
          periodNumber: 1,
          assignmentId: "a2",
          teacherId: "t1",
          subjectId: "s2",
          entryType: "TEACHING",
          isLocked: true
        }]
      }
    }));
    expect(result.entries).toContainEqual(expect.objectContaining({
      classSectionId: "c2",
      dayOfWeek: "MONDAY",
      periodNumber: 1,
      isLocked: true
    }));
    expect(result.entries).not.toContainEqual(expect.objectContaining({
      classSectionId: "c1",
      teacherId: "t1",
      dayOfWeek: "MONDAY",
      periodNumber: 1
    }));
    expect(result.validation.errors.some((row) => row.code === "TEACHER_DOUBLE_BOOKED")).toBe(false);
  });

  it("applies and respects a configured fixed period", () => {
    const result = generateTimetable(generatorInput({
      fixedPeriods: [{
        id: "fixed-1",
        academicYear: "2026-27",
        classSectionId: "c1",
        teacherId: "t1",
        subjectId: "s1",
        dayOfWeek: "MONDAY",
        periodNumber: 1,
        label: "Fixed Mathematics"
      }]
    }));
    expect(result.entries).toContainEqual(expect.objectContaining({
      classSectionId: "c1",
      dayOfWeek: "MONDAY",
      periodNumber: 1,
      entryType: "FIXED",
      assignmentId: "a1",
      isLocked: true
    }));
  });

  it("reports unresolved workload when placement is impossible", () => {
    const result = generateTimetable(generatorInput({
      assignments: [
        { id: "a1", academicYear: "2026-27", classSectionId: "c1", teacherId: "t1", subjectId: "s1", periodsPerWeek: 1 }
      ],
      templates: [template("FRIDAY", 1)],
      unavailability: [{ teacherId: "t1", dayOfWeek: "FRIDAY", periodNumber: 1 }]
    }));
    expect(result.summary.unresolvedPeriods).toBe(1);
    expect(result.unresolved[0]).toMatchObject({
      assignmentId: "a1",
      remainingPeriods: 1,
      reason: "The teacher is unavailable in every remaining class slot."
    });
  });

  it("spreads a subject to avoid consecutive warnings where possible", () => {
    const result = generateTimetable(generatorInput({
      assignments: [
        { id: "a1", academicYear: "2026-27", classSectionId: "c1", teacherId: "t1", subjectId: "s1", periodsPerWeek: 2 }
      ]
    }));
    expect(result.summary.placedPeriods).toBe(2);
    expect(result.validation.warnings.some((row) => row.code === "CONSECUTIVE_SUBJECT")).toBe(false);
    expect(new Set(result.entries.map((row) => row.dayOfWeek)).size).toBe(2);
  });

  it("produces entries that pass the existing hard conflict validator", () => {
    const result = generateTimetable(generatorInput());
    expect(result.validation.errors).toEqual([]);
  });

  it("saves generated work as a new DRAFT, never ACTIVE", async () => {
    const result = generateTimetable(generatorInput());
    const create = vi.fn().mockResolvedValue({ id: "generated-draft" });
    await saveGeneratedTimetableDraft({ timetableDraft: { create } }, result, "director-1");
    const data = generatedDraftCreateData(result, "director-1");
    expect(data.status).toBe("DRAFT");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Generated Timetable - 2026-06-19 10:30",
        status: "DRAFT",
        createdByUserId: "director-1"
      }),
      include: { entries: true }
    });
  });
});
