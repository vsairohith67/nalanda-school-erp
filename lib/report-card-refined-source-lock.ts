import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import {
  degrees,
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  RGB,
  StandardFonts,
  rgb
} from "pdf-lib";

export const NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES = [
  "NALANDA_LEGACY_REFINED_COLOUR",
  "NALANDA_LEGACY_REFINED_MONOCHROME"
] as const;

export type RefinedTemplateFamily =
  (typeof NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES)[number];
export type RefinedColourMode = "COLOUR" | "MONOCHROME";
export type ChartRowPolicy = "LEGACY_LEAF_SUBJECTS" | "GROUP_SUMMARY";

export const R4_MINIMUM_FONT_SIZES = {
  normalTableBody: 6.5,
  denseClassIxTable: 6,
  identityValue: 7,
  chartLabel: 6,
  legend: 6.5
} as const;

export const R5_COSCHOLASTIC_LEGEND = "G — Good     S — Satisfactory     N — Needs Improvement";
export const R5_IDENTITY_LABELS = [
  "Student Name",
  "Parent / Guardian",
  "Admission No. #",
  "Class / Section",
  "Roll Number"
] as const;
export const R5_CHART_SERIES = [
  { label: "Student Marks", monochromePattern: "DIAGONAL" },
  { label: "Class Average", monochromePattern: "CROSS_HATCH" },
  { label: "High Score", monochromePattern: "DOTS" }
] as const;
export const R5_CHART_NUMERIC_LABEL_FONT_SIZE = 7;
export const R5_CHART_LABEL_CLEARANCE_PT = 2.5;
export const R5_CHART_LEGEND_GEOMETRY = {
  swatchWidthPt: 39.69,
  swatchHeightPt: 14.17,
  labelFontSizePt: 7
} as const;
export const R6_HEADER_TYPOGRAPHY = {
  statusFontSizePt: 9.2,
  addressFontSizePt: 9.8,
  secondaryFontWeight: "BOLD"
} as const;
export const R7_HEADER_TYPOGRAPHY = {
  statusFontSizePt: 12,
  addressFontSizePt: 11,
  secondaryFontWeight: "BOLD"
} as const;
export const R6_MONOCHROME_STUDENT_GREY = 0.55;
export const R6_CHART_SERIES = [
  { label: "Student Marks", monochromePattern: "SOLID_GREY" },
  { label: "Class Average", monochromePattern: "DIAGONAL" },
  { label: "High Score", monochromePattern: "DIAMOND_LATTICE" }
] as const;
export const R6_CHART_LEGEND_GEOMETRY = {
  normal: { swatchWidthPt: 39.69, swatchHeightPt: 14.17, labelFontSizePt: 7, gapPt: 5 },
  dense: { swatchWidthPt: 34.02, swatchHeightPt: 12.76, labelFontSizePt: 6.5, gapPt: 4 }
} as const;
export const R6_PATTERN_GEOMETRY = {
  borderWidthPt: 1,
  slashAngleDegrees: 45,
  slashSpacingPt: 6,
  slashStrokeWidthPt: 0.55,
  diamondHorizontalSpacingPt: 7,
  diamondVerticalSpacingPt: 6,
  diamondRadiusXPt: 1.45,
  diamondRadiusYPt: 1.2,
  diamondStrokeWidthPt: 0.5
} as const;
export const R7_PATTERN_GEOMETRY = {
  borderWidthPt: 0.8,
  slashAngleDegrees: 45,
  slashSpacingPt: 7.1,
  slashStrokeWidthPt: 0.6,
  diamondHorizontalSpacingPt: 7.1,
  diamondVerticalSpacingPt: 7.1,
  diamondRadiusXPt: 1.4,
  diamondRadiusYPt: 1.4
} as const;
export const R6_DENSE_CHART_GEOMETRY = {
  triggerCategoryCount: 8,
  twoRowCategoryCount: 10,
  minimumProjectedCategoryWidthPt: 49,
  normalPlotHeightPt: 139,
  twoRowPlotHeightPt: 65,
  subjectLabelFontSizePt: 6,
  numericLabelFontSizePt: 7,
  minimumGroupGapPt: 5.67,
  compactGradeLegendRowHeightPt: 12.5,
  compactGradeLegendFontSizePt: 6.2
} as const;
export type R6AcademicChartMode = "NORMAL_ACADEMIC_CHART" | "DENSE_ACADEMIC_CHART";
export type R6ChartPattern = "SOLID" | "SOLID_GREY" | "DIAGONAL" | "DIAMOND_LATTICE";
export type R6ChartLayout = {
  mode: R6AcademicChartMode;
  rows: 1 | 2;
  categoryRows: ChartPointSnapshot[][];
  compactGradeLegend: boolean;
  reason: string;
};
export const R5_HEADER_GEOMETRY = {
  unitLeft: 92,
  unitWidth: 411.28,
  logoX: 92,
  logoY: 749,
  logoWidth: 62,
  logoHeight: 62,
  textLeft: 170,
  textWidth: 333.28,
  schoolNameY: 786,
  statusLineY: 765,
  addressY: 748,
  identityTop: 108
} as const;
export const R5_IDENTITY_GRID_GEOMETRY = {
  left: 39,
  width: 520,
  columnWidth: 130,
  centreDividerX: 299,
  borderWidth: 0.75
} as const;
export const R5_REQUIRED_STATUS_CONFIGURATION_WARNING =
  "CONFIGURATION REQUIRED — approved report-card status line is missing";
export const R5_SIGNATURE_GEOMETRY = {
  lineY: 65,
  labelY: 48,
  clearSigningHeightPt: 51.02,
  left: 37,
  width: 595.28 - 74,
  footerY: 11
} as const;
export const R7_SIGNATURE_GEOMETRY = {
  lineY: 60,
  labelY: 47,
  clearSigningHeightPt: 34.02,
  linePaddingPt: 4.5,
  left: 37,
  width: 595.28 - 74,
  footerY: 11
} as const;
export const R7_SUMMARY_CARD_GEOMETRY = {
  heightPt: 31,
  labelFontSizePt: 6.8,
  valueFontSizePt: 8.8,
  attendanceRemarksHeightPt: 36,
  attendanceWidthRatio: 0.45
} as const;
export const R8_SIGNATURE_GEOMETRY = {
  lineY: 60,
  labelY: 47,
  clearSigningHeightPt: 42.52,
  linePaddingPt: 4.5,
  left: 37,
  width: 595.28 - 74,
  footerY: 11
} as const;
export const R8_SUMMARY_GEOMETRY = {
  heightPt: 22,
  fontSizePt: 8,
  minimumFontSizePt: 7,
  horizontalPaddingPt: 12,
  attendanceRemarksHeightPt: 33,
  attendanceWidthRatio: 0.44
} as const;
export const R8_TABLE_GEOMETRY = {
  primary: { bodyFontSizePt: 7.2, subjectFontSizePt: 7.2, headerFontSizePt: 6.8, minimumRowHeightPt: 14.75 },
  grouped: { bodyFontSizePt: 6.7, subjectFontSizePt: 6.7, headerFontSizePt: 6.4, minimumRowHeightPt: 13.33 },
  combined: { bodyFontSizePt: 6, subjectFontSizePt: 6.2, headerFontSizePt: 6, minimumRowHeightPt: 11.91 },
  denseAcademicWidthRatio: 0.74,
  densePersonalityWidthRatio: 0.26
} as const;
export const R8_CHART_GEOMETRY = {
  normalReductionRatio: 1,
  compactReductionRatio: 0.9,
  compactDenseReductionRatio: 0.85,
  minimumNumericFontSizePt: 7,
  minimumSubjectFontSizePt: 6,
  minimumTwoRowSlotHeightPt: 84,
  twoRowGapPt: 6
} as const;
export type R8MarksTableMode = "NORMAL_MARKS_TABLE" | "DENSE_MARKS_TABLE_PRIORITY";
export type R8ChartFootprintMode = "NORMAL_CHART" | "COMPACT_CHART" | "COMPACT_DENSE_CHART";
export type R8MarksTableLayout = {
  mode: R8MarksTableMode;
  combineTraitAndGrade: boolean;
  academicWidthRatio: number;
  bodyFontSizePt: number;
  subjectFontSizePt: number;
  headerFontSizePt: number;
  minimumRowHeightPt: number;
  reasons: string[];
};
export type R8ChartLayout = R6ChartLayout & {
  footprintMode: R8ChartFootprintMode;
  reductionRatio: number;
};
export const R5_MAX_PARENT_FACING_DECIMALS = 1;

export type RefinedPageKind =
  | "KG_COVER"
  | "KG_PROFILE"
  | "KG_INTELLECTUAL"
  | "CLASS_II_SESSION"
  | "CLASS_V_SESSION"
  | "CLASS_VI_GROUPED"
  | "CLASS_IX_COMBINED"
  | "CLASS_X_CT_REVISION";

export const REFINED_REPRESENTATIVE_PAGE_KINDS: RefinedPageKind[] = [
  "KG_COVER",
  "KG_PROFILE",
  "KG_INTELLECTUAL",
  "CLASS_II_SESSION",
  "CLASS_V_SESSION",
  "CLASS_VI_GROUPED",
  "CLASS_IX_COMBINED",
  "CLASS_X_CT_REVISION"
];

export type ReportSchoolIdentitySnapshot = {
  schoolName: string;
  addressLine1: string;
  city: string;
  academicYear: string;
  affiliationWording: string | null;
  recognitionWording: string | null;
  establishmentYear: string | null;
  motto: "Knowledge is Power";
  logoPath: "/nalanda-logo-transparent.png";
};

export type MarkState =
  | "PRESENT"
  | "ABSENT"
  | "EXEMPT"
  | "NOT_ENTERED"
  | "NOT_APPLICABLE";

export type MarkComponentSnapshot = {
  key: string;
  label: string;
  maximum: number;
  value: number | null;
  state: MarkState;
};

type SubjectBase = {
  key: string;
  label: string;
  chartDisplayLabel: VersionedChartDisplayLabel | null;
  includeInOverall: boolean;
  chartIncluded: boolean;
  classAveragePercentage: number | null;
  highScorePercentage: number | null;
  aggregateOf: string[];
};

export type VersionedChartDisplayLabel = {
  value: string;
  configurationVersion: number;
};

export type SubjectGroupFormulaSnapshot = {
  kind: "ARITHMETIC_MEAN" | "WEIGHTED_MEAN";
  label: "Average" | "Group Result" | "Weighted Group Result";
  stateHandling: Record<Exclude<MarkState, "PRESENT">, "EXCLUDE" | "INCLUDE_AS_ZERO" | "UNAVAILABLE">;
  missingMemberHandling: "EXCLUDE" | "UNAVAILABLE";
  memberWeights?: Record<string, number>;
};

export type SubjectGroupMemberResult = {
  key: string;
  maximum: number;
  value: number | null;
  state: MarkState;
};

export type SubjectGroupCalculation = {
  value: number | null;
  maximum: number | null;
  state: MarkState;
  includedMemberKeys: string[];
};

export type StandardMarksSubject = SubjectBase & {
  kind: "MARKS";
  grade: string;
  components: MarkComponentSnapshot[];
  total: { maximum: number; value: number | null; state: MarkState };
};

export type DerivedMarksSubject = SubjectBase & {
  kind: "DERIVED";
  grade: string;
  derivedFrom: string[];
  groupFormula: SubjectGroupFormulaSnapshot;
  total: { maximum: number; value: number; state: "PRESENT" };
};

export type GradeOnlySubject = SubjectBase & {
  kind: "GRADE_ONLY";
  grade: string | null;
  state: MarkState;
};

export type GradeScaleSnapshot = {
  id: string;
  roundingRule: "NO_PRE_GRADE_ROUNDING";
  bands: Array<{
    minimumInclusive: number;
    maximumInclusive: number;
    label: string;
    displayRange: string;
  }>;
};

export type CombinedResultValues = {
  ct1: number;
  ia1: number;
  ct2: number;
  ia2: number;
  ct3: number;
  ia3: number;
  ctWeighted: number;
  terminalRaw: number;
  terminalWeighted: number;
  annualRaw: number;
  annualWeighted: number;
  gradePoint: number;
};

export type CombinedSchemeSnapshot = {
  ctLabel: string;
  ctFullLabel: string;
  internalAssessmentLabel: string;
  ctMaximum: number;
  internalAssessmentMaximum: number;
  ctWeight: number;
  terminalLabel: string;
  terminalFullLabel: string;
  terminalMaximum: number;
  terminalWeight: number;
  annualLabel: string;
  annualMaximum: number;
  annualWeight: number;
};

export type CombinedMarksSubject = SubjectBase & {
  kind: "COMBINED";
  grade: string;
  combined: CombinedResultValues;
  groupFormula: SubjectGroupFormulaSnapshot | null;
  total: { maximum: number; value: number; state: "PRESENT" };
};

export type AcademicSubjectSnapshot =
  | StandardMarksSubject
  | DerivedMarksSubject
  | GradeOnlySubject
  | CombinedMarksSubject;

export type ChartPointSnapshot = {
  subjectKey: string;
  subjectLabel: string;
  chartDisplayLabel: VersionedChartDisplayLabel | null;
  studentPercentage: number;
  classAveragePercentage: number;
  highScorePercentage: number;
  classSnapshotId: string;
};

export type ChartTextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChartNumericLabelPlacement = ChartTextBox & {
  text: string;
  centerX: number;
  barTopY: number;
  anchorX: number;
  anchorY: number;
  leaderLine: boolean;
};

type ChartNumericLabelInput = {
  text: string;
  centerX: number;
  barTopY: number;
  staggerLevel?: number;
  horizontalStaggerPt?: number;
};

export type CohortResultRecord = {
  studentKey: string;
  subjectKey: string;
  maximum: number;
  value: number | null;
  state: MarkState;
};

export type CohortStatistics = {
  classAveragePercentage: number;
  highScorePercentage: number;
  validRecordCount: number;
};

export type AcademicReportSnapshot = {
  snapshotId: string;
  summarySnapshotId: string;
  classSnapshotId: string;
  classSection: string;
  examination: string;
  studentName: string;
  guardianName: string;
  admissionNumber: string;
  rollNumber: string;
  parentGuardianLabel: string;
  layout: "STANDARD" | "COMBINED";
  componentColumns: Array<{ key: string; label: string; maximum: number }>;
  combinedScheme: CombinedSchemeSnapshot | null;
  showAcademicSubjectGrade: boolean;
  chartPolicy: ChartRowPolicy;
  gradeScale: GradeScaleSnapshot;
  subjects: AcademicSubjectSnapshot[];
  traits: string[];
  traitTitle: "Skills" | "Personality Development" | null;
  overall: {
    value: number;
    maximum: number;
    percentage: number;
    grade: string;
    gradePoint: number | null;
    rank: number | null;
    rankBasisPercentage: number;
  };
  attendance: {
    workingDays: number;
    daysPresent: number;
    percentage: number;
  };
  remarks: string;
  chartPoints: ChartPointSnapshot[];
  gradeLegend: Array<{ range: string; grade: string }>;
};

type Fonts = { regular: PDFFont; bold: PDFFont; school: PDFFont };
type Assets = { fonts: Fonts; colourLogo: PDFImage | null; monochromeLogo: PDFImage | null };
type Palette = ReturnType<typeof palette>;

const A4 = { width: 595.28, height: 841.89 } as const;
const EPSILON = 0.0001;
export const GROUP_RESULT_NOTE = "Shaded group-result rows are used in the overall total. Individual papers are shown for detailed reference.";
export const SYNTHETIC_GROUP_FORMULA: SubjectGroupFormulaSnapshot = {
  kind: "ARITHMETIC_MEAN",
  label: "Average",
  stateHandling: {
    ABSENT: "INCLUDE_AS_ZERO",
    EXEMPT: "EXCLUDE",
    NOT_ENTERED: "UNAVAILABLE",
    NOT_APPLICABLE: "EXCLUDE"
  },
  missingMemberHandling: "UNAVAILABLE"
};
const DEFAULT_IDENTITY: ReportSchoolIdentitySnapshot = {
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  academicYear: "2026-27",
  affiliationWording: null,
  recognitionWording: null,
  establishmentYear: null,
  motto: "Knowledge is Power",
  logoPath: "/nalanda-logo-transparent.png"
};

const SYNTHETIC_COMBINED_SCHEME: CombinedSchemeSnapshot = {
  ctLabel: "C.T.",
  ctFullLabel: "Comprehensive Test",
  internalAssessmentLabel: "Internal Assessment",
  ctMaximum: 50,
  internalAssessmentMaximum: 10,
  ctWeight: 30,
  terminalLabel: "Term.",
  terminalFullLabel: "Terminal Examination",
  terminalMaximum: 100,
  terminalWeight: 20,
  annualLabel: "Annual",
  annualMaximum: 100,
  annualWeight: 50
};

export const STANDARD_GRADE_SCALE: GradeScaleSnapshot = {
  id: "SYNTHETIC-STANDARD-A1-A2-V1",
  roundingRule: "NO_PRE_GRADE_ROUNDING",
  bands: [
    { minimumInclusive: 91, maximumInclusive: 100, label: "A1", displayRange: "91.00-100.00" },
    { minimumInclusive: 81, maximumInclusive: 90.999999, label: "A2", displayRange: "81.00-90.99" },
    { minimumInclusive: 71, maximumInclusive: 80.999999, label: "B1", displayRange: "71.00-80.99" },
    { minimumInclusive: 61, maximumInclusive: 70.999999, label: "B2", displayRange: "61.00-70.99" },
    { minimumInclusive: 51, maximumInclusive: 60.999999, label: "C1", displayRange: "51.00-60.99" },
    { minimumInclusive: 41, maximumInclusive: 50.999999, label: "C2", displayRange: "41.00-50.99" },
    { minimumInclusive: 35, maximumInclusive: 40.999999, label: "D", displayRange: "35.00-40.99" },
    { minimumInclusive: 0, maximumInclusive: 34.999999, label: "E", displayRange: "0.00-34.99" }
  ]
};

export const ALTERNATE_GRADE_SCALE: GradeScaleSnapshot = {
  id: "SYNTHETIC-SECONDARY-PLUS-V1",
  roundingRule: "NO_PRE_GRADE_ROUNDING",
  bands: [
    { minimumInclusive: 90, maximumInclusive: 100, label: "A+", displayRange: "90.00-100.00" },
    { minimumInclusive: 80, maximumInclusive: 89.999999, label: "A", displayRange: "80.00-89.99" },
    { minimumInclusive: 70, maximumInclusive: 79.999999, label: "B", displayRange: "70.00-79.99" },
    { minimumInclusive: 60, maximumInclusive: 69.999999, label: "C", displayRange: "60.00-69.99" },
    { minimumInclusive: 50, maximumInclusive: 59.999999, label: "D", displayRange: "50.00-59.99" },
    { minimumInclusive: 35, maximumInclusive: 49.999999, label: "E", displayRange: "35.00-49.99" },
    { minimumInclusive: 0, maximumInclusive: 34.999999, label: "F", displayRange: "0.00-34.99" }
  ]
};

export const KG_INTELLECTUAL_HIERARCHY = [
  { label: "A. English", level: 0, section: true },
  { label: "Reading", level: 1 },
  { label: "Conversation in English", level: 1 },
  { label: "Recitation", level: 1 },
  { label: "Written Work", level: 1 },
  { label: "Dictation", level: 1 },
  { label: "Home Assignment", level: 1 },
  { label: "B. Hindi", level: 0, section: true },
  { label: "Reading", level: 1 },
  { label: "Recitation", level: 1 },
  { label: "Written Work", level: 1 },
  { label: "C. Mathematics", level: 0, section: true },
  { label: "Recognition of Numbers", level: 1 },
  { label: "Number Operations", level: 1 },
  { label: "Written Work", level: 1 },
  { label: "Dictation", level: 1 },
  { label: "Home Assignment", level: 1 },
  { label: "D. Environmental Study", level: 0, section: true },
  { label: "E. Drawing and Colouring", level: 0, section: true },
  { label: "F. Overall Grade", level: 0, section: true }
] as const;

export function resolveReportSchoolIdentity(
  settings: {
    schoolName: string;
    addressLine1: string;
    city: string;
    academicYear: string;
  },
  approvedTemplateDefinitions: unknown[] = []
): ReportSchoolIdentitySnapshot {
  const schoolIdentities = approvedTemplateDefinitions.flatMap((definition) => {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) return [];
    const value = (definition as Record<string, unknown>).schoolIdentity;
    return value && typeof value === "object" && !Array.isArray(value)
      ? [value as Record<string, unknown>]
      : [];
  });
  return {
    schoolName: requiredText(settings.schoolName, "School name"),
    addressLine1: requiredText(settings.addressLine1, "School address"),
    city: requiredText(settings.city, "School city"),
    academicYear: requiredText(settings.academicYear, "Academic year"),
    affiliationWording: unanimousOptional(schoolIdentities, "affiliationWording"),
    recognitionWording: unanimousOptional(schoolIdentities, "recognitionWording"),
    establishmentYear: unanimousOptional(schoolIdentities, "establishmentYear"),
    motto: "Knowledge is Power",
    logoPath: "/nalanda-logo-transparent.png"
  };
}

export function approvedSchoolStatusLine(identity: ReportSchoolIdentitySnapshot) {
  return [
    identity.affiliationWording,
    identity.recognitionWording,
    identity.establishmentYear ? "Established " + identity.establishmentYear : null
  ].filter((value): value is string => Boolean(value)).join("  •  ") || null;
}

export function academicHeaderStatusForPreview(identity: ReportSchoolIdentitySnapshot) {
  return approvedSchoolStatusLine(identity) ?? R5_REQUIRED_STATUS_CONFIGURATION_WARNING;
}

export function assertApprovedReportSchoolStatusForPublication(identity: ReportSchoolIdentitySnapshot) {
  const statusLine = approvedSchoolStatusLine(identity);
  if (!statusLine) throw new Error("Report publication blocked: approved report-card status line is not configured in School Settings.");
  return statusLine;
}

export function wrapR6HeaderText(
  value: string,
  maximumWidth: number,
  measure: (text: string) => number,
  maximumLines = 2
) {
  const source = String(value).trim().replace(/\s+/g, " ");
  if (!source) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of source.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || measure(candidate) <= maximumWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  if (lines.length > maximumLines || lines.some((line) => measure(line) > maximumWidth + EPSILON)) {
    throw new Error("Approved academic header text cannot fit without clipping or truncation.");
  }
  return lines;
}

export function requireApprovedAcademicStatusLine(identity: ReportSchoolIdentitySnapshot) {
  const statusLine = approvedSchoolStatusLine(identity);
  if (!statusLine) {
    throw new Error("Final report publication is blocked until school leadership configures the approved report-card status line.");
  }
  return statusLine;
}

export function templateFamilyForMode(mode: RefinedColourMode): RefinedTemplateFamily {
  return mode === "MONOCHROME"
    ? "NALANDA_LEGACY_REFINED_MONOCHROME"
    : "NALANDA_LEGACY_REFINED_COLOUR";
}

export function calculateSubjectGroupResult(
  formula: SubjectGroupFormulaSnapshot,
  memberKeys: string[],
  members: Map<string, SubjectGroupMemberResult>
): SubjectGroupCalculation {
  const included: Array<SubjectGroupMemberResult & { weight: number }> = [];
  for (const key of memberKeys) {
    const member = members.get(key);
    if (!member) {
      if (formula.missingMemberHandling === "UNAVAILABLE") {
        return { value: null, maximum: null, state: "NOT_ENTERED", includedMemberKeys: [] };
      }
      continue;
    }
    if (member.state === "PRESENT") {
      if (member.value == null) {
        return { value: null, maximum: null, state: "NOT_ENTERED", includedMemberKeys: [] };
      }
      included.push({ ...member, weight: formula.memberWeights?.[key] ?? 1 });
      continue;
    }
    const handling = formula.stateHandling[member.state];
    if (handling === "UNAVAILABLE") {
      return { value: null, maximum: null, state: member.state, includedMemberKeys: [] };
    }
    if (handling === "INCLUDE_AS_ZERO") {
      included.push({ ...member, value: 0, weight: formula.memberWeights?.[key] ?? 1 });
    }
  }
  if (!included.length) {
    return { value: null, maximum: null, state: "NOT_APPLICABLE", includedMemberKeys: [] };
  }
  const divisor = formula.kind === "WEIGHTED_MEAN"
    ? sum(included.map((member) => member.weight))
    : included.length;
  if (divisor <= 0) throw new Error("Subject-group weights must total more than zero.");
  const weighted = (member: SubjectGroupMemberResult & { weight: number }, value: number) =>
    value * (formula.kind === "WEIGHTED_MEAN" ? member.weight : 1);
  return {
    value: roundTo(sum(included.map((member) => weighted(member, Number(member.value)))) / divisor, 2),
    maximum: roundTo(sum(included.map((member) => weighted(member, member.maximum))) / divisor, 2),
    state: "PRESENT",
    includedMemberKeys: included.map((member) => member.key)
  };
}

export function calculateCohortStatistics(
  subjectKey: string,
  records: CohortResultRecord[]
): CohortStatistics | null {
  const valid = records.filter((record) =>
    record.subjectKey === subjectKey &&
    record.state === "PRESENT" &&
    record.value != null &&
    record.maximum > 0 &&
    record.value >= 0 &&
    record.value <= record.maximum
  );
  if (!valid.length) return null;
  const percentages = valid.map((record) => Number(record.value) / record.maximum * 100);
  return {
    classAveragePercentage: roundTo(average(percentages), 2),
    highScorePercentage: roundTo(Math.max(...percentages), 2),
    validRecordCount: valid.length
  };
}

export async function renderRefinedSourceLockedPage(
  kind: RefinedPageKind,
  mode: RefinedColourMode,
  edgeCase = false,
  identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY
) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  const page = document.addPage([A4.width, A4.height]);
  drawPage(page, assets, identity, kind, mode, edgeCase);
  document.setTitle(kind + " " + templateFamilyForMode(mode));
  document.setSubject("Synthetic-only NALANDA_LEGACY_REFINED source-lock review");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR3VisualPack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const kind of REFINED_REPRESENTATIVE_PAGE_KINDS) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, kind, "COLOUR", false);
  }
  for (const kind of ["CLASS_II_SESSION", "CLASS_IX_COMBINED"] as const) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, kind, "MONOCHROME", false);
  }
  document.setTitle("VISUAL-DIRECTION-PACK-R3");
  document.setSubject("Synthetic-only NALANDA_LEGACY_REFINED final correction review");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR3EdgePack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const kind of REFINED_REPRESENTATIVE_PAGE_KINDS) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, kind, "COLOUR", true);
  }
  document.setTitle("EDGE-CASE-RENDERING-PACK-R3");
  document.setSubject("Synthetic-only wrapping and state stress evidence");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export const R4_VISUAL_PAGE_KINDS = [
  "KG_COVER",
  "KG_INTELLECTUAL",
  "CLASS_II_SESSION",
  "CLASS_VI_GROUPED",
  "CLASS_IX_COMBINED",
  "CLASS_X_CT_REVISION"
] as const satisfies readonly RefinedPageKind[];

export async function renderR4VisualPack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const kind of R4_VISUAL_PAGE_KINDS) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, kind, "COLOUR", false);
  }
  for (const kind of ["CLASS_II_SESSION", "CLASS_IX_COMBINED"] as const) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, kind, "MONOCHROME", false);
  }
  document.setTitle("VISUAL-DIRECTION-PACK-R4");
  document.setSubject("Synthetic-only NALANDA_LEGACY_REFINED pre-print correctness review");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR4EdgePack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const kind of ["CLASS_II_SESSION", "CLASS_VI_GROUPED", "CLASS_IX_COMBINED", "CLASS_X_CT_REVISION"] as const) {
    const page = document.addPage([A4.width, A4.height]);
    // The primary specimen carries all four compact state codes. Keep the
    // grouped page representative instead of duplicating the same stress load.
    drawPage(page, assets, identity, kind, "COLOUR", kind !== "CLASS_VI_GROUPED" && kind !== "CLASS_X_CT_REVISION");
  }
  document.setTitle("EDGE-CASE-RENDERING-PACK-R4");
  document.setSubject("Synthetic-only long-name and AB/EX/NE/NA rendering evidence");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export const R41_VISUAL_PAGES = [
  { kind: "CLASS_IX_COMBINED", mode: "COLOUR" },
  { kind: "CLASS_X_CT_REVISION", mode: "COLOUR" },
  { kind: "CLASS_II_SESSION", mode: "MONOCHROME" },
  { kind: "CLASS_IX_COMBINED", mode: "MONOCHROME" }
] as const satisfies ReadonlyArray<{ kind: RefinedPageKind; mode: RefinedColourMode }>;

