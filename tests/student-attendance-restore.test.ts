import { describe, expect, it } from "vitest";
import { restoreStudentAttendanceData } from "../lib/restore-database";
import { emptyEntityResult } from "../lib/restore";

function fixture() {
  const sessions = new Map<string, any>(); const records = new Map<string, any>();
  const scopeKey = (where: any) => { const value = where.attendanceDate_className_section_academicYear; return `${new Date(value.attendanceDate).toISOString()}|${value.className}|${value.section}|${value.academicYear}`; };
  return { sessions, records, client: {
    student: { findUnique: async ({ where }: any) => where.id === "student-local" ? { academicYear: "2026-27", className: "VI", section: "A" } : null },
    studentAttendanceSession: {
      findUnique: async ({ where }: any) => sessions.get(scopeKey(where)) ?? null,
      create: async ({ data }: any) => { const row = { ...data }; sessions.set(`${new Date(data.attendanceDate).toISOString()}|${data.className}|${data.section}|${data.academicYear}`, row); return row; },
      update: async ({ where, data }: any) => { const key = scopeKey(where); const row = { ...sessions.get(key), ...data }; sessions.set(key, row); return row; }
    },
    studentAttendanceRecord: {
      findUnique: async ({ where }: any) => records.get(`${where.sessionId_studentId.sessionId}|${where.sessionId_studentId.studentId}`) ?? null,
      create: async ({ data }: any) => { records.set(`${data.sessionId}|${data.studentId}`, { ...data }); return data; },
      update: async ({ where, data }: any) => { const key = `${where.sessionId_studentId.sessionId}|${where.sessionId_studentId.studentId}`; records.set(key, { ...records.get(key), ...data }); return records.get(key); }
    }
  } };
}

const backup = { studentAttendanceSessions: [{ id: "session-backup", attendanceDate: "2026-06-27T00:00:00.000Z", className: "VI", section: "A", academicYear: "2026-27", status: "SUBMITTED", takenByUserId: "backup-user", submittedByUserId: "backup-user" }], studentAttendanceRecords: [{ id: "record-backup", sessionId: "session-backup", studentId: "student-backup", admissionNo: "NPS1", status: "LATE", remarks: "Bus delay" }] };

describe("student attendance restore", () => {
  it("restores sessions before records and maps existing students/users", async () => {
    const f = fixture(); const result = { studentAttendanceSessions: emptyEntityResult(), studentAttendanceRecords: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentAttendanceData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map([["backup-user", "user-local"]]), result);
    expect(result.studentAttendanceSessions.created).toBe(1); expect(result.studentAttendanceRecords.created).toBe(1);
    expect([...f.sessions.values()][0]).toMatchObject({ status: "SUBMITTED", takenByUserId: "user-local" });
    expect([...f.records.values()][0]).toMatchObject({ studentId: "student-local", status: "LATE" });
  });

  it("updates matching rows without creating duplicates and skips unsafe missing links", async () => {
    const f = fixture(); const first = { studentAttendanceSessions: emptyEntityResult(), studentAttendanceRecords: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentAttendanceData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map(), first);
    const second = { studentAttendanceSessions: emptyEntityResult(), studentAttendanceRecords: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentAttendanceData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map(), second);
    expect(second.studentAttendanceSessions.updated).toBe(1); expect(second.studentAttendanceRecords.updated).toBe(1); expect(f.sessions.size).toBe(1); expect(f.records.size).toBe(1);
    const skipped = { studentAttendanceSessions: emptyEntityResult(), studentAttendanceRecords: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentAttendanceData(f.client as never, backup, new Map(), new Map(), skipped);
    expect(skipped.studentAttendanceRecords.skipped).toBe(1); expect(skipped.warnings[0]).toContain("could not be matched safely");
  });

  it("skips a record when its student is outside the restored session scope", async () => {
    const f = fixture();
    f.client.student.findUnique = async () => ({ academicYear: "2026-27", className: "VII", section: "A" });
    const result = { studentAttendanceSessions: emptyEntityResult(), studentAttendanceRecords: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentAttendanceData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map(), result);
    expect(result.studentAttendanceRecords.skipped).toBe(1);
    expect(result.warnings[0]).toContain("does not belong to the restored class");
    expect(f.records.size).toBe(0);
  });
});
