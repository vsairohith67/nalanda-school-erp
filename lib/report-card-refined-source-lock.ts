import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
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
  includeInOverall: boolean;
  chartIncluded: boolean;
  classAveragePercentage: number;
  highScorePercentage: number;
  aggregateOf: string[];
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
  studentPercentage: number;
  classAveragePercentage: number;
  highScorePercentage: number;
  classSnapshotId: string;
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
type Assets = { fonts: Fonts; logo: PDFImage | null };
type Palette = ReturnType<typeof palette>;

const A4 = { width: 595.28, height: 841.89 } as const;
const EPSILON = 0.0001;
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

export function templateFamilyForMode(mode: RefinedColourMode): RefinedTemplateFamily {
  return mode === "MONOCHROME"
    ? "NALANDA_LEGACY_REFINED_MONOCHROME"
    : "NALANDA_LEGACY_REFINED_COLOUR";
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
    drawPage(page, assets, identity, kind, "COLOUR", true);
  }
  document.setTitle("EDGE-CASE-RENDERING-PACK-R4");
  document.setSubject("Synthetic-only long-name and AB/EX/NE/NA rendering evidence");
  document.setProducer("Nalanda ERP local synthetic source-lock renderer");
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
      const sources = subject.derivedFrom.map((key) => byKey.get(key));
      if (sources.some((source) => !source || !hasNumericTotal(source))) {
        throw new Error("Derived subject source is missing for " + subject.label + ".");
      }
      const numericSources = sources.filter(hasNumericTotal);
      const expectedMaximum = roundTo(average(numericSources.map((source) => source.total.maximum)), 2);
      const expectedValue = roundTo(average(numericSources.map((source) => Number(source.total.value))), 2);
      if (!close(subject.total.maximum, expectedMaximum) || !close(subject.total.value, expectedValue)) {
        throw new Error("Derived subject total does not reconcile for " + subject.label + ".");
      }
      if (subject.grade !== gradeForScale(expectedValue / expectedMaximum * 100, report.gradeScale)) {
        throw new Error("Subject grade does not use the report grade scale for " + subject.label + ".");
      }
    }
    if (subject.kind === "COMBINED") {
      if (!report.combinedScheme) throw new Error("Combined report requires its frozen examination scheme.");
      validateCombinedSubject(subject, report.combinedScheme);
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
  const expectedLegend = report.gradeScale.bands.map((band) => ({ range: band.displayRange, grade: band.label }));
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
      !close(point.classAveragePercentage, subject.classAveragePercentage) ||
      !close(point.highScorePercentage, subject.highScorePercentage)
    ) {
      throw new Error("Chart comparison values do not use the frozen class snapshot.");
    }
    if (
      point.classAveragePercentage < 0 ||
      point.highScorePercentage > 100 ||
      point.classAveragePercentage > point.highScorePercentage
    ) {
      throw new Error("Chart class comparison values are invalid.");
    }
  }
  return report;
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
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.paper });
  if (kind === "KG_COVER") drawKgCover(page, assets, identity, colors, edgeCase);
  else if (kind === "KG_PROFILE") drawKgProfile(page, assets, identity, colors, edgeCase);
  else if (kind === "KG_INTELLECTUAL") drawKgIntellectual(page, assets, identity, colors, edgeCase);
  else drawAcademic(page, assets, identity, colors, mode, buildSyntheticAcademicSnapshot(kind, edgeCase));
  drawFooter(page, assets.fonts, mode, edgeCase);
}