export async function renderR41VisualPack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const specimen of R41_VISUAL_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, specimen.kind, specimen.mode, false);
  }
  document.setTitle("VISUAL-DIRECTION-PACK-R4-1");
  document.setSubject("Synthetic-only final numerical and true-monochrome review");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR41EdgePack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const specimen of [
    { kind: "CLASS_IX_COMBINED", mode: "COLOUR" },
    { kind: "CLASS_X_CT_REVISION", mode: "COLOUR" },
    { kind: "CLASS_II_SESSION", mode: "MONOCHROME" },
    { kind: "CLASS_IX_COMBINED", mode: "MONOCHROME" }
  ] as const) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, specimen.kind, specimen.mode, specimen.kind !== "CLASS_X_CT_REVISION");
  }
  document.setTitle("EDGE-CASE-RENDERING-PACK-R4-1");
  document.setSubject("Synthetic-only grouped calculation, cohort, state, and wrapping evidence");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export type FinalAcademicPageSpec = {
  specimenId: string;
  classFamily: "CLASSES_I_II" | "CLASSES_III_V" | "CLASSES_VI_VIII" | "CLASSES_IX_X";
  examinationLayout: "CT" | "SESSION" | "GROUPED" | "REVISION" | "PREBOARD" | "COMBINED";
  baseKind: Exclude<RefinedPageKind, "KG_COVER" | "KG_PROFILE" | "KG_INTELLECTUAL">;
  classSection: string;
  examination: string;
  componentProfile: "CT" | "SESSION" | "COMBINED_STANDARD" | null;
  distinctReason: string;
  physicalInclude: boolean;
};

export const FINAL_KG_PAGE_SPECS = [
  { specimenId: "KG-01-COVER", title: "Cover", distinctReason: "Decorative booklet cover and identity box" },
  { specimenId: "KG-02-PROFILE", title: "Student Profile", distinctReason: "Profile fields and photograph space" },
  { specimenId: "KG-03-INSTRUCTIONS", title: "Instructions", distinctReason: "Booklet instructions and five-evaluation key" },
  { specimenId: "KG-04-INTELLECTUAL", title: "Intellectual Skills", distinctReason: "Five-evaluation grouped hierarchy" },
  { specimenId: "KG-05-ENGLISH", title: "English Development", distinctReason: "Detailed English development table" },
  { specimenId: "KG-06-HINDI-NUMBER", title: "Hindi and Number Work", distinctReason: "Hindi and Number Work development structure" },
  { specimenId: "KG-07-EVS-CREATIVE", title: "EVS, Rhymes and Story", distinctReason: "EVS, Rhymes, Story and creative development structure" },
  { specimenId: "KG-08-GROWTH", title: "Personality, Attendance and Growth", distinctReason: "Personality, monthly attendance and physical growth" },
  { specimenId: "KG-09-PROMOTION", title: "Comments and Promotion", distinctReason: "Comments, promotion and signature areas" },
  { specimenId: "KG-10-BACK", title: "Back Cover", distinctReason: "Canonical final cover and booklet closure" }
] as const;

export const FINAL_ACADEMIC_PAGE_SPECS: readonly FinalAcademicPageSpec[] = [
  { specimenId: "I-II-CT", classFamily: "CLASSES_I_II", examinationLayout: "CT", baseKind: "CLASS_II_SESSION", classSection: "II-A", examination: "COMPREHENSIVE TEST 1", componentProfile: "CT", distinctReason: "Classes I-II CT component maxima", physicalInclude: false },
  { specimenId: "I-II-SESSION", classFamily: "CLASSES_I_II", examinationLayout: "SESSION", baseKind: "CLASS_II_SESSION", classSection: "II-A", examination: "SESSION END EXAMINATION", componentProfile: "SESSION", distinctReason: "Classes I-II marks with adjacent skills table", physicalInclude: true },
  { specimenId: "I-II-COMBINED", classFamily: "CLASSES_I_II", examinationLayout: "COMBINED", baseKind: "CLASS_II_SESSION", classSection: "II-A", examination: "COMBINED RESULT", componentProfile: "COMBINED_STANDARD", distinctReason: "Classes I-II configured combined-result columns", physicalInclude: true },
  { specimenId: "III-V-CT", classFamily: "CLASSES_III_V", examinationLayout: "CT", baseKind: "CLASS_V_SESSION", classSection: "V-A", examination: "COMPREHENSIVE TEST 1", componentProfile: "CT", distinctReason: "Classes III-V CT with separate Science and Social", physicalInclude: false },
  { specimenId: "III-V-SESSION", classFamily: "CLASSES_III_V", examinationLayout: "SESSION", baseKind: "CLASS_V_SESSION", classSection: "V-A", examination: "SESSION END EXAMINATION", componentProfile: "SESSION", distinctReason: "Classes III-V separate Science and Social with skills", physicalInclude: true },
  { specimenId: "III-V-COMBINED", classFamily: "CLASSES_III_V", examinationLayout: "COMBINED", baseKind: "CLASS_V_SESSION", classSection: "V-A", examination: "COMBINED RESULT", componentProfile: "COMBINED_STANDARD", distinctReason: "Classes III-V configured combined columns with separate Science and Social", physicalInclude: true },
  { specimenId: "VI-VIII-CT", classFamily: "CLASSES_VI_VIII", examinationLayout: "CT", baseKind: "CLASS_VI_GROUPED", classSection: "VI-A", examination: "COMPREHENSIVE TEST 1", componentProfile: "CT", distinctReason: "Classes VI-VIII grouped-subject CT columns", physicalInclude: false },
  { specimenId: "VI-VIII-SESSION", classFamily: "CLASSES_VI_VIII", examinationLayout: "SESSION", baseKind: "CLASS_VI_GROUPED", classSection: "VIII-A", examination: "SESSION END EXAMINATION", componentProfile: "SESSION", distinctReason: "Classes VI-VIII grouped subjects and personality table", physicalInclude: false },
  { specimenId: "VI-VIII-GROUPED", classFamily: "CLASSES_VI_VIII", examinationLayout: "GROUPED", baseKind: "CLASS_VI_GROUPED", classSection: "VI-A", examination: "GROUPED SUBJECT SESSION REPORT", componentProfile: "SESSION", distinctReason: "English, Social and Science member rows with shaded group results", physicalInclude: true },
  { specimenId: "VI-VIII-COMBINED", classFamily: "CLASSES_VI_VIII", examinationLayout: "COMBINED", baseKind: "CLASS_VI_GROUPED", classSection: "VIII-A", examination: "COMBINED RESULT", componentProfile: "COMBINED_STANDARD", distinctReason: "Classes VI-VIII grouped combined-result columns", physicalInclude: true },
  { specimenId: "IX-X-CT", classFamily: "CLASSES_IX_X", examinationLayout: "CT", baseKind: "CLASS_X_CT_REVISION", classSection: "X-A", examination: "COMPREHENSIVE TEST 1", componentProfile: "CT", distinctReason: "Class X CT grouped-subject structure", physicalInclude: false },
  { specimenId: "IX-X-SESSION", classFamily: "CLASSES_IX_X", examinationLayout: "SESSION", baseKind: "CLASS_X_CT_REVISION", classSection: "X-A", examination: "SESSION END EXAMINATION", componentProfile: "SESSION", distinctReason: "Class X Session component maxima", physicalInclude: false },
  { specimenId: "IX-X-REVISION", classFamily: "CLASSES_IX_X", examinationLayout: "REVISION", baseKind: "CLASS_X_CT_REVISION", classSection: "X-A", examination: "REVISION EXAMINATION", componentProfile: "CT", distinctReason: "Class X Revision title with one-page grouped structure", physicalInclude: true },
  { specimenId: "IX-X-PREBOARD", classFamily: "CLASSES_IX_X", examinationLayout: "PREBOARD", baseKind: "CLASS_X_CT_REVISION", classSection: "X-A", examination: "PREBOARD EXAMINATION", componentProfile: "SESSION", distinctReason: "Class X Preboard component maxima", physicalInclude: false },
  { specimenId: "IX-X-COMBINED", classFamily: "CLASSES_IX_X", examinationLayout: "COMBINED", baseKind: "CLASS_IX_COMBINED", classSection: "IX-A", examination: "COMBINED RESULT", componentProfile: null, distinctReason: "Dense Class IX combined-result columns and grade point", physicalInclude: true }
] as const;

export async function renderFinalSourceLockedPack(
  mode: RefinedColourMode,
  identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY
) {
  return renderFinalPageCollection(mode, identity, FINAL_ACADEMIC_PAGE_SPECS, true, "RC-SYN-final-" + mode.toLowerCase());
}

export async function renderPhysicalAcceptancePack(
  mode: RefinedColourMode,
  identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY
) {
  return renderFinalPageCollection(
    mode,
    identity,
    FINAL_ACADEMIC_PAGE_SPECS.filter((specimen) => specimen.physicalInclude),
    true,
    "PHYSICAL-ACCEPTANCE-" + mode.toLowerCase()
  );
}

export async function renderR42EdgePack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const specimen of [
    { kind: "CLASS_IX_COMBINED", mode: "COLOUR" },
    { kind: "CLASS_X_CT_REVISION", mode: "COLOUR" },
    { kind: "CLASS_II_SESSION", mode: "MONOCHROME" },
    { kind: "CLASS_IX_COMBINED", mode: "MONOCHROME" }
  ] as const) {
    const page = document.addPage([A4.width, A4.height]);
    drawPage(page, assets, identity, specimen.kind, specimen.mode, true);
  }
  document.setTitle("EDGE-CASE-RENDERING-PACK-R4-2");
  document.setSubject("Synthetic-only chart-label, state, decimal, and wrapping evidence");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export const R5_VISUAL_PAGES = [
  { specimenId: "I-II-SESSION", mode: "COLOUR" },
  { specimenId: "I-II-COMBINED", mode: "COLOUR" },
  { specimenId: "III-V-SESSION", mode: "COLOUR" },
  { specimenId: "VI-VIII-GROUPED", mode: "COLOUR" },
  { specimenId: "IX-X-COMBINED", mode: "COLOUR" },
  { specimenId: "IX-X-REVISION", mode: "COLOUR" },
  { specimenId: "I-II-SESSION", mode: "MONOCHROME" },
  { specimenId: "VI-VIII-GROUPED", mode: "MONOCHROME" },
  { specimenId: "IX-X-COMBINED", mode: "MONOCHROME" },
  { specimenId: "IX-X-REVISION", mode: "MONOCHROME" }
] as const satisfies ReadonlyArray<{ specimenId: string; mode: RefinedColourMode }>;

export const R5_DETAIL_PAGES = [
  "APPROVED_HEADER_COLOUR",
  "APPROVED_HEADER_MONOCHROME",
  "IDENTITY_GRID_ALIGNMENT",
  "CHART_VALUES_COLOUR",
  "CHART_PATTERNS_MONOCHROME",
  "MONOCHROME_PATTERN_LEGEND",
  "SIGNATURE_CLEARANCE"
] as const;
export const R5_DETAIL_MONOCHROME_SWATCHES = {
  page: 6,
  boxes: [
    { series: "Student Marks", x: 145, y: 655.89, width: 39.69, height: 14.17 },
    { series: "Class Average", x: 280.09, y: 655.89, width: 39.69, height: 14.17 },
    { series: "High Score", x: 415.19, y: 655.89, width: 39.69, height: 14.17 }
  ]
} as const;

