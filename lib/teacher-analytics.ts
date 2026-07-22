import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";
import { KG_CRITERIA, KG_EVALUATIONS, KG_GROWTH_PERIODS, KG_PERSONALITY_TRAITS, KG_SUMMARY_AREAS, normalizeKgDraft } from "@/lib/kg-report-card";
import { TEACHER_ANALYTICS_METRICS, TEACHER_ANALYTICS_METRIC_VERSION } from "@/lib/teacher-analytics-definitions";

export type DataQualityState = "COMPLETE" | "PARTIAL" | "INSUFFICIENT" | "NOT_APPLICABLE" | "SOURCE_MISSING";
type MetricEnvelope<T> = {
  key: string;
  calculationVersion: string;
  sourceModule: string;
  sourcePeriod: { academicYear: string; start: string; end: string };
  definition: string;
  numerator: string;
  denominator: string;
  completeness: DataQualityState;
  cohortSize: number | null;
  lastCalculatedAt: string;
  sensitivity: "INFORMATIONAL" | "REVIEW_SENSITIVE";
  warning: string;
  value: T;
};

const isoDay = (value: Date) => schoolDateKey(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const json = (value: unknown) => JSON.stringify(value);
const safeParse = (value: string) => { try { return JSON.parse(value); } catch { return null; } };

function envelope<T>(
  key: string,
  cycle: { academicYear: string; periodStart: Date; periodEnd: Date; metricDefinitionVersion: string },
  completeness: DataQualityState,
  value: T,
  cohortSize: number | null,
  calculatedAt: Date
): MetricEnvelope<T> {
  const definition = TEACHER_ANALYTICS_METRICS.find((item) => item.key === key)!;
  return {
    key: definition.key,
    calculationVersion: cycle.metricDefinitionVersion,
    sourceModule: definition.sourceModule,
    sourcePeriod: { academicYear: cycle.academicYear, start: isoDay(cycle.periodStart), end: isoDay(cycle.periodEnd) },
    definition: definition.calculation,
    numerator: definition.numerator,
    denominator: definition.denominator,
    completeness,
    cohortSize,
    lastCalculatedAt: calculatedAt.toISOString(),
    sensitivity: definition.informational ? "INFORMATIONAL" : "REVIEW_SENSITIVE",
    warning: definition.interpretationWarning,
    value
  };
}

export function normalizeTeacherAnalyticsCycleInput(input: any) {
  const cycleCode = String(input?.cycleCode ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  const academicYear = String(input?.academicYear ?? "").trim();
  const title = String(input?.title ?? "").trim();
  if (!/^[A-Z0-9][A-Z0-9-]{3,39}$/.test(cycleCode)) throw new Error("Cycle code must use 4-40 uppercase letters, numbers, or hyphens.");
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new Error("Academic year must use YYYY-YY.");
  if (title.length < 4 || title.length > 160) throw new Error("Title must be 4-160 characters.");
  const periodStart = new Date(`${String(input?.periodStart ?? "")}T00:00:00+05:30`);
  const periodEnd = new Date(`${String(input?.periodEnd ?? "")}T23:59:59.999+05:30`);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) throw new Error("Review dates must be valid India-local dates.");
  if (periodEnd < periodStart) throw new Error("Period end cannot precede period start.");
  const minimumStudentCohort = Number(input?.minimumStudentCohort ?? 5);
  if (!Number.isInteger(minimumStudentCohort) || minimumStudentCohort < 5 || minimumStudentCohort > 1000) throw new Error("Minimum Student cohort must be at least 5.");
  const notes = String(input?.notes ?? "").trim() || null;
  if (notes && notes.length > 2000) throw new Error("Cycle notes must be 2,000 characters or fewer.");
  return { cycleCode, academicYear, title, periodStart, periodEnd, minimumStudentCohort, notes, metricDefinitionVersion: TEACHER_ANALYTICS_METRIC_VERSION };
}

export async function teacherAnalyticsReadiness(prisma: PrismaClient, cycle: { academicYear: string; periodStart: Date; periodEnd: Date }) {
  const teachers = await prisma.staffMember.findMany({
    where: { status: "ACTIVE", staffType: "TEACHING" },
    select: { id: true, fullName: true, displayName: true, staffCode: true, userId: true, timetableTeacherId: true },
    orderBy: { fullName: "asc" }
  });
  const [attendanceSessions, homework, assessments, reportCards] = await Promise.all([
    prisma.staffAttendanceSession.count({ where: { attendanceDate: { gte: cycle.periodStart, lte: cycle.periodEnd } } }),
    prisma.homeworkAssignment.count({ where: { academicYear: cycle.academicYear, assignedDate: { gte: cycle.periodStart, lte: cycle.periodEnd } } }),
    prisma.examAssessment.count({ where: { academicYear: cycle.academicYear } }),
    prisma.studentReportCard.count({ where: { academicYear: cycle.academicYear } })
  ]);
  return {
    eligibleTeachers: teachers.map((teacher) => ({
      staffMemberId: teacher.id,
      teacherName: teacher.displayName ?? teacher.fullName,
      staffCode: teacher.staffCode ?? "Not assigned",
      linkedUser: Boolean(teacher.userId),
      linkedTimetableTeacher: Boolean(teacher.timetableTeacherId),
      state: teacher.timetableTeacherId ? "PARTIAL" : "SOURCE_MISSING"
    })),
    sources: { attendanceSessions, homeworkAssignments: homework, assessmentSheets: assessments, reportCards },
    warnings: [
      ...(teachers.some((teacher) => !teacher.timetableTeacherId) ? ["Some active Teachers have no timetable link; workload and assigned-scope evidence will show SOURCE_MISSING."] : []),
      "Readiness counts indicate source availability only. They are not Teacher scores."
    ]
  };
}

export async function calculateTeacherAnalyticsSnapshot(
  prisma: PrismaClient,
  cycle: { id: string; academicYear: string; periodStart: Date; periodEnd: Date; minimumStudentCohort: number; metricDefinitionVersion: string },
  staffMemberId: string,
  calculatedAt = new Date()
) {
  const staff = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    include: {
      timetableTeacher: { include: { assignments: { where: { academicYear: cycle.academicYear }, include: { classSection: true, subject: true } } } }
    }
  });
  if (!staff || staff.status !== "ACTIVE" || staff.staffType !== "TEACHING") throw new Error("Only active teaching StaffMembers are eligible.");
  const assignments = staff.timetableTeacher?.assignments ?? [];
  const scopes = assignments.map((a) => ({ className: a.classSection.className, section: a.classSection.section, subjectName: a.subject.name, subjectId: a.subjectId }));
  const scopeOr = scopes.map((s) => ({ className: s.className, section: s.section, subjectName: s.subjectName }));
  const periodWhere = { gte: cycle.periodStart, lte: cycle.periodEnd };
  const [attendanceSessions, attendanceRecords, leaveRows, substituteCovered, substituteRequired, homeworkRows, assessmentRows, reportCards, activeDraft] = await Promise.all([
    prisma.staffAttendanceSession.count({ where: { attendanceDate: periodWhere } }),
    prisma.staffAttendanceRecord.findMany({ where: { staffMemberId, session: { attendanceDate: periodWhere } }, select: { status: true, lateMinutes: true } }),
    prisma.staffLeaveRequest.findMany({ where: { staffMemberId, startDate: { lte: cycle.periodEnd }, endDate: { gte: cycle.periodStart } }, select: { status: true, totalDays: true } }),
    prisma.substituteAssignment.count({ where: { substituteStaffMemberId: staffMemberId, assignmentDate: periodWhere, status: { not: "CANCELLED" } } }),
    prisma.substituteAssignment.count({ where: { absentStaffMemberId: staffMemberId, assignmentDate: periodWhere, status: { not: "CANCELLED" } } }),
    staff.userId || scopeOr.length ? prisma.homeworkAssignment.findMany({
      where: { academicYear: cycle.academicYear, assignedDate: periodWhere, ...(staff.userId ? { createdByUserId: staff.userId } : { OR: scopeOr }) },
      include: { events: { where: { eventType: "CORRECTED" }, select: { id: true } } }
    }) : Promise.resolve([]),
    scopeOr.length ? prisma.examAssessment.findMany({
      where: { academicYear: cycle.academicYear, OR: scopeOr },
      include: { examCycle: { select: { examCode: true, examType: true, startDate: true, status: true } }, marks: { select: { studentId: true, entryStatus: true, marksObtained: true } }, events: { where: { eventType: "CORRECTION_APPLIED" }, select: { id: true } } },
      orderBy: [{ examCycle: { startDate: "asc" } }, { subjectName: "asc" }]
    }) : Promise.resolve([]),
    scopes.length ? prisma.studentReportCard.findMany({
      where: { academicYear: cycle.academicYear, OR: [...new Map(scopes.map((s) => [`${s.className}|${s.section}`, { className: s.className, section: s.section || null }])).values()] },
      select: { reportType: true, status: true, teacherOverallComment: true, draftDataJson: true }
    }) : Promise.resolve([]),
    staff.timetableTeacherId ? prisma.timetableDraft.findFirst({ where: { academicYear: cycle.academicYear, status: "ACTIVE" }, select: { id: true } }) : Promise.resolve(null)
  ]);

  const workloadState: DataQualityState = !staff.timetableTeacher ? "SOURCE_MISSING" : assignments.length ? "COMPLETE" : "PARTIAL";
  const workload = envelope("assigned_periods", cycle, workloadState, {
    assignedTeachingPeriods: assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0),
    classesTaught: new Set(scopes.map((s) => s.className)).size,
    sectionsTaught: new Set(scopes.map((s) => `${s.className}|${s.section}`)).size,
    subjectsTaught: new Set(scopes.map((s) => s.subjectName)).size,
    uniqueStudentCohorts: new Set(scopes.map((s) => `${s.className}|${s.section}`)).size,
    classTeacherAssignment: "NOT_RELIABLY_REPRESENTED",
    activeTimetableDraftAvailable: Boolean(activeDraft),
    interpretation: "Workload is contextual and is not a performance score."
  }, null, calculatedAt);
  const substitute = envelope("substitute_context", cycle, "COMPLETE", { periodsCoveredAsSubstitute: substituteCovered, periodsRequiringSubstitute: substituteRequired, interpretation: "Neither value is treated as negative performance." }, null, calculatedAt);
  const attendanceState: DataQualityState = attendanceSessions === 0 ? "SOURCE_MISSING" : attendanceRecords.length === attendanceSessions ? "COMPLETE" : "PARTIAL";
  const countStatus = (status: string) => attendanceRecords.filter((row) => row.status === status).length;
  const attendance = envelope("attendance_totals", cycle, attendanceState, {
    scheduledWorkingDaysAvailable: attendanceSessions,
    recordedDays: attendanceRecords.length,
    presentDays: countStatus("PRESENT"),
    absentDays: countStatus("ABSENT"),
    halfDays: attendanceRecords.filter((r) => r.status.includes("HALF")).length,
    lateDays: attendanceRecords.filter((r) => Number(r.lateMinutes ?? 0) > 0).length
  }, null, calculatedAt);
  const approvedLeaveDays = leaveRows.filter((r) => r.status === "APPROVED").reduce((sum, row) => sum + row.totalDays, 0);
  const leave = envelope("approved_leave", cycle, attendanceState, {
    approvedLeaveDays,
    pendingLeaveDays: leaveRows.filter((r) => ["DRAFT", "SUBMITTED", "PENDING"].includes(r.status)).reduce((sum, row) => sum + row.totalDays, 0),
    rejectedOrCancelledDays: leaveRows.filter((r) => ["REJECTED", "CANCELLED"].includes(r.status)).reduce((sum, row) => sum + row.totalDays, 0),
    privateReasonsExcluded: true,
    interpretation: "Approved leave is separate and is never combined into a punitive absence rate."
  }, null, calculatedAt);
  const homework = envelope("homework_activity", cycle, staff.userId ? "COMPLETE" : scopes.length ? "PARTIAL" : "SOURCE_MISSING", {
    assignmentsCreated: homeworkRows.length,
    drafts: homeworkRows.filter((r) => r.status === "DRAFT").length,
    published: homeworkRows.filter((r) => r.status === "PUBLISHED").length,
    corrected: homeworkRows.reduce((sum, r) => sum + r.events.length, 0),
    cancelled: homeworkRows.filter((r) => r.status === "CANCELLED").length,
    withDueDate: homeworkRows.filter((r) => r.dueDate).length,
    publishedAfterAssignedDate: homeworkRows.filter((r) => r.publishedAt && r.publishedAt > r.assignedDate).length,
    assignmentScopeMethod: staff.userId ? "LINKED_TEACHER_ACCOUNT" : "TIMETABLE_CLASS_SUBJECT_SCOPE"
  }, null, calculatedAt);
  const assessment = envelope("assessment_workflow", cycle, scopes.length ? (assessmentRows.length ? "COMPLETE" : "NOT_APPLICABLE") : "SOURCE_MISSING", {
    assignedSheets: assessmentRows.length,
    opened: assessmentRows.filter((r) => r.entryStatus === "OPEN").length,
    submitted: assessmentRows.filter((r) => r.entryStatus === "SUBMITTED").length,
    approved: assessmentRows.filter((r) => r.entryStatus === "APPROVED").length,
    locked: assessmentRows.filter((r) => r.entryStatus === "LOCKED").length,
    marksEntryCompleteness: assessmentRows.length ? round(assessmentRows.filter((r) => ["SUBMITTED", "APPROVED", "LOCKED"].includes(r.entryStatus)).length / assessmentRows.length * 100) : null,
    missingEntries: assessmentRows.reduce((sum, r) => sum + r.marks.filter((m) => !["PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE"].includes(m.entryStatus)).length, 0),
    correctionCount: assessmentRows.reduce((sum, r) => sum + r.events.length, 0),
    markStatusContext: {
      zero: assessmentRows.reduce((sum, r) => sum + r.marks.filter((m) => m.entryStatus === "PRESENT" && Number(m.marksObtained) === 0).length, 0),
      absent: assessmentRows.reduce((sum, r) => sum + r.marks.filter((m) => m.entryStatus === "ABSENT").length, 0),
      exempt: assessmentRows.reduce((sum, r) => sum + r.marks.filter((m) => m.entryStatus === "EXEMPT").length, 0),
      notApplicable: assessmentRows.reduce((sum, r) => sum + r.marks.filter((m) => m.entryStatus === "NOT_APPLICABLE").length, 0)
    }
  }, null, calculatedAt);

  const locked = assessmentRows.filter((row) => row.entryStatus === "LOCKED" && row.examCycle.status === "LOCKED");
  const outcomeRows = locked.map((row) => {
    const present = row.marks.filter((m) => m.entryStatus === "PRESENT" && m.marksObtained !== null);
    const cohortSize = present.length;
    if (cohortSize < cycle.minimumStudentCohort) return { examCode: row.examCycle.examCode, assessmentType: row.assessmentType, className: row.className, section: row.section, subjectName: row.subjectName, componentName: row.componentName, maximumMarks: Number(row.maxMarks), cohortSize, state: "INSUFFICIENT", message: "Insufficient cohort size", individualStudentsExcluded: true };
    const percentages = present.map((m) => Number(m.marksObtained) / Number(row.maxMarks) * 100).sort((a, b) => a - b);
    const middle = Math.floor(percentages.length / 2);
    const median = percentages.length % 2 ? percentages[middle] : (percentages[middle - 1] + percentages[middle]) / 2;
    const pass = row.passMarks === null ? null : present.filter((m) => Number(m.marksObtained) >= Number(row.passMarks)).length;
    return {
      examCode: row.examCycle.examCode, assessmentType: row.assessmentType, className: row.className, section: row.section, subjectName: row.subjectName, componentName: row.componentName, maximumMarks: Number(row.maxMarks),
      cohortSize, state: "COMPLETE", averagePercentage: round(percentages.reduce((a, b) => a + b, 0) / cohortSize), medianPercentage: round(median),
      passDisplayRate: pass === null ? null : round(pass / cohortSize * 100),
      absentRate: round(row.marks.filter((m) => m.entryStatus === "ABSENT").length / Math.max(1, row.marks.length) * 100),
      distributionBands: { below40: percentages.filter((v) => v < 40).length, from40To59: percentages.filter((v) => v >= 40 && v < 60).length, from60To74: percentages.filter((v) => v >= 60 && v < 75).length, atLeast75: percentages.filter((v) => v >= 75).length },
      individualStudentsExcluded: true
    };
  });
  const trendComparisons: Array<Record<string, unknown>> = [];
  let incompatibleTrendExclusions = 0;
  for (let index = 1; index < locked.length; index++) {
    const current = locked[index];
    const priorCandidates = locked.slice(0, index).filter((row) => row.academicYear === current.academicYear && row.className === current.className && row.section === current.section && row.subjectName === current.subjectName);
    if (!priorCandidates.length) continue;
    const previous = [...priorCandidates].reverse().find((row) => row.assessmentType === current.assessmentType && row.componentName === current.componentName && Number(row.maxMarks) === Number(current.maxMarks));
    if (!previous) { incompatibleTrendExclusions++; continue; }
    const priorMarks = new Map(previous.marks.filter((mark) => mark.entryStatus === "PRESENT" && mark.marksObtained !== null).map((mark) => [mark.studentId, Number(mark.marksObtained) / Number(previous.maxMarks) * 100]));
    const paired = current.marks.filter((mark) => mark.entryStatus === "PRESENT" && mark.marksObtained !== null && priorMarks.has(mark.studentId)).map((mark) => ({ before: priorMarks.get(mark.studentId)!, after: Number(mark.marksObtained) / Number(current.maxMarks) * 100 }));
    if (paired.length < cycle.minimumStudentCohort) {
      trendComparisons.push({ className: current.className, section: current.section, subjectName: current.subjectName, assessmentType: current.assessmentType, componentName: current.componentName, cohortSize: paired.length, state: "INSUFFICIENT", message: "Insufficient cohort size", individualStudentsExcluded: true });
      continue;
    }
    const changes = paired.map((pair) => pair.after - pair.before);
    trendComparisons.push({
      className: current.className, section: current.section, subjectName: current.subjectName, assessmentType: current.assessmentType, componentName: current.componentName,
      fromExam: previous.examCycle.examCode, toExam: current.examCycle.examCode, cohortSize: paired.length, state: "COMPLETE",
      averagePercentagePointChange: round(changes.reduce((sum, value) => sum + value, 0) / changes.length),
      improving: changes.filter((value) => value > 0.5).length, stable: changes.filter((value) => Math.abs(value) <= 0.5).length, declining: changes.filter((value) => value < -0.5).length,
      label: "Observed Student outcome trend for this assigned cohort.", causationClaimed: false, individualStudentsExcluded: true
    });
  }
  const incompatibleExclusions = assessmentRows.length - locked.length + incompatibleTrendExclusions;
  const outcomeState: DataQualityState = !locked.length ? "INSUFFICIENT" : outcomeRows.some((r) => r.state === "COMPLETE") ? "COMPLETE" : "INSUFFICIENT";
  const studentOutcome = envelope("student_outcomes", cycle, outcomeState, {
    label: "Observed Student outcome trend for this assigned cohort.",
    assessments: outcomeRows,
    trendComparisons,
    incompatibleAssessmentExclusions: incompatibleExclusions,
    compatibilityRule: "Same academic year, class/section, subject, assessment type/component, compatible maximum marks, and intersected Student cohort; minimum cohort enforced.",
    causationClaimed: false,
    teacherRankGenerated: false,
    studentIdentityStored: false
  }, outcomeRows.reduce((sum, row) => sum + row.cohortSize, 0), calculatedAt);

  const markCards = reportCards.filter((r) => r.reportType === "MARK_BASED");
  const reportCard = envelope("report_card_completion", cycle, scopes.length ? (markCards.length ? "PARTIAL" : "NOT_APPLICABLE") : "SOURCE_MISSING", {
    cardsAssigned: markCards.length,
    commentsCompleted: markCards.filter((r) => Boolean(r.teacherOverallComment?.trim())).length,
    submitted: markCards.filter((r) => ["READY_FOR_REVIEW", "APPROVED", "ISSUED", "SUPERSEDED"].includes(r.status)).length,
    returnedForCorrection: 0,
    issued: markCards.filter((r) => ["ISSUED", "SUPERSEDED"].includes(r.status)).length,
    completionRate: markCards.length ? round(markCards.filter((r) => Boolean(r.teacherOverallComment?.trim())).length / markCards.length * 100) : null,
    attributionWarning: "Class/section scope is contextual where a dedicated class-Teacher field is not represented."
  }, markCards.length, calculatedAt);
  const kgCards = reportCards.filter((r) => r.reportType === "KG_RUBRIC");
  const kgTotals = { studentsAssigned: kgCards.length, evaluationComplete: 0, intellectualRubricComplete: 0, personalityRubricComplete: 0, attendanceComplete: 0, growthComplete: 0, commentsComplete: 0, submitted: 0 };
  for (const card of kgCards) {
    const raw = safeParse(card.draftDataJson);
    try {
      const draft = normalizeKgDraft(raw);
      const evaluationComplete = KG_EVALUATIONS.every((evaluation) => KG_CRITERIA.every(([key]) => Boolean(draft.rubrics[evaluation]?.[key])) && KG_SUMMARY_AREAS.every((key) => Boolean(draft.summaryGrades[evaluation]?.[key])));
      if (evaluationComplete) kgTotals.evaluationComplete++;
      if (KG_EVALUATIONS.every((evaluation) => KG_CRITERIA.every(([key]) => Boolean(draft.rubrics[evaluation]?.[key])))) kgTotals.intellectualRubricComplete++;
      if (KG_EVALUATIONS.every((evaluation) => KG_PERSONALITY_TRAITS.every((key) => Boolean(draft.personality[evaluation]?.[key])))) kgTotals.personalityRubricComplete++;
      if (draft.attendance.every((row: { workingDays: number | null; daysPresent: number | null }) => row.workingDays !== null && row.daysPresent !== null)) kgTotals.attendanceComplete++;
      if (KG_GROWTH_PERIODS.every((evaluation) => draft.growth[evaluation].heightCm !== null && draft.growth[evaluation].weightKg !== null)) kgTotals.growthComplete++;
      if (KG_EVALUATIONS.every((evaluation) => Boolean(draft.evaluationComments[evaluation]?.comment))) kgTotals.commentsComplete++;
    } catch { /* invalid source is represented by PARTIAL completeness */ }
    if (["READY_FOR_REVIEW", "APPROVED", "ISSUED", "SUPERSEDED"].includes(card.status)) kgTotals.submitted++;
  }
  const kgRubric = envelope("kg_rubric_completion", cycle, scopes.length ? (kgCards.length ? "PARTIAL" : "NOT_APPLICABLE") : "SOURCE_MISSING", { ...kgTotals, childLevelResponsesExcluded: true, gradeDistributionUsedForJudgment: false }, kgCards.length, calculatedAt);

  const quality = {
    linkedStaffMember: "COMPLETE" as DataQualityState,
    timetableCoverage: workloadState,
    attendanceSource: attendanceState,
    homeworkSource: homework.completeness,
    assessmentSource: assessment.completeness,
    reportCardSource: reportCard.completeness,
    studentCohortThreshold: outcomeState,
    incompatibleAssessmentExclusions: incompatibleExclusions,
    missingAcademicYearLinks: assignments.filter((a) => a.academicYear !== cycle.academicYear).length,
    excludedDataReasons: [
      ...(incompatibleExclusions ? [`${incompatibleExclusions} assessment sheet(s) excluded because only locked compatible sources are used.`] : []),
      ...(!staff.timetableTeacher ? ["No linked timetable Teacher."] : []),
      ...(!staff.userId ? ["No linked Teacher login; Homework attribution uses timetable scope and is partial."] : [])
    ],
    zeroIsNotUsedForMissingSource: true
  };
  const context = {
    teacher: { staffMemberId: staff.id, staffCode: staff.staffCode, displayName: staff.displayName ?? staff.fullName, designation: staff.designation, department: staff.department, primarySubject: staff.primarySubject },
    fairnessPolicy: { compositeScore: false, ranking: false, automaticEmploymentDecision: false, aiConclusion: false, sensitiveStudentAttributesUsed: false },
    metricDefinitions: TEACHER_ANALYTICS_METRICS.map(({ key, displayName, category, calculation, numerator, denominator, sourceModule }) => ({ key, displayName, category, calculation, numerator, denominator, sourceModule, calculationVersion: cycle.metricDefinitionVersion }))
  };
  const payload = { workload, attendance, leave, substitute, homework, assessment, studentOutcome, reportCard, kgRubric, dataQuality: quality, context };
  const snapshotHash = createHash("sha256").update(json(payload)).digest("hex");
  return {
    academicYear: cycle.academicYear, metricDefinitionVersion: cycle.metricDefinitionVersion, sourceCalculatedAt: calculatedAt,
    workloadJson: json(workload), attendanceJson: json(attendance), leaveJson: json(leave), substituteJson: json(substitute), homeworkJson: json(homework),
    assessmentWorkflowJson: json(assessment), studentOutcomeJson: json(studentOutcome), reportCardJson: json(reportCard), kgRubricJson: json(kgRubric),
    dataQualityJson: json(quality), contextJson: json(context), snapshotHash
  };
}

