import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OBJECT_SCOPED_PERMISSIONS, roleSupportsObjectScopedPermission } from "@/lib/iam/permission-governance";
import { can } from "@/lib/permissions";
import { requestBodyLimitBytes } from "@/lib/request-security";
import { parentAttendanceMonth } from "@/lib/parent-academics";
import { exactTimetableTransitionRetry, ExaminationTimetableError, expectedTimetableVersion, validateExaminationTimetableRows } from "@/lib/examination-timetables";

const source = (path: string) => readFileSync(path, "utf8");

describe("Prompt 23D Parent attendance and examination timetable", () => {
  it("keeps Parent access object-scoped and leadership publication separate", () => {
    expect(can("PARENT", "VIEW_OWN_ATTENDANCE")).toBe(true);
    expect(can("PARENT", "VIEW_OWN_EXAM_TIMETABLE")).toBe(true);
    expect(can("TEACHER", "PUBLISH_EXAM_TIMETABLE")).toBe(false);
    expect(can("PRINCIPAL", "MANAGE_EXAM_TIMETABLE")).toBe(true);
    expect(can("PRINCIPAL", "PUBLISH_EXAM_TIMETABLE")).toBe(true);
    expect(OBJECT_SCOPED_PERMISSIONS.has("VIEW_OWN_ATTENDANCE")).toBe(true);
    expect(OBJECT_SCOPED_PERMISSIONS.has("VIEW_OWN_EXAM_TIMETABLE")).toBe(true);
    expect(roleSupportsObjectScopedPermission("TEACHER", "PUBLISH_EXAM_TIMETABLE")).toBe(false);
  });

  it("parses a bounded month without inventing attendance policy", () => {
    const range = parentAttendanceMonth("2026-08");
    expect(range.month).toBe("2026-08");
    expect(range.from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(() => parentAttendanceMonth("2026-13")).toThrow("valid attendance month");
    const academics = source("lib/parent-academics.ts");
    expect(academics).toContain("attendancePercentage: null");
    expect(academics).toContain("workingDayCount: null");
    expect(academics).not.toMatch(/remarks:\s*true/);
  });

  it("validates time order, duplicate papers, and overlapping cohort slots", () => {
    const valid = { subjectPaperId: "paper-one", examDate: "2026-08-10", startTime: "09:00", endTime: "10:00", reportingTime: "08:30", displayOrder: 1 };
    expect(validateExaminationTimetableRows([valid]).issues).toEqual([]);
    expect(() => validateExaminationTimetableRows([{ ...valid, endTime: "09:00" }])).toThrow("after its start time");
    expect(() => validateExaminationTimetableRows([valid, { ...valid, displayOrder: 2 }])).toThrow("only once");
    expect(validateExaminationTimetableRows([valid, { ...valid, subjectPaperId: "paper-two", startTime: "09:30", endTime: "10:30", displayOrder: 2 }]).issues).toHaveLength(1);
  });

  it("requires positive compare-and-set versions and bounded request bodies", () => {
    expect(expectedTimetableVersion(1)).toBe(1);
    expect(() => expectedTimetableVersion(0)).toThrow(ExaminationTimetableError);
    expect(requestBodyLimitBytes("/api/exam-timetables/version/workflow")).toBe(128 * 1024);
  });

  it("accepts only the exact immediately completed lifecycle retry", () => {
    const exact = {
      currentVersion: 8,
      expectedVersion: 7,
      storedActorUserId: "principal-one",
      actorUserId: "principal-one",
      reasonPairs: [["Governed publication", "Governed publication"]] as const
    };
    expect(exactTimetableTransitionRetry(exact)).toBe(true);
    expect(exactTimetableTransitionRetry({ ...exact, expectedVersion: 1 })).toBe(false);
    expect(exactTimetableTransitionRetry({ ...exact, actorUserId: "principal-two" })).toBe(false);
    expect(exactTimetableTransitionRetry({ ...exact, reasonPairs: [["Governed publication", "Different reason"]] })).toBe(false);
  });

  it("revalidates the active Parent role, session, opaque handle, family link, and enrollment", () => {
    const contexts = source("lib/iam/contexts.ts");
    for (const evidence of ["activeRoleAssignmentId", 'role: "PARENT"', "activeChildLinkId", "authorizationVersion", "childHandle", "academicYearEnrollments", 'status: "ACTIVE"', "guardianId"]) {
      expect(contexts).toContain(evidence);
    }
    expect(contexts).toContain('opaqueHandle("CHILD"');
    expect(contexts).toContain("handleMatches(input.childHandle, handle)");
    const switcher = source("components/iam/active-context-switcher.tsx");
    expect(switcher).toContain("htmlFor={childSelectId}");
    expect(switcher).toContain("id={childSelectId}");
    expect(switcher).toContain("htmlFor={roleSelectId}");
  });

  it("exposes only read-only no-store Parent APIs with no raw Student selector", () => {
    for (const path of ["app/api/parent/attendance/route.ts", "app/api/parent/exam-timetable/route.ts"]) {
      const route = source(path);
      expect(route).toContain("export async function GET");
      expect(route).not.toContain("export async function POST");
      expect(route).not.toMatch(/studentId|admissionNo/);
      expect(route).toContain("childContext");
    }
    expect(source("lib/parent-academics-api.ts")).toContain('"Cache-Control": "private, no-store"');
  });

  it("preserves published rows and history with database triggers", () => {
    const migration = source("prisma/migrations/20260801183000_parent_attendance_exam_timetable/migration.sql");
    expect(migration).toContain("exam_timetable_row_update_draft_only");
    expect(migration).toContain("exam_timetable_published_history_no_delete");
    expect(migration).toContain("exam_timetable_event_append_only_update");
    expect(migration).toContain('CREATE UNIQUE INDEX "ExaminationTimetableVersion_currentPublicationKey_key"');
    const restore = source("lib/exam-governance-backup.ts");
    expect(restore).toContain('typeof client.$transaction === "function"');
    expect(restore).toContain("await restoreRows(client)");
  });

  it("keeps Parent print routes authenticated and child-scoped", () => {
    for (const path of ["app/parent/attendance/print/page.tsx", "app/parent/exam-timetable/print/page.tsx"]) {
      const page = source(path);
      expect(page).toContain("requirePermission");
      expect(page).toContain('user.role !== "PARENT"');
      expect(page).toContain("childContext");
      expect(page).toContain("ParentAcademicAccessError");
      expect(page).toContain("No Student information is shown.");
      expect(page).not.toContain("studentId");
    }
  });
});