export async function renderR5VisualPack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const requested of R5_VISUAL_PAGES) {
    const specimen = finalAcademicSpecimen(requested.specimenId);
    const page = document.addPage([A4.width, A4.height]);
    drawR5AcademicPage(page, assets, identity, requested.mode, buildFinalAcademicSnapshot(specimen));
  }
  document.setTitle("VISUAL-DIRECTION-PACK-R5");
  document.setSubject("Synthetic-only Classes I-X consolidated colour and monochrome digital review");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR5EdgePack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const configuredIdentity: ReportSchoolIdentitySnapshot = { ...identity };
  const assets = await embedAssets(document, identity);
  const pages: Array<{
    kind: Exclude<RefinedPageKind, "KG_COVER" | "KG_PROFILE" | "KG_INTELLECTUAL">;
    mode: RefinedColourMode;
    identity: ReportSchoolIdentitySnapshot;
    closeChart: boolean;
    edgeCase: boolean;
  }> = [
    { kind: "CLASS_II_SESSION", mode: "COLOUR", identity: { ...identity, affiliationWording: null, recognitionWording: null, establishmentYear: null }, closeChart: false, edgeCase: true },
    { kind: "CLASS_II_SESSION", mode: "COLOUR", identity: configuredIdentity, closeChart: false, edgeCase: true },
    { kind: "CLASS_VI_GROUPED", mode: "COLOUR", identity, closeChart: true, edgeCase: false },
    { kind: "CLASS_IX_COMBINED", mode: "COLOUR", identity, closeChart: true, edgeCase: false },
    { kind: "CLASS_X_CT_REVISION", mode: "MONOCHROME", identity, closeChart: true, edgeCase: false },
    { kind: "CLASS_IX_COMBINED", mode: "MONOCHROME", identity, closeChart: true, edgeCase: false }
  ];
  for (const requested of pages) {
    const page = document.addPage([A4.width, A4.height]);
    const report = buildSyntheticAcademicSnapshot(requested.kind, requested.edgeCase);
    if (requested.closeChart) applyCloseChartEdgeCase(report);
    drawR5AcademicPage(page, assets, requested.identity, requested.mode, report);
  }
  document.setTitle("EDGE-CASE-RENDERING-PACK-R5");
  document.setSubject("Synthetic-only long identity, result state, rounding, chart collision, conditional status, and grade-band evidence");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR5DetailChecks(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  const primary = buildFinalAcademicSnapshot(finalAcademicSpecimen("I-II-SESSION"));
  const dense = buildFinalAcademicSnapshot(finalAcademicSpecimen("IX-X-COMBINED"));
  applyCloseChartEdgeCase(primary);
  applyCloseChartEdgeCase(dense);

  for (const detail of R5_DETAIL_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    const mode: RefinedColourMode = detail.includes("MONOCHROME") || detail === "MONOCHROME_PATTERN_LEGEND"
      ? "MONOCHROME"
      : "COLOUR";
    const colors = palette(mode);
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
    if (detail === "APPROVED_HEADER_COLOUR" || detail === "APPROVED_HEADER_MONOCHROME") {
      drawAcademicHeader(page, assets, identity, colors, mode);
      centered(page, detail === "APPROVED_HEADER_COLOUR" ? "ENLARGED HEADER DETAIL — COLOUR" : "ENLARGED HEADER DETAIL — MONOCHROME", assets.fonts.bold, 12, 680, colors.ink);
    } else if (detail === "IDENTITY_GRID_ALIGNMENT") {
      drawAcademicHeader(page, assets, identity, colors, mode);
      const bottom = drawIdentity(page, assets.fonts, colors, primary);
      centered(page, "CONTINUOUS 50% CENTRE DIVIDER — FIXED 25% COLUMN GRID", assets.fonts.bold, 11, A4.height - bottom - 28, colors.ink);
    } else if (detail === "CHART_VALUES_COLOUR") {
      centered(page, "ENLARGED CHART VALUE-VISIBILITY DETAIL — COLOUR", assets.fonts.bold, 12, 789, colors.ink);
      drawChart(page, assets.fonts, colors, primary, 37, 76, A4.width - 74, 500, mode);
    } else if (detail === "CHART_PATTERNS_MONOCHROME") {
      centered(page, "ENLARGED CHART VALUE-VISIBILITY DETAIL — MONOCHROME", assets.fonts.bold, 12, 789, colors.ink);
      drawChart(page, assets.fonts, colors, dense, 37, 76, A4.width - 74, 500, mode);
    } else if (detail === "MONOCHROME_PATTERN_LEGEND") {
      centered(page, "PHOTOCOPY-SAFE MONOCHROME LEGEND", assets.fonts.bold, 14, 760, colors.ink);
      rectTop(page, 37, 130, A4.width - 74, 108, colors.white, colors.ink, 0.75);
      drawChartLegend(page, assets.fonts, colors, 37, 164, A4.width - 74, mode, chartSeries(colors));
      centered(page, "Single diagonal slash | Cross-hatch | Dots", assets.fonts.regular, 10, 565, colors.ink);
    } else {
      centered(page, "PHYSICAL SIGNATURE-CLEARANCE DETAIL", assets.fonts.bold, 14, 760, colors.ink);
      page.drawRectangle({
        x: R5_SIGNATURE_GEOMETRY.left,
        y: R5_SIGNATURE_GEOMETRY.lineY,
        width: R5_SIGNATURE_GEOMETRY.width,
        height: R5_SIGNATURE_GEOMETRY.clearSigningHeightPt,
        borderColor: colors.grid,
        borderWidth: 0.5,
        borderDashArray: [3, 2]
      });
      drawSignatures(page, assets.fonts, colors);
      centered(page, "18 mm clear handwriting area above each signature line", assets.fonts.bold, 10, 145, colors.ink);
    }
    drawFooter(page, assets.fonts, mode, false);
  }
  document.setTitle("R5-DETAIL-CHECKS");
  document.setSubject("Synthetic-only enlarged header, identity-grid, chart-pattern, legend, and signature checks");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export const R6_VISUAL_PAGES = [
  { specimenId: "I-II-SESSION", mode: "COLOUR" },
  { specimenId: "VI-VIII-GROUPED", mode: "COLOUR" },
  { specimenId: "IX-X-COMBINED", mode: "COLOUR" },
  { specimenId: "IX-X-REVISION", mode: "COLOUR" },
  { specimenId: "I-II-SESSION", mode: "MONOCHROME" },
  { specimenId: "VI-VIII-GROUPED", mode: "MONOCHROME" },
  { specimenId: "IX-X-COMBINED", mode: "MONOCHROME" },
  { specimenId: "IX-X-REVISION", mode: "MONOCHROME" }
] as const satisfies ReadonlyArray<{ specimenId: string; mode: RefinedColourMode }>;

export const R6_DETAIL_PAGES = [
  "HEADER_COLOUR_EMPHASIS",
  "HEADER_MONOCHROME_EMPHASIS",
  "FROZEN_IDENTITY_GRID",
  "NORMAL_SIX_SUBJECT_COLOUR_CHART",
  "NORMAL_SIX_SUBJECT_MONOCHROME_CHART",
  "AUTHORITATIVE_MONOCHROME_LEGEND_AND_PHOTOCOPY",
  "CLASS_VI_DENSE_BEFORE_AFTER",
  "CLASS_IX_DENSE_BEFORE_AFTER",
  "DENSE_ONE_ROW_CHART",
  "DENSE_TWO_ROW_FALLBACK",
  "COMPACT_GRADE_LEGEND",
  "FROZEN_SIGNATURE_CLEARANCE"
] as const;

export const R6_DETAIL_MONOCHROME_SWATCHES = {
  page: 6,
  boxes: [
    { series: "Student Marks", x: 145, y: 689.89, width: 39.69, height: 14.17 },
    { series: "Class Average", x: 280.09, y: 689.89, width: 39.69, height: 14.17 },
    { series: "High Score", x: 415.19, y: 689.89, width: 39.69, height: 14.17 }
  ]
} as const;

export async function renderR6VisualPack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const requested of R6_VISUAL_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    drawR6AcademicPage(page, assets, identity, requested.mode, buildFinalAcademicSnapshot(finalAcademicSpecimen(requested.specimenId)));
  }
  document.setTitle("VISUAL-DIRECTION-PACK-R6");
  document.setSubject("Synthetic-only Classes I-X R6 header and adaptive-chart digital review");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR6DetailChecks(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  const photocopyPng = await createR6PhotocopySimulationPng();
  const photocopyImage = await document.embedPng(photocopyPng);
  const primary = buildFinalAcademicSnapshot(finalAcademicSpecimen("I-II-SESSION"));
  const middle = buildFinalAcademicSnapshot(finalAcademicSpecimen("VI-VIII-GROUPED"));
  const secondary = buildFinalAcademicSnapshot(finalAcademicSpecimen("IX-X-COMBINED"));
  applyCloseChartEdgeCase(primary);
  applyCloseChartEdgeCase(middle);
  applyCloseChartEdgeCase(secondary);

  for (const detail of R6_DETAIL_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    const mode: RefinedColourMode = detail.includes("MONOCHROME") || detail.includes("AUTHORITATIVE") ? "MONOCHROME" : "COLOUR";
    const colors = palette(mode);
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
    if (detail === "HEADER_COLOUR_EMPHASIS" || detail === "HEADER_MONOCHROME_EMPHASIS") {
      drawAcademicHeader(page, assets, identity, colors, mode, "R6");
      centered(page, detail === "HEADER_COLOUR_EMPHASIS" ? "R6 EMPHASISED SECONDARY HEADER \u2014 COLOUR" : "R6 EMPHASISED SECONDARY HEADER \u2014 MONOCHROME", assets.fonts.bold, 12, 680, colors.ink);
      centered(page, `Status ${R6_HEADER_TYPOGRAPHY.statusFontSizePt} pt bold | Address ${R6_HEADER_TYPOGRAPHY.addressFontSizePt} pt bold`, assets.fonts.regular, 9, 658, colors.ink);
    } else if (detail === "FROZEN_IDENTITY_GRID") {
      drawAcademicHeader(page, assets, identity, colors, "COLOUR", "R6");
      const bottom = drawIdentity(page, assets.fonts, colors, primary);
      centered(page, "FROZEN \u2014 NO CHANGE", assets.fonts.bold, 14, A4.height - bottom - 28, colors.ink);
      centered(page, "Approved fixed 25% grid and continuous 50% centre divider", assets.fonts.regular, 9, A4.height - bottom - 48, colors.ink);
    } else if (detail === "NORMAL_SIX_SUBJECT_COLOUR_CHART" || detail === "NORMAL_SIX_SUBJECT_MONOCHROME_CHART") {
      centered(page, detail === "NORMAL_SIX_SUBJECT_COLOUR_CHART" ? "ORDINARY SIX-SUBJECT CHART \u2014 COLOUR" : "ORDINARY SIX-SUBJECT CHART \u2014 AUTHORITATIVE MONOCHROME", assets.fonts.bold, 12, 792, colors.ink);
      const normal = { ...resolveR6AcademicChartLayout(primary.chartPoints, A4.width - 102, (text) => assets.fonts.regular.widthOfTextAtSize(text, 6)), mode: "NORMAL_ACADEMIC_CHART" as const, rows: 1 as const, categoryRows: [[...primary.chartPoints]], compactGradeLegend: false, reason: "DETAIL_NORMAL" };
      drawR6Chart(page, assets.fonts, colors, primary, 37, 76, A4.width - 74, 500, mode, normal);
    } else if (detail === "AUTHORITATIVE_MONOCHROME_LEGEND_AND_PHOTOCOPY") {
      centered(page, "AUTHORITATIVE MONOCHROME LEGEND / BAR EQUIVALENCE", assets.fonts.bold, 13, 792, colors.ink);
      drawR6ChartLegend(page, assets.fonts, colors, 37, 130, A4.width - 74, "MONOCHROME", r6ChartSeries(colors, "MONOCHROME"), false);
      const barXs = [145, 280.09, 415.19];
      const r6Series = r6ChartSeries(colors, "MONOCHROME");
      r6Series.forEach((seriesItem, index) => {
        drawR6PatternedRectangle(page, { x: barXs[index], y: 500, width: 39.69, height: 108 }, seriesItem.color, colors.ink, seriesItem.pattern);
        centeredInHorizontalSpan(page, "IDENTICAL", assets.fonts.bold, 6.5, 486, colors.ink, barXs[index] - 4, 47.69);
      });
      page.drawImage(photocopyImage, { x: 75, y: 226, width: 445, height: 104 });
      centered(page, "Rendered grayscale + moderate blur/contrast photocopy simulation", assets.fonts.bold, 9, 204, colors.ink);
      centered(page, "Solid medium-grey | Diagonal slashes | Diamond / cross lattice", assets.fonts.regular, 9, 178, colors.ink);
    } else if (detail === "CLASS_VI_DENSE_BEFORE_AFTER" || detail === "CLASS_IX_DENSE_BEFORE_AFTER") {
      const report = detail === "CLASS_VI_DENSE_BEFORE_AFTER" ? middle : secondary;
      centered(page, detail === "CLASS_VI_DENSE_BEFORE_AFTER" ? "CLASSES VI\u2013VIII DENSE CHART \u2014 BEFORE / AFTER" : "CLASSES IX\u2013X DENSE CHART \u2014 BEFORE / AFTER", assets.fonts.bold, 12, 810, colors.ink);
      centered(page, "R5 fixed-height baseline", assets.fonts.bold, 8, 782, colors.ink);
      drawChart(page, assets.fonts, colors, report, 37, 68, A4.width - 74, 240, "COLOUR");
      centered(page, "R6 adaptive dense layout", assets.fonts.bold, 8, 484, colors.ink);
      const layout = resolveR6AcademicChartLayout(report.chartPoints, A4.width - 102, (text) => assets.fonts.regular.widthOfTextAtSize(text, 6));
      drawR6Chart(page, assets.fonts, colors, report, 37, 372, A4.width - 74, 300, "COLOUR", layout);
    } else if (detail === "DENSE_ONE_ROW_CHART") {
      const report = cloneAcademicReport(secondary);
      report.chartPoints = report.chartPoints.slice(0, 8);
      const layout: R6ChartLayout = { mode: "DENSE_ACADEMIC_CHART", rows: 1, categoryRows: [[...report.chartPoints]], compactGradeLegend: true, reason: "DETAIL_FORCED_ONE_ROW" };
      centered(page, "DENSE_ACADEMIC_CHART \u2014 ONE ROW / EIGHT CATEGORIES", assets.fonts.bold, 12, 792, colors.ink);
      drawR6Chart(page, assets.fonts, colors, report, 37, 70, A4.width - 74, 610, "COLOUR", layout);
    } else if (detail === "DENSE_TWO_ROW_FALLBACK") {
      const layout = resolveR6AcademicChartLayout(secondary.chartPoints, A4.width - 102, (text) => assets.fonts.regular.widthOfTextAtSize(text, 6));
      centered(page, "DENSE_ACADEMIC_CHART \u2014 TWO-ROW FALLBACK", assets.fonts.bold, 12, 792, colors.ink);
      drawR6Chart(page, assets.fonts, colors, secondary, 37, 70, A4.width - 74, 610, "COLOUR", layout);
      centered(page, "Shared legend | common 0\u2013100 scale | original subject order", assets.fonts.regular, 9, 128, colors.ink);
    } else if (detail === "COMPACT_GRADE_LEGEND") {
      centered(page, "COMPACT TWO-ROW GRADE LEGEND \u2014 DENSE REPORT MODE", assets.fonts.bold, 12, 760, colors.ink);
      drawGradeLegend(page, assets.fonts, colors, 37, 120, A4.width - 74, secondary.gradeLegend, true);
      centered(page, "Content unchanged; padding reclaimed for the dense plotting area", assets.fonts.regular, 9, 630, colors.ink);
    } else {
      centered(page, "FROZEN 18 MM PHYSICAL SIGNATURE CLEARANCE", assets.fonts.bold, 14, 760, colors.ink);
      page.drawRectangle({ x: R5_SIGNATURE_GEOMETRY.left, y: R5_SIGNATURE_GEOMETRY.lineY, width: R5_SIGNATURE_GEOMETRY.width, height: R5_SIGNATURE_GEOMETRY.clearSigningHeightPt, borderColor: colors.grid, borderWidth: 0.5, borderDashArray: [3, 2] });
      drawSignatures(page, assets.fonts, colors);
      centered(page, "FROZEN \u2014 NO CHANGE", assets.fonts.bold, 11, 145, colors.ink);
    }
    drawFooter(page, assets.fonts, mode, false);
  }
  document.setTitle("R6-DETAIL-CHECKS");
  document.setSubject("Synthetic-only R6 header emphasis, authoritative monochrome patterns, dense charts and frozen geometry");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export const R7_VISUAL_PAGES = R6_VISUAL_PAGES;

export const R7_DETAIL_PAGES = [
  "HEADER_COLOUR_12_11_PT",
  "HEADER_MONOCHROME_12_11_PT",
  "FROZEN_IDENTITY_GRID",
  "SUMMARY_FIVE_CARDS",
  "SUMMARY_FOUR_CARDS",
  "SUMMARY_THREE_CARDS",
  "BALANCED_ATTENDANCE_REMARKS",
  "COLOUR_PRIMARY_CHART",
  "MONOCHROME_SIX_SUBJECT_CHART",
  "MONOCHROME_DENSE_TEN_SUBJECT_CHART",
  "LEGEND_BAR_FILLED_DIAMOND_EQUIVALENCE",
  "PHOTOCOPY_SIMULATION",
  "BALANCED_11_12_MM_SIGNATURE_BLOCK",
  "R6_R7_SIGNATURE_GAP_BEFORE_AFTER"
] as const;

export const R7_DETAIL_MONOCHROME_SWATCHES = {
  page: 11,
  boxes: [
    { series: "Student Marks", x: 145, y: 689.89, width: 39.69, height: 14.17 },
    { series: "Class Average", x: 280.09, y: 689.89, width: 39.69, height: 14.17 },
    { series: "High Score", x: 415.19, y: 689.89, width: 39.69, height: 14.17 }
  ]
} as const;

export async function renderR7VisualPack(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const requested of R7_VISUAL_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    drawR7AcademicPage(page, assets, identity, requested.mode, buildFinalAcademicSnapshot(finalAcademicSpecimen(requested.specimenId)));
  }
  document.setTitle("VISUAL-DIRECTION-PACK-R7");
  document.setSubject("Synthetic-only Classes I-X R7 summary, signature and monochrome-pattern digital review");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR7DetailChecks(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  const photocopyImage = await document.embedPng(await createR7PhotocopySimulationPng());
  const primary = buildFinalAcademicSnapshot(finalAcademicSpecimen("I-II-SESSION"));
  const secondary = buildFinalAcademicSnapshot(finalAcademicSpecimen("IX-X-COMBINED"));
  applyCloseChartEdgeCase(primary);
  applyCloseChartEdgeCase(secondary);

  for (const detail of R7_DETAIL_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    const mode: RefinedColourMode = detail.includes("MONOCHROME") || detail.includes("PHOTOCOPY") || detail.includes("EQUIVALENCE") ? "MONOCHROME" : "COLOUR";
    const colors = palette(mode);
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
    if (detail === "HEADER_COLOUR_12_11_PT" || detail === "HEADER_MONOCHROME_12_11_PT") {
      drawAcademicHeader(page, assets, identity, colors, mode, "R7");
      centered(page, detail === "HEADER_COLOUR_12_11_PT" ? "R7 SECONDARY HEADER — COLOUR" : "R7 SECONDARY HEADER — MONOCHROME", assets.fonts.bold, 12, 680, colors.ink);
      centered(page, "Status 12 pt bold | Address 11 pt bold", assets.fonts.regular, 9, 658, colors.ink);
    } else if (detail === "FROZEN_IDENTITY_GRID") {
      drawAcademicHeader(page, assets, identity, colors, "COLOUR", "R7");
      const bottom = drawIdentity(page, assets.fonts, colors, primary);
      centered(page, "FROZEN — NO CHANGE", assets.fonts.bold, 14, A4.height - bottom - 28, colors.ink);
      centered(page, "Approved fixed 25% grid and continuous 50% centre divider", assets.fonts.regular, 9, A4.height - bottom - 48, colors.ink);
    } else if (detail.startsWith("SUMMARY_") || detail === "BALANCED_ATTENDANCE_REMARKS") {
      const report = cloneAcademicReport(primary);
      if (detail === "SUMMARY_FOUR_CARDS") report.overall.rank = null;
      if (detail === "SUMMARY_THREE_CARDS") {
        report.overall.rank = null;
        report.overall.gradePoint = null;
      }
      centered(page, detail.replaceAll("_", " "), assets.fonts.bold, 13, 782, colors.ink);
      drawR7SummaryAttendanceRemarks(page, assets.fonts, colors, report, 100, "COLOUR");
      if (detail === "BALANCED_ATTENDANCE_REMARKS") {
        centered(page, "Aligned top and bottom edges | 45% attendance / 55% remarks", assets.fonts.regular, 9, 605, colors.ink);
      }
    } else if (detail === "COLOUR_PRIMARY_CHART" || detail === "MONOCHROME_SIX_SUBJECT_CHART") {
      centered(page, detail === "COLOUR_PRIMARY_CHART" ? "CLASSES I–II CHART — COLOUR" : "SIX-SUBJECT CHART — FINAL MONOCHROME", assets.fonts.bold, 12, 792, colors.ink);
      const normal: R6ChartLayout = { mode: "NORMAL_ACADEMIC_CHART", rows: 1, categoryRows: [[...primary.chartPoints]], compactGradeLegend: false, reason: "R7_DETAIL_NORMAL" };
      drawR6Chart(page, assets.fonts, colors, primary, 37, 76, A4.width - 74, 500, mode, normal, "R7");
    } else if (detail === "MONOCHROME_DENSE_TEN_SUBJECT_CHART") {
      centered(page, "DENSE TEN-SUBJECT CHART — FINAL MONOCHROME", assets.fonts.bold, 12, 792, colors.ink);
      const layout = resolveR6AcademicChartLayout(secondary.chartPoints, A4.width - 102, (text) => assets.fonts.regular.widthOfTextAtSize(text, 6));
      drawR6Chart(page, assets.fonts, colors, secondary, 37, 70, A4.width - 74, 610, "MONOCHROME", layout, "R7");
    } else if (detail === "LEGEND_BAR_FILLED_DIAMOND_EQUIVALENCE") {
      centered(page, "MONOCHROME LEGEND / BAR PATTERN EQUIVALENCE", assets.fonts.bold, 13, 792, colors.ink);
      const series = r6ChartSeries(colors, "MONOCHROME");
      drawR6ChartLegend(page, assets.fonts, colors, 37, 130, A4.width - 74, "MONOCHROME", series, false, "R7");
      const barXs = [145, 280.09, 415.19];
      series.forEach((item, index) => {
        drawR6PatternedRectangle(page, { x: barXs[index], y: 500, width: 39.69, height: 108 }, item.color, colors.ink, item.pattern, "R7");
        centeredInHorizontalSpan(page, "MATCH", assets.fonts.bold, 7, 484, colors.ink, barXs[index], 39.69);
      });
      centered(page, "Uniform grey | Single diagonal slashes | Filled black diamond lattice", assets.fonts.bold, 9, 425, colors.ink);
      centered(page, "Legend swatches and corresponding bars share the same renderer and geometry.", assets.fonts.regular, 8.5, 402, colors.ink);
    } else if (detail === "PHOTOCOPY_SIMULATION") {
      centered(page, "ONE-GENERATION PHOTOCOPY SIMULATION", assets.fonts.bold, 13, 792, colors.ink);
      page.drawImage(photocopyImage, { x: 50, y: 435, width: 495, height: 116 });
      centered(page, "Grayscale + moderate blur + contrast reduction + thresholding", assets.fonts.bold, 9, 400, colors.ink);
      centered(page, "All three series remain visibly distinct and labels remain readable.", assets.fonts.regular, 9, 375, colors.ink);
    } else if (detail === "BALANCED_11_12_MM_SIGNATURE_BLOCK") {
      centered(page, "BALANCED SIGNATURE BLOCK — 11–12 MM", assets.fonts.bold, 14, 760, colors.ink);
      page.drawRectangle({ x: R7_SIGNATURE_GEOMETRY.left, y: R7_SIGNATURE_GEOMETRY.lineY, width: R7_SIGNATURE_GEOMETRY.width, height: R7_SIGNATURE_GEOMETRY.clearSigningHeightPt, borderColor: colors.grid, borderWidth: 0.5, borderDashArray: [3, 2] });
      drawSignatures(page, assets.fonts, colors, R7_SIGNATURE_GEOMETRY);
      centered(page, "12.0 mm clear signing height | 4.6 mm line-to-label spacing", assets.fonts.bold, 9, 140, colors.ink);
    } else {
      centered(page, "SIGNATURE CLEARANCE — R6 BEFORE / R7 AFTER", assets.fonts.bold, 14, 790, colors.ink);
      drawSignatureComparison(page, assets.fonts, colors, "R6 — excessive 18 mm clearance", 500, 483, 51.02);
      drawSignatureComparison(page, assets.fonts, colors, "R7 — balanced 12 mm clearance", 180, 167, R7_SIGNATURE_GEOMETRY.clearSigningHeightPt);
    }
    drawFooter(page, assets.fonts, mode, false);
  }
  document.setTitle("R7-DETAIL-CHECKS");
  document.setSubject("Synthetic-only R7 header, summary-card, attendance, signature and monochrome-pattern checks");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export const R8_FINAL_REVIEW_PAGES = [
  { specimenId: "I-II-SESSION", mode: "COLOUR" },
  { specimenId: "I-II-SESSION", mode: "MONOCHROME" },
  { specimenId: "VI-VIII-GROUPED", mode: "COLOUR" },
  { specimenId: "VI-VIII-GROUPED", mode: "MONOCHROME" },
  { specimenId: "IX-X-COMBINED", mode: "COLOUR" },
  { specimenId: "IX-X-COMBINED", mode: "MONOCHROME" },
  { specimenId: "IX-X-REVISION", mode: "COLOUR" },
  { specimenId: "IX-X-REVISION", mode: "MONOCHROME" }
] as const satisfies ReadonlyArray<{ specimenId: string; mode: RefinedColourMode }>;

export const R8_PHYSICAL_SPECIMENS = FINAL_ACADEMIC_PAGE_SPECS.filter((specimen) => specimen.physicalInclude);

export const R8_DETAIL_PAGES = [
  "SINGLE_LINE_SUMMARY_VARIANTS",
  "DENSE_VI_VIII_TABLE_BEFORE_AFTER",
  "DENSE_IX_X_TABLE_AND_COMPACT_CHART",
  "COMBINED_PERSONALITY_GRADE_CLOSEUP",
  "MEASURED_15_MM_SIGNATURE_PROOF",
  "COLOUR_MONOCHROME_GEOMETRY_PARITY"
] as const;

export async function renderR8FinalDigitalReview(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const requested of R8_FINAL_REVIEW_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    drawR8AcademicPage(page, assets, identity, requested.mode, buildFinalAcademicSnapshot(finalAcademicSpecimen(requested.specimenId)));
  }
  document.setTitle("FINAL-DIGITAL-REVIEW-R8");
  document.setSubject("Synthetic-only Classes I-X R8 final digital review; physical printing remains paused");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR8PhysicalAcceptancePack(
  mode: RefinedColourMode,
  identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY
) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  for (const specimen of R8_PHYSICAL_SPECIMENS) {
    const page = document.addPage([A4.width, A4.height]);
    drawR8AcademicPage(page, assets, identity, mode, buildFinalAcademicSnapshot(specimen));
  }
  document.setTitle(`PHYSICAL-ACCEPTANCE-CLASSES-I-X-${mode}`);
  document.setSubject("Synthetic-only Classes I-X physical acceptance candidate; digital approval and printing pending");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderR8DetailChecks(identity: ReportSchoolIdentitySnapshot = DEFAULT_IDENTITY) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  const primary = buildFinalAcademicSnapshot(finalAcademicSpecimen("I-II-SESSION"));
  const middle = buildFinalAcademicSnapshot(finalAcademicSpecimen("VI-VIII-GROUPED"));
  const secondary = buildFinalAcademicSnapshot(finalAcademicSpecimen("IX-X-COMBINED"));
  for (const detail of R8_DETAIL_PAGES) {
    const page = document.addPage([A4.width, A4.height]);
    const colors = palette("COLOUR");
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
    centered(page, detail.replaceAll("_", " "), assets.fonts.bold, 13, 807, colors.ink);
    if (detail === "SINGLE_LINE_SUMMARY_VARIANTS") {
      const five = cloneAcademicReport(primary);
      const four = cloneAcademicReport(primary); four.overall.rank = null;
      const three = cloneAcademicReport(primary); three.overall.rank = null; three.overall.gradePoint = null;
      [five, four, three].forEach((report, index) => {
        centered(page, `${5 - index} enabled metrics`, assets.fonts.bold, 9, 765 - index * 185, colors.ink);
        drawR8SummaryAttendanceRemarks(page, assets.fonts, colors, report, 90 + index * 185, "COLOUR");
        rectTop(page, 37, 153 + index * 185, A4.width - 74, 92, colors.white, colors.border, 0.55);
        centered(page, "Measured widths preserve every complete label and value on one line.", assets.fonts.regular, 8.5, A4.height - 185 - index * 185, colors.ink);
      });
    } else if (detail === "DENSE_VI_VIII_TABLE_BEFORE_AFTER") {
      centered(page, "R7 separate Grade column", assets.fonts.bold, 9, 774, colors.ink);
      drawStandardTables(page, assets.fonts, colors, middle, 82, true);
      centered(page, "R8 academic-table priority + combined Personality Development / Grade", assets.fonts.bold, 9, 451, colors.ink);
      drawR8StandardTables(page, assets.fonts, colors, middle, 405, resolveR8MarksTableLayout(middle));
    } else if (detail === "DENSE_IX_X_TABLE_AND_COMPACT_CHART") {
      const tableBottom = drawR8CombinedTable(page, assets.fonts, colors, secondary, 63, resolveR8MarksTableLayout(secondary));
      const baseChart = resolveR6AcademicChartLayout(secondary.chartPoints, A4.width - 102, (text) => assets.fonts.regular.widthOfTextAtSize(text, 6));
      drawR6Chart(page, assets.fonts, colors, secondary, 37, tableBottom + 10, A4.width - 74, 355, "COLOUR", baseChart, "R8");
    } else if (detail === "COMBINED_PERSONALITY_GRADE_CLOSEUP") {
      drawR8StandardTables(page, assets.fonts, colors, middle, 70, resolveR8MarksTableLayout(middle));
      const panelTop = 385;
      rectTop(page, 37, panelTop, A4.width - 74, 325, colors.white, colors.border, 0.7);
      centered(page, "ONE-CELL TRAIT / GRADE CONTRACT", assets.fonts.bold, 12, A4.height - panelTop - 34, colors.ink);
      middle.traits.slice(0, 8).forEach((trait, index) => {
        const value = `${trait}: ${index === 4 ? "S" : "G"}`;
        rectTop(page, 85, panelTop + 56 + index * 29, A4.width - 170, 25, index % 2 ? colors.white : colors.band, colors.border, 0.45);
        centeredInHorizontalSpan(page, value, assets.fonts.bold, 8.2, A4.height - panelTop - 73 - index * 29, colors.ink, 85, A4.width - 170);
      });
    } else if (detail === "MEASURED_15_MM_SIGNATURE_PROOF") {
      drawSignatureComparison(page, assets.fonts, colors, "R7 review baseline - 12 mm", 510, 497, R7_SIGNATURE_GEOMETRY.clearSigningHeightPt);
      drawSignatureComparison(page, assets.fonts, colors, "R8 final minimum - 15 mm", 205, 192, R8_SIGNATURE_GEOMETRY.clearSigningHeightPt);
      page.drawLine({ start: { x: 52, y: 205 }, end: { x: 52, y: 205 + R8_SIGNATURE_GEOMETRY.clearSigningHeightPt }, thickness: 1, color: colors.ink });
      page.drawLine({ start: { x: 48, y: 205 }, end: { x: 56, y: 205 }, thickness: 1, color: colors.ink });
      page.drawLine({ start: { x: 48, y: 205 + R8_SIGNATURE_GEOMETRY.clearSigningHeightPt }, end: { x: 56, y: 205 + R8_SIGNATURE_GEOMETRY.clearSigningHeightPt }, thickness: 1, color: colors.ink });
      page.drawText("15.0 mm", { x: 58, y: 223, size: 9, font: assets.fonts.bold, color: colors.ink });
    } else {
      const mono = palette("MONOCHROME");
      const leftReport = cloneAcademicReport(primary); leftReport.chartPoints = leftReport.chartPoints.slice(0, 3);
      centered(page, "COLOUR - IDENTICAL GOVERNED GEOMETRY", assets.fonts.bold, 10, 773, colors.ink);
      const chartLayout: R6ChartLayout = { mode: "NORMAL_ACADEMIC_CHART", rows: 1, categoryRows: [[...leftReport.chartPoints]], compactGradeLegend: false, reason: "R8_PARITY" };
      drawR6Chart(page, assets.fonts, colors, leftReport, 37, 82, A4.width - 74, 294, "COLOUR", chartLayout, "R8");
      centered(page, "TRUE MONOCHROME - SAME X / Y / WIDTH / HEIGHT", assets.fonts.bold, 10, 442, mono.ink);
      drawR6Chart(page, assets.fonts, mono, leftReport, 37, 413, A4.width - 74, 294, "MONOCHROME", chartLayout, "R8");
      centered(page, "Only the approved fills and patterns differ.", assets.fonts.bold, 8.5, 108, colors.ink);
    }
    drawFooter(page, assets.fonts, "COLOUR", false);
  }
  document.setTitle("R8-DETAIL-CHECKS");
  document.setSubject("Synthetic-only R8 measured summaries, dense-table priority, adaptive chart and 15 mm signing checks");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

function drawSignatureComparison(page: PDFPage, fonts: Fonts, colors: Palette, title: string, lineY: number, labelY: number, clearHeight: number) {
  centered(page, title, fonts.bold, 11, lineY + clearHeight + 35, colors.ink);
  page.drawRectangle({ x: R7_SIGNATURE_GEOMETRY.left, y: lineY, width: R7_SIGNATURE_GEOMETRY.width, height: clearHeight, borderColor: colors.grid, borderWidth: 0.5, borderDashArray: [3, 2] });
  drawSignatures(page, fonts, colors, { ...R7_SIGNATURE_GEOMETRY, lineY, labelY });
  centered(page, `${(clearHeight / 72 * 25.4).toFixed(1)} mm clear handwriting area`, fonts.regular, 8.5, labelY - 32, colors.ink);
}

async function createR7PhotocopySimulationPng() {
  const svg = Buffer.from(`<svg width="1200" height="280" viewBox="0 0 1200 280" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="slashes" width="21" height="21" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="21" stroke="#000" stroke-width="2.2"/></pattern>
      <pattern id="diamonds" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12 6 L18 12 L12 18 L6 12 Z" fill="#000"/><path d="M0 18 L6 24 L0 30 L-6 24 Z" fill="#000"/></pattern>
    </defs>
    <rect width="1200" height="280" fill="#fff"/>
    <g stroke="#000" stroke-width="4">
      <rect x="35" y="35" width="330" height="150" fill="#8c8c8c"/>
      <rect x="435" y="35" width="330" height="150" fill="url(#slashes)"/>
      <rect x="835" y="35" width="330" height="150" fill="url(#diamonds)"/>
    </g>
    <g font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#000" text-anchor="middle">
      <rect x="68" y="202" width="264" height="43" fill="#fff" stroke="none"/><text x="200" y="235">Student Marks</text>
      <rect x="468" y="202" width="264" height="43" fill="#fff" stroke="none"/><text x="600" y="235">Class Average</text>
      <rect x="868" y="202" width="264" height="43" fill="#fff" stroke="none"/><text x="1000" y="235">High Score</text>
    </g>
  </svg>`);
  return sharp(svg).grayscale().blur(0.45).linear(1.08, -8).threshold(168).png().toBuffer();
}

function cloneAcademicReport(report: AcademicReportSnapshot) {
  return JSON.parse(JSON.stringify(report)) as AcademicReportSnapshot;
}

async function createR6PhotocopySimulationPng() {
  const svg = Buffer.from(`<svg width="1200" height="280" viewBox="0 0 1200 280" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="slashes" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="18" stroke="#000" stroke-width="2.2"/></pattern>
      <pattern id="diamonds" width="28" height="24" patternUnits="userSpaceOnUse"><path d="M14 6 L20 12 L14 18 L8 12 Z" fill="none" stroke="#000" stroke-width="2"/></pattern>
    </defs>
    <rect width="1200" height="280" fill="#fff"/>
    <g stroke="#000" stroke-width="4">
      <rect x="35" y="35" width="330" height="150" fill="#8c8c8c"/>
      <rect x="435" y="35" width="330" height="150" fill="url(#slashes)"/>
      <rect x="835" y="35" width="330" height="150" fill="url(#diamonds)"/>
    </g>
    <g font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#000" text-anchor="middle">
      <text x="200" y="235">Student Marks</text><text x="600" y="235">Class Average</text><text x="1000" y="235">High Score</text>
    </g>
  </svg>`);
  return sharp(svg).grayscale().blur(0.45).linear(1.08, -8).png().toBuffer();
}

function finalAcademicSpecimen(specimenId: string) {
  const specimen = FINAL_ACADEMIC_PAGE_SPECS.find((candidate) => candidate.specimenId === specimenId);
  if (!specimen) throw new Error("Unknown final academic specimen: " + specimenId);
  return specimen;
}

function applyCloseChartEdgeCase(report: AcademicReportSnapshot) {
  const point = report.chartPoints[0];
  if (!point) return;
  point.classAveragePercentage = roundTo(Math.max(0, point.studentPercentage - 0.04), 2);
  point.highScorePercentage = point.studentPercentage;
  const subject = report.subjects.find((candidate) => candidate.key === point.subjectKey);
  if (subject) {
    subject.classAveragePercentage = point.classAveragePercentage;
    subject.highScorePercentage = point.highScorePercentage;
  }
  validateAcademicReportSnapshot(report);
}

async function renderFinalPageCollection(
  mode: RefinedColourMode,
  identity: ReportSchoolIdentitySnapshot,
  academicSpecimens: readonly FinalAcademicPageSpec[],
  includeKgBooklet: boolean,
  title: string
) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document, identity);
  if (includeKgBooklet) {
    FINAL_KG_PAGE_SPECS.forEach((_, index) => {
      const page = document.addPage([A4.width, A4.height]);
      drawFinalKgPage(page, assets, identity, palette(mode), mode, index + 1);
      drawFooter(page, assets.fonts, mode, false);
    });
  }
  for (const specimen of academicSpecimens) {
    const page = document.addPage([A4.width, A4.height]);
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: palette(mode).white });
    drawAcademic(page, assets, identity, palette(mode), mode, buildFinalAcademicSnapshot(specimen));
    drawFooter(page, assets.fonts, mode, false);
  }
  document.setTitle(title);
  document.setSubject("Synthetic-only NALANDA_LEGACY_REFINED physical acceptance candidate");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
  setDeterministicPdfDates(document);
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export function buildSyntheticAcademicSnapshot(
  kind: Exclude<RefinedPageKind, "KG_COVER" | "KG_PROFILE" | "KG_INTELLECTUAL">,
  edgeCase = false
): AcademicReportSnapshot {
  const report =
    kind === "CLASS_II_SESSION" ? primaryReport("II-A", false, edgeCase) :
    kind === "CLASS_V_SESSION" ? primaryReport("V-A", true, edgeCase) :
    kind === "CLASS_VI_GROUPED" ? groupedReport("VI-A", false, edgeCase) :
    kind === "CLASS_X_CT_REVISION" ? groupedReport("X-A", true, edgeCase) :
    combinedReport(edgeCase);
  validateAcademicReportSnapshot(report);
  return report;
}

export function buildFinalAcademicSnapshot(specimen: FinalAcademicPageSpec) {
  const base = buildSyntheticAcademicSnapshot(specimen.baseKind, false);
  if (base.layout === "COMBINED" || specimen.componentProfile == null) {
    const report = structuredClone(base) as AcademicReportSnapshot;
    report.snapshotId = "R42-" + specimen.specimenId;
    report.summarySnapshotId = report.snapshotId;
    report.classSnapshotId = report.snapshotId + "-CLASS";
    report.classSection = specimen.classSection;
    report.examination = specimen.examination;
    report.chartPoints.forEach((point) => { point.classSnapshotId = report.classSnapshotId; });
    validateAcademicReportSnapshot(report);
    return report;
  }
  const columns = componentColumnsForFinalProfile(specimen.componentProfile);
  const leafRows = new Map<string, StandardMarksSubject>();
  base.subjects.forEach((subject, index) => {
    if (subject.kind !== "MARKS") return;
    const sourcePercentage = subject.total.value == null
      ? 70 + index % 7
      : Number(subject.total.value) / subject.total.maximum * 100;
    const values = columns.map((column, columnIndex) => {
      const adjusted = Math.max(0, Math.min(100, sourcePercentage + (columnIndex === 0 ? -2 : 1.5)));
      return roundTo(column.maximum * adjusted / 100, 2);
    });
    const rebuilt = marksSubject(
      subject.key,
      subject.label,
      columns,
      values,
      columns.map(() => "PRESENT" as const),
      subject.includeInOverall,
      subject.chartIncluded,
      base.gradeScale
    );
    rebuilt.chartDisplayLabel = subject.chartDisplayLabel;
    leafRows.set(subject.key, rebuilt);
  });
  const subjects = base.subjects.map((subject): AcademicSubjectSnapshot => {
    if (subject.kind === "MARKS") return leafRows.get(subject.key)!;
    if (subject.kind === "DERIVED") {
      const rebuilt = derivedSubject(
        subject.key,
        subject.label,
        subject.derivedFrom,
        leafRows,
        subject.includeInOverall,
        base.gradeScale
      );
      rebuilt.chartDisplayLabel = subject.chartDisplayLabel;
      return rebuilt;
    }
    return structuredClone(subject);
  });
  const report = finalizeReport({
    snapshotId: "R42-" + specimen.specimenId,
    classSnapshotId: "R42-" + specimen.specimenId + "-CLASS",
    classSection: specimen.classSection,
    examination: specimen.examination,
    studentName: base.studentName,
    guardianName: base.guardianName,
    admissionNumber: base.admissionNumber,
    rollNumber: base.rollNumber,
    parentGuardianLabel: base.parentGuardianLabel,
    layout: "STANDARD",
    componentColumns: columns,
    showAcademicSubjectGrade: base.showAcademicSubjectGrade,
    chartPolicy: base.chartPolicy,
    gradeScale: base.gradeScale,
    subjects,
    traits: base.traits,
    traitTitle: base.traitTitle,
    gradePoint: base.overall.gradePoint,
    rank: base.overall.rank,
    remarks: base.remarks
  });
  validateAcademicReportSnapshot(report);
  return report;
}

function componentColumnsForFinalProfile(profile: Exclude<FinalAcademicPageSpec["componentProfile"], null>) {
  if (profile === "CT") {
    return [
      { key: "internalAssessment", label: "Internal Assessment", maximum: 10 },
      { key: "writtenExamination", label: "Written Examination", maximum: 40 }
    ];
  }
  if (profile === "COMBINED_STANDARD") {
    return [
      { key: "comprehensiveTestResult", label: "Comprehensive Test Result", maximum: 50 },
      { key: "sessionEndResult", label: "Session End Result", maximum: 100 }
    ];
  }
  return [
    { key: "internalAssessment", label: "Internal Assessment", maximum: 20 },
    { key: "writtenExamination", label: "Written Examination", maximum: 80 }
  ];
}

export function validateAcademicReportSnapshot(report: AcademicReportSnapshot) {
  if (!report.snapshotId || report.summarySnapshotId !== report.snapshotId) {
    throw new Error("Report summary must use the frozen report snapshot.");
  }
  if (!report.classSnapshotId) throw new Error("Class comparison snapshot is required.");
  const byKey = new Map(report.subjects.map((row) => [row.key, row]));
  for (const subject of report.subjects) {
    if (subject.kind === "MARKS") {
      const expectedMaximum = sum(subject.components.map((component) => component.maximum));
      if (!close(subject.total.maximum, expectedMaximum)) {
        throw new Error("Component maxima do not reconcile for " + subject.label + ".");
      }
      const entered = subject.components.filter((component) => component.value != null);
      const allEntered = entered.length === subject.components.length;
      if (allEntered) {
        const expectedValue = roundTo(sum(entered.map((component) => Number(component.value))), 2);
        if (subject.total.value == null || !close(subject.total.value, expectedValue)) {
          throw new Error("Component values do not reconcile for " + subject.label + ".");
        }
        const expectedGrade = gradeForScale(expectedValue / expectedMaximum * 100, report.gradeScale);
        if (subject.grade !== expectedGrade) {
          throw new Error("Subject grade does not use the report grade scale for " + subject.label + ".");
        }
      } else if (subject.total.value != null || subject.total.state === "PRESENT") {
        throw new Error("Incomplete components cannot produce a Present total for " + subject.label + ".");
      }
    }
    if (subject.kind === "DERIVED") {
      const sources = new Map(subject.derivedFrom.flatMap((key) => {
        const source = byKey.get(key);
        if (!source || source.kind === "GRADE_ONLY") return [];
        return [[key, {
          key,
          maximum: source.total.maximum,
          value: source.total.value,
          state: source.total.state
        }] as const];
      }));
      const expected = calculateSubjectGroupResult(subject.groupFormula, subject.derivedFrom, sources);
      if (
        expected.state !== "PRESENT" || expected.maximum == null || expected.value == null ||
        !close(subject.total.maximum, expected.maximum) || !close(subject.total.value, expected.value)
      ) {
        throw new Error("Derived subject total does not reconcile for " + subject.label + ".");
      }
      if (subject.grade !== gradeForScale(expected.value / expected.maximum * 100, report.gradeScale)) {
        throw new Error("Subject grade does not use the report grade scale for " + subject.label + ".");
      }
    }
    if (subject.kind === "COMBINED") {
      if (!report.combinedScheme) throw new Error("Combined report requires its frozen examination scheme.");
      validateCombinedSubject(subject, report.combinedScheme);
      if (subject.groupFormula) validateCombinedGroupSubject(subject, byKey);
      if (subject.grade !== gradeForScale(Number(subject.total.value) / subject.total.maximum * 100, report.gradeScale)) {
        throw new Error("Subject grade does not use the report grade scale for " + subject.label + ".");
      }
    }
  }
  const included = report.subjects.filter(
    (subject): subject is StandardMarksSubject | DerivedMarksSubject | CombinedMarksSubject =>
      subject.includeInOverall && hasNumericTotal(subject)
  );
  const expectedMaximum = roundTo(sum(included.map((subject) => subject.total.maximum)), 2);
  const expectedValue = roundTo(sum(included.map((subject) => roundTo(Number(subject.total.value), 2))), 2);
  if (!close(report.overall.maximum, expectedMaximum) || !close(report.overall.value, expectedValue)) {
    throw new Error("Subject totals do not reconcile to the overall total.");
  }
  const expectedPercentage = expectedMaximum ? roundTo(expectedValue / expectedMaximum * 100, 2) : 0;
  if (!close(report.overall.percentage, expectedPercentage)) {
    throw new Error("Overall total does not reconcile to percentage.");
  }
  if (report.overall.grade !== gradeForScale(expectedPercentage, report.gradeScale)) {
    throw new Error("Overall grade does not use the report grade scale.");
  }
  if (!close(report.overall.rankBasisPercentage, expectedPercentage)) {
    throw new Error("Rank basis does not use the displayed frozen percentage.");
  }
  const expectedLegend = gradeLegendForScale(report.gradeScale);
  if (JSON.stringify(report.gradeLegend) !== JSON.stringify(expectedLegend)) {
    throw new Error("Grade legend does not use the report grade scale.");
  }
  if (!close(report.attendance.percentage, report.attendance.daysPresent / report.attendance.workingDays * 100)) {
    throw new Error("Attendance percentage does not reconcile.");
  }
  const chartSubjects = selectChartSubjects(report.subjects, report.chartPolicy);
  if (chartSubjects.length !== report.chartPoints.length) {
    throw new Error("Chart subject set does not match the displayed table.");
  }
  for (const subject of chartSubjects) {
    const point = report.chartPoints.find((candidate) => candidate.subjectKey === subject.key);
    if (!point || point.subjectLabel !== subject.label) {
      throw new Error("Chart label does not match the displayed subject.");
    }
    const expectedStudent = roundTo(Number(subject.total.value) / subject.total.maximum * 100, 2);
    if (!close(point.studentPercentage, expectedStudent)) {
      throw new Error("Chart Student value does not match the displayed subject total.");
    }
    if (
      point.classSnapshotId !== report.classSnapshotId ||
      subject.classAveragePercentage == null ||
      subject.highScorePercentage == null ||
      !close(point.classAveragePercentage, subject.classAveragePercentage) ||
      !close(point.highScorePercentage, subject.highScorePercentage)
    ) {
      throw new Error("Chart comparison values do not use the frozen class snapshot.");
    }
    if (
      point.studentPercentage < 0 ||
      point.studentPercentage > 100 ||
      point.classAveragePercentage < 0 ||
      point.highScorePercentage > 100 ||
      point.classAveragePercentage > point.highScorePercentage ||
      point.studentPercentage > point.highScorePercentage
    ) {
      throw new Error("Chart class comparison values are invalid.");
    }
  }
  return validateDisplayedReportReconciliation(report);
}

