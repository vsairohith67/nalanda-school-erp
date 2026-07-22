import { describe, expect, it } from "vitest";
import { createProgressionDecision, finalizeProgressionDecision, progressionApiDecision, transitionProgressionDecision, updateProgressionDraft, validateProgressionInput } from "../lib/student-progression";
import { can } from "../lib/permissions";

const base = { studentId: "student-1", sourceEnrollmentId: "source-1", academicYear: "2026-27", decisionType: "PROMOTE", effectiveDate: "2027-04-01", toAcademicYear: "2027-28", toClass: "VII", toSection: "A" };

function fixture(type = "PROMOTE", overrides: Record<string, unknown> = {}) {
  const enrollments = new Map<string, any>([["source-1", { id: "source-1", studentId: "student-1", academicYear: "2026-27", className: "VI", section: "A", status: "ACTIVE" }]]);
  const decisions = new Map<string, any>(); const events: any[] = []; let sequence = 0;
  const delegates: any = {
    academicYearEnrollment: {
      findFirst: async ({ where }: any) => [...enrollments.values()].find((row) => row.id === where.id && row.studentId === where.studentId) ?? null,
      findUnique: async ({ where }: any) => where.id ? enrollments.get(where.id) ?? null : [...enrollments.values()].find((row) => row.studentId === where.studentId_academicYear.studentId && row.academicYear === where.studentId_academicYear.academicYear) ?? null,
      update: async ({ where, data }: any) => { const value = { ...enrollments.get(where.id), ...data }; enrollments.set(where.id, value); return value; },
      create: async ({ data }: any) => { const value = { id: `target-${++sequence}`, ...data }; enrollments.set(value.id, value); return value; }
    },
    studentProgressionDecision: {
      create: async ({ data }: any) => { const value = { id: `decision-${++sequence}`, ...data }; decisions.set(value.id, value); return value; },
      findUnique: async ({ where }: any) => decisions.get(where.id) ?? null,
      findUniqueOrThrow: async ({ where }: any) => { const value = decisions.get(where.id); if (!value) throw new Error("not found"); return value; },
      updateMany: async ({ where, data }: any) => { const value = decisions.get(where.id); if (!value || value.status !== where.status) return { count: 0 }; decisions.set(where.id, { ...value, ...data }); return { count: 1 }; },
      update: async ({ where, data }: any) => { const value = { ...decisions.get(where.id), ...data }; decisions.set(where.id, value); return value; }
    },
    studentLifecycleEvent: { create: async ({ data }: any) => { events.push(data); return data; } }
  };
  const client: any = { ...delegates, $transaction: async (callback: any) => {
    const enrollmentSnapshot = structuredClone([...enrollments.entries()]); const decisionSnapshot = structuredClone([...decisions.entries()]); const eventSnapshot = structuredClone(events);
    try { return await callback(delegates); } catch (error) { enrollments.clear(); for (const [key, value] of enrollmentSnapshot) enrollments.set(key, value); decisions.clear(); for (const [key, value] of decisionSnapshot) decisions.set(key, value); events.splice(0, events.length, ...eventSnapshot); throw error; }
  } };
  decisions.set("decision", { id: "decision", studentId: "student-1", sourceEnrollmentId: "source-1", academicYear: "2026-27", decisionType: type, status: "APPROVED", fromClass: "VI", fromSection: "A", fromStatus: "ACTIVE", toAcademicYear: ["PROMOTE", "REPEAT"].includes(type) ? "2027-28" : null, toClass: type === "PROMOTE" ? "VII" : type === "REPEAT" ? "VI" : null, toSection: ["PROMOTE", "REPEAT"].includes(type) ? "A" : null, effectiveDate: new Date("2027-04-01"), reason: type === "PROMOTE" ? null : "Documented reason", evidenceNotes: "Register reviewed", parentAcknowledgementNotes: "Parent informed", approvedByUserId: "approver", createdAt: new Date(), ...overrides });
  return { client, enrollments, decisions, events };
}

