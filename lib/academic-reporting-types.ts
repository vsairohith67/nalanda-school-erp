export const ACADEMIC_REPORT_SCHEMA_VERSION = 1 as const;
export const ACADEMIC_REPORT_MINIMUM_GROUP = 5;
export const ACADEMIC_REPORT_MAX_SOURCES = 2_000;
export const ACADEMIC_REPORT_MAX_EXAMS = 12;

export const ACADEMIC_REPORT_FAMILIES = [
  "STUDENT_LONGITUDINAL",
  "CLASS_SECTION_SUMMARY",
  "SUBJECT_PAPER_DISTRIBUTION",
  "SUBJECT_GROUP_SUMMARY",
  "OUTCOME_DISTRIBUTION",
  "COMPARATIVE_DELTA",
  "COMPLETION_MISSING_SOURCE",
  "CLASS_AVERAGE_HIGHEST",
  "BOARD_CLASS_COMPARATIVE",
  "LEADERSHIP_SUMMARY"
] as const;

export type AcademicReportFamily = (typeof ACADEMIC_REPORT_FAMILIES)[number];
export type AcademicNormalizationRule = "NONE" | "STRICT_MATCH" | "PERCENTAGE_NORMALIZED";
export type AcademicReportAudience = "LEADERSHIP" | "TEACHER" | "LEARNER" | "VIEWER";
export type AcademicEntryState = "PRESENT" | "ABSENT" | "EXEMPT" | "NOT_APPLICABLE" | "NOT_ENTERED" | "ZERO";

export type AcademicReportInput = {
  family: AcademicReportFamily;
  academicYear: string;
  examinationCodes: string[];
  className: string | null;
  section: string | null;
  subjectCode: string | null;
  studentReference: string | null;
  childHandle: string | null;
  expectedContextVersion: number | null;
  normalizationRule: AcademicNormalizationRule;
  includeAverageHighest: boolean;
  approvalReference: string | null;
  supersedesRunReference: string | null;
};

export type AcademicPaperSource = {
  code: string;
  subjectName: string;
  paperName: string;
  calculationMode: string;
  obtained: number;
  maximum: number;
  percentage: number;
  excluded: boolean;
  components: Array<{
    code: string;
    name: string;
    state: AcademicEntryState;
    obtained: number | null;
    maximum: number;
    contributionWeight: number | null;
    contribution: number | null;
  }>;
};

export type AcademicReportSource = {
  reportCardVersionId: string;
  reportCardVersion: number;
  resultSnapshotId: string;
  resultSnapshotVersion: number;
  sourceRecordId: string;
  sourceHash: string;
  publicReference: string;
  academicYear: string;
  examinationCode: string;
  examinationName: string;
  examinationType: string;
  examinationStart: string;
  examinationEnd: string;
  className: string;
  section: string;
  studentId: string;
  studentReference: string;
  studentName: string;
  admissionNumber: string;
  totalObtained: number;
  totalMaximum: number;
  percentage: number;
  gradeCode: string | null;
  passResult: string | null;
  papers: AcademicPaperSource[];
  groups: Array<Record<string, unknown>>;
  combinedResults: Array<{ label: string; obtained: number; maximum: number; percentage: number; configuredWeight: number | null }>;
  formulaVersion: string;
  roundingPolicyVersion: string;
  schemeVersionReferences: string[];
  calculationRunReference: string;
  sourceLockedAt: string;
  publishedAt: string;
  templateVersion: number;
  templateBindingVersion: number;
  attendanceBasisKey: string | null;
  attendance: { totalLockedDays: number; recordedDays: number; presentEquivalentDays: number };
};

export type AcademicReportSection = {
  id: string;
  title: string;
  description: string;
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
  chart?: {
    label: string;
    series: Array<{ label: string; value: number; pattern: "SOLID" | "DIAGONAL" | "DOT" | "CROSS" | "HORIZONTAL" }>;
  };
};

export type AcademicReportSummary = {
  schemaVersion: typeof ACADEMIC_REPORT_SCHEMA_VERSION;
  family: AcademicReportFamily;
  title: string;
  generatedAt: string;
  audience: AcademicReportAudience;
  parameters: Omit<AcademicReportInput, "childHandle" | "expectedContextVersion" | "supersedesRunReference">;
  boardClassDisclaimer: string | null;
  sourceStatement: string;
  sourceVersions: Array<{
    examinationCode: string;
    reportReference: string;
    reportVersion: number;
    resultSnapshotVersion: number;
    calculationRunReference: string;
    formulaVersion: string;
    roundingPolicyVersion: string;
    schemeVersionReferences: string[];
    sourceLockedAt: string;
    publishedAt: string;
    attendanceBasisKey: string | null;
  }>;
  compatibility: Array<{
    leftExam: string;
    rightExam: string;
    compatible: boolean;
    appliedRule: AcademicNormalizationRule;
    reason: string;
  }>;
  warnings: string[];
  suppressed: boolean;
  sections: AcademicReportSection[];
};

export const BOARD_CLASS_DISCLAIMER = "Internal Class IX/X revision and preboard evidence only. This report is not an official board submission, eligibility decision, certification, prediction of board marks, or statement of statutory compliance.";

export const REPORT_FAMILY_LABELS: Record<AcademicReportFamily, string> = {
  STUDENT_LONGITUDINAL: "Student longitudinal progress",
  CLASS_SECTION_SUMMARY: "Class and section examination summary",
  SUBJECT_PAPER_DISTRIBUTION: "Subject and paper performance distribution",
  SUBJECT_GROUP_SUMMARY: "Configured subject-group and combined-result summary",
  OUTCOME_DISTRIBUTION: "Grade, pass and entry-state distribution",
  COMPARATIVE_DELTA: "Comparable examination improvement and decline",
  COMPLETION_MISSING_SOURCE: "Examination completion and missing-source report",
  CLASS_AVERAGE_HIGHEST: "Approved class average and highest",
  BOARD_CLASS_COMPARATIVE: "Class IX/X revision and preboard comparative package",
  LEADERSHIP_SUMMARY: "Printable governed leadership summary"
};