function validateCombinedGroupSubject(
  subject: CombinedMarksSubject,
  byKey: Map<string, AcademicSubjectSnapshot>
) {
  if (!subject.groupFormula || subject.aggregateOf.length === 0) {
    throw new Error("Grouped combined subject requires its frozen group formula and members.");
  }
  const members = subject.aggregateOf.map((key) => byKey.get(key));
  if (members.some((member) => !member || member.kind !== "COMBINED" || member.groupFormula)) {
    throw new Error("Grouped combined subject source is missing for " + subject.label + ".");
  }
  const combinedMembers = members.filter((member): member is CombinedMarksSubject =>
    Boolean(member && member.kind === "COMBINED" && !member.groupFormula)
  );
  const expected = calculateSubjectGroupResult(
    subject.groupFormula,
    subject.aggregateOf,
    new Map(combinedMembers.map((member) => [member.key, {
      key: member.key,
      maximum: member.total.maximum,
      value: member.total.value,
      state: member.total.state
    }]))
  );
  if (
    expected.state !== "PRESENT" ||
    expected.value == null ||
    expected.maximum == null ||
    !close(subject.total.value, expected.value) ||
    !close(subject.total.maximum, expected.maximum)
  ) {
    throw new Error("Grouped combined result does not reconcile for " + subject.label + ".");
  }
  const fields: Array<keyof CombinedResultValues> = [
    "ct1", "ia1", "ct2", "ia2", "ct3", "ia3", "ctWeighted",
    "terminalRaw", "terminalWeighted", "annualRaw", "annualWeighted", "gradePoint"
  ];
  for (const field of fields) {
    const fieldResult = calculateSubjectGroupResult(
      subject.groupFormula,
      subject.aggregateOf,
      new Map(combinedMembers.map((member) => [member.key, {
        key: member.key,
        maximum: field === "gradePoint" ? 10 : field.endsWith("Raw") ? 100 : 100,
        value: member.combined[field],
        state: "PRESENT" as const
      }]))
    );
    if (fieldResult.value == null || !close(subject.combined[field], fieldResult.value)) {
      throw new Error("Grouped combined component does not reconcile for " + subject.label + ".");
    }
  }
}

function validateCombinedSubject(subject: CombinedMarksSubject, scheme: CombinedSchemeSnapshot) {
  const value = subject.combined;
  const bounded: Array<[number, number]> = [
    [value.ct1, scheme.ctMaximum], [value.ia1, scheme.internalAssessmentMaximum],
    [value.ct2, scheme.ctMaximum], [value.ia2, scheme.internalAssessmentMaximum],
    [value.ct3, scheme.ctMaximum], [value.ia3, scheme.internalAssessmentMaximum],
    [value.terminalRaw, scheme.terminalMaximum], [value.annualRaw, scheme.annualMaximum]
  ];
  if (bounded.some(([actual, maximum]) => actual < 0 || actual > maximum)) {
    throw new Error("Combined-result raw value exceeds its maximum for " + subject.label + ".");
  }
  const cycleMaximum = scheme.ctMaximum + scheme.internalAssessmentMaximum;
  const ctWeighted = roundTo(average([
    (value.ct1 + value.ia1) / cycleMaximum * 100,
    (value.ct2 + value.ia2) / cycleMaximum * 100,
    (value.ct3 + value.ia3) / cycleMaximum * 100
  ]) * scheme.ctWeight / 100, 2);
  const terminalWeighted = roundTo(value.terminalRaw / scheme.terminalMaximum * scheme.terminalWeight, 2);
  const annualWeighted = roundTo(value.annualRaw / scheme.annualMaximum * scheme.annualWeight, 2);
  const total = roundTo(ctWeighted + terminalWeighted + annualWeighted, 2);
  const totalMaximum = scheme.ctWeight + scheme.terminalWeight + scheme.annualWeight;
  if (
    !close(value.ctWeighted, ctWeighted) ||
    !close(value.terminalWeighted, terminalWeighted) ||
    !close(value.annualWeighted, annualWeighted) ||
    !close(subject.total.value, total) ||
    !close(subject.total.maximum, totalMaximum)
  ) {
    throw new Error("Combined weighted values do not reconcile for " + subject.label + ".");
  }
}

function drawPage(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  kind: RefinedPageKind,
  mode: RefinedColourMode,
  edgeCase: boolean
) {
  const colors = palette(mode);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4.width,
    height: A4.height,
    color: kind.startsWith("KG_") ? colors.paper : colors.white
  });
  if (kind === "KG_COVER") drawKgCover(page, assets, identity, colors, mode, edgeCase);
  else if (kind === "KG_PROFILE") drawKgProfile(page, assets, identity, colors, edgeCase);
  else if (kind === "KG_INTELLECTUAL") drawKgIntellectual(page, assets, identity, colors, edgeCase);
  else drawAcademic(page, assets, identity, colors, mode, buildSyntheticAcademicSnapshot(kind, edgeCase));
  drawFooter(page, assets.fonts, mode, edgeCase);
}

function drawR5AcademicPage(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  mode: RefinedColourMode,
  report: AcademicReportSnapshot
) {
  const colors = palette(mode);
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
  drawAcademic(page, assets, identity, colors, mode, report);
  drawFooter(page, assets.fonts, mode, false);
}

function drawR6AcademicPage(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  mode: RefinedColourMode,
  report: AcademicReportSnapshot
) {
  const colors = palette(mode);
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
  drawAcademic(page, assets, identity, colors, mode, report, { r6: true });
  drawFooter(page, assets.fonts, mode, false);
}

function drawR7AcademicPage(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  mode: RefinedColourMode,
  report: AcademicReportSnapshot
) {
  const colors = palette(mode);
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
  drawAcademic(page, assets, identity, colors, mode, report, { r7: true });
  drawFooter(page, assets.fonts, mode, false);
}

function drawR8AcademicPage(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  mode: RefinedColourMode,
  report: AcademicReportSnapshot
) {
  const colors = palette(mode);
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.white });
  drawAcademic(page, assets, identity, colors, mode, report, { r8: true });
  drawFooter(page, assets.fonts, mode, false);
}

function drawFinalKgPage(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  mode: RefinedColourMode,
  pageNumber: number
) {
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.paper });
  if (pageNumber === 1) return drawKgCover(page, assets, identity, colors, mode, false);
  if (pageNumber === 2) return drawKgProfile(page, assets, identity, colors, false);
  if (pageNumber === 3) return drawKgInstructions(page, assets, identity, colors);
  if (pageNumber === 4) return drawKgIntellectual(page, assets, identity, colors, false);
  if (pageNumber === 5) return drawKgDevelopmentPage(page, assets, identity, colors, "ENGLISH DEVELOPMENT", [
    "Letter recognition", "Phonic awareness", "Picture reading", "Word reading", "Conversation in English",
    "Recitation", "Written Work", "Dictation", "Home Assignment", "Listening and expression"
  ]);
  if (pageNumber === 6) return drawKgDevelopmentPage(page, assets, identity, colors, "HINDI AND NUMBER WORK", [
    "Hindi - Reading", "Hindi - Recitation", "Hindi - Written Work", "Recognition of Numbers",
    "Number Operations", "Mathematics - Written Work", "Mathematics - Dictation",
    "Mathematics - Home Assignment", "Shapes and patterns", "Practical number concepts"
  ]);
  if (pageNumber === 7) return drawKgDevelopmentPage(page, assets, identity, colors, "EVS, RHYMES AND STORY", [
    "Environmental awareness", "Observation and discovery", "General knowledge", "Rhymes - memory and rhythm",
    "Rhymes - expression", "Story - listening", "Story - narration", "Drawing and Colouring",
    "Creative activity", "Overall development"
  ]);
  if (pageNumber === 8) return drawKgPersonalityAttendanceGrowth(page, assets, identity, colors);
  if (pageNumber === 9) return drawKgCommentsPromotion(page, assets, identity, colors);
  return drawKgBackCover(page, assets, identity, colors, mode);
}

function drawKgPageHeading(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  title: string
) {
  drawKgFrame(page, colors);
  centered(page, title, assets.fonts.school, 18, 772, colors.kgPinkDark);
  page.drawText(identity.academicYear, { x: 472, y: 775, size: 7.5, font: assets.fonts.bold, color: colors.kgGreenText });
}

function drawKgInstructions(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette
) {
  drawKgPageHeading(page, assets, identity, colors, "GUIDANCE FOR THE BOOKLET");
  const introduction = [
    "This developmental booklet records growth across five evaluation periods.",
    "Ratings describe observed progress and are not marks, rank or examination percentages.",
    "Teachers record each configured area using the approved evaluation scheme.",
    "Parent / Guardian comments and signatures support a continuous school-home dialogue.",
    "Attendance and physical-growth entries use the frozen reporting-period snapshot.",
    "Blank or not-applicable areas remain visually distinct and are never inferred."
  ];
  let top = 126;
  introduction.forEach((text, index) => {
    const lines = wrapText(`${index + 1}. ${text}`, assets.fonts.regular, 10, 430);
    const height = Math.max(42, 16 + lines.length * 13);
    rectTop(page, 74, top, 447, height, index % 2 ? colors.kgCream : colors.white, colors.kgGreenText, 0.55);
    lines.forEach((line, lineIndex) => page.drawText(line, {
      x: 87,
      y: A4.height - top - 19 - lineIndex * 13,
      size: 10,
      font: assets.fonts.regular,
      color: colors.kgInk
    }));
    top += height + 10;
  });
  centered(page, "Evaluation I   Evaluation II   Evaluation III   Evaluation IV   Evaluation V", assets.fonts.bold, 9.2, 96, colors.kgPinkDark);
}

function drawKgDevelopmentPage(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  title: string,
  areas: string[]
) {
  drawKgPageHeading(page, assets, identity, colors, title);
  const headers = ["Development Area", "Evaluation\nI", "Evaluation\nII", "Evaluation\nIII", "Evaluation\nIV", "Evaluation\nV"];
  const rows = areas.map((area, index) => ({
    cells: [area, index % 5 === 3 ? "S" : "G", "G", index % 6 === 4 ? "S" : "G", "G", "G"],
    bold: false
  }));
  drawTable(page, assets.fonts, colors, 55, 126, [214, 55, 55, 55, 55, 55], headers, rows, {
    headerHeight: 46,
    rowHeight: 42,
    fontSize: 8.4,
    firstColumnLeft: true,
    dynamicRows: true,
    headerFill: colors.kgPink,
    headerText: colors.white,
    sectionFill: colors.kgGreen
  });
  centered(page, "G: Good   S: Satisfactory   N: Needs Improvement", assets.fonts.bold, 8.5, 91, colors.kgGreenText);
}

function drawKgPersonalityAttendanceGrowth(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette
) {
  drawKgPageHeading(page, assets, identity, colors, "PERSONALITY, ATTENDANCE AND GROWTH");
  const personalityRows = ["Confidence", "Courtesy", "Sharing and Caring", "Self-Control", "Regularity", "Participation"]
    .map((label, index) => ({ cells: [label, index === 4 ? "S" : "G", "G", "G", "G", "G"], bold: false }));
  let top = drawTable(page, assets.fonts, colors, 55, 117, [214, 55, 55, 55, 55, 55], ["Personality Development", "I", "II", "III", "IV", "V"], personalityRows, {
    headerHeight: 30,
    rowHeight: 20,
    fontSize: 7.8,
    firstColumnLeft: true,
    dynamicRows: true,
    headerFill: colors.kgPink,
    headerText: colors.white,
    sectionFill: colors.kgGreen
  });
  top += 14;
  const months = ["June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
  top = drawTable(page, assets.fonts, colors, 55, top, [134, ...months.map(() => 36.5)], ["Monthly Attendance", ...months], [
    { cells: ["Working Days", "20", "22", "21", "20", "19", "21", "18", "21", "20", "22"], bold: false },
    { cells: ["Days Present", "20", "21", "20", "20", "18", "21", "18", "20", "19", "22"], bold: false }
  ], {
    headerHeight: 32,
    rowHeight: 20,
    fontSize: 6.8,
    firstColumnLeft: true,
    dynamicRows: true,
    headerFill: colors.kgGreen,
    headerText: colors.kgInk,
    sectionFill: colors.kgGreen
  });
  top += 14;
  drawTable(page, assets.fonts, colors, 92, top, [134, 110, 110, 110], ["Physical Growth", "Evaluation I", "Evaluation III", "Evaluation V"], [
    { cells: ["Height (cm)", "101.0", "104.0", "107.0"], bold: false },
    { cells: ["Weight (kg)", "15.0", "16.5", "18.0"], bold: false }
  ], {
    headerHeight: 30,
    rowHeight: 22,
    fontSize: 8,
    firstColumnLeft: true,
    dynamicRows: true,
    headerFill: colors.kgPink,
    headerText: colors.white,
    sectionFill: colors.kgGreen
  });
}

function drawKgCommentsPromotion(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette
) {
  drawKgPageHeading(page, assets, identity, colors, "COMMENTS, PROMOTION AND SIGNATURES");
  let top = 124;
  for (const evaluation of ["I", "II", "III", "IV", "V"]) {
    const comment = `Evaluation ${evaluation}: Synthetic developmental comment recorded for layout and print calibration only.`;
    top = drawWrappedBox(page, assets.fonts.regular, colors, 69, top, 457, comment, 9, 45) + 8;
  }
  rectTop(page, 69, top + 3, 457, 82, colors.kgCream, colors.kgPinkDark, 0.8);
  page.drawText("Promoted to:", { x: 84, y: A4.height - top - 24, size: 10, font: assets.fonts.bold, color: colors.kgPinkDark });
  page.drawText("SYNTHETIC NEXT CLASS", { x: 163, y: A4.height - top - 24, size: 10, font: assets.fonts.regular, color: colors.kgInk });
  page.drawText("Next session begins: 01 April 2100", { x: 84, y: A4.height - top - 49, size: 9.2, font: assets.fonts.regular, color: colors.kgInk });
  ["Class Teacher", "Principal", "Parent / Guardian", "Director"].forEach((label, index) => {
    const x = 57 + index * 132;
    page.drawLine({ start: { x, y: 91 }, end: { x: x + 92, y: 91 }, thickness: 0.55, color: colors.kgGreenText });
    page.drawText(label, { x: x + 4, y: 76, size: 7.8, font: assets.fonts.bold, color: colors.kgPinkDark });
  });
}

function drawKgBackCover(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  mode: RefinedColourMode
) {
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.kgGreen });
  page.drawRectangle({ x: 34, y: 34, width: A4.width - 68, height: A4.height - 68, color: colors.kgCream, borderColor: colors.kgPinkDark, borderWidth: 2 });
  page.drawRectangle({ x: 49, y: 49, width: A4.width - 98, height: A4.height - 98, borderColor: colors.kgGreenText, borderWidth: 0.8 });
  const logo = mode === "MONOCHROME" ? assets.monochromeLogo : assets.colourLogo;
  if (logo) page.drawImage(logo, { x: (A4.width - 74) / 2, y: 492, width: 74, height: 74 });
  centered(page, "NALANDA", assets.fonts.school, 24, 450, colors.kgPinkDark);
  centered(page, "PUBLIC SCHOOL", assets.fonts.school, 24, 421, colors.kgPinkDark);
  centered(page, identity.motto, assets.fonts.regular, 10, 391, colors.kgGreenText);
  centered(page, "KINDERGARTEN DEVELOPMENTAL BOOKLET", assets.fonts.bold, 12, 329, colors.kgInk);
  centered(page, identity.addressLine1 + ", " + identity.city, assets.fonts.regular, 9.2, 289, colors.kgInk);
  centered(page, "Academic Year " + identity.academicYear, assets.fonts.bold, 9.5, 265, colors.kgPinkDark);
}

function drawKgCover(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  mode: RefinedColourMode,
  edgeCase: boolean
) {
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.kgGreen });
  page.drawRectangle({ x: 0, y: 682, width: A4.width, height: 53, color: colors.kgPink });
  page.drawRectangle({ x: 0, y: 640, width: 360, height: 28, color: colors.kgCream });
  page.drawRectangle({ x: 235, y: 640, width: 360, height: 28, color: colors.kgPink });
  page.drawRectangle({ x: 0, y: 76, width: A4.width, height: 58, color: colors.kgPink });
  page.drawRectangle({ x: 0, y: 43, width: 365, height: 31, color: colors.kgCream });
  page.drawRectangle({ x: 220, y: 42, width: 375, height: 32, color: colors.kgGreenDark });
  page.drawRectangle({ x: 37, y: 151, width: A4.width - 74, height: 455, color: colors.kgCream, opacity: 0.58 });
  page.drawRectangle({ x: 44, y: 158, width: A4.width - 88, height: 441, borderColor: colors.kgPink, borderWidth: 1.5 });
  const logo = mode === "MONOCHROME" ? assets.monochromeLogo : assets.colourLogo;
  if (logo) page.drawImage(logo, { x: (A4.width - 52) / 2, y: 510, width: 52, height: 52 });
  centered(page, "NALANDA", assets.fonts.school, 22, 478, colors.kgPinkDark);
  centered(page, "PUBLIC SCHOOL", assets.fonts.school, 22, 452, colors.kgPinkDark);
  centered(page, "PROGRESS REPORT", assets.fonts.bold, 17, 407, colors.kgInk);
  centered(page, identity.motto, assets.fonts.regular, 9.2, 384, colors.kgGreenText);
  page.drawRectangle({ x: 142, y: 235, width: 311, height: 88, color: colors.white, borderColor: colors.kgPink, borderWidth: 1.5 });
  lineField(page, assets.fonts, "Name", edgeCase ? "Synthetic Student With A Very Long Multilingual Name" : "Aarav Rahman", 157, 292, 280, colors);
  lineField(page, assets.fonts, "Class / Sec.", "LKG - A", 157, 262, 150, colors);
  lineField(page, assets.fonts, "Roll No.", "12", 333, 262, 105, colors);
  page.drawText("P R O G R E S S   R E P O R T", {
    x: 505, y: 184, size: 8.5, font: assets.fonts.bold, color: colors.kgGreenText, rotate: degrees(90)
  });
}

function drawKgProfile(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  edgeCase: boolean
) {
  drawKgFrame(page, colors);
  centered(page, "STUDENT'S PROFILE", assets.fonts.school, 22, 762, colors.kgPinkDark);
  centered(page, identity.academicYear, assets.fonts.bold, 10, 741, colors.kgPinkDark);
  page.drawRectangle({ x: 430, y: 633, width: 84, height: 108, borderColor: colors.kgGreenText, borderWidth: 0.8 });
  centeredInBox(page, ["AFFIX", "PHOTO", "HERE"], assets.fonts.bold, 8.5, { x: 430, y: 633, width: 84, height: 108 }, colors.kgPinkDark);
  const rows = [
    ["Name", edgeCase ? "Aarav Synthetic Extremely Long Multilingual Compatible Student Name" : "Aarav Rahman"],
    ["Date of Birth", "01 January 2094"],
    ["Class / Section", "LKG - A"],
    ["Roll No.", "12"],
    ["Admission No.", "SYN-0012"],
    ["Parent / Guardian", edgeCase ? "Synthetic Parent and Guardian With An Exceptionally Long Name" : "Samira Rahman"],
    ["Address", edgeCase ? "42 Synthetic Learning Avenue, Long Locality Name, Hyderabad" : "42 Sample Road, Hyderabad"],
    ["Phone", "+91 00000 00000"],
    ["Emergency", "+91 00000 00001"]
  ];
  let y = 625;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 76, y, size: 10, font: assets.fonts.regular, color: colors.kgGreenText });
    const lines = wrapText(value, assets.fonts.regular, 9.6, 315);
    lines.slice(0, 2).forEach((line, index) => page.drawText(line, {
      x: 185, y: y - index * 11, size: 9.6, font: assets.fonts.regular, color: colors.kgInk
    }));
    page.drawLine({ start: { x: 180, y: y - 4 - Math.max(0, lines.length - 1) * 11 }, end: { x: 510, y: y - 4 - Math.max(0, lines.length - 1) * 11 }, thickness: 0.55, color: colors.kgGreenText, dashArray: [1, 2] });
    y -= edgeCase ? 49 : 48;
  }
  page.drawLine({ start: { x: 367, y: 93 }, end: { x: 515, y: 93 }, thickness: 0.6, color: colors.kgGreenText, dashArray: [1, 2] });
  page.drawText("Signature of Parent / Guardian", { x: 353, y: 77, size: 9.2, font: assets.fonts.bold, color: colors.kgPinkDark });
}

function drawKgIntellectual(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  edgeCase: boolean
) {
  drawKgFrame(page, colors);
  centered(page, "INTELLECTUAL SKILLS", assets.fonts.school, 19, 772, colors.kgPinkDark);
  page.drawText(identity.academicYear, { x: 472, y: 775, size: 7.5, font: assets.fonts.bold, color: colors.kgGreenText });
  const headers = ["Intellectual Skills", "Evaluation\nI", "Evaluation\nII", "Evaluation\nIII", "Evaluation\nIV", "Evaluation\nV"];
  const rows = KG_INTELLECTUAL_HIERARCHY.map((item, index) => ({
    cells: [
      (item.level ? "    " : "") + (edgeCase && item.label === "Conversation in English" ? "Conversation and Expression in English" : item.label),
      index % 6 === 2 ? "S" : "G", "G", index % 7 === 3 ? "S" : "G", "G", "G"
    ],
    bold: "section" in item && item.section
  }));
  drawTable(page, assets.fonts, colors, 55, 120, [214, 55, 55, 55, 55, 55], headers, rows, {
    headerHeight: 46,
    rowHeight: edgeCase ? 31 : 29,
    fontSize: 8.2,
    firstColumnLeft: true,
    headerFill: colors.kgPink,
    headerText: colors.white,
    sectionFill: colors.kgGreen
  });
  centered(page, "G: Good   S: Satisfactory   N: Needs Improvement", assets.fonts.bold, 8.5, 83, colors.kgGreenText);
}

function drawAcademic(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  mode: RefinedColourMode,
  report: AcademicReportSnapshot,
  options: { r6?: boolean; r7?: boolean; r8?: boolean } = {}
) {
  const governedVersion = options.r8 ? "R8" : options.r7 ? "R7" : options.r6 ? "R6" : "R5";
  drawAcademicHeader(page, assets, identity, colors, mode, governedVersion);
  const identityBottom = drawIdentity(page, assets.fonts, colors, report);
  centered(page, report.examination, assets.fonts.bold, 13.5, A4.height - identityBottom - 31, colors.ink);
  const tableTop = identityBottom + 42;
  const fullWidth = A4.width - 74;
  let contentBottom: number;
  const r8MarksLayout = options.r8 ? resolveR8MarksTableLayout(report) : null;
  if (report.layout === "COMBINED") {
    contentBottom = options.r8
      ? drawR8CombinedTable(page, assets.fonts, colors, report, tableTop, r8MarksLayout!)
      : drawCombinedTable(page, assets.fonts, colors, report, tableTop, Boolean(options.r6 || options.r7));
  } else {
    contentBottom = options.r8
      ? drawR8StandardTables(page, assets.fonts, colors, report, tableTop, r8MarksLayout!)
      : drawStandardTables(page, assets.fonts, colors, report, tableTop, Boolean(options.r6 || options.r7));
  }
  contentBottom = drawGroupResultNote(page, assets.fonts, colors, report, contentBottom);
  contentBottom = drawResultStateLegend(page, assets.fonts, colors, report, contentBottom);
  let top: number;
  if (options.r8) {
    top = drawR8SummaryAttendanceRemarks(page, assets.fonts, colors, report, contentBottom + 4, mode) + 5;
  } else if (options.r7) {
    top = drawR7SummaryAttendanceRemarks(page, assets.fonts, colors, report, contentBottom + 4, mode) + 5;
  } else if (options.r6) {
    top = drawR6SummaryAttendanceRemarks(page, assets.fonts, colors, report, contentBottom + 4) + 5;
  } else {
    top = contentBottom + 8;
    top = drawSummary(page, assets.fonts, colors, report, top) + 9;
    top = drawAttendance(page, assets.fonts, colors, report, top) + 9;
    top = drawRemarks(page, assets.fonts, colors, report.remarks, top) + 10;
  }
  const signatureGeometry = options.r8 ? R8_SIGNATURE_GEOMETRY : options.r7 ? R7_SIGNATURE_GEOMETRY : R5_SIGNATURE_GEOMETRY;
  const signatureContentLimit = A4.height - (signatureGeometry.lineY + signatureGeometry.clearSigningHeightPt);
  const r6ChartLayout = options.r6 || options.r7 || options.r8
    ? resolveR6AcademicChartLayout(
      report.chartPoints,
      fullWidth - 28,
      (text) => assets.fonts.regular.widthOfTextAtSize(text, R6_DENSE_CHART_GEOMETRY.subjectLabelFontSizePt)
    )
    : null;
  const r8ChartLayout = options.r8 && r6ChartLayout
    ? resolveR8ChartLayout(report, r8MarksLayout!, r6ChartLayout)
    : null;
  const effectiveChartLayout = r8ChartLayout ?? r6ChartLayout;
  const gradeLegendHeight = effectiveChartLayout?.compactGradeLegend
    ? R6_DENSE_CHART_GEOMETRY.compactGradeLegendRowHeightPt * 2
    : 30;
  const chartHeightAvailable = signatureContentLimit - top - gradeLegendHeight - 9;
  const preferredChartHeight = !effectiveChartLayout
    ? (report.layout === "COMBINED" ? 105 : 120)
    : effectiveChartLayout.rows === 2 ? 198 : effectiveChartLayout.mode === "DENSE_ACADEMIC_CHART" ? 205 : options.r7 ? 165 : 120;
  const minimumChartHeight = !effectiveChartLayout
    ? 76
    : effectiveChartLayout.rows === 2 ? 165 : effectiveChartLayout.mode === "DENSE_ACADEMIC_CHART" ? (options.r7 ? 140 : options.r8 ? 125 : 155) : 76;
  const chartHeight = options.r8 || options.r7 ? chartHeightAvailable : Math.min(preferredChartHeight, chartHeightAvailable);
  if (chartHeight < minimumChartHeight) throw new Error(`Academic layout cannot preserve the approved chart and signature geometry on one A4 page (${report.classSection}, ${effectiveChartLayout?.rows ?? 1} row, available ${chartHeightAvailable.toFixed(1)} pt, minimum ${minimumChartHeight.toFixed(1)} pt).`);
  if (r8ChartLayout?.rows === 2) {
    const rowSlotHeight = r8ChartRowSlotHeight(chartHeight, r8ChartLayout);
    if (rowSlotHeight + EPSILON < R8_CHART_GEOMETRY.minimumTwoRowSlotHeightPt) {
      throw new Error(`R8 compact-dense chart row slot is below 30 mm for ${report.classSection} ${report.examination} (${rowSlotHeight.toFixed(1)} pt from ${chartHeight.toFixed(1)} pt total).`);
    }
  }
  top = (options.r6 || options.r7 || options.r8
    ? drawR6Chart(page, assets.fonts, colors, report, 37, top, fullWidth, chartHeight, mode, effectiveChartLayout!, options.r8 ? "R8" : options.r7 ? "R7" : "R6")
    : drawChart(page, assets.fonts, colors, report, 37, top, fullWidth, chartHeight, mode)) + 9;
  const gradeLegendBottom = drawGradeLegend(
    page,
    assets.fonts,
    colors,
    37,
    top,
    fullWidth,
    report.gradeLegend,
    Boolean(effectiveChartLayout?.compactGradeLegend)
  );
  if (gradeLegendBottom > signatureContentLimit + EPSILON) {
    throw new Error("Grade legend intrudes into the approved physical signing area.");
  }
  drawSignatures(page, assets.fonts, colors, signatureGeometry);
}

