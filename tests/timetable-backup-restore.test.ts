import { describe, expect, it, vi } from "vitest";
import { emptyEntityResult, type ValidatedBackup } from "../lib/restore";
import { restoreTimetableFoundationData } from "../lib/restore-database";

function timetableBackup(
  overrides: Partial<Pick<
    ValidatedBackup,
    "timetableTeachers" | "timetableSubjects" | "timetableClassSections"
    | "timetablePeriodTemplates" | "timetableAssignments"
    | "timetableTeacherUnavailability" | "timetableFixedPeriods"
    | "timetableDrafts" | "timetableEntries"
  >> = {}
) {
  return {
    timetableTeachers: [],
    timetableSubjects: [],
    timetableClassSections: [],
    timetablePeriodTemplates: [],
    timetableAssignments: [],
    timetableTeacherUnavailability: [],
    timetableFixedPeriods: [],
    timetableDrafts: [],
    timetableEntries: [],
    ...overrides
  };
}

function timetableResult() {
  return {
    timetableTeachers: emptyEntityResult(),
    timetableSubjects: emptyEntityResult(),
    timetableClassSections: emptyEntityResult(),
    timetablePeriodTemplates: emptyEntityResult(),
    timetableAssignments: emptyEntityResult(),
    timetableTeacherUnavailability: emptyEntityResult(),
    timetableFixedPeriods: emptyEntityResult()
    ,timetableDrafts: emptyEntityResult()
    ,timetableEntries: emptyEntityResult()
  };
}

function emptyDelegate() {
  return {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn()
  };
}

function timetableClient() {
  return {
    timetableTeacher: emptyDelegate(),
    timetableSubject: emptyDelegate(),
    timetableClassSection: emptyDelegate(),
    timetablePeriodTemplate: emptyDelegate(),
    timetableAssignment: emptyDelegate(),
    timetableTeacherUnavailability: emptyDelegate(),
    timetableFixedPeriod: emptyDelegate()
    ,timetableDraft: emptyDelegate()
    ,timetableEntry: emptyDelegate()
  };
}

