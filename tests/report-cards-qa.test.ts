import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safeParentSnapshot } from "@/lib/report-card-portals";
import { buildReportCardReport, reportCardRowsCsv } from "@/lib/report-card-reports";
import { serializeScopedReportCard } from "@/lib/report-card-api";

const calculation = { rows: [{ subjectName: "Maths", componentName: null, status: "PRESENT", marksObtained: 0, maxMarks: 100, weightedObtained: 0 }], totalObtained: 0, totalMaximum: 100, percentage: 0, grade: { code: "E", label: "Needs improvement" }, result: "FAIL", blockingGaps: [] };
const draft = { kind: "MARK_BASED", sourceExam: { examCode: "QA17C-EXAM", name: "QA", status: "LOCKED" }, calculation, attendance: [{ month: "JUNE", workingDays: 20, daysPresent: 19 }], attendanceSource: { status: "CALCULATED_FROM_ATTENDANCE", overrideReason: null } };

function card(status: string, batchStatus: string, version = 0) {
  return { id: `${status}-${batchStatus}`, reportCardNumber: `QA17C-${status}`, academicYear: "2026-27", className: "VI", section: "A", reportType: "MARK_BASED", status, currentVersionNumber: version, finalGrade: null, teacherOverallComment: "Teacher", principalComment: "Principal", draftDataJson: JSON.stringify(draft), student: { studentName: "=Formula Student", admissionNo: "+QA17C001" }, batch: { batchNumber: `QA17C-${batchStatus}`, title: "QA", status: batchStatus } };
}