function drawGroupResultNote(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  top: number
) {
  return report.subjects.some((subject) => subject.aggregateOf.length > 0)
    ? drawWrappedBox(page, fonts.regular, colors, 37, top, A4.width - 74, GROUP_RESULT_NOTE, R4_MINIMUM_FONT_SIZES.legend, 18)
    : top;
}

function drawResultStateLegend(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  top: number
) {
  const used = new Set<MarkState>();
  for (const subject of report.subjects) {
    if (subject.kind === "MARKS") {
      subject.components.forEach((component) => used.add(component.state));
      used.add(subject.total.state);
    } else if (subject.kind === "GRADE_ONLY") used.add(subject.state);
  }
  const definitions: Array<[MarkState, string]> = [
    ["ABSENT", "AB = Absent"],
    ["EXEMPT", "EX = Exempt"],
    ["NOT_ENTERED", "NE = Not Entered"],
    ["NOT_APPLICABLE", "NA = Not Applicable"]
  ];
  const labels = definitions.filter(([state]) => used.has(state)).map(([, label]) => label);
  return labels.length
    ? drawWrappedBox(page, fonts.regular, colors, 37, top, A4.width - 74, labels.join(";   "), R4_MINIMUM_FONT_SIZES.legend, 18)
    : top;
}

function drawAcademicHeader(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
  mode: RefinedColourMode,
  version: "R5" | "R6" | "R7" | "R8" = "R5"
) {
  const logo = mode === "MONOCHROME" ? assets.monochromeLogo : assets.colourLogo;
  if (logo) page.drawImage(logo, {
    x: R5_HEADER_GEOMETRY.logoX,
    y: R5_HEADER_GEOMETRY.logoY,
    width: R5_HEADER_GEOMETRY.logoWidth,
    height: R5_HEADER_GEOMETRY.logoHeight
  });
  centeredInHorizontalSpan(
    page,
    identity.schoolName.toUpperCase(),
    assets.fonts.school,
    21,
    R5_HEADER_GEOMETRY.schoolNameY,
    colors.ink,
    R5_HEADER_GEOMETRY.textLeft,
    R5_HEADER_GEOMETRY.textWidth
  );
  const statusLine = academicHeaderStatusForPreview(identity);
  const approvedStatus = approvedSchoolStatusLine(identity);
  if (version === "R5") {
    const statusFont = approvedStatus ? assets.fonts.regular : assets.fonts.bold;
    centeredInHorizontalSpan(page, statusLine, statusFont, approvedStatus ? 9.5 : 8, R5_HEADER_GEOMETRY.statusLineY, colors.ink, R5_HEADER_GEOMETRY.textLeft, R5_HEADER_GEOMETRY.textWidth);
    centeredInHorizontalSpan(page, identity.addressLine1 + ", " + identity.city, assets.fonts.regular, 10.5, R5_HEADER_GEOMETRY.addressY, colors.ink, R5_HEADER_GEOMETRY.textLeft, R5_HEADER_GEOMETRY.textWidth);
    return;
  }
  const headerTypography = version === "R7" || version === "R8" ? R7_HEADER_TYPOGRAPHY : R6_HEADER_TYPOGRAPHY;
  const statusSize = approvedStatus ? headerTypography.statusFontSizePt : 8;
  const statusLines = wrapR6HeaderText(
    statusLine,
    R5_HEADER_GEOMETRY.textWidth,
    (text) => assets.fonts.bold.widthOfTextAtSize(text, statusSize)
  );
  const address = identity.addressLine1 + ", " + identity.city;
  const addressLines = wrapR6HeaderText(
    address,
    R5_HEADER_GEOMETRY.textWidth,
    (text) => assets.fonts.bold.widthOfTextAtSize(text, headerTypography.addressFontSizePt)
  );
  const statusStartY = statusLines.length === 1 ? R5_HEADER_GEOMETRY.statusLineY : R5_HEADER_GEOMETRY.statusLineY + 4.8;
  statusLines.forEach((line, index) => centeredInHorizontalSpan(
    page,
    line,
    assets.fonts.bold,
    statusSize,
    statusStartY - index * 10.4,
    colors.ink,
    R5_HEADER_GEOMETRY.textLeft,
    R5_HEADER_GEOMETRY.textWidth
  ));
  const addressStartY = addressLines.length === 1 ? R5_HEADER_GEOMETRY.addressY : R5_HEADER_GEOMETRY.addressY + 4.8;
  addressLines.forEach((line, index) => centeredInHorizontalSpan(
    page,
    line,
    assets.fonts.bold,
    headerTypography.addressFontSizePt,
    addressStartY - index * 10.8,
    colors.ink,
    R5_HEADER_GEOMETRY.textLeft,
    R5_HEADER_GEOMETRY.textWidth
  ));
}

function drawIdentity(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot) {
  const fontSize = Math.max(7.8, R4_MINIMUM_FONT_SIZES.identityValue);
  const rows = [
    [R5_IDENTITY_LABELS[0], report.studentName],
    [R5_IDENTITY_LABELS[1], report.guardianName],
    [R5_IDENTITY_LABELS[2], report.admissionNumber]
  ] as const;
  const twoColumnWidth = R5_IDENTITY_GRID_GEOMETRY.columnWidth * 2;
  const rowHeights = rows.map((row) => identityRowHeight(row, [twoColumnWidth, twoColumnWidth], fonts, fontSize));
  const finalRow = [R5_IDENTITY_LABELS[3], report.classSection, R5_IDENTITY_LABELS[4], report.rollNumber] as const;
  const finalRowHeight = identityRowHeight(finalRow, Array(4).fill(R5_IDENTITY_GRID_GEOMETRY.columnWidth), fonts, fontSize);
  const allHeights = [...rowHeights, finalRowHeight];
  const totalHeight = sum(allHeights);
  const x = R5_IDENTITY_GRID_GEOMETRY.left;
  const top = R5_HEADER_GEOMETRY.identityTop;
  const yTop = A4.height - top;
  const yBottom = yTop - totalHeight;

  rectTop(
    page,
    x,
    top,
    R5_IDENTITY_GRID_GEOMETRY.width,
    totalHeight,
    colors.white,
    colors.ink,
    R5_IDENTITY_GRID_GEOMETRY.borderWidth
  );
  let rowTop = top;
  rows.forEach((row, index) => {
    drawIdentityCellText(page, fonts.bold, row[0], x, rowTop, twoColumnWidth, rowHeights[index], fontSize, colors.ink);
    drawIdentityCellText(page, fonts.regular, row[1], x + twoColumnWidth, rowTop, twoColumnWidth, rowHeights[index], fontSize, colors.ink);
    rowTop += rowHeights[index];
    page.drawLine({
      start: { x, y: A4.height - rowTop },
      end: { x: x + R5_IDENTITY_GRID_GEOMETRY.width, y: A4.height - rowTop },
      thickness: R5_IDENTITY_GRID_GEOMETRY.borderWidth,
      color: colors.ink
    });
  });
  finalRow.forEach((value, index) => drawIdentityCellText(
    page,
    index % 2 === 0 ? fonts.bold : fonts.regular,
    value,
    x + index * R5_IDENTITY_GRID_GEOMETRY.columnWidth,
    rowTop,
    R5_IDENTITY_GRID_GEOMETRY.columnWidth,
    finalRowHeight,
    fontSize,
    colors.ink
  ));
  page.drawLine({
    start: { x: R5_IDENTITY_GRID_GEOMETRY.centreDividerX, y: yBottom },
    end: { x: R5_IDENTITY_GRID_GEOMETRY.centreDividerX, y: yTop },
    thickness: R5_IDENTITY_GRID_GEOMETRY.borderWidth,
    color: colors.ink
  });
  for (const dividerX of [
    x + R5_IDENTITY_GRID_GEOMETRY.columnWidth,
    x + R5_IDENTITY_GRID_GEOMETRY.columnWidth * 3
  ]) {
    page.drawLine({
      start: { x: dividerX, y: yBottom },
      end: { x: dividerX, y: yBottom + finalRowHeight },
      thickness: R5_IDENTITY_GRID_GEOMETRY.borderWidth,
      color: colors.ink
    });
  }
  return top + totalHeight;
}

function identityRowHeight(
  values: readonly string[],
  widths: readonly number[],
  fonts: Fonts,
  fontSize: number
) {
  const lines = values.map((value, index) => {
    const font = index % 2 === 0 ? fonts.bold : fonts.regular;
    const wrapped = wrapText(value, font, fontSize, widths[index] - 8);
    if (wrapped.length > 2) throw new Error("Identity value exceeds the approved two-line wrapping contract.");
    return wrapped.length;
  });
  return Math.max(16, 6 + Math.max(...lines) * (fontSize + 1));
}

function drawIdentityCellText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  top: number,
  width: number,
  height: number,
  fontSize: number,
  color: RGB
) {
  const lines = wrapText(value, font, fontSize, width - 8);
  if (lines.length > 2) throw new Error("Identity value exceeds the approved two-line wrapping contract.");
  const lineHeight = fontSize + 1;
  const blockHeight = lines.length * lineHeight;
  lines.forEach((line, index) => page.drawText(line, {
    x: x + Math.max(4, (width - font.widthOfTextAtSize(line, fontSize)) / 2),
    y: A4.height - top - (height - blockHeight) / 2 - fontSize - index * lineHeight,
    size: fontSize,
    font,
    color
  }));
}

function drawStandardTables(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot, top: number, r6 = false) {
  const dense = report.subjects.length > 10;
  const marksWidth = 332;
  const traitWidth = A4.width - 74 - marksWidth;
  const subjectWidth = 112;
  const gradeWidth = 42;
  const componentWidth = (
    marksWidth - subjectWidth - (report.showAcademicSubjectGrade ? gradeWidth : 0)
  ) / (report.componentColumns.length + 1);
  const widths = [
    subjectWidth,
    ...report.componentColumns.map(() => componentWidth),
    componentWidth,
    ...(report.showAcademicSubjectGrade ? [gradeWidth] : [])
  ];
  const totalMaximum = sum(report.componentColumns.map((column) => column.maximum));
  const headers = [
    "Subject",
    ...report.componentColumns.map((column) => column.label + "\n(" + formatNumber(column.maximum) + ")"),
    "Total\n(" + formatNumber(totalMaximum) + ")",
    ...(report.showAcademicSubjectGrade ? ["Grade"] : [])
  ];
  const rows = report.subjects.map((subject) => ({
    cells: standardSubjectCells(subject, report.componentColumns, report),
    bold: subject.aggregateOf.length > 0
  }));
  const traitRows = report.traits.map((trait, index) => ({
    cells: [trait, index % 7 === 4 ? "S" : "G"],
    bold: false
  }));
  const marksFontSize = dense ? 6.7 : 7.4;
  const traitFontSize = dense ? 6.7 : 7.2;
  const minimumRowHeight = r6 && dense ? 10.5 : dense ? 12 : 18;
  const balanced = report.traitTitle
    ? balancedTableRowHeights(
      fonts,
      rows,
      widths,
      marksFontSize,
      minimumRowHeight,
      traitRows,
      [traitWidth - 48, 48],
      traitFontSize,
      minimumRowHeight,
      r6 && dense ? 2 : 4
    )
    : { left: rows.map(() => minimumRowHeight), right: [] as number[] };
  const marksBottom = drawTable(page, fonts, colors, 37, top, widths, headers, rows, {
    headerHeight: r6 && dense ? 22 : dense ? 26 : 32,
    rowHeight: minimumRowHeight,
    rowHeights: balanced.left,
    fontSize: marksFontSize,
    firstColumnLeft: true,
    dynamicRows: true,
    sectionFill: colors.band,
    verticalPadding: r6 && dense ? 2 : undefined
  });
  let traitBottom = top;
  if (report.traitTitle) {
    traitBottom = drawTable(page, fonts, colors, 37 + marksWidth, top, [traitWidth - 48, 48], [report.traitTitle, "Grade"], traitRows, {
      headerHeight: r6 && dense ? 22 : dense ? 26 : 32,
      rowHeight: minimumRowHeight,
      rowHeights: balanced.right,
      fontSize: traitFontSize,
      firstColumnLeft: false,
      dynamicRows: true,
      verticalPadding: r6 && dense ? 2 : undefined
    });
  }
  const tablesBottom = Math.max(marksBottom, traitBottom);
  return report.traitTitle
    ? drawCoscholasticLegend(page, fonts, colors, tablesBottom)
    : tablesBottom;
}

function drawR8StandardTables(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  top: number,
  layout: R8MarksTableLayout
) {
  if (layout.mode === "NORMAL_MARKS_TABLE" || !layout.combineTraitAndGrade || !report.traitTitle) {
    return drawStandardTables(page, fonts, colors, report, top, true);
  }
  const fullWidth = A4.width - 74;
  const marksWidth = fullWidth * layout.academicWidthRatio;
  const traitWidth = fullWidth - marksWidth;
  const subjectWidth = Math.max(124, marksWidth * 0.38);
  const gradeWidth = report.showAcademicSubjectGrade ? 34 : 0;
  const resultColumnWidth = (marksWidth - subjectWidth - gradeWidth) / (report.componentColumns.length + 1);
  const widths = [
    subjectWidth,
    ...report.componentColumns.map(() => resultColumnWidth),
    resultColumnWidth,
    ...(report.showAcademicSubjectGrade ? [gradeWidth] : [])
  ];
  const totalMaximum = sum(report.componentColumns.map((column) => column.maximum));
  const headers = [
    "Subject",
    ...report.componentColumns.map((column) => `${column.label}\n(${formatNumber(column.maximum)})`),
    `Total\n(${formatNumber(totalMaximum)})`,
    ...(report.showAcademicSubjectGrade ? ["Grade"] : [])
  ];
  const rows = report.subjects.map((subject) => ({
    cells: standardSubjectCells(subject, report.componentColumns, report),
    bold: subject.aggregateOf.length > 0
  }));
  const traitRows = r8TraitGradeEntries(report).map((entry) => ({
    cells: [entry.displayText],
    bold: false
  }));
  const balanced = balancedTableRowHeights(
    fonts,
    rows,
    widths,
    layout.bodyFontSizePt,
    layout.minimumRowHeightPt,
    traitRows,
    [traitWidth],
    layout.bodyFontSizePt,
    layout.minimumRowHeightPt,
    3
  );
  const marksBottom = drawTable(page, fonts, colors, 37, top, widths, headers, rows, {
    headerHeight: 22,
    rowHeight: layout.minimumRowHeightPt,
    rowHeights: balanced.left,
    fontSize: Math.max(layout.bodyFontSizePt, layout.subjectFontSizePt, layout.headerFontSizePt),
    firstColumnLeft: true,
    dynamicRows: true,
    sectionFill: colors.band,
    verticalPadding: 3
  });
  const traitBottom = drawTable(page, fonts, colors, 37 + marksWidth, top, [traitWidth], ["Personality Development / Grade"], traitRows, {
    headerHeight: 22,
    rowHeight: layout.minimumRowHeightPt,
    rowHeights: balanced.right,
    fontSize: Math.max(6.5, layout.bodyFontSizePt),
    firstColumnLeft: true,
    dynamicRows: true,
    verticalPadding: 3
  });
  return drawCoscholasticLegend(page, fonts, colors, Math.max(marksBottom, traitBottom));
}

export function r8TraitGradeEntries(report: AcademicReportSnapshot) {
  return report.traits.map((trait, index) => ({
    canonicalTrait: trait,
    grade: index % 7 === 4 ? "S" : "G",
    displayText: `${trait}: ${index % 7 === 4 ? "S" : "G"}`
  }));
}

export function balanceRowHeightTotals(leftNatural: number[], rightNatural: number[]) {
  const leftTotal = sum(leftNatural);
  const rightTotal = sum(rightNatural);
  const target = Math.max(leftTotal, rightTotal);
  const pad = (values: number[], total: number) => values.length
    ? values.map((value) => value + (target - total) / values.length)
    : values;
  return { left: pad(leftNatural, leftTotal), right: pad(rightNatural, rightTotal), target };
}

function balancedTableRowHeights(
  fonts: Fonts,
  leftRows: Array<{ cells: string[]; bold: boolean }>,
  leftWidths: number[],
  leftFontSize: number,
  leftMinimum: number,
  rightRows: Array<{ cells: string[]; bold: boolean }>,
  rightWidths: number[],
  rightFontSize: number,
  rightMinimum: number,
  verticalPadding = 4
) {
  const heights = (rows: Array<{ cells: string[]; bold: boolean }>, widths: number[], size: number, minimum: number) => rows.map((row) => {
    const font = row.bold ? fonts.bold : fonts.regular;
    const lines = row.cells.map((value, index) => wrapText(String(value), font, size, widths[index] - 6).length);
    return Math.max(minimum, verticalPadding + Math.max(...lines) * (size + 1));
  });
  return balanceRowHeightTotals(
    heights(leftRows, leftWidths, leftFontSize, leftMinimum),
    heights(rightRows, rightWidths, rightFontSize, rightMinimum)
  );
}

function drawCoscholasticLegend(page: PDFPage, fonts: Fonts, colors: Palette, top: number) {
  const width = A4.width - 74;
  const height = 19;
  rectTop(page, 37, top, width, height, colors.white, colors.border, 0.55);
  const size = 7.2;
  const textWidth = fonts.bold.widthOfTextAtSize(R5_COSCHOLASTIC_LEGEND, size);
  page.drawText(R5_COSCHOLASTIC_LEGEND, {
    x: 37 + (width - textWidth) / 2,
    y: A4.height - top - 13,
    size,
    font: fonts.bold,
    color: colors.ink
  });
  return top + height;
}

function drawCombinedTable(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot, top: number, r6 = false) {
  const scheme = report.combinedScheme;
  if (!scheme) throw new Error("Combined report requires its frozen examination scheme.");
  const totalMaximum = scheme.ctWeight + scheme.terminalWeight + scheme.annualWeight;
  const columns = [
    `${scheme.ctLabel} 1\n(${formatNumber(scheme.ctMaximum)})`,
    `I.A. 1\n(${formatNumber(scheme.internalAssessmentMaximum)})`,
    `${scheme.ctLabel} 2\n(${formatNumber(scheme.ctMaximum)})`,
    `I.A. 2\n(${formatNumber(scheme.internalAssessmentMaximum)})`,
    `${scheme.ctLabel} 3\n(${formatNumber(scheme.ctMaximum)})`,
    `I.A. 3\n(${formatNumber(scheme.internalAssessmentMaximum)})`,
    `${scheme.ctLabel} Wt.\n(${formatNumber(scheme.ctWeight)})`,
    `${scheme.terminalLabel}\n(${formatNumber(scheme.terminalMaximum)})`,
    `${scheme.terminalLabel} Wt.\n(${formatNumber(scheme.terminalWeight)})`,
    `${scheme.annualLabel}\n(${formatNumber(scheme.annualMaximum)})`,
    `${scheme.annualLabel} Wt.\n(${formatNumber(scheme.annualWeight)})`,
    `Total\n(${formatNumber(totalMaximum)})`, "Grade", "G.P."
  ];
  const subjectWidth = 118;
  const remaining = A4.width - 74 - subjectWidth;
  const widths = [subjectWidth, ...columns.map(() => remaining / columns.length)];
  const rows = report.subjects.map((subject) => ({
    cells: combinedSubjectCells(subject),
    bold: subject.aggregateOf.length > 0
  }));
  let bottom = drawTable(page, fonts, colors, 37, top, widths, ["Subject", ...columns], rows, {
    headerHeight: r6 ? 24 : 32,
    rowHeight: r6 ? 10.5 : 14,
    fontSize: Math.max(6.4, R4_MINIMUM_FONT_SIZES.denseClassIxTable),
    firstColumnLeft: true,
    dynamicRows: true,
    sectionFill: colors.band,
    verticalPadding: r6 ? 2 : undefined
  });
  const legend = `${scheme.ctLabel} = ${scheme.ctFullLabel};   I.A. = ${scheme.internalAssessmentLabel};   Wt. = weighted contribution;   ${scheme.terminalLabel} = ${scheme.terminalFullLabel};   G.P. = Grade Point`;
  bottom = drawWrappedBox(page, fonts.regular, colors, 37, bottom, A4.width - 74, legend, 6.8, 18);
  return bottom;
}

function drawR8CombinedTable(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  top: number,
  layout: R8MarksTableLayout
) {
  const scheme = report.combinedScheme;
  if (!scheme) throw new Error("Combined report requires its frozen examination scheme.");
  const totalMaximum = scheme.ctWeight + scheme.terminalWeight + scheme.annualWeight;
  const columns = [
    `${scheme.ctLabel} 1\n(${formatNumber(scheme.ctMaximum)})`, `I.A. 1\n(${formatNumber(scheme.internalAssessmentMaximum)})`,
    `${scheme.ctLabel} 2\n(${formatNumber(scheme.ctMaximum)})`, `I.A. 2\n(${formatNumber(scheme.internalAssessmentMaximum)})`,
    `${scheme.ctLabel} 3\n(${formatNumber(scheme.ctMaximum)})`, `I.A. 3\n(${formatNumber(scheme.internalAssessmentMaximum)})`,
    `${scheme.ctLabel} Wt.\n(${formatNumber(scheme.ctWeight)})`, `${scheme.terminalLabel}\n(${formatNumber(scheme.terminalMaximum)})`,
    `${scheme.terminalLabel} Wt.\n(${formatNumber(scheme.terminalWeight)})`, `${scheme.annualLabel}\n(${formatNumber(scheme.annualMaximum)})`,
    `${scheme.annualLabel} Wt.\n(${formatNumber(scheme.annualWeight)})`, `Total\n(${formatNumber(totalMaximum)})`, "Grade", "G.P."
  ];
  const subjectWidth = 122;
  const remaining = A4.width - 74 - subjectWidth;
  const widths = [subjectWidth, ...columns.map(() => remaining / columns.length)];
  const rows = report.subjects.map((subject) => ({ cells: combinedSubjectCells(subject), bold: subject.aggregateOf.length > 0 }));
  const fontSize = Math.max(layout.bodyFontSizePt, layout.subjectFontSizePt, layout.headerFontSizePt);
  let bottom = drawTable(page, fonts, colors, 37, top, widths, ["Subject", ...columns], rows, {
    headerHeight: 22,
    rowHeight: layout.minimumRowHeightPt,
    fontSize,
    firstColumnLeft: true,
    dynamicRows: true,
    sectionFill: colors.band,
    verticalPadding: 2
  });
  const legend = `${scheme.ctLabel} = ${scheme.ctFullLabel}; I.A. = ${scheme.internalAssessmentLabel}; Wt. = weighted contribution; ${scheme.terminalLabel} = ${scheme.terminalFullLabel}; G.P. = Grade Point`;
  bottom = drawWrappedBox(page, fonts.regular, colors, 37, bottom, A4.width - 74, legend, 6.5, 17);
  return bottom;
}

function standardSubjectCells(
  subject: AcademicSubjectSnapshot,
  columns: AcademicReportSnapshot["componentColumns"],
  report: AcademicReportSnapshot
) {
  if (subject.kind === "GRADE_ONLY") {
    const displayedGrade = subject.state === "PRESENT" ? subject.grade || "NA" : resultStateCode(subject.state);
    return report.showAcademicSubjectGrade
      ? [subject.label, ...columns.map(() => ""), "Grade", displayedGrade]
      : [subject.label, ...columns.map(() => ""), "Grade: " + displayedGrade];
  }
  if (subject.kind === "COMBINED") return [subject.label];
  if (subject.kind === "DERIVED") {
    const cells = [
      subject.label,
      ...columns.map((column) => formatDerivedComponentForReport(report, subject, column.key)),
      formatParentFacingNumber(displayedSubjectTotalValue(subject, report) ?? subject.total.value)
    ];
    if (report.showAcademicSubjectGrade) cells.push(subject.grade);
    return cells;
  }
  const cells = [
    subject.label,
    ...columns.map((column) => {
      const component = subject.components.find((candidate) => candidate.key === column.key);
      return component ? displayComponent(component) : "N/A";
    }),
    subject.total.state === "PRESENT"
      ? formatParentFacingNumber(displayedSubjectTotalValue(subject, report) ?? Number(subject.total.value))
      : resultStateCode(subject.total.state)
  ];
  if (report.showAcademicSubjectGrade) cells.push(subject.grade);
  return cells;
}

function combinedSubjectCells(subject: AcademicSubjectSnapshot) {
  if (subject.kind !== "COMBINED") {
    const grade = subject.kind === "GRADE_ONLY"
      ? subject.state === "PRESENT" ? subject.grade || "NA" : resultStateCode(subject.state)
      : subject.grade;
    return [subject.label, ...Array.from({ length: 12 }, () => "NA"), grade, "NA"];
  }
  const value = subject.combined;
  return [
    subject.label,
    formatParentFacingNumber(value.ct1), formatParentFacingNumber(value.ia1), formatParentFacingNumber(value.ct2), formatParentFacingNumber(value.ia2),
    formatParentFacingNumber(value.ct3), formatParentFacingNumber(value.ia3), formatParentFacingNumber(value.ctWeighted),
    formatParentFacingNumber(value.terminalRaw), formatParentFacingNumber(value.terminalWeighted), formatParentFacingNumber(value.annualRaw),
    formatParentFacingNumber(value.annualWeighted), formatParentFacingNumber(displayedSubjectTotalValue(subject) ?? subject.total.value), subject.grade,
    formatParentFacingNumber(value.gradePoint)
  ];
}

function drawSummary(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot, top: number) {
  const values = [
    "Total: " + formatParentFacingNumber(displayedOverallTotal(report)) + " / " + formatParentFacingNumber(report.overall.maximum),
    "Percentage: " + formatParentFacingNumber(displayedOverallPercentage(report)) + "%",
    "Grade: " + report.overall.grade,
    ...(report.overall.gradePoint == null ? [] : ["Grade Point: " + formatParentFacingNumber(report.overall.gradePoint)]),
    ...(report.overall.rank == null ? [] : ["Rank: " + report.overall.rank])
  ];
  return drawTable(page, fonts, colors, 37, top, values.map(() => (A4.width - 74) / values.length), [], [
    { cells: values, bold: true }
  ], {
    headerHeight: 0,
    rowHeight: 20,
    fontSize: 8,
    firstColumnLeft: false,
    dynamicRows: true,
    sectionFill: colors.band
  });
}

function drawAttendance(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot, top: number) {
  return drawTable(page, fonts, colors, 37, top, [173.75, 173.75, 173.5], ["Working Days", "Days Present", "Attendance Percentage"], [
    { cells: [
      String(report.attendance.workingDays),
      String(report.attendance.daysPresent),
      formatParentFacingNumber(report.attendance.percentage) + "%"
    ], bold: false }
  ], {
    headerHeight: 16,
    rowHeight: 15,
    fontSize: 7.5,
    firstColumnLeft: false
  });
}

function drawRemarks(page: PDFPage, fonts: Fonts, colors: Palette, remarks: string, top: number) {
  const lines = wrapText(remarks, fonts.regular, 7.5, 390);
  const height = Math.max(37, 12 + lines.length * 9);
  rectTop(page, 37, top, A4.width - 74, height, colors.white, colors.border, 0.7);
  page.drawText("General Remarks:", { x: 42, y: A4.height - top - 14, size: 8, font: fonts.bold, color: colors.ink });
  lines.forEach((line, index) => page.drawText(line, {
    x: 126, y: A4.height - top - 14 - index * 9, size: 7.5, font: fonts.regular, color: colors.ink
  }));
  return top + height;
}