function drawKgCover(
  page: PDFPage,
  assets: Assets,
  identity: ReportSchoolIdentitySnapshot,
  colors: Palette,
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
  if (assets.logo) page.drawImage(assets.logo, { x: (A4.width - 52) / 2, y: 510, width: 52, height: 52 });
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
  report: AcademicReportSnapshot
) {
  drawAcademicHeader(page, assets, identity, colors);
  const identityBottom = drawIdentity(page, assets.fonts, colors, report);
  centered(page, report.examination, assets.fonts.bold, 13.5, A4.height - identityBottom - 31, colors.ink);
  const tableTop = identityBottom + 42;
  const fullWidth = A4.width - 74;
  let contentBottom: number;
  if (report.layout === "COMBINED") {
    contentBottom = drawCombinedTable(page, assets.fonts, colors, report, tableTop);
  } else {
    contentBottom = drawStandardTables(page, assets.fonts, colors, report, tableTop);
  }
  contentBottom = drawResultStateLegend(page, assets.fonts, colors, report, contentBottom);
  let top = contentBottom + 8;
  top = drawSummary(page, assets.fonts, colors, report, top) + 9;
  top = drawAttendance(page, assets.fonts, colors, report, top) + 9;
  top = drawRemarks(page, assets.fonts, colors, report.remarks, top) + 10;
  const reserved = 116;
  const chartHeight = Math.max(88, Math.min(report.layout === "COMBINED" ? 110 : 145, A4.height - top - reserved));
  top = drawChart(page, assets.fonts, colors, report, 37, top, fullWidth, chartHeight, mode) + 9;
  drawGradeLegend(page, assets.fonts, colors, 37, top, fullWidth, report.gradeLegend);
  drawSignatures(page, assets.fonts, colors);
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

function drawAcademicHeader(page: PDFPage, assets: Assets, identity: ReportSchoolIdentitySnapshot, colors: Palette) {
  if (assets.logo) page.drawImage(assets.logo, { x: 112, y: 748, width: 64, height: 64 });
  centered(page, identity.schoolName.toUpperCase(), assets.fonts.school, 21, 786, colors.ink, 45);
  const approvedLines = [
    identity.affiliationWording,
    identity.recognitionWording,
    identity.establishmentYear ? "Established " + identity.establishmentYear : null
  ].filter((value): value is string => Boolean(value));
  let y = 763;
  for (const line of approvedLines) {
    centered(page, line, assets.fonts.school, 9.5, y, colors.ink, 70);
    y -= 15;
  }
  centered(page, identity.addressLine1 + ", " + identity.city, assets.fonts.school, 10.5, approvedLines.length ? y : 749, colors.ink, 70);
}

function drawIdentity(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot) {
  const rows = [
    { cells: ["Student Name", report.studentName], bold: false },
    { cells: [report.parentGuardianLabel, report.guardianName], bold: false },
    { cells: ["Admission Number", report.admissionNumber], bold: false }
  ];
  const identityBottom = drawTable(page, fonts, colors, 39, 108, [235, 285], [], rows, {
    headerHeight: 0,
    rowHeight: 16,
    fontSize: Math.max(7.8, R4_MINIMUM_FONT_SIZES.identityValue),
    firstColumnLeft: false,
    identity: true,
    dynamicRows: true
  });
  return drawTable(page, fonts, colors, 39, identityBottom, [120, 140, 120, 140], [], [
    { cells: ["Class / Section", report.classSection, "Roll Number", report.rollNumber], bold: false }
  ], {
    headerHeight: 0,
    rowHeight: 16,
    fontSize: Math.max(7.8, R4_MINIMUM_FONT_SIZES.identityValue),
    firstColumnLeft: false,
    identity: true,
    dynamicRows: true
  });
}

function drawStandardTables(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot, top: number) {
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
    bold: subject.kind === "DERIVED"
  }));
  const marksBottom = drawTable(page, fonts, colors, 37, top, widths, headers, rows, {
    headerHeight: dense ? 28 : 32,
    rowHeight: dense ? 15 : 18,
    fontSize: dense ? 6.7 : 7.4,
    firstColumnLeft: true,
    dynamicRows: true,
    sectionFill: colors.band
  });
  let traitBottom = top;
  if (report.traitTitle) {
    const traitRows = report.traits.map((trait, index) => ({
      cells: [trait, index % 7 === 4 ? "S" : "G"],
      bold: false
    }));
    traitBottom = drawTable(page, fonts, colors, 37 + marksWidth, top, [traitWidth - 48, 48], [report.traitTitle, "Grade"], traitRows, {
      headerHeight: dense ? 28 : 32,
      rowHeight: dense ? 15 : 18,
      fontSize: dense ? 6.7 : 7.2,
      firstColumnLeft: false,
      dynamicRows: true
    });
    traitBottom = drawTable(page, fonts, colors, 37 + marksWidth, traitBottom, [52, (traitWidth - 52) / 2, (traitWidth - 52) / 2], [], [
      { cells: ["Grading", "G : Good", "S : Satisfactory"], bold: false },
      { cells: ["", "N : Needs Improvement", ""], bold: false }
    ], {
      headerHeight: 0,
      rowHeight: dense ? 12 : 14,
      fontSize: R4_MINIMUM_FONT_SIZES.legend,
      firstColumnLeft: false,
      dynamicRows: true
    });
  }
  return Math.max(marksBottom, traitBottom);
}

