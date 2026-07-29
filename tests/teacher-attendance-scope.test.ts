import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  attendanceDateBelongsToAcademicYear,
  AttendanceScopeError,
  attendanceScopeOptionsForDate,
  attendanceScopeWhere,
  requireAttendanceReportFilter,
  requireAttendanceTarget,
  resolveTeacherAttendanceScope
} from "../lib/teacher-attendance-scope";
import { requestBodyLimitBytes } from "../lib/request-security";

const date = new Date("2026-07-29T00:00:00.000Z");
const nextDate = new Date("2026-07-30T00:00:00.000Z");

function primary(id: string, className: string, section: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    academicYear: "2026-27",
    classSection: {
      academicYear: "2026-27",
      className,
      section,
      isActive: true
    },
    subject: { isActive: true },
    ...overrides
  };
}

function substitute(overrides: Record<string, unknown> = {}) {
  return {
    id: "substitute-1",
    assignmentDate: date,
    academicYear: "2026-27",
    className: "VII",
    section: "B",
    status: "CONFIRMED",
    timetableAssignment: null,
    ...overrides
  };
}

function client(input: {
  staff?: any;
  substitutes?: any[];
}) {
  return {
    staffMember: {
      findUnique: async () => input.staff ?? null
    },
    substituteAssignment: {
      findMany: async () => input.substitutes ?? []
    }
  };
}

function activeStaff(assignments: any[] = []) {
  return {
    id: "staff-a",
    status: "ACTIVE",
    fullName: "QA23C Teacher A",
    displayName: null,
    timetableTeacher: {
      isActive: true,
      assignments
    }
  };
}