function drawR6SummaryAttendanceRemarks(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  top: number
) {
  const gap = 6;
  const totalWidth = A4.width - 74;
  const leftWidth = 282;
  const rightWidth = totalWidth - leftWidth - gap;
  const leftX = 37;
  const rightX = leftX + leftWidth + gap;
  const summaryValues = [
    "Total: " + formatParentFacingNumber(displayedOverallTotal(report)) + " / " + formatParentFacingNumber(report.overall.maximum),
    "Percentage: " + formatParentFacingNumber(displayedOverallPercentage(report)) + "%",
    "Grade: " + report.overall.grade,
    ...(report.overall.gradePoint == null ? [] : ["Grade Point: " + formatParentFacingNumber(report.overall.gradePoint)]),
    ...(report.overall.rank == null ? [] : ["Rank: " + report.overall.rank])
  ];
  const summaryBottom = drawWrappedBox(page, fonts.bold, colors, leftX, top, leftWidth, summaryValues.join("    "), 7.2, 22);
  const attendanceBottom = drawTable(page, fonts, colors, leftX, summaryBottom + 3, [leftWidth / 3, leftWidth / 3, leftWidth / 3], ["Working Days", "Days Present", "Attendance %"], [{
    cells: [String(report.attendance.workingDays), String(report.attendance.daysPresent), formatParentFacingNumber(report.attendance.percentage) + "%"],
    bold: false
  }], {
    headerHeight: 14,
    rowHeight: 13,
    fontSize: 6.8,
    firstColumnLeft: false
  });
  const bandBottom = attendanceBottom;
  const bandHeight = bandBottom - top;
  rectTop(page, rightX, top, rightWidth, bandHeight, colors.white, colors.border, 0.7);
  page.drawText("General Remarks:", { x: rightX + 5, y: A4.height - top - 13, size: 7.6, font: fonts.bold, color: colors.ink });
  const remarkLines = wrapText(report.remarks, fonts.regular, 7, rightWidth - 10);
  const availableLines = Math.floor((bandHeight - 20) / 8);
  if (remarkLines.length > availableLines) throw new Error("R6 remarks cannot fit without shrinking or truncation.");
  remarkLines.forEach((line, index) => page.drawText(line, { x: rightX + 5, y: A4.height - top - 24 - index * 8, size: 7, font: fonts.regular, color: colors.ink }));
  return bandBottom;
}

export function r7SummaryMetrics(report: AcademicReportSnapshot) {
  return [
    { label: "Total", value: `${formatParentFacingNumber(displayedOverallTotal(report))} / ${formatParentFacingNumber(report.overall.maximum)}` },
    { label: "Percentage", value: `${formatParentFacingNumber(displayedOverallPercentage(report))}%` },
    { label: "Grade", value: report.overall.grade },
    ...(report.overall.gradePoint == null ? [] : [{ label: "Grade Point", value: formatParentFacingNumber(report.overall.gradePoint) }]),
    ...(report.overall.rank == null ? [] : [{ label: "Rank", value: String(report.overall.rank) }])
  ];
}

function drawR7SummaryAttendanceRemarks(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  top: number,
  mode: RefinedColourMode
) {
  const totalWidth = A4.width - 74;
  const x = 37;
  const metrics = r7SummaryMetrics(report);
  if (metrics.length < 3 || metrics.length > 5) throw new Error("R7 summary-card grid requires three, four or five configured metrics.");
  const totalWeight = metrics.reduce((value, metric) => value + (metric.label === "Total" ? 1.15 : 1), 0);
  let cursorX = x;
  metrics.forEach((metric, index) => {
    const weight = metric.label === "Total" ? 1.15 : 1;
    const width = index === metrics.length - 1 ? x + totalWidth - cursorX : totalWidth * weight / totalWeight;
    rectTop(page, cursorX, top, width, R7_SUMMARY_CARD_GEOMETRY.heightPt, mode === "MONOCHROME" ? colors.white : colors.band, colors.border, 0.7);
    centeredInHorizontalSpan(page, metric.label, fonts.bold, R7_SUMMARY_CARD_GEOMETRY.labelFontSizePt, A4.height - top - 12, colors.ink, cursorX, width);
    centeredInHorizontalSpan(page, metric.value, fonts.bold, R7_SUMMARY_CARD_GEOMETRY.valueFontSizePt, A4.height - top - 27, colors.ink, cursorX, width);
    cursorX += width;
  });

  const rowTop = top + R7_SUMMARY_CARD_GEOMETRY.heightPt + 3;
  const rowHeight = R7_SUMMARY_CARD_GEOMETRY.attendanceRemarksHeightPt;
  const gap = 6;
  const attendanceWidth = (totalWidth - gap) * R7_SUMMARY_CARD_GEOMETRY.attendanceWidthRatio;
  const remarksWidth = totalWidth - gap - attendanceWidth;
  const remarksX = x + attendanceWidth + gap;
  const attendanceHeaders = ["Working Days", "Days Present", "Attendance %"];
  const cellWidth = attendanceWidth / attendanceHeaders.length;
  attendanceHeaders.forEach((label, index) => {
    const cellX = x + index * cellWidth;
    rectTop(page, cellX, rowTop, cellWidth, 17, colors.band, colors.border, 0.7);
    centeredInHorizontalSpan(page, label, fonts.bold, 6.8, A4.height - rowTop - 12, colors.ink, cellX, cellWidth);
    rectTop(page, cellX, rowTop + 17, cellWidth, rowHeight - 17, colors.white, colors.border, 0.7);
  });
  const attendanceValues = [String(report.attendance.workingDays), String(report.attendance.daysPresent), `${formatParentFacingNumber(report.attendance.percentage)}%`];
  attendanceValues.forEach((value, index) => centeredInHorizontalSpan(page, value, fonts.bold, 8, A4.height - rowTop - 32, colors.ink, x + index * cellWidth, cellWidth));

  rectTop(page, remarksX, rowTop, remarksWidth, rowHeight, colors.white, colors.border, 0.7);
  page.drawText("General Remarks", { x: remarksX + 5, y: A4.height - rowTop - 12, size: 7.4, font: fonts.bold, color: colors.ink });
  const remarkLines = wrapText(report.remarks, fonts.regular, 7, remarksWidth - 10);
  if (remarkLines.length > 2) throw new Error("R7 General Remarks cannot fit the balanced row without truncation.");
  remarkLines.forEach((line, index) => page.drawText(line, { x: remarksX + 5, y: A4.height - rowTop - 23 - index * 8, size: 7, font: fonts.regular, color: colors.ink }));
  return rowTop + rowHeight;
}

export function r8SummaryMetrics(report: AcademicReportSnapshot) {
  return r7SummaryMetrics(report).map((metric) => ({ ...metric, text: `${metric.label}: ${metric.value}` }));
}

export function resolveR8SummaryWidths(
  metrics: ReturnType<typeof r8SummaryMetrics>,
  totalWidth: number,
  measure: (text: string) => number,
  horizontalPaddingPt = R8_SUMMARY_GEOMETRY.horizontalPaddingPt
) {
  if (metrics.length < 3 || metrics.length > 5) throw new Error("R8 summary grid requires three, four or five configured metrics.");
  const priorities: Record<string, number> = { Total: 2, Percentage: 1.25, Grade: 0.65, "Grade Point": 1.3, Rank: 0.55 };
  const minimumWidths = metrics.map((metric) => measure(metric.text) + horizontalPaddingPt);
  const minimumTotal = sum(minimumWidths);
  if (minimumTotal > totalWidth + EPSILON) throw new Error("R8 summary metrics cannot remain on one line at the approved minimum font size.");
  const remaining = totalWidth - minimumTotal;
  const priorityTotal = sum(metrics.map((metric) => priorities[metric.label] ?? 1));
  const widths = metrics.map((metric, index) => minimumWidths[index] + remaining * (priorities[metric.label] ?? 1) / priorityTotal);
  widths[widths.length - 1] += totalWidth - sum(widths);
  return widths;
}

function drawR8SummaryAttendanceRemarks(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  top: number,
  mode: RefinedColourMode
) {
  const totalWidth = A4.width - 74;
  const x = 37;
  const metrics = r8SummaryMetrics(report);
  const widths = resolveR8SummaryWidths(
    metrics,
    totalWidth,
    (text) => fonts.bold.widthOfTextAtSize(text, R8_SUMMARY_GEOMETRY.fontSizePt)
  );
  let cursorX = x;
  metrics.forEach((metric, index) => {
    const width = widths[index];
    const renderedWidth = fonts.bold.widthOfTextAtSize(metric.text, R8_SUMMARY_GEOMETRY.fontSizePt);
    if (renderedWidth + R8_SUMMARY_GEOMETRY.horizontalPaddingPt > width + EPSILON) {
      throw new Error(`R8 summary metric cannot fit without wrapping: ${metric.text}`);
    }
    rectTop(page, cursorX, top, width, R8_SUMMARY_GEOMETRY.heightPt, mode === "MONOCHROME" ? colors.white : colors.band, colors.border, 0.7);
    centeredInHorizontalSpan(page, metric.text, fonts.bold, R8_SUMMARY_GEOMETRY.fontSizePt, A4.height - top - 14, colors.ink, cursorX, width);
    cursorX += width;
  });

  const rowTop = top + R8_SUMMARY_GEOMETRY.heightPt + 3;
  const rowHeight = R8_SUMMARY_GEOMETRY.attendanceRemarksHeightPt;
  const gap = 6;
  const attendanceWidth = (totalWidth - gap) * R8_SUMMARY_GEOMETRY.attendanceWidthRatio;
  const remarksWidth = totalWidth - gap - attendanceWidth;
  const remarksX = x + attendanceWidth + gap;
  const attendanceHeaders = ["Working Days", "Days Present", "Attendance %"];
  const cellWidth = attendanceWidth / attendanceHeaders.length;
  const headerHeight = 15;
  attendanceHeaders.forEach((label, index) => {
    const cellX = x + index * cellWidth;
    rectTop(page, cellX, rowTop, cellWidth, headerHeight, colors.band, colors.border, 0.7);
    centeredInHorizontalSpan(page, label, fonts.bold, 6.6, A4.height - rowTop - 10.8, colors.ink, cellX, cellWidth);
    rectTop(page, cellX, rowTop + headerHeight, cellWidth, rowHeight - headerHeight, colors.white, colors.border, 0.7);
  });
  const attendanceValues = [String(report.attendance.workingDays), String(report.attendance.daysPresent), `${formatParentFacingNumber(report.attendance.percentage)}%`];
  attendanceValues.forEach((value, index) => centeredInHorizontalSpan(page, value, fonts.bold, 7.8, A4.height - rowTop - 28, colors.ink, x + index * cellWidth, cellWidth));
  rectTop(page, remarksX, rowTop, remarksWidth, rowHeight, colors.white, colors.border, 0.7);
  page.drawText("General Remarks", { x: remarksX + 5, y: A4.height - rowTop - 11, size: 7.2, font: fonts.bold, color: colors.ink });
  const remarkLines = wrapText(report.remarks, fonts.regular, 6.8, remarksWidth - 10);
  if (remarkLines.length > 2) throw new Error("R8 General Remarks cannot fit the compact aligned row without truncation.");
  remarkLines.forEach((line, index) => page.drawText(line, { x: remarksX + 5, y: A4.height - rowTop - 21 - index * 7.8, size: 6.8, font: fonts.regular, color: colors.ink }));
  return rowTop + rowHeight;
}

function drawChart(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  x: number,
  top: number,
  width: number,
  height: number,
  mode: RefinedColourMode
) {
  rectTop(page, x, top, width, height, colors.white, colors.border, 0.7);
  const bottom = A4.height - top - height + 24;
  const left = x + 20;
  const chartWidth = width - 28;
  const chartHeight = height - 49;
  const numericHeadroom = chartHeight >= 31 ? 21 : Math.max(10, chartHeight - 8);
  const plotHeight = chartHeight - numericHeadroom;
  if (plotHeight < 5) throw new Error("Chart height cannot preserve readable bars and numeric-label headroom.");
  page.drawText("Student Marks (%)", { x: x + 8, y: A4.height - top - 16, size: 9, font: fonts.bold, color: colors.ink });
  const series = chartSeries(colors);
  drawChartLegend(page, fonts, colors, x, top, width, mode, series);
  for (let tick = 0; tick <= 100; tick += 20) {
    const y = bottom + plotHeight * tick / 100;
    page.drawLine({ start: { x: left, y }, end: { x: left + chartWidth, y }, thickness: 0.35, color: colors.grid, dashArray: [2, 2] });
    page.drawText(String(tick), { x: left - 18, y: y - 2, size: R4_MINIMUM_FONT_SIZES.chartLabel, font: fonts.regular, color: colors.ink });
  }
  const categoryLayout = resolveChartCategoryLayout(
    report.chartPoints,
    chartWidth,
    (text) => fonts.regular.widthOfTextAtSize(text, R4_MINIMUM_FONT_SIZES.chartLabel)
  );
  const numericInputs: ChartNumericLabelInput[] = [];
  categoryLayout.categories.forEach(({ point, lines }, index) => {
    const slot = categoryLayout.slot;
    const values = [point.studentPercentage, point.classAveragePercentage, point.highScorePercentage];
    const displayedValues = formatChartNumericValues(values);
    values.forEach((value, seriesIndex) => {
      const barWidth = Math.max(4.8, Math.min(8.5, slot / 4.5));
      const barGap = Math.max(1, Math.min(1.8, slot / 30));
      const clusterWidth = barWidth * 3 + barGap * 2;
      const barX = left + index * slot + (slot - clusterWidth) / 2 + seriesIndex * (barWidth + barGap);
      const barHeight = plotHeight * value / 100;
      drawPatternedRectangle(page, {
        x: barX, y: bottom, width: barWidth, height: barHeight
      }, series[seriesIndex].color, colors.ink, mode === "MONOCHROME" ? series[seriesIndex].pattern : "SOLID");
      numericInputs.push({
        text: displayedValues[seriesIndex],
        centerX: barX + barWidth / 2,
        barTopY: bottom + barHeight,
        staggerLevel: seriesIndex === 1 ? 1 : 0,
        horizontalStaggerPt: 0
      });
    });
    lines.forEach((line, lineIndex) => page.drawText(line, {
      x: left + index * slot + (slot - fonts.regular.widthOfTextAtSize(line, R4_MINIMUM_FONT_SIZES.chartLabel)) / 2,
      y: bottom - 9 - lineIndex * 7,
      size: R4_MINIMUM_FONT_SIZES.chartLabel,
      font: fonts.regular,
      color: colors.ink
    }));
  });
  const numericLabels = layoutChartNumericLabels(
    numericInputs,
    { left, right: left + chartWidth, bottom: bottom + 1, top: bottom + chartHeight - 1 },
    R5_CHART_NUMERIC_LABEL_FONT_SIZE,
    (text) => fonts.bold.widthOfTextAtSize(text, R5_CHART_NUMERIC_LABEL_FONT_SIZE)
  );
  numericLabels.forEach((label) => {
    if (label.leaderLine) {
      page.drawLine({
        start: { x: label.anchorX, y: label.anchorY + 0.8 },
        end: { x: label.x + label.width / 2, y: label.y - 0.8 },
        thickness: 0.35,
        color: colors.ink
      });
    }
    page.drawRectangle({
      x: label.x - 1.1,
      y: label.y - 0.8,
      width: label.width + 2.2,
      height: label.height + 1.6,
      color: colors.white,
      opacity: 0.96
    });
    page.drawText(label.text, {
      x: label.x,
      y: label.y,
      size: R5_CHART_NUMERIC_LABEL_FONT_SIZE,
      font: fonts.bold,
      color: colors.ink
    });
  });
  if (!categoryLayout.categories.length) {
    centeredInBox(page, ["Chart unavailable: no subject label fits without word loss."], fonts.regular, R4_MINIMUM_FONT_SIZES.legend, {
      x: left, y: bottom, width: chartWidth, height: chartHeight
    }, colors.ink);
  }
  if (!categoryLayout.omitted.length) return top + height;
  const omittedNames = categoryLayout.omitted.map((point) => point.subjectLabel).join("; ");
  return drawWrappedBox(
    page,
    fonts.regular,
    colors,
    x,
    top + height,
    width,
    "Chart scope: omitted for label legibility - " + omittedNames + ". Complete results remain in the marks table.",
    R4_MINIMUM_FONT_SIZES.legend,
    18
  );
}

function drawR6Chart(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  report: AcademicReportSnapshot,
  x: number,
  top: number,
  width: number,
  height: number,
  mode: RefinedColourMode,
  layout: R6ChartLayout,
  version: "R6" | "R7" | "R8" = "R6"
) {
  rectTop(page, x, top, width, height, colors.white, colors.border, 0.7);
  page.drawText("Student Marks (%)", {
    x: x + 8,
    y: A4.height - top - 16,
    size: 9,
    font: fonts.bold,
    color: colors.ink
  });
  const series = r6ChartSeries(colors, mode);
  drawR6ChartLegend(page, fonts, colors, x, top, width, mode, series, layout.mode === "DENSE_ACADEMIC_CHART", version);
  const outerBottom = A4.height - top - height;
  const headerHeight = layout.mode === "DENSE_ACADEMIC_CHART" ? 28 : 31;
  const contentTop = A4.height - top - headerHeight;
  const contentBottom = outerBottom + 4;
  const rowGap = layout.rows === 2 ? (version === "R8" ? R8_CHART_GEOMETRY.twoRowGapPt : 8) : 0;
  const rowSlotHeight = (contentTop - contentBottom - rowGap * (layout.rows - 1)) / layout.rows;
  const subjectLabelReserve = layout.rows === 2 ? 18 : 22;
  const numericHeadroom = 14;
  const chartLeft = x + 20;
  const chartWidth = width - 28;
  const numericFontSize = R6_DENSE_CHART_GEOMETRY.numericLabelFontSizePt;
  const subjectFontSize = layout.mode === "DENSE_ACADEMIC_CHART"
    ? R6_DENSE_CHART_GEOMETRY.subjectLabelFontSizePt
    : R4_MINIMUM_FONT_SIZES.chartLabel;

  layout.categoryRows.forEach((points, rowIndex) => {
    if (!points.length) return;
    const rowTop = contentTop - rowIndex * (rowSlotHeight + rowGap);
    const rowBottom = rowTop - rowSlotHeight;
    const barBottom = rowBottom + subjectLabelReserve;
    const plotHeight = rowSlotHeight - subjectLabelReserve - numericHeadroom;
    if (plotHeight < 42) throw new Error("R6 dense chart cannot preserve a readable common 0-100 scale.");
    for (let tick = 0; tick <= 100; tick += 20) {
      const y = barBottom + plotHeight * tick / 100;
      page.drawLine({
        start: { x: chartLeft, y },
        end: { x: chartLeft + chartWidth, y },
        thickness: tick === 0 ? 0.7 : 0.35,
        color: colors.grid,
        dashArray: tick === 0 ? undefined : [2, 2]
      });
      page.drawText(String(tick), {
        x: chartLeft - 18,
        y: y - 2,
        size: R4_MINIMUM_FONT_SIZES.chartLabel,
        font: fonts.regular,
        color: colors.ink
      });
    }
    const slot = chartWidth / points.length;
    const barGap = Math.max(1.2, Math.min(1.8, slot / 28));
    const maximumClusterWidth = slot - R6_DENSE_CHART_GEOMETRY.minimumGroupGapPt;
    const barWidth = Math.min(8.5, (maximumClusterWidth - barGap * 2) / 3);
    if (barWidth < 4.5) throw new Error("R6 chart category spacing is below the governed print minimum.");
    const numericInputs: ChartNumericLabelInput[] = [];
    points.forEach((point, categoryIndex) => {
      const displayText = resolveChartDisplayText(point);
      const wrapped = wrapCompleteChartLabel(displayText, Math.max(1, slot - 3), (text) => fonts.regular.widthOfTextAtSize(text, subjectFontSize), 3);
      if (!wrapped.complete) throw new Error(`R6 chart label cannot fit without word loss: ${displayText}`);
      const values = [point.studentPercentage, point.classAveragePercentage, point.highScorePercentage];
      const labels = formatChartNumericValues(values);
      const clusterWidth = barWidth * 3 + barGap * 2;
      const clusterX = chartLeft + categoryIndex * slot + (slot - clusterWidth) / 2;
      values.forEach((value, seriesIndex) => {
        const barX = clusterX + seriesIndex * (barWidth + barGap);
        const barHeight = plotHeight * value / 100;
        drawR6PatternedRectangle(page, { x: barX, y: barBottom, width: barWidth, height: barHeight }, series[seriesIndex].color, colors.ink, mode === "MONOCHROME" ? series[seriesIndex].pattern : "SOLID", version);
        numericInputs.push({
          text: labels[seriesIndex],
          centerX: barX + barWidth / 2,
          barTopY: barBottom + barHeight,
          staggerLevel: seriesIndex === 1 ? 1 : 0,
          horizontalStaggerPt: 0
        });
      });
      wrapped.lines.forEach((line, lineIndex) => page.drawText(line, {
        x: chartLeft + categoryIndex * slot + (slot - fonts.regular.widthOfTextAtSize(line, subjectFontSize)) / 2,
        y: barBottom - 8 - lineIndex * (subjectFontSize + 1),
        size: subjectFontSize,
        font: fonts.regular,
        color: colors.ink
      }));
    });
    const placements = layoutChartNumericLabels(
      numericInputs,
      { left: chartLeft, right: chartLeft + chartWidth, bottom: barBottom + 1, top: rowTop - 1 },
      numericFontSize,
      (text) => fonts.bold.widthOfTextAtSize(text, numericFontSize)
    );
    placements.forEach((label) => drawR6NumericLabel(page, fonts, colors, label, numericFontSize));
  });
  return top + height;
}

function drawR6NumericLabel(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  label: ChartNumericLabelPlacement,
  fontSize: number
) {
  if (label.leaderLine) page.drawLine({
    start: { x: label.anchorX, y: label.anchorY + 0.8 },
    end: { x: label.x + label.width / 2, y: label.y - 0.8 },
    thickness: 0.35,
    color: colors.ink
  });
  page.drawRectangle({
    x: label.x - 1.1,
    y: label.y - 0.8,
    width: label.width + 2.2,
    height: label.height + 1.6,
    color: colors.white,
    opacity: 0.97
  });
  page.drawText(label.text, { x: label.x, y: label.y, size: fontSize, font: fonts.bold, color: colors.ink });
}

function r6ChartSeries(colors: Palette, mode: RefinedColourMode) {
  return [
    { ...R6_CHART_SERIES[0], color: mode === "MONOCHROME" ? rgb(R6_MONOCHROME_STUDENT_GREY, R6_MONOCHROME_STUDENT_GREY, R6_MONOCHROME_STUDENT_GREY) : colors.student, pattern: R6_CHART_SERIES[0].monochromePattern },
    { ...R6_CHART_SERIES[1], color: colors.average, pattern: R6_CHART_SERIES[1].monochromePattern },
    { ...R6_CHART_SERIES[2], color: colors.high, pattern: R6_CHART_SERIES[2].monochromePattern }
  ];
}

function drawR6ChartLegend(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  width: number,
  mode: RefinedColourMode,
  series: ReturnType<typeof r6ChartSeries>,
  dense: boolean,
  version: "R6" | "R7" | "R8" = "R6"
) {
  const geometry = dense ? R6_CHART_LEGEND_GEOMETRY.dense : R6_CHART_LEGEND_GEOMETRY.normal;
  const legendLeft = x + (dense ? 98 : 108);
  const itemWidth = (width - (dense ? 104 : 116)) / series.length;
  const swatchY = A4.height - top - (dense ? 19 : 22);
  series.forEach((item, index) => {
    const box = { x: legendLeft + index * itemWidth, y: swatchY, width: geometry.swatchWidthPt, height: geometry.swatchHeightPt };
    drawR6PatternedRectangle(page, box, item.color, colors.ink, mode === "MONOCHROME" ? item.pattern : "SOLID", version);
    page.drawText(item.label, {
      x: box.x + box.width + geometry.gapPt,
      y: box.y + (box.height - geometry.labelFontSizePt) / 2 + 0.5,
      size: geometry.labelFontSizePt,
      font: fonts.bold,
      color: colors.ink
    });
  });
}

function drawR6PatternedRectangle(
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number },
  fill: RGB,
  ink: RGB,
  pattern: R6ChartPattern,
  version: "R6" | "R7" | "R8" = "R6"
) {
  if (box.width <= 0 || box.height <= 0) return;
  const geometry = version === "R7" || version === "R8" ? R7_PATTERN_GEOMETRY : R6_PATTERN_GEOMETRY;
  page.drawRectangle({
    ...box,
    color: pattern === "SOLID" || pattern === "SOLID_GREY" ? fill : rgb(1, 1, 1),
    borderColor: ink,
    borderWidth: geometry.borderWidthPt
  });
  if (pattern === "DIAGONAL") {
    for (let intercept = -box.width; intercept <= box.height; intercept += geometry.slashSpacingPt) {
      const startLocal = intercept >= 0
        ? { x: 0, y: intercept }
        : { x: -intercept, y: 0 };
      const endLocal = box.width + intercept <= box.height
        ? { x: box.width, y: box.width + intercept }
        : { x: box.height - intercept, y: box.height };
      if (endLocal.x > startLocal.x + EPSILON) {
        page.drawLine({
          start: { x: box.x + startLocal.x, y: box.y + startLocal.y },
          end: { x: box.x + endLocal.x, y: box.y + endLocal.y },
          thickness: geometry.slashStrokeWidthPt,
          color: ink
        });
      }
    }
  }
  if (pattern === "DIAMOND_LATTICE") {
    for (let centerY = box.y + geometry.diamondRadiusYPt + 0.7; centerY <= box.y + box.height - geometry.diamondRadiusYPt - 0.7; centerY += geometry.diamondVerticalSpacingPt) {
      const rowShift = Math.round((centerY - box.y) / geometry.diamondVerticalSpacingPt) % 2
        ? geometry.diamondHorizontalSpacingPt / 2
        : 0;
      for (let centerX = box.x + geometry.diamondRadiusXPt + 0.7 + rowShift; centerX <= box.x + box.width - geometry.diamondRadiusXPt - 0.7; centerX += geometry.diamondHorizontalSpacingPt) {
        if (version === "R7") {
          const diameterX = geometry.diamondRadiusXPt * 2;
          const diameterY = geometry.diamondRadiusYPt * 2;
          page.drawSvgPath(`M 0 ${geometry.diamondRadiusYPt} L ${geometry.diamondRadiusXPt} 0 L ${diameterX} ${geometry.diamondRadiusYPt} L ${geometry.diamondRadiusXPt} ${diameterY} Z`, {
            x: centerX - geometry.diamondRadiusXPt,
            y: centerY - geometry.diamondRadiusYPt,
            color: ink
          });
        } else if (version === "R8") {
          const diameterX = geometry.diamondRadiusXPt * 2;
          const diameterY = geometry.diamondRadiusYPt * 2;
          page.drawSvgPath(`M 0 ${geometry.diamondRadiusYPt} L ${geometry.diamondRadiusXPt} 0 L ${diameterX} ${geometry.diamondRadiusYPt} L ${geometry.diamondRadiusXPt} ${diameterY} Z`, {
            x: centerX - geometry.diamondRadiusXPt,
            y: centerY - geometry.diamondRadiusYPt,
            color: ink
          });
        } else {
          const left = { x: centerX - geometry.diamondRadiusXPt, y: centerY };
          const topPoint = { x: centerX, y: centerY + geometry.diamondRadiusYPt };
          const right = { x: centerX + geometry.diamondRadiusXPt, y: centerY };
          const bottomPoint = { x: centerX, y: centerY - geometry.diamondRadiusYPt };
          page.drawLine({ start: left, end: topPoint, thickness: R6_PATTERN_GEOMETRY.diamondStrokeWidthPt, color: ink });
          page.drawLine({ start: topPoint, end: right, thickness: R6_PATTERN_GEOMETRY.diamondStrokeWidthPt, color: ink });
          page.drawLine({ start: right, end: bottomPoint, thickness: R6_PATTERN_GEOMETRY.diamondStrokeWidthPt, color: ink });
          page.drawLine({ start: bottomPoint, end: left, thickness: R6_PATTERN_GEOMETRY.diamondStrokeWidthPt, color: ink });
        }
      }
    }
  }
}

function chartSeries(colors: Palette) {
  return [
    { ...R5_CHART_SERIES[0], color: colors.student, pattern: R5_CHART_SERIES[0].monochromePattern },
    { ...R5_CHART_SERIES[1], color: colors.average, pattern: R5_CHART_SERIES[1].monochromePattern },
    { ...R5_CHART_SERIES[2], color: colors.high, pattern: R5_CHART_SERIES[2].monochromePattern }
  ];
}

function drawChartLegend(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  width: number,
  mode: RefinedColourMode,
  series: Array<{
    label: string;
    color: RGB;
    pattern: "SOLID" | "DIAGONAL" | "HORIZONTAL" | "CROSS_HATCH" | "DOTS";
  }>
) {
  const legendLeft = x + 108;
  const itemWidth = (width - 116) / series.length;
  const swatchY = A4.height - top - 22;
  series.forEach((item, index) => {
    const box = {
      x: legendLeft + index * itemWidth,
      y: swatchY,
      width: R5_CHART_LEGEND_GEOMETRY.swatchWidthPt,
      height: R5_CHART_LEGEND_GEOMETRY.swatchHeightPt
    };
    drawPatternedRectangle(page, box, item.color, colors.ink, mode === "MONOCHROME" ? item.pattern : "SOLID");
    page.drawText(item.label, {
      x: box.x + box.width + 5,
      y: box.y + 3.3,
      size: R5_CHART_LEGEND_GEOMETRY.labelFontSizePt,
      font: fonts.bold,
      color: colors.ink
    });
  });
}