function drawCombinedTable(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot, top: number) {
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
    bold: subject.kind === "COMBINED" && subject.label.includes("Average")
  }));
  let bottom = drawTable(page, fonts, colors, 37, top, widths, ["Subject", ...columns], rows, {
    headerHeight: 34,
    rowHeight: 18,
    fontSize: Math.max(6.4, R4_MINIMUM_FONT_SIZES.denseClassIxTable),
    firstColumnLeft: true,
    dynamicRows: true,
    sectionFill: colors.band
  });
  const legend = `${scheme.ctLabel} = ${scheme.ctFullLabel};   I.A. = ${scheme.internalAssessmentLabel};   Wt. = weighted contribution;   ${scheme.terminalLabel} = ${scheme.terminalFullLabel};   G.P. = Grade Point`;
  bottom = drawWrappedBox(page, fonts.regular, colors, 37, bottom, A4.width - 74, legend, 6.8, 18);
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
      formatNumber(subject.total.value)
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
    displayTotal(subject.total)
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
    formatNumber(value.ct1), formatNumber(value.ia1), formatNumber(value.ct2), formatNumber(value.ia2),
    formatNumber(value.ct3), formatNumber(value.ia3), formatNumber(value.ctWeighted),
    formatNumber(value.terminalRaw), formatNumber(value.terminalWeighted), formatNumber(value.annualRaw),
    formatNumber(value.annualWeighted), formatNumber(subject.total.value), subject.grade,
    formatNumber(value.gradePoint)
  ];
}

