import { describe, expect, it } from "vitest";
import { restoreStudentLifecycleData } from "../lib/restore-database";
import { emptyEntityResult } from "../lib/restore";

function fixture() {
  const enrollments = new Map<string, any>();
  const events = new Map<string, any>();
  return { enrollments, events, client: {
    academicYearEnrollment: {
      findUnique: async ({ where }: any) => enrollments.get(`${where.studentId_academicYear.studentId}|${where.studentId_academicYear.academicYear}`) ?? null,
      create: async ({ data }: any) => { enrollments.set(`${data.studentId}|${data.academicYear}`, { ...data }); return data; }
    },
    studentLifecycleEvent: {
      findUnique: async ({ where }: any) => events.get(where.id) ?? null,
      findFirst: async ({ where }: any) => [...events.values()].find((row) => row.studentId === where.studentId && row.academicYear === where.academicYear && row.eventType === where.eventType && new Date(row.effectiveDate).getTime() === new Date(where.effectiveDate).getTime() && row.reason === where.reason && row.toClass === where.toClass && row.toStatus === where.toStatus) ?? null,
      create: async ({ data }: any) => { events.set(data.id, { ...data }); return data; }
    }
  } };
}

const backup = {
  academicYearEnrollments: [{ id: "enrollment-1", studentId: "student-backup", academicYear: "2026-27", className: "VI", section: "A", status: "ACTIVE", createdAt: "2026-07-01T00:00:00.000Z" }],
  studentLifecycleEvents: [{ id: "event-1", studentId: "student-backup", academicYear: "2026-27", eventType: "ENROLLED", toClass: "VI", toSection: "A", toStatus: "ACTIVE", effectiveDate: "2026-07-01T00:00:00.000Z", reason: "Backfill", evidenceNotes: "Register checked", parentAcknowledgementNotes: "Not required", approvedByUserId: "approver-backup", recordedByUserId: "user-backup", createdAt: "2026-07-01T00:00:00.000Z" }]
};

describe("student lifecycle restore", () => {
  it("restores linked lifecycle history and maps optional user links", async () => {
    const f = fixture();
    const result = { academicYearEnrollments: emptyEntityResult(), studentLifecycleEvents: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentLifecycleData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map([["user-backup", "user-local"], ["approver-backup", "approver-local"]]), result);
    expect(result.academicYearEnrollments.created).toBe(1);
    expect(result.studentLifecycleEvents.created).toBe(1);
    expect([...f.events.values()][0]).toMatchObject({ studentId: "student-local", recordedByUserId: "user-local", approvedByUserId: "approver-local", evidenceNotes: "Register checked", parentAcknowledgementNotes: "Not required" });
  });

  it("is duplicate-safe and preserves existing local enrollment history", async () => {
    const f = fixture();
    const first = { academicYearEnrollments: emptyEntityResult(), studentLifecycleEvents: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentLifecycleData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map(), first);
    f.enrollments.get("student-local|2026-27").className = "VII";
    const second = { academicYearEnrollments: emptyEntityResult(), studentLifecycleEvents: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentLifecycleData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map(), second);
    expect(second.academicYearEnrollments.skipped).toBe(1);
    expect(second.academicYearEnrollments.warnings[0]).toContain("local history was preserved");
    expect(second.studentLifecycleEvents.skipped).toBe(1);
    expect(f.enrollments.get("student-local|2026-27").className).toBe("VII");
  });

  it("skips an exact semantic event duplicate even when the backup ID differs", async () => {
    const f = fixture();
    const first = { academicYearEnrollments: emptyEntityResult(), studentLifecycleEvents: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentLifecycleData(f.client as never, backup, new Map([["student-backup", "student-local"]]), new Map(), first);
    const duplicateBackup = { ...backup, studentLifecycleEvents: [{ ...backup.studentLifecycleEvents[0], id: "event-copy" }] };
    const second = { academicYearEnrollments: emptyEntityResult(), studentLifecycleEvents: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentLifecycleData(f.client as never, duplicateBackup, new Map([["student-backup", "student-local"]]), new Map(), second);
    expect(second.studentLifecycleEvents.skipped).toBe(1);
    expect(f.events.size).toBe(1);
  });

  it("skips lifecycle rows whose student cannot be linked", async () => {
    const f = fixture();
    const result = { academicYearEnrollments: emptyEntityResult(), studentLifecycleEvents: emptyEntityResult(), warnings: [] as string[] };
    await restoreStudentLifecycleData(f.client as never, backup, new Map(), new Map(), result);
    expect(result.academicYearEnrollments.skipped).toBe(1);
    expect(result.studentLifecycleEvents.skipped).toBe(1);
    expect(f.enrollments.size).toBe(0);
    expect(f.events.size).toBe(0);
  });
});