function drawGradeLegend(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  width: number,
  legend: AcademicReportSnapshot["gradeLegend"],
  compact = false
) {
  const widths = [126, ...legend.map(() => (width - 126) / legend.length)];
  if (!compact) page.drawText("Grade Legend", { x: x + width / 2 - 28, y: A4.height - top + 3, size: 8, font: fonts.regular, color: colors.legendTitle });
  return drawTable(page, fonts, colors, x, top, widths, [], [
    { cells: [compact ? "Grade Legend \u2014 School % Ratings" : "School % Ratings", ...legend.map((item) => item.range)], bold: false },
    { cells: ["Grade", ...legend.map((item) => item.grade)], bold: false }
  ], {
    headerHeight: 0,
    rowHeight: compact ? R6_DENSE_CHART_GEOMETRY.compactGradeLegendRowHeightPt : 15,
    fontSize: compact ? R6_DENSE_CHART_GEOMETRY.compactGradeLegendFontSizePt : 7,
    firstColumnLeft: false
  });
}

function drawSignatures(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  geometry: {
    lineY: number;
    labelY: number;
    left: number;
    width: number;
    linePaddingPt?: number;
  } = R5_SIGNATURE_GEOMETRY
) {
  const labels = ["Class Teacher", "Principal", "Parent / Guardian", "Director"];
  const columnWidth = geometry.width / labels.length;
  labels.forEach((label, index) => {
    const columnX = geometry.left + index * columnWidth;
    const linePadding = geometry.linePaddingPt ?? 13;
    page.drawLine({
      start: { x: columnX + linePadding, y: geometry.lineY },
      end: { x: columnX + columnWidth - linePadding, y: geometry.lineY },
      thickness: 0.55,
      color: colors.border
    });
    const size = 7.8;
    const labelWidth = fonts.bold.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: columnX + (columnWidth - labelWidth) / 2,
      y: geometry.labelY,
      size,
      font: fonts.bold,
      color: colors.ink
    });
  });
}

function drawTable(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  widths: number[],
  headers: string[],
  rows: Array<{ cells: string[]; bold: boolean }>,
  options: {
    headerHeight: number;
    rowHeight: number;
    fontSize: number;
    firstColumnLeft: boolean;
    dynamicRows?: boolean;
    headerFill?: RGB;
    headerText?: RGB;
    sectionFill?: RGB;
    identity?: boolean;
    rowHeights?: number[];
    maximumLines?: number;
    verticalPadding?: number;
  }
) {
  let cursorTop = top;
  if (headers.length) {
    cursorTop += drawTableRow(page, fonts, colors, x, cursorTop, widths, headers, options.headerHeight, options.fontSize, {
      bold: true,
      firstColumnLeft: false,
      fill: options.headerFill || colors.band,
      textColor: options.headerText || colors.ink,
      dynamic: true,
      identity: options.identity
    });
  }
  for (const [rowIndex, row] of rows.entries()) {
    cursorTop += drawTableRow(page, fonts, colors, x, cursorTop, widths, row.cells, options.rowHeights?.[rowIndex] ?? options.rowHeight, options.fontSize, {
      bold: row.bold,
      firstColumnLeft: options.firstColumnLeft,
      fill: row.bold && options.sectionFill ? options.sectionFill : row.bold ? colors.band : colors.white,
      textColor: colors.ink,
      dynamic: options.dynamicRows,
      identity: options.identity,
      maximumLines: options.maximumLines,
      verticalPadding: options.verticalPadding
    });
  }
  return cursorTop;
}

function drawTableRow(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  widths: number[],
  values: string[],
  minimumHeight: number,
  fontSize: number,
  options: {
    bold: boolean;
    firstColumnLeft: boolean;
    fill: RGB;
    textColor: RGB;
    dynamic?: boolean;
    identity?: boolean;
    maximumLines?: number;
    verticalPadding?: number;
  }
) {
  const font = options.bold ? fonts.bold : fonts.regular;
  const wrapped = values.map((value, index) => wrapText(String(value), font, fontSize, widths[index] - 6));
  if (options.maximumLines && wrapped.some((lines) => lines.length > options.maximumLines!)) {
    throw new Error("Identity value exceeds the approved two-line wrapping contract.");
  }
  const required = Math.max(...wrapped.map((lines) => (options.verticalPadding ?? 6) + lines.length * (fontSize + 1)));
  const height = options.dynamic ? Math.max(minimumHeight, required) : minimumHeight;
  let cursor = x;
  values.forEach((_, index) => {
    rectTop(page, cursor, top, widths[index], height, options.fill, options.identity ? colors.ink : colors.border, options.identity ? 0.75 : 0.45);
    const lines = wrapped[index];
    const blockHeight = lines.length * (fontSize + 1);
    lines.forEach((line, lineIndex) => {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      const lineX = index === 0 && options.firstColumnLeft
        ? cursor + 4
        : cursor + Math.max(3, (widths[index] - lineWidth) / 2);
      const y = A4.height - top - (height - blockHeight) / 2 - fontSize - lineIndex * (fontSize + 1);
      page.drawText(line, { x: lineX, y, size: fontSize, font, color: options.textColor });
    });
    cursor += widths[index];
  });
  return height;
}

function drawWrappedBox(
  page: PDFPage,
  font: PDFFont,
  colors: Palette,
  x: number,
  top: number,
  width: number,
  text: string,
  size: number,
  minimumHeight: number
) {
  const lines = wrapText(text, font, size, width - 8);
  const height = Math.max(minimumHeight, 6 + lines.length * (size + 1));
  rectTop(page, x, top, width, height, colors.white, colors.border, 0.45);
  lines.forEach((line, index) => page.drawText(line, {
    x: x + 4, y: A4.height - top - size - 4 - index * (size + 1), size, font, color: colors.ink
  }));
  return top + height;
}

function drawPatternedRectangle(
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number },
  fill: RGB,
  ink: RGB,
  pattern: "SOLID" | "DIAGONAL" | "HORIZONTAL" | "CROSS_HATCH" | "DOTS"
) {
  page.drawRectangle({
    ...box,
    color: pattern === "SOLID" ? fill : rgb(1, 1, 1),
    borderColor: ink,
    borderWidth: pattern === "SOLID" ? 0.75 : 0.95
  });
  if (pattern === "DIAGONAL" || pattern === "CROSS_HATCH") {
    for (let offset = -box.height; offset < box.width; offset += 5) {
      const x1 = Math.max(box.x, box.x + offset);
      const y1 = box.y + Math.max(0, -offset);
      const x2 = Math.min(box.x + box.width, box.x + offset + box.height);
      const y2 = box.y + Math.min(box.height, box.height + offset);
      if (x2 > x1) page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.45, color: ink });
    }
  }
  if (pattern === "CROSS_HATCH") {
    for (let offset = 0; offset < box.width + box.height; offset += 5) {
      const points: Array<{ x: number; y: number }> = [];
      if (offset <= box.width) points.push({ x: box.x + offset, y: box.y });
      if (offset >= box.width && offset - box.width <= box.height) points.push({ x: box.x + box.width, y: box.y + offset - box.width });
      if (offset >= box.height && offset - box.height <= box.width) points.push({ x: box.x + offset - box.height, y: box.y + box.height });
      if (offset <= box.height) points.push({ x: box.x, y: box.y + offset });
      const unique = points.filter((point, index) => points.findIndex((candidate) =>
        Math.abs(candidate.x - point.x) < EPSILON && Math.abs(candidate.y - point.y) < EPSILON
      ) === index);
      if (unique.length >= 2) page.drawLine({ start: unique[0], end: unique[1], thickness: 0.45, color: ink });
    }
  }
  if (pattern === "HORIZONTAL") {
    for (let y = box.y + 3; y < box.y + box.height; y += 4) {
      page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.3, color: ink });
    }
  }
  if (pattern === "DOTS") {
    for (let dotY = box.y + 2.5; dotY <= box.y + box.height - 2.5; dotY += 5) {
      for (let dotX = box.x + 2.5; dotX <= box.x + box.width - 2.5; dotX += 5) {
        page.drawCircle({ x: dotX, y: dotY, size: 0.9, color: ink });
      }
    }
  }
}

function primaryReport(classSection: "II-A" | "V-A", upper: boolean, edgeCase: boolean) {
  const gradeScale = STANDARD_GRADE_SCALE;
  const columns = [
    { key: "internal", label: "Internal Assessment", maximum: 20 },
    { key: "written", label: "Written Examination", maximum: 80 }
  ];
  const values = upper
    ? [
      ["english", "English", 18, 72], ["hindi", "Hindi", 17, 69], ["math", "Mathematics", 20, 76],
      ["science", "Science", 19, 71], ["social", "Social", 18, 70],
      ["computer", "Computer Applications", 20, 75], ["telugu", "Telugu", 16, 70]
    ]
    : [
      ["english", "English", 18, 72], ["hindi", "Hindi", 17, 69], ["math", "Mathematics", 20, 76],
      ["evs", "Environmental Studies", 19, 71], ["computer", "Computer Applications", 20, 75],
      ["telugu", "Telugu", 16, 70]
    ];
  const subjects: AcademicSubjectSnapshot[] = values.map(([key, label, internal, written]) => {
    const notEntered = edgeCase && key === "math";
    const absent = edgeCase && key === "hindi";
    return marksSubject(
      String(key),
      edgeCase && key === "computer" ? "Computer Applications and Digital Learning Foundations" : String(label),
      columns,
      [Number(internal), notEntered || absent ? null : Number(written)],
      notEntered ? ["PRESENT", "NOT_ENTERED"] : absent ? ["PRESENT", "ABSENT"] : ["PRESENT", "PRESENT"],
      true,
      !notEntered,
      gradeScale
    );
  });
  subjects.push(gradeOnlySubject("gkve", "G.K. / V.E.", edgeCase ? null : "A1", edgeCase ? "EXEMPT" : "PRESENT"));
  if (edgeCase) subjects.push(gradeOnlySubject("workEducation", "Work Education", null, "NOT_APPLICABLE"));
  return finalizeReport({
    snapshotId: "R4-" + classSection + "-SESSION",
    classSnapshotId: "R4-" + classSection + "-SESSION-CLASS",
    classSection,
    examination: "SESSION END EXAMINATION",
    studentName: edgeCase ? "Aarav Synthetic Extremely Long Multilingual Compatible Student Name" : "Aarav Rahman",
    guardianName: edgeCase ? "Synthetic Parent and Guardian With An Exceptionally Long Name" : "Samira Rahman",
    admissionNumber: "SYN-2099-0012",
    rollNumber: "12",
    parentGuardianLabel: "Parent / Guardian",
    layout: "STANDARD",
    componentColumns: columns,
    showAcademicSubjectGrade: false,
    chartPolicy: "LEGACY_LEAF_SUBJECTS",
    gradeScale,
    subjects,
    traits: ["Reading Skills", "Writing Skills", "Speaking Skills", "Listening Skills", "Problem Solving", "Mental Ability", "Concepts", "Tables", "Environmental Sensitivity", "Spoken English"],
    traitTitle: "Skills",
    gradePoint: upper ? null : 9.2,
    rank: 2,
    remarks: edgeCase
      ? "Shows thoughtful participation and sustained effort across a long reporting observation while continuing to build confidence."
      : "Consistent effort and thoughtful participation. Keep progressing."
  });
}

function groupedReport(classSection: "VI-A" | "X-A", classX: boolean, edgeCase: boolean) {
  const gradeScale = classX ? ALTERNATE_GRADE_SCALE : STANDARD_GRADE_SCALE;
  const columns = classX
    ? [
      { key: "internal", label: "Internal Assessment", maximum: 10 },
      { key: "written", label: "Written Examination", maximum: 40 }
    ]
    : [
      { key: "internal", label: "Internal Assessment", maximum: 20 },
      { key: "written", label: "Written Examination", maximum: 80 }
    ];
  const raw = classX
    ? [
      ["english1", "English Paper 1", 9, 36], ["english2", "English Paper 2", 8, 35],
      ["hindi", "Hindi", 9, 35], ["history", "History", 9, 37], ["geography", "Geography", 10, 36],
      ["math", "Mathematics", 10, 28], ["physics", "Physics", 9, 34], ["chemistry", "Chemistry", 9, 30],
      ["biology", "Biology", 10, 37], ["computer", "Computers", 9, 39], ["telugu", "Telugu", 8, 33]
    ]
    : [
      ["english1", "English Paper 1", 19, 60], ["english2", "English Paper 2", 20, 48],
      ["hindi", "Hindi", 20, 51], ["history", "History", 19, 77], ["geography", "Geography", 20, 68],
      ["math", "Mathematics", 19, 43], ["physics", "Physics", 19, 58], ["chemistry", "Chemistry", 20, 69],
      ["biology", "Biology", 18, 70], ["computer", "Computers", 18, 48], ["telugu", "Telugu", 19, 63]
    ];
  const baseRows = raw.map(([key, label, internal, written]) =>
    marksSubject(
      String(key),
      edgeCase && key === "computer" ? "Computer Applications and Information Technology" : String(label),
      columns,
      [Number(internal), edgeCase && key === "math" ? null : Number(written)],
      edgeCase && key === "math" ? ["PRESENT", "NOT_ENTERED"] : ["PRESENT", "PRESENT"],
      ["hindi", "math", "computer", "telugu"].includes(String(key)),
      !edgeCase || key !== "math",
      gradeScale
    )
  );
  const byKey = new Map(baseRows.map((row) => [row.key, row]));
  const derived = [
    derivedSubject("englishAverage", "English Average", ["english1", "english2"], byKey, true, gradeScale),
    derivedSubject("socialAverage", "Social Average", ["history", "geography"], byKey, true, gradeScale),
    derivedSubject("scienceAverage", "Science Average", ["physics", "chemistry", "biology"], byKey, true, gradeScale)
  ];
  const order: AcademicSubjectSnapshot[] = [
    baseRows[0], baseRows[1], derived[0], baseRows[2], baseRows[3], baseRows[4], derived[1],
    baseRows[5], baseRows[6], baseRows[7], baseRows[8], derived[2], baseRows[9], baseRows[10]
  ];
  order.push(gradeOnlySubject("gkve", "G.K. / V.E.", edgeCase ? null : classX ? "A" : "A2", edgeCase ? "NOT_APPLICABLE" : "PRESENT"));
  return finalizeReport({
    snapshotId: "R4-" + classSection + (classX ? "-CT" : "-SESSION"),
    classSnapshotId: "R4-" + classSection + (classX ? "-CT-CLASS" : "-SESSION-CLASS"),
    classSection,
    examination: classX ? "COMPREHENSIVE TEST 1" : "SESSION END EXAMINATION",
    studentName: edgeCase ? "Aarav Synthetic Extremely Long Multilingual Compatible Student Name" : "Aarav Rahman",
    guardianName: edgeCase ? "Synthetic Parent and Guardian With An Exceptionally Long Name" : "Samira Rahman",
    admissionNumber: "SYN-2099-0012",
    rollNumber: "12",
    parentGuardianLabel: "Parent / Guardian",
    layout: "STANDARD",
    componentColumns: columns,
    showAcademicSubjectGrade: false,
    chartPolicy: "LEGACY_LEAF_SUBJECTS",
    gradeScale,
    subjects: order,
    traits: ["Courteousness", "Confidence", "Dress and Cleanliness", "Regularity and Punctuality", "Self-Control", "General Discipline", "Sharing and Caring", "School Participation", "Leadership Quality", "Spirit of Service"],
    traitTitle: "Personality Development",
    gradePoint: classX ? 8.7 : null,
    rank: classX ? 3 : null,
    remarks: edgeCase
      ? "Maintains consistent effort across grouped subjects and responds constructively to detailed feedback throughout the reporting period."
      : "Consistent effort and thoughtful participation. Keep progressing."
  });
}

function combinedReport(edgeCase: boolean) {
  const scheme = SYNTHETIC_COMBINED_SCHEME;
  const gradeScale = STANDARD_GRADE_SCALE;
  const leafDefinitions: Array<[string, string, number, boolean]> = [
    ["english1", "English Paper 1", 0, false], ["english2", "English Paper 2", 1, false],
    ["hindi", "Hindi", 3, true], ["math", "Mathematics", 4, true],
    ["physics", "Physics", 5, false], ["biology", "Biology", 6, false],
    ["chemistry", "Chemistry", 7, false], ["geography", "Geography", 9, false],
    ["history", "History", 10, false], ["computer", "Computers", 12, true]
  ];
  const leaves = leafDefinitions.map(([key, label, fixtureIndex, includeInOverall]) => combinedSubject(
    key,
    edgeCase && key === "math" ? "Mathematics with Advanced Applications and Projects" : label,
    fixtureIndex,
    includeInOverall,
    scheme,
    gradeScale
  ));
  if (edgeCase) {
    const longMathematics = leaves.find((subject) => subject.key === "math");
    if (longMathematics) {
      longMathematics.chartDisplayLabel = { configurationVersion: 1, value: "Advanced Mathematics" };
    }
  }
  const byKey = new Map(leaves.map((subject) => [subject.key, subject]));
  const englishAverage = combinedGroupSubject("englishAverage", "English Average", ["english1", "english2"], byKey, scheme, gradeScale);
  const scienceAverage = combinedGroupSubject("scienceAverage", "Science Average", ["physics", "biology", "chemistry"], byKey, scheme, gradeScale);
  const socialAverage = combinedGroupSubject("socialAverage", "Social Average", ["geography", "history"], byKey, scheme, gradeScale);
  const subjects: CombinedMarksSubject[] = [
    byKey.get("english1")!, byKey.get("english2")!, englishAverage,
    byKey.get("hindi")!, byKey.get("math")!, byKey.get("physics")!, byKey.get("biology")!,
    byKey.get("chemistry")!, scienceAverage, byKey.get("geography")!, byKey.get("history")!,
    socialAverage, byKey.get("computer")!
  ];
  const includedGradePoint = roundTo(average(subjects.filter((subject) => subject.includeInOverall).map((subject) => subject.combined.gradePoint)), 2);
  return finalizeReport({
    snapshotId: "R4-IX-A-COMBINED",
    classSnapshotId: "R4-IX-A-COMBINED-CLASS",
    classSection: "IX-A",
    examination: "COMBINED RESULT",
    studentName: edgeCase ? "Aarav Synthetic Extremely Long Multilingual Compatible Student Name" : "Aarav Rahman",
    guardianName: edgeCase ? "Synthetic Parent and Guardian With An Exceptionally Long Name" : "Samira Rahman",
    admissionNumber: "SYN-2099-0012",
    rollNumber: "12",
    parentGuardianLabel: "Parent / Guardian",
    layout: "COMBINED",
    componentColumns: [],
    combinedScheme: scheme,
    showAcademicSubjectGrade: true,
    chartPolicy: "LEGACY_LEAF_SUBJECTS",
    gradeScale,
    subjects,
    traits: [],
    traitTitle: null,
    gradePoint: includedGradePoint,
    rank: null,
    remarks: edgeCase
      ? "Demonstrates steady improvement across a dense combined reporting structure and uses detailed feedback purposefully."
      : "Consistent effort and thoughtful participation. Keep progressing."
  });
}

function marksSubject(
  key: string,
  label: string,
  columns: AcademicReportSnapshot["componentColumns"],
  values: Array<number | null>,
  states: MarkState[],
  includeInOverall: boolean,
  chartIncluded: boolean,
  gradeScale: GradeScaleSnapshot
): StandardMarksSubject {
  const components = columns.map((column, index) => ({
    ...column,
    value: values[index],
    state: states[index]
  }));
  const complete = values.every((value) => value != null);
  const value = complete ? roundTo(sum(values.map(Number)), 2) : null;
  const missingState: MarkState = states.includes("ABSENT") ? "ABSENT" :
    states.includes("EXEMPT") ? "EXEMPT" :
    states.includes("NOT_APPLICABLE") ? "NOT_APPLICABLE" : "NOT_ENTERED";
  const maximum = roundTo(sum(columns.map((column) => column.maximum)), 2);
  return {
    kind: "MARKS",
    key,
    label,
    components,
    total: {
      maximum,
      value,
      state: complete ? "PRESENT" : missingState
    },
    grade: complete ? gradeForScale(value! / maximum * 100, gradeScale) : resultStateCode(missingState),
    includeInOverall: includeInOverall && complete,
    chartIncluded: chartIncluded && complete,
    chartDisplayLabel: null,
    classAveragePercentage: null,
    highScorePercentage: null,
    aggregateOf: []
  };
}

function derivedSubject(
  key: string,
  label: string,
  derivedFrom: string[],
  byKey: Map<string, StandardMarksSubject>,
  includeInOverall: boolean,
  gradeScale: GradeScaleSnapshot
): DerivedMarksSubject {
  const calculation = calculateSubjectGroupResult(
    SYNTHETIC_GROUP_FORMULA,
    derivedFrom,
    new Map([...byKey].map(([sourceKey, source]) => [sourceKey, {
      key: sourceKey,
      maximum: source.total.maximum,
      value: source.total.value,
      state: source.total.state
    }]))
  );
  if (calculation.state !== "PRESENT" || calculation.value == null || calculation.maximum == null) {
    throw new Error("Synthetic grouped subject is unavailable for " + label + ".");
  }
  const maximum = calculation.maximum;
  const value = calculation.value;
  return {
    kind: "DERIVED",
    key,
    label,
    derivedFrom,
    groupFormula: SYNTHETIC_GROUP_FORMULA,
    total: { maximum, value, state: "PRESENT" },
    grade: gradeForScale(value / maximum * 100, gradeScale),
    includeInOverall,
    chartIncluded: true,
    chartDisplayLabel: null,
    classAveragePercentage: null,
    highScorePercentage: null,
    aggregateOf: derivedFrom
  };
}

function gradeOnlySubject(key: string, label: string, grade: string | null, state: MarkState): GradeOnlySubject {
  return {
    kind: "GRADE_ONLY",
    key,
    label,
    grade,
    state,
    includeInOverall: false,
    chartIncluded: false,
    chartDisplayLabel: null,
    classAveragePercentage: null,
    highScorePercentage: null,
    aggregateOf: []
  };
}

function combinedSubject(
  key: string,
  label: string,
  index: number,
  includeInOverall: boolean,
  scheme: CombinedSchemeSnapshot,
  gradeScale: GradeScaleSnapshot
): CombinedMarksSubject {
  const ct1 = 38 + index % 7;
  const ia1 = 8 + index % 3;
  const ct2 = 37 + index % 9;
  const ia2 = 7 + index % 4;
  const ct3 = 40 + index % 6;
  const ia3 = 8 + index % 3;
  const terminalRaw = 72 + index % 9;
  const annualRaw = 78 + index % 11;
  const cycleMaximum = scheme.ctMaximum + scheme.internalAssessmentMaximum;
  const ctWeighted = roundTo(average([
    (ct1 + ia1) / cycleMaximum * 100,
    (ct2 + ia2) / cycleMaximum * 100,
    (ct3 + ia3) / cycleMaximum * 100
  ]) * scheme.ctWeight / 100, 2);
  const terminalWeighted = roundTo(terminalRaw / scheme.terminalMaximum * scheme.terminalWeight, 2);
  const annualWeighted = roundTo(annualRaw / scheme.annualMaximum * scheme.annualWeight, 2);
  const totalValue = roundTo(ctWeighted + terminalWeighted + annualWeighted, 2);
  const totalMaximum = scheme.ctWeight + scheme.terminalWeight + scheme.annualWeight;
  return {
    kind: "COMBINED",
    key,
    label,
    combined: {
      ct1, ia1, ct2, ia2, ct3, ia3, ctWeighted,
      terminalRaw, terminalWeighted, annualRaw, annualWeighted,
      gradePoint: 7 + index % 3 * 0.5
    },
    groupFormula: null,
    total: {
      maximum: totalMaximum,
      value: totalValue,
      state: "PRESENT"
    },
    grade: gradeForScale(totalValue / totalMaximum * 100, gradeScale),
    includeInOverall,
    chartIncluded: true,
    chartDisplayLabel: null,
    classAveragePercentage: null,
    highScorePercentage: null,
    aggregateOf: []
  };
}

function combinedGroupSubject(
  key: string,
  label: string,
  memberKeys: string[],
  byKey: Map<string, CombinedMarksSubject>,
  scheme: CombinedSchemeSnapshot,
  gradeScale: GradeScaleSnapshot
): CombinedMarksSubject {
  const members = memberKeys.map((memberKey) => byKey.get(memberKey));
  if (members.some((member) => !member)) throw new Error("Synthetic combined group member is missing for " + label + ".");
  const validMembers = members.filter((member): member is CombinedMarksSubject => Boolean(member));
  const calculateField = (field: keyof CombinedResultValues) => {
    const result = calculateSubjectGroupResult(
      SYNTHETIC_GROUP_FORMULA,
      memberKeys,
      new Map(validMembers.map((member) => [member.key, {
        key: member.key,
        maximum: field === "gradePoint" ? 10 : 100,
        value: member.combined[field],
        state: "PRESENT" as const
      }]))
    );
    if (result.state !== "PRESENT" || result.value == null) {
      throw new Error("Synthetic combined group field is unavailable for " + label + ".");
    }
    return result.value;
  };
  const total = calculateSubjectGroupResult(
    SYNTHETIC_GROUP_FORMULA,
    memberKeys,
    new Map(validMembers.map((member) => [member.key, {
      key: member.key,
      maximum: member.total.maximum,
      value: member.total.value,
      state: member.total.state
    }]))
  );
  if (total.state !== "PRESENT" || total.value == null || total.maximum == null) {
    throw new Error("Synthetic combined group result is unavailable for " + label + ".");
  }
  const combined: CombinedResultValues = {
    ct1: calculateField("ct1"),
    ia1: calculateField("ia1"),
    ct2: calculateField("ct2"),
    ia2: calculateField("ia2"),
    ct3: calculateField("ct3"),
    ia3: calculateField("ia3"),
    ctWeighted: calculateField("ctWeighted"),
    terminalRaw: calculateField("terminalRaw"),
    terminalWeighted: calculateField("terminalWeighted"),
    annualRaw: calculateField("annualRaw"),
    annualWeighted: calculateField("annualWeighted"),
    gradePoint: calculateField("gradePoint")
  };
  const weightedTotal = roundTo(combined.ctWeighted + combined.terminalWeighted + combined.annualWeighted, 2);
  if (!close(weightedTotal, total.value)) {
    throw new Error("Synthetic grouped weighted fields do not reconcile for " + label + ".");
  }
  if (!close(total.maximum, scheme.ctWeight + scheme.terminalWeight + scheme.annualWeight)) {
    throw new Error("Synthetic grouped maximum does not reconcile for " + label + ".");
  }
  return {
    kind: "COMBINED",
    key,
    label,
    combined,
    groupFormula: SYNTHETIC_GROUP_FORMULA,
    total: { maximum: total.maximum, value: total.value, state: "PRESENT" },
    grade: gradeForScale(total.value / total.maximum * 100, gradeScale),
    includeInOverall: true,
    chartIncluded: true,
    chartDisplayLabel: null,
    classAveragePercentage: null,
    highScorePercentage: null,
    aggregateOf: memberKeys
  };
}

function finalizeReport(input: {
  snapshotId: string;
  classSnapshotId: string;
  classSection: string;
  examination: string;
  studentName: string;
  guardianName: string;
  admissionNumber: string;
  rollNumber: string;
  parentGuardianLabel: string;
  layout: "STANDARD" | "COMBINED";
  componentColumns: AcademicReportSnapshot["componentColumns"];
  combinedScheme?: CombinedSchemeSnapshot | null;
  showAcademicSubjectGrade: boolean;
  chartPolicy: ChartRowPolicy;
  gradeScale: GradeScaleSnapshot;
  subjects: AcademicSubjectSnapshot[];
  traits: string[];
  traitTitle: AcademicReportSnapshot["traitTitle"];
  gradePoint: number | null;
  rank: number | null;
  remarks: string;
}): AcademicReportSnapshot {
  const { combinedScheme = null, ...base } = input;
  const included = input.subjects.filter(
    (subject): subject is StandardMarksSubject | DerivedMarksSubject | CombinedMarksSubject =>
      subject.includeInOverall && hasNumericTotal(subject)
  );
  const maximum = roundTo(sum(included.map((subject) => subject.total.maximum)), 2);
  const value = roundTo(sum(included.map((subject) => roundTo(Number(subject.total.value), 2))), 2);
  const percentage = maximum ? roundTo(value / maximum * 100, 2) : 0;
  const cohort = buildSyntheticCohortRecords(input.subjects, input.chartPolicy);
  const chartPoints = buildChartPointsFromCohort(input.subjects, input.chartPolicy, input.classSnapshotId, cohort);
  return {
    ...base,
    combinedScheme,
    summarySnapshotId: input.snapshotId,
    overall: {
      value,
      maximum,
      percentage,
      grade: gradeForScale(percentage, input.gradeScale),
      gradePoint: input.gradePoint,
      rank: input.rank,
      rankBasisPercentage: percentage
    },
    attendance: { workingDays: 231, daysPresent: 218, percentage: 218 / 231 * 100 },
    chartPoints,
    gradeLegend: gradeLegendForScale(input.gradeScale)
  };
}