describe("student progression workflow", () => {
  it("creates a draft without changing enrollment", async () => { const f = fixture(); f.decisions.clear(); const result = await createProgressionDecision(f.client, base, "user-1"); expect(result.status).toBe("DRAFT"); expect(f.enrollments.get("source-1").status).toBe("ACTIVE"); expect(f.events).toHaveLength(0); });
  it("can create and submit a complete decision", async () => { const f = fixture(); f.decisions.clear(); const result = await createProgressionDecision(f.client, { ...base, action: "submit" }, "user-1", true); expect(result.status).toBe("PENDING_APPROVAL"); expect(result.submittedByUserId).toBe("user-1"); });
  it("keeps draft edits on the original student and matching enrollment year", async () => { const f = fixture("PROMOTE", { status: "DRAFT" }); await expect(updateProgressionDraft(f.client, "decision", { ...base, studentId: "student-2" })).rejects.toThrow("cannot be moved"); await expect(updateProgressionDraft(f.client, "decision", { ...base, academicYear: "2025-26" })).rejects.toThrow("must match"); expect(f.decisions.get("decision").studentId).toBe("student-1"); });
  it.each(["REPEAT", "TRANSFER_OUT", "LEFT", "DROPPED_OUT", "CORRECTION"])("requires a reason for %s", (decisionType) => expect(() => validateProgressionInput({ ...base, decisionType, reason: "", evidenceNotes: "Evidence", parentAcknowledgementNotes: "Acknowledged" }, { submitting: true })).toThrow("Reason is required"));
  it("requires evidence and parent acknowledgement for repeat", () => expect(() => validateProgressionInput({ ...base, decisionType: "REPEAT", reason: "Needs another year" }, { submitting: true })).toThrow("evidence notes"));
  it("approves only a pending decision", async () => { const f = fixture("PROMOTE", { status: "PENDING_APPROVAL" }); const row = await transitionProgressionDecision(f.client, "decision", "approve", "leader"); expect(row.status).toBe("APPROVED"); expect(row.approvedByUserId).toBe("leader"); });
  it("requires reasons for reject and cancel", async () => { const f = fixture("PROMOTE", { status: "PENDING_APPROVAL" }); await expect(transitionProgressionDecision(f.client, "decision", "reject", "leader", "")).rejects.toThrow("Rejection reason"); await expect(transitionProgressionDecision(f.client, "decision", "cancel", "leader", "")).rejects.toThrow("Cancellation reason"); });
  it("keeps finalized decisions immutable", async () => { const f = fixture("PROMOTE", { status: "FINALIZED" }); await expect(transitionProgressionDecision(f.client, "decision", "submit", "user")).rejects.toThrow("Only a draft"); });
  it.each(["PROMOTE", "REPEAT"])("finalizes %s with lifecycle and target enrollment", async (type) => { const f = fixture(type); await finalizeProgressionDecision(f.client, "decision", "finalizer"); expect(f.events).toHaveLength(1); expect(f.enrollments.get("source-1").status).toBe(type === "PROMOTE" ? "PROMOTED" : "REPEATED"); expect([...f.enrollments.values()].some((row) => row.academicYear === "2027-28" && row.status === "ACTIVE")).toBe(true); expect(f.decisions.get("decision").status).toBe("FINALIZED"); });
  it.each(["TRANSFER_OUT", "LEFT", "DROPPED_OUT", "PASSED_OUT"])("finalizes %s without a target enrollment", async (type) => { const f = fixture(type); await finalizeProgressionDecision(f.client, "decision", "finalizer"); expect(f.enrollments.size).toBe(1); expect(f.events[0].eventType).toBe(type === "TRANSFER_OUT" ? "TRANSFERRED_OUT" : type); });
  it("prevents duplicate target enrollment and rolls back", async () => { const f = fixture(); f.enrollments.set("existing", { id: "existing", studentId: "student-1", academicYear: "2027-28", className: "VII", status: "ACTIVE" }); await expect(finalizeProgressionDecision(f.client, "decision", "finalizer")).rejects.toThrow("already exists"); expect(f.enrollments.get("source-1").status).toBe("ACTIVE"); expect(f.events).toHaveLength(0); expect(f.decisions.get("decision").status).toBe("APPROVED"); });
  it("rolls back when lifecycle event creation fails", async () => { const f = fixture(); f.client.studentLifecycleEvent.create = async () => { throw new Error("write failed"); }; await expect(finalizeProgressionDecision(f.client, "decision", "finalizer")).rejects.toThrow("write failed"); expect(f.enrollments.get("source-1").status).toBe("ACTIVE"); expect(f.enrollments.size).toBe(1); });
  it("rolls back when target enrollment creation fails", async () => { const f = fixture(); f.client.academicYearEnrollment.create = async () => { throw new Error("target write failed"); }; await expect(finalizeProgressionDecision(f.client, "decision", "finalizer")).rejects.toThrow("target write failed"); expect(f.enrollments.get("source-1").status).toBe("ACTIVE"); expect(f.events).toHaveLength(0); expect(f.decisions.get("decision").status).toBe("APPROVED"); });
  it("claims an approved decision once before finalization writes", async () => { const f = fixture(); f.client.studentProgressionDecision.updateMany = async () => ({ count: 0 }); await expect(finalizeProgressionDecision(f.client, "decision", "finalizer")).rejects.toThrow("already being finalized"); expect(f.enrollments.get("source-1").status).toBe("ACTIVE"); expect(f.events).toHaveLength(0); });
  it("keeps correction finalization disabled", async () => { const f = fixture("CORRECTION"); await expect(finalizeProgressionDecision(f.client, "decision", "finalizer")).rejects.toThrow("intentionally unavailable"); });
  it("removes internal student, enrollment, and audit user IDs from API decisions", () => { const safe = progressionApiDecision({ id: "route-handle", studentId: "student-secret", sourceEnrollmentId: "enrollment-secret", approvedByUserId: "user-secret", decisionType: "PROMOTE" }); expect(safe).toEqual({ id: "route-handle", decisionType: "PROMOTE" }); });
  it("uses leadership/admin defaults and isolates restricted roles", () => { for (const role of ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"] as const) expect(can(role, "FINALIZE_STUDENT_PROGRESSION")).toBe(true); expect(can("VIEWER", "VIEW_STUDENT_PROGRESSION")).toBe(true); for (const role of ["VIEWER", "ACCOUNTANT", "TEACHER", "PARENT"] as const) expect(can(role, "MANAGE_STUDENT_PROGRESSION")).toBe(false); });
});
