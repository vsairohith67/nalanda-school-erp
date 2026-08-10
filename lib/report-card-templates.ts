import { Prisma } from "@prisma/client";
import { KG_ATTENDANCE_MONTHS, KG_CRITERIA, KG_EVALUATIONS, KG_GROWTH_PERIODS, KG_PERSONALITY_CODES, KG_PERSONALITY_TRAITS, KG_RESPONSE_SETS, KG_SUMMARY_AREAS } from "@/lib/kg-report-card";
import { safeReportCardText } from "@/lib/report-card-templates-shared";
import {
  CANONICAL_LAYOUT_VARIANTS,
  CANONICAL_REPORT_TEMPLATE_FAMILIES,
  canonicalFamilyFromDefinition,
  canonicalTemplateDefinition,
  type CanonicalReportTemplateFamily
} from "@/lib/report-card-canonical-templates";

export { safeReportCardText } from "@/lib/report-card-templates-shared";
export const REPORT_CARD_TYPES = ["MARK_BASED", "KG_RUBRIC"] as const;
export const REPORT_CARD_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;

export const DEFAULT_MARK_TEMPLATE = {
  schemaVersion: 1, type: "MARK_BASED", denominatorPolicy: "PRESENT_AND_ABSENT",
  includeAttendance: true, includeGuardianNames: true, approvalRoles: ["CLASS_TEACHER", "PRINCIPAL"],
  sections: ["STUDENT_PROFILE", "SUBJECT_RESULTS", "TOTALS", "ATTENDANCE", "COMMENTS", "APPROVALS"]
} as const;

export const DEFAULT_KG_TEMPLATE = {
  schemaVersion: 1, type: "KG_RUBRIC", evaluationPeriods: KG_EVALUATIONS,
  summaryAreas: KG_SUMMARY_AREAS,
  responseSets: Object.fromEntries(Object.entries(KG_RESPONSE_SETS).map(([key, values]) => [key, [...values]])),
  criteria: KG_CRITERIA.map(([key, section, label, responseSet]) => ({ key, section, label, responseSet })),
  personalityCodes: KG_PERSONALITY_CODES, personalityTraits: KG_PERSONALITY_TRAITS,
  attendanceMonths: KG_ATTENDANCE_MONTHS, growthPeriods: KG_GROWTH_PERIODS,
  approvalRoles: ["CLASS_TEACHER", "PRINCIPAL"], directorApprovalRequired: false,
  printPages: ["COVER", "PROFILE", "INSTRUCTIONS", "SUMMARY", "RUBRICS_1", "RUBRICS_2", "RUBRICS_3", "PERSONALITY_ATTENDANCE_GROWTH", "COMMENTS_PROMOTION", "BACK_COVER"]
} as const;

export function buildCanonicalReportCardTemplate(
  family: CanonicalReportTemplateFamily,
  layoutVariant: unknown,
  options: Parameters<typeof canonicalTemplateDefinition>[2] = {}
) {
  return canonicalTemplateDefinition(family, layoutVariant, {
    ...options,
    ...(family === "KG_DEVELOPMENTAL_BOOKLET"
      ? {
          kg: {
            evaluationPeriods: [...KG_EVALUATIONS],
            summaryAreas: [...KG_SUMMARY_AREAS],
            responseSets: Object.fromEntries(
              Object.entries(KG_RESPONSE_SETS).map(([key, values]) => [key, [...values]])
            ),
            criteria: KG_CRITERIA.map(([key, section, label, responseSet]) => ({
              key, section, label, responseSet
            })),
            personalityCodes: [...KG_PERSONALITY_CODES],
            personalityTraits: [...KG_PERSONALITY_TRAITS],
            attendanceMonths: [...KG_ATTENDANCE_MONTHS],
            growthPeriods: [...KG_GROWTH_PERIODS],
            approvalRoles: ["CLASS_TEACHER", "PRINCIPAL", "DIRECTOR"],
            directorApprovalRequired: true,
            printPages: [...DEFAULT_KG_TEMPLATE.printPages]
          }
        }
      : {})
  });
}

export function normalizeReportCardCode(value: unknown, label = "Code") {
  const code = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9-]{2,49}$/.test(code)) throw new Error(`${label} must use 3-50 letters, numbers, or hyphens.`);
  return code;
}

