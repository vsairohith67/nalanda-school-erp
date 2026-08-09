import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { emptyEntityResult, parseAndValidateBackup } from "../lib/restore";
import { restoreHomeworkData } from "../lib/restore-database";

const at = "2026-07-16T00:00:00.000Z";
function fixture() { return createBackupDocument({ generatedAt: new Date(at), generatedBy: "QA", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [{ id: "u1", username: "qa", passwordHash: "secret" }], homeworkAssignments: [{ id: "h1", assignmentNumber: "HW-20260716-ABC123", academicYear: "2026-27", title: "Homework", instructions: "Complete work", className: "1", section: "A", subjectName: "Math", assignedDate: at, dueDate: "2026-07-17T00:00:00.000Z", status: "PUBLISHED", priority: "NORMAL", publicNotes: "Public", publishedAt: at, createdAt: at, updatedAt: at }], homeworkAssignmentEvents: [{ id: "e1", assignmentId: "h1", eventType: "PUBLISHED", eventDate: at, createdAt: at }, { id: "e2", assignmentId: "h1", eventType: "CORRECTED", eventDate: at, titleSnapshot: "Old", instructionsSnapshot: "Old instructions", reason: "Typo", createdAt: at }] }); }

function restoreFixture() {
  const assignments = new Map<string, any>(), events = new Map<string, any>();
  const client: any = {
    timetableSubject: { findFirst: async () => null },
    homeworkAssignment: {
      findUnique: async ({ where }: any) => where.id ? assignments.get(where.id) ?? null : [...assignments.values()].find((row) => row.assignmentNumber === where.assignmentNumber) ?? null,
      create: async ({ data }: any) => { const row = { ...data, updatedAt: data.updatedAt ?? new Date(at) }; assignments.set(row.id, row); return row; },
      update: async ({ where, data }: any) => { const row = { ...assignments.get(where.id), ...data }; assignments.set(where.id, row); return row; }
    },
    homeworkAssignmentEvent: { findUnique: async ({ where }: any) => events.get(where.id) ?? null, create: async ({ data }: any) => { events.set(data.id, { ...data }); return data; } }
  };
  return { client, assignments, events };
}

describe("homework backup and restore v23", () => {
  it("includes both arrays, version 37, and no password hashes", () => { const backup = fixture(); expect(backup.metadata.backupVersion).toBe(38); expect(backup.homeworkAssignments).toHaveLength(1); expect(backup.homeworkAssignmentEvents).toHaveLength(2); expect(JSON.stringify(backup)).not.toContain("passwordHash"); expect(JSON.stringify(backup)).not.toContain("secret"); });
  it("preserves published correction snapshots", () => { const parsed = parseAndValidateBackup(fixture()); expect(parsed.homeworkAssignmentEvents[1]).toMatchObject({ eventType: "CORRECTED", titleSnapshot: "Old", reason: "Typo" }); });
  it("keeps version 22 backups compatible when homework arrays are absent", () => { const backup: any = fixture(); backup.metadata.backupVersion = 22; delete backup.homeworkAssignments; delete backup.homeworkAssignmentEvents; delete backup.metadata.counts.homeworkAssignments; delete backup.metadata.counts.homeworkAssignmentEvents; const parsed = parseAndValidateBackup(backup); expect(parsed.homeworkAssignments).toEqual([]); expect(parsed.homeworkAssignmentEvents).toEqual([]); });
  it("rejects duplicate normalized assignment numbers", () => { const backup: any = fixture(); backup.homeworkAssignments.push({ ...backup.homeworkAssignments[0], id: "h2", assignmentNumber: "hw-20260716-abc123" }); backup.metadata.counts.homeworkAssignments = 2; expect(() => parseAndValidateBackup(backup)).toThrow(/normalized assignment number/); });
  it("rejects invalid dates, unsafe links, and broken event links", () => { const date: any = fixture(); date.homeworkAssignments[0].dueDate = "2026-07-15T00:00:00Z"; expect(() => parseAndValidateBackup(date)).toThrow(/before assignedDate/); const link: any = fixture(); link.homeworkAssignments[0].resourceLink = "file:///secret"; expect(() => parseAndValidateBackup(link)).toThrow(/unsafe/); const event: any = fixture(); event.homeworkAssignmentEvents[0].assignmentId = "unrelated"; expect(() => parseAndValidateBackup(event)).toThrow(/does not match/); });
  it("restores assignments and append-only events idempotently", async () => { const parsed = parseAndValidateBackup(fixture()); const f = restoreFixture(); const first = { homeworkAssignments: emptyEntityResult(), homeworkAssignmentEvents: emptyEntityResult(), warnings: [] as string[] }; await restoreHomeworkData(f.client, parsed, new Map(), first); expect(first.homeworkAssignments.created).toBe(1); expect(first.homeworkAssignmentEvents.created).toBe(2); const second = { homeworkAssignments: emptyEntityResult(), homeworkAssignmentEvents: emptyEntityResult(), warnings: [] as string[] }; await restoreHomeworkData(f.client, parsed, new Map(), second); expect(f.assignments.size).toBe(1); expect(f.events.size).toBe(2); expect(second.homeworkAssignmentEvents.skipped).toBe(2); });
  it("isolates same-number/different-ID collisions and their events", async () => { const parsed = parseAndValidateBackup(fixture()); const f = restoreFixture(); f.assignments.set("local", { id: "local", assignmentNumber: "HW-20260716-ABC123", updatedAt: new Date(at) }); const result = { homeworkAssignments: emptyEntityResult(), homeworkAssignmentEvents: emptyEntityResult(), warnings: [] as string[] }; await restoreHomeworkData(f.client, parsed, new Map(), result); expect(result.homeworkAssignments.skipped).toBe(1); expect(result.homeworkAssignmentEvents.skipped).toBe(2); expect(result.warnings[0]).toContain("events were isolated"); });
  it("keeps restore source additive and collision-aware", () => { const source = readFileSync("lib/restore-database.ts", "utf8"); expect(source).toContain("local record is newer"); expect(source).toContain("different local ID or number"); expect(source).not.toContain("homeworkAssignment.delete"); });
});

