export const TEACHER_ANALYTICS_METRIC_VERSION = "17D-v1";
export const TEACHER_ANALYTICS_MINIMUM_COHORT = 5;

export type TeacherAnalyticsMetricDefinition = {
  key: string;
  displayName: string;
  category: string;
  description: string;
  calculation: string;
  numerator: string;
  denominator: string;
  sourceModule: string;
  interpretationWarning: string;
  minimumData: string;
  informational: boolean;
  directionHasNoAutomaticValueJudgment: true;
};

const contextWarning = "This is contextual evidence, not a quality score or employment conclusion.";
const activityWarning = "Activity volume alone does not measure teaching quality.";
const outcomeWarning = "Observed Student outcome trend for this assigned cohort. This does not establish Teacher causation.";

export const TEACHER_ANALYTICS_METRICS: readonly TeacherAnalyticsMetricDefinition[] = [
  { key: "assigned_periods", displayName: "Assigned teaching periods", category: "WORKLOAD", description: "Periods allocated in timetable assignments.", calculation: "Sum of periodsPerWeek for active linked timetable assignments.", numerator: "Sum of periodsPerWeek in active linked assignments.", denominator: "Not applicable; this is an absolute workload-context count.", sourceModule: "Timetable", interpretationWarning: contextWarning, minimumData: "Active StaffMember and linked timetable Teacher.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "timetable_coverage", displayName: "Timetable assignment coverage", category: "WORKLOAD", description: "Whether timetable assignment and active-draft evidence are available.", calculation: "Source-state check across linked assignment and active timetable entry records.", numerator: "Available linked timetable assignment and active-draft sources.", denominator: "Expected linked timetable sources for the Teacher and academic year.", sourceModule: "Timetable", interpretationWarning: contextWarning, minimumData: "Linked timetable Teacher.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "attendance_totals", displayName: "Staff attendance context", category: "ATTENDANCE", description: "Present, absent, half-day and late totals.", calculation: "Count of official staff attendance records in the review period by recorded status.", numerator: "Official attendance records in each recorded status.", denominator: "Official attendance sessions in the review period.", sourceModule: "Staff Attendance", interpretationWarning: "Approved leave is shown separately and is never treated as unexplained absence.", minimumData: "Attendance sessions in period.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "approved_leave", displayName: "Approved leave context", category: "LEAVE", description: "Approved leave days kept separate from other leave states.", calculation: "Sum of totalDays for overlapping approved leave requests.", numerator: "Sum of leave days grouped by approved, pending, or rejected/cancelled status.", denominator: "Not applicable; leave is reported as separate contextual days.", sourceModule: "Staff Leave", interpretationWarning: "Approved leave must not be penalised.", minimumData: "Leave records in period, when applicable.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "substitute_context", displayName: "Substitute-period context", category: "WORKLOAD", description: "Periods covered and periods requiring cover.", calculation: "Count of non-cancelled substitute assignments in period.", numerator: "Non-cancelled substitute assignments covered or requiring cover.", denominator: "Not applicable; this is an absolute context count.", sourceModule: "Substitute Teachers", interpretationWarning: "Providing or requiring substitute cover is contextual and not negative performance.", minimumData: "Substitute records, when applicable.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "homework_activity", displayName: "Homework workflow activity", category: "HOMEWORK", description: "Draft, published, corrected and cancelled activity in authorised scope.", calculation: "Count assignments and correction events in the review period and linked class/subject scope.", numerator: "Assignments or correction events in each workflow state.", denominator: "All authorised-scope assignments in the review period.", sourceModule: "Homework", interpretationWarning: "Assignment count is a workload/activity indicator, not a quality measure.", minimumData: "Linked timetable scope or linked Teacher account.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "assessment_workflow", displayName: "Marks workflow completion", category: "ASSESSMENT", description: "Assigned assessment sheets and workflow completion.", calculation: "Count authorised assessment sheets and mark statuses by workflow state.", numerator: "Authorised assessment sheets in each workflow state.", denominator: "All assessment sheets in the linked Teacher scope.", sourceModule: "Exams and Marks", interpretationWarning: "Correction count alone is not a performance judgment.", minimumData: "Assessment sheets in linked timetable scope.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "student_outcomes", displayName: "Student outcome trends", category: "OUTCOMES", description: "Aggregate results from compatible locked assessments.", calculation: "Aggregate percentages and status distributions; trends use compatible assessment configurations and intersected cohorts.", numerator: "Aggregate normalised marks, pass-display counts, or percentage-point changes.", denominator: "Present records in the compatible locked assessment or intersected cohort.", sourceModule: "Exams and Marks", interpretationWarning: outcomeWarning, minimumData: "Locked compatible assessments and at least the cycle minimum cohort.", informational: false, directionHasNoAutomaticValueJudgment: true },
  { key: "report_card_completion", displayName: "Report-card completion", category: "REPORT_CARDS", description: "Completion workflow for cards in assigned cohorts.", calculation: "Count assigned-scope cards by workflow state and completed Teacher comments.", numerator: "Assigned cards with completed comments or the requested workflow state.", denominator: "All mark-based cards in the assigned cohort.", sourceModule: "Digital Report Cards", interpretationWarning: activityWarning, minimumData: "Report-card batches in assigned cohorts.", informational: true, directionHasNoAutomaticValueJudgment: true },
  { key: "kg_rubric_completion", displayName: "KG rubric completion", category: "REPORT_CARDS", description: "Evaluation I-V, rubric, personality, attendance, growth and comment completeness.", calculation: "Aggregate validated KG draft completeness without child-level responses.", numerator: "Assigned KG cards complete for each rubric dimension.", denominator: "All KG cards in the assigned cohort.", sourceModule: "KG Rubric Assessments", interpretationWarning: "Rubric-grade distributions are not used to judge Teacher quality.", minimumData: "KG report cards in assigned cohorts.", informational: true, directionHasNoAutomaticValueJudgment: true }
] as const;

export function metricDefinition(key: string) {
  return TEACHER_ANALYTICS_METRICS.find((item) => item.key === key) ?? null;
}
