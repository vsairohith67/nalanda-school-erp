import { describe, expect, it } from "vitest";
import { restoreReportCardData } from "@/lib/restore-database";
import { emptyEntityResult } from "@/lib/restore";

const definition = { schemaVersion: 1, type: "MARK_BASED", denominatorPolicy: "PRESENT_AND_ABSENT", sections: ["STUDENT_PROFILE"] };
const templateSnapshot = { templateCode: "QA17C-T", name: "QA", reportType: "MARK_BASED", versionNumber: 1, definition, gradingScheme: { schemeCode: "QA17C-S", name: "QA", bands: [{ gradeCode: "A", label: "A", minimumPercentage: "0", maximumPercentage: "100", displayOrder: 1 }] } };
const issuedSnapshot = { status: "ISSUED", versionNumber: 1, reportType: "MARK_BASED", reportCardNumber: "QA17C-CARD" };

function backup() { return {
  gradingSchemes: [{ id: "s1", schemeCode: "QA17C-S", name: "QA Scheme", academicYear: "2026-27", reportType: "MARK_BASED", status: "ACTIVE" }],
  gradeBands: [{ id: "g1", gradingSchemeId: "s1", gradeCode: "A", label: "A", minimumPercentage: "0", maximumPercentage: "100", displayOrder: 1 }],
  reportCardTemplates: [{ id: "t1", templateCode: "QA17C-T", name: "QA Template", reportType: "MARK_BASED", academicYear: "2026-27", gradingSchemeId: "s1", status: "ACTIVE", templateDefinitionJson: JSON.stringify(definition), versionNumber: 1 }],
  reportCardBatches: [{ id: "b1", batchNumber: "QA17C-B", academicYear: "2026-27", reportType: "MARK_BASED", templateId: "t1", className: "VI", section: "A", title: "QA", status: "ISSUED", templateSnapshotJson: JSON.stringify(templateSnapshot) }],
  reportCardBatchExamSources: [{ id: "x1", batchId: "b1", examCycleId: "e1", displayOrder: 1 }],
  studentReportCards: [{ id: "c1", reportCardNumber: "QA17C-CARD", batchId: "b1", studentId: "stu", academicYear: "2026-27", className: "VI", section: "A", reportType: "MARK_BASED", status: "ISSUED", currentVersionNumber: 1, draftDataJson: JSON.stringify({ kind: "MARK_BASED", calculation: { rows: [] } }) }],
  studentReportCardVersions: [{ id: "v1", reportCardId: "c1", versionNumber: 1, versionType: "ORIGINAL", snapshotJson: JSON.stringify(issuedSnapshot), issuedAt: "2026-07-17T00:00:00.000Z" }],
  studentReportCardEvents: [{ id: "ev1", reportCardId: "c1", versionId: "v1", eventType: "ISSUED", eventDate: "2026-07-17T00:00:00.000Z" }]
}; }

function result() { return { gradingSchemes: emptyEntityResult(), gradeBands: emptyEntityResult(), reportCardTemplates: emptyEntityResult(), reportCardBatches: emptyEntityResult(), reportCardBatchExamSources: emptyEntityResult(), studentReportCards: emptyEntityResult(), studentReportCardVersions: emptyEntityResult(), studentReportCardEvents: emptyEntityResult(), warnings: [] as string[] }; }

function fakeClient(collision = false) {
  const stores = Object.fromEntries(["gradingScheme","gradeBand","reportCardTemplate","reportCardBatch","reportCardBatchExamSource","studentReportCard","studentReportCardVersion","studentReportCardEvent"].map((name) => [name, new Map<string, any>()])) as Record<string, Map<string, any>>;
  if (collision) stores.gradingScheme.set("local-scheme", { id: "local-scheme", schemeCode: "QA17C-S" });
  const model = (name: string, unique: (row: any, where: any) => boolean) => ({
    findUnique: async ({ where }: any) => [...stores[name].values()].find((row) => unique(row, where)) ?? null,
    create: async ({ data }: any) => { const row = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() }; stores[name].set(row.id, row); return row; }
  });
  const client: any = {
    gradingScheme: model("gradingScheme", (r,w) => r.id===w.id || r.schemeCode===w.schemeCode),
    gradeBand: model("gradeBand", (r,w) => r.id===w.id || (w.gradingSchemeId_gradeCode && r.gradingSchemeId===w.gradingSchemeId_gradeCode.gradingSchemeId && r.gradeCode===w.gradingSchemeId_gradeCode.gradeCode)),
    reportCardTemplate: model("reportCardTemplate", (r,w) => r.id===w.id || r.templateCode===w.templateCode),
    reportCardBatch: model("reportCardBatch", (r,w) => r.id===w.id || r.batchNumber===w.batchNumber),
    reportCardBatchExamSource: model("reportCardBatchExamSource", (r,w) => r.id===w.id || (w.batchId_examCycleId && r.batchId===w.batchId_examCycleId.batchId && r.examCycleId===w.batchId_examCycleId.examCycleId)),
    studentReportCard: model("studentReportCard", (r,w) => r.id===w.id || r.reportCardNumber===w.reportCardNumber),
    studentReportCardVersion: model("studentReportCardVersion", (r,w) => r.id===w.id || (w.reportCardId_versionNumber && r.reportCardId===w.reportCardId_versionNumber.reportCardId && r.versionNumber===w.reportCardId_versionNumber.versionNumber)),
    studentReportCardEvent: model("studentReportCardEvent", (r,w) => r.id===w.id),
    examCycle: { findUnique: async ({where}:any) => where.id==="e1"?{id:"e1"}:null },
    studentProgressionDecision: { findUnique: async () => null }
  };
  return { client, stores };
}

describe("report-card restore QA", () => {
  it("restores all eight entity sets and is idempotent on repeat", async () => {
    const f=fakeClient(); const first=result(); await restoreReportCardData(f.client,backup() as any,new Map([["stu","local-stu"]]),first);
    expect(Object.values(f.stores).map(store=>store.size)).toEqual([1,1,1,1,1,1,1,1]);
    const second=result(); await restoreReportCardData(f.client,backup() as any,new Map([["stu","local-stu"]]),second);
    expect(Object.values(f.stores).map(store=>store.size)).toEqual([1,1,1,1,1,1,1,1]);
    expect(second.studentReportCardEvents.skipped).toBe(1);
  });

  it("isolates a same-code different-ID scheme collision and all dependants", async () => {
    const f=fakeClient(true); const outcome=result(); await restoreReportCardData(f.client,backup() as any,new Map([["stu","local-stu"]]),outcome);
    expect(outcome.gradingSchemes.skipped).toBe(1); expect(outcome.reportCardTemplates.skipped).toBe(1); expect(outcome.reportCardBatches.skipped).toBe(1); expect(outcome.studentReportCards.skipped).toBe(1);
    expect(outcome.warnings.join(" ")).toMatch(/collided.*isolated/i);
  });
});