export function selectChartSubjects(subjects: AcademicSubjectSnapshot[], policy: ChartRowPolicy) {
  const candidates = subjects.filter(
    (subject): subject is StandardMarksSubject | DerivedMarksSubject | CombinedMarksSubject =>
      subject.chartIncluded && hasNumericTotal(subject)
  );
  if (policy === "LEGACY_LEAF_SUBJECTS") {
    return candidates.filter((subject) => subject.aggregateOf.length === 0);
  }
  const aggregateSources = new Set(candidates.flatMap((subject) => subject.aggregateOf));
  return candidates.filter((subject) => subject.aggregateOf.length > 0 || !aggregateSources.has(subject.key));
}

export function buildSyntheticCohortRecords(
  subjects: AcademicSubjectSnapshot[],
  policy: ChartRowPolicy
): CohortResultRecord[] {
  return selectChartSubjects(subjects, policy).flatMap((subject, index) => {
    const maximum = subject.total.maximum;
    const studentValue = Number(subject.total.value);
    const studentPercentage = studentValue / maximum * 100;
    const peerPercentages = [
      63 + index % 5,
      72 + index % 7,
      82 + index % 6,
      Math.min(100, Math.max(studentPercentage, 94 + index % 7))
    ];
    return [
      { studentKey: "SYNTHETIC-CURRENT", subjectKey: subject.key, maximum, value: studentValue, state: "PRESENT" as const },
      ...peerPercentages.map((percentage, peerIndex) => ({
        studentKey: "SYNTHETIC-PEER-" + (peerIndex + 1),
        subjectKey: subject.key,
        maximum,
        value: roundTo(maximum * percentage / 100, 2),
        state: "PRESENT" as const
      })),
      { studentKey: "SYNTHETIC-EXCLUDED-AB", subjectKey: subject.key, maximum, value: null, state: "ABSENT" as const },
      { studentKey: "SYNTHETIC-EXCLUDED-NE", subjectKey: subject.key, maximum, value: null, state: "NOT_ENTERED" as const }
    ];
  });
}

export function buildChartPointsFromCohort(
  subjects: AcademicSubjectSnapshot[],
  policy: ChartRowPolicy,
  classSnapshotId: string,
  cohort: CohortResultRecord[]
) {
  return selectChartSubjects(subjects, policy).flatMap((subject) => {
    const statistics = calculateCohortStatistics(subject.key, cohort);
    if (!statistics) {
      subject.classAveragePercentage = null;
      subject.highScorePercentage = null;
      return [];
    }
    subject.classAveragePercentage = statistics.classAveragePercentage;
    subject.highScorePercentage = statistics.highScorePercentage;
    return [{
      subjectKey: subject.key,
      subjectLabel: subject.label,
      chartDisplayLabel: subject.chartDisplayLabel,
      studentPercentage: roundTo(Number(subject.total.value) / subject.total.maximum * 100, 2),
      classAveragePercentage: statistics.classAveragePercentage,
      highScorePercentage: statistics.highScorePercentage,
      classSnapshotId
    }];
  });
}

function displayComponent(component: MarkComponentSnapshot) {
  if (component.state === "PRESENT") return formatParentFacingNumber(Number(component.value));
  return resultStateCode(component.state);
}

export function formatParentFacingNumber(value: number) {
  return trimFixed(roundTo(value, R5_MAX_PARENT_FACING_DECIMALS), R5_MAX_PARENT_FACING_DECIMALS);
}

export function displayedSubjectTotalValue(subject: AcademicSubjectSnapshot, report?: AcademicReportSnapshot) {
  if (subject.kind === "GRADE_ONLY") return null;
  if (subject.kind === "MARKS") {
    if (subject.total.state !== "PRESENT" || subject.total.value == null) return null;
    return roundTo(sum(subject.components.map((component) =>
      component.state === "PRESENT" && component.value != null ? roundTo(component.value, 1) : 0
    )), 1);
  }
  if (subject.kind === "COMBINED") {
    return roundTo(sum([
      roundTo(subject.combined.ctWeighted, 1),
      roundTo(subject.combined.terminalWeighted, 1),
      roundTo(subject.combined.annualWeighted, 1)
    ]), 1);
  }
  if (report) {
    const displayedComponents = report.componentColumns.map((column) =>
      displayedDerivedComponentValue(report, subject, column.key)
    );
    if (displayedComponents.every((value): value is number => value != null)) {
      return roundTo(sum(displayedComponents), 1);
    }
  }
  return roundTo(subject.total.value, 1);
}

export function displayedOverallTotal(report: AcademicReportSnapshot) {
  const contributing = report.subjects.flatMap((subject) => {
    if (!subject.includeInOverall || subject.kind === "GRADE_ONLY") return [];
    const value = displayedSubjectTotalValue(subject, report);
    return value == null ? [] : [value];
  });
  return roundTo(sum(contributing), 1);
}

export function displayedOverallPercentage(report: AcademicReportSnapshot) {
  return report.overall.maximum
    ? roundTo(displayedOverallTotal(report) / report.overall.maximum * 100, 1)
    : 0;
}

export function validateDisplayedReportReconciliation(report: AcademicReportSnapshot) {
  for (const subject of report.subjects) {
    if (subject.kind === "MARKS" && subject.total.state === "PRESENT") {
      const components = roundTo(sum(subject.components.map((component) => roundTo(Number(component.value), 1))), 1);
      if (!close(displayedSubjectTotalValue(subject, report) ?? Number.NaN, components)) {
        throw new Error("Displayed components do not reconcile for " + subject.label + ".");
      }
    }
    if (subject.kind === "COMBINED") {
      const contributions = roundTo(sum([
        roundTo(subject.combined.ctWeighted, 1),
        roundTo(subject.combined.terminalWeighted, 1),
        roundTo(subject.combined.annualWeighted, 1)
      ]), 1);
      if (!close(displayedSubjectTotalValue(subject, report) ?? Number.NaN, contributions)) {
        throw new Error("Displayed weighted contributions do not reconcile for " + subject.label + ".");
      }
    }
  }
  const subjects = roundTo(sum(report.subjects.flatMap((subject) => {
    if (!subject.includeInOverall || subject.kind === "GRADE_ONLY") return [];
    const value = displayedSubjectTotalValue(subject, report);
    return value == null ? [] : [value];
  })), 1);
  if (!close(displayedOverallTotal(report), subjects)) {
    throw new Error("Displayed subject totals do not reconcile to the displayed overall total.");
  }
  if (!close(displayedOverallPercentage(report), roundTo(subjects / report.overall.maximum * 100, 1))) {
    throw new Error("Displayed overall total does not reconcile to the displayed percentage.");
  }
  return report;
}

export function resultStateCode(state: MarkState) {
  return state === "ABSENT" ? "AB" :
    state === "EXEMPT" ? "EX" :
    state === "NOT_ENTERED" ? "NE" :
    state === "NOT_APPLICABLE" ? "NA" : "";
}

export function gradeForScale(value: number, scale: GradeScaleSnapshot) {
  const band = scale.bands.find((candidate) => value >= candidate.minimumInclusive);
  if (!band || value > 100 || value < 0) throw new Error("Percentage is outside the configured grade scale.");
  return band.label;
}

export function gradeLegendForScale(scale: GradeScaleSnapshot) {
  return scale.bands.map((band, index) => {
    const nextHigher = index === 0 ? null : scale.bands[index - 1];
    const lower = formatParentFacingNumber(band.minimumInclusive);
    const range = index === 0
      ? `${lower}–${formatParentFacingNumber(band.maximumInclusive)}`
      : `${lower}–<${formatParentFacingNumber(nextHigher!.minimumInclusive)}`;
    return { range, grade: band.label };
  });
}

function drawKgFrame(page: PDFPage, colors: Palette) {
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.kgPinkLight });
  page.drawRectangle({ x: 29, y: 29, width: A4.width - 58, height: A4.height - 58, color: colors.kgGreen, opacity: 0.52 });
  page.drawRectangle({ x: 39, y: 39, width: A4.width - 78, height: A4.height - 78, color: colors.kgCream, borderColor: colors.kgPinkDark, borderWidth: 1.2 });
  page.drawRectangle({ x: 47, y: 47, width: A4.width - 94, height: A4.height - 94, borderColor: colors.kgGreenText, borderWidth: 0.55 });
}

function lineField(page: PDFPage, fonts: Fonts, label: string, value: string, x: number, y: number, width: number, colors: Palette) {
  page.drawText(label + ":", { x, y, size: 9.3, font: fonts.regular, color: colors.kgInk });
  const lines = wrapText(value, fonts.bold, 9.3, width - 62);
  lines.slice(0, 2).forEach((line, index) => page.drawText(line, {
    x: x + 60, y: y - index * 10, size: 9.3, font: fonts.bold, color: colors.kgInk
  }));
  page.drawLine({ start: { x: x + 56, y: y - 3 - (lines.length - 1) * 10 }, end: { x: x + width, y: y - 3 - (lines.length - 1) * 10 }, thickness: 0.5, color: colors.kgInk, dashArray: [1, 2] });
}

function drawFooter(page: PDFPage, fonts: Fonts, _mode: RefinedColourMode, _edgeCase: boolean) {
  centered(page, "SYNTHETIC SAMPLE — NOT FOR ISSUE", fonts.bold, R4_MINIMUM_FONT_SIZES.legend, R5_SIGNATURE_GEOMETRY.footerY, rgb(0.42, 0.42, 0.42));
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color: RGB, xOffset = 0) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4.width - width) / 2 + xOffset, y, size, font, color });
}

function centeredInHorizontalSpan(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  y: number,
  color: RGB,
  left: number,
  width: number
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  if (textWidth > width + EPSILON) throw new Error("Approved academic header text exceeds its governed text block.");
  page.drawText(text, { x: left + (width - textWidth) / 2, y, size, font, color });
}

function centeredInBox(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  size: number,
  box: { x: number; y: number; width: number; height: number },
  color: RGB
) {
  lines.forEach((line, index) => page.drawText(line, {
    x: box.x + (box.width - font.widthOfTextAtSize(line, size)) / 2,
    y: box.y + box.height / 2 + (lines.length / 2 - index - 1) * (size + 2),
    size,
    font,
    color
  }));
}

function rectTop(page: PDFPage, x: number, top: number, width: number, height: number, color: RGB, borderColor: RGB, borderWidth: number) {
  page.drawRectangle({ x, y: A4.height - top - height, width, height, color, borderColor, borderWidth });
}

function wrapText(value: string, font: PDFFont, size: number, maximumWidth: number) {
  const paragraphs = String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const chunks = splitLongToken(word, font, size, maximumWidth);
      for (const chunk of chunks) {
        const candidate = current ? current + " " + chunk : chunk;
        if (!current || font.widthOfTextAtSize(candidate, size) <= maximumWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = chunk;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function splitLongToken(value: string, font: PDFFont, size: number, maximumWidth: number) {
  if (font.widthOfTextAtSize(value, size) <= maximumWidth) return [value];
  const chunks: string[] = [];
  let current = "";
  for (const character of value) {
    if (current && font.widthOfTextAtSize(current + character, size) > maximumWidth) {
      chunks.push(current);
      current = character;
    } else current += character;
  }
  if (current) chunks.push(current);
  return chunks;
}

export const CHART_LABEL_CONTRACT_VERSION = 1;

export function resolveChartDisplayText(point: Pick<ChartPointSnapshot, "subjectLabel" | "chartDisplayLabel">) {
  const configured = point.chartDisplayLabel;
  if (configured) {
    if (!Number.isInteger(configured.configurationVersion) || configured.configurationVersion < 1) {
      throw new Error("Configured chart label requires a positive version.");
    }
    const value = configured.value.trim().replace(/\s+/g, " ");
    if (!value) throw new Error("Configured chart label cannot be empty.");
    requireNoChartEllipsis(value);
    return value;
  }
  const value = point.subjectLabel.trim().replace(/\s+/g, " ");
  if (!value) throw new Error("Official subject label cannot be empty.");
  requireNoChartEllipsis(value);
  return value;
}

export function wrapCompleteChartLabel(
  value: string,
  maximumWidth: number,
  measure: (text: string) => number,
  maximumLines = 3
) {
  const sourceText = String(value).trim().replace(/\s+/g, " ");
  requireNoChartEllipsis(sourceText);
  if (!sourceText || maximumWidth <= 0 || maximumLines < 1) {
    return { sourceText, lines: [] as string[], complete: false };
  }
  const lines: string[] = [];
  let current = "";
  const pushLine = () => {
    if (!current) return true;
    lines.push(current);
    current = "";
    return lines.length <= maximumLines;
  };
  for (const word of sourceText.split(" ")) {
    const chunks = splitMeasuredToken(word, maximumWidth, measure);
    for (const chunk of chunks) {
      const candidate = current ? current + " " + chunk : chunk;
      if (!current || measure(candidate) <= maximumWidth) {
        current = candidate;
      } else {
        if (!pushLine()) return { sourceText, lines: [], complete: false };
        current = chunk;
      }
    }
  }
  if (!pushLine() || lines.length > maximumLines) {
    return { sourceText, lines: [], complete: false };
  }
  return { sourceText, lines, complete: true };
}

export function resolveChartCategoryLayout(
  points: ChartPointSnapshot[],
  chartWidth: number,
  measure: (text: string) => number,
  maximumLines = 3
) {
  const omitted = new Map<string, ChartPointSnapshot>();
  let visible = [...points];
  let resolved: Array<{ point: ChartPointSnapshot; displayText: string; lines: string[] }> = [];
  while (visible.length) {
    const slot = chartWidth / visible.length;
    const next: typeof resolved = [];
    let changed = false;
    for (const point of visible) {
      const displayText = resolveChartDisplayText(point);
      const wrapped = wrapCompleteChartLabel(displayText, Math.max(1, slot - 2), measure, maximumLines);
      if (!wrapped.complete) {
        omitted.set(point.subjectKey, point);
        changed = true;
      } else next.push({ point, displayText, lines: wrapped.lines });
    }
    resolved = next;
    if (!changed) break;
    visible = next.map((item) => item.point);
  }
  return {
    categories: resolved,
    omitted: [...omitted.values()],
    slot: resolved.length ? chartWidth / resolved.length : chartWidth
  };
}

export function resolveR6AcademicChartLayout(
  points: ChartPointSnapshot[],
  chartWidth: number,
  measure: (text: string) => number
): R6ChartLayout {
  const categoryCount = points.length;
  const projectedWidth = categoryCount ? chartWidth / categoryCount : chartWidth;
  const hasLongLabels = points.some((point) => {
    const wrapped = wrapCompleteChartLabel(
      resolveChartDisplayText(point),
      Math.max(1, projectedWidth - 3),
      measure,
      2
    );
    return !wrapped.complete;
  });
  const dense = categoryCount >= R6_DENSE_CHART_GEOMETRY.triggerCategoryCount
    || projectedWidth < R6_DENSE_CHART_GEOMETRY.minimumProjectedCategoryWidthPt
    || hasLongLabels;
  const twoRows = dense && (
    categoryCount >= R6_DENSE_CHART_GEOMETRY.twoRowCategoryCount
    || (categoryCount >= R6_DENSE_CHART_GEOMETRY.triggerCategoryCount && projectedWidth < 42)
  );
  if (!twoRows) {
    return {
      mode: dense ? "DENSE_ACADEMIC_CHART" : "NORMAL_ACADEMIC_CHART",
      rows: 1,
      categoryRows: [[...points]],
      compactGradeLegend: dense,
      reason: dense
        ? (hasLongLabels ? "LONG_LABEL_OR_PROJECTED_COLLISION" : "CATEGORY_DENSITY")
        : "NORMAL_CAPACITY"
    };
  }
  const firstRowCount = Math.ceil(categoryCount / 2);
  return {
    mode: "DENSE_ACADEMIC_CHART",
    rows: 2,
    categoryRows: [points.slice(0, firstRowCount), points.slice(firstRowCount)],
    compactGradeLegend: true,
    reason: "TWO_ROW_COLLISION_FALLBACK"
  };
}

export function resolveR8MarksTableLayout(report: AcademicReportSnapshot): R8MarksTableLayout {
  const resultColumnCount = report.layout === "COMBINED"
    ? 14
    : report.componentColumns.length + 1 + (report.showAcademicSubjectGrade ? 1 : 0);
  const groupedRowCount = report.subjects.filter((subject) => subject.aggregateOf.length > 0 || subject.kind !== "GRADE_ONLY").length;
  const hasGroupedSubjects = report.subjects.some((subject) => subject.aggregateOf.length > 0);
  const longestSubject = Math.max(...report.subjects.map((subject) => subject.label.length), 0);
  const reasons = [
    ...(report.subjects.length > 10 ? ["MORE_THAN_TEN_ACADEMIC_ROWS"] : []),
    ...(resultColumnCount > 5 ? ["MORE_THAN_FIVE_RESULT_COLUMNS"] : []),
    ...(hasGroupedSubjects && groupedRowCount > 8 ? ["GROUPED_REPORT_MORE_THAN_EIGHT_ROWS"] : []),
    ...(longestSubject > 34 ? ["PROJECTED_SUBJECT_WIDTH"] : [])
  ];
  const dense = reasons.length > 0;
  const combined = report.layout === "COMBINED";
  const groupedClass = report.classSection.startsWith("VI") || report.classSection.startsWith("VII") || report.classSection.startsWith("VIII");
  const secondaryClass = report.classSection.startsWith("IX") || report.classSection.startsWith("X");
  const geometry = combined
    ? R8_TABLE_GEOMETRY.combined
    : groupedClass
      ? R8_TABLE_GEOMETRY.grouped
      : secondaryClass
        ? R8_TABLE_GEOMETRY.combined
        : R8_TABLE_GEOMETRY.primary;
  return {
    mode: dense ? "DENSE_MARKS_TABLE_PRIORITY" : "NORMAL_MARKS_TABLE",
    combineTraitAndGrade: dense && Boolean(report.traitTitle) && (groupedClass || secondaryClass),
    academicWidthRatio: dense && Boolean(report.traitTitle) ? R8_TABLE_GEOMETRY.denseAcademicWidthRatio : 1,
    ...geometry,
    reasons: dense ? reasons : ["NORMAL_CAPACITY"]
  };
}

export function resolveR8ChartLayout(
  report: AcademicReportSnapshot,
  marksLayout: R8MarksTableLayout,
  chartLayout: R6ChartLayout
): R8ChartLayout {
  const secondary = report.classSection.startsWith("IX") || report.classSection.startsWith("X");
  const middleSingleRowFallback = chartLayout.rows === 2 && report.layout === "STANDARD" && report.chartPoints.length <= 11;
  const governedChartLayout: R6ChartLayout = middleSingleRowFallback
    ? {
      ...chartLayout,
      rows: 1,
      categoryRows: [[...report.chartPoints]],
      reason: "R8_ONE_ROW_PRESERVES_TABLE_AND_SIGNATURE_PRIORITY"
    }
    : chartLayout;
  const compactDense = report.chartPoints.length >= 8 || (marksLayout.mode === "DENSE_MARKS_TABLE_PRIORITY" && secondary) || governedChartLayout.rows === 2;
  const footprintMode: R8ChartFootprintMode = compactDense
    ? "COMPACT_DENSE_CHART"
    : marksLayout.mode === "DENSE_MARKS_TABLE_PRIORITY"
      ? "COMPACT_CHART"
      : "NORMAL_CHART";
  const reductionRatio = footprintMode === "NORMAL_CHART"
    ? R8_CHART_GEOMETRY.normalReductionRatio
    : footprintMode === "COMPACT_CHART"
      ? R8_CHART_GEOMETRY.compactReductionRatio
      : R8_CHART_GEOMETRY.compactDenseReductionRatio;
  return { ...governedChartLayout, footprintMode, reductionRatio };
}

export function r8ChartRowSlotHeight(chartHeight: number, layout: Pick<R8ChartLayout, "rows">) {
  const headerHeight = 28;
  const contentHeight = chartHeight - headerHeight - 4;
  return (contentHeight - (layout.rows - 1) * R8_CHART_GEOMETRY.twoRowGapPt) / layout.rows;
}

export function formatChartNumericValues(values: number[]) {
  return values.map(formatParentFacingNumber);
}

export function layoutChartNumericLabels(
  inputs: ChartNumericLabelInput[],
  bounds: { left: number; right: number; bottom: number; top: number },
  fontSize: number,
  measure: (text: string) => number
): ChartNumericLabelPlacement[] {
  const placements: ChartNumericLabelPlacement[] = [];
  const step = fontSize + R5_CHART_LABEL_CLEARANCE_PT;
  const verticalOffsets = Array.from({ length: 8 }, (_, level) => level * step);
  for (const [inputIndex, input] of inputs.entries()) {
    const width = measure(input.text);
    const preferredY = Math.min(
      bounds.top - fontSize,
      Math.max(bounds.bottom, input.barTopY + 3 + (input.staggerLevel ?? 0) * step)
    );
    const horizontalStep = Math.max(7, width * 0.7);
    const baseHorizontalOffset = input.horizontalStaggerPt ?? 0;
    const horizontalOffsets = [
      0,
      -horizontalStep,
      horizontalStep,
      -horizontalStep * 2,
      horizontalStep * 2,
      -horizontalStep * 3,
      horizontalStep * 3
    ];
    let selected: ChartNumericLabelPlacement | null = null;
    for (const verticalOffset of verticalOffsets) {
      for (const horizontalOffset of horizontalOffsets) {
        const x = Math.min(bounds.right - width, Math.max(bounds.left, input.centerX - width / 2 + baseHorizontalOffset + horizontalOffset));
        const y = Math.min(bounds.top - fontSize, Math.max(bounds.bottom, preferredY + verticalOffset));
        const candidate: ChartNumericLabelPlacement = {
          ...input,
          x,
          y,
          width,
          height: fontSize,
          anchorX: input.centerX,
          anchorY: input.barTopY,
          leaderLine: Math.abs(x + width / 2 - input.centerX) > 1 || y - preferredY > 1
        };
        if (!placements.some((placed) => chartTextBoxesOverlap(candidate, placed, R5_CHART_LABEL_CLEARANCE_PT))) {
          selected = candidate;
          break;
        }
      }
      if (selected) break;
    }
    if (!selected) throw new Error(`Chart numeric label ${inputIndex + 1}/${inputs.length} (${input.text}) cannot be placed without collision.`);
    placements.push(selected);
  }
  return placements;
}

export function chartTextBoxesOverlap(left: ChartTextBox, right: ChartTextBox, clearance = R5_CHART_LABEL_CLEARANCE_PT) {
  return left.x < right.x + right.width + clearance &&
    left.x + left.width + clearance > right.x &&
    left.y < right.y + right.height + clearance &&
    left.y + left.height + clearance > right.y;
}

function splitMeasuredToken(value: string, maximumWidth: number, measure: (text: string) => number) {
  if (measure(value) <= maximumWidth) return [value];
  const chunks: string[] = [];
  let current = "";
  for (const character of Array.from(value)) {
    if (current && measure(current + character) > maximumWidth) {
      chunks.push(current);
      current = character;
    } else current += character;
  }
  if (current) chunks.push(current);
  return chunks;
}

function requireNoChartEllipsis(value: string) {
  if (/\.\.\.|…/.test(value)) throw new Error("Final report chart labels cannot contain ellipses.");
}

function trimFixed(value: number, decimals: number) {
  return Number(value.toFixed(decimals)).toString();
}

function setDeterministicPdfDates(document: PDFDocument) {
  const fixed = new Date("2026-08-11T00:00:00.000Z");
  document.setCreationDate(fixed);
  document.setModificationDate(fixed);
}

function formatNumber(value: number) {
  return formatParentFacingNumber(value);
}

function formatDerivedComponentForReport(
  report: AcademicReportSnapshot,
  subject: DerivedMarksSubject,
  componentKey: string
) {
  const value = displayedDerivedComponentValue(report, subject, componentKey);
  return value == null ? "NE" : formatParentFacingNumber(value);
}

function displayedDerivedComponentValue(
  report: AcademicReportSnapshot,
  subject: DerivedMarksSubject,
  componentKey: string
) {
  const values = subject.derivedFrom.flatMap((key) => {
    const source = report.subjects.find((candidate) => candidate.key === key);
    if (!source || source.kind !== "MARKS") return [];
    const component = source.components.find((candidate) => candidate.key === componentKey);
    return component?.value == null ? [] : [component.value];
  });
  return values.length === subject.derivedFrom.length ? roundTo(average(values), 1) : null;
}

function hasNumericTotal(
  subject: AcademicSubjectSnapshot | undefined
): subject is StandardMarksSubject | DerivedMarksSubject | CombinedMarksSubject {
  return Boolean(
    subject &&
    subject.kind !== "GRADE_ONLY" &&
    subject.total.value != null
  );
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function close(left: number, right: number) {
  return Math.abs(left - right) <= EPSILON;
}

function requiredText(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(label + " is required.");
  return result;
}

function unanimousOptional(rows: Record<string, unknown>[], key: string) {
  const values = [...new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean))];
  if (values.length > 1) throw new Error("Approved report templates disagree on " + key + ".");
  return values[0] || null;
}

function palette(mode: RefinedColourMode) {
  const mono = mode === "MONOCHROME";
  return {
    paper: mono ? rgb(1, 1, 1) : rgb(0.995, 0.992, 0.975),
    white: rgb(1, 1, 1),
    ink: mono ? rgb(0.1, 0.1, 0.1) : rgb(0.08, 0.1, 0.11),
    border: mono ? rgb(0.2, 0.2, 0.2) : rgb(0.35, 0.42, 0.43),
    band: mono ? rgb(0.86, 0.86, 0.86) : rgb(0.86, 0.9, 0.89),
    grid: mono ? rgb(0.65, 0.65, 0.65) : rgb(0.72, 0.76, 0.76),
    student: mono ? rgb(0.32, 0.32, 0.32) : rgb(0.18, 0.68, 0.73),
    average: mono ? rgb(0.78, 0.78, 0.78) : rgb(0.17, 0.36, 0.58),
    high: mono ? rgb(0.96, 0.96, 0.96) : rgb(0.68, 0.78, 0.89),
    legendTitle: mono ? rgb(0.1, 0.1, 0.1) : rgb(0.04, 0.36, 0.42),
    kgPinkLight: mono ? rgb(0.93, 0.93, 0.93) : rgb(0.98, 0.76, 0.84),
    kgPink: mono ? rgb(0.34, 0.34, 0.34) : rgb(0.82, 0.05, 0.39),
    kgPinkDark: mono ? rgb(0.18, 0.18, 0.18) : rgb(0.66, 0.04, 0.29),
    kgGreen: mono ? rgb(0.82, 0.82, 0.82) : rgb(0.76, 0.87, 0.65),
    kgGreenDark: mono ? rgb(0.52, 0.52, 0.52) : rgb(0.49, 0.69, 0.32),
    kgGreenText: mono ? rgb(0.22, 0.22, 0.22) : rgb(0.16, 0.42, 0.32),
    kgCream: mono ? rgb(0.97, 0.97, 0.97) : rgb(0.95, 0.96, 0.88),
    kgInk: mono ? rgb(0.14, 0.14, 0.14) : rgb(0.13, 0.15, 0.14)
  };
}

async function embedAssets(document: PDFDocument, identity: ReportSchoolIdentitySnapshot): Promise<Assets> {
  document.registerFontkit(fontkit);
  const regular = await embedFont(document, ["arial.ttf", "Arial.ttf"], StandardFonts.Helvetica);
  const bold = await embedFont(document, ["arialbd.ttf", "Arial Bold.ttf"], StandardFonts.HelveticaBold);
  const school = await embedFont(document, ["georgiab.ttf", "Georgia Bold.ttf"], StandardFonts.TimesRomanBold);
  const logoPath = path.resolve(process.cwd(), "public", identity.logoPath.replace(/^\//, ""));
  const logoBytes = await readFile(logoPath).catch(() => null);
  const colourLogo = logoBytes ? await document.embedPng(logoBytes) : null;
  const monochromeLogo = logoBytes
    ? await sharp(logoBytes).grayscale().png().toBuffer().then((bytes) => document.embedPng(bytes))
    : null;
  return { fonts: { regular, bold, school }, colourLogo, monochromeLogo };
}

async function embedFont(document: PDFDocument, candidates: string[], fallback: StandardFonts) {
  for (const candidate of candidates) {
    for (const root of [
      path.join(process.env.WINDIR ?? "C:\\Windows", "Fonts"),
      path.resolve(process.cwd(), "public", "fonts")
    ]) {
      try {
        return await document.embedFont(await readFile(path.join(root, candidate)), { subset: true });
      } catch {
        // Continue to the approved safe fallback.
      }
    }
  }
  return document.embedFont(fallback);
}
