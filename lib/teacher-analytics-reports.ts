import type { PrismaClient } from "@prisma/client";
import { csvCell } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";
import { publicTeacherAnalyticsSnapshot } from "@/lib/teacher-analytics";

export async function buildTeacherAnalyticsReport(prisma: PrismaClient, cycleId?: string, aggregateOnly = false) {
  const cycles = await prisma.teacherAnalyticsReviewCycle.findMany({
    where: cycleId ? { id: cycleId } : undefined,
    include: {
      snapshots: {
        include: { staffMember: { select: { staffCode: true, fullName: true, displayName: true } }, review: true }
      }
    },
    orderBy: { periodStart: "desc" }
  });
  const detailedRows = cycles.flatMap((cycle) => cycle.snapshots.map((snapshot) => {
    const data = publicTeacherAnalyticsSnapshot(snapshot, !aggregateOnly);
    const quality = data.dataQuality ?? {};
    return {
      cycleCode: cycle.cycleCode,
      academicYear: cycle.academicYear,
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      teacherName: snapshot.staffMember.displayName ?? snapshot.staffMember.fullName,
      staffCode: snapshot.staffMember.staffCode ?? "Not assigned",
      timetableCoverage: quality.timetableCoverage,
      attendanceSource: quality.attendanceSource,
      homeworkSource: quality.homeworkSource,
      assessmentSource: quality.assessmentSource,
      reportCardSource: quality.reportCardSource,
      studentCohortThreshold: quality.studentCohortThreshold,
      approvedLeaveDays: data.leave?.value?.approvedLeaveDays ?? null,
      homeworkPublished: data.homework?.value?.published ?? null,
      assessmentSheets: data.assessmentWorkflow?.value?.assignedSheets ?? null,
      lockedSheets: data.assessmentWorkflow?.value?.locked ?? null,
      reportCardsAssigned: data.reportCard?.value?.cardsAssigned ?? null,
      kgStudentsAssigned: data.kgRubric?.value?.studentsAssigned ?? null,
      reviewStatus: snapshot.review?.status ?? "NOT_STARTED",
      insufficientEvidence: Object.values(quality).filter((value) => ["INSUFFICIENT", "SOURCE_MISSING"].includes(String(value))).length
    };
  }));
  const sourceStateSummary = (values: unknown[]) => {
    const counts = new Map<string, number>();
    for (const value of values) {
      const state = String(value ?? "SOURCE_MISSING");
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    return [...counts.entries()].map(([state, total]) => `${state}: ${total}`).join("; ");
  };
  const rows = aggregateOnly
    ? cycles.map((cycle) => {
        const cycleRows = detailedRows.filter((row) => row.cycleCode === cycle.cycleCode);
        return {
          cycleCode: "School aggregate",
          academicYear: cycle.academicYear,
          periodStart: cycle.periodStart,
          periodEnd: cycle.periodEnd,
          teacherName: undefined,
          staffCode: undefined,
          timetableCoverage: sourceStateSummary(cycleRows.map((row) => row.timetableCoverage)),
          attendanceSource: sourceStateSummary(cycleRows.map((row) => row.attendanceSource)),
          homeworkSource: sourceStateSummary(cycleRows.map((row) => row.homeworkSource)),
          assessmentSource: sourceStateSummary(cycleRows.map((row) => row.assessmentSource)),
          reportCardSource: sourceStateSummary(cycleRows.map((row) => row.reportCardSource)),
          studentCohortThreshold: sourceStateSummary(cycleRows.map((row) => row.studentCohortThreshold)),
          approvedLeaveDays: null,
          homeworkPublished: null,
          assessmentSheets: null,
          lockedSheets: null,
          reportCardsAssigned: null,
          kgStudentsAssigned: null,
          reviewStatus: `${cycleRows.filter((row) => row.reviewStatus === "FINALISED").length} of ${cycleRows.length} finalised`,
          insufficientEvidence: cycleRows.reduce((total, row) => total + row.insufficientEvidence, 0)
        };
      })
    : detailedRows;
  const count = (state: string) => detailedRows.filter((row) => Object.values(row).includes(state)).length;
  return {
    cycles: cycles.map((cycle) => ({ cycleCode: aggregateOnly ? "School aggregate" : cycle.cycleCode, academicYear: cycle.academicYear, status: cycle.status, snapshotCount: cycle.snapshots.length, reviewsShared: cycle.snapshots.filter((s) => ["SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED", "FINALISED"].includes(s.review?.status ?? "")).length, reviewsFinalised: cycle.snapshots.filter((s) => s.review?.status === "FINALISED").length })),
    rows,
    summary: {
      snapshots: detailedRows.length,
      completeSourceStates: count("COMPLETE"),
      partialSourceStates: count("PARTIAL"),
      insufficientSourceStates: count("INSUFFICIENT") + count("SOURCE_MISSING"),
      reviewsShared: detailedRows.filter((r) => ["SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED", "FINALISED"].includes(r.reviewStatus)).length,
      reviewsFinalised: detailedRows.filter((r) => r.reviewStatus === "FINALISED").length
    },
    aggregateOnly,
    policy: { compositeScore: false, ranking: false, automaticEmploymentDecision: false, studentIdentityExcluded: true }
  };
}

export function teacherAnalyticsReportCsv(report: Awaited<ReturnType<typeof buildTeacherAnalyticsReport>>) {
  if (report.aggregateOnly) throw new Error("Aggregate Viewer/Auditor access does not include export.");
  const headers = ["Cycle Code", "Academic Year", "Period Start", "Period End", "Staff Code", "Teacher", "Timetable Source", "Attendance Source", "Homework Source", "Assessment Source", "Report-card Source", "Cohort Evidence", "Approved Leave Days", "Homework Published", "Assessment Sheets", "Locked Sheets", "Report Cards Assigned", "KG Students Assigned", "Review Status", "Insufficient Evidence Count"];
  const rows = report.rows.map((row) => [row.cycleCode, row.academicYear, schoolDateKey(new Date(row.periodStart)), schoolDateKey(new Date(row.periodEnd)), row.staffCode, row.teacherName, row.timetableCoverage, row.attendanceSource, row.homeworkSource, row.assessmentSource, row.reportCardSource, row.studentCohortThreshold, row.approvedLeaveDays, row.homeworkPublished, row.assessmentSheets, row.lockedSheets, row.reportCardsAssigned, row.kgStudentsAssigned, row.reviewStatus, row.insufficientEvidence].map(csvCell).join(","));
  return [headers.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";
}

export function teacherAnalyticsReportFilename(now = new Date()) {
  return `teacher-analytics-safe-report-${schoolDateKey(now)}.csv`;
}