describe("Prompt 23C exact Teacher attendance scope", () => {
  it("authorises only the exact active timetable class, section, year, and valid date", async () => {
    const scope = await resolveTeacherAttendanceScope(
      client({ staff: activeStaff([primary("assignment-a", "VI", "A")]) }) as never,
      { id: "teacher-a", role: "TEACHER" },
      { academicYear: "2026-27", date }
    );
    expect(attendanceScopeOptionsForDate(scope, date)).toEqual([
      { className: "VI", section: "A", source: "TIMETABLE" }
    ]);
    expect(requireAttendanceTarget(scope, {
      attendanceDate: date,
      academicYear: "2026-27",
      className: "VI",
      section: "A"
    })).toEqual({ source: "TIMETABLE", evidenceId: "assignment-a" });
    for (const target of [
      { attendanceDate: date, academicYear: "2026-27", className: "VI", section: "B" },
      { attendanceDate: date, academicYear: "2026-27", className: "VII", section: "A" },
      { attendanceDate: date, academicYear: "2025-26", className: "VI", section: "A" }
    ]) expect(() => requireAttendanceTarget(scope, target)).toThrow(AttendanceScopeError);
  });

  it("fails closed for unlinked, inactive Staff, inactive timetable Teachers, and inactive assignments", async () => {
    const user = { id: "teacher-a", role: "TEACHER" as const };
    const cases = [
      null,
      { ...activeStaff(), status: "LEFT" },
      { ...activeStaff(), timetableTeacher: { isActive: false, assignments: [] } },
      activeStaff([primary("inactive-class", "VI", "A", {
        classSection: {
          academicYear: "2026-27",
          className: "VI",
          section: "A",
          isActive: false
        }
      })]),
      activeStaff([primary("inactive-subject", "VI", "A", { subject: { isActive: false } })]),
      activeStaff([primary("old-year", "VI", "A", { academicYear: "2025-26" })])
    ];
    for (const staff of cases) {
      const scope = await resolveTeacherAttendanceScope(
        client({ staff }) as never,
        user,
        { academicYear: "2026-27", date }
      );
      expect(scope.broad).toBe(false);
      expect(scope.targets).toEqual([]);
    }
  });

  it("does not infer access from non-canonical class/section values or blank-letter mismatches", async () => {
    const scope = await resolveTeacherAttendanceScope(
      client({
        staff: activeStaff([
          primary("lowercase", "vi", "A"),
          primary("spaced", "VI", " A "),
          primary("blank", "VI", "")
        ])
      }) as never,
      { id: "teacher-a", role: "TEACHER" },
      { academicYear: "2026-27", date }
    );
    expect(scope.targets).toHaveLength(1);
    expect(scope.targets[0]).toMatchObject({ className: "VI", section: "" });
    expect(() => requireAttendanceTarget(scope, {
      attendanceDate: date,
      academicYear: "2026-27",
      className: "VI",
      section: "A"
    })).toThrow(AttendanceScopeError);
  });

  it("grants substitute access only for a confirmed exact dated scope and expires automatically", async () => {
    const scope = await resolveTeacherAttendanceScope(
      client({
        staff: activeStaff([]),
        substitutes: [
          substitute(),
          substitute({ id: "draft", className: "VIII", status: "DRAFT" }),
          substitute({ id: "cancelled", className: "IX", status: "CANCELLED" }),
          substitute({ id: "null-section", className: "X", section: null })
        ]
      }) as never,
      { id: "teacher-a", role: "TEACHER" },
      { academicYear: "2026-27", date }
    );
    expect(attendanceScopeOptionsForDate(scope, date)).toEqual([
      { className: "VII", section: "B", source: "SUBSTITUTE" }
    ]);
    expect(requireAttendanceTarget(scope, {
      attendanceDate: date,
      academicYear: "2026-27",
      className: "VII",
      section: "B"
    }).source).toBe("SUBSTITUTE");
    expect(() => requireAttendanceTarget(scope, {
      attendanceDate: nextDate,
      academicYear: "2026-27",
      className: "VII",
      section: "B"
    })).toThrow(AttendanceScopeError);
  });

  it("rejects a substitute whose linked timetable evidence disagrees with its exact cohort", async () => {
    const scope = await resolveTeacherAttendanceScope(
      client({
        staff: activeStaff([]),
        substitutes: [substitute({
          timetableAssignment: {
            academicYear: "2026-27",
            classSection: {
              academicYear: "2026-27",
              className: "VII",
              section: "A",
              isActive: true
            },
            subject: { isActive: true }
          }
        })]
      }) as never,
      { id: "teacher-a", role: "TEACHER" },
      { academicYear: "2026-27", date }
    );
    expect(scope.targets).toEqual([]);
  });

  it("builds the identical scope contract for reports, CSV, and dashboard totals", async () => {
    const scope = await resolveTeacherAttendanceScope(
      client({
        staff: activeStaff([primary("assignment-a", "VI", "A")]),
        substitutes: [substitute()]
      }) as never,
      { id: "teacher-a", role: "TEACHER" },
      { academicYear: "2026-27", from: date, to: nextDate }
    );
    expect(attendanceScopeWhere(scope)).toEqual({
      OR: [
        { academicYear: "2026-27", className: "VI", section: "A" },
        { academicYear: "2026-27", className: "VII", section: "B", attendanceDate: date }
      ]
    });
    expect(() => requireAttendanceReportFilter(scope, {
      academicYear: "2026-27",
      className: "VI",
      section: "B"
    })).toThrow(AttendanceScopeError);
    expect(() => requireAttendanceReportFilter(scope, {
      academicYear: "2026-27",
      className: "VI",
      section: "A"
    })).not.toThrow();
  });

  it("keeps leadership separate while Parent/Accountant/Viewer remain permission-gated elsewhere", async () => {
    const leadership = await resolveTeacherAttendanceScope(
      client({}) as never,
      { id: "principal", role: "PRINCIPAL" },
      { academicYear: "2026-27", date }
    );
    expect(leadership).toMatchObject({ broad: true, targets: [] });
    expect(requireAttendanceTarget(leadership, {
      attendanceDate: date,
      academicYear: "2026-27",
      className: "VI",
      section: "A"
    }).source).toBe("LEADERSHIP_PERMISSION");
    const permissions = readFileSync("lib/permissions.ts", "utf8");
    expect(permissions).toContain('TEACHER: new Set(["VIEW_TEACHER_PLACEHOLDER", "VIEW_STUDENT_ATTENDANCE"');
    expect(permissions).toContain('"VIEW_STUDENT_ATTENDANCE_REPORTS"');
  });

  it("enforces bounded bodies, private responses, CAS, safe scope errors, and append-only correction audit", () => {
    expect(requestBodyLimitBytes("/api/attendance/students")).toBe(512 * 1024);
    const route = readFileSync("app/api/attendance/students/route.ts", "utf8");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain("updatedAt: expected");
    expect(route).toContain("changed.count !== 1");
    expect(route).toContain("AttendanceConflictError");
    expect(route).toContain("logUserAction");
    expect(route).toContain("correctionReason");
    expect(route).not.toContain("studentName:");
    const exportRoute = readFileSync("app/api/attendance/students/reports/export/route.ts", "utf8");
    expect(exportRoute).toContain("attendanceScopeWhere(resolved)");
    expect(exportRoute).toContain("requireAttendanceReportFilter");
    expect(exportRoute).toContain('"Cache-Control": "private, no-store"');
    const dashboard = readFileSync("lib/dashboard.ts", "utf8");
    expect(dashboard).toContain("attendanceScopeWhere(teacherAttendanceScope)");
    const styles = readFileSync("app/globals.css", "utf8");
    expect(styles).toContain(".attendance-page .subnav a { display: inline-flex; min-height: 44px;");
    const qaHarness = readFileSync("scripts/qa23c-copied-db.ts", "utf8");
    expect(qaHarness).toContain("updatedAt: previous.updatedAt.toISOString()");
    expect(qaHarness).toContain("updatedAt: new Date(saved.previous.updatedAt)");
  });

  it("treats only April-to-March dates as belonging to the selected academic year", () => {
    expect(attendanceDateBelongsToAcademicYear(new Date("2026-04-01T00:00:00Z"), "2026-27")).toBe(true);
    expect(attendanceDateBelongsToAcademicYear(new Date("2027-03-31T00:00:00Z"), "2026-27")).toBe(true);
    expect(attendanceDateBelongsToAcademicYear(new Date("2026-03-31T00:00:00Z"), "2026-27")).toBe(false);
    expect(attendanceDateBelongsToAcademicYear(new Date("2027-04-01T00:00:00Z"), "2026-27")).toBe(false);
  });
});