describe("Prompt 17C QA regressions", () => {
  it("keeps template and batch identities unique and selects only active templates", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const source = readFileSync("lib/report-cards.ts", "utf8");
    expect(schema).toMatch(/templateCode\s+String\s+@unique/);
    expect(schema).toMatch(/schemeCode\s+String\s+@unique/);
    expect(schema).toMatch(/batchNumber\s+String\s+@unique/);
    expect(source).toContain('status: "ACTIVE", reportType');
    expect(source).toContain("templateSnapshotJson: JSON.stringify(templateSnapshot)");
  });

  it("keeps mark sources read-only and embeds locked exam identity in the snapshot", () => {
    const source = readFileSync("lib/report-cards.ts", "utf8");
    const batchSection = source.slice(source.indexOf("export async function createReportCardBatch"), source.indexOf("export async function updateReportCardDraft"));
    expect(batchSection).toContain("sourceExam:");
    expect(batchSection).toContain("examCode: data.examCycle.examCode");
    expect(batchSection).not.toMatch(/studentMark\.(update|create|delete)/);
    expect(source).toContain("Raw mark calculations cannot be changed");
    expect(source).toContain("Attendance snapshots cannot be changed from a mark report-card page");
  });

  it("scopes Teacher batch transitions and issued corrections at the API boundary", () => {
    const workflow = readFileSync("app/api/report-cards/batches/[id]/workflow/route.ts", "utf8");
    const correction = readFileSync("app/api/report-cards/[id]/correct/route.ts", "utf8");
    expect(workflow).toContain("resolveReportCardScope");
    expect(workflow).toContain("requireReportCardTarget");
    expect(correction).toContain("loadScopedReportCard");
  });

  it("uses allowlisted Teacher JSON without contacts, addresses, actor IDs, or events", () => {
    const raw: any = { ...card("DRAFT", "OPEN_FOR_ENTRY"), updatedAt: new Date(), directorComment: "Director", promotionDisplayText: "Not final", student: { studentName: "Student", admissionNo: "A1", rollNo: "1", phone1: "secret", address: "secret", aadhaarNo: "secret" }, batch: { id: "b1", batchNumber: "B1", title: "Title", reportingPeriod: "Term", status: "OPEN_FOR_ENTRY", createdByUserId: "secret" }, versions: [], events: [{ eventType: "ENTRY_UPDATED", eventDate: new Date(), previousStatus: "DRAFT", newStatus: "DRAFT", reason: null, notes: null, actorLabel: "Secret Actor" }], createdByUserId: "secret" };
    const serialized = serializeScopedReportCard(raw, "TEACHER") as any;
    const text = JSON.stringify(serialized);
    expect(text).not.toContain("phone1"); expect(text).not.toContain("address"); expect(text).not.toContain("aadhaar"); expect(text).not.toContain("createdByUserId"); expect(text).not.toContain("Secret Actor");
    expect(serialized.events).toEqual([]);
  });

  it("keeps Parent snapshots allowlisted", () => {
    const safe: any = safeParentSnapshot({ schemaVersion: 1, reportType: "MARK_BASED", versionNumber: 1, issueDate: "2026-07-17", reportCardNumber: "R1", batchNumber: "B1", title: "Title", reportingPeriod: "Term", academicYear: "2026-27", template: {}, student: {}, data: {}, comments: {}, finalGrade: "A", promotionDisplayText: "Not final", approvals: {}, internalActorId: "secret", events: ["secret"] });
    expect(safe).not.toHaveProperty("internalActorId"); expect(safe).not.toHaveProperty("events");
  });

  it("keeps archived issued history visible in the authorised Teacher portal", () => {
    const portals = readFileSync("lib/report-card-portals.ts", "utf8");
    expect(portals).toContain('["OPEN_FOR_ENTRY", "SUBMITTED", "APPROVED", "ISSUED", "ARCHIVED"]');
  });

  it("keeps issued-card correction fields read-only for Teachers", () => {
    const entry = readFileSync("components/report-card-entry.tsx", "utf8");
    expect(entry).toContain('disabled={!card.canEdit&&!card.canCorrect}');
    expect(entry).toContain('disabled={!card.canEditLeadershipFields&&!card.canCorrect}');
  });

  it("moves initial confirmation focus inside report-card dialogs", () => {
    const templates = readFileSync("components/report-card-template-manager.tsx", "utf8");
    const workflow = readFileSync("components/report-card-workflow.tsx", "utf8");
    const entry = readFileSync("components/report-card-entry.tsx", "utf8");
    expect(templates).toContain("<button autoFocus");
    expect(workflow).toContain("autoFocus={confirm!==\"cancel\"}");
    expect(entry).toContain("<textarea autoFocus");
  });

  it("reports each workflow queue, corrections, superseded versions, and formula-safe CSV", async () => {
    const cards = [card("DRAFT", "OPEN_FOR_ENTRY"), card("READY_FOR_REVIEW", "OPEN_FOR_ENTRY"), card("READY_FOR_REVIEW", "SUBMITTED"), card("APPROVED", "APPROVED"), card("ISSUED", "ISSUED", 2), card("CANCELLED", "CANCELLED")];
    const report = await buildReportCardReport({ studentReportCard: { findMany: async () => cards } } as any);
    expect(report.summary).toMatchObject({ total: 6, pendingEntry: 1, pendingSubmission: 1, pendingApproval: 1, pendingIssue: 1, issued: 1, cancelled: 1, corrected: 1, supersededVersions: 1 });
    expect(report.summary.resultDistribution).toEqual({ FAIL: 6 });
    const csv = reportCardRowsCsv(report.rows);
    expect(csv).toContain("Superseded Versions"); expect(csv).toContain("Growth Gap"); expect(csv).toContain("'=Formula Student"); expect(csv).toContain("'+QA17C001");
  });

  it("renders corrected Parent mark fields and print watermarks without rank or Teacher scoring", () => {
    const parent = readFileSync("app/parent/results/page.tsx", "utf8");
    const print = readFileSync("app/report-cards/[id]/print/page.tsx", "utf8");
    const reports = readFileSync("lib/report-card-reports.ts", "utf8");
    expect(parent).toContain("calculation?.rows"); expect(parent).toContain("calculation?.totalObtained");
    expect(print).toContain("print-status-cancelled"); expect(print).toContain("print-status-superseded"); expect(print).toContain("version?:string");
    expect(reports.toLowerCase()).not.toContain("teacher performance"); expect(reports.toLowerCase()).not.toContain("rank");
  });

  it("uses optimistic concurrency and contains no report-card hard delete", () => {
    const source = readFileSync("lib/report-cards.ts", "utf8");
    expect(source).toContain("updatedAt: expected"); expect(source).toContain("currentVersionNumber: card.currentVersionNumber");
    expect(source).not.toMatch(/studentReportCard(?:Version|Event)?\.(?:delete|deleteMany)/);
  });
});