describe("timetable foundation restore", () => {
  it("creates teachers, subjects, classes, and assignments when mappings exist", async () => {
    const client = timetableClient();
    client.timetableTeacher.create.mockImplementation(async ({ data }) => data);
    client.timetableSubject.create.mockImplementation(async ({ data }) => data);
    client.timetableClassSection.create.mockImplementation(async ({ data }) => data);
    client.timetableAssignment.create.mockImplementation(async ({ data }) => data);
    const result = timetableResult();

    await restoreTimetableFoundationData(
      client as never,
      timetableBackup({
        timetableTeachers: [{
          id: "teacher-1", name: "Rani Sharma", shortName: "RS",
          maxPeriodsPerWeek: 30, isActive: false
        }],
        timetableSubjects: [{
          id: "subject-1", name: "Mathematics", shortName: "MATH", isActive: true
        }],
        timetableClassSections: [{
          id: "class-1", academicYear: "2026-27", className: "VI", section: "A",
          displayName: "VI A", groupName: "VI-X", isActive: true
        }],
        timetableAssignments: [{
          id: "assignment-1", academicYear: "2026-27", classSectionId: "class-1",
          subjectId: "subject-1", teacherId: "teacher-1", periodsPerWeek: 6
        }]
      }),
      result
    );

    expect(result.timetableTeachers.created).toBe(1);
    expect(result.timetableSubjects.created).toBe(1);
    expect(result.timetableClassSections.created).toBe(1);
    expect(result.timetableAssignments.created).toBe(1);
    expect(client.timetableTeacher.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: "teacher-1", isActive: false })
    });
    expect(client.timetableAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        classSectionId: "class-1",
        subjectId: "subject-1",
        teacherId: "teacher-1"
      })
    });
  });

  it("skips an unchanged duplicate class section", async () => {
    const client = timetableClient();
    const existing = {
      id: "local-class",
      academicYear: "2026-27",
      className: "VI",
      section: "A",
      displayName: "VI A",
      groupName: "VI-X",
      isActive: true
    };
    client.timetableClassSection.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const result = timetableResult();

    await restoreTimetableFoundationData(
      client as never,
      timetableBackup({
        timetableClassSections: [{
          id: "backup-class",
          academicYear: "2026-27",
          className: "VI",
          section: "A",
          displayName: "VI A",
          groupName: "VI-X",
          isActive: true
        }]
      }),
      result
    );

    expect(result.timetableClassSections.skipped).toBe(1);
    expect(client.timetableClassSection.create).not.toHaveBeenCalled();
    expect(client.timetableClassSection.update).not.toHaveBeenCalled();
  });

  it("warns and skips assignments when a mapping is missing", async () => {
    const client = timetableClient();
    const result = timetableResult();

    await restoreTimetableFoundationData(
      client as never,
      timetableBackup({
        timetableAssignments: [{
          id: "assignment-1",
          academicYear: "2026-27",
          classSectionId: "missing-class",
          subjectId: "missing-subject",
          teacherId: "missing-teacher",
          periodsPerWeek: 6
        }]
      }),
      result
    );

    expect(result.timetableAssignments.skipped).toBe(1);
    expect(result.timetableAssignments.warnings).toHaveLength(3);
    expect(client.timetableAssignment.create).not.toHaveBeenCalled();
  });

  it("restores drafts and entries when all timetable mappings are safe", async () => {
    const client = timetableClient();
    for (const delegate of [
      client.timetableTeacher, client.timetableSubject, client.timetableClassSection,
      client.timetableAssignment, client.timetableDraft, client.timetableEntry
    ]) {
      delegate.create.mockImplementation(async ({ data }) => data);
    }
    const result = timetableResult();
    await restoreTimetableFoundationData(
      client as never,
      timetableBackup({
        timetableTeachers: [{ id: "teacher-1", name: "Rani", shortName: "RS", maxPeriodsPerWeek: 30 }],
        timetableSubjects: [{ id: "subject-1", name: "Math", shortName: "MATH" }],
        timetableClassSections: [{ id: "class-1", academicYear: "2026-27", className: "VI", section: "A", groupName: "VI-X" }],
        timetableAssignments: [{ id: "assignment-1", academicYear: "2026-27", classSectionId: "class-1", subjectId: "subject-1", teacherId: "teacher-1", periodsPerWeek: 6 }],
        timetableDrafts: [{ id: "draft-1", academicYear: "2026-27", name: "Manual Draft", status: "DRAFT" }],
        timetableEntries: [{ id: "entry-1", draftId: "draft-1", academicYear: "2026-27", classSectionId: "class-1", assignmentId: "assignment-1", teacherId: "teacher-1", subjectId: "subject-1", dayOfWeek: "MONDAY", periodNumber: 1, entryType: "TEACHING" }]
      }),
      result
    );
    expect(result.timetableDrafts.created).toBe(1);
    expect(result.timetableEntries.created).toBe(1);
    expect(client.timetableEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ draftId: "draft-1", classSectionId: "class-1", assignmentId: "assignment-1" })
    });
  });

  it("skips draft entries with unsafe missing mappings", async () => {
    const client = timetableClient();
    client.timetableDraft.create.mockImplementation(async ({ data }) => data);
    const result = timetableResult();
    await restoreTimetableFoundationData(
      client as never,
      timetableBackup({
        timetableDrafts: [{ id: "draft-1", academicYear: "2026-27", name: "Manual Draft", status: "DRAFT" }],
        timetableEntries: [{ id: "entry-1", draftId: "draft-1", academicYear: "2026-27", classSectionId: "missing", dayOfWeek: "MONDAY", periodNumber: 1, entryType: "EMPTY" }]
      }),
      result
    );
    expect(result.timetableEntries.skipped).toBe(1);
    expect(result.timetableEntries.warnings.some((warning) => warning.includes("class section"))).toBe(true);
    expect(client.timetableEntry.create).not.toHaveBeenCalled();
  });
});
