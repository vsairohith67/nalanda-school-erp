import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { schoolDateKey } from "@/lib/format";
import { PERMISSIONS, RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";
import { parseAndValidateBackup } from "@/lib/restore";
import { TEACHER_ANALYTICS_METRICS, TEACHER_ANALYTICS_METRIC_VERSION } from "@/lib/teacher-analytics-definitions";
import { normalizeTeacherAnalyticsCycleInput, publicTeacherAnalyticsSnapshot } from "@/lib/teacher-analytics";
import { teacherAnalyticsReportCsv } from "@/lib/teacher-analytics-reports";
import { ownTeacherSnapshotWhere, safeTeacherReview } from "@/lib/teacher-analytics-scope";

const source = (path: string) => readFileSync(path, "utf8");
const json = (value: unknown) => JSON.stringify(value);
const metric = (value: unknown, completeness = "COMPLETE") => json({ sourceModule: "QA", sourcePeriod: { academicYear: "2026-27", start: "2026-04-01", end: "2026-06-30" }, definition: "Exact QA definition", completeness, cohortSize: null, lastCalculatedAt: "2026-07-17T00:00:00.000Z", sensitivity: "INFORMATIONAL", warning: "Context only.", value });

function analyticsBackup() {
  return createBackupDocument({
    generatedAt: new Date("2026-07-17T00:00:00Z"), generatedBy: "QA17D", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [],
    staffMembers: [{ id: "staff-1", staffCode: "QA17D-T1", fullName: "QA17D Teacher", staffType: "TEACHING", designation: "Teacher", status: "ACTIVE", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" }],
    teacherAnalyticsReviewCycles: [{ id: "cycle-1", cycleCode: "QA17D-CYCLE", academicYear: "2026-27", title: "QA17D Review", periodStart: "2026-04-01T00:00:00.000Z", periodEnd: "2026-06-30T00:00:00.000Z", status: "FINALISED", minimumStudentCohort: 5, metricDefinitionVersion: TEACHER_ANALYTICS_METRIC_VERSION, finalisedAt: "2026-07-17T00:00:00.000Z", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" }],
    teacherAnalyticsSnapshots: [{ id: "snapshot-1", reviewCycleId: "cycle-1", staffMemberId: "staff-1", academicYear: "2026-27", metricDefinitionVersion: TEACHER_ANALYTICS_METRIC_VERSION, sourceCalculatedAt: "2026-07-17T00:00:00.000Z", workloadJson: metric({ assignedTeachingPeriods: 5 }), attendanceJson: metric({ presentDays: 2 }), leaveJson: metric({ approvedLeaveDays: 1 }), substituteJson: metric({ periodsCoveredAsSubstitute: 0 }), homeworkJson: metric({ published: 1 }), assessmentWorkflowJson: metric({ assignedSheets: 1 }), studentOutcomeJson: metric({ assessments: [{ cohortSize: 5 }], studentIdentityStored: false }), reportCardJson: metric({ cardsAssigned: 1 }), kgRubricJson: metric({ studentsAssigned: 0 }, "NOT_APPLICABLE"), dataQualityJson: json({ timetableCoverage: "COMPLETE", studentCohortThreshold: "COMPLETE" }), contextJson: json({ teacher: { staffMemberId: "staff-1", staffCode: "QA17D-T1", displayName: "QA17D Teacher" }, fairnessPolicy: { compositeScore: false, ranking: false, automaticEmploymentDecision: false } }), snapshotHash: "a".repeat(64), createdAt: "2026-07-17T00:00:00.000Z" }],
    teacherAnalyticsReviews: [{ id: "review-1", snapshotId: "snapshot-1", status: "FINALISED", strengthsNote: "Factual evidence.", teacherResponse: "Teacher context.", finalisedAt: "2026-07-17T00:00:00.000Z", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" }],
    teacherAnalyticsEvents: [{ id: "event-1", reviewCycleId: "cycle-1", snapshotId: "snapshot-1", reviewId: "review-1", eventType: "REVIEW_FINALISED", eventDate: "2026-07-17T00:00:00.000Z", createdAt: "2026-07-17T00:00:00.000Z" }]
  });
}

describe("Teacher Performance Analytics foundation", () => {
  it("normalises cycle codes and enforces date and minimum-cohort safety", () => {
    const cycle = normalizeTeacherAnalyticsCycleInput({ cycleCode: " qa17d cycle ", academicYear: "2026-27", title: "QA17D evidence review", periodStart: "2026-04-01", periodEnd: "2026-06-30", minimumStudentCohort: 5 });
    expect(cycle.cycleCode).toBe("QA17D-CYCLE"); expect(cycle.metricDefinitionVersion).toBe(TEACHER_ANALYTICS_METRIC_VERSION);
    expect(() => normalizeTeacherAnalyticsCycleInput({ ...cycle, periodStart: "2026-06-30", periodEnd: "2026-04-01" })).toThrow(/cannot precede/);
    expect(() => normalizeTeacherAnalyticsCycleInput({ cycleCode: "QA17D-CYCLE", academicYear: "2026-27", title: "QA17D evidence review", periodStart: "2026-04-01", periodEnd: "2026-06-30", minimumStudentCohort: 4 })).toThrow(/at least 5/);
  });

  it("preserves India-local source dates instead of shifting them through UTC", () => {
    expect(schoolDateKey(new Date("2026-07-01T00:00:00+05:30"))).toBe("2026-07-01");
    expect(source("lib/teacher-analytics.ts")).toContain("const isoDay = (value: Date) => schoolDateKey(value)");
    expect(source("lib/teacher-analytics.ts")).toContain("start: isoDay(cycle.periodStart), end: isoDay(cycle.periodEnd)");
    const csv = teacherAnalyticsReportCsv({
      aggregateOnly: false,
      rows: [{
        cycleCode: "QA17D", academicYear: "2026-27",
        periodStart: new Date("2026-07-01T00:00:00+05:30"), periodEnd: new Date("2026-07-31T23:59:59+05:30"),
        staffCode: "QA17D-T1", teacherName: "QA Teacher",
        timetableCoverage: "COMPLETE", attendanceSource: "COMPLETE", homeworkSource: "COMPLETE", assessmentSource: "COMPLETE", reportCardSource: "COMPLETE", studentCohortThreshold: "COMPLETE",
        approvedLeaveDays: 0, homeworkPublished: 0, assessmentSheets: 0, lockedSheets: 0, reportCardsAssigned: 0, kgStudentsAssigned: 0, reviewStatus: "FINALISED", insufficientEvidence: 0
      }]
    } as never);
    expect(csv).toContain('"2026-07-01","2026-07-31"');
    expect(csv).not.toContain('"2026-06-30"');
  });

  it("defines versioned contextual metrics without weights, score, or rank", () => {
    expect(TEACHER_ANALYTICS_METRICS.map((item) => item.key)).toEqual(expect.arrayContaining(["assigned_periods","attendance_totals","approved_leave","homework_activity","assessment_workflow","student_outcomes","report_card_completion","kg_rubric_completion"]));
    for (const item of TEACHER_ANALYTICS_METRICS) { expect(item.sourceModule).toBeTruthy(); expect(item.calculation).toBeTruthy(); expect(item.numerator).toBeTruthy(); expect(item.denominator).toBeTruthy(); expect(item.interpretationWarning).toBeTruthy(); expect(item.directionHasNoAutomaticValueJudgment).toBe(true); }
    expect(source("lib/teacher-analytics.ts")).toContain("calculationVersion: cycle.metricDefinitionVersion");
    expect(JSON.stringify(TEACHER_ANALYTICS_METRICS).toLowerCase()).not.toContain("weight");
  });

  it("applies employment-sensitive role defaults and own-only Teacher isolation", () => {
    for (const permission of ["VIEW_TEACHER_ANALYTICS","MANAGE_TEACHER_ANALYTICS_CYCLES","GENERATE_TEACHER_ANALYTICS_SNAPSHOTS","REVIEW_TEACHER_ANALYTICS","SHARE_TEACHER_ANALYTICS_REVIEW","FINALISE_TEACHER_ANALYTICS_REVIEW","VIEW_TEACHER_ANALYTICS_REPORTS","EXPORT_TEACHER_ANALYTICS_REPORTS"] as const) expect(RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL.has(permission)).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("VIEW_TEACHER_ANALYTICS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("VIEW_OWN_TEACHER_ANALYTICS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("VIEW_TEACHER_ANALYTICS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_TEACHER_ANALYTICS_REPORTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("EXPORT_TEACHER_ANALYTICS_REPORTS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ACCOUNTANT.has("VIEW_TEACHER_ANALYTICS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PARENT.has("VIEW_OWN_TEACHER_ANALYTICS")).toBe(false);
    expect(PERMISSIONS).toContain("FINALISE_TEACHER_ANALYTICS_REVIEW");
    expect(ownTeacherSnapshotWhere("staff-1")).toMatchObject({ staffMemberId: "staff-1" });
  });

  it("returns only shared/finalised review fields to Teachers and labels response rights", () => {
    const safe = safeTeacherReview({ status: "SHARED_WITH_TEACHER", strengthsNote: "Evidence", supportNeededNote: null, agreedActionsNote: null, leadershipContextNote: "Context", teacherResponse: null, nextReviewDate: null, sharedAt: new Date(), teacherRespondedAt: null, finalisedAt: null, createdByUserId: "hidden", finalisedByUserId: "hidden" });
    expect(safe).not.toHaveProperty("createdByUserId"); expect(safe).not.toHaveProperty("finalisedByUserId"); expect(safe?.teacherResponseNotice).toMatch(/not a legal acknowledgment/);
  });

  it("public snapshot allowlist excludes raw marks, Student identity, contacts, and actor IDs", () => {
    const backup = analyticsBackup(); const row = { ...backup.teacherAnalyticsSnapshots[0], id: "snapshot-1", sourceCalculatedAt: new Date("2026-07-17"), reviewCycle: backup.teacherAnalyticsReviewCycles[0] };
    const value = publicTeacherAnalyticsSnapshot(row); const text = JSON.stringify(value);
    expect(value.containsStudentIdentity).toBe(false); expect(value.containsRawMarks).toBe(false);
    for (const forbidden of ["studentName","admissionNo","marksObtained","phone1","passwordHash","createdByUserId"]) expect(text).not.toContain(forbidden);
  });

  it("backs up version 26, preserves immutable analytics arrays, and excludes actor IDs and passwords", () => {
    const backup = analyticsBackup(); expect(backup.metadata.backupVersion).toBe(45);
    expect(backup.teacherAnalyticsReviewCycles).toHaveLength(1); expect(backup.teacherAnalyticsSnapshots).toHaveLength(1); expect(backup.teacherAnalyticsReviews).toHaveLength(1); expect(backup.teacherAnalyticsEvents).toHaveLength(1);
    expect(JSON.stringify(backup)).not.toContain("passwordHash"); expect(backup.teacherAnalyticsSnapshots[0]).not.toHaveProperty("createdByUserId"); expect(backup.teacherAnalyticsEvents[0]).not.toHaveProperty("recordedByUserId");
    const parsed = parseAndValidateBackup(backup); expect(parsed.teacherAnalyticsSnapshots[0].snapshotHash).toBe("a".repeat(64));
  });

  it("keeps version 25 backups compatible when analytics arrays are absent", () => {
    const old: any = analyticsBackup(); old.metadata.backupVersion = 25;
    for (const key of ["teacherAnalyticsReviewCycles","teacherAnalyticsSnapshots","teacherAnalyticsReviews","teacherAnalyticsEvents"]) { delete old[key]; delete old.metadata.counts[key]; }
    const parsed = parseAndValidateBackup(old); expect(parsed.teacherAnalyticsReviewCycles).toEqual([]); expect(parsed.teacherAnalyticsSnapshots).toEqual([]);
  });

  it("rejects snapshot Student identity/raw marks and invalid ownership links during restore validation", () => {
    const identity: any = analyticsBackup(); identity.teacherAnalyticsSnapshots[0].studentOutcomeJson = json({ studentName: "Must not restore", marksObtained: 90 });
    expect(() => parseAndValidateBackup(identity)).toThrow(/prohibited Student identity/);
    const wrongStaff: any = analyticsBackup(); wrongStaff.teacherAnalyticsSnapshots[0].staffMemberId = "unrelated-staff";
    expect(() => parseAndValidateBackup(wrongStaff)).toThrow(/invalid cycle or StaffMember link/);
  });

  it("guards every direct API and keeps Viewer export blocked by permission", () => {
    const guards: Record<string,string> = {
      "app/api/teacher-analytics/cycles/route.ts": "MANAGE_TEACHER_ANALYTICS_CYCLES",
      "app/api/teacher-analytics/cycles/[id]/snapshots/route.ts": "GENERATE_TEACHER_ANALYTICS_SNAPSHOTS",
      "app/api/teacher-analytics/snapshots/[snapshotId]/review/route.ts": "REVIEW_TEACHER_ANALYTICS",
      "app/api/teacher-analytics/reports/route.ts": "VIEW_TEACHER_ANALYTICS_REPORTS",
      "app/api/teacher-analytics/reports/export/route.ts": "EXPORT_TEACHER_ANALYTICS_REPORTS",
      "app/api/teacher/analytics/route.ts": "VIEW_OWN_TEACHER_ANALYTICS"
    };
    for (const [file, permission] of Object.entries(guards)) expect(source(file),file).toContain(permission);
    expect(source("lib/teacher-analytics-reports.ts")).toContain("Aggregate Viewer/Auditor access does not include export");
  });

  it("uses accessible in-app dialogs and contains no native browser dialogs", () => {
    const forms=source("components/teacher-analytics-forms.tsx");
    expect(forms).toContain('role="dialog"'); expect(forms).toContain('aria-modal="true"');
    expect(forms).toContain("autoFocus");
    expect(forms).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
  });

  it("does not render zero metrics for missing sources and restricts self-view to Teachers", () => {
    const detailPage = source("app/teacher-analytics/[cycleId]/teachers/[snapshotId]/page.tsx");
    expect(detailPage).toContain('data.completeness === "SOURCE_MISSING"');
    expect(detailPage).toContain("No zero values are inferred.");
    const selfPage = source("app/teacher/analytics/page.tsx");
    expect(selfPage).toContain('user.role !== "TEACHER"');
    expect(selfPage).toContain('redirect("/unauthorized")');
  });

  it("documents workflow immutability, cohort privacy, approved leave, and Prompt 18A boundary", () => {
    const docs=source("docs/TEACHER_PERFORMANCE_ANALYTICS_WORKFLOW.md");
    for(const phrase of ["no composite score","no ranking","minimum cohort","approved leave","Teacher response","backup version 26","Prompt 18A"])expect(docs.toLowerCase()).toContain(phrase.toLowerCase());
  });
});