export function validateGradeBands(input: unknown) {
  if (!Array.isArray(input) || !input.length) throw new Error("Add at least one grade band.");
  if (input.length > 30) throw new Error("A grading scheme may contain at most 30 bands.");
  const codes = new Set<string>(); const orders = new Set<number>();
  const bands = input.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Grade band ${index + 1} must be an object.`);
    const row = value as Record<string, unknown>;
    const gradeCode = safeReportCardText(row.gradeCode, `Grade band ${index + 1} code`, 12)!.toUpperCase();
    const label = safeReportCardText(row.label, `Grade band ${index + 1} label`, 80)!;
    const minimumPercentage = percentage(row.minimumPercentage, `Grade band ${gradeCode} minimum`);
    const maximumPercentage = row.maximumPercentage === null || row.maximumPercentage === undefined || row.maximumPercentage === "" ? null : percentage(row.maximumPercentage, `Grade band ${gradeCode} maximum`);
    if (maximumPercentage && maximumPercentage.lt(minimumPercentage)) throw new Error(`Grade band ${gradeCode} maximum cannot be below its minimum.`);
    const displayOrder = Number(row.displayOrder ?? index + 1);
    if (!Number.isInteger(displayOrder) || displayOrder < 1 || displayOrder > 100) throw new Error("Grade-band display order must be from 1 to 100.");
    if (codes.has(gradeCode) || orders.has(displayOrder)) throw new Error("Grade-band codes and display orders must be unique.");
    codes.add(gradeCode); orders.add(displayOrder);
    return { gradeCode, label, minimumPercentage, maximumPercentage, displayOrder, remarks: safeReportCardText(row.remarks, "Grade-band remarks", 500, false) };
  });
  for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) {
    const a = bands[i]; const b = bands[j];
    const aMax = a.maximumPercentage ?? new Prisma.Decimal(100); const bMax = b.maximumPercentage ?? new Prisma.Decimal(100);
    if (a.minimumPercentage.lte(bMax) && b.minimumPercentage.lte(aMax)) throw new Error(`Grade bands ${a.gradeCode} and ${b.gradeCode} overlap.`);
  }
  return bands;
}

export function validateTemplateDefinition(reportTypeValue: unknown, input: unknown) {
  const reportType = String(reportTypeValue ?? "").toUpperCase();
  if (!(REPORT_CARD_TYPES as readonly string[]).includes(reportType)) throw new Error("Choose a valid report-card type.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Template definition must be an object.");
  rejectExecutableJson(input);
  const definition = input as Record<string, any>;
  const schemaVersion = Number(definition.schemaVersion);
  if (![1, 2].includes(schemaVersion) || definition.type !== reportType) throw new Error("Template schema version or type is invalid.");
  if (schemaVersion === 2) {
    validateCanonicalTemplate(definition, reportType);
  } else if (reportType === "MARK_BASED") {
    if (definition.denominatorPolicy !== "PRESENT_AND_ABSENT") throw new Error("Mark templates must use the documented Present-and-Absent denominator policy.");
    const allowedSections = new Set(DEFAULT_MARK_TEMPLATE.sections);
    if (!Array.isArray(definition.sections) || !definition.sections.length || definition.sections.some((value: unknown) => !allowedSections.has(String(value) as any))) throw new Error("Mark template sections are invalid.");
  } else {
    validateKgTemplate(definition);
  }
  return structuredClone(definition);
}

function validateCanonicalTemplate(definition: Record<string, any>, reportType: string) {
  const family = canonicalFamilyFromDefinition(definition);
  if (!family) throw new Error("Choose a supported canonical template family.");
  if ((family === "KG_DEVELOPMENTAL_BOOKLET") !== (reportType === "KG_RUBRIC")) {
    throw new Error("The canonical family does not match the report type.");
  }
  const variants = CANONICAL_LAYOUT_VARIANTS[family] as readonly string[];
  if (!variants.includes(String(definition.layoutVariant ?? ""))) {
    throw new Error("The canonical layout variant is invalid for this family.");
  }
  if (definition.denominatorPolicy !== "FROZEN_RESULT_SNAPSHOT") {
    throw new Error("Canonical templates must render the frozen result snapshot without recalculation.");
  }
  if (!Array.isArray(definition.sections) || !definition.sections.length || new Set(definition.sections).size !== definition.sections.length) {
    throw new Error("Canonical template sections must be a unique ordered list.");
  }
  if (!definition.identity || !["INCLUSIVE_GUARDIAN", "FATHER_NAME_COMPATIBILITY"].includes(definition.identity.parentGuardianMode)) {
    throw new Error("Canonical Student identity labels are invalid.");
  }
  ["studentLabel", "admissionLabel", "classSectionLabel", "rollLabel", "parentGuardianLabel"].forEach((key) => {
    safeReportCardText(definition.identity[key], `Canonical identity ${key}`, 160);
  });
  if (!definition.chart || definition.chart.directNumericLabels !== true ||
    JSON.stringify(definition.chart.series) !== JSON.stringify(["STUDENT_MARKS", "CLASS_AVERAGE", "HIGH_SCORE"])) {
    throw new Error("Canonical charts must preserve the three labelled print-safe series.");
  }
  const combined = String(definition.layoutVariant) === "COMBINED";
  if (Boolean(definition.combinedResult?.enabled) !== combined) {
    throw new Error("Combined-result capability must match the selected layout variant.");
  }
  if (!Array.isArray(definition.signatureLabels) || !definition.signatureLabels.length || definition.signatureLabels.length > 6) {
    throw new Error("Configure one to six signature labels.");
  }
  definition.signatureLabels.forEach((value: unknown) => safeReportCardText(value, "Signature label", 80));
  if (family === "KG_DEVELOPMENTAL_BOOKLET") validateKgTemplate(definition);
}

export function parseStoredTemplateDefinition(json: string) { try { const value = JSON.parse(json); return validateTemplateDefinition((value as any).type, value); } catch (error) { if (error instanceof SyntaxError) throw new Error("Stored template JSON is invalid."); throw error; } }

export function validatePrintSettings(input: unknown) {
  if (input === null || input === undefined || input === "") return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Print settings must be an object.");
  rejectExecutableJson(input);
  const row = input as Record<string, unknown>;
  const pageSize = String(row.pageSize ?? "A4").toUpperCase();
  if (pageSize !== "A4") throw new Error("Report-card print settings require exact A4 page boxes.");
  const scalePercent = boundedNumber(row.scalePercent ?? 100, "Print scale", 100, 100);
  const mode = String(row.mode ?? "COLOUR").toUpperCase();
  if (!["COLOUR", "BLACK_AND_WHITE"].includes(mode)) throw new Error("Print mode must be Colour or Black and White.");
  const orientation = String(row.orientation ?? "PORTRAIT").toUpperCase();
  if (!["PORTRAIT", "LANDSCAPE"].includes(orientation)) throw new Error("Print orientation must be portrait or landscape.");
  const minimumFontSizePt = boundedNumber(row.minimumFontSizePt ?? 9, "Minimum font size", 8.5, 11);
  const marginMm = boundedNumber(row.marginMm ?? 10, "Print margin", 8, 20);
  return {
    mode,
    booklet: Boolean(row.booklet),
    pageSize: pageSize as "A4",
    orientation,
    minimumFontSizePt,
    marginMm,
    scalePercent: scalePercent as 100
  };
}

function validateKgTemplate(definition: Record<string, any>) {
  const exact = (actual: unknown, expected: readonly string[], label: string) => {
    if (!Array.isArray(actual) || actual.length !== expected.length || new Set(actual.map(String)).size !== expected.length || expected.some((value) => !actual.includes(value))) throw new Error(`${label} must contain the supported values exactly once.`);
  };
  exact(definition.evaluationPeriods, KG_EVALUATIONS, "KG evaluation periods");
  exact(definition.attendanceMonths, KG_ATTENDANCE_MONTHS, "KG attendance months");
  exact(definition.growthPeriods, KG_GROWTH_PERIODS, "KG growth periods");
  exact(definition.personalityCodes, KG_PERSONALITY_CODES, "KG personality codes");
  exact(definition.personalityTraits, KG_PERSONALITY_TRAITS, "KG personality traits");
  exact(definition.summaryAreas, KG_SUMMARY_AREAS, "KG summary areas");
  if (!definition.responseSets || typeof definition.responseSets !== "object") throw new Error("KG response sets are required.");
  for (const [key, values] of Object.entries(KG_RESPONSE_SETS)) exact(definition.responseSets[key], values, `KG response set ${key}`);
  if (!Array.isArray(definition.criteria) || definition.criteria.length !== KG_CRITERIA.length) throw new Error("KG criteria are incomplete.");
  const keys = new Set<string>();
  for (const criterion of definition.criteria) {
    if (!criterion || typeof criterion !== "object") throw new Error("Each KG criterion must be an object.");
    const key = String(criterion.key ?? "");
    if (keys.has(key) || !KG_CRITERIA.some((item) => item[0] === key && item[3] === criterion.responseSet)) throw new Error("KG criterion keys must be unique and reference a supported response set.");
    safeReportCardText(criterion.section, "KG criterion section", 80); safeReportCardText(criterion.label, "KG criterion label", 120); keys.add(key);
  }
  if (!Array.isArray(definition.printPages) || definition.printPages.length !== 10) throw new Error("KG print templates must define the supported 10-page booklet structure.");
}

function rejectExecutableJson(value: unknown, path = "template") {
  if (typeof value === "string") { safeReportCardText(value, path, 5000, false); return; }
  if (Array.isArray(value)) { if (value.length > 500) throw new Error(`${path} contains too many items.`); value.forEach((item, index) => rejectExecutableJson(item, `${path}[${index}]`)); return; }
  if (value && typeof value === "object") { for (const [key, item] of Object.entries(value)) { if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`${path} contains an unsafe key.`); rejectExecutableJson(item, `${path}.${key}`); } }
}
function percentage(value: unknown, label: string) { const raw = String(value ?? "").trim(); if (!/^\d{1,3}(\.\d{1,4})?$/.test(raw)) throw new Error(`${label} must be from 0 to 100.`); const result = new Prisma.Decimal(raw); if (result.lt(0) || result.gt(100)) throw new Error(`${label} must be from 0 to 100.`); return result; }
function boundedNumber(value: unknown, label: string, minimum: number, maximum: number) { const number = Number(value); if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(`${label} must be from ${minimum} to ${maximum}.`); return number; }
