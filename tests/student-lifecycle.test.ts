import { describe, expect, it } from "vitest";
import {
  backfillCurrentAcademicYearEnrollments,
  createMissingEnrollmentSafely,
  lifecycleOverviewApiResponse,
  recordLifecycleEvent,
  studentLifecycleApiResponse
} from "../lib/student-lifecycle";

function fixture(settingsYear: string | null = "2027-28") {
  const students = [
    { id: "s1", admissionNo: "NPS1", className: "VI", section: "A", rollNo: "1", status: "Active", deletedAt: null },
    { id: "s2", admissionNo: "NPS2", className: "VII", section: null, rollNo: null, status: "Active", deletedAt: null },
    { id: "s3", admissionNo: "NPS3", className: "VIII", section: "B", rollNo: "3", status: "Left", deletedAt: null },
    { id: "s4", admissionNo: "NPS4", className: "IX", section: "A", rollNo: "4", status: "Active", deletedAt: new Date("2026-06-01") }
  ];
  const enrollments = new Map<string, any>();
  const events: any[] = [];
  const key = (studentId: string, academicYear: string) => `${studentId}|${academicYear}`;
  let transactions = 0;
  const client: any = {
    schoolSettings: { findUnique: async () => settingsYear ? { academicYear: settingsYear } : null },
    student: { findMany: async ({ where }: any) => students.filter((row) => (!where?.status || row.status === where.status) && (!Object.prototype.hasOwnProperty.call(where ?? {}, "deletedAt") || row.deletedAt === where.deletedAt)) },
    academicYearEnrollment: {
      findUnique: async ({ where }: any) => enrollments.get(key(where.studentId_academicYear.studentId, where.studentId_academicYear.academicYear)) ?? null,
      findMany: async ({ where }: any) => [...enrollments.values()].filter((row) => row.academicYear === where.academicYear && (!where.studentId?.in || where.studentId.in.includes(row.studentId))),
      create: async ({ data }: any) => { const row = { id: `e${enrollments.size + 1}`, ...data }; enrollments.set(key(data.studentId, data.academicYear), row); return row; }
    },
    studentLifecycleEvent: { create: async ({ data }: any) => { const row = { id: `event-${events.length + 1}`, ...data }; events.push(row); return row; } },
    $transaction: async (work: (tx: any) => Promise<any>) => { transactions += 1; return work(client); }
  };
  return { client, enrollments, events, students, get transactions() { return transactions; } };
}

describe("student lifecycle foundation", () => {
  it("creates one enrollment and an append-only ENROLLED event", async () => {
    const f = fixture();
    const first = await createMissingEnrollmentSafely(f.client as never, { studentId: "s1", academicYear: "2027-28", className: "VI", section: "A" });
    const second = await createMissingEnrollmentSafely(f.client as never, { studentId: "s1", academicYear: "2027-28", className: "VII" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(f.enrollments).toHaveLength(1);
    expect(f.events).toHaveLength(1);
    expect(f.events[0]).toMatchObject({ eventType: "ENROLLED", toClass: "VI", toStatus: "ACTIVE" });
  });

  it("records lifecycle events as new rows without update or overwrite", async () => {
    const f = fixture();
    await recordLifecycleEvent(f.client as never, { studentId: "s1", eventType: "CORRECTION", effectiveDate: new Date("2026-07-01"), reason: "First note" });
    await recordLifecycleEvent(f.client as never, { studentId: "s1", eventType: "CORRECTION", effectiveDate: new Date("2026-07-02"), reason: "Second note" });
    expect(f.events.map((row) => row.reason)).toEqual(["First note", "Second note"]);
  });

  it("uses SchoolSettings academic year and is idempotent when applied twice", async () => {
    const f = fixture("2027-28");
    const first = await backfillCurrentAcademicYearEnrollments(f.client as never, { apply: true, now: new Date("2026-07-01") });
    const second = await backfillCurrentAcademicYearEnrollments(f.client as never, { apply: true, now: new Date("2026-07-01") });
    expect(first).toMatchObject({ academicYear: "2027-28", scanned: 2, created: 2, missing: 2 });
    expect(second).toMatchObject({ academicYear: "2027-28", created: 0, missing: 0, alreadyPresent: 2 });
    expect(f.events).toHaveLength(2);
    expect(f.transactions).toBe(2);
    expect([...f.enrollments.values()].map((row) => row.studentId).sort()).toEqual(["s1", "s2"]);
    expect(f.students.find((row) => row.id === "s3")?.className).toBe("VIII");
  });

  it("falls back safely when SchoolSettings is missing and dry-run changes nothing", async () => {
    const f = fixture(null);
    const result = await backfillCurrentAcademicYearEnrollments(f.client as never, { apply: false });
    expect(result).toMatchObject({ academicYear: "2026-27", missing: 2, created: 0 });
    expect(f.enrollments).toHaveLength(0);
    expect(f.events).toHaveLength(0);
  });

  it("serializes lifecycle APIs without internal record or user IDs", () => {
    const enrollment = {
      id: "internal-enrollment", studentId: "internal-student", academicYear: "2026-27", className: "VI", section: "A", rollNo: "1", status: "ACTIVE",
      enrollmentDate: new Date("2026-07-01"), exitDate: null, exitReason: null, notes: "Safe note",
      student: { id: "internal-student", admissionNo: "NPS1", studentName: "Student One" }
    };
    const event = {
      id: "internal-event", studentId: "internal-student", academicYear: "2026-27", eventType: "ENROLLED", fromClass: null, fromSection: null,
      toClass: "VI", toSection: "A", fromStatus: null, toStatus: "ACTIVE", effectiveDate: new Date("2026-07-01"), reason: "Backfill",
      evidenceNotes: null, parentAcknowledgementNotes: null, approvedByUserId: "internal-approver", recordedByUserId: "internal-recorder"
    };
    const payload = {
      overview: lifecycleOverviewApiResponse({ counts: { ACTIVE: 1 }, totalCurrentStudents: 1, missingEnrollmentCount: 0, enrollments: [enrollment] }),
      detail: studentLifecycleApiResponse({ admissionNo: "NPS1", studentName: "Student One", academicYearEnrollments: [enrollment], lifecycleEvents: [event] })
    };
    const json = JSON.stringify(payload);
    for (const secret of ["internal-enrollment", "internal-student", "internal-event", "internal-approver", "internal-recorder"]) expect(json).not.toContain(secret);
    expect(payload.detail.lifecycleEvents[0]).toMatchObject({ eventType: "ENROLLED", toStatus: "ACTIVE" });
  });
});