function drawSummary(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicReportSnapshot, top: number) {
  const values = [
    "Total: " + formatNumber(report.overall.value) + " / " + formatNumber(report.overall.maximum),
    "Percentage: " + formatNumber(report.overall.percentage) + "%",
    "Grade: " + report.overall.grade,
    ...(report.overall.gradePoint == null ? [] : ["Grade Point: " + formatNumber(report.overall.gradePoint)]),
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
      formatNumber(report.attendance.percentage) + "%"
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
  const bottom = A4.height - top - height + 22;
  const left = x + 24;
  const chartWidth = width - 36;
  const chartHeight = height - 52;
  page.drawText("Student Marks (%)", { x: x + 8, y: A4.height - top - 16, size: 9, font: fonts.bold, color: colors.ink });
  const legendX = x + width - 226;
  const series = [
    { label: "Student Marks", color: colors.student, pattern: "SOLID" as const },
    { label: "Class Average", color: colors.average, pattern: "DIAGONAL" as const },
    { label: "High Score", color: colors.high, pattern: "HORIZONTAL" as const }
  ];
  series.forEach((item, index) => {
    const box = { x: legendX + index * 76, y: A4.height - top - 18, width: 8, height: 8 };
    drawPatternedRectangle(page, box, item.color, colors.ink, mode === "MONOCHROME" ? item.pattern : "SOLID");
    page.drawText(item.label, { x: box.x + 11, y: A4.height - top - 17, size: 6.1, font: fonts.bold, color: colors.ink });
  });
  for (let tick = 0; tick <= 100; tick += 20) {
    const y = bottom + chartHeight * tick / 100;
    page.drawLine({ start: { x: left, y }, end: { x: left + chartWidth, y }, thickness: 0.35, color: colors.grid, dashArray: [2, 2] });
    page.drawText(String(tick), { x: left - 18, y: y - 2, size: R4_MINIMUM_FONT_SIZES.chartLabel, font: fonts.regular, color: colors.ink });
  }
  const slot = chartWidth / report.chartPoints.length;
  report.chartPoints.forEach((point, index) => {
    const values = [point.studentPercentage, point.classAveragePercentage, point.highScorePercentage];
    values.forEach((value, seriesIndex) => {
      const barWidth = Math.max(4.5, Math.min(9, slot / 4));
      const barX = left + index * slot + slot / 2 - barWidth * 1.5 + seriesIndex * barWidth;
      const barHeight = chartHeight * value / 100;
      drawPatternedRectangle(page, {
        x: barX, y: bottom, width: barWidth - 0.7, height: barHeight
      }, series[seriesIndex].color, colors.ink, mode === "MONOCHROME" ? series[seriesIndex].pattern : "SOLID");
      page.drawText(formatNumber(value), {
        x: barX - 1, y: bottom + barHeight + 2, size: R4_MINIMUM_FONT_SIZES.chartLabel, font: fonts.bold, color: colors.ink
      });
    });
    const labelLines = wrapText(chartLabel(point.subjectLabel), fonts.regular, R4_MINIMUM_FONT_SIZES.chartLabel, slot - 2);
    labelLines.slice(0, 2).forEach((line, lineIndex) => page.drawText(line, {
      x: left + index * slot + 1,
      y: bottom - 9 - lineIndex * 7,
      size: R4_MINIMUM_FONT_SIZES.chartLabel,
      font: fonts.regular,
      color: colors.ink
    }));
  });
  return top + height;
}

function drawGradeLegend(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  width: number,
  legend: AcademicReportSnapshot["gradeLegend"]
) {
  const widths = [126, ...legend.map(() => (width - 126) / legend.length)];
  page.drawText("Grade Legend", { x: x + width / 2 - 28, y: A4.height - top + 3, size: 8, font: fonts.regular, color: colors.legendTitle });
  return drawTable(page, fonts, colors, x, top, widths, [], [
    { cells: ["School % Ratings", ...legend.map((item) => item.range)], bold: false },
    { cells: ["Grade", ...legend.map((item) => item.grade)], bold: false }
  ], {
    headerHeight: 0,
    rowHeight: 15,
    fontSize: 7,
    firstColumnLeft: false
  });
}

function drawSignatures(page: PDFPage, fonts: Fonts, colors: Palette) {
  ["Class Teacher", "Principal", "Parent / Guardian", "Director"].forEach((label, index) => {
    const x = 66 + index * 137;
    page.drawLine({ start: { x, y: 53 }, end: { x: x + 92, y: 53 }, thickness: 0.45, color: colors.border });
    page.drawText(label, { x: x + 8, y: 38, size: 7.8, font: fonts.bold, color: colors.ink });
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
  for (const row of rows) {
    cursorTop += drawTableRow(page, fonts, colors, x, cursorTop, widths, row.cells, options.rowHeight, options.fontSize, {
      bold: row.bold,
      firstColumnLeft: options.firstColumnLeft,
      fill: row.bold && options.sectionFill ? options.sectionFill : row.bold ? colors.band : colors.white,
      textColor: colors.ink,
      dynamic: options.dynamicRows,
      identity: options.identity
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
  }
) {
  const font = options.bold ? fonts.bold : fonts.regular;
  const wrapped = values.map((value, index) => wrapText(String(value), font, fontSize, widths[index] - 6));
  const required = Math.max(...wrapped.map((lines) => 6 + lines.length * (fontSize + 1)));
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
  pattern: "SOLID" | "DIAGONAL" | "HORIZONTAL"
) {
  page.drawRectangle({ ...box, color: fill, borderColor: ink, borderWidth: 0.35 });
  if (pattern === "DIAGONAL") {
    for (let offset = -box.height; offset < box.width; offset += 4) {
      const x1 = Math.max(box.x, box.x + offset);
      const y1 = box.y + Math.max(0, -offset);
      const x2 = Math.min(box.x + box.width, box.x + offset + box.height);
      const y2 = box.y + Math.min(box.height, box.height + offset);
      if (x2 > x1) page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, color: ink });
    }
  }
  if (pattern === "HORIZONTAL") {
    for (let y = box.y + 3; y < box.y + box.height; y += 4) {
      page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.3, color: ink });
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
  const subjects: AcademicSubjectSnapshot[] = values.map(([key, label, internal, written], index) => {
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
      70 + index * 1.4,
      94 + index % 3 * 2,
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
  const baseRows = raw.map(([key, label, internal, written], index) =>
    marksSubject(
      String(key),
      edgeCase && key === "computer" ? "Computer Applications and Information Technology" : String(label),
      columns,
      [Number(internal), edgeCase && key === "math" ? null : Number(written)],
      edgeCase && key === "math" ? ["PRESENT", "NOT_ENTERED"] : ["PRESENT", "PRESENT"],
      ["hindi", "math", "computer", "telugu"].includes(String(key)),
      !edgeCase || key !== "math",
      65 + index * 1.6,
      92 + index % 4 * 2,
      gradeScale
    )
  );
  const byKey = new Map(baseRows.map((row) => [row.key, row]));
  const derived = [
    derivedSubject("englishAverage", "English Average", ["english1", "english2"], byKey, true, 69, 96, gradeScale),
    derivedSubject("socialAverage", "Social Average", ["history", "geography"], byKey, true, 72, 98, gradeScale),
    derivedSubject("scienceAverage", "Science Average", ["physics", "chemistry", "biology"], byKey, true, 70, 97, gradeScale)
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
  const labels = [
    ["english1", "English Paper 1"], ["english2", "English Paper 2"], ["englishAverage", "English Average"],
    ["hindi", "Hindi"], ["math", "Mathematics"], ["physics", "Physics"], ["biology", "Biology"],
    ["chemistry", "Chemistry"], ["scienceAverage", "Science Average"], ["geography", "Geography"],
    ["history", "History"], ["socialAverage", "Social Average"], ["computer", "Computers"]
  ];
  const subjects = labels.map(([key, label], index) => combinedSubject(
    key,
    edgeCase && key === "math" ? "Mathematics with Advanced Applications and Projects" : label,
    index,
    ["englishAverage", "hindi", "math", "scienceAverage", "socialAverage", "computer"].includes(key),
    scheme,
    gradeScale,
    key === "englishAverage" ? ["english1", "english2"] :
      key === "scienceAverage" ? ["physics", "chemistry", "biology"] :
      key === "socialAverage" ? ["geography", "history"] : []
  ));
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
    gradePoint: null,
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
  classAveragePercentage: number,
  highScorePercentage: number,
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
    classAveragePercentage,
    highScorePercentage,
    aggregateOf: []
  };
}

function derivedSubject(
  key: string,
  label: string,
  derivedFrom: string[],
  byKey: Map<string, StandardMarksSubject>,
  includeInOverall: boolean,
  classAveragePercentage: number,
  highScorePercentage: number,
  gradeScale: GradeScaleSnapshot
): DerivedMarksSubject {
  const sources = derivedFrom.map((sourceKey) => byKey.get(sourceKey)!);
  const maximum = roundTo(average(sources.map((source) => source.total.maximum)), 2);
  const value = roundTo(average(sources.map((source) => Number(source.total.value))), 2);
  return {
    kind: "DERIVED",
    key,
    label,
    derivedFrom,
    total: { maximum, value, state: "PRESENT" },
    grade: gradeForScale(value / maximum * 100, gradeScale),
    includeInOverall,
    chartIncluded: true,
    classAveragePercentage,
    highScorePercentage,
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
    classAveragePercentage: 0,
    highScorePercentage: 0,
    aggregateOf: []
  };
}

function combinedSubject(
  key: string,
  label: string,
  index: number,
  includeInOverall: boolean,
  scheme: CombinedSchemeSnapshot,
  gradeScale: GradeScaleSnapshot,
  aggregateOf: string[]
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
    total: {
      maximum: totalMaximum,
      value: totalValue,
      state: "PRESENT"
    },
    grade: gradeForScale(totalValue / totalMaximum * 100, gradeScale),
    includeInOverall,
    chartIncluded: true,
    classAveragePercentage: 68 + index % 8,
    highScorePercentage: 91 + index % 5,
    aggregateOf
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
  const chartPoints = selectChartSubjects(input.subjects, input.chartPolicy).map((subject) => ({
    subjectKey: subject.key,
    subjectLabel: subject.label,
    studentPercentage: roundTo(Number(subject.total.value) / subject.total.maximum * 100, 2),
    classAveragePercentage: subject.classAveragePercentage,
    highScorePercentage: subject.highScorePercentage,
    classSnapshotId: input.classSnapshotId
  }));
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

function displayComponent(component: MarkComponentSnapshot) {
  if (component.state === "PRESENT") return formatNumber(Number(component.value));
  return resultStateCode(component.state);
}

function displayTotal(total: StandardMarksSubject["total"]) {
  return total.state === "PRESENT" ? formatNumber(Number(total.value)) : resultStateCode(total.state);
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

function gradeLegendForScale(scale: GradeScaleSnapshot) {
  return scale.bands.map((band) => ({ range: band.displayRange, grade: band.label }));
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
  centered(page, "SYNTHETIC SAMPLE - NOT FOR ISSUE", fonts.bold, R4_MINIMUM_FONT_SIZES.legend, 11, rgb(0.42, 0.42, 0.42));
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color: RGB, xOffset = 0) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4.width - width) / 2 + xOffset, y, size, font, color });
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
  const paragraphs = String(value).replace(/[^\x20-\x7E\n]/g, "-").split("\n");
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

function chartLabel(value: string) {
  return value
    .replace("English Paper 1", "English P1")
    .replace("English Paper 2", "English P2")
    .replace("Computer Applications and Information Technology", "Computers")
    .replace("Computer Applications and Digital Learning Foundations", "Computers");
}

function formatNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function formatDerivedComponentForReport(
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
  return values.length === subject.derivedFrom.length ? formatNumber(roundTo(average(values), 2)) : "NE";
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
    ink: rgb(0.08, 0.1, 0.11),
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
    kgInk: rgb(0.13, 0.15, 0.14)
  };
}

async function embedAssets(document: PDFDocument, identity: ReportSchoolIdentitySnapshot): Promise<Assets> {
  document.registerFontkit(fontkit);
  const regular = await embedFont(document, ["arial.ttf", "Arial.ttf"], StandardFonts.Helvetica);
  const bold = await embedFont(document, ["arialbd.ttf", "Arial Bold.ttf"], StandardFonts.HelveticaBold);
  const school = await embedFont(document, ["georgiab.ttf", "Georgia Bold.ttf"], StandardFonts.TimesRomanBold);
  const logoPath = path.resolve(process.cwd(), "public", identity.logoPath.replace(/^\//, ""));
  const logo = await readFile(logoPath).then((bytes) => document.embedPng(bytes)).catch(() => null);
  return { fonts: { regular, bold, school }, logo };
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
