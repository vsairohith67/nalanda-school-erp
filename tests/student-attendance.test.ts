import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activeStudentsForScope, attendanceDay, attendanceReportCsv, attendanceReportData, attendanceScope, attendanceTotals, localDateText, optionalAttendanceFilter, validateAttendanceRecords } from "../lib/student-attendance";

describe("student attendance foundation", () => {
  it("normalizes a daily class/section scope and rejects invalid dates", () => {
    expect(attendanceScope({ attendanceDate: "2026-06-27", className: " vi ", section: " a ", academicYear: "2026-27" })).toMatchObject({ attendanceDate: new Date("2026-06-27T00:00:00.000Z"), className: "VI", section: "A" });
    expect(() => attendanceDay("2026-02-30")).toThrow("valid attendance date");
    expect(localDateText(new Date(2026, 5, 28, 12))).toBe("2026-06-28");
    expect(optionalAttendanceFilter("  a ")).toBe("A");
    expect(optionalAttendanceFilter("   ")).toBeUndefined();
  });

  it("supports every manual status and prevents a student duplicate", () => {
    const rows = validateAttendanceRecords([
      { studentId: "s1", status: "PRESENT" }, { studentId: "s2", status: "ABSENT" },
      { studentId: "s3", status: "LATE" }, { studentId: "s4", status: "HALF_DAY" }, { studentId: "s5", status: "EXCUSED" }
    ]);
    expect(attendanceTotals(rows)).toEqual({ PRESENT: 1, ABSENT: 1, LATE: 1, HALF_DAY: 1, EXCUSED: 1, total: 5 });
    expect(() => validateAttendanceRecords([{ studentId: "s1", status: "PRESENT" }, { studentId: "s1", status: "ABSENT" }])).toThrow("more than once");
  });

  it("calculates report totals and per-student monthly summaries", async () => {
    let query: any;
    const client = { studentAttendanceSession: { findMany: async (args: any) => { query = args; return [{ id: "session", attendanceDate: new Date("2026-06-27T00:00:00.000Z"), className: "VI", section: "A", academicYear: "2026-27", status: "SUBMITTED", records: [
      { admissionNo: "N1", status: "ABSENT", remarks: null, student: { studentName: "Asha", rollNo: "1" } },
      { admissionNo: "N2", status: "LATE", remarks: "Bus delay", student: { studentName: "Bilal", rollNo: "2" } }
    ] }]; } } };
    const report = await attendanceReportData(client as never, { from: new Date("2026-06-01"), to: new Date("2026-06-30"), academicYear: "2026-27" });
    expect(report.totals).toMatchObject({ total: 2, ABSENT: 1, LATE: 1 });
    expect(report.byStudent).toEqual([expect.objectContaining({ studentName: "Asha", absent: 1 }), expect.objectContaining({ studentName: "Bilal", late: 1 })]);
    expect(query.where.status).toEqual({ in: ["SUBMITTED", "LOCKED"] });
  });

  it("handles empty classes and no-data reports without creating technical output", async () => {
    let where: any;
    const students = await activeStudentsForScope({ student: { findMany: async (args: any) => { where = args.where; return []; } } } as never, { academicYear: "2026-27", className: "VI", section: "A" });
    expect(students).toEqual([]);
    expect(where).toMatchObject({ academicYear: "2026-27", className: "VI", section: "A", status: "Active", deletedAt: null });
    const report = await attendanceReportData({ studentAttendanceSession: { findMany: async () => [] } } as never, { from: new Date("2026-06-01"), to: new Date("2026-06-30"), academicYear: "2026-27" });
    expect(report).toMatchObject({ sessions: [], rows: [], byStudent: [], totals: { total: 0 } });
  });

  it("exports correct CSV data and neutralizes spreadsheet formulas", () => {
    const output = attendanceReportCsv([{ attendanceDate: new Date("2026-06-27T00:00:00.000Z"), className: "VI", section: "A", admissionNo: "N1", rollNo: "2", studentName: "=BAD()", status: "LATE", remarks: "+unsafe" }]);
    expect(output).toContain('"Date","Class","Section","Admission No","Roll No","Student","Attendance","Remarks"');
    expect(output).toContain('"2026-06-27","VI","A","N1","2","\'=BAD()","LATE","\'+unsafe"');
  });

  it("keeps create/save/submit/correct/lock, exact scope, audit, and inactive-student safety enforced in the API", () => {
    const api = readFileSync("app/api/attendance/students/route.ts", "utf8");
    expect(api).toContain("studentAttendanceSession.create");
    expect(api).toContain("studentAttendanceSession.updateMany");
    expect(api).toContain('action === "clear"');
    expect(api).toContain('action === "submit"');
    expect(api).toContain('action === "correct"');
    expect(api).toContain('action === "lock"');
    expect(api).toContain("requireAttendanceTarget");
    expect(api).toContain("updatedAt: expected");
    expect(api).toContain("STUDENT_ATTENDANCE_");
    expect(api).toContain("correctionReason");
    expect(api).toContain("Mark every active student before submitting attendance");
    expect(api.match(/requireApiPermission\("MANAGE_STUDENT_ATTENDANCE"\)/g)?.length).toBeGreaterThanOrEqual(1);
    expect(api.indexOf('requireApiPermission("VIEW_STUDENT_ATTENDANCE")')).toBeLessThan(api.indexOf("request.json()"));
  });

  it("guards entry, reports, export, and keeps Parent attendance read-only", () => {
    expect(readFileSync("app/attendance/students/page.tsx", "utf8")).toContain('requirePermission("VIEW_STUDENT_ATTENDANCE")');
    expect(readFileSync("app/attendance/students/reports/page.tsx", "utf8")).toContain('requirePermission("VIEW_STUDENT_ATTENDANCE_REPORTS")');
    expect(readFileSync("app/api/attendance/students/reports/export/route.ts", "utf8")).toContain('requireApiPermission("VIEW_STUDENT_ATTENDANCE_REPORTS")');
    const parent = readFileSync("app/parent/page.tsx", "utf8");
    expect(parent).toContain('href="/parent/attendance"');
    expect(parent).toContain("View posted daily attendance and authoritative counts");
    expect(parent).not.toMatch(/Mark Attendance|Correct Attendance|Delete Attendance/);
    const entry = readFileSync("components/student-attendance-entry.tsx", "utf8");
    expect(entry).toContain("selectionChanged()");
    expect(entry).toContain("Selection changed. Select Load Attendance");
    expect(entry).toContain(": hasLoaded");
    expect(entry).toContain("It cannot be unlocked in the app");
    expect(entry).toContain("Apply attendance correction?");
    expect(entry).toContain("No authorised attendance scope");
    expect(entry).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    const teacher = readFileSync("app/teacher/page.tsx", "utf8");
    expect(teacher).toContain('permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE")');
  });
});