export function publicTeacherAnalyticsSnapshot(row: any, identified = true) {
  const context = safeParse(row.contextJson) ?? {};
  return {
    snapshotId: row.id,
    cycle: row.reviewCycle ? { cycleCode: row.reviewCycle.cycleCode, title: row.reviewCycle.title, academicYear: row.reviewCycle.academicYear, periodStart: row.reviewCycle.periodStart, periodEnd: row.reviewCycle.periodEnd, status: row.reviewCycle.status, minimumStudentCohort: row.reviewCycle.minimumStudentCohort } : undefined,
    teacher: identified ? context.teacher : undefined,
    metricDefinitionVersion: row.metricDefinitionVersion,
    sourceCalculatedAt: row.sourceCalculatedAt,
    workload: safeParse(row.workloadJson), attendance: safeParse(row.attendanceJson), leave: safeParse(row.leaveJson), substitute: safeParse(row.substituteJson),
    homework: safeParse(row.homeworkJson), assessmentWorkflow: safeParse(row.assessmentWorkflowJson), studentOutcome: safeParse(row.studentOutcomeJson),
    reportCard: safeParse(row.reportCardJson), kgRubric: safeParse(row.kgRubricJson), dataQuality: safeParse(row.dataQualityJson),
    fairnessPolicy: context.fairnessPolicy,
    snapshotHash: row.snapshotHash,
    containsStudentIdentity: false,
    containsRawMarks: false
  };
}
