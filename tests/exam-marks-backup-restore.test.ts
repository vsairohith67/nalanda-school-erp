import { describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { emptyEntityResult, parseAndValidateBackup } from "@/lib/restore";
import { restoreExamMarksData } from "@/lib/restore-database";

function fixture() { return createBackupDocument({ generatedAt: new Date("2026-07-16T12:00:00Z"), generatedBy: "QA", students: [{ id: "s1", academicYear: "2026-27", admissionNo: "A1", studentName: "QA Student", fatherName: "Parent", className: "I", section: "A", phone1: "9999999999", status: "Active", studentType: "Normal", discountPercent: 0, startMonth: "June", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }], feeStructures: [], payments: [], paymentAudits: [], users: [{ id: "u1", name: "QA", username: "qa", passwordHash: "must-not-export", role: "DIRECTOR", isActive: true }], academicYearEnrollments: [{ id: "en1", studentId: "s1", academicYear: "2026-27", className: "I", section: "A", status: "ACTIVE", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }], examCycles: [{ id: "e1", examCode: "TERM-1", academicYear: "2026-27", name: "Term One", examType: "TERM", startDate: "2026-09-01T00:00:00Z", endDate: "2026-09-10T00:00:00Z", status: "APPROVED", createdByUserId: "raw-actor", approvedByUserId: "raw-actor", approvedAt: "2026-09-11T00:00:00Z", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-09-11T00:00:00Z" }], examAssessments: [{ id: "a1", examCycleId: "e1", academicYear: "2026-27", className: "I", section: "A", subjectName: "Math", componentName: "Theory", assessmentType: "THEORY", maxMarks: "100", passMarks: "40", weightagePercent: "100", entryStatus: "APPROVED", approvedByUserId: "raw-actor", approvedAt: "2026-09-11T00:00:00Z", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-09-11T00:00:00Z" }], studentMarks: [{ id: "m1", assessmentId: "a1", studentId: "s1", academicYear: "2026-27", marksObtained: "0", entryStatus: "PRESENT", enteredByUserId: "raw-actor", verifiedByUserId: "raw-actor", enteredAt: "2026-09-05T00:00:00Z", verifiedAt: "2026-09-11T00:00:00Z", createdAt: "2026-09-05T00:00:00Z", updatedAt: "2026-09-11T00:00:00Z" }], studentMarkEvents: [{ id: "ev1", assessmentId: "a1", studentMarkId: "m1", eventType: "MARK_CREATED", newMarks: "0", newEntryStatus: "PRESENT", actorLabel: "QA Staff", eventDate: "2026-09-05T00:00:00Z", createdAt: "2026-09-05T00:00:00Z" }] }); }

function restoreResult() {
  return { examCycles: emptyEntityResult(), examAssessments: emptyEntityResult(), studentMarks: emptyEntityResult(), studentMarkEvents: emptyEntityResult(), warnings: [] as string[] };
}

function restoreClient(collision = false) {
  const exams = new Map<string, any>();
  const assessments = new Map<string, any>();
  const marks = new Map<string, any>();
  const events = new Map<string, any>();
  if (collision) exams.set("local-exam", { id: "local-exam", examCode: "TERM-1", updatedAt: new Date("2026-12-31T00:00:00Z"), status: "LOCKED" });
  const client: any = {
    examCycle: {
      findUnique: async ({ where }: any) => where.id ? exams.get(where.id) ?? null : [...exams.values()].find((row) => row.examCode === where.examCode) ?? null,
      create: async ({ data }: any) => { const row = { ...data, updatedAt: new Date("2026-12-31T00:00:00Z") }; exams.set(row.id, row); return row; },
      update: async ({ where, data }: any) => { const row = { ...exams.get(where.id), ...data, updatedAt: new Date("2026-12-31T00:00:00Z") }; exams.set(where.id, row); return row; }
    },
    timetableSubject: { findFirst: async () => null },
    examAssessment: {
      findUnique: async ({ where }: any) => {
        if (where.id) return assessments.get(where.id) ?? null;
        const key = where.examCycleId_className_section_subjectName_componentName;
        return [...assessments.values()].find((row) => row.examCycleId === key.examCycleId && row.className === key.className && row.section === key.section && row.subjectName === key.subjectName && row.componentName === key.componentName) ?? null;
      },
      create: async ({ data }: any) => { const row = { ...data, updatedAt: new Date("2026-12-31T00:00:00Z") }; assessments.set(row.id, row); return row; },
      update: async ({ where, data }: any) => { const row = { ...assessments.get(where.id), ...data, updatedAt: new Date("2026-12-31T00:00:00Z") }; assessments.set(where.id, row); return row; }
    },
    academicYearEnrollment: { findFirst: async ({ where }: any) => where.studentId === "local-s1" && where.className === "I" ? { id: "local-enrollment" } : null },
    studentMark: {
      findUnique: async ({ where }: any) => {
        if (where.id) return marks.get(where.id) ?? null;
        const key = where.assessmentId_studentId;
        return [...marks.values()].find((row) => row.assessmentId === key.assessmentId && row.studentId === key.studentId) ?? null;
      },
      create: async ({ data }: any) => { const row = { ...data, updatedAt: new Date("2026-12-31T00:00:00Z") }; marks.set(row.id, row); return row; },
      update: async ({ where, data }: any) => { const row = { ...marks.get(where.id), ...data, updatedAt: new Date("2026-12-31T00:00:00Z") }; marks.set(where.id, row); return row; }
    },
    studentMarkEvent: {
      findUnique: async ({ where }: any) => events.get(where.id) ?? null,
      create: async ({ data }: any) => { events.set(data.id, data); return data; }
    }
  };
  return { client, exams, assessments, marks, events };
}

describe("exam marks backup and restore validation", () => {
  it("uses the current version and includes all four exam arrays", () => { const backup = fixture(); expect(backup.metadata.backupVersion).toBe(45); expect(backup.examCycles).toHaveLength(1); expect(backup.examAssessments).toHaveLength(1); expect(backup.studentMarks).toHaveLength(1); expect(backup.studentMarkEvents).toHaveLength(1); });
  it("excludes passwords and raw actor IDs while preserving safe actor labels", () => { const text = JSON.stringify(fixture()); expect(text).not.toContain("must-not-export"); expect(text).not.toContain("raw-actor"); expect(text).toContain("QA Staff"); });
  it("validates links, zero marks, and append-only events", () => { const parsed = parseAndValidateBackup(fixture()); expect(parsed.studentMarks[0]).toMatchObject({ marksObtained: "0", entryStatus: "PRESENT" }); expect(parsed.studentMarkEvents[0].eventType).toBe("MARK_CREATED"); });
  it("keeps version 23 backups compatible without exam arrays", () => { const old: any = fixture(); old.metadata.backupVersion = 23; for (const key of ["examCycles", "examAssessments", "studentMarks", "studentMarkEvents"]) { delete old[key]; delete old.metadata.counts[key]; } const parsed = parseAndValidateBackup(old); expect(parsed.examCycles).toEqual([]); expect(parsed.studentMarks).toEqual([]); });
  it("blocks duplicate exam codes", () => { const backup: any = fixture(); backup.examCycles.push({ ...backup.examCycles[0], id: "e2" }); backup.metadata.counts.examCycles = 2; expect(() => parseAndValidateBackup(backup)).toThrow(/duplicate exam identity/); });
  it("blocks duplicate assessment combinations", () => { const backup: any = fixture(); backup.examAssessments.push({ ...backup.examAssessments[0], id: "a2" }); backup.metadata.counts.examAssessments = 2; expect(() => parseAndValidateBackup(backup)).toThrow(/duplicate identity, combination/); });
  it("blocks duplicate Student marks", () => { const backup: any = fixture(); backup.studentMarks.push({ ...backup.studentMarks[0], id: "m2" }); backup.metadata.counts.studentMarks = 2; expect(() => parseAndValidateBackup(backup)).toThrow(/duplicate identity/); });
  it("blocks marks without a matching active enrollment", () => { const backup: any = fixture(); backup.academicYearEnrollments[0].status = "INACTIVE"; expect(() => parseAndValidateBackup(backup)).toThrow(/incompatible with active/); });
  it("accepts any active section for an intentionally class-wide assessment", () => { const backup: any = fixture(); backup.examAssessments[0].section = ""; backup.examAssessments[0].componentName = ""; backup.academicYearEnrollments[0].section = "B"; expect(parseAndValidateBackup(backup).studentMarks).toHaveLength(1); });
  it("blocks non-present marks carrying numbers", () => { const backup: any = fixture(); backup.studentMarks[0].entryStatus = "ABSENT"; expect(() => parseAndValidateBackup(backup)).toThrow(/must not carry/); });
  it("blocks correction events without a reason", () => { const backup: any = fixture(); backup.studentMarkEvents[0].eventType = "CORRECTION_APPLIED"; expect(() => parseAndValidateBackup(backup)).toThrow(/reason is required/); });
  it("restores a locked snapshot and append-only history idempotently", async () => { const source: any = fixture(); source.examCycles[0].status = "LOCKED"; source.examCycles[0].lockedAt = "2026-09-12T00:00:00Z"; source.examAssessments[0].entryStatus = "LOCKED"; source.examAssessments[0].lockedAt = "2026-09-12T00:00:00Z"; const backup = parseAndValidateBackup(source); const f = restoreClient(); const first = restoreResult(); await restoreExamMarksData(f.client, backup, new Map([["s1", "local-s1"]]), new Map(), first); expect(first.examCycles.created).toBe(1); expect(first.examAssessments.created).toBe(1); expect(first.studentMarks.created).toBe(1); expect(first.studentMarkEvents.created).toBe(1); expect(f.marks.get("m1").marksObtained).toBe("0"); expect(f.events.get("ev1").actorLabel).toBe("QA Staff"); const second = restoreResult(); await restoreExamMarksData(f.client, backup, new Map([["s1", "local-s1"]]), new Map(), second); expect(f.exams.size).toBe(1); expect(f.assessments.size).toBe(1); expect(f.marks.size).toBe(1); expect(f.events.size).toBe(1); expect(second.studentMarkEvents.skipped).toBe(1); });
  it("isolates same-code different-ID collisions with all dependent data", async () => { const backup = parseAndValidateBackup(fixture()); const f = restoreClient(true); const result = restoreResult(); await restoreExamMarksData(f.client, backup, new Map([["s1", "local-s1"]]), new Map(), result); expect(result.examCycles.skipped).toBe(1); expect(result.examAssessments.skipped).toBe(1); expect(result.studentMarks.skipped).toBe(1); expect(result.studentMarkEvents.skipped).toBe(1); expect(f.exams.size).toBe(1); expect(f.assessments.size).toBe(0); expect(result.warnings.join(" ")).toMatch(/collided.*isolated/i); });
});
